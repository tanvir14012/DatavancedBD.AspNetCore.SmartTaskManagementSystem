using FluentValidation;

namespace Application.Features.Project.List;

public sealed class Validator : AbstractValidator<Query>
{
    public Validator()
    {
        RuleFor(x => x.Start)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Start index cannot be negative.");

        RuleFor(x => x.Length)
            .GreaterThan(0)
            .WithMessage("Page length must be greater than zero.");

        RuleFor(x => x.Status)
            .Must(value => string.IsNullOrWhiteSpace(value) || value.Equals("active", StringComparison.OrdinalIgnoreCase) || value.Equals("archived", StringComparison.OrdinalIgnoreCase) || value.Equals("planned", StringComparison.OrdinalIgnoreCase) || value.Equals("completed", StringComparison.OrdinalIgnoreCase) || value.Equals("all", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Invalid project status filter.");
    }
}
