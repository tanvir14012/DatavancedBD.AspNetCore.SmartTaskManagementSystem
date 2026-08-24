using Application.Features.Project.Create;
using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class Create : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapPost("/", CreateProject)
            .WithName("CreateProject")
            .WithSummary("Create a new project")
            .WithDescription(
                "Creates a project and assigns the current authenticated user as creator.")
            .Produces<Response>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> CreateProject(
        Command command,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            return Results.Forbid();
        }

        if (!currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var result = await sender.Send(command, cancellationToken);

        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleAsync(p => p.Id == result.Id, cancellationToken);

        if (!project.Members.Any(m => m.UserId == currentUser.UserId.Value))
        {
            project.Members.Add(new UserProject
            {
                UserId = currentUser.UserId.Value,
                ProjectId = project.Id,
                ProjectRole = ProjectRole.Owner,
                JoinedAt = DateTime.UtcNow,
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.Created($"/api/projects/{result.Id}", result);
    }
}
