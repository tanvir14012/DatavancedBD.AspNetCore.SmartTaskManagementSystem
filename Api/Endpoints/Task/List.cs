using Application.Features.Task.List;
using Application.Interfaces;
using FluentValidation;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapGet("/", GetTasks)
            .WithName("GetTasks")
            .WithSummary("List tasks scoped to the current user role and filters")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetTasks(
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] int? projectId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var result = await sender.Send(new Query(start, length, projectId, status, priority, assigneeId, search, sortColumn, sortDirection), cancellationToken);
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
