using Infrastructure.Caching.Options;
using Microsoft.Extensions.Options;

namespace Infrastructure.Caching.Keys;

public sealed class HttpResponseCacheKeyBuilder(
    ICacheKeyGenerator keyGenerator,
    IOptions<HttpResponseCachingOptions> options) : IHttpResponseCacheKeyBuilder
{
    private readonly ICacheKeyGenerator _keyGenerator = keyGenerator;
    private readonly HttpResponseCachingOptions _options = options.Value;

    public string BuildCacheKey(
        string route,
        string? userId,
        string? queryPart = null,
        string? headerPart = null)
    {
        return _keyGenerator.Build(
            _options.KeyNamespace,
            route,
            userId ?? "anonymous",
            queryPart,
            headerPart);
    }
}
