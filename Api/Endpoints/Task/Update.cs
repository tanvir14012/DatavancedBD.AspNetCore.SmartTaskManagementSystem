using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Update : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPut("/{id:int}", UpdateTask)
            .WithName("UpdateTask")
            .WithSummary("Update a task when the current user has scope to edit it")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> UpdateTask(
        int id,
        [FromBody] UpdateTaskRequest request,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        ICacheService cacheService,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var task = await dbContext.ProjectTasks
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .SingleOrDefaultAsync(t => t.Id == id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            return Results.NotFound();
        }

        var userId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == userId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));
        var isTaskAssignee = task.Assignees.Any(a => a.UserId == userId);

        if (!isAdmin && !isProjectManager && !isTaskAssignee)
        {
            return Results.Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["title"] = ["Task title is required."]
            });
        }

        if (request.ProjectId.HasValue)
        {
            var project = await dbContext.Projects
                .Include(p => p.Members)
                .SingleOrDefaultAsync(p => p.Id == request.ProjectId.Value && !p.IsDeleted, cancellationToken);

            if (project is null)
            {
                return Results.NotFound(new { message = $"Project {request.ProjectId.Value} not found." });
            }

            var canMoveTask = isAdmin || project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

            if (!canMoveTask)
            {
                return Results.Forbid();
            }

            task.ProjectId = project.Id;
            task.Project = project;
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && !Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var parsedStatus))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Invalid task status value."]
            });
        }

        if (!string.IsNullOrWhiteSpace(request.Priority) && !Enum.TryParse<TaskPriority>(request.Priority, true, out var parsedPriority))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["priority"] = ["Invalid task priority value."]
            });
        }

        task.Title = request.Title.Trim();
        task.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        task.Status = !string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var resolvedStatus)
            ? resolvedStatus
            : task.Status;
        task.Priority = !string.IsNullOrWhiteSpace(request.Priority) && Enum.TryParse<TaskPriority>(request.Priority, true, out var resolvedPriority)
            ? resolvedPriority
            : task.Priority;
        task.DueDate = request.DueDate ?? task.DueDate;
        task.UpdatedAt = DateTime.UtcNow;
        task.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);

        return Results.Ok(new TaskDetail(
            task.Id,
            task.ProjectId,
            task.Project.Name,
            task.Title,
            task.Description,
            task.Status.ToString(),
            task.Priority.ToString(),
            task.DueDate,
            task.CreatedAt,
            true,
            isAdmin || currentUser.IsInRole("Project Manager")));
    }
}

public sealed record UpdateTaskRequest(
    int? ProjectId,
    string Title,
    string? Description,
    string? Status,
    string? Priority,
    DateOnly? DueDate);
