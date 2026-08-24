using FluentValidation;

namespace Application.Features.Project.Create;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);

        RuleFor(x => x.Description).MaximumLength(1000);

        RuleFor(x => x).Must(x => !x.StartDate.HasValue || !x.EndDate.HasValue || x.StartDate <= x.EndDate)
            .WithMessage("End date must be greater than or equal to start date.");
    }
}
