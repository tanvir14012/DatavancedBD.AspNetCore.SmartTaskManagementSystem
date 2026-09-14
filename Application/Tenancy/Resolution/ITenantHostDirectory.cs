namespace Application.Tenancy.Resolution;

/// <summary>Resolves approved organization authorities from an external, durable directory.</summary>
/// <remarks>
/// Authorities are canonical ASCII DNS names with an optional explicit port. Matching is exact;
/// null means no approved mapping, never a dependency failure. Implementations must bound their I/O,
/// honor cancellation, and return a nonempty organization identity for a known authority.
/// A host mapping identifies a candidate organization and does not authorize a caller.
/// </remarks>
public interface ITenantHostDirectory
{
    /// <summary>Finds the organization assigned to this exact canonical authority.</summary>
    Task<Guid?> FindTenantAsync(string canonicalAuthority, CancellationToken cancellationToken);
}
