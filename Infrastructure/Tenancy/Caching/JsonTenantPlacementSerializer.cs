using System.Text.Json;
using Application.Tenancy;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Caching;

/// <summary>Strict, uncompressed JSON format for Redis placement records.</summary>
public sealed class JsonTenantPlacementSerializer : ITenantPlacementSerializer
{
    private static readonly HashSet<string> Fields = new(StringComparer.Ordinal)
        { "formatVersion", "tenantId", "isolation", "targetId", "schema", "region", "version", "lifecycle" };
    private readonly int _maxPayloadBytes;

    /// <summary>Captures validated size limits; performs no external I/O.</summary>
    public JsonTenantPlacementSerializer(IOptions<TenantPlacementCacheOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.Value.Validate();
        _maxPayloadBytes = options.Value.MaxPayloadBytes;
    }

    /// <inheritdoc />
    public byte[] Serialize(TenantPlacement placement)
    {
        ArgumentNullException.ThrowIfNull(placement);
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteNumber("formatVersion", 1);
            writer.WriteString("tenantId", placement.TenantId);
            writer.WriteNumber("isolation", (int)placement.Isolation);
            writer.WriteString("targetId", placement.TargetId);
            writer.WriteString("schema", placement.Schema);
            writer.WriteString("region", placement.Region);
            writer.WriteNumber("version", placement.Version);
            writer.WriteNumber("lifecycle", (int)placement.Lifecycle);
            writer.WriteEndObject();
        }
        var payload = stream.ToArray();
        ValidateSize(payload);
        return payload;
    }

    /// <inheritdoc />
    public TenantPlacement Deserialize(byte[] payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        ValidateSize(payload);
        try
        {
            using var document = JsonDocument.Parse(payload, new JsonDocumentOptions { MaxDepth = 4 });
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                throw new InvalidDataException("Placement payload must be an object.");
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (!Fields.Contains(property.Name) || !seen.Add(property.Name))
                    throw new InvalidDataException("Placement payload contains duplicate or unknown fields.");
            }
            if (seen.Count != Fields.Count || root.GetProperty("formatVersion").GetInt32() != 1)
                throw new InvalidDataException("Placement payload has missing fields or an unsupported format.");

            var schema = root.GetProperty("schema");
            return new TenantPlacement(
                root.GetProperty("tenantId").GetGuid(),
                (TenantIsolation)root.GetProperty("isolation").GetInt32(),
                root.GetProperty("targetId").GetString()!,
                schema.ValueKind == JsonValueKind.Null ? null : schema.GetString(),
                root.GetProperty("region").GetString()!,
                root.GetProperty("version").GetInt64(),
                (TenantLifecycle)root.GetProperty("lifecycle").GetInt32());
        }
        catch (Exception exception) when (exception is JsonException or FormatException or InvalidOperationException or ArgumentException)
        {
            // No raw JSON or provider exception is included: malformed fields may contain secrets.
            throw new InvalidDataException("Placement payload is not valid JSON or violates placement invariants.");
        }
    }

    private void ValidateSize(byte[] payload)
    {
        if (payload.Length == 0 || payload.Length > _maxPayloadBytes)
            throw new InvalidDataException("Placement payload is empty or exceeds its size limit.");
    }
}
