using FluentValidation;

namespace Application.Features.Dashboard.Summary;

/// <summary>Validates inputs for the dashboard summary use case.</summary>
public sealed class Validator : AbstractValidator<Query>
{
    /// <summary>Creates the dashboard summary validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.ProjectId)
            .Must(projectId => !projectId.HasValue || projectId.Value > 0)
            .WithMessage("Project ID must be valid when provided.");
    }
}
