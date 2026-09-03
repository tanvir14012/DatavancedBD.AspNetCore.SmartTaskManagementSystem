using Api.Services;
using Application.Features.Project.Create;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Project;

public sealed class Create : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapPost("/", CreateProject)
            .WithName("CreateProject")
            .WithSummary("Create a new project")
            .WithDescription(
                "Creates a project and assigns the current authenticated user as creator.")
            .Produces<Response>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> CreateProject(
        Command command,
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
            await cacheService.RemoveByPatternAsync("projects:list:*", cancellationToken);
            await cacheService.RemoveByPatternAsync("dashboard:summary:*", cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/projects", currentUser.UserId?.ToString(), cancellationToken);
            await httpCacheInvalidator.InvalidateByRouteAsync("/api/dashboard/summary", currentUser.UserId?.ToString(), cancellationToken);

            return Results.Created($"/api/projects/{result.Id}", result);
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
