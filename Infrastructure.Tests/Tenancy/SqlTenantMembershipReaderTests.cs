using System.Data;
using System.Data.Common;
using Application.Tenancy;
using Infrastructure.Tenancy.Authorization;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;

namespace Infrastructure.Tests.Tenancy;

public sealed class SqlTenantMembershipReaderTests
{
    private static readonly Guid TenantId = Guid.Parse("dfc17bd9-eab0-480b-bec4-ed86116f9431");
    private static readonly TenantAccess Access = new(TenantId, "subject-1", "https://identity.example.com");

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Reads_active_and_inactive_membership_and_disposes_resources(bool active)
    {
        using var harness = new Harness(active);

        Assert.Equal(active, await harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.CommandDisposed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Missing_membership_is_denied()
    {
        using var harness = new Harness();

        Assert.False(await harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Uses_fixed_query_and_typed_bounded_parameters_without_interpolation()
    {
        const string subject = "user'; DROP TABLE catalog.TenantMemberships;--";
        const string issuer = "https://identity.example.com/O'Reilly";
        var access = new TenantAccess(TenantId, subject, issuer);
        using var harness = new Harness(true);

        await harness.Membership.IsActiveMemberAsync(access, CancellationToken.None);

        var sql = harness.Command.Object.CommandText;
        Assert.Contains("SELECT TOP (2) [IsActive]", sql);
        Assert.Contains("FROM [catalog].[TenantMemberships]", sql);
        Assert.Contains("[TenantId] = @TenantId AND [Issuer] = @Issuer AND [SubjectId] = @SubjectId", sql);
        Assert.DoesNotContain(TenantId.ToString(), sql);
        Assert.DoesNotContain(subject, sql);
        Assert.DoesNotContain(issuer, sql);
        Assert.DoesNotContain("*", sql);
        Assert.Equal(CommandType.Text, harness.Command.Object.CommandType);
        Assert.Equal(7, harness.Command.Object.CommandTimeout);
        Assert.Equal(3, harness.Parameters.Count);
        AssertParameter(harness, "@TenantId", DbType.Guid, TenantId);
        AssertParameter(harness, "@Issuer", DbType.String, issuer, 256);
        AssertParameter(harness, "@SubjectId", DbType.String, subject, 256);
        Assert.Equal(CommandBehavior.Default, harness.Behavior);
        Assert.True(harness.OpenToken.CanBeCanceled);
        Assert.Equal(harness.OpenToken, harness.ExecuteToken);
    }

    [Fact]
    public async Task Same_subject_in_different_issuer_or_organization_remains_a_distinct_lookup()
    {
        var otherTenantId = Guid.NewGuid();
        var identities = new[]
        {
            Access,
            new TenantAccess(TenantId, Access.SubjectId, "https://other.example.com"),
            new TenantAccess(otherTenantId, Access.SubjectId, Access.Issuer)
        };
        var observedKeys = new HashSet<(Guid, string, string)>();
        foreach (var identity in identities)
        {
            using var harness = new Harness(true);
            await harness.Membership.IsActiveMemberAsync(identity, CancellationToken.None);
            observedKeys.Add(((Guid)harness.Parameters["@TenantId"].Value,
                (string)harness.Parameters["@Issuer"].Value,
                (string)harness.Parameters["@SubjectId"].Value));
        }

        Assert.Equal(identities.Length, observedKeys.Count);
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, true)]
    [InlineData(false, false)]
    public async Task Duplicate_membership_rows_fail_closed_even_if_inactive(bool first, bool second)
    {
        using var harness = new Harness(first, second);

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    public static IEnumerable<object[]> InvalidValues()
    {
        yield return new object[] { DBNull.Value };
        yield return new object[] { 0 };
        yield return new object[] { 1 };
        yield return new object[] { (byte)1 };
        yield return new object[] { "True" };
        yield return new object[] { "secret-membership-value" };
    }

    [Theory]
    [MemberData(nameof(InvalidValues))]
    public async Task Wrong_field_type_is_not_coerced_to_membership(object value)
    {
        using var harness = new Harness(value);

        var exception = await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        Assert.Null(exception.InnerException);
        Assert.DoesNotContain("secret", exception.ToString());
        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    public async Task Unexpected_result_shape_fails_closed(int fieldCount)
    {
        using var harness = new Harness(true);
        var reader = new Mock<DbDataReader>();
        reader.SetupGet(value => value.FieldCount).Returns(fieldCount);
        reader.Setup(value => value.ReadAsync(It.IsAny<CancellationToken>())).ReturnsAsync(true);
        reader.Setup(value => value.DisposeAsync()).Returns(ValueTask.CompletedTask);
        harness.ReturnReader(reader.Object);

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        reader.Verify(value => value.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task Construction_null_and_pre_canceled_requests_do_not_create_connections()
    {
        using var harness = new Harness(true);
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            harness.Membership.IsActiveMemberAsync(null!, CancellationToken.None));
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));
        harness.Factory.Verify(factory => factory.CreateConnection(), Times.Never);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Provider_failures_propagate_and_resources_are_disposed(bool failDuringOpen)
    {
        using var harness = new Harness(true);
        var failure = new InvalidOperationException("Provider failure");
        if (failDuringOpen)
            harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>())).ThrowsAsync(failure);
        else
            harness.Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>()).ThrowsAsync(failure);

        var actual = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        Assert.Same(failure, actual);
        Assert.True(harness.ConnectionDisposed);
        Assert.Equal(!failDuringOpen, harness.CommandDisposed);
    }

    [Fact]
    public async Task Read_failure_propagates_instead_of_granting_or_converting_to_absence()
    {
        using var harness = new Harness(true);
        var failure = new InvalidOperationException("Reader failed");
        var reader = new Mock<DbDataReader>();
        reader.Setup(value => value.ReadAsync(It.IsAny<CancellationToken>())).ThrowsAsync(failure);
        reader.Setup(value => value.DisposeAsync()).Returns(ValueTask.CompletedTask);
        harness.ReturnReader(reader.Object);

        var actual = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None));

        Assert.Same(failure, actual);
        reader.Verify(value => value.DisposeAsync(), Times.Once);
        Assert.True(harness.CommandDisposed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Caller_cancellation_wins_over_noncooperative_open_result_or_failure(bool fail)
    {
        using var harness = new Harness(true);
        using var cancellation = new CancellationTokenSource();
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .Returns(() =>
            {
                cancellation.Cancel();
                return fail ? Task.FromException(new InvalidOperationException("Provider failure")) : Task.CompletedTask;
            });

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
        Assert.True(harness.ConnectionDisposed);
        Assert.Null(harness.Command.Object.CommandText);
    }

    [Fact]
    public async Task Cancellation_after_execute_disposes_returned_reader_without_reading_membership()
    {
        using var harness = new Harness(true);
        using var cancellation = new CancellationTokenSource();
        harness.Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>())
            .Returns(() =>
            {
                cancellation.Cancel();
                return Task.FromResult<DbDataReader>(harness.Reader);
            });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));

