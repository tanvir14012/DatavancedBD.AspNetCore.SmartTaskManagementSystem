namespace Usm.Shared.Http.ResponseCaching.Metadata;

public sealed class CacheResponseMetadata
{
    public int? DurationSeconds { get; init; }
    public bool? VaryByAuthenticatedUser { get; init; }
    public IReadOnlyCollection<string> VaryByHeaders { get; init; } = Array.Empty<string>();
    public bool Enabled { get; init; } = true;
}
