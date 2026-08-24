using Domain;

namespace Application.Interfaces;

public interface IAuthService
{
    Task<TokenPair> CreateTokenPairAsync(AppUser user, CancellationToken cancellationToken = default);
    Task<TokenPair?> RotateRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
}

public sealed record TokenPair(string AccessToken, string RefreshToken);
