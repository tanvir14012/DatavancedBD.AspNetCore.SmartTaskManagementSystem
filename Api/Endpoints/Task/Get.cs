using Application.Features.Task.Get;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Get : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/{id:int}", GetTask)
            .WithName("GetTask")
            .WithSummary("Get a single task if the current user can access it")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetTask(
        int id,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var result = await sender.Send(new Query(id), cancellationToken);
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
        catch (KeyNotFoundException)
        {
            return Results.NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Forbid();
        }
    }
}
