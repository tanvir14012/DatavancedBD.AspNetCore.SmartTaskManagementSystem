using Application.Interfaces;
using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Keys;

namespace Infrastructure.Caching.Services;

public sealed class HttpResponseCacheInvalidator(
    ICacheService cacheService,
    IHttpResponseCacheKeyBuilder keyBuilder) : IHttpResponseCacheInvalidator
{
    private readonly ICacheService _cacheService = cacheService;
    private readonly IHttpResponseCacheKeyBuilder _keyBuilder = keyBuilder;

    public async Task InvalidateByRouteAsync(
        string routePrefix,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var normalizedRoute = routePrefix.Trim();
        var pattern = $"{_keyBuilder.BuildCacheKey(normalizedRoute, userId)}:*";
        var dashboardPattern = $"{_keyBuilder.BuildCacheKey("/api/dashboard", userId)}:*";
        await _cacheService.RemoveByPatternAsync(dashboardPattern, cancellationToken);
        await _cacheService.RemoveByPatternAsync(pattern, cancellationToken);
    }

    public Task InvalidateByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        return _cacheService.RemoveByPatternAsync(pattern, cancellationToken);
    }
}
