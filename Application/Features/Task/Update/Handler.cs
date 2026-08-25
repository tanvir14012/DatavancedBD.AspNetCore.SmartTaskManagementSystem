using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Update;

public sealed class Handler(IAppDbContext dbContext, ICurrentUser currentUser, ICacheService cacheService)
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
            .SingleOrDefaultAsync(t => t.Id == request.Id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            throw new KeyNotFoundException($"Task {request.Id} not found.");
        }

        var userId = currentUser.UserId.Value;
        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
            m.UserId == userId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));
        var isTaskAssignee = task.Assignees.Any(a => a.UserId == userId);

        if (!isAdmin && !isProjectManager && !isTaskAssignee)
        {
            throw new UnauthorizedAccessException("User does not have permission to update this task.");
        }

        if (request.ProjectId.HasValue && request.ProjectId.Value != task.ProjectId)
        {
            var project = await dbContext.Projects
                .Include(p => p.Members)
                .SingleOrDefaultAsync(p => p.Id == request.ProjectId.Value && !p.IsDeleted, cancellationToken);

            if (project is null)
            {
                throw new KeyNotFoundException($"Project {request.ProjectId.Value} not found.");
            }

            var canMoveTask = isAdmin || project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

            if (!canMoveTask)
            {
                throw new UnauthorizedAccessException("User does not have permission to move this task.");
            }

            task.ProjectId = project.Id;
            task.Project = project;
        }

        task.Title = request.Title.Trim();
        task.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var status))
        {
            task.Status = status;
        }

        if (!string.IsNullOrWhiteSpace(request.Priority) && Enum.TryParse<TaskPriority>(request.Priority, true, out var priority))
        {
            task.Priority = priority;
        }

        if (request.DueDate.HasValue)
        {
            task.DueDate = request.DueDate;
        }

        task.UpdatedAt = DateTime.UtcNow;
        task.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("dashboard:summary:*", cancellationToken);
        await cacheService.RemoveByPatternAsync($"tasks:task:{request.Id}:*", cancellationToken);

        return new Response(
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
            isAdmin || currentUser.IsInRole("Project Manager"));
    }
}
