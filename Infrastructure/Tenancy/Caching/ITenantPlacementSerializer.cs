using Application.Tenancy;

namespace Infrastructure.Tenancy.Caching;

/// <summary>Encodes a bounded, explicitly versioned placement payload without credentials.</summary>
public interface ITenantPlacementSerializer
{
    /// <summary>Serializes one structurally valid placement.</summary>
    byte[] Serialize(TenantPlacement placement);
    /// <summary>Rejects missing fields, unsupported formats and malformed data.</summary>
    TenantPlacement Deserialize(byte[] payload);
}
