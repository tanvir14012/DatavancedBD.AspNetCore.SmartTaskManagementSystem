using Infrastructure.Bootstrap.Options;
using Application.Features.Auth.RefreshToken;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Endpoints.Auth;

public sealed class Refresh : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/refresh", RefreshTokens)
            .WithName("RefreshTokens")
            .WithSummary("Rotate the refresh token and issue a new JWT pair")
            .AllowAnonymous();
    }

    private static async Task<IResult> RefreshTokens(
        HttpContext httpContext,
        IOptions<AuthenticationOptions> authOptions,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var refreshToken = httpContext.Request.Cookies[authOptions.Value.RefreshTokenCookieName];
        var result = await sender.Send(new Command(refreshToken), cancellationToken);
        if (result is null)
        {
            return Results.Unauthorized();
        }

        SetRefreshTokenCookie(httpContext, result.RefreshToken, authOptions.Value);

        return Results.Ok(new
        {
            accessToken = result.AccessToken,
            expiresIn = authOptions.Value.AccessTokenExpirationMinutes * 60
        });
    }

    private static void SetRefreshTokenCookie(HttpContext context, string refreshToken, AuthenticationOptions options)
    {
        context.Response.Cookies.Append(options.RefreshTokenCookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddDays(options.RefreshTokenExpirationDays),
            IsEssential = true,
            Path = "/"
        });
    }
}
