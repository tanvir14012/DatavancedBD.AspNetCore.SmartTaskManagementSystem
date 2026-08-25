using Application.Features.Task.Board;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Board : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/board", GetBoard)
            .WithName("GetTaskBoard")
            .WithSummary("Get a kanban board for admin and project-manager task visibility")
            .Produces<Response>(StatusCodes.Status200OK)
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> GetBoard(
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        [FromQuery] int? projectId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? priority = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            return Results.Forbid();
        }

        try
        {
            var result = await sender.Send(new Query(projectId, search, priority), cancellationToken);
            return Results.Ok(result);
        }
        catch (ValidationException ex)
        {
            return Results.ValidationProblem(ex.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(
                    group => string.IsNullOrWhiteSpace(group.Key) ? "request" : group.Key,
                    group => group.Select(error => error.ErrorMessage).ToArray()));
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Forbid();
        }
    }
}
