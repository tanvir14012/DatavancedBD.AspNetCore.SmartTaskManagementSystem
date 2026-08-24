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

        try
        {
            var improvedDescription = await aiService.ImproveDescriptionAsync(request.Text, cancellationToken);

            if (!string.IsNullOrWhiteSpace(improvedDescription))
            {
                return Results.Ok(new
                {
                    original = request.Text,
                    improved = improvedDescription,
                    summary = "Using GitHub Models AI to enhance clarity and actionability of task descriptions."
                });
            }
        }
        catch
        {
            // Fall through to fallback implementation
        }

        // Fallback: Use local text processing
        var fallbackImproved = GenerateFallbackImprovement(request.Text);

        return Results.Ok(new
        {
            original = request.Text,
            improved = fallbackImproved,
            summary = "Using an internal grammar and clarity pass to make the task actionable and easier to execute."
        });
    }

    private static string GenerateFallbackImprovement(string text)
    {
        var steps = text
            .Split(['\r', '\n', '.', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part.Trim())
            .Select(part => char.ToUpperInvariant(part[0]) + part[1..])
            .ToArray();

        return steps.Length switch
        {
            0 => "Task description is empty.",
            1 => $"Task: {steps[0]}",
            _ => "- " + string.Join(Environment.NewLine + "- ", steps)
        };
    }
}

public sealed record ImproveDescriptionRequest(string Text);
