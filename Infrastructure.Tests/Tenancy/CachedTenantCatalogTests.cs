using System.Collections.Concurrent;
using Application.Tenancy;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Extensions.Logging;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class CachedTenantCatalogTests
{
    private static readonly Guid TenantId = Guid.Parse("154d216f-fac5-43f5-b46c-b3c2eabf2726");
    private static readonly Guid OtherTenantId = Guid.Parse("677cb130-2d51-481b-a909-46f68fb2c945");

    [Theory]
    [InlineData("source")]
    [InlineData("cache")]
    [InlineData("logger")]
    public void RejectsMissingCollaborators(string parameter)
    {
        using var fixture = new Fixture();

        Assert.Throws<ArgumentNullException>(parameter, () => new CachedTenantCatalog(
            parameter == "source" ? null! : fixture.Source.Object,
            parameter == "cache" ? null! : fixture.Cache.Object,
            parameter == "logger" ? null! : fixture.Logger));
        fixture.VerifyCalls(cacheReads: 0);
    }

    [Fact]
    public void ConstructionPerformsNoIo()
    {
        using var fixture = new Fixture();
        fixture.VerifyCalls(cacheReads: 0);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task RejectsEmptyIdentityBeforeIo()
    {
        using var fixture = new Fixture();

        await Assert.ThrowsAsync<ArgumentException>("tenantId", () => fixture.Subject.FindAsync(Guid.Empty, fixture.Token));

        fixture.VerifyCalls(cacheReads: 0);
    }

    [Fact]
    public async Task AlreadyCanceledRequestDoesNotAccessDependencies()
    {
        using var fixture = new Fixture();
        fixture.Cancellation.Cancel();

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => fixture.FindAsync());

        Assert.Equal(fixture.Token, error.CancellationToken);
        fixture.VerifyCalls(cacheReads: 0);
    }

    [Theory]
    [InlineData(TenantIsolation.Database, null)]
    [InlineData(TenantIsolation.Schema, "org_private")]
    [InlineData(TenantIsolation.Row, null)]
    public async Task CacheHitReturnsUnchangedSnapshotWithoutSourceOrAuthorization(TenantIsolation isolation, string? schema)
    {
        using var fixture = new Fixture();
        var placement = Placement(isolation: isolation, schema: schema, lifecycle: TenantLifecycle.Suspended);
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync(placement);

        Assert.Same(placement, await fixture.FindAsync());

        fixture.VerifyCalls();
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task CacheMissPublishesAndReturnsExactAuthoritativeSnapshot()
    {
        using var fixture = new Fixture();
        var placement = Placement(lifecycle: TenantLifecycle.Moving);
        fixture.PrepareMiss(placement);
        fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).Returns(Task.CompletedTask);

        Assert.Same(placement, await fixture.FindAsync());

        fixture.VerifyCalls(sourceReads: 1, writes: 1);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task AbsentOrganizationIsNeverNegativelyCached()
    {
        using var fixture = new Fixture();
        fixture.PrepareMiss(null);

        Assert.Null(await fixture.FindAsync());
        Assert.Null(await fixture.FindAsync());

        fixture.VerifyCalls(cacheReads: 2, sourceReads: 2);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task ReadOutageFallsBackOnceWithoutWritingAndLogsOnlySafeContext()
    {
        using var fixture = new Fixture();
        var placement = Placement();
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ThrowsAsync(CacheOutage());
        fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ReturnsAsync(placement);

        Assert.Same(placement, await fixture.FindAsync());

        fixture.VerifyCalls(sourceReads: 1);
        AssertSafeWarning(fixture.Logger, 6101, "TenantCacheReadUnavailable");
    }

    [Fact]
    public async Task ReadOutageStillReturnsAuthoritativeAbsence()
    {
        using var fixture = new Fixture();
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ThrowsAsync(CacheOutage());
        fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ReturnsAsync((TenantPlacement?)null);

        Assert.Null(await fixture.FindAsync());

        fixture.VerifyCalls(sourceReads: 1);
    }

    [Fact]
    public async Task WriteOutageReturnsAuthoritativeSnapshotAndLogsOnlySafeContext()
    {
        using var fixture = new Fixture();
        var placement = Placement();
        fixture.PrepareMiss(placement);
        fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).ThrowsAsync(CacheOutage());

        Assert.Same(placement, await fixture.FindAsync());

        fixture.VerifyCalls(sourceReads: 1, writes: 1);
        AssertSafeWarning(fixture.Logger, 6102, "TenantCacheWriteUnavailable");
    }

    [Fact]
    public async Task WrongCacheIdentityFailsClosedWithoutFallbackOrInvalidation()
    {
        using var fixture = new Fixture();
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync(Placement(OtherTenantId));

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.FindAsync());

        fixture.VerifyCalls();
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task WrongSourceIdentityFailsClosedBeforeCachePublication()
    {
        using var fixture = new Fixture();
        fixture.PrepareMiss(Placement(OtherTenantId));

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.FindAsync());

        fixture.VerifyCalls(sourceReads: 1);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UnexpectedCacheFailurePropagatesWithoutReclassification(bool duringWrite)
    {
        using var fixture = new Fixture();
        var failure = new InvalidDataException("Corrupt cache payload");
        var placement = Placement();
        if (duringWrite)
        {
            fixture.PrepareMiss(placement);
            fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).ThrowsAsync(failure);
        }
        else
        {
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ThrowsAsync(failure);
        }

        Assert.Same(failure, await Assert.ThrowsAsync<InvalidDataException>(() => fixture.FindAsync()));

        fixture.VerifyCalls(sourceReads: duringWrite ? 1 : 0, writes: duringWrite ? 1 : 0);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SourceFailurePropagatesEvenWhenItUsesTheCacheExceptionType(bool cacheException)
    {
        using var fixture = new Fixture();
        Exception failure = cacheException ? CacheOutage() : new InvalidOperationException("Catalog failed");
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync((TenantPlacement?)null);
        fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ThrowsAsync(failure);

        Assert.Same(failure, await Record.ExceptionAsync(() => fixture.FindAsync()));

        fixture.VerifyCalls(sourceReads: 1);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task SourceFailureAfterReadOutagePropagatesWithoutRetry()
    {
        using var fixture = new Fixture();
        var failure = new InvalidOperationException("Catalog unavailable");
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ThrowsAsync(CacheOutage());
        fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ThrowsAsync(failure);

        Assert.Same(failure, await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.FindAsync()));

        fixture.VerifyCalls(sourceReads: 1);
        AssertSafeWarning(fixture.Logger, 6101, "TenantCacheReadUnavailable");
    }

    [Theory]
    [InlineData("read")]
    [InlineData("source")]
    [InlineData("write")]
    public async Task DependencyCancellationAlwaysPropagates(string stage)
    {
        using var fixture = new Fixture();
        var placement = Placement();
        var failure = new OperationCanceledException("Dependency canceled", fixture.Token);
        if (stage == "read")
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ThrowsAsync(failure);
        else
        {
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync((TenantPlacement?)null);
            if (stage == "source")
                fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ThrowsAsync(failure);
            else
            {
                fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ReturnsAsync(placement);
                fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).ThrowsAsync(failure);
            }
        }

        Assert.Same(failure, await Assert.ThrowsAnyAsync<OperationCanceledException>(() => fixture.FindAsync()));

        fixture.VerifyCalls(sourceReads: stage == "read" ? 0 : 1, writes: stage == "write" ? 1 : 0);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Theory]
    [InlineData("read-hit")]
    [InlineData("read-miss")]
    [InlineData("source-hit")]
    [InlineData("source-miss")]
    [InlineData("write")]
    public async Task CancellationIsObservedAfterNoncooperativeDependencyCompletes(string stage)
    {
        using var fixture = new Fixture();
        var placement = Placement();
        var completion = new TaskCompletionSource<TenantPlacement?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var duringRead = stage.StartsWith("read", StringComparison.Ordinal);
        if (duringRead)
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).Returns(completion.Task);
        else
        {
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync((TenantPlacement?)null);
            if (stage == "write")
            {
                fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).ReturnsAsync(placement);
                fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).Returns(completion.Task);
            }
            else
                fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).Returns(completion.Task);
        }

        var lookup = fixture.FindAsync();
        Assert.False(lookup.IsCompleted);
        fixture.Cancellation.Cancel();
        completion.SetResult(stage.EndsWith("miss", StringComparison.Ordinal) ? null : placement);
        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => lookup);

        Assert.Equal(fixture.Token, failure.CancellationToken);
        fixture.VerifyCalls(sourceReads: duringRead ? 0 : 1, writes: stage == "write" ? 1 : 0);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CallerCancellationTakesPrecedenceOverClassifiedCacheOutage(bool duringWrite)
    {
        using var fixture = new Fixture();
        var placement = Placement();
        var completion = new TaskCompletionSource<TenantPlacement?>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (duringWrite)
        {
            fixture.PrepareMiss(placement);
            fixture.Cache.Setup(cache => cache.SetAsync(placement, fixture.Token)).Returns(completion.Task);
        }
        else
            fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).Returns(completion.Task);

        var lookup = fixture.FindAsync();
        Assert.False(lookup.IsCompleted);
        fixture.Cancellation.Cancel();
        completion.SetException(CacheOutage());
        var failure = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => lookup);

        Assert.Equal(fixture.Token, failure.CancellationToken);
        fixture.VerifyCalls(sourceReads: duringWrite ? 1 : 0, writes: duringWrite ? 1 : 0);
        Assert.Empty(fixture.Logger.Entries);
    }

    [Fact]
    public async Task ConcurrentOrganizationsKeepIdentityAndCacheOutageStateIndependent()
    {
        using var fixture = new Fixture();
        using var otherCancellation = new CancellationTokenSource();
        var firstPlacement = Placement();
        var otherPlacement = Placement(OtherTenantId);
        var firstSource = new TaskCompletionSource<TenantPlacement?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var otherSource = new TaskCompletionSource<TenantPlacement?>(TaskCreationOptions.RunContinuationsAsynchronously);
        fixture.Cache.Setup(cache => cache.GetAsync(TenantId, fixture.Token)).ReturnsAsync((TenantPlacement?)null);
        fixture.Cache.Setup(cache => cache.GetAsync(OtherTenantId, otherCancellation.Token)).ThrowsAsync(CacheOutage());
        fixture.Source.Setup(source => source.FindAsync(TenantId, fixture.Token)).Returns(firstSource.Task);
        fixture.Source.Setup(source => source.FindAsync(OtherTenantId, otherCancellation.Token)).Returns(otherSource.Task);
        fixture.Cache.Setup(cache => cache.SetAsync(firstPlacement, fixture.Token)).Returns(Task.CompletedTask);

        var firstLookup = fixture.FindAsync();
        var otherLookup = fixture.Subject.FindAsync(OtherTenantId, otherCancellation.Token);
        Assert.False(firstLookup.IsCompleted);
        Assert.False(otherLookup.IsCompleted);
        otherSource.SetResult(otherPlacement);
        Assert.Same(otherPlacement, await otherLookup);
        Assert.False(firstLookup.IsCompleted);
        firstSource.SetResult(firstPlacement);
        Assert.Same(firstPlacement, await firstLookup);

        fixture.VerifyCalls(cacheReads: 2, sourceReads: 2, writes: 1);
        Assert.Equal(OtherTenantId, Assert.Single(fixture.Logger.Entries).Properties["TenantId"]);
    }

    private static TenantPlacement Placement(
        Guid? tenantId = null, TenantIsolation isolation = TenantIsolation.Database,
        string? schema = null, TenantLifecycle lifecycle = TenantLifecycle.Active)
        => new(tenantId ?? TenantId, isolation, "private-target", schema, "private-region", 7, lifecycle);

    private static TenantPlacementCacheUnavailableException CacheOutage()
        => new(new TimeoutException("Server=private-host;Password=private-secret"));

    private static void AssertSafeWarning(RecordingLogger logger, int eventId, string eventName)
    {
        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Equal(eventId, entry.Event.Id);
        Assert.Equal(eventName, entry.Event.Name);
        Assert.Null(entry.Exception);
        Assert.Equal(TenantId, entry.Properties["TenantId"]);
        Assert.Equal(2, entry.Properties.Count);
        Assert.True(entry.Properties.ContainsKey("{OriginalFormat}"));
        Assert.DoesNotContain("private-", entry.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("Password", entry.Message, StringComparison.Ordinal);
    }

    private sealed class Fixture : IDisposable
    {
        public Mock<ITenantCatalog> Source { get; } = new(MockBehavior.Strict);
        public Mock<ITenantPlacementCache> Cache { get; } = new(MockBehavior.Strict);
        public RecordingLogger Logger { get; } = new();
        public CancellationTokenSource Cancellation { get; } = new();
        public CancellationToken Token => Cancellation.Token;
        public CachedTenantCatalog Subject { get; }

        public Fixture() => Subject = new(Source.Object, Cache.Object, Logger);

        public Task<TenantPlacement?> FindAsync() => Subject.FindAsync(TenantId, Token);

        public void PrepareMiss(TenantPlacement? placement)
        {
            Cache.Setup(cache => cache.GetAsync(TenantId, Token)).ReturnsAsync((TenantPlacement?)null);
            Source.Setup(source => source.FindAsync(TenantId, Token)).ReturnsAsync(placement);
        }

        public void VerifyCalls(int cacheReads = 1, int sourceReads = 0, int writes = 0)
        {
            Cache.Verify(cache => cache.GetAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Exactly(cacheReads));
            Cache.Verify(cache => cache.SetAsync(It.IsAny<TenantPlacement>(), It.IsAny<CancellationToken>()), Times.Exactly(writes));
            Source.Verify(source => source.FindAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Exactly(sourceReads));
            Cache.VerifyNoOtherCalls();
            Source.VerifyNoOtherCalls();
        }

        public void Dispose() => Cancellation.Dispose();
    }

    private sealed record LogEntry(
        LogLevel Level, EventId Event, Exception? Exception, string Message, IReadOnlyDictionary<string, object?> Properties);

    private sealed class RecordingLogger : ILogger<CachedTenantCatalog>
    {
        public ConcurrentQueue<LogEntry> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            var properties = Assert.IsAssignableFrom<IEnumerable<KeyValuePair<string, object?>>>(state)
                .ToDictionary(property => property.Key, property => property.Value);
            Entries.Enqueue(new(logLevel, eventId, exception, formatter(state, exception), properties));
        }
    }
}
