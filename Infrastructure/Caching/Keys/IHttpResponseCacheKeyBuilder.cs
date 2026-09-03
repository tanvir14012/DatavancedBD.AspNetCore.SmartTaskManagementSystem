namespace Infrastructure.Caching.Keys;

public interface IHttpResponseCacheKeyBuilder
{
    string BuildCacheKey(
        string route,
        string? userId,
        string? queryPart = null,
        string? headerPart = null);
}
