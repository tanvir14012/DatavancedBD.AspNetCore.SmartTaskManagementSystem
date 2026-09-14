using System.Collections.Frozen;

namespace Application.Tenancy.Resolution;

/// <summary>An immutable deployment snapshot of authorities that require an explicit tenant selector.</summary>
/// <remarks>
/// Supply these authorities through external deployment configuration. This list contains shared API
/// endpoints, not tenant inventory. An omitted port and an explicit port are different authorities.
/// </remarks>
public sealed class TenantResolutionOptions
{
    /// <summary>Validates and snapshots configured shared authorities without network I/O.</summary>
    public TenantResolutionOptions(IEnumerable<string> sharedApiAuthorities)
    {
        ArgumentNullException.ThrowIfNull(sharedApiAuthorities);
        var normalized = new List<string>();
        foreach (var authority in sharedApiAuthorities)
        {
            if (!TenantAuthority.TryNormalize(authority, out var canonicalAuthority))
                throw new ArgumentException("Shared API authority configuration contains an invalid DNS authority.", nameof(sharedApiAuthorities));
            normalized.Add(canonicalAuthority);
        }

        SharedApiAuthorities = normalized.ToFrozenSet(StringComparer.Ordinal);
    }

    /// <summary>Exact canonical authority matches; the backing set cannot be mutated.</summary>
    public IReadOnlySet<string> SharedApiAuthorities { get; }
}
