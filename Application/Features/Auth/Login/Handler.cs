using Application.Interfaces;
using Domain;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace Application.Features.Auth.Login;

public sealed class Handler(
    UserManager<AppUser> userManager,
    IAuthService authService)
    : IRequestHandler<Command, Response?>
{
    public async Task<Response?> Handle(Command request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return null;
        }

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return null;
        }

        var tokens = await authService.CreateTokenPairAsync(user, cancellationToken);
        var roles = await userManager.GetRolesAsync(user);

        return new Response(
            new UserSummary(
                user.Id,
                user.Email ?? string.Empty,
                user.FirstName,
                user.LastName,
                roles.ToArray()),
            tokens.AccessToken,
            tokens.RefreshToken);
    }
}
