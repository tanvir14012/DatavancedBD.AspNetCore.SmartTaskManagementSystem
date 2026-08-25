using FluentValidation;

namespace Application.Features.Auth.RefreshToken;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .WithMessage("Refresh token is required.")
            .MinimumLength(10)
            .WithMessage("Refresh token is invalid.");
    }
}
