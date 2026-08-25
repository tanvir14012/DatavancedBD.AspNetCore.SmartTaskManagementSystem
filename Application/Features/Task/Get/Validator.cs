using FluentValidation;

namespace Application.Features.Task.Get;

public sealed class Validator : AbstractValidator<Query>
{
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Task ID must be valid.");
    }
}
