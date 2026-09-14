using Application.Tenancy;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantPlacementTests
{
    private static readonly Guid OrganizationId = Guid.Parse("248f574e-f377-4a7d-9b26-8ea2c5dd2367");

    [Theory]
    [InlineData(TenantIsolation.Database, null)]
    [InlineData(TenantIsolation.Schema, "org_248f574e")]
    [InlineData(TenantIsolation.Row, null)]
    public void PreservesOrganizationIdentityAndPlacementAcrossStorageTiers(TenantIsolation isolation, string? schema)
    {
        var placement = Create(isolation: isolation, schema: schema);

        Assert.Equal(OrganizationId, placement.TenantId);
        Assert.Equal(isolation, placement.Isolation);
        Assert.Equal("Sql.Group-01", placement.TargetId);
        Assert.Equal(schema, placement.Schema);
        Assert.Equal("southeastasia", placement.Region);
        Assert.Equal(1, placement.Version);
        Assert.Equal(TenantLifecycle.Active, placement.Lifecycle);
    }

    [Fact]
    public void RejectsEmptyOrganizationIdentity()
        => Assert.Throws<ArgumentException>("tenantId", () => Create(tenantId: Guid.Empty));

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(999)]
    public void RejectsUnknownIsolationWithoutDefaultingToAnotherTier(int isolation)
        => Assert.Throws<ArgumentOutOfRangeException>("isolation", () => Create(isolation: (TenantIsolation)isolation));

    [Theory]
    [InlineData(-1)]
    [InlineData(4)]
    public void RejectsUnknownLifecycle(int lifecycle)
        => Assert.Throws<ArgumentOutOfRangeException>("lifecycle", () => Create(lifecycle: (TenantLifecycle)lifecycle));

    [Theory]
    [InlineData(TenantLifecycle.Provisioning)]
    [InlineData(TenantLifecycle.Active)]
    [InlineData(TenantLifecycle.Moving)]
    [InlineData(TenantLifecycle.Suspended)]
    public void PreservesLifecycleWithoutImplicitlyActivatingTenant(TenantLifecycle lifecycle)
        => Assert.Equal(lifecycle, Create(lifecycle: lifecycle).Lifecycle);

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(long.MinValue)]
    public void RejectsNonpositiveVersion(long version)
        => Assert.Throws<ArgumentOutOfRangeException>("version", () => Create(version: version));

    [Fact]
    public void AcceptsLargestPositiveVersionWithoutArithmeticOverflow()
        => Assert.Equal(long.MaxValue, Create(version: long.MaxValue).Version);

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(" target")]
    [InlineData("target ")]
    [InlineData("target\n")]
    [InlineData("group:one")]
    [InlineData("Server=sql;Password=secret")]
    [InlineData("group/one")]
    [InlineData("_group")]
    [InlineData("région")]
    public void RejectsMalformedHandlesWithoutTrimmingOrInterpretingThem(string value)
    {
        Assert.Throws<ArgumentException>("targetId", () => Create(targetId: value));
        Assert.Throws<ArgumentException>("region", () => Create(region: value));
    }

    [Fact]
    public void RejectsNullHandles()
    {
        Assert.Throws<ArgumentNullException>("targetId", () => Create(targetId: null!));
        Assert.Throws<ArgumentNullException>("region", () => Create(region: null!));
    }

    [Fact]
    public void EnforcesHandleLengthAtBoundary()
    {
        var valid = new string('a', 128);
        Assert.Equal(valid, Create(targetId: valid, region: valid).TargetId);
        Assert.Throws<ArgumentException>("targetId", () => Create(targetId: valid + "a"));
        Assert.Throws<ArgumentException>("region", () => Create(region: valid + "a"));
    }

    [Fact]
    public void RequiresSchemaForSchemaIsolation()
        => Assert.Throws<ArgumentNullException>("schema", () => Create(isolation: TenantIsolation.Schema));

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(" org")]
    [InlineData("org ")]
    [InlineData("org\n")]
    [InlineData("1org")]
    [InlineData("org.finance")]
    [InlineData("[org]")]
    [InlineData("org]; DROP TABLE Users;--")]
    [InlineData("org-finance")]
    [InlineData("组织")]
    public void RejectsSchemaOutsideProvisioningIdentifierPolicy(string schema)
        => Assert.Throws<ArgumentException>("schema", () => Create(isolation: TenantIsolation.Schema, schema: schema));

    [Theory]
    [InlineData("a")]
    [InlineData("_org_1")]
    [InlineData("Org_Finance2")]
    public void PreservesValidSchemaIdentifiers(string schema)
        => Assert.Equal(schema, Create(isolation: TenantIsolation.Schema, schema: schema).Schema);

    [Fact]
    public void EnforcesSchemaLengthAtBoundary()
    {
        var valid = new string('a', 128);
        Assert.Equal(valid, Create(isolation: TenantIsolation.Schema, schema: valid).Schema);
        Assert.Throws<ArgumentException>("schema", () => Create(isolation: TenantIsolation.Schema, schema: valid + "a"));
    }

    [Theory]
    [InlineData(TenantIsolation.Database, "stms")]
    [InlineData(TenantIsolation.Database, "")]
    [InlineData(TenantIsolation.Row, "stms")]
    [InlineData(TenantIsolation.Row, "")]
    public void RejectsSchemaOverridesForTargetOwnedSchemas(TenantIsolation isolation, string schema)
        => Assert.Throws<ArgumentException>("schema", () => Create(isolation: isolation, schema: schema));

    [Fact]
    public void DistinguishesRevisionsAndOrganizationsWithoutMutatingExistingPlacement()
    {
        var original = Create();
        Assert.Equal(original, Create());
        Assert.NotEqual(original, Create(version: 2));
        Assert.NotEqual(original, Create(lifecycle: TenantLifecycle.Suspended));
        Assert.NotEqual(original, Create(tenantId: Guid.NewGuid()));
        Assert.Equal(1, original.Version);
        Assert.Equal(TenantLifecycle.Active, original.Lifecycle);
    }

    private static TenantPlacement Create(
        Guid? tenantId = null, TenantIsolation isolation = TenantIsolation.Database,
        string targetId = "Sql.Group-01", string? schema = null, string region = "southeastasia",
        long version = 1, TenantLifecycle lifecycle = TenantLifecycle.Active)
        => new(tenantId ?? OrganizationId, isolation, targetId, schema, region, version, lifecycle);
}
