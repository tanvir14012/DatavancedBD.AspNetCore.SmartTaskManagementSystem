using Application.Features.Project.Create;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

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
            .AllowAnonymous();
            //.RequireAuthorization();
    }

    private static async Task<IResult> CreateProject(
        Command command,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);

        return Results.Created($"/api/projects/{result.Id}", result);
    }
}
