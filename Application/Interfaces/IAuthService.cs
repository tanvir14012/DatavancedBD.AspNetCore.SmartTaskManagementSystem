using Domain;

namespace Application.Interfaces;

/// <summary>Issues, rotates, and revokes authentication credentials.</summary>
public interface IAuthService
{
    /// <summary>Issues an access token and persists a refresh credential for the supplied user.</summary>
    Task<TokenPair> CreateTokenPairAsync(AppUser user, CancellationToken cancellationToken = default);
    /// <summary>Replaces an active refresh credential and returns a new token pair.</summary>
    Task<TokenPair?> RotateRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    /// <summary>Revokes the supplied refresh credential.</summary>
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
}

/// <summary>Access and refresh credentials issued together.</summary>
public sealed record TokenPair(string AccessToken, string RefreshToken);
