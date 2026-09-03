using Application.Features.Project.Delete;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
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
        ICurrentUser currentUser,
        IHttpResponseCacheInvalidator httpCacheInvalidator,
        CancellationToken cancellationToken)
    {
        try
        {
            await sender.Send(new Command(id), cancellationToken);
        }
        finally
        {
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/projects", currentUser.UserId?.ToString(), cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/dashboard/summary", currentUser.UserId?.ToString(), cancellationToken);
        }

        return Results.NoContent();
    }
}
