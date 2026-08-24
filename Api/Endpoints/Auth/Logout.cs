using Application.Interfaces;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Mvc;

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
        [FromBody] LogoutRequest request,
        IAuthService authService,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            await authService.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);
        }

        return Results.Ok(new { message = "Logged out successfully." });
    }
}

public sealed record LogoutRequest(string? RefreshToken);
