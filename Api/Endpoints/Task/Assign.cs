using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Assign : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPost("/{id:int}/assign", AssignTaskUser)
            .WithName("AssignTaskUser")
            .WithSummary("Assign a user to an existing task")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));

        group.MapDelete("/{id:int}/assign/{userId}", UnassignTaskUser)
            .WithName("UnassignTaskUser")
            .WithSummary("Remove a user from a task assignment")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> AssignTaskUser(
        int id,
        [FromBody] AssignTaskRequest request,
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        ICurrentUser currentUser,
        ICacheService cacheService,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.UserId) && string.IsNullOrWhiteSpace(request.Email))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["user"] = ["Either UserId or Email must be provided."]
            });
        }

        var task = await dbContext.ProjectTasks
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .SingleOrDefaultAsync(t => t.Id == id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            return Results.NotFound(new { message = $"Task {id} not found." });
        }

        var userId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == userId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            return Results.Forbid();
        }

        AppUser? targetUser = null;

        if (!string.IsNullOrWhiteSpace(request.UserId))
        {
            targetUser = await userManager.FindByIdAsync(request.UserId.Trim());
        }
        else if (!string.IsNullOrWhiteSpace(request.Email))
        {
            targetUser = await userManager.FindByEmailAsync(request.Email.Trim());
        }

        if (targetUser is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["user"] = ["User not found."]
            });
        }

        if (!task.Project.Members.Any(m => m.UserId == targetUser.Id))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["user"] = ["The user must be a member of the task's project."]
            });
        }

        var existingAssignment = task.Assignees.FirstOrDefault(a => a.UserId == targetUser.Id);
        if (existingAssignment is not null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["user"] = ["This user is already assigned to this task."]
            });
        }

        var assignmentActor = await dbContext.Users
            .SingleOrDefaultAsync(u => u.Id == userId, cancellationToken);

        dbContext.UserTasks.Add(new UserTask
        {
            UserId = targetUser.Id,
            TaskId = id,
            AssignedById = userId,
            AssignedBy = assignmentActor ?? new AppUser(),
            IsPrimary = !task.Assignees.Any()
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);

        return Results.Ok(new
        {
            message = "User assigned to task successfully.",
            userId = targetUser.Id,
            taskId = id
        });
    }

    private static async Task<IResult> UnassignTaskUser(
        int id,
        string userId,
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
            return Results.NotFound(new { message = $"Task {id} not found." });
        }

        var currentUserId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == currentUserId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            return Results.Forbid();
        }

        var assignment = task.Assignees.FirstOrDefault(a => a.UserId == int.Parse(userId));
        if (assignment is null)
        {
            return Results.NotFound(new { message = "This user is not assigned to this task." });
        }

        dbContext.UserTasks.Remove(assignment);

        if (assignment.IsPrimary && task.Assignees.Count > 1)
        {
            var nextAssignment = task.Assignees.FirstOrDefault(a => a.UserId != int.Parse(userId));
            if (nextAssignment is not null)
            {
                nextAssignment.IsPrimary = true;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);

        return Results.Ok(new
        {
            message = "User unassigned from task successfully.",
            userId,
            taskId = id
        });
    }
}

public sealed record AssignTaskRequest(
    string? UserId = null,
    string? Email = null);
