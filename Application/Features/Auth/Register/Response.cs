namespace Application.Features.Auth.Register;

/// <summary>Result returned by the auth register use case.</summary>
public sealed record Response(
    UserSummary User,
    /// <summary>The short-lived access credential.</summary>
    string AccessToken,
    /// <summary>The refresh credential; treat this value as a secret.</summary>
    string RefreshToken);

/// <summary>User summary contract for auth register.</summary>
public sealed record UserSummary(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The user's email address.</summary>
    string Email,
    /// <summary>The user's given name.</summary>
    string FirstName,
    /// <summary>The user's family name.</summary>
    string LastName,
    /// <summary>The application role requested for the user.</summary>
    string Role);
