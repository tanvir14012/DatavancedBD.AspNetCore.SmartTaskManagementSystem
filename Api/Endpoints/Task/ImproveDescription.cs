using Api.Services;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class ImproveDescription : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks")
            .WithTags("Tasks");

        group.MapPost("/improve-description", Improve)
            .WithName("ImproveTaskDescription")
            .WithSummary("Improve task description using AI")
            .RequireAuthorization();
    }

    private static async Task<IResult> Improve(
        [FromBody] ImproveDescriptionRequest request,
        IAiService aiService,
        CancellationToken cancellationToken)
    {
        if (!aiService.IsEnabled)
        {
            return Results.BadRequest(new { error = "AI service is not enabled" });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return Results.BadRequest(new { error = "Description cannot be empty" });
        }

        var improvedDescription = await aiService.ImproveDescriptionAsync(request.Description, cancellationToken);

        if (improvedDescription is null)
        {
            return Results.StatusCode(StatusCodes.Status500InternalServerError);
        }

        return Results.Ok(new { improvedDescription });
    }
}

public sealed record ImproveDescriptionRequest(string Description);