        Assert.True(harness.Reader.IsClosed);
        Assert.True(harness.CommandDisposed);
        Assert.True(harness.ConnectionDisposed);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Cancellation_after_each_read_prevents_membership_result(int cancelAtRead)
    {
        using var harness = new Harness(true);
        using var cancellation = new CancellationTokenSource();
        var reader = new Mock<DbDataReader>();
        var readCount = 0;
        reader.SetupGet(value => value.FieldCount).Returns(1);
        reader.Setup(value => value.GetBoolean(0)).Returns(true);
        reader.Setup(value => value.ReadAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken token) =>
            {
                Assert.Equal(harness.OpenToken, token);
                readCount++;
                if (readCount == cancelAtRead)
                    cancellation.Cancel();
                return Task.FromResult(readCount == 1);
            });
        reader.Setup(value => value.DisposeAsync()).Returns(ValueTask.CompletedTask);
        harness.ReturnReader(reader.Object);

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
        reader.Verify(value => value.DisposeAsync(), Times.Once);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Lookup_deadline_cancels_inflight_open_without_real_time_delay()
    {
        var clock = new ManualTimeoutProvider();
        using var harness = new Harness(clock, true);
        var pending = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken token) => pending.Task.WaitAsync(token));

        var lookup = harness.Membership.IsActiveMemberAsync(Access, CancellationToken.None);
        Assert.False(lookup.IsCompleted);
        Assert.Equal(TimeSpan.FromSeconds(11), clock.DueTime);
        clock.Fire();

        await Assert.ThrowsAsync<TimeoutException>(() => lookup);
        Assert.True(harness.ConnectionDisposed);
    }

    [Fact]
    public async Task Caller_cancellation_wins_when_lookup_deadline_and_provider_failure_race()
    {
        var clock = new ManualTimeoutProvider();
        using var harness = new Harness(clock, true);
        using var cancellation = new CancellationTokenSource();
        harness.Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
            .Returns(() =>
            {
                clock.Fire();
                cancellation.Cancel();
                return Task.FromException(new InvalidOperationException("Provider failure"));
            });

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
    }

    [Fact]
    public async Task Cancellation_during_async_disposal_prevents_successful_membership_result()
    {
        using var harness = new Harness(true);
        using var cancellation = new CancellationTokenSource();
        harness.Connection.Setup(connection => connection.DisposeAsync()).Callback(cancellation.Cancel)
            .Returns(ValueTask.CompletedTask);

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            harness.Membership.IsActiveMemberAsync(Access, cancellation.Token));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(121, 180)]
    [InlineData(1, 0)]
    [InlineData(1, 181)]
    [InlineData(12, 11)]
    public void Invalid_budgets_are_rejected(int command, int lookup)
    {
        var options = new TenantCatalogReadOptions { CommandTimeoutSeconds = command, LookupTimeoutSeconds = lookup };
        Assert.ThrowsAny<ArgumentException>(() => new SqlTenantMembershipReader(Mock.Of<ITenantCatalogConnectionFactory>(),
            Options.Create(options), TimeProvider.System));
    }

    private static void AssertParameter(Harness harness, string name, DbType type, object value, int? size = null)
    {
        var parameter = harness.Parameters[name];
        Assert.Equal(type, parameter.DbType);
        Assert.Equal(value, parameter.Value);
        if (size.HasValue)
            Assert.Equal(size.Value, parameter.Size);
    }

    private sealed class Harness : IDisposable
    {
        private readonly DataTable _table = new();
        private readonly SqlCommand _parameterOwner = new();

        public Harness(params object[] values) : this(TimeProvider.System, values) { }

        public Harness(TimeProvider clock, params object[] values)
        {
            _table.Columns.Add("IsActive", typeof(object));
            foreach (var value in values)
                _table.Rows.Add(value);
            Reader = _table.CreateDataReader();
            Command.SetupAllProperties();
            Command.Protected().Setup<DbParameterCollection>("DbParameterCollection").Returns(Parameters);
            Command.Protected().Setup<DbParameter>("CreateDbParameter").Returns(() => new SqlParameter());
            ReturnReader(Reader);
            Command.Setup(command => command.DisposeAsync()).Callback(() => CommandDisposed = true)
                .Returns(ValueTask.CompletedTask);
            Connection.Protected().Setup<DbCommand>("CreateDbCommand").Returns(Command.Object);
            Connection.Setup(connection => connection.OpenAsync(It.IsAny<CancellationToken>()))
                .Callback((CancellationToken token) => OpenToken = token).Returns(Task.CompletedTask);
            Connection.Setup(connection => connection.DisposeAsync()).Callback(() => ConnectionDisposed = true)
                .Returns(ValueTask.CompletedTask);
            Factory.Setup(factory => factory.CreateConnection()).Returns(Connection.Object);
            Membership = new SqlTenantMembershipReader(Factory.Object,
                Options.Create(new TenantCatalogReadOptions { CommandTimeoutSeconds = 7, LookupTimeoutSeconds = 11 }), clock);
        }

        public SqlTenantMembershipReader Membership { get; }
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

        public void ReturnReader(DbDataReader reader) =>
            Command.Protected().Setup<Task<DbDataReader>>("ExecuteDbDataReaderAsync",
                    ItExpr.IsAny<CommandBehavior>(), ItExpr.IsAny<CancellationToken>())
                .Returns((CommandBehavior behavior, CancellationToken token) =>
                {
                    Behavior = behavior;
                    ExecuteToken = token;
                    return Task.FromResult(reader);
                });

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
