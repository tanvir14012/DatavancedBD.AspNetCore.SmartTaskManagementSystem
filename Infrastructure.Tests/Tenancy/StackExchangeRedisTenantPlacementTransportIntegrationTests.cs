using Infrastructure.Tenancy.Caching;
using StackExchange.Redis;

namespace Infrastructure.Tests.Tenancy;

/// <summary>
/// Exercises the real Lua program, including Int64 boundaries and concurrent publishers.
/// Set SAAS_TEST_REDIS_CONNECTION to an isolated Redis 7+ test service to enable these tests.
/// Every test uses unique keys and deletes only its own keys; no database flush is performed.
/// </summary>
public sealed class StackExchangeRedisTenantPlacementTransportIntegrationTests
{
    [RedisFact]
    public async Task RevisionComparisonPreservesAdjacentInt64ValuesAndDecimalLengthBoundaries()
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        var expires = DateTimeOffset.UtcNow.AddMinutes(1);
        long[] revisions = [1, 9, 10, 99, 100, 9007199254740992, 9007199254740993, long.MaxValue - 1, long.MaxValue];

        foreach (var revision in revisions)
        {
            Assert.True(await redis.Transport.SetIfNewerAsync(key, new(revision, [1, 2]), expires, CancellationToken.None));
            Assert.Equal(revision, (await redis.Transport.GetAsync(key, CancellationToken.None))!.Version);
        }

