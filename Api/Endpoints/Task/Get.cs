using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Get : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/{id:int}", GetTask)
            .WithName("GetTask")
            .WithSummary("Get a single task if the current user can access it")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetTask(
        int id,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var task = await dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .ThenInclude(a => a.User)
            .SingleOrDefaultAsync(t => t.Id == id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            return Results.NotFound();
        }

        var userId = currentUser.UserId.Value;
        var canAccess = currentUser.IsInRole("Admin")
            || currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner))
            || task.Assignees.Any(a => a.UserId == userId);

        if (!canAccess)
        {
            return Results.Forbid();
        }

        var canEdit = currentUser.IsInRole("Admin")
            || currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner))
            || task.Assignees.Any(a => a.UserId == userId);

        var canDelete = currentUser.IsInRole("Admin")
            || currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

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
            canEdit,
            canDelete));
    }
}

public sealed record TaskDetail(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    DateOnly? DueDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete);
