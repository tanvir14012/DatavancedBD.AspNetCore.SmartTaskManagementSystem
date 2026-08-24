using Application.Interfaces;
using Application.Models;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/", GetTasks)
            .WithName("GetTasks")
            .WithSummary("List tasks scoped to the current user role and filters")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetTasks(
        AppDbContext dbContext,
        ICurrentUser currentUser,
        ICacheService cacheService,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] int? projectId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var userId = currentUser.UserId.Value;
        var roleScope = currentUser.IsInRole("Admin")
            ? "admin"
            : currentUser.IsInRole("Project Manager")
                ? $"pm-{userId}"
                : $"member-{userId}";

        var cacheKey = $"tasks:list:{roleScope}:{projectId ?? 0}:{status ?? "all"}:{priority ?? "all"}:{assigneeId ?? "all"}:{search ?? string.Empty}:{start}:{length}:{sortColumn ?? "CreatedAt"}:{sortDirection ?? "desc"}";
        var cachedResponse = await cacheService.GetAsync<TaskListResponse>(cacheKey, cancellationToken);
        if (cachedResponse is not null)
        {
            return Results.Ok(cachedResponse);
        }

        IQueryable<Domain.ProjectTask> query = dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            if (currentUser.IsInRole("Project Manager"))
            {
                query = query.Where(t => t.Project.Members.Any(m =>
                    m.UserId == userId &&
                    (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)));
            }
            else
            {
                query = query.Where(t => t.Assignees.Any(a => a.UserId == userId));
            }
        }

        if (projectId.HasValue)
        {
            query = query.Where(t => t.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(assigneeId))
        {
            query = query.Where(t => t.Assignees.Any(a => a.UserId == int.Parse(assigneeId)));
        }

        var request = new DataTableRequest
        {
            Start = start,
            Length = length,
            Search = search,
            SortColumn = string.IsNullOrWhiteSpace(sortColumn) ? "CreatedAt" : sortColumn,
            SortDirection = string.IsNullOrWhiteSpace(sortDirection) ? "desc" : sortDirection,
            DropdownFilters = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                [nameof(Domain.ProjectTask.ProjectId)] = projectId?.ToString(),
                [nameof(Domain.ProjectTask.Status)] = status,
                [nameof(Domain.ProjectTask.Priority)] = priority,
            }
        };

        var configuration = new DataTableQueryConfiguration { MaxPageSize = 200 };
        configuration.SearchableColumns.Add(nameof(Domain.ProjectTask.Title));
        configuration.SearchableColumns.Add(nameof(Domain.ProjectTask.Description));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.Title));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.ProjectId));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.Status));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.Priority));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.DueDate));
        configuration.SortableColumns.Add(nameof(Domain.ProjectTask.CreatedAt));
        configuration.FilterableColumns.Add(nameof(Domain.ProjectTask.ProjectId));
        configuration.FilterableColumns.Add(nameof(Domain.ProjectTask.Status));
        configuration.FilterableColumns.Add(nameof(Domain.ProjectTask.Priority));

        var page = await query.ToDataTablePageAsync(
            dbContext,
            request,
            t => new TaskListProjection(
                t.Id,
                t.ProjectId,
                t.Project.Name,
                t.Title,
                t.Description,
                t.Status,
                t.Priority,
                t.DueDate,
                t.CreatedAt,
                t.Project.Members.Any(m =>
                    m.UserId == userId &&
                    (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner))),
            configuration,
            cancellationToken);

        var items = page.Items.Select(item =>
        {
            var canDelete = currentUser.IsInRole("Admin") || 
                (currentUser.IsInRole("Project Manager") && item.UserIsProjectManager);

            return new TaskListItem(
                item.Id,
                item.ProjectId,
                item.ProjectName,
                item.Title,
                item.Description,
                item.Status.ToString(),
                item.Priority.ToString(),
                item.DueDate?.ToString("yyyy-MM-dd"),
                item.CreatedAt,
                true,
                canDelete);
        }).ToList();

        var response = new TaskListResponse(
            (start / Math.Max(length, 1)) + 1,
            length,
            page.TotalCount,
            page.FilteredCount,
            (int)Math.Ceiling(page.FilteredCount / (double)Math.Max(length, 1)),
            items);

        await cacheService.SetAsync(
            cacheKey,
            response,
            new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(3) },
            cancellationToken);

        return Results.Ok(response);
    }
}

public sealed record TaskListProjection(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    ProjectTaskStatus Status,
    TaskPriority Priority,
    DateOnly? DueDate,
    DateTime CreatedAt,
    bool UserIsProjectManager);

public sealed record TaskListItem(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    string? DueDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete);

public sealed record TaskListResponse(
    int Page,
    int PageSize,
    int TotalCount,
    int FilteredCount,
    int TotalPages,
    IReadOnlyList<TaskListItem> Items);
