using Application.Features.Task.Assign;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Assign : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPost("/{id:int}/assign", AssignTaskUser)
            .WithName("AssignTaskUser")
            .WithSummary("Assign a user to an existing task")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));

        group.MapDelete("/{id:int}/assign/{userId}", UnassignTaskUser)
            .WithName("UnassignTaskUser")
            .WithSummary("Remove a user from a task assignment")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> AssignTaskUser(
        int id,
        [FromBody] AssignTaskRequest request,
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
            var command = new Command(id, request.UserId, request.Email);
            var result = await sender.Send(command, cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
            await cacheService.RemoveByPatternAsync($"tasks:task:{id}:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("api/tasks", cancellationToken);
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

    private static async Task<IResult> UnassignTaskUser(
        int id,
        string userId,
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
            var result = await sender.Send(new UnassignCommand(id, userId), cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
            await cacheService.RemoveByPatternAsync($"tasks:task:{id}:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("api/tasks", cancellationToken);
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

public sealed record AssignTaskRequest(
    string? UserId = null,
    string? Email = null);
