using Application.Tenancy;
using Infrastructure.Caching.Options;
using Infrastructure.Caching.Serialization;
using Infrastructure.Tenancy.Caching;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Tests.Tenancy;

public sealed class RedisTenantPlacementCacheTests
{
    private static readonly Guid TenantId = Guid.Parse("37c5c9f0-d3a2-4c6f-8bf6-7c5f075f6c2d");
    private static readonly Guid OtherTenantId = Guid.Parse("a542b6a3-1c8c-4aaf-9dc1-5c22f75c7e70");

    [Fact]
    public void ConstructorRejectsMissingDependenciesAndInvalidOptions()
    {
        var transport = new FakeTransport(new TestTimeProvider(DateTimeOffset.UtcNow));
        var serializer = CreateSerializer();
        var options = Options.Create(new TenantPlacementCacheOptions());

        Assert.Throws<ArgumentNullException>("transport", () => Create(null!, serializer, options));
        Assert.Throws<ArgumentNullException>("serializer", () => Create(transport, null!, options));
        Assert.Throws<ArgumentNullException>("options", () => Create(transport, serializer, null!));
        Assert.Throws<ArgumentNullException>("timeProvider", () => new RedisTenantPlacementCache(transport, serializer, options, null!));

        Assert.Throws<ArgumentOutOfRangeException>(() => Create(
            transport, serializer, Options.Create(new TenantPlacementCacheOptions { AbsoluteExpiration = TimeSpan.Zero })));
        Assert.Throws<ArgumentOutOfRangeException>(() => Create(
            transport, serializer, Options.Create(new TenantPlacementCacheOptions { MaxPayloadBytes = 128 })));
        Assert.Throws<ArgumentException>(() => Create(
            transport, serializer, Options.Create(new TenantPlacementCacheOptions { KeyPrefix = "stms:prod" })));
    }

    [Fact]
    public async Task MissingEntryReturnsNullWithoutPublication()
    {
        using var fixture = new Fixture();

        Assert.Null(await fixture.Subject.GetAsync(TenantId, fixture.Token));

        Assert.Equal("stms:tenant-placement:37c5c9f0d3a24c6f8bf67c5f075f6c2d", fixture.Transport.LastKey);
        Assert.Equal(1, fixture.Transport.GetCalls);
        Assert.Equal(0, fixture.Transport.SetCalls);
    }

    [Fact]
    public async Task SetAndGetRoundTripPreservesRevisionAndExpiryBoundary()
    {
        using var fixture = new Fixture();
        var placement = Placement(version: 7, lifecycle: TenantLifecycle.Moving);

        await fixture.Subject.SetAsync(placement, fixture.Token);

        Assert.Equal(1, fixture.Transport.SetCalls);
        Assert.Equal(7, fixture.Transport.LastEntry?.Version);
        Assert.Equal(fixture.Clock.GetUtcNow().Add(fixture.Options.AbsoluteExpiration), fixture.Transport.LastExpiry);
        var result = await fixture.Subject.GetAsync(TenantId, fixture.Token);

        Assert.NotNull(result);
        Assert.Equal(placement, result);
        Assert.Equal(TenantLifecycle.Moving, result.Lifecycle);
    }

    [Fact]
    public async Task ExpiredEntryIsTreatedAsCacheMiss()
    {
        using var fixture = new Fixture();
        await fixture.Subject.SetAsync(Placement(), fixture.Token);

        fixture.Clock.Advance(fixture.Options.AbsoluteExpiration);

        Assert.Null(await fixture.Subject.GetAsync(TenantId, fixture.Token));
        Assert.Empty(fixture.Transport.Entries);
    }

    [Fact]
    public async Task AtomicTransportDoesNotAllowOlderRevisionToReplaceNewerRevision()
    {
        using var fixture = new Fixture();
        var newer = Placement(version: 9);
        var older = Placement(version: 8);

        await fixture.Subject.SetAsync(newer, fixture.Token);
        await fixture.Subject.SetAsync(older, fixture.Token);

        Assert.Equal(newer, await fixture.Subject.GetAsync(TenantId, fixture.Token));
        Assert.Equal(2, fixture.Transport.SetCalls);
        Assert.Equal(9, fixture.Transport.Entries.Single().Value.Entry.Version);
    }

