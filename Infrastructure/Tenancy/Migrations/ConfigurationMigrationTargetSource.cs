using Application.Tenancy;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tenancy.Migrations;

/// <summary>Enumerates reviewed target definitions in the Admin process only.</summary>
public sealed class ConfigurationMigrationTargetSource(IConfiguration configuration) : IMigrationTargetSource
{
    private const string SectionName = "Saas:Storage:Targets";

    public async IAsyncEnumerable<MigrationTarget> ReadAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        foreach (var section in configuration.GetSection(SectionName).GetChildren())
        {
            cancellationToken.ThrowIfCancellationRequested();
            var targetId = section.Key;
            if (!Enum.TryParse<TenantIsolation>(section["Isolation"], ignoreCase: false, out var isolation) ||
                !Enum.IsDefined(isolation))
                throw new InvalidDataException("A configured migration target has an invalid isolation strategy.");

            var schema = section["Schema"];
            if (isolation == TenantIsolation.Schema && string.IsNullOrWhiteSpace(schema))
                throw new InvalidDataException("A schema migration target has no schema.");
            if (isolation != TenantIsolation.Schema)
                schema = null;

            // Validate the same identifier contract used by runtime routing, without resolving
            // credentials or creating a connection in this source.
            _ = new TenantPlacement(Guid.NewGuid(), isolation == TenantIsolation.Schema
                ? TenantIsolation.Schema : TenantIsolation.Database, targetId, schema,
                section["Region"] ?? throw new InvalidDataException("Migration target region is required."),
                1, TenantLifecycle.Active);
            yield return new MigrationTarget(targetId, schema, isolation);
            await Task.Yield();
        }
    }
}
