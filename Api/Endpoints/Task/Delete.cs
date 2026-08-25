using Application.Interfaces;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Delete : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapDelete("/{id:int}", DeleteTask)
            .WithName("DeleteTask")
            .WithSummary("Delete a task when the current user has administrative or project-manager scope")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> DeleteTask(
        int id,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        ICacheService cacheService,
        IHttpResponseCacheInvalidator httpCacheInvalidator,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var task = await dbContext.ProjectTasks
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .SingleOrDefaultAsync(t => t.Id == id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            return Results.NotFound();
        }

        var userId = currentUser.UserId.Value;
        var canDelete = currentUser.IsInRole("Admin") ||
            currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canDelete)
        {
            return Results.Forbid();
        }

        task.IsDeleted = true;
        task.UpdatedAt = DateTime.UtcNow;
        task.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
        await cacheService.RemoveByPatternAsync($"tasks:task:{id}:*", cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync("api/tasks", cancellationToken);

        return Results.Ok(new { success = true, id = task.Id });
    }
}
