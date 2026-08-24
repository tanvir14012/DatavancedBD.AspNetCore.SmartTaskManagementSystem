namespace Api.Options;

public sealed class AuthenticationOptions
{
    public const string SectionName = "Authentication";

    public int AccessTokenExpirationMinutes { get; set; } = 30;
    public int RefreshTokenExpirationDays { get; set; } = 7;
    public string RefreshTokenCookieName { get; set; } = "stms_refresh_token";
}
