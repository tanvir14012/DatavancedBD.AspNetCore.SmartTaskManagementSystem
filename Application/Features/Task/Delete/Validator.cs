using FluentValidation;

namespace Application.Features.Task.Delete;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");
    }
}
