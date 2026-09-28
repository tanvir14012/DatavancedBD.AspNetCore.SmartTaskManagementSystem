namespace Application.Features.Auth.RefreshToken;

/// <summary>Result returned by the auth refreshtoken use case.</summary>
public sealed record Response(
    /// <summary>The short-lived access credential.</summary>
    string AccessToken,
    /// <summary>The refresh credential; treat this value as a secret.</summary>
    string RefreshToken);
