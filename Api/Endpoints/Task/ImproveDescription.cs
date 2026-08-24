using Api.Services;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Task;

public sealed class ImproveDescription : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai")
            .WithTags("AI");

        group.MapPost("/improve-description", Improve)
            .WithName("ImproveTaskDescription")
            .WithSummary("Enhance raw notes into a clearer task description")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> Improve(
        [FromBody] ImproveDescriptionRequest request,
        IAiService aiService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["text"] = ["Text is required."]
            });
        }

        var improvedDescription = await aiService.ImproveDescriptionAsync(request.Text, cancellationToken);

        if (improvedDescription is null)
        {
            return Results.BadRequest(new { error = "AI service is not enabled or failed to process" });
        }

        return Results.Ok(new
        {
            original = request.Text,
            improved = improvedDescription,
            summary = "Using GitHub Models AI to enhance clarity and actionability of task descriptions."
        });
    }
}

public sealed record ImproveDescriptionRequest(string Text);
