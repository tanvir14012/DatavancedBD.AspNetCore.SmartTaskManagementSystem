using Application.Tenancy;
using Infrastructure.Tenancy.Catalog;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class CachedTenantCatalogWriterTests
{
    private static readonly Guid TenantId = Guid.Parse("248f574e-f377-4a7d-9b26-8ea2c5dd2367");

    [Fact]
    public async Task Stale_durable_write_does_not_publish_to_cache()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        source.Setup(value => value.TrySaveAsync(It.IsAny<TenantPlacement>(), 4, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);

        Assert.False(await sut.TrySaveAsync(Placement(5), 4, CancellationToken.None));
        cache.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Committed_write_is_published_after_durable_success()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var placement = Placement(5);
        source.Setup(value => value.TrySaveAsync(placement, 4, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        cache.Setup(value => value.SetAsync(placement, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);

        Assert.True(await sut.TrySaveAsync(placement, 4, CancellationToken.None));
        source.VerifyAll();
        cache.VerifyAll();
    }

    [Fact]
    public async Task Cache_transport_outage_does_not_undo_durable_commit()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var placement = Placement(5);
        source.Setup(value => value.TrySaveAsync(placement, 4, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        cache.Setup(value => value.SetAsync(placement, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TenantPlacementCacheUnavailableException());
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);

        Assert.True(await sut.TrySaveAsync(placement, 4, CancellationToken.None));
    }

    [Fact]
    public async Task Cache_integrity_failure_propagates_after_durable_commit()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var placement = Placement(5);
        source.Setup(value => value.TrySaveAsync(placement, 4, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var failure = new InvalidDataException("corrupt cache");
        cache.Setup(value => value.SetAsync(placement, It.IsAny<CancellationToken>())).ThrowsAsync(failure);
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);

        var actual = await Assert.ThrowsAsync<InvalidDataException>(() => sut.TrySaveAsync(placement, 4, CancellationToken.None));
        Assert.Same(failure, actual);
    }

    [Fact]
    public async Task Caller_cancellation_prevents_durable_write()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.TrySaveAsync(Placement(5), 4, cancellation.Token));
        source.VerifyNoOtherCalls();
        cache.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Caller_cancellation_after_durable_write_prevents_cache_publication()
    {
        var source = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var placement = Placement(5);
        using var cancellation = new CancellationTokenSource();
        source.Setup(value => value.TrySaveAsync(placement, 4, cancellation.Token))
            .Callback(() => cancellation.Cancel()).ReturnsAsync(true);
        var sut = new CachedTenantCatalogWriter(source.Object, cache.Object, NullLogger<CachedTenantCatalogWriter>.Instance);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.TrySaveAsync(placement, 4, cancellation.Token));
        cache.VerifyNoOtherCalls();
    }

    private static TenantPlacement Placement(long version)
        => new(TenantId, TenantIsolation.Row, "sql-01", null, "southeastasia", version, TenantLifecycle.Active);
}
