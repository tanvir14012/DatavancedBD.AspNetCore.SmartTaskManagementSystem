namespace Application.Tenancy;

// TargetId is a logical reference, not a connection string. Shared targets must be deduplicated.
public sealed record MigrationTarget(string TargetId, string? Schema, TenantIsolation Isolation);
public sealed record MigrationOutcome(MigrationTarget Target, bool Succeeded, string? ErrorCode);

public interface IMigrationTargetSource
{
    IAsyncEnumerable<MigrationTarget> ReadAsync(CancellationToken cancellationToken);
}

/// <summary>Applies the reviewed schema upgrade for one physical target.</summary>
public interface IMigrationTargetExecutor
{
    Task ExecuteAsync(MigrationTarget target, CancellationToken cancellationToken);
}

/// <summary>Acquires the distributed lock for one target and releases it on disposal.</summary>
public interface IMigrationTargetLockProvider
{
    Task<IAsyncDisposable> AcquireAsync(MigrationTarget target, CancellationToken cancellationToken);
}

/// <summary>Durable completion ledger used to make migration retries resumable.</summary>
public interface IMigrationLedger
{
    Task<bool> IsAppliedAsync(MigrationTarget target, CancellationToken cancellationToken);
    Task RecordAppliedAsync(MigrationTarget target, CancellationToken cancellationToken);
}

public interface ITenantMigrationRunner
{
    Task<IReadOnlyList<MigrationOutcome>> RunAsync(CancellationToken cancellationToken);
}

public interface ITenantProvisioner
{
    Task ProvisionAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken);
}

/// <summary>Allocates a trusted target and returns a non-active provisioning placement.</summary>
public interface ITenantPlacementAllocator
{
    Task<TenantPlacement> AllocateAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken);
}

/// <summary>Creates schema objects/data and runs post-provisioning checks for a placement.</summary>
public interface ITenantProvisioningExecutor
{
    Task ExecuteAsync(TenantPlacement placement, CancellationToken cancellationToken);
    Task ValidateAsync(TenantPlacement placement, CancellationToken cancellationToken);
}

/// <summary>Prevents concurrent provisioning or relocation operations for one organization.</summary>
public interface ITenantProvisioningLockProvider
{
    Task<IAsyncDisposable> AcquireAsync(Guid tenantId, CancellationToken cancellationToken);
}

public interface ITenantAdmissionPolicy
{
    Task<bool> CanAdmitAsync(Guid tenantId, CancellationToken cancellationToken);
}

/// <summary>Describes one idempotent tenant-scoped background job.</summary>
public sealed record TenantWorkItem
{
    public TenantWorkItem(
        string jobId,
        Guid tenantId,
        TenantIsolation isolation,
        string targetId,
        long placementVersion,
        TenantAccess access)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobId);
        if (tenantId == Guid.Empty || access.TenantId != tenantId)
            throw new ArgumentException("Job organization identity is invalid.", nameof(tenantId));
        if (!Enum.IsDefined(isolation))
            throw new ArgumentOutOfRangeException(nameof(isolation));
        ArgumentException.ThrowIfNullOrWhiteSpace(targetId);
        if (placementVersion <= 0)
            throw new ArgumentOutOfRangeException(nameof(placementVersion));
        JobId = jobId;
        TenantId = tenantId;
        Isolation = isolation;
        TargetId = targetId;
        PlacementVersion = placementVersion;
        Access = access;
    }

    public string JobId { get; }
    public Guid TenantId { get; }
    public TenantIsolation Isolation { get; }
    public string TargetId { get; }
    public long PlacementVersion { get; }
    public TenantAccess Access { get; }
}

public interface ITenantJobQueue
{
    IAsyncEnumerable<TenantWorkItem> ReadAsync(CancellationToken cancellationToken);
    Task CompleteAsync(TenantWorkItem item, CancellationToken cancellationToken);
    Task AbandonAsync(TenantWorkItem item, bool retryable, CancellationToken cancellationToken);
}

public interface ITenantJobDeduplicator
{
    Task<bool> TryBeginAsync(string jobId, CancellationToken cancellationToken);
    Task CompleteAsync(string jobId, CancellationToken cancellationToken);
    Task AbandonAsync(string jobId, CancellationToken cancellationToken);
}

/// <summary>Acquires bounded local/distributed capacity and releases it when disposed.</summary>
public interface ITenantWorkAdmission
{
    Task<IAsyncDisposable?> AcquireAsync(Guid tenantId, string targetId, CancellationToken cancellationToken);
}

public interface ITenantWorkHandler
{
    Task HandleAsync(TenantWorkItem item, CancellationToken cancellationToken);
}
