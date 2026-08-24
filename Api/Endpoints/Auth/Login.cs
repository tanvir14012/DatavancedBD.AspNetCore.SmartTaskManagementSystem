using Api.Options;
using Application.Features.Auth.Login;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Endpoints.Auth;

public sealed class Login : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/login", LoginUser)
            .WithName("LoginUser")
            .WithSummary("Log in using email and password")
            .ProducesValidationProblem()
            .AllowAnonymous();
    }

    private static async Task<IResult> LoginUser(
        [FromBody] Command command,
        HttpContext httpContext,
        IOptions<AuthenticationOptions> authOptions,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        if (result is null)
        {
            return Results.Unauthorized();
        }

        SetRefreshTokenCookie(httpContext, result.RefreshToken, authOptions.Value);

        return Results.Ok(new
        {
            user = new
            {
                result.User.Id,
                result.User.Email,
                result.User.FirstName,
                result.User.LastName,
                roles = result.User.Roles
            },
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
