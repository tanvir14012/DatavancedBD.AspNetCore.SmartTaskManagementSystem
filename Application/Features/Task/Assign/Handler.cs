using Application.Interfaces;
using Domain;
using Domain.Enums;
using FluentValidation;
using FluentValidation.Results;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Assign;

public sealed class Handler(
    IAppDbContext dbContext,
    UserManager<AppUser> userManager,
    ICurrentUser currentUser,
    ICacheService cacheService)
    : IRequestHandler<Command, Response>
{
    public async Task<Response> Handle(Command request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        var task = await dbContext.ProjectTasks
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .SingleOrDefaultAsync(t => t.Id == request.TaskId && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            throw new KeyNotFoundException($"Task {request.TaskId} not found.");
        }

        var userId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == userId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            throw new UnauthorizedAccessException("User does not have permission to assign this task.");
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
            throw new ValidationException(new[] { new ValidationFailure(nameof(request.UserId), "User not found.") });
        }

        if (!task.Project.Members.Any(m => m.UserId == targetUser.Id))
        {
            throw new ValidationException(new[] { new ValidationFailure(nameof(request.UserId), "The user must be a member of the task's project.") });
        }

        var existingAssignment = task.Assignees.FirstOrDefault(a => a.UserId == targetUser.Id);
        if (existingAssignment is not null)
        {
            throw new ValidationException(new[] { new ValidationFailure(nameof(request.UserId), "This user is already assigned to this task.") });
        }

        var assignmentActor = await dbContext.Users
            .SingleOrDefaultAsync(u => u.Id == userId, cancellationToken);

        dbContext.UserTasks.Add(new UserTask
        {
            UserId = targetUser.Id,
            TaskId = request.TaskId,
            AssignedById = userId,
            AssignedBy = assignmentActor ?? new AppUser { Id = userId },
            IsPrimary = !task.Assignees.Any()
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
        await cacheService.RemoveByPatternAsync($"tasks:task:{request.TaskId}:*", cancellationToken);

        return new Response("User assigned to task successfully.", targetUser.Id, request.TaskId);
    }
}

public sealed class UnassignHandler(
    IAppDbContext dbContext,
    ICurrentUser currentUser,
    ICacheService cacheService)
    : IRequestHandler<UnassignCommand, Response>
{
    public async Task<Response> Handle(UnassignCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        var task = await dbContext.ProjectTasks
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .SingleOrDefaultAsync(t => t.Id == request.TaskId && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            throw new KeyNotFoundException($"Task {request.TaskId} not found.");
        }

        var currentUserId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == currentUserId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            throw new UnauthorizedAccessException("User does not have permission to unassign this task.");
        }

        var assignment = task.Assignees.FirstOrDefault(a => a.UserId == int.Parse(request.UserId));
        if (assignment is null)
        {
            throw new KeyNotFoundException("This user is not assigned to this task.");
        }

        dbContext.UserTasks.Remove(assignment);

        if (assignment.IsPrimary && task.Assignees.Count > 1)
        {
            var nextAssignment = task.Assignees.FirstOrDefault(a => a.UserId != int.Parse(request.UserId));
            if (nextAssignment is not null)
            {
                nextAssignment.IsPrimary = true;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
        await cacheService.RemoveByPatternAsync($"tasks:task:{request.TaskId}:*", cancellationToken);

        return new Response("User unassigned from task successfully.", int.Parse(request.UserId), request.TaskId);
    }
}
