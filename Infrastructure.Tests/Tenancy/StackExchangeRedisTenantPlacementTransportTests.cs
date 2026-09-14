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

        Assert.Equal("placement-key", (string)keys![0]);
        Assert.Equal("9", values![0].ToString());
        Assert.Equal(entry.Payload, (byte[])values[1]);
        Assert.Equal("32", values[2].ToString());
        db.Verify(database => database.ScriptEvaluateAsync(
            It.Is<string>(script => script.Contains("currentVersion", StringComparison.Ordinal)),
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
