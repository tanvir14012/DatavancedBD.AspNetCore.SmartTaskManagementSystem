namespace Infrastructure.Tests.Tenancy;

// These are explicitly skipped live-provider acceptance checks, not passing security coverage.
public sealed class TenancyAcceptanceTests
{
    [Fact(Skip = "SAAS-01 deployment acceptance: requires isolated Azure SQL and Redis services.")]
    public void Catalog() => Assert.True(true);

    [Fact(Skip = "SAAS-02 deployment acceptance: requires an isolated control-plane SQL service.")]
    public void Resolution() => Assert.True(true);

    [Fact(Skip = "SAAS-03 deployment acceptance: verify two organizations cannot read or write each other's records.")]
    public void DatabaseIsolation() => Assert.True(true);

    [Fact(Skip = "SAAS-03 deployment acceptance: alternate schemas on reused connections and check EF model-cache isolation.")]
    public void SchemaIsolation() => Assert.True(true);

    [Fact(Skip = "SAAS-03 deployment acceptance: verify filters, RLS, writes, bulk SQL, Identity and tenant-aware foreign keys.")]
    public void RowIsolation() => Assert.True(true);

    [Fact(Skip = "SAAS-04 deployment acceptance: verify colliding entity/user IDs cannot collide across organizations.")]
    public void CacheIsolation() => Assert.True(true);

    [Fact(Skip = "SAAS-05 deployment acceptance: run twice, concurrently, and after interruption for all physical target types.")]
    public void Migrations() => Assert.True(true);

    [Fact(Skip = "SAAS-06 deployment acceptance: do not activate failed provisioning; fence old placement on relocation.")]
    public void Provisioning() => Assert.True(true);

    [Fact(Skip = "SAAS-07 deployment acceptance: bound concurrent work and preserve other tenants during a target outage.")]
    public void Resources() => Assert.True(true);

    [Fact(Skip = "SAAS-08 deployment acceptance: start without catalog enumeration, DDL, or seeding.")]
    public void WebStartup() => Assert.True(true);
}
