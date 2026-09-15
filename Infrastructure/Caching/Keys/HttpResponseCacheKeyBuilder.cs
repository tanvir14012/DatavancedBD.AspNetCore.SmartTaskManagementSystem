using Application.Tenancy;
using Infrastructure.Caching.Options;
using Microsoft.Extensions.Options;

namespace Infrastructure.Caching.Keys;

public sealed class HttpResponseCacheKeyBuilder : IHttpResponseCacheKeyBuilder
{
    private readonly ICacheKeyGenerator _keyGenerator;
    private readonly HttpResponseCachingOptions _options;
    private readonly ITenantContextAccessor? _contextAccessor;

    public HttpResponseCacheKeyBuilder(
        ICacheKeyGenerator keyGenerator,
        IOptions<HttpResponseCachingOptions> options)
        : this(keyGenerator, options, null) { }

    public HttpResponseCacheKeyBuilder(
        ICacheKeyGenerator keyGenerator,
        IOptions<HttpResponseCachingOptions> options,
        ITenantContextAccessor? contextAccessor)
    {
        _keyGenerator = keyGenerator;
        _options = options.Value;
        _contextAccessor = contextAccessor;
    }

    public string BuildCacheKey(
        string route,
        string? userId,
        string? queryPart = null,
        string? headerPart = null)
    {
        return _keyGenerator.Build(
            _options.KeyNamespace,
            TenantScope(),
            route,
            userId ?? "anonymous",
            queryPart,
            headerPart);
    }

    private string TenantScope()
    {
        try
        {
            return _contextAccessor is null
                ? "legacy"
                : $"tenant:{_contextAccessor.Current.Placement.TenantId:D}";
        }
        catch (InvalidOperationException)
        {
            return "legacy";
        }
    }
}
