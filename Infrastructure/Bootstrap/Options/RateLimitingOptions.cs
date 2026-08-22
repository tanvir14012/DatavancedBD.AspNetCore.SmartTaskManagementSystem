namespace Infrastructure.Bootstrap.Options;

/// <summary>
/// Top-level rate-limiting configuration bound from the "RateLimiting" appsettings section.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Set to false to disable all rate limiting (useful for integration-test hosts).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Global sliding-window limiter applied to every inbound request, keyed by client IP.
    /// Default: 200 requests per 60-second window.
    /// </summary>
    public SlidingWindowPolicyOptions Global { get; set; } = new();

    /// <summary>
    /// Named policy "upload" — applied to CDN chunked-upload endpoints via
    /// <c>.RequireRateLimiting(RateLimitPolicies.Upload)</c>.
    /// Default: 10 requests per 60-second window.
    /// </summary>
    public FixedWindowPolicyOptions Upload { get; set; } = new()
    {
        PermitLimit = 10,
        WindowSeconds = 60,
        QueueLimit = 0,
    };

    /// <summary>
    /// Named policy "strict" — for auth-sensitive or mutation-heavy endpoints.
    /// Default: 30 requests per 60-second window.
    /// </summary>
    public FixedWindowPolicyOptions Strict { get; set; } = new()
    {
        PermitLimit = 30,
        WindowSeconds = 60,
        QueueLimit = 0,
    };
}

public sealed class SlidingWindowPolicyOptions
{
    /// <summary>Maximum number of requests permitted per window.</summary>
    public int PermitLimit { get; set; } = 200;

    /// <summary>Window duration in seconds.</summary>
    public int WindowSeconds { get; set; } = 60;

    /// <summary>Number of queued requests waiting for a permit slot.</summary>
    public int QueueLimit { get; set; } = 10;
}

public sealed class FixedWindowPolicyOptions
{
    public int PermitLimit { get; set; } = 100;
    public int WindowSeconds { get; set; } = 60;
    public int QueueLimit { get; set; } = 0;
}
