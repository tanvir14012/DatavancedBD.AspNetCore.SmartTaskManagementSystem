namespace Infrastructure.Caching.Keys;

public interface ICacheKeyGenerator
{
    string Build(params string?[] segments);
}
