using FluentValidation;

namespace Application.Features.Task.Assign;

/// <summary>Validates inputs for the task assign use case.</summary>
public sealed class Validator : AbstractValidator<Command>
{
    /// <summary>Creates the task assign validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.TaskId)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.UserId) || !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Either UserId or Email must be provided.");

        RuleFor(x => x.UserId)
            .Must(value => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 0)
            .WithMessage("User ID cannot be empty.");

        RuleFor(x => x.Email)
            .Must(value => string.IsNullOrWhiteSpace(value) || value.Trim().Length > 0)
            .WithMessage("Email cannot be empty.");
    }
}
