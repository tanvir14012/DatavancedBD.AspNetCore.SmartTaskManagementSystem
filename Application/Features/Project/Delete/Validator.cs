using FluentValidation;

namespace Application.Features.Project.Delete;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Project ID must be valid.");
    }
}
