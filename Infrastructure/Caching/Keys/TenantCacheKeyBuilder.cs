using Application.Tenancy;

namespace Infrastructure.Caching.Keys;

/// <summary>Prefixes internal cache keys with the immutable organization identity.</summary>
public sealed class TenantCacheKeyBuilder(
    ITenantContextAccessor contextAccessor,
    ICacheKeyGenerator keyGenerator) : ITenantCacheKeyBuilder
{
    private readonly ITenantContextAccessor _contextAccessor = contextAccessor;
    private readonly ICacheKeyGenerator _keyGenerator = keyGenerator;

    public string Build(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return _keyGenerator.Build(Scope(), key);
    }

    public string BuildPattern(string pattern)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pattern);
        return Build(pattern);
    }

    private string Scope()
    {
        try
        {
            return $"tenant:{_contextAccessor.Current.Placement.TenantId:D}";
        }
        catch (InvalidOperationException)
        {
            // Legacy endpoints are deliberately kept on a disjoint namespace until their
            // tenant persistence cutover is complete. They can never collide with tenant keys.
            return "legacy";
        }
    }
}