    [Fact]
    public async Task InvalidateRemovesOnlyTheRequestedOrganizationKey()
    {
        using var fixture = new Fixture();
        await fixture.Subject.SetAsync(Placement(), fixture.Token);
        await fixture.Subject.SetAsync(Placement(OtherTenantId), fixture.Token);

        await fixture.Subject.InvalidateAsync(TenantId, fixture.Token);

        Assert.Null(await fixture.Subject.GetAsync(TenantId, fixture.Token));
        Assert.Equal(Placement(OtherTenantId), await fixture.Subject.GetAsync(OtherTenantId, fixture.Token));
        Assert.Equal(1, fixture.Transport.RemoveCalls);
    }

    [Fact]
    public async Task GetRejectsEmptyIdentityBeforeTransportAccess()
    {
        using var fixture = new Fixture();

        await Assert.ThrowsAsync<ArgumentException>("tenantId", () => fixture.Subject.GetAsync(Guid.Empty, fixture.Token));
        Assert.Equal(0, fixture.Transport.GetCalls);
    }

    [Fact]
    public async Task SetRejectsNullOrEmptyPlacementBeforeTransportAccess()
    {
        using var fixture = new Fixture();

        await Assert.ThrowsAsync<ArgumentNullException>("placement", () => fixture.Subject.SetAsync(null!, fixture.Token));
        await Assert.ThrowsAsync<ArgumentException>("tenantId", () => fixture.Subject.SetAsync(
            Placement(Guid.Empty), fixture.Token));
        Assert.Equal(0, fixture.Transport.SetCalls);
    }

    [Fact]
    public async Task GetRejectsCorruptPayloadWithoutClassifyingItAsTransportOutage()
    {
        using var fixture = new Fixture();
        fixture.Transport.Entries[fixture.Key(TenantId)] = new(new RedisTenantPlacementEntry(7, [0x01, 0x02, 0x03]), DateTimeOffset.MaxValue);

        var error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.GetAsync(TenantId, fixture.Token));

        Assert.Contains("valid JSON", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetRejectsPayloadForAnotherOrganization()
    {
        using var fixture = new Fixture();
        var payload = fixture.Serializer.Serialize(Placement(OtherTenantId));
        fixture.Transport.Entries[fixture.Key(TenantId)] = new(new RedisTenantPlacementEntry(7, payload), DateTimeOffset.MaxValue);

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.GetAsync(TenantId, fixture.Token));
    }

