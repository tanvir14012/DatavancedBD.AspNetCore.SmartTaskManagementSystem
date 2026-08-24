namespace Application.Features.Auth.Register;

public sealed record Response(
    UserSummary User,
    string AccessToken,
    string RefreshToken);

public sealed record UserSummary(
    int Id,
    string Email,
    string FirstName,
    string LastName,
    string Role);
