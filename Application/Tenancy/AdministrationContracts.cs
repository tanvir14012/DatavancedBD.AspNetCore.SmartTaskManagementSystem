namespace Application.Tenancy;

// TargetId is a logical reference, not a connection string. Shared targets must be deduplicated.
/// <summary>A logical storage target selected for a schema upgrade.</summary>
public sealed record MigrationTarget(string TargetId, string? Schema, TenantIsolation Isolation);
/// <summary>The result of applying a migration to one storage target.</summary>
public sealed record MigrationOutcome(MigrationTarget Target, bool Succeeded, string? ErrorCode);

/// <summary>Enumerates distinct logical storage targets for controlled migration.</summary>
public interface IMigrationTargetSource
{
    /// <summary>Enumerates the configured migration targets, honoring cancellation.</summary>
    IAsyncEnumerable<MigrationTarget> ReadAsync(CancellationToken cancellationToken);
}

/// <summary>Applies the reviewed schema upgrade for one physical target.</summary>
public interface IMigrationTargetExecutor
{
    /// <summary>Executes the operation for the supplied authorized target.</summary>
    Task ExecuteAsync(MigrationTarget target, CancellationToken cancellationToken);
}

/// <summary>Acquires the distributed lock for one target and releases it on disposal.</summary>
public interface IMigrationTargetLockProvider
{
    /// <summary>Acquires the operation lease; dispose the returned handle to release it.</summary>
    Task<IAsyncDisposable> AcquireAsync(MigrationTarget target, CancellationToken cancellationToken);
}

/// <summary>Durable completion ledger used to make migration retries resumable.</summary>
public interface IMigrationLedger
{
    /// <summary>Checks whether the migration ledger records this target as applied.</summary>
    Task<bool> IsAppliedAsync(MigrationTarget target, CancellationToken cancellationToken);
    /// <summary>Records a successfully applied migration in the durable ledger.</summary>
    Task RecordAppliedAsync(MigrationTarget target, CancellationToken cancellationToken);
}

/// <summary>Coordinates migration of the configured storage targets.</summary>
public interface ITenantMigrationRunner
{
    /// <summary>Runs the configured operations and returns their outcomes.</summary>
    Task<IReadOnlyList<MigrationOutcome>> RunAsync(CancellationToken cancellationToken);
}

/// <summary>Coordinates provisioning of a tenant's storage placement.</summary>
public interface ITenantProvisioner
{
    /// <summary>Provisions storage for the specified tenant and isolation strategy.</summary>
    Task ProvisionAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken);
}

/// <summary>Allocates a trusted target and returns a non-active provisioning placement.</summary>
public interface ITenantPlacementAllocator
{
    /// <summary>Allocates a trusted non-active placement for provisioning.</summary>
    Task<TenantPlacement> AllocateAsync(Guid tenantId, TenantIsolation isolation, CancellationToken cancellationToken);
}

/// <summary>Creates schema objects/data and runs post-provisioning checks for a placement.</summary>
public interface ITenantProvisioningExecutor
{
    /// <summary>Executes the operation for the supplied authorized target.</summary>
    Task ExecuteAsync(TenantPlacement placement, CancellationToken cancellationToken);
    /// <summary>Validates the supplied tenant operation against the implementing authority.</summary>
    Task ValidateAsync(TenantPlacement placement, CancellationToken cancellationToken);
}

/// <summary>Prevents concurrent provisioning or relocation operations for one organization.</summary>
public interface ITenantProvisioningLockProvider
{
    /// <summary>Acquires the operation lease; dispose the returned handle to release it.</summary>
    Task<IAsyncDisposable> AcquireAsync(Guid tenantId, CancellationToken cancellationToken);
}

/// <summary>Decides whether work can enter a tenant's capacity boundary.</summary>
public interface ITenantAdmissionPolicy
{
    /// <summary>Checks whether the tenant can accept additional work.</summary>
    Task<bool> CanAdmitAsync(Guid tenantId, CancellationToken cancellationToken);
}

/// <summary>Describes one idempotent tenant-scoped background job.</summary>
public sealed record TenantWorkItem
{
    /// <summary>Creates the application tenancy tenant work item with its required dependencies.</summary>
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

    /// <summary>The idempotency identifier within the tenant.</summary>
    public string JobId { get; }
    /// <summary>The purchasing organization's identifier.</summary>
    public Guid TenantId { get; }
    /// <summary>The authorized storage isolation strategy.</summary>
    public TenantIsolation Isolation { get; }
    /// <summary>The logical storage target; never a connection string.</summary>
    public string TargetId { get; }
    /// <summary>The positive placement revision associated with the work.</summary>
    public long PlacementVersion { get; }
    /// <summary>The issuer-qualified subject requiring authorization.</summary>
    public TenantAccess Access { get; }
}

/// <summary>Receives tenant work and records its completion or failure.</summary>
public interface ITenantJobQueue
{
    /// <summary>Enumerates the configured migration targets, honoring cancellation.</summary>
    IAsyncEnumerable<TenantWorkItem> ReadAsync(CancellationToken cancellationToken);
    /// <summary>Complete async for this application tenancy contract.</summary>
    Task CompleteAsync(TenantWorkItem item, CancellationToken cancellationToken);
    /// <summary>Abandon async for this application tenancy contract.</summary>
    Task AbandonAsync(TenantWorkItem item, bool retryable, CancellationToken cancellationToken);
}

/// <summary>Coordinates tenant-scoped job deduplication.</summary>
public interface ITenantJobDeduplicator
{
    /// <summary>Try begin async for this application tenancy contract.</summary>
    Task<bool> TryBeginAsync(string jobId, CancellationToken cancellationToken);
    /// <summary>Complete async for this application tenancy contract.</summary>
    Task CompleteAsync(string jobId, CancellationToken cancellationToken);
    /// <summary>Abandon async for this application tenancy contract.</summary>
    Task AbandonAsync(string jobId, CancellationToken cancellationToken);
}

/// <summary>Acquires bounded local/distributed capacity and releases it when disposed.</summary>
public interface ITenantWorkAdmission
{
    /// <summary>Acquires the operation lease; dispose the returned handle to release it.</summary>
    Task<IAsyncDisposable?> AcquireAsync(Guid tenantId, string targetId, CancellationToken cancellationToken);
}

/// <summary>Executes authorized tenant work in its established scope.</summary>
public interface ITenantWorkHandler
{
    /// <summary>Handle async for this application tenancy contract.</summary>
    Task HandleAsync(TenantWorkItem item, CancellationToken cancellationToken);
}
