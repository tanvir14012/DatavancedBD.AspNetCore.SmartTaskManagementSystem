using Infrastructure.Tenancy.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tests.Tenancy;

public sealed class LocalTenantBindingTests
{
    private static IConfiguration Configuration(string environment, string isolation = "Row", string schema = "dbo") =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ASPNETCORE_ENVIRONMENT"] = environment,
            ["LocalTenant:Id"] = "30000000-0000-0000-0000-000000000001",
            ["LocalTenant:Isolation"] = isolation,
            ["LocalTenant:Schema"] = schema,
            ["LocalTenant:Target"] = "local",
            ["ConnectionStrings:DefaultConnection"] = "Server=localhost;Database=StmsLocaltest;Integrated Security=true"
        }).Build();

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public void Local_binding_cannot_be_enabled_in_other_environments(string environment) =>
        Assert.Throws<InvalidOperationException>(() => new LocalTenantBinding(Configuration(environment)));

    [Theory]
    [InlineData("Database", "dbo")]
    [InlineData("Schema", "atlas")]
    [InlineData("Row", "dbo")]
    public void Local_binding_uses_tenant_model_and_server_owned_placement(string isolation, string schema)
    {
        var binding = new LocalTenantBinding(Configuration("LocalDocker", isolation, schema));
        using var db = binding.CreateContext();
        Assert.True(db.IsTenantStorage);
        Assert.Equal(schema, db.StorageSchema);
        Assert.Contains(binding.Current.Placement.TenantId.ToString(), db.Users.ToQueryString());
        var script = db.Database.GenerateCreateScript();
        Assert.Contains("[TenantId] uniqueidentifier NOT NULL", script);
        Assert.DoesNotContain("INSERT INTO", script);
    }
}
