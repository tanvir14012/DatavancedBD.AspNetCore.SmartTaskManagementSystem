using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Board : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/board", GetBoard)
            .WithName("GetTaskBoard")
            .WithSummary("Get a kanban board for admin and project-manager task visibility")
            .Produces<TaskBoardResponse>(StatusCodes.Status200OK)
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> GetBoard(
        AppDbContext dbContext,
        ICurrentUser currentUser,
        [FromQuery] int? projectId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? priority = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            return Results.Forbid();
        }

        var userId = currentUser.UserId.Value;
        IQueryable<Domain.ProjectTask> query = dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(project => project.Members)
            .Include(t => t.Assignees)
            .ThenInclude(assignee => assignee.User)
            .Where(t => !t.IsDeleted);

        if (!currentUser.IsInRole("Admin"))
        {
            query = query.Where(t => t.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)));
        }

        if (projectId.HasValue)
        {
            query = query.Where(t => t.ProjectId == projectId.Value);
        }

        var request = new DataTableRequest
        {
            Search = search,
            DropdownFilters = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                [nameof(Domain.ProjectTask.ProjectId)] = projectId?.ToString(),
                [nameof(Domain.ProjectTask.Priority)] = priority,
            }
        };

        var configuration = new DataTableQueryConfiguration { MaxPageSize = 500 };
        configuration.SearchableColumns.Add(nameof(Domain.ProjectTask.Title));
        configuration.SearchableColumns.Add(nameof(Domain.ProjectTask.Description));
        configuration.FilterableColumns.Add(nameof(Domain.ProjectTask.ProjectId));
        configuration.FilterableColumns.Add(nameof(Domain.ProjectTask.Priority));

        query = query
            .ApplySearch(dbContext, request, configuration)
            .ApplyDropdownFilters(dbContext, request, configuration);

        var tasks = await query
            .OrderByDescending(t => t.Priority)
            .ThenBy(t => t.DueDate ?? DateOnly.MaxValue)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var cards = tasks.Select(task =>
        {
            var isAdmin = currentUser.IsInRole("Admin");
            var isManagingProject = task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

            var canEdit = isAdmin || isManagingProject;
            var canDelete = isAdmin || (currentUser.IsInRole("Project Manager") && isManagingProject);
            var assignees = task.Assignees
                .Select(a =>
                {
                    var fullName = $"{a.User.FirstName} {a.User.LastName}".Trim();
                    return string.IsNullOrWhiteSpace(fullName) ? a.User.Email : fullName;
                })
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new TaskBoardCard(
                task.Id,
                task.ProjectId,
                task.Project.Name,
                task.Title,
                task.Description,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.DueDate?.ToString("yyyy-MM-dd"),
                assignees,
                canEdit,
                canDelete);
        }).ToList();

        var columns = Enum.GetValues<ProjectTaskStatus>()
            .Select(status =>
            {
                var statusTasks = cards
                    .Where(task => task.Status.Equals(status.ToString(), StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(task => Enum.Parse<TaskPriority>(task.Priority))
                    .ThenBy(task => task.DueDate ?? "9999-12-31")
                    .ToList();

                return new TaskBoardColumn(
                    status.ToString(),
                    status switch
                    {
                        ProjectTaskStatus.Todo => "To do",
                        ProjectTaskStatus.InProgress => "In progress",
                        ProjectTaskStatus.Completed => "Completed",
                        ProjectTaskStatus.Cancelled => "Cancelled",
                        _ => status.ToString()
                    },
                    statusTasks.Count,
                    statusTasks);
            })
            .ToList();

        return Results.Ok(new TaskBoardResponse(cards.Count, columns));
    }
}

public sealed record TaskBoardCard(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    string? DueDate,
    IReadOnlyList<string> Assignees,
    bool CanEdit,
    bool CanDelete);

public sealed record TaskBoardColumn(
    string Status,
    string Title,
    int TaskCount,
    IReadOnlyList<TaskBoardCard> Tasks);

public sealed record TaskBoardResponse(
    int TotalCount,
    IReadOnlyList<TaskBoardColumn> Columns);
