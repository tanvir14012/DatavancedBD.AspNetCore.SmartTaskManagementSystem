namespace Infrastructure.Data.EfCore.Options;

public sealed class EntityFrameworkCachingOptions
{
    public const string SectionName = "Caching:EntityFramework";
    public string KeyNamespace { get; set; } = "ef";
    public int DefaultExpirationSeconds { get; set; } = 300;
}
