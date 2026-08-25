using FluentValidation;

namespace Application.Features.Task.Assign;

public sealed class UnassignValidator : AbstractValidator<UnassignCommand>
{
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
