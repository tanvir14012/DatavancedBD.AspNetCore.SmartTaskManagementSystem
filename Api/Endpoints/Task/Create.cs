using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

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
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> CreateTask(
        [FromBody] TaskCreateRequest request,
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["title"] = ["Task title is required."]
            });
        }

        var project = await dbContext.Projects.FindAsync(new object[] { request.ProjectId }, cancellationToken);
        if (project is null)
        {
            return Results.NotFound(new { message = $"Project {request.ProjectId} not found." });
        }

        var user = await userManager.FindByEmailAsync(request.AssigneeEmail ?? string.Empty);

        var task = new Domain.ProjectTask
        {
            ProjectId = request.ProjectId,
            Project = project,
            Title = request.Title.Trim(),
            Description = request.Description,
            Status = Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var status) ? status : ProjectTaskStatus.Todo,
            Priority = Enum.TryParse<TaskPriority>(request.Priority, true, out var priority) ? priority : TaskPriority.Medium,
            DueDate = request.DueDate,
            CreatedBy = user ?? project.CreatedBy
        };

        dbContext.ProjectTasks.Add(task);

        if (user is not null)
        {
            dbContext.UserTasks.Add(new UserTask
            {
                UserId = user.Id,
                Task = task,
                AssignedById = user.Id,
                AssignedBy = user,
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