        Assert.False(await redis.Transport.SetIfNewerAsync(key, new(long.MaxValue - 1, [3]), expires, CancellationToken.None));
        Assert.Equal(long.MaxValue, (await redis.Transport.GetAsync(key, CancellationToken.None))!.Version);
    }

    [RedisFact]
    public async Task ConcurrentPublishersLeaveTheHighestRevisionAndItsPayload()
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        var expires = DateTimeOffset.UtcNow.AddMinutes(1);
        const long firstRevision = 9007199254740992;

        await Task.WhenAll(Enumerable.Range(1, 64).Reverse().Select(index =>
            redis.Transport.SetIfNewerAsync(key, new(firstRevision + index, [(byte)index]), expires, CancellationToken.None)));

        var stored = await redis.Transport.GetAsync(key, CancellationToken.None);
        Assert.Equal(firstRevision + 64, stored!.Version);
        Assert.Equal(new byte[] { 64 }, stored.Payload);
    }

    [RedisFact]
    public async Task SameRevisionRetriesDoNotExtendExpiryAndConflictingPayloadsFailClosed()
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        var expires = DateTimeOffset.UtcNow.AddMinutes(1).AddTicks(6789);
        var entry = new RedisTenantPlacementEntry(7, [0, 1, 255]);
        Assert.True(await redis.Transport.SetIfNewerAsync(key, entry, expires, CancellationToken.None));

        Assert.False(await redis.Transport.SetIfNewerAsync(key, entry, expires.AddMinutes(1), CancellationToken.None));
        await Assert.ThrowsAsync<InvalidDataException>(() => redis.Transport.SetIfNewerAsync(
            key, new(7, [0, 1, 254]), expires.AddMinutes(1), CancellationToken.None));

        var stored = await redis.Transport.GetAsync(key, CancellationToken.None);
        Assert.Equal(entry.Version, stored!.Version);
        Assert.Equal(entry.Payload, stored.Payload);
        Assert.Equal(expires.ToUnixTimeMilliseconds(), (long)await redis.Database.ExecuteAsync("PEXPIRETIME", key));
    }

    [RedisFact]
    public async Task ExpirationUsesTheAbsoluteDeadlineRatherThanClientElapsedTime()
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        var clientClock = new FixedTimeProvider(DateTimeOffset.UtcNow.AddSeconds(-20));
        var transport = new StackExchangeRedisTenantPlacementTransport(redis.Multiplexer, clientClock);
        var expires = DateTimeOffset.UtcNow.AddSeconds(30).AddTicks(6789);

        Assert.True(await transport.SetIfNewerAsync(key, new(1, [1]), expires, CancellationToken.None));

        Assert.Equal(expires.ToUnixTimeMilliseconds(), (long)await redis.Database.ExecuteAsync("PEXPIRETIME", key));
    }

    [RedisFact]
    public async Task RedisRejectsADeadlineThatExpiredAfterTheClientsTimeCheck()
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        var clientClock = new FixedTimeProvider(DateTimeOffset.UtcNow.AddHours(-1));
        var transport = new StackExchangeRedisTenantPlacementTransport(redis.Multiplexer, clientClock);

        Assert.False(await transport.SetIfNewerAsync(key, new(1, [1]), clientClock.GetUtcNow().AddMinutes(1), CancellationToken.None));

        Assert.False(await redis.Database.KeyExistsAsync(key));
    }

    [RedisTheory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("+1")]
    [InlineData("01")]
    [InlineData("1.0")]
    [InlineData("9223372036854775808")]
    [InlineData("99999999999999999999")]
    public async Task InvalidStoredRevisionCannotBeSilentlyReplaced(string revision)
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        await redis.Database.HashSetAsync(key, [new("version", revision), new("payload", new byte[] { 1 })]);

        await Assert.ThrowsAsync<InvalidDataException>(() => redis.Transport.SetIfNewerAsync(
            key, new(long.MaxValue, [2]), DateTimeOffset.UtcNow.AddMinutes(1), CancellationToken.None));

        Assert.Equal(revision, (string?)await redis.Database.HashGetAsync(key, "version"));
    }

    [RedisTheory]
    [InlineData("wrong-type")]
    [InlineData("missing-payload")]
    [InlineData("missing-version")]
    [InlineData("empty-payload")]
    [InlineData("extra-field")]
    public async Task MalformedExistingRecordsFailClosedEvenWhenTheIncomingRevisionIsNewer(string scenario)
    {
        await using var redis = await IsolatedRedis.ConnectAsync();
        var key = redis.CreateKey();
        switch (scenario)
        {
            case "wrong-type":
                await redis.Database.StringSetAsync(key, "not-a-hash");
                break;
            case "missing-payload":
                await redis.Database.HashSetAsync(key, "version", "1");
                break;
            case "missing-version":
                await redis.Database.HashSetAsync(key, "payload", "data");
                break;
            case "empty-payload":
                await redis.Database.HashSetAsync(key, [new("version", "1"), new("payload", "")]);
                break;
            case "extra-field":
                await redis.Database.HashSetAsync(key, [new("version", "1"), new("payload", "data"), new("unexpected", "field")]);
                break;
        }

        await Assert.ThrowsAsync<InvalidDataException>(() => redis.Transport.SetIfNewerAsync(
            key, new(2, [1]), DateTimeOffset.UtcNow.AddMinutes(1), CancellationToken.None));
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class IsolatedRedis(ConnectionMultiplexer multiplexer) : IAsyncDisposable
    {
        private readonly List<RedisKey> _ownedKeys = [];
        public ConnectionMultiplexer Multiplexer { get; } = multiplexer;
        public IDatabase Database { get; } = multiplexer.GetDatabase();
        public StackExchangeRedisTenantPlacementTransport Transport { get; } = new(multiplexer, TimeProvider.System);

        public static async Task<IsolatedRedis> ConnectAsync()
        {
            var options = ConfigurationOptions.Parse(Environment.GetEnvironmentVariable("SAAS_TEST_REDIS_CONNECTION")!);
            options.AbortOnConnectFail = true;
            options.ConnectTimeout = 3000;
            options.AsyncTimeout = 3000;
            return new(await ConnectionMultiplexer.ConnectAsync(options));
        }

        public string CreateKey()
        {
            var key = $"saas-tests:placement-transport:{Guid.NewGuid():N}";
            _ownedKeys.Add(key);
            return key;
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                if (_ownedKeys.Count > 0)
                    await Task.WhenAll(_ownedKeys.Select(key => Database.KeyDeleteAsync(key)));
            }
            finally
            {
                await Multiplexer.CloseAsync();
                Multiplexer.Dispose();
            }
        }
    }
}

/// <summary>Opt-in real Redis test; absence is reported as skipped rather than passed.</summary>
public sealed class RedisFactAttribute : FactAttribute
{
    public RedisFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SAAS_TEST_REDIS_CONNECTION")))
            Skip = "Set SAAS_TEST_REDIS_CONNECTION to an isolated Redis 7+ service to exercise the Lua transport.";
    }
}

/// <summary>Opt-in real Redis data-driven test.</summary>
public sealed class RedisTheoryAttribute : TheoryAttribute
{
    public RedisTheoryAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SAAS_TEST_REDIS_CONNECTION")))
            Skip = "Set SAAS_TEST_REDIS_CONNECTION to an isolated Redis 7+ service to exercise the Lua transport.";
    }
}
