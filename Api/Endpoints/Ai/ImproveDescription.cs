using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Ai;

public sealed class ImproveDescription : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai")
            .WithTags("AI");

        group.MapPost("/improve-description", ImproveText)
            .WithName("ImproveTaskDescription")
            .WithSummary("Enhance raw notes into a clearer task description")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static IResult ImproveText(
        [FromBody] ImproveDescriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["text"] = ["Text is required."]
            });
        }

        var steps = request.Text
            .Split(['\r', '\n', '.', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part.Trim())
            .Select(part => char.ToUpperInvariant(part[0]) + part[1..])
            .ToArray();

        var improved = steps.Length switch
        {
            0 => "Task description is empty.",
            1 => $"Task: {steps[0]}",
            _ => "- " + string.Join(Environment.NewLine + "- ", steps)
        };

        return Results.Ok(new
        {
            original = request.Text,
            improved,
            summary = "Using an internal grammar and clarity pass to make the task actionable and easier to execute."
        });
    }
}

public sealed record ImproveDescriptionRequest(string Text);
