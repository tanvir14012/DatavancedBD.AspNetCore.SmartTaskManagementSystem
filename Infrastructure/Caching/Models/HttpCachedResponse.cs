namespace Usm.Shared.Http.ResponseCaching.Models;

public sealed class HttpCachedResponse
{
    public int StatusCode { get; init; }
    public string? ContentType { get; init; }
    public Dictionary<string, string[]> Headers { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public byte[] Body { get; init; } = [];
}
