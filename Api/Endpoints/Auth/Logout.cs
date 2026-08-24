using Api.Options;
using Application.Features.Auth.Logout;
using Infrastructure.Bootstrap;
using MediatR;
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
        IOptions<AuthenticationOptions> authOptions,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var refreshToken = httpContext.Request.Cookies[authOptions.Value.RefreshTokenCookieName];
        var result = await sender.Send(new Command(refreshToken), cancellationToken);

        httpContext.Response.Cookies.Delete(authOptions.Value.RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/"
        });

        return result.Succeeded
            ? Results.Ok(new { message = "Logged out successfully." })
            : Results.Ok(new { message = "Logged out successfully." });
    }
}
