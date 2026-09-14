using System.Data;
using System.Data.Common;
using Application.Tenancy;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;

namespace Infrastructure.Tests.Tenancy;

public sealed class AzureSqlTenantCatalogTests
{
    private static readonly Guid TenantId = Guid.Parse("dfc17bd9-eab0-480b-bec4-ed86116f9431");

    [Theory]
    [InlineData(TenantIsolation.Database, null)]
    [InlineData(TenantIsolation.Schema, "org_example")]
    [InlineData(TenantIsolation.Row, null)]
    public async Task Find_maps_all_tiers_and_preserves_full_revision(TenantIsolation isolation, string? schema)
    {
        using var harness = new Harness(Row(isolation, schema));
        var result = await harness.Catalog.FindAsync(TenantId, CancellationToken.None);

        Assert.Equal(new TenantPlacement(TenantId, isolation, "target_1", schema, "region-1", long.MaxValue,
            TenantLifecycle.Suspended), result);
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.CommandDisposed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Find_uses_fixed_parameterized_query_and_finite_command_timeout()
    {
        using var harness = new Harness(Row());
        await harness.Catalog.FindAsync(TenantId, CancellationToken.None);

        Assert.Contains("SELECT TOP (2)", harness.Command.Object.CommandText);
        Assert.Contains("FROM [catalog].[TenantPlacements]", harness.Command.Object.CommandText);
        Assert.Contains("WHERE [TenantId] = @TenantId", harness.Command.Object.CommandText);
        Assert.DoesNotContain(TenantId.ToString(), harness.Command.Object.CommandText);
        Assert.DoesNotContain("*", harness.Command.Object.CommandText);
        Assert.Equal(CommandType.Text, harness.Command.Object.CommandType);
        Assert.Equal(7, harness.Command.Object.CommandTimeout);
        var parameter = Assert.IsType<SqlParameter>(Assert.Single(harness.Parameters.Cast<DbParameter>()));
        Assert.Equal("@TenantId", parameter.ParameterName);
        Assert.Equal(DbType.Guid, parameter.DbType);
        Assert.Equal(TenantId, parameter.Value);
        Assert.Equal(CommandBehavior.Default, harness.Behavior);
        Assert.True(harness.OpenToken.CanBeCanceled);
        Assert.Equal(harness.OpenToken, harness.ExecuteToken);
    }

    [Fact]
    public async Task Missing_organization_is_the_only_null_result()
    {
        using var harness = new Harness();
        Assert.Null(await harness.Catalog.FindAsync(TenantId, CancellationToken.None));
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Duplicate_rows_fail_closed()
    {
        using var harness = new Harness(Row(), Row());
        await Assert.ThrowsAsync<InvalidDataException>(() => harness.Catalog.FindAsync(TenantId, CancellationToken.None));
        Assert.True(harness.Reader.IsClosed);
    }

    [Fact]
    public async Task Wrong_organization_fails_closed()
    {
        var row = Row();
        row[0] = Guid.NewGuid();
        using var harness = new Harness(row);
        await Assert.ThrowsAsync<InvalidDataException>(() => harness.Catalog.FindAsync(TenantId, CancellationToken.None));
    }

    public static IEnumerable<object[]> InvalidRows()
    {
        yield return new object[] { 0, Guid.Empty };
        yield return new object[] { 0, "not-a-guid" };
        yield return new object[] { 1, (byte)99 };
        yield return new object[] { 1, 0 };
        yield return new object[] { 2, "Server=secret;Password=hidden" };
        yield return new object[] { 2, DBNull.Value };
        yield return new object[] { 3, "unexpected_schema" };
        yield return new object[] { 4, "bad region" };
        yield return new object[] { 4, DBNull.Value };
        yield return new object[] { 5, 0L };
        yield return new object[] { 5, -1L };
        yield return new object[] { 5, "10" };
        yield return new object[] { 6, (byte)99 };
        yield return new object[] { 6, DBNull.Value };
    }

    [Theory]
    [MemberData(nameof(InvalidRows))]
    public async Task Malformed_catalog_data_fails_closed_without_retaining_values(int ordinal, object value)
    {
        var row = Row();
        row[ordinal] = value;
        using var harness = new Harness(row);
        var exception = await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Catalog.FindAsync(TenantId, CancellationToken.None));

        Assert.Null(exception.InnerException);
        Assert.DoesNotContain("secret", exception.ToString());
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Schema_strategy_requires_schema_in_durable_data()
    {
        using var harness = new Harness(Row(TenantIsolation.Schema));
        await Assert.ThrowsAsync<InvalidDataException>(() => harness.Catalog.FindAsync(TenantId, CancellationToken.None));
    }

    [Fact]
    public async Task Construction_and_invalid_requests_do_not_create_connections()
    {
        using var harness = new Harness(Row());
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
        await Assert.ThrowsAsync<ArgumentException>(() => harness.Catalog.FindAsync(Guid.Empty, CancellationToken.None));
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => harness.Catalog.FindAsync(TenantId, cancellation.Token));
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Sql_failures_propagate_and_resources_are_disposed(bool failDuringOpen)
    {
        using var harness = new Harness(Row());
        var failure = new InvalidOperationException("Provider failure");
        if (failDuringOpen)
            harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>())).ThrowsAsync(failure);
        else
            harness.Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>()).ThrowsAsync(failure);

