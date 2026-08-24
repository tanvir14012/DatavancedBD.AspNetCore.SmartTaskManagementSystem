using Api.Options;
using Application.Interfaces;
using Domain;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Identity;
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
        [FromBody] LoginRequest request,
        HttpContext httpContext,
        UserManager<AppUser> userManager,
        IAuthService authService,
        IOptions<AuthenticationOptions> authOptions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = ["Email and password are required."]
            });
        }

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Results.Unauthorized();
        }

        var tokens = await authService.CreateTokenPairAsync(user, cancellationToken);
        var roles = await userManager.GetRolesAsync(user);

        SetRefreshTokenCookie(httpContext, tokens.RefreshToken, authOptions.Value);

        return Results.Ok(new
        {
            user = new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                roles
            },
            accessToken = tokens.AccessToken,
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

public sealed record LoginRequest(string Email, string Password);
