namespace Application.Models;

/// <summary>Expiration and cache-tag options applied when storing an entry.</summary>
public sealed class CacheEntryOptions
{
    /// <summary>Absolute expiration relative to now for this application models contract.</summary>
    public TimeSpan? AbsoluteExpirationRelativeToNow { get; set; }
    /// <summary>Sliding expiration for this application models contract.</summary>
    public TimeSpan? SlidingExpiration { get; set; }
}
