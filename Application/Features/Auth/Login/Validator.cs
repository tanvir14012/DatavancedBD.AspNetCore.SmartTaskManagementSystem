using FluentValidation;

namespace Application.Features.Auth.Login;

/// <summary>Validates inputs for the auth login use case.</summary>
public sealed class Validator : AbstractValidator<Command>
{
    /// <summary>Creates the auth login validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("Email must be a valid email address.");

        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Password is required.")
            .MinimumLength(8)
            .WithMessage("Password must be at least 8 characters long.");
    }
}
