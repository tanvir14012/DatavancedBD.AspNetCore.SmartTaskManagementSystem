namespace Infrastructure.Caching.Abstractions;

public interface IHttpResponseCacheInvalidator
{
    Task InvalidateByRouteAsync(string routePrefix, string? userId, CancellationToken cancellationToken = default);
    Task InvalidateByPatternAsync(string pattern, CancellationToken cancellationToken = default);
}
