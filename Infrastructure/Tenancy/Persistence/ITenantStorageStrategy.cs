using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;

namespace Infrastructure.Tenancy.Persistence;

// Credentials and physical target details are resolved through the injected provider. Client requests
// provide only an authorized catalog placement; callers cannot supply SQL identifiers or connection strings.
// Keep EF-specific contracts in Infrastructure and create a fresh scoped context for each operation.
public interface ITenantStorageStrategy
{
    TenantIsolation Isolation { get; }
    Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken);
}
