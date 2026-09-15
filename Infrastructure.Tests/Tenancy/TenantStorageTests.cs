using Application.Tenancy;
using Domain;
using Infrastructure.Data.EfCore.Persistence;
using Infrastructure.Tenancy.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantStorageTests
{
    private static readonly Guid A = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid B = Guid.Parse("22222222-2222-2222-2222-222222222222");

    internal static TenantContext Context(Guid tenant, TenantIsolation isolation = TenantIsolation.Row, string? schema = null)
        => new(new TenantPlacement(tenant, isolation, "sql-01", schema, "region-1", 1, TenantLifecycle.Active), "subject", "issuer");

    internal static async Task<AppDbContext> Create(Guid tenant, TenantIsolation isolation = TenantIsolation.Row, string? schema = null)
    {
        var target = new TenantStorageTarget("sql-01", "region-1", isolation, "shared",
            "Server=localhost;Database=saas_test;Integrated Security=true;TrustServerCertificate=true");
        var provider = new Mock<ITenantStorageTargetProvider>();
        provider.Setup(p => p.ResolveAsync("sql-01", It.IsAny<CancellationToken>())).ReturnsAsync(target);
        return await new TenantStorageContextFactory(provider.Object).CreateAsync(Context(tenant, isolation, schema), isolation, default);
    }

    [Theory]
    [InlineData(TenantIsolation.Database, null, "shared")]
    [InlineData(TenantIsolation.Schema, "org_a", "org_a")]
    [InlineData(TenantIsolation.Row, null, "shared")]
    public async Task All_strategies_build_tenant_keys_foreign_keys_and_indexes(TenantIsolation isolation, string? schema, string expectedSchema)
    {
        await using var db = await Create(A, isolation, schema);
        Assert.Equal(expectedSchema, db.Model.GetDefaultSchema());
        foreach (var entity in db.Model.GetEntityTypes())
        {
            Assert.Equal("TenantId", entity.FindPrimaryKey()!.Properties[0].Name);
            Assert.True(entity.FindProperty("TenantId")!.IsConcurrencyToken);
            Assert.NotNull(entity.GetQueryFilter());
            foreach (var fk in entity.GetForeignKeys())
            {
                Assert.Equal("TenantId", fk.Properties[0].Name);
                Assert.Equal("TenantId", fk.PrincipalKey.Properties[0].Name);
            }
            foreach (var index in entity.GetIndexes()) Assert.Equal("TenantId", index.Properties[0].Name);
        }
        var script = db.Database.GenerateCreateScript();
        Assert.Contains("[TenantId] uniqueidentifier NOT NULL", script);
        Assert.DoesNotContain("INSERT INTO", script);
        Assert.Contains("IDENTITY", script);
    }

    [Fact]
    public async Task Row_model_is_shared_but_query_parameters_use_current_organization()
    {
        await using var a = await Create(A);
        await using var b = await Create(B);
        Assert.Same(a.Model, b.Model);
        var queryA = a.Projects.ToQueryString();
        var queryB = b.Projects.ToQueryString();
        Assert.Contains(A.ToString(), queryA);
        Assert.Contains(B.ToString(), queryB);
        Assert.DoesNotContain(A.ToString(), queryB);
        Assert.Contains("IsDeleted", queryA);
        Assert.Contains("TenantId", b.Users.ToQueryString());
        Assert.Contains("TenantId", b.RefreshTokens.ToQueryString());
    }

    [Fact]
    public async Task Schemas_and_legacy_model_have_distinct_cache_entries()
    {
        await using var a = await Create(A, TenantIsolation.Schema, "org_a");
        await using var b = await Create(B, TenantIsolation.Schema, "org_b");
        using var legacy = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=localhost;Database=legacy;Integrated Security=true").Options);
        Assert.NotSame(a.Model, b.Model);
        Assert.Contains("[org_a].[Projects]", a.Projects.ToQueryString());
        Assert.Contains("[org_b].[Projects]", b.Projects.ToQueryString());
        Assert.Null(legacy.Model.FindEntityType(typeof(Project))!.FindProperty("TenantId"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Forged_inserts_are_rejected_before_SQL(bool async)
    {
        await using var db = await Create(A);
        var project = new Project { Name = "forged" };
        db.Add(project);
        db.Entry(project).Property("TenantId").CurrentValue = B;
        if (async) await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync(false, default));
        else Assert.Throws<InvalidOperationException>(() => db.SaveChanges(false));
    }

    [Fact]
    public async Task Unbound_detached_updates_and_deletes_fail_before_SQL()
    {
        foreach (var state in new[] { EntityState.Modified, EntityState.Deleted })
        {
            await using var db = await Create(A);
            var project = new Project { Id = 123, Name = "detached" };
            db.Entry(project).State = state;
            await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        }
    }

    [Fact]
    public async Task Wrong_strategy_or_region_is_rejected_without_opening_SQL()
    {
        var provider = new Mock<ITenantStorageTargetProvider>(MockBehavior.Strict);
        var factory = new TenantStorageContextFactory(provider.Object);
        await Assert.ThrowsAsync<InvalidOperationException>(() => factory.CreateAsync(Context(A), TenantIsolation.Database, default));
        provider.VerifyNoOtherCalls();
        provider.Setup(p => p.ResolveAsync("sql-01", default)).ReturnsAsync(new TenantStorageTarget(
            "sql-01", "other-region", TenantIsolation.Row, "shared", "Server=localhost;Database=test;Integrated Security=true"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => factory.CreateAsync(Context(A), TenantIsolation.Row, default));
    }

    [Fact]
    public async Task RLS_script_covers_identity_refresh_and_business_tables_and_blocks_wrong_tenant_writes()
    {
        await using var db = await Create(A);
        var script = TenantRowSecurityScript.Create(db.Model, db.StorageSchema);
        foreach (var entity in db.Model.GetEntityTypes())
            Assert.Contains("ON [shared].[" + entity.GetTableName() + "] AFTER INSERT", script);
        Assert.Contains("SESSION_CONTEXT", script);
        Assert.Contains("AFTER UPDATE", script);
        Assert.Contains("ADD FILTER PREDICATE", script);
        Assert.Throws<ArgumentException>(() => TenantRowSecurityScript.Create(db.Model, "bad];DROP"));
    }
}
