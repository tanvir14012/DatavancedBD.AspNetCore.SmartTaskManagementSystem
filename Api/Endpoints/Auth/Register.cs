using Api.Options;
using Application.Features.Auth.Register;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Endpoints.Auth;

public sealed class Register : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/register", RegisterUser)
            .WithName("RegisterUser")
            .WithSummary("Register a new user")
            .ProducesValidationProblem()
            .AllowAnonymous();
    }

    private static async Task<IResult> RegisterUser(
        [FromBody] Command command,
        HttpContext httpContext,
        IOptions<AuthenticationOptions> authOptions,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        if (result is null)
        {
            return Results.Conflict(new { message = "A user with this email already exists." });
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
                role = result.User.Role
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
