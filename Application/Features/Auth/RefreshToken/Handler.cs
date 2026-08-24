using Application.Interfaces;
using MediatR;

namespace Application.Features.Auth.RefreshToken;

public sealed class Handler(IAuthService authService) : IRequestHandler<Command, Response?>
{
    public async Task<Response?> Handle(Command request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return null;
        }

        var rotated = await authService.RotateRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (rotated is null)
        {
            return null;
        }

        return new Response(rotated.AccessToken, rotated.RefreshToken);
    }
}
