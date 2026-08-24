using Application.Features.Project.Get;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Project;

public sealed class Get : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapGet("/{id:int}", GetProject)
            .WithName("GetProject")
            .WithSummary("Get project by id")
            .WithDescription("Gets a project by id. Uses cache first, then database.")
            .Produces<Response>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .AllowAnonymous();
             //.RequireAuthorization();
    }

    private static async Task<IResult> GetProject(
        int id,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new Query(id), cancellationToken);

        return Results.Ok(result);
    }
}
