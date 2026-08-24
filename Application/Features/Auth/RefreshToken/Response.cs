namespace Application.Features.Auth.RefreshToken;

public sealed record Response(
    string AccessToken,
    string RefreshToken);
