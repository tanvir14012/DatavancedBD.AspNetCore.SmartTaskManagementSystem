namespace Application.Features.Auth.Login;

public sealed record Response(
    UserSummary User,
    string AccessToken,
    string RefreshToken);

public sealed record UserSummary(
    int Id,
    string Email,
    string FirstName,
    string LastName,
    IReadOnlyList<string> Roles);
