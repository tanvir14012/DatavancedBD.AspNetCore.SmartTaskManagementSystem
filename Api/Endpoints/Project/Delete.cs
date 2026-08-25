using Application.Features.Project.Delete;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Project;

public sealed class Delete : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapDelete("/{id:int}", DeleteProject)
            .WithName("DeleteProject")
            .WithSummary("Soft delete a project")
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> DeleteProject(
        int id,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        await sender.Send(new Command(id), cancellationToken);
        return Results.NoContent();
    }
}
