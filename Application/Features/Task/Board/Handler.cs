using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Board;

public sealed class Handler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            throw new UnauthorizedAccessException("Only admins and project managers can view the task board.");
        }

        var userId = currentUser.UserId.Value;
        IQueryable<Domain.ProjectTask> query = dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(project => project.Members)
            .Include(t => t.Assignees)
            .ThenInclude(assignee => assignee.User)
            .Where(t => !t.IsDeleted)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            query = query.Where(t => t.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)));
        }

        if (request.ProjectId.HasValue)
        {
            query = query.Where(t => t.ProjectId == request.ProjectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(t =>
                EF.Functions.Like(t.Title, $"%{search}%") ||
                (t.Description != null && EF.Functions.Like(t.Description, $"%{search}%")));
        }

        if (!string.IsNullOrWhiteSpace(request.Priority) && Enum.TryParse<TaskPriority>(request.Priority, true, out var priority))
        {
            query = query.Where(t => t.Priority == priority);
        }

        var tasks = await query
            .OrderByDescending(t => t.Priority)
            .ThenBy(t => t.DueDate ?? DateOnly.MaxValue)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var cards = tasks.Select(task =>
        {
            var isManagingProject = task.Project.Members.Any(m =>
                m.UserId == userId &&
                (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

            var canEdit = currentUser.IsInRole("Admin") || isManagingProject;
            var canDelete = currentUser.IsInRole("Admin") || (currentUser.IsInRole("Project Manager") && isManagingProject);
            var assignees = task.Assignees
                .Select(a =>
                {
                    var fullName = $"{a.User.FirstName} {a.User.LastName}".Trim();
                    return string.IsNullOrWhiteSpace(fullName) ? a.User.Email : fullName;
                })
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new Card(
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

                return new Column(
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

        return new Response(cards.Count, columns);
    }
}
