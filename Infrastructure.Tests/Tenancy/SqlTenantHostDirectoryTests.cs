using System.Data;
using System.Data.Common;
using Application.Tenancy.Resolution;
using Infrastructure.Tenancy.Authorization;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;

namespace Infrastructure.Tests.Tenancy;

public sealed class SqlTenantHostDirectoryTests
{
    private static readonly Guid TenantId = Guid.Parse("dfc17bd9-eab0-480b-bec4-ed86116f9431");

    [Fact]
    public async Task Finds_active_authority_with_fixed_bounded_parameterized_query()
    {
        using var harness = new Harness(TenantId);

        Assert.Equal(TenantId, await harness.Directory.FindTenantAsync("custom.example.com", CancellationToken.None));

        Assert.Contains("SELECT TOP (2) [TenantId]", harness.Command.Object.CommandText);
        Assert.Contains("FROM [catalog].[TenantAuthorities]", harness.Command.Object.CommandText);
        Assert.Contains("[Authority] = @Authority AND [IsActive] = 1", harness.Command.Object.CommandText);
        Assert.DoesNotContain("custom.example.com", harness.Command.Object.CommandText);
        Assert.Equal(CommandType.Text, harness.Command.Object.CommandType);
        Assert.Equal(7, harness.Command.Object.CommandTimeout);
        Assert.Equal(DbType.String, harness.Parameters["@Authority"].DbType);
        Assert.Equal("custom.example.com", harness.Parameters["@Authority"].Value);
        Assert.Equal(259, harness.Parameters["@Authority"].Size);
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
        Assert.True(harness.CommandDisposed);
    }

    [Fact]
    public async Task Missing_authority_returns_null_without_fallback()
    {
        using var harness = new Harness();

        Assert.Null(await harness.Directory.FindTenantAsync("missing.example.com", CancellationToken.None));
        Assert.True(harness.Reader.IsClosed);
    }

    [Fact]
    public async Task Duplicate_active_authorities_fail_closed()
    {
        using var harness = new Harness(TenantId, Guid.NewGuid());

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Directory.FindTenantAsync("custom.example.com", CancellationToken.None));
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Theory]
    [InlineData("CUSTOM.EXAMPLE.COM")]
    [InlineData(" custom.example.com")]
    [InlineData("custom.example.com ")]
    [InlineData("https://custom.example.com")]
    [InlineData("custom.example.com/path")]
    public async Task Noncanonical_authority_is_rejected_before_connection(string authority)
    {
        using var harness = new Harness(TenantId);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            harness.Directory.FindTenantAsync(authority, CancellationToken.None));
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
    }

    [Fact]
    public async Task Empty_directory_identity_is_corruption()
    {
        using var harness = new Harness(Guid.Empty);

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Directory.FindTenantAsync("custom.example.com", CancellationToken.None));
    }

    [Fact]
    public async Task Caller_cancellation_prevents_connection_creation()
    {
        using var harness = new Harness(TenantId);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Directory.FindTenantAsync("custom.example.com", cancellation.Token));
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
    }

    [Fact]
    public async Task Provider_failure_propagates_and_disposes_connection()
    {
        using var harness = new Harness(TenantId);
        var failure = new InvalidOperationException("provider failure");
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(failure);

        var actual = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.Directory.FindTenantAsync("custom.example.com", CancellationToken.None));

        Assert.Same(failure, actual);
        Assert.True(harness.ConnectionDisposed);
    }

    private sealed class Harness : IDisposable
    {
        private readonly SqlCommand _parameterOwner = new();

        public Harness(params Guid[] tenantIds)
        {
            var table = new DataTable();
            table.Columns.Add("TenantId", typeof(object));
            foreach (var tenantId in tenantIds)
                table.Rows.Add(tenantId);
            Reader = table.CreateDataReader();

            Command.SetupAllProperties();
            Command.Protected().Setup<DbParameterCollection>("DbParameterCollection").Returns(Parameters);
            Command.Protected().Setup<DbParameter>("CreateDbParameter").Returns(() => new SqlParameter());
            Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                    ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>())
                .Returns((CommandBehavior _, CancellationToken _) => Task.FromResult<DbDataReader>(Reader));
            Command.Setup(command => command.DisposeAsync()).Callback(() => CommandDisposed = true)
                .Returns(ValueTask.CompletedTask);
            Connection.Protected().Setup<DbCommand>("CreateDbCommand").Returns(Command.Object);
            Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            Connection.Setup(connection => connection.DisposeAsync()).Callback(() => ConnectionDisposed = true)
                .Returns(ValueTask.CompletedTask);
            Factory.Setup(factory => factory.CreateConnection()).Returns(Connection.Object);
            Directory = new SqlTenantHostDirectory(Factory.Object,
                Options.Create(new TenantCatalogReadOptions { CommandTimeoutSeconds = 7, LookupTimeoutSeconds = 11 }),
                TimeProvider.System);
        }

        public SqlTenantHostDirectory Directory { get; }
        public Mock<ITenantCatalogConnectionFactory> Factory { get; } = new();
        public Mock<DbConnection> Connection { get; } = new();
        public Mock<DbCommand> Command { get; } = new();
        public DataTableReader Reader { get; }
        public SqlParameterCollection Parameters => _parameterOwner.Parameters;
        public bool ConnectionDisposed { get; private set; }
        public bool CommandDisposed { get; private set; }

        public void Dispose()
        {
            Reader.Dispose();
            _parameterOwner.Dispose();
        }
    }
}
