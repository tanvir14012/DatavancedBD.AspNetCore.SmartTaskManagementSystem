using FluentValidation;

namespace Application.Features.Task.Assign;

/// <summary>Unassign validator contract for task assign.</summary>
public sealed class UnassignValidator : AbstractValidator<UnassignCommand>
{
    /// <summary>Creates the task assign unassign validator with its required dependencies.</summary>
    public UnassignValidator()
    {
        RuleFor(x => x.TaskId)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");

        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required.");
    }
}