        var actual = await Assert.ThrowsAsync<InvalidOperationException>(() => harness.Catalog.FindAsync(TenantId, CancellationToken.None));
        Assert.Same(failure, actual);
        Assert.True(harness.ConnectionDisposed);
        Assert.Equal(!failDuringOpen, harness.CommandDisposed);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Caller_cancellation_wins_over_noncooperative_open_result_or_failure(bool fail)
    {
        using var harness = new Harness(Row());
        using var cancellation = new CancellationTokenSource();
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .Returns(() =>
            {
                cancellation.Cancel();
                return fail ? Task.FromException(new InvalidOperationException("Provider failure")) : Task.CompletedTask;
            });

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => harness.Catalog.FindAsync(TenantId, cancellation.Token));
        Assert.Equal(cancellation.Token, exception.CancellationToken);
        Assert.True(harness.ConnectionDisposed);
        Assert.Null(harness.Command.Object.CommandText);
    }

    [Fact]
    public async Task Caller_cancellation_wins_after_noncooperative_execute_and_disposes_returned_reader()
    {
        using var harness = new Harness(Row());
        using var cancellation = new CancellationTokenSource();
        harness.Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>())
            .Returns(() =>
            {
                cancellation.Cancel();
                return Task.FromResult<DbDataReader>(harness.Reader);
            });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => harness.Catalog.FindAsync(TenantId, cancellation.Token));
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.CommandDisposed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Lookup_deadline_cancels_an_inflight_connection_without_real_time_delay()
    {
        var clock = new ManualTimeoutProvider();
        using var harness = new Harness(clock, Row());
        var pending = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken token) => pending.Task.WaitAsync(token));

        var lookup = harness.Catalog.FindAsync(TenantId, CancellationToken.None);
        Assert.False(lookup.IsCompleted);
        Assert.Equal(TimeSpan.FromSeconds(11), clock.DueTime);
        clock.Fire();
        await Assert.ThrowsAsync<TimeoutException>(() => lookup);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Cancellation_during_async_disposal_does_not_return_a_placement()
    {
        using var harness = new Harness(Row());
        using var cancellation = new CancellationTokenSource();
        harness.Connection.Setup(connection => connection.DisposeAsync()).Callback(cancellation.Cancel)
            .Returns(ValueTask.CompletedTask);
        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Catalog.FindAsync(TenantId, cancellation.Token));
        Assert.Equal(cancellation.Token, exception.CancellationToken);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(121, 180)]
    [InlineData(1, 0)]
    [InlineData(1, 181)]
    [InlineData(12, 11)]
    public void Invalid_read_budgets_are_rejected(int command, int lookup)
    {
        var options = new TenantCatalogReadOptions { CommandTimeoutSeconds = command, LookupTimeoutSeconds = lookup };
        Assert.ThrowsAny<ArgumentException>(() => new AzureSqlTenantCatalog(Mock.Of<ITenantCatalogConnectionFactory>(),
            Options.Create(options), TimeProvider.System));
    }

    private static object[] Row(TenantIsolation isolation = TenantIsolation.Row, string? schema = null) =>
        new object[] { TenantId, (byte)isolation, "target_1", schema is null ? DBNull.Value : schema,
            "region-1", long.MaxValue, (byte)TenantLifecycle.Suspended };

    private sealed class Harness : IDisposable
    {
        private readonly DataTable _table = new();
        private readonly SqlCommand _parameterOwner = new();

        public Harness(params object[][] rows) : this(TimeProvider.System, rows) { }

        public Harness(TimeProvider clock, params object[][] rows)
        {
            for (var index = 0; index < 7; index++)
                _table.Columns.Add(index.ToString(), typeof(object));
            foreach (var row in rows)
                _table.Rows.Add(row);
            Reader = _table.CreateDataReader();
            Command.SetupAllProperties();
            Command.Protected().Setup<DbParameterCollection>("DbParameterCollection").Returns(Parameters);
            Command.Protected().Setup<DbParameter>("CreateDbParameter").Returns(() => new SqlParameter());
            Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                    ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>())
                .Returns((CommandBehavior behavior, CancellationToken token) =>
                {
                    Behavior = behavior;
                    ExecuteToken = token;
                    return Task.FromResult<DbDataReader>(Reader);
                });
            Command.Setup(command => command.DisposeAsync()).Callback(() => CommandDisposed = true).Returns(ValueTask.CompletedTask);
            Connection.Protected().Setup<DbCommand>("CreateDbCommand").Returns(Command.Object);
            Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
                .Callback((CancellationToken token) => OpenToken = token).Returns(Task.CompletedTask);
            Connection.Setup(connection => connection.DisposeAsync()).Callback(() => ConnectionDisposed = true).Returns(ValueTask.CompletedTask);
            Factory.Setup(factory => factory.CreateConnection()).Returns(Connection.Object);
            Catalog = new AzureSqlTenantCatalog(Factory.Object,
                Options.Create(new TenantCatalogReadOptions { CommandTimeoutSeconds = 7, LookupTimeoutSeconds = 11 }), clock);
        }

        public AzureSqlTenantCatalog Catalog { get; }
        public Mock<ITenantCatalogConnectionFactory> Factory { get; } = new();
        public Mock<DbConnection> Connection { get; } = new();
        public Mock<DbCommand> Command { get; } = new();
        public DataTableReader Reader { get; }
        public SqlParameterCollection Parameters => _parameterOwner.Parameters;
        public bool ConnectionDisposed { get; private set; }
        public bool CommandDisposed { get; private set; }
        public CancellationToken OpenToken { get; private set; }
        public CancellationToken ExecuteToken { get; private set; }
        public CommandBehavior Behavior { get; private set; }

        public void Dispose()
        {
            Reader.Dispose();
            _parameterOwner.Dispose();
            _table.Dispose();
        }
    }

    private sealed class ManualTimeoutProvider : TimeProvider
    {
        private TimerCallback? _callback;
        private object? _state;
        public TimeSpan DueTime { get; private set; }

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            _callback = callback;
            _state = state;
            DueTime = dueTime;
            return new TimerHandle();
        }

        public void Fire() => _callback!(_state);

        private sealed class TimerHandle : ITimer
        {
            public bool Change(TimeSpan dueTime, TimeSpan period) => true;
            public void Dispose() { }
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        }
    }
}
