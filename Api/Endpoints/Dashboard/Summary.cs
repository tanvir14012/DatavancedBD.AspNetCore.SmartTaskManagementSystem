using Application.Features.Dashboard;
using Application.Features.Dashboard.Summary;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Dashboard;

public sealed class Summary : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dashboard")
            .WithTags("Dashboard");

        group.MapGet("/summary", GetSummary)
            .WithName("GetDashboardSummary")
            .WithSummary("Return totals, status breakdown, and urgent items")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetSummary(
        [FromQuery] int? projectId,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new Query(projectId), cancellationToken);
        return Results.Ok(result);
    }
}
