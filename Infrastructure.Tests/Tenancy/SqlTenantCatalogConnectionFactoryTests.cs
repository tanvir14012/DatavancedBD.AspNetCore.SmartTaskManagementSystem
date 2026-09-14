using System.Data;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tests.Tenancy;

public sealed class SqlTenantCatalogConnectionFactoryTests
{
    private const string ConnectionSettings = "Server=localhost;Database=tenant_catalog;Integrated Security=true";

    [Fact]
    public void Connections_are_new_unopened_instances_with_one_stable_bounded_primary_pool()
    {
        var factory = new SqlTenantCatalogConnectionFactory(Options.Create(new SqlTenantCatalogConnectionOptions
        {
            ConnectionString = ConnectionSettings + ";Application Intent=ReadOnly;Connect Timeout=0;Min Pool Size=50;Max Pool Size=500;ConnectRetryCount=5;Persist Security Info=true",
            ConnectTimeoutSeconds = 8,
            MaxPoolSize = 19
        }));

        using var first = factory.CreateConnection();
        using var second = factory.CreateConnection();
        Assert.NotSame(first, second);
        Assert.Equal(ConnectionState.Closed, first.State);
        Assert.Equal(ConnectionState.Closed, second.State);
        Assert.Equal(first.ConnectionString, second.ConnectionString);
        var builder = new SqlConnectionStringBuilder(first.ConnectionString);
        Assert.Equal("localhost", builder.DataSource);
        Assert.Equal("tenant_catalog", builder.InitialCatalog);
        Assert.Equal(8, builder.ConnectTimeout);
        Assert.Equal(19, builder.MaxPoolSize);
        Assert.Equal(0, builder.MinPoolSize);
        Assert.True(builder.Pooling);
        Assert.Equal(0, builder.ConnectRetryCount);
        Assert.Equal(ApplicationIntent.ReadWrite, builder.ApplicationIntent);
        Assert.False(builder.PersistSecurityInfo);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(121, 10)]
    [InlineData(1, 0)]
    [InlineData(1, 1001)]
    public void Unbounded_or_excessive_resource_settings_are_rejected(int timeout, int pool)
    {
        Assert.ThrowsAny<ArgumentException>(() => new SqlTenantCatalogConnectionFactory(Options.Create(
            new SqlTenantCatalogConnectionOptions
            {
                ConnectionString = ConnectionSettings,
                ConnectTimeoutSeconds = timeout,
                MaxPoolSize = pool
            })));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("Server=localhost")]
    [InlineData("Database=tenant_catalog")]
    [InlineData("Password=never-echo-this;Unknown=secret-value")]
    [InlineData("Server=localhost;Database=tenant_catalog;Connect Timeout=secret-value")]
    [InlineData("Server=localhost;Database=tenant_catalog;Connect Timeout=99999999999999999999999999")]
    public void Invalid_connection_configuration_is_sanitized(string settings)
    {
        var exception = Assert.ThrowsAny<ArgumentException>(() => new SqlTenantCatalogConnectionFactory(Options.Create(
            new SqlTenantCatalogConnectionOptions { ConnectionString = settings })));
        Assert.Null(exception.InnerException);
        Assert.DoesNotContain("never-echo-this", exception.ToString());
        Assert.DoesNotContain("secret-value", exception.ToString());
    }
}
