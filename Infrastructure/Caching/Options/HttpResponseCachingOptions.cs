namespace Infrastructure.Caching.Options;

public sealed class HttpResponseCachingOptions
{
    public const string SectionName = "Caching:HttpResponse";

    public string KeyNamespace { get; set; } = "http";
    public int DefaultDurationSeconds { get; set; } = 60;
    public bool CacheAuthenticatedUser { get; set; }
    public bool IncludeQueryString { get; set; } = true;
    public string[] VaryByHeaders { get; set; } = [];
}
