namespace Application.Features.Auth;

public sealed record LoginRequest(string Email, string Password);
public sealed record RegisterRequest(string? FirstName, string? LastName, string Email, string Password, string? Role);
public sealed record TokenResponse(string AccessToken, string RefreshToken);
