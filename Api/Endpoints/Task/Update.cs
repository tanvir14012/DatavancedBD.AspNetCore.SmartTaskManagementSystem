using Application.Features.Task.Update;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Update : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPut("/{id:int}", UpdateTask)
            .WithName("UpdateTask")
            .WithSummary("Update a task when the current user has scope to edit it")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> UpdateTask(
        int id,
        [FromBody] Command request,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        ICacheService cacheService,
        IHttpResponseCacheInvalidator httpCacheInvalidator,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var command = request with { Id = id };
            var result = await sender.Send(command, cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("dashboard:summary:*", cancellationToken);
            await cacheService.RemoveByPatternAsync($"tasks:task:{id}:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/tasks", cancellationToken);
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
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Forbid();
        }
    }
}
