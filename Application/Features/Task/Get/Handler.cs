using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Get;

public sealed class Handler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        var task = await dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .Include(t => t.Assignees)
            .ThenInclude(a => a.User)
            .SingleOrDefaultAsync(t => t.Id == request.Id && !t.IsDeleted, cancellationToken);

        if (task is null)
        {
            throw new KeyNotFoundException($"Task {request.Id} not found.");
        }

        var userId = currentUser.UserId.Value;
        var canAccess = currentUser.IsInRole("Admin")
            || currentUser.IsInRole("Project Manager") && task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner))
            || task.Assignees.Any(a => a.UserId == userId);

        if (!canAccess)
        {
            throw new UnauthorizedAccessException("User does not have access to this task.");
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
            canEdit,
            canDelete);
    }
}
