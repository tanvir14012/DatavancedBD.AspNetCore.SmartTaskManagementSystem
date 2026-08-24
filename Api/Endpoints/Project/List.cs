using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapGet("/", GetProjects)
            .WithName("GetProjects")
            .WithSummary("Get projects with search, sort and paging")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetProjects(
        AppDbContext dbContext,
        ICurrentUser currentUser,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var query = dbContext.Projects
            .AsNoTracking()
            .Include(p => p.Members)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            var userId = currentUser.UserId.Value;
            query = query.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        var normalizedStatus = NormalizeProjectStatus(status);
        if (!string.IsNullOrWhiteSpace(normalizedStatus))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            switch (normalizedStatus)
            {
                case "active":
                    query = query.Where(p => !p.IsArchived);
                    break;
                case "archived":
                    query = query.Where(p => p.IsArchived);
                    break;
                case "planned":
                    query = query.Where(p => !p.IsArchived && (!p.StartDate.HasValue || p.StartDate.Value > today));
                    break;
                case "completed":
                    query = query.Where(p => !p.IsArchived && p.EndDate.HasValue && p.EndDate.Value <= today);
                    break;
            }
        }

        var dataTableRequest = new DataTableRequest
        {
            Start = start,
            Length = length,
            Search = search,
            SortColumn = NormalizeSortColumn(sortColumn, "CreatedAt"),
            SortDirection = string.IsNullOrWhiteSpace(sortDirection) ? "desc" : sortDirection,
        };

        var configuration = new DataTableQueryConfiguration { MaxPageSize = 200 };
        configuration.SearchableColumns.Add("Name");
        configuration.SearchableColumns.Add("Description");
        configuration.SortableColumns.Add("Name");
        configuration.SortableColumns.Add("StartDate");
        configuration.SortableColumns.Add("EndDate");
        configuration.SortableColumns.Add("CreatedAt");
        configuration.SortableColumns.Add("UpdatedAt");

        var page = await query.ToDataTablePageAsync(
            dbContext,
            dataTableRequest,
            p => new ProjectListItem(
                p.Id,
                p.Name,
                p.Description,
                p.StartDate,
                p.EndDate,
                p.CreatedAt,
                p.UpdatedAt,
                currentUser.IsInRole("Admin") || p.Members.Any(m => m.UserId == currentUser.UserId.Value && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)),
                currentUser.IsInRole("Admin"),
                p.IsArchived,
                p.Members.Where(m => m.UserId == currentUser.UserId.Value).Select(m => m.ProjectRole).FirstOrDefault()),
            configuration,
            cancellationToken);

        var projectIds = page.Items.Select(item => item.Id).Distinct().ToList();
        var taskCountsByProjectId = await dbContext.ProjectTasks
            .AsNoTracking()
            .Where(task => projectIds.Contains(task.ProjectId) && !task.IsDeleted)
            .GroupBy(task => task.ProjectId)
            .Select(group => new { ProjectId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(pair => pair.ProjectId, pair => pair.Count, cancellationToken);

        var items = page.Items.Select(item => new
        {
            id = item.Id,
            name = item.Name,
            description = item.Description,
            startDate = item.StartDate,
            endDate = item.EndDate,
            createdAt = item.CreatedAt,
            updatedAt = item.UpdatedAt,
            canEdit = item.CanEdit,
            canDelete = item.CanDelete,
            status = item.IsArchived ? "Archived" : "Active",
            role = item.CurrentUserRole.ToString(),
            taskCount = taskCountsByProjectId.TryGetValue(item.Id, out var count) ? count : 0,
            currentUserRole = item.CurrentUserRole,
        }).ToList();

        return Results.Ok(new
        {
            page = (start / Math.Max(length, 1)) + 1,
            pageSize = length,
            totalCount = page.TotalCount,
            filteredCount = page.FilteredCount,
            totalPages = (int)Math.Ceiling(page.FilteredCount / (double)Math.Max(length, 1)),
            items
        });
    }

    private static string NormalizeSortColumn(string? value, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
            return fallback;

        return value.Trim() switch
        {
            "name" => "Name",
            "createdat" => "CreatedAt",
            "updatedat" => "UpdatedAt",
            "startdate" => "StartDate",
            "enddate" => "EndDate",
            _ => value.Trim()
        };
    }

    private static string? NormalizeProjectStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) || string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
            return null;

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "archived" => "archived",
            "planned" => "planned",
            "completed" => "completed",
            _ => status.Trim()
        };
    }
}

public sealed record ProjectListItem(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool CanEdit,
    bool CanDelete,
    bool IsArchived,
    ProjectRole CurrentUserRole);
