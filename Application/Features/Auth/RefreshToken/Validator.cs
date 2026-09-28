using FluentValidation;

namespace Application.Features.Auth.RefreshToken;

/// <summary>Validates inputs for the auth refreshtoken use case.</summary>
public sealed class Validator : AbstractValidator<Command>
{
    /// <summary>Creates the auth refreshtoken validator with its required dependencies.</summary>
    public Validator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .WithMessage("Refresh token is required.")
            .MinimumLength(10)
            .WithMessage("Refresh token is invalid.");
    }
}
