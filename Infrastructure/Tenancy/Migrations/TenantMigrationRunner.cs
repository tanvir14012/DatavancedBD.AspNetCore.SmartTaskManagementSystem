using Application.Tenancy;
namespace Infrastructure.Tenancy.Migrations;

// TODO(SAAS-05): Inject target source, lock provider, migration executor, ledger, and TimeProvider.
// TODO(SAAS-05): Deduplicate targets, bound concurrency, lock in SQL, checkpoint and resume safely.
// Schema operations and database-scoped partition objects require separate coordination.
public sealed class TenantMigrationRunner : ITenantMigrationRunner
{
    public Task<IReadOnlyList<MigrationOutcome>> RunAsync(CancellationToken cancellationToken)
        => throw new NotImplementedException("TODO(SAAS-05): Out-of-band migrations.");
}
