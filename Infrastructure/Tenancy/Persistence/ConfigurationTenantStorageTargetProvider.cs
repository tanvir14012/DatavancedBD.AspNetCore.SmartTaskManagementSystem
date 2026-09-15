using Application.Tenancy;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Reads current external backing-service definitions by catalog-issued logical handle.</summary>
public sealed class ConfigurationTenantStorageTargetProvider(IConfiguration configuration) : ITenantStorageTargetProvider
{
    public Task<TenantStorageTarget> ResolveAsync(string targetId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // Validate before using the identifier as a configuration section name.
        _ = new TenantPlacement(Guid.NewGuid(), TenantIsolation.Database, targetId, null, "validation", 1, TenantLifecycle.Active);
        var section = configuration.GetSection("Saas:Storage:Targets").GetSection(targetId);
        if (!section.Exists()) throw new InvalidOperationException("Tenant storage target is not configured.");
        if (!Enum.TryParse<TenantIsolation>(section["Isolation"], false, out var isolation) || !Enum.IsDefined(isolation))
            throw new InvalidOperationException("Tenant storage isolation is invalid.");
        var target = new TenantStorageTarget(targetId,
            section["Region"] ?? throw new InvalidOperationException("Tenant storage region is required."),
            isolation, section["Schema"] ?? throw new InvalidOperationException("Tenant storage schema is required."),
            section["ConnectionString"] ?? throw new InvalidOperationException("Tenant storage connection is required."),
            section.GetValue("MaxPoolSize", 50), section.GetValue("CommandTimeoutSeconds", 30));
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(target);
    }
}
