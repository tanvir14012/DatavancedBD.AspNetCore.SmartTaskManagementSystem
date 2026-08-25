using Application.Interfaces;
using Domain;
using Domain.Enums;
using FluentValidation;
using FluentValidation.Results;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.Create;

public sealed class Handler(
    IAppDbContext dbContext,
    UserManager<AppUser> userManager,
    ICurrentUser currentUser)
    : IRequestHandler<Command, Response>
{
    public async Task<Response> Handle(Command request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            throw new UnauthorizedAccessException("Only admins and project managers can create tasks.");
        }

        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.ProjectId} not found.");
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var canManageProject = isAdmin || project.Members.Any(m =>
            m.UserId == currentUser.UserId.Value &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canManageProject)
        {
            throw new UnauthorizedAccessException("User does not have permission to manage this project.");
        }

        AppUser? assignee = null;
        if (!string.IsNullOrWhiteSpace(request.AssigneeEmail))
        {
            assignee = await userManager.FindByEmailAsync(request.AssigneeEmail.Trim());
            if (assignee is null)
            {
                throw new ValidationException(new[] { new ValidationFailure(nameof(request.AssigneeEmail), "User with this email does not exist.") });
            }

            if (!project.Members.Any(m => m.UserId == assignee.Id))
            {
                throw new ValidationException(new[] { new ValidationFailure(nameof(request.AssigneeEmail), "The assignee must be a member of the selected project.") });
            }
        }

        var assignmentActor = await dbContext.Users
            .SingleOrDefaultAsync(u => u.Id == currentUser.UserId.Value, cancellationToken);

        var task = new Domain.ProjectTask
        {
            ProjectId = request.ProjectId,
            Project = project,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Status = Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var status) ? status : ProjectTaskStatus.Todo,
            Priority = Enum.TryParse<TaskPriority>(request.Priority, true, out var priority) ? priority : TaskPriority.Medium,
            DueDate = request.DueDate,
            CreatedById = currentUser.UserId,
            CreatedBy = assignmentActor ?? new AppUser { Id = currentUser.UserId.Value },
            UpdatedById = currentUser.UserId,
        };

        dbContext.ProjectTasks.Add(task);

        if (assignee is not null)
        {
            dbContext.UserTasks.Add(new UserTask
            {
                UserId = assignee.Id,
                Task = task,
                AssignedById = currentUser.UserId.Value,
                AssignedBy = assignmentActor ?? new AppUser { Id = currentUser.UserId.Value },
                IsPrimary = true
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new Response(
            task.Id,
            task.Title,
            task.Status.ToString(),
            task.Priority.ToString(),
            task.DueDate,
            task.ProjectId);
    }
}
