using FluentValidation;

namespace Application.Features.Auth.Register;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.FirstName)
            .MaximumLength(25)
            .WithMessage("First name cannot exceed 25 characters.");

        RuleFor(x => x.LastName)
            .MaximumLength(25)
            .WithMessage("Last name cannot exceed 25 characters.");

        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("Email must be a valid email address.");

        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Password is required.")
            .MinimumLength(8)
            .WithMessage("Password must be at least 8 characters long.")
            .Must(ContainsUpperCase)
            .WithMessage("Password must contain at least one uppercase letter.")
            .Must(ContainsLowerCase)
            .WithMessage("Password must contain at least one lowercase letter.")
            .Must(ContainsDigit)
            .WithMessage("Password must contain at least one digit.")
            .Must(ContainsSpecialCharacter)
            .WithMessage("Password must contain at least one special character (!@#$%^&*).");

        RuleFor(x => x.Role)
            .MaximumLength(50)
            .WithMessage("Role cannot exceed 50 characters.");
    }

    private static bool ContainsUpperCase(string password)
    {
        return password.Any(char.IsUpper);
    }

    private static bool ContainsLowerCase(string password)
    {
        return password.Any(char.IsLower);
    }

    private static bool ContainsDigit(string password)
    {
        return password.Any(char.IsDigit);
    }

    private static bool ContainsSpecialCharacter(string password)
    {
        return password.Any(ch => "!@#$%^&*".Contains(ch));
    }
}
