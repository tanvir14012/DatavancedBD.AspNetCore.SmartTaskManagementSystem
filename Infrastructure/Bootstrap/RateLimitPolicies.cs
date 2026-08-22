namespace Infrastructure.Bootstrap;

/// <summary>
/// Well-known rate-limit policy names registered by <see cref="BootstrapExtensions"/>.
/// Use with <c>endpoint.RequireRateLimiting(RateLimitPolicies.Upload)</c> or
/// <c>[EnableRateLimiting(RateLimitPolicies.Strict)]</c> on individual endpoints.
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Global sliding-window policy applied automatically to all requests via
    /// <c>RateLimiterOptions.GlobalLimiter</c> — no annotation required.
    /// </summary>
    public const string Global = "global";

    /// <summary>
    /// Fixed-window policy for CDN file upload endpoints (default: 10 req/min per IP).
    /// Maps directly to the Angular <c>rateLimitInterceptor</c> retry path for upload routes.
    /// </summary>
    public const string Upload = "upload";

    /// <summary>
    /// Fixed-window policy for auth-sensitive or write-heavy endpoints (default: 30 req/min per IP).
    /// </summary>
    public const string Strict = "strict";
}
