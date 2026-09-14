namespace Application.Tenancy;

public enum TenantIsolation { Database, Schema, Row }

// TODO(SAAS-01): Validate identifiers, lifecycle, region, and placement version at the catalog boundary.
// TenantId identifies an organization, never a department or physical database.
public sealed record TenantPlacement(
    Guid TenantId, TenantIsolation Isolation, string TargetId,
    string? Schema, string Region, long Version);

public sealed record TenantRequest(string? Host, string? TenantSelector);
public sealed record TenantAccess(Guid TenantId, string SubjectId);
public sealed record TenantContext(TenantPlacement Placement, string SubjectId);

public interface ITenantCatalog
{
    Task<TenantPlacement?> FindAsync(Guid tenantId, CancellationToken cancellationToken);
}

public interface ITenantPlacementCache
{
    Task<TenantPlacement?> GetAsync(Guid tenantId, CancellationToken cancellationToken);
    Task SetAsync(TenantPlacement placement, CancellationToken cancellationToken);
    Task InvalidateAsync(Guid tenantId, CancellationToken cancellationToken);
}

public interface ITenantResolver
{
    Task<Guid> ResolveAsync(TenantRequest request, CancellationToken cancellationToken);
}

public interface ITenantAccessValidator
{
    Task ValidateAsync(TenantAccess access, CancellationToken cancellationToken);
}

// TODO(SAAS-02): Supply exactly one immutable context per authorized request/job scope.
public interface ITenantContextAccessor
{
    TenantContext Current { get; }
}
