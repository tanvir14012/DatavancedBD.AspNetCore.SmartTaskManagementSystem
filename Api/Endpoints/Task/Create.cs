using FluentValidation;
using Application.Features.Task.Create;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class Create : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPost("/", CreateTask)
            .WithName("CreateTask")
            .WithSummary("Create a task for a project")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> CreateTask(
        [FromBody] Command command,
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

        if (!currentUser.IsInRole("Admin") && !currentUser.IsInRole("Project Manager"))
        {
            return Results.Forbid();
        }

        try
        {
            var result = await sender.Send(command, cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("tasks:board:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/tasks", cancellationToken);

            return Results.Created($"/api/tasks/{result.Id}", result);
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
