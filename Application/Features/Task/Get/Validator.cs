using FluentValidation;

namespace Application.Features.Task.Get;

/// <summary>Validates inputs for the task get use case.</summary>
public sealed class Validator : AbstractValidator<Query>
{
    /// <summary>Creates the task get validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");
    }
}
