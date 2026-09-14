using Application.Tenancy;
using Infrastructure.Data.EfCore.Persistence;

namespace Infrastructure.Tenancy.Persistence;

// TODO(SAAS-03): Resolve credentials through an injected target provider; never accept client SQL identifiers.
// Keep EF-specific contracts in Infrastructure. Use a fresh scoped context, not a singleton context.
public interface ITenantStorageStrategy
{
    TenantIsolation Isolation { get; }
    Task<AppDbContext> CreateContextAsync(TenantContext context, CancellationToken cancellationToken);
}
