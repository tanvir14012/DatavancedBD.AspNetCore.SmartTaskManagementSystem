namespace Usm.Shared.Http.ResponseCaching.Metadata;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class CacheResponseAttribute : Attribute
{
    public CacheResponseAttribute(int durationSeconds = 60)
    {
        DurationSeconds = durationSeconds;
    }

    public int DurationSeconds { get; }
    public bool VaryByAuthenticatedUser { get; set; }
    public string[] VaryByHeaders { get; set; } = [];
    public bool Enabled { get; set; } = true;
}
