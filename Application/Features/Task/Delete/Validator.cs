using FluentValidation;

namespace Application.Features.Task.Delete;

/// <summary>Validates inputs for the task delete use case.</summary>
public sealed class Validator : AbstractValidator<Command>
{
    /// <summary>Creates the task delete validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");
    }
}
