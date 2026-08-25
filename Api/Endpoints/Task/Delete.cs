using Application.Features.Task.Delete;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Delete : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapDelete("/{id:int}", DeleteTask)
            .WithName("DeleteTask")
            .WithSummary("Delete a task when the current user has administrative or project-manager scope")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> DeleteTask(
        int id,
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
            var result = await sender.Send(new Command(id), cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
            await cacheService.RemoveByPatternAsync($"tasks:task:{id}:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("api/tasks", cancellationToken);
            return Results.Ok(new { success = result.Success, id = result.Id });
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
