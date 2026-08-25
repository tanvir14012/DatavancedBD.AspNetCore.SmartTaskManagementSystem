using FluentValidation;
using System.Text.RegularExpressions;

namespace Application.Features.Project.Update;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Project ID must be valid.");

        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Project name is required.")
            .MaximumLength(200)
            .WithMessage("Project name cannot exceed 200 characters.")
            .Must(name => Regex.IsMatch(name, "^[a-zA-Z0-9\\s\\-_.&()]+$"))
            .WithMessage("Project name contains invalid characters. Only alphanumeric, spaces, and -_.&() are allowed.");

        RuleFor(x => x.Description)
            .MaximumLength(1000)
            .WithMessage("Project description cannot exceed 1000 characters.");

        RuleFor(x => x.StartDate)
            .Must(date => !date.HasValue || date.Value >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .WithMessage("Start date cannot be in the past.");

        RuleFor(x => x.EndDate)
            .Must(date => !date.HasValue || date.Value >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .WithMessage("End date cannot be in the past.");

        RuleFor(x => x)
            .Must(x => !x.StartDate.HasValue || !x.EndDate.HasValue || x.StartDate <= x.EndDate)
            .WithMessage("End date must be greater than or equal to start date.");
    }
}
