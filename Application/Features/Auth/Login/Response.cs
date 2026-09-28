namespace Application.Features.Auth.Login;

/// <summary>Result returned by the auth login use case.</summary>
public sealed record Response(
    UserSummary User,
    /// <summary>The short-lived access credential.</summary>
    string AccessToken,
    /// <summary>The refresh credential; treat this value as a secret.</summary>
    string RefreshToken);

/// <summary>User summary contract for auth login.</summary>
public sealed record UserSummary(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The user's email address.</summary>
    string Email,
    /// <summary>The user's given name.</summary>
    string FirstName,
    /// <summary>The user's family name.</summary>
    string LastName,
    /// <summary>The application's roles associated with the user.</summary>
    IReadOnlyList<string> Roles);
