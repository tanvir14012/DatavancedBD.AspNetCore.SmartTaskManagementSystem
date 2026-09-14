namespace Infrastructure.Tests.Tenancy;

// These are explicitly skipped acceptance placeholders, not passing security coverage.
public sealed class TenancyAcceptanceTests
{
    [Fact(Skip = "TODO(SAAS-01): Reject stale placement and recover from Redis eviction without losing catalog data.")]
    public void Catalog() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-02): Reject host/header/JWT mismatch and unauthorized organization membership.")]
    public void Resolution() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-03): Verify two organizations cannot read or write each other's records.")]
    public void DatabaseIsolation() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-03): Alternate schemas on reused connections and check EF model-cache isolation.")]
    public void SchemaIsolation() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-03): Verify filters, RLS, writes, bulk SQL, Identity and tenant-aware foreign keys.")]
    public void RowIsolation() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-04): Verify colliding entity/user IDs cannot collide across organizations.")]
    public void CacheIsolation() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-05): Run twice, concurrently, and after interruption for all physical target types.")]
    public void Migrations() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-06): Do not activate failed provisioning; fence old placement on relocation.")]
    public void Provisioning() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-07): Bound concurrent work and preserve other tenants during a target outage.")]
    public void Resources() => throw new NotImplementedException();

    [Fact(Skip = "TODO(SAAS-08): Start without catalog enumeration, DDL, or seeding.")]
    public void WebStartup() => throw new NotImplementedException();
}
