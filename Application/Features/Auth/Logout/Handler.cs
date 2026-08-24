using Application.Interfaces;
using MediatR;

namespace Application.Features.Auth.Logout;

public sealed class Handler(IAuthService authService) : IRequestHandler<Command, Response>
{
    public async Task<Response> Handle(Command request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return new Response(false);
        }

        await authService.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);
        return new Response(true);
    }
}
