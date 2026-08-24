using Application.Features.MenuItem.List;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Menu;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/menus")
            .WithTags("Menus");

        group.MapGet("/", GetMenus)
            .WithName("GetMenus")
            .WithSummary("Get top bar and sidebar navigation menus")
            .Produces<Response>(StatusCodes.Status200OK)
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetMenus(
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new Query(), cancellationToken);
        return Results.Ok(result);
    }
}
