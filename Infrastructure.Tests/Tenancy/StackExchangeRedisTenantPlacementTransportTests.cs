using Application.Tenancy;
using Infrastructure.Tenancy.Caching;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.Tests.Tenancy;

public sealed class StackExchangeRedisTenantPlacementTransportTests
{
    [Fact]
    public async Task GetReadsVersionAndPayloadFromPrimaryAsOneHashOperation()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        var payload = new byte[] { 1, 2, 3 };
        db.Setup(database => database.HashGetAsync(
                "placement-key", It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { "7", payload });
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, TimeProvider.System);

        var result = await sut.GetAsync("placement-key", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(7, result.Version);
        Assert.Equal(payload, result.Payload);
        db.Verify(database => database.HashGetAsync(
            "placement-key", It.Is<RedisValue[]>(fields => fields.Length == 2), CommandFlags.DemandMaster), Times.Once);
    }

    [Fact]
    public async Task GetTreatsAnAbsentHashAsMissing()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        db.Setup(database => database.HashGetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { RedisValue.Null, RedisValue.Null });
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, TimeProvider.System);

        Assert.Null(await sut.GetAsync("missing", CancellationToken.None));
    }

    [Fact]
    public async Task GetRejectsIncompleteOrMalformedHash()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        db.Setup(database => database.HashGetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { "invalid", RedisValue.Null });
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, TimeProvider.System);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.GetAsync("corrupt", CancellationToken.None));
    }

    [Fact]
    public async Task SetUsesPrimaryAtomicCompareAndSetAndCarriesExpiry()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        RedisKey[]? keys = null;
        RedisValue[]? values = null;
        db.Setup(database => database.ScriptEvaluateAsync(
                It.IsAny<string>(), It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .Callback<string, RedisKey[], RedisValue[], CommandFlags>((_, scriptKeys, scriptValues, _) =>
            {
                keys = scriptKeys;
                values = scriptValues;
            })
            .ReturnsAsync(RedisResult.Create((RedisValue)1L));
        var clock = new FixedTimeProvider(new DateTimeOffset(2030, 1, 2, 3, 4, 5, TimeSpan.Zero));
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, clock);
        var expiresAt = clock.GetUtcNow().AddSeconds(31.1);
        var entry = new RedisTenantPlacementEntry(9, [4, 5, 6]);

        Assert.True(await sut.SetIfNewerAsync("placement-key", entry, expiresAt, CancellationToken.None));

        Assert.Equal("placement-key", (string?)keys![0]);
        Assert.Equal("9", values![0].ToString());
        Assert.Equal(entry.Payload, (byte[]?)values[1]);
        Assert.Equal(expiresAt.ToUnixTimeMilliseconds(), (long)values[2]);
        db.Verify(database => database.ScriptEvaluateAsync(
            It.IsAny<string>(),
            It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster), Times.Once);
    }

    [Fact]
    public async Task SetReturnsFalseForAtomicStaleWrite()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        db.Setup(database => database.ScriptEvaluateAsync(
                It.IsAny<string>(), It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(RedisResult.Create((RedisValue)0L));
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, TimeProvider.System);

        Assert.False(await sut.SetIfNewerAsync("placement-key",
            new RedisTenantPlacementEntry(1, [1]), DateTimeOffset.UtcNow.AddMinutes(1), CancellationToken.None));
    }

    [Fact]
    public async Task SetRejectsExpiredEntryBeforeRedisCall()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        var clock = new FixedTimeProvider(DateTimeOffset.UtcNow);
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, clock);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => sut.SetIfNewerAsync("placement-key",
            new RedisTenantPlacementEntry(1, [1]), clock.GetUtcNow(), CancellationToken.None));
        db.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RemoveDeletesOnlyTheRequestedKeyOnPrimary()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var multiplexer = CreateMultiplexer(db);
        db.Setup(database => database.KeyDeleteAsync("placement-key", CommandFlags.DemandMaster)).ReturnsAsync(true);
        var sut = new StackExchangeRedisTenantPlacementTransport(multiplexer.Object, TimeProvider.System);

        await sut.RemoveAsync("placement-key", CancellationToken.None);

        db.Verify(database => database.KeyDeleteAsync("placement-key", CommandFlags.DemandMaster), Times.Once);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("+1")]
    [InlineData("01")]
    [InlineData(" 1")]
    [InlineData("1 ")]
    [InlineData("1.0")]
    [InlineData("9223372036854775808")]
    public async Task GetRejectsNoncanonicalOrOutOfRangeRevisions(string revision)
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(database => database.HashGetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { revision, new byte[] { 1 } });
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.GetAsync("key", CancellationToken.None));
    }

    [Theory]
    [InlineData(9007199254740993L)]
    [InlineData(long.MaxValue)]
    public async Task GetPreservesLargeRevisionsExactly(long revision)
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(database => database.HashGetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { revision, new byte[] { 1 } });
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        var entry = await sut.GetAsync("key", CancellationToken.None);

        Assert.Equal(revision, entry!.Version);
    }

    [Fact]
    public async Task GetRejectsEmptyPayload()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(database => database.HashGetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(new RedisValue[] { "1", Array.Empty<byte>() });
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.GetAsync("key", CancellationToken.None));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(-2)]
    [InlineData(42)]
    public async Task SetRejectsCorruptionConflictsAndUnexpectedResults(int result)
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(database => database.ScriptEvaluateAsync(
                It.IsAny<string>(), It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ReturnsAsync(RedisResult.Create((RedisValue)result));
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.SetIfNewerAsync(
            "key", new(1, [1]), DateTimeOffset.UtcNow.AddMinutes(1), CancellationToken.None));
    }

    [Theory]
    [InlineData("get")]
    [InlineData("set")]
    [InlineData("remove")]
    public async Task CommandsStopWaitingWhenCallerCancels(string operation)
    {
        var db = CreateNeverCompletingDatabase();
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);
        using var cancellation = new CancellationTokenSource();
        var pending = RunOperation(sut, operation, cancellation.Token);

        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Theory]
    [InlineData("get")]
    [InlineData("set")]
    [InlineData("remove")]
    public async Task CommandsHaveABoundedWaitEvenWithoutCallerCancellation(string operation)
    {
        var db = CreateNeverCompletingDatabase();
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System,
            commandTimeout: TimeSpan.FromMilliseconds(10));

        var error = await Assert.ThrowsAsync<TenantPlacementCacheUnavailableException>(() => RunOperation(sut, operation, CancellationToken.None))
            .WaitAsync(TimeSpan.FromSeconds(5));

        Assert.IsType<TimeoutException>(error.InnerException);
    }

    [Fact]
    public async Task DoesNotReclassifyADependencyTimeoutAsItsOwnWaitBudget()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var expected = new TimeoutException("Unrelated dependency failure");
        db.Setup(database => database.HashGetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .ThrowsAsync(expected);
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        var actual = await Assert.ThrowsAsync<TimeoutException>(() => sut.GetAsync("key", CancellationToken.None));

        Assert.Same(expected, actual);
    }

    [Theory]
    [InlineData("get")]
    [InlineData("set")]
    [InlineData("remove")]
    public async Task PreCancelledCommandsDoNotContactRedis(string operation)
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, TimeProvider.System);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => RunOperation(sut, operation, new CancellationToken(true)));

        db.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(60001)]
    public void RejectsInvalidCommandTimeoutBeforeCreatingDatabase(int milliseconds)
    {
        var multiplexer = new Mock<IConnectionMultiplexer>(MockBehavior.Strict);

        Assert.Throws<ArgumentOutOfRangeException>(() => new StackExchangeRedisTenantPlacementTransport(
            multiplexer.Object, TimeProvider.System, commandTimeout: TimeSpan.FromMilliseconds(milliseconds)));

        multiplexer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RejectsExpiryThatRoundsDownToCurrentMillisecond()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        var clock = new FixedTimeProvider(DateTimeOffset.FromUnixTimeMilliseconds(1900000000000));
        var sut = new StackExchangeRedisTenantPlacementTransport(CreateMultiplexer(db).Object, clock);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => sut.SetIfNewerAsync(
            "key", new(1, [1]), clock.GetUtcNow().AddTicks(1), CancellationToken.None));

        db.VerifyNoOtherCalls();
    }

    private static Mock<IDatabase> CreateNeverCompletingDatabase()
    {
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(database => database.HashGetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .Returns(new TaskCompletionSource<RedisValue[]>(TaskCreationOptions.RunContinuationsAsynchronously).Task);
        db.Setup(database => database.ScriptEvaluateAsync(It.IsAny<string>(), It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.DemandMaster))
            .Returns(new TaskCompletionSource<RedisResult>(TaskCreationOptions.RunContinuationsAsynchronously).Task);
        db.Setup(database => database.KeyDeleteAsync(It.IsAny<RedisKey>(), CommandFlags.DemandMaster))
            .Returns(new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously).Task);
        return db;
    }

    private static Task RunOperation(StackExchangeRedisTenantPlacementTransport sut, string operation, CancellationToken cancellationToken) => operation switch
    {
        "get" => sut.GetAsync("key", cancellationToken),
        "set" => sut.SetIfNewerAsync("key", new(1, [1]), DateTimeOffset.UtcNow.AddMinutes(1), cancellationToken),
        "remove" => sut.RemoveAsync("key", cancellationToken),
        _ => throw new ArgumentOutOfRangeException(nameof(operation))
    };

    private static Mock<IConnectionMultiplexer> CreateMultiplexer(Mock<IDatabase> database)
    {
        var multiplexer = new Mock<IConnectionMultiplexer>(MockBehavior.Strict);
        multiplexer.Setup(value => value.GetDatabase(-1, null)).Returns(database.Object);
        return multiplexer;
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
