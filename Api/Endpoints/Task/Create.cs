using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Task;

public sealed class Create : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPost("/", CreateTask)
            .WithName("CreateTask")
            .WithSummary("Create a task for a project")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> CreateTask(
        [FromBody] TaskCreateRequest request,
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
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

        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound(new { message = $"Project {request.ProjectId} not found." });
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var canManageProject = isAdmin || project.Members.Any(m =>
            m.UserId == currentUser.UserId.Value &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canManageProject)
        {
            return Results.Forbid();
        }

        AppUser? assignee = null;
        if (!string.IsNullOrWhiteSpace(request.AssigneeEmail))
        {
            assignee = await userManager.FindByEmailAsync(request.AssigneeEmail.Trim());
            if (assignee is not null && !project.Members.Any(m => m.UserId == assignee.Id))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["assigneeEmail"] = ["The assignee must be a member of the selected project."]
                });
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
            CreatedBy = assignmentActor ?? new AppUser(),
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

        return Results.Created($"/api/tasks/{task.Id}", new
        {
            task.Id,
            task.Title,
            task.Status,
            task.Priority,
            task.DueDate,
            task.ProjectId
        });
    }
}

public sealed record TaskCreateRequest(
    int ProjectId,
    string Title,
    string? Description,
    string? Status,
    string? Priority,
    DateOnly? DueDate,
    string? AssigneeEmail);