    [Fact]
    public async Task GetRejectsRevisionThatDoesNotMatchPayload()
    {
        using var fixture = new Fixture();
        var payload = fixture.Serializer.Serialize(Placement(version: 8));
        fixture.Transport.Entries[fixture.Key(TenantId)] = new(new RedisTenantPlacementEntry(7, payload), DateTimeOffset.MaxValue);

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.GetAsync(TenantId, fixture.Token));
    }

    [Fact]
    public async Task GetRejectsIncompleteOrOversizedEntries()
    {
        using var fixture = new Fixture();
        fixture.Transport.Entries[fixture.Key(TenantId)] = new(new RedisTenantPlacementEntry(0, []), DateTimeOffset.MaxValue);
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.GetAsync(TenantId, fixture.Token));

        fixture.Transport.Entries[fixture.Key(TenantId)] = new(new RedisTenantPlacementEntry(7,
            new byte[fixture.Options.MaxPayloadBytes + 1]), DateTimeOffset.MaxValue);
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.GetAsync(TenantId, fixture.Token));
    }

    [Fact]
    public async Task SetRejectsPayloadProducedAboveConfiguredLimit()
    {
        using var fixture = new Fixture(maxPayloadBytes: 256);
        fixture.Serializer.SerializeOverride = _ => new byte[257];

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Subject.SetAsync(Placement(), fixture.Token));
        Assert.Equal(0, fixture.Transport.SetCalls);
    }

    [Theory]
    [InlineData("get")]
    [InlineData("set")]
    [InlineData("remove")]
    public async Task RedisTransportFailuresAreClassifiedAsCacheUnavailable(string operation)
    {
        using var fixture = new Fixture();
        var failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "private endpoint");
        fixture.Transport.Failure = failure;

        var error = await Assert.ThrowsAsync<TenantPlacementCacheUnavailableException>(async () =>
        {
            switch (operation)
            {
                case "get": _ = await fixture.Subject.GetAsync(TenantId, fixture.Token); break;
                case "set": await fixture.Subject.SetAsync(Placement(), fixture.Token); break;
                default: await fixture.Subject.InvalidateAsync(TenantId, fixture.Token); break;
            }
        });

        Assert.Same(failure, error.InnerException);
    }

    [Fact]
    public async Task AlreadyClassifiedTransportFailureIsPreserved()
    {
        using var fixture = new Fixture();
        var failure = new TenantPlacementCacheUnavailableException();
        fixture.Transport.Failure = failure;

        var error = await Assert.ThrowsAsync<TenantPlacementCacheUnavailableException>(
            () => fixture.Subject.GetAsync(TenantId, fixture.Token));

        Assert.Same(failure, error);
    }

    [Fact]
    public async Task ServerErrorsAreNotReclassifiedAsTransportOutages()
    {
        using var fixture = new Fixture();
        var failure = new RedisServerException("ERR malformed command");
        fixture.Transport.Failure = failure;

        var error = await Assert.ThrowsAsync<RedisServerException>(
            () => fixture.Subject.GetAsync(TenantId, fixture.Token));

        Assert.Same(failure, error);
    }

    [Fact]
    public async Task CancellationIsObservedAfterNoncooperativeTransportCompletes()
    {
        using var fixture = new Fixture();
        var completion = new TaskCompletionSource<RedisTenantPlacementEntry?>(TaskCreationOptions.RunContinuationsAsynchronously);
        fixture.Transport.GetResult = completion.Task;

        var lookup = fixture.Subject.GetAsync(TenantId, fixture.Token);
        fixture.Cancellation.Cancel();
        completion.SetResult(null);

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => lookup);
        Assert.Equal(fixture.Token, error.CancellationToken);
    }

    [Fact]
    public async Task CancellationIsObservedAfterNoncooperativeWriteCompletes()
    {
        using var fixture = new Fixture();
        var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        fixture.Transport.SetResult = completion.Task;

        var write = fixture.Subject.SetAsync(Placement(), fixture.Token);
        fixture.Cancellation.Cancel();
        completion.SetResult(true);

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => write);
        Assert.Equal(fixture.Token, error.CancellationToken);
    }

    [Fact]
    public async Task CancellationIsObservedAfterNoncooperativeInvalidationCompletes()
    {
        using var fixture = new Fixture();
        var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        fixture.Transport.RemoveResult = completion.Task;

        var remove = fixture.Subject.InvalidateAsync(TenantId, fixture.Token);
        fixture.Cancellation.Cancel();
        completion.SetResult(true);

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => remove);
        Assert.Equal(fixture.Token, error.CancellationToken);
    }

    private static ICacheSerializer CreateSerializer()
        => new SystemTextJsonCacheSerializer(Options.Create(new CachingOptions { EnableCompression = false }));

    private static TenantPlacement Placement(
        Guid? tenantId = null, long version = 7, TenantLifecycle lifecycle = TenantLifecycle.Active)
        => new(tenantId ?? TenantId, TenantIsolation.Database, "sql-group-01", null, "southeastasia", version, lifecycle);

    private static RedisTenantPlacementCache Create(
        IRedisTenantPlacementTransport transport,
        ICacheSerializer serializer,
        IOptions<TenantPlacementCacheOptions> options,
        TimeProvider? timeProvider = null)
        => new(transport, serializer, options, timeProvider ?? TimeProvider.System);

    private sealed class Fixture : IDisposable
    {
        public TestTimeProvider Clock { get; } = new(new DateTimeOffset(2030, 1, 2, 3, 4, 5, TimeSpan.Zero));
        public TenantPlacementCacheOptions Options { get; }
        public RecordingSerializer Serializer { get; } = new(CreateSerializer());
        public FakeTransport Transport { get; }
        public CancellationTokenSource Cancellation { get; } = new();
        public CancellationToken Token => Cancellation.Token;
        public RedisTenantPlacementCache Subject { get; }

        public Fixture(int maxPayloadBytes = 32 * 1024)
        {
            Options = new TenantPlacementCacheOptions { MaxPayloadBytes = maxPayloadBytes };
            Transport = new(Clock);
            Subject = Create(Transport, Serializer, Microsoft.Extensions.Options.Options.Create(Options), Clock);
        }

        public string Key(Guid tenantId) => $"{Options.KeyPrefix}:tenant-placement:{tenantId:N}";

        public void Dispose() => Cancellation.Dispose();
    }

    private sealed class RecordingSerializer(ICacheSerializer inner) : ICacheSerializer
    {
        public Func<object, byte[]>? SerializeOverride { get; set; }
        public byte[] Serialize<T>(T value) => SerializeOverride?.Invoke(value!) ?? inner.Serialize(value);
        public T? Deserialize<T>(byte[] bytes) => inner.Deserialize<T>(bytes);
    }

    private sealed class FakeTransport(TestTimeProvider clock) : IRedisTenantPlacementTransport
    {
        public Dictionary<string, StoredEntry> Entries { get; } = new(StringComparer.Ordinal);
        public Exception? Failure { get; set; }
        public Task<RedisTenantPlacementEntry?>? GetResult { get; set; }
        public Task<bool>? SetResult { get; set; }
        public Task<bool>? RemoveResult { get; set; }
        public string? LastKey { get; private set; }
        public RedisTenantPlacementEntry? LastEntry { get; private set; }
        public DateTimeOffset LastExpiry { get; private set; }
        public int GetCalls { get; private set; }
        public int SetCalls { get; private set; }
        public int RemoveCalls { get; private set; }

        public async Task<RedisTenantPlacementEntry?> GetAsync(string key, CancellationToken cancellationToken)
        {
            LastKey = key;
            GetCalls++;
            if (Failure is not null) throw Failure;
            if (GetResult is not null) return await GetResult.ConfigureAwait(false);
            if (!Entries.TryGetValue(key, out var stored)) return null;
            if (stored.ExpiresAtUtc <= clock.GetUtcNow())
            {
                Entries.Remove(key);
                return null;
            }
            return new(stored.Entry.Version, stored.Entry.Payload.ToArray());
        }

        public async Task<bool> SetIfNewerAsync(string key, RedisTenantPlacementEntry entry,
            DateTimeOffset expiresAtUtc, CancellationToken cancellationToken)
        {
            LastKey = key;
            LastEntry = new(entry.Version, entry.Payload.ToArray());
            LastExpiry = expiresAtUtc;
            SetCalls++;
            if (Failure is not null) throw Failure;
            if (SetResult is not null) return await SetResult.ConfigureAwait(false);
            if (Entries.TryGetValue(key, out var current) && current.ExpiresAtUtc > clock.GetUtcNow() &&
                current.Entry.Version >= entry.Version)
                return false;
            Entries[key] = new(new(entry.Version, entry.Payload.ToArray()), expiresAtUtc);
            return true;
        }

        public async Task RemoveAsync(string key, CancellationToken cancellationToken)
        {
            LastKey = key;
            RemoveCalls++;
            if (Failure is not null) throw Failure;
            if (RemoveResult is not null)
            {
                await RemoveResult.ConfigureAwait(false);
                return;
            }
            Entries.Remove(key);
        }

        public sealed record StoredEntry(RedisTenantPlacementEntry Entry, DateTimeOffset ExpiresAtUtc);
    }

    private sealed class TestTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset _utcNow = utcNow;
        public override DateTimeOffset GetUtcNow() => _utcNow;
        public void Advance(TimeSpan amount) => _utcNow = _utcNow.Add(amount);
    }
}
