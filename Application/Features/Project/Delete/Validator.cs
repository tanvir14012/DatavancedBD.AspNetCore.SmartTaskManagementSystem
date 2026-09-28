using FluentValidation;

namespace Application.Features.Project.Delete;

/// <summary>Validates inputs for the project delete use case.</summary>
public sealed class Validator : AbstractValidator<Command>
{
    /// <summary>Creates the project delete validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Project ID must be valid.");
    }
}
