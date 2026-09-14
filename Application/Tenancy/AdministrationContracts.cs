namespace Application.Tenancy;

// TargetId is a logical reference, not a connection string. Shared targets must be deduplicated.
public sealed record MigrationTarget(string TargetId, string? Schema, TenantIsolation Isolation);
public sealed record MigrationOutcome(MigrationTarget Target, bool Succeeded, string? ErrorCode);

public interface IMigrationTargetSource
{
    IAsyncEnumerable<MigrationTarget> ReadAsync(CancellationToken cancellationToken);
}

public interface ITenantMigrationRunner
{
    Task<IReadOnlyList<MigrationOutcome>> RunAsync(CancellationToken cancellationToken);
}

public interface ITenantProvisioner
{
    Task ProvisionAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken);
}

public interface ITenantAdmissionPolicy
{
    Task<bool> CanAdmitAsync(Guid tenantId, CancellationToken cancellationToken);
}
