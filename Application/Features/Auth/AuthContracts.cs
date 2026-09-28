namespace Application.Features.Auth;

/// <summary>Login request contract for auth.</summary>
public sealed record LoginRequest(string Email, string Password);
/// <summary>Register request contract for auth.</summary>
public sealed record RegisterRequest(string? FirstName, string? LastName, string Email, string Password, string? Role);
/// <summary>Token response contract for auth.</summary>
public sealed record TokenResponse(string AccessToken, string RefreshToken);
