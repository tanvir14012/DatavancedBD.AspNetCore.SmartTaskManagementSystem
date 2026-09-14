using System.Data;
using System.Data.Common;
using Application.Tenancy;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;

namespace Infrastructure.Tests.Tenancy;

public sealed class AzureSqlTenantCatalogWriterTests
{
    private static readonly Guid TenantId = Guid.Parse("248f574e-f377-4a7d-9b26-8ea2c5dd2367");

    [Fact]
    public async Task Save_uses_parameterized_serializable_cas_and_returns_provider_result()
    {
        using var harness = new Harness(true);
        Assert.True(await harness.Writer.TrySaveAsync(Placement(3), 2, CancellationToken.None));

        Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", harness.Command.Object.CommandText);
        Assert.Contains("@ExpectedVersion", harness.Command.Object.CommandText);
        Assert.DoesNotContain(TenantId.ToString(), harness.Command.Object.CommandText);
        Assert.Equal(CommandType.Text, harness.Command.Object.CommandType);
        Assert.Equal(7, harness.Command.Object.CommandTimeout);
        var parameters = harness.Parameters.Cast<DbParameter>().ToDictionary(parameter => parameter.ParameterName);
        Assert.Equal(TenantId, parameters["@TenantId"].Value);
        Assert.Equal(DbType.Guid, parameters["@TenantId"].DbType);
        Assert.Equal((byte)TenantIsolation.Schema, parameters["@Isolation"].Value);
        Assert.Equal("org_248f574e", parameters["@SchemaName"].Value);
        Assert.Equal(3L, parameters["@NewVersion"].Value);
        Assert.Equal(2L, parameters["@ExpectedVersion"].Value);
        Assert.Equal(128, parameters["@TargetId"].Size);
        Assert.True(harness.ConnectionDisposed);
        Assert.True(harness.CommandDisposed);
    }

    [Fact]
    public async Task Stale_or_existing_initial_insert_returns_false_without_failing()
    {
        using var harness = new Harness(false);
        Assert.False(await harness.Writer.TrySaveAsync(Placement(1), 0, CancellationToken.None));
    }

    [Theory]
    [InlineData(-1, 2)]
    [InlineData(0, 0)]
    [InlineData(2, 2)]
    public async Task Invalid_expected_or_nonadvancing_revision_is_rejected(long expected, long revision)
    {
        using var harness = new Harness(true);
        await Assert.ThrowsAnyAsync<ArgumentException>(() => harness.Writer.TrySaveAsync(Placement(revision), expected, CancellationToken.None));
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
    }

    [Fact]
    public async Task Malformed_scalar_result_fails_closed()
    {
        using var harness = new Harness("unexpected");
        await Assert.ThrowsAsync<InvalidDataException>(() => harness.Writer.TrySaveAsync(Placement(2), 1, CancellationToken.None));
    }

    [Fact]
    public async Task Provider_failure_propagates_and_disposes_owned_resources()
    {
        using var harness = new Harness(true);
        var failure = new InvalidOperationException("provider failure");
        harness.Command.Setup(command => command.ExecuteScalarAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(failure);

        var actual = await Assert.ThrowsAsync<InvalidOperationException>(() => harness.Writer.TrySaveAsync(Placement(2), 1, CancellationToken.None));
        Assert.Same(failure, actual);
        Assert.True(harness.ConnectionDisposed);
        Assert.True(harness.CommandDisposed);
    }

    [Fact]
    public async Task Caller_cancellation_wins_after_noncooperative_provider_result()
    {
        using var harness = new Harness(true);
        using var cancellation = new CancellationTokenSource();
        harness.Command.Setup(command => command.ExecuteScalarAsync(It.IsAny<CancellationToken>()))
            .Returns(() => { cancellation.Cancel(); return Task.FromResult<object?>(true); });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => harness.Writer.TrySaveAsync(Placement(2), 1, cancellation.Token));
        Assert.True(harness.ConnectionDisposed);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Options_are_validated_before_any_connection(string? command)
    {
        var options = new TenantCatalogReadOptions { CommandTimeoutSeconds = command is null ? 0 : 1, LookupTimeoutSeconds = 1 };
        if (command == "") options = new TenantCatalogReadOptions { CommandTimeoutSeconds = 2, LookupTimeoutSeconds = 1 };
        var factory = Mock.Of<ITenantCatalogConnectionFactory>();
        Assert.ThrowsAny<ArgumentException>(() => new AzureSqlTenantCatalogWriter(factory, Options.Create(options), TimeProvider.System));
    }

    private static TenantPlacement Placement(long version)
        => new(TenantId, TenantIsolation.Schema, "sql-01", "org_248f574e", "southeastasia", version, TenantLifecycle.Active);

    private sealed class Harness : IDisposable
    {
        private readonly SqlCommand _parameterOwner = new();
        public Harness(object scalar)
        {
            Command.SetupAllProperties();
            Command.Protected().Setup<DbParameterCollection>("DbParameterCollection").Returns(Parameters);
            Command.Protected().Setup<DbParameter>("CreateDbParameter").Returns(() => new SqlParameter());
            Command.Setup(command => command.ExecuteScalarAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(scalar);
            Command.Setup(command => command.DisposeAsync()).Callback(() => CommandDisposed = true).Returns(ValueTask.CompletedTask);
            Connection.Protected().Setup<DbCommand>("CreateDbCommand").Returns(Command.Object);
            Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            Connection.Setup(connection => connection.DisposeAsync()).Callback(() => ConnectionDisposed = true).Returns(ValueTask.CompletedTask);
            Factory.Setup(factory => factory.CreateConnection()).Returns(Connection.Object);
            Writer = new AzureSqlTenantCatalogWriter(Factory.Object,
                Options.Create(new TenantCatalogReadOptions { CommandTimeoutSeconds = 7, LookupTimeoutSeconds = 11 }), TimeProvider.System);
        }
        public AzureSqlTenantCatalogWriter Writer { get; }
        public Mock<ITenantCatalogConnectionFactory> Factory { get; } = new();
        public Mock<DbConnection> Connection { get; } = new();
        public Mock<DbCommand> Command { get; } = new();
        public DbParameterCollection Parameters => _parameterOwner.Parameters;
        public bool ConnectionDisposed { get; private set; }
        public bool CommandDisposed { get; private set; }
        public void Dispose() { _parameterOwner.Dispose(); }
    }
}
