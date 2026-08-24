using Application.Interfaces;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;

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
        [FromBody] RefreshRequest request,
        IAuthService authService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["refreshToken"] = ["Refresh token is required."]
            });
        }

        var rotated = await authService.RotateRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (rotated is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(new
        {
            accessToken = rotated.AccessToken,
            refreshToken = rotated.RefreshToken
        });
    }
}

public sealed record RefreshRequest(string RefreshToken);
