using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Application.Interfaces;
using Domain;
using Infrastructure.AssemblyScan;
using Infrastructure.Bootstrap.Options;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Services;

public sealed class AuthService(
    AppDbContext dbContext,
    UserManager<AppUser> userManager,
    IConfiguration configuration,
    IOptions<AuthenticationOptions> authOptions)
    : IAuthService, IScopedService
{
    public async Task<TokenPair> CreateTokenPairAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        var accessToken = await CreateAccessTokenAsync(user, cancellationToken);
        var refreshToken = CreateRefreshToken();

        var userRefreshToken = new RefreshToken
        {
            UserId = user.Id,
            User = user,
            TokenHash = HashToken(refreshToken),
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(authOptions.Value.RefreshTokenExpirationDays)
        };

        dbContext.RefreshTokens.Add(userRefreshToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new TokenPair(accessToken, refreshToken);
    }

    public async Task<TokenPair?> RotateRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return null;
        }

        var tokenHash = HashToken(refreshToken);
        var storedToken = await dbContext.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

        if (storedToken is null || !storedToken.IsActive)
        {
            return null;
        }

        var user = storedToken.User;
        if (user is null)
        {
            return null;
        }

        storedToken.Revoke();

        var nextPair = await CreateTokenPairAsync(user, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return nextPair;
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var hash = HashToken(refreshToken);
        var storedToken = await dbContext.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash, cancellationToken);

        if (storedToken is null)
        {
            return;
        }

        storedToken.Revoke();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> CreateAccessTokenAsync(AppUser user, CancellationToken cancellationToken)
    {
        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? user.Email ?? user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString())
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var issuer = configuration["Jwt:Issuer"] ?? "https://localhost:7108";
        var audience = configuration["Jwt:Audience"] ?? "https://localhost:4200";
        var keyValue = configuration["Jwt:Key"] ?? "ThisIsADevelopmentJwtSigningKey_ReplaceInProduction!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyValue));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(authOptions.Value.AccessTokenExpirationMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string CreateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }
}
