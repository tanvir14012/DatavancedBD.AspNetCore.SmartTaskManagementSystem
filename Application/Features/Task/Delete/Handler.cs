using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Delete;

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
            .SingleOrDefaultAsync(t => t.Id == request.Id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            throw new KeyNotFoundException($"Task {request.Id} not found.");
        }

        var userId = currentUser.UserId.Value;
        var canDelete = currentUser.IsInRole("Admin") ||
            currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canDelete)
        {
            throw new UnauthorizedAccessException("User does not have permission to delete this task.");
        }

        task.IsDeleted = true;
        task.UpdatedAt = DateTime.UtcNow;
        task.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
        await cacheService.RemoveByPatternAsync("dashboard:summary:*", cancellationToken);
        await cacheService.RemoveByPatternAsync($"tasks:task:{request.Id}:*", cancellationToken);

        return new Response(true, task.Id);
    }
}
