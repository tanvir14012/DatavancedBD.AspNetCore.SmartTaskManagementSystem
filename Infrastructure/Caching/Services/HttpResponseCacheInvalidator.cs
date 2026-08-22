using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Options;
using Microsoft.Extensions.Options;

namespace Infrastructure.Caching.Services;

public sealed class HttpResponseCacheInvalidator(
    ICacheService cacheService,
    IOptions<HttpResponseCachingOptions> options) : IHttpResponseCacheInvalidator
{
    private readonly ICacheService _cacheService = cacheService;
    private readonly HttpResponseCachingOptions _options = options.Value;

    public Task InvalidateByRouteAsync(string routePrefix, CancellationToken cancellationToken = default)
    {
        var normalizedRoute = routePrefix.Trim().TrimStart('/');
        var pattern = $"{_options.KeyNamespace}:{normalizedRoute}*";
        return _cacheService.RemoveByPatternAsync(pattern, cancellationToken);
    }

    public Task InvalidateByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        return _cacheService.RemoveByPatternAsync(pattern, cancellationToken);
    }
}
