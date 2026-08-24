using Api.Options;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Endpoints.Auth;

public sealed class Logout : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/logout", LogoutUser)
            .WithName("LogoutUser")
            .WithSummary("Revoke a refresh token")
            .AllowAnonymous();
    }

    private static async Task<IResult> LogoutUser(
        HttpContext httpContext,
        IAuthService authService,
        IOptions<AuthenticationOptions> authOptions,
        CancellationToken cancellationToken)
    {
        var refreshToken = httpContext.Request.Cookies[authOptions.Value.RefreshTokenCookieName];
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            await authService.RevokeRefreshTokenAsync(refreshToken, cancellationToken);
        }

        httpContext.Response.Cookies.Delete(authOptions.Value.RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/"
        });

        return Results.Ok(new { message = "Logged out successfully." });
    }
}
