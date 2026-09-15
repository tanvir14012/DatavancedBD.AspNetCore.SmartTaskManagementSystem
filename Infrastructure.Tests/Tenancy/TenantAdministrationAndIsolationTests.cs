using Application.Tenancy;
using Infrastructure.Caching.Keys;
using Infrastructure.Tenancy.Migrations;
using Infrastructure.Tenancy.Provisioning;
using Infrastructure.Tenancy.Resilience;
using Microsoft.Extensions.Options;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantAdministrationAndIsolationTests
{
    private static readonly Guid TenantA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantB = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void Cache_keys_are_disjoint_for_independent_contexts()
    {
        var first = new TenantContextScope();
        first.Initialize(Context(TenantA));
        var second = new TenantContextScope();
        second.Initialize(Context(TenantB));
        var generator = new DefaultCacheKeyGenerator();

        var keyA = new TenantCacheKeyBuilder(first, generator).Build("tasks:list:member");
        var keyB = new TenantCacheKeyBuilder(second, generator).Build("tasks:list:member");

        Assert.NotEqual(keyA, keyB);
        Assert.Contains(TenantA.ToString("D"), keyA);
        Assert.Contains(TenantB.ToString("D"), keyB);
    }

    [Fact]
    public async Task Migration_runner_deduplicates_targets_and_records_success()
    {
        var target = new MigrationTarget("sql-01", null, TenantIsolation.Row);
        var source = new FakeTargetSource(target, target);
        var executor = new Mock<IMigrationTargetExecutor>(MockBehavior.Strict);
        executor.Setup(value => value.ExecuteAsync(target, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        var ledger = new InMemoryMigrationLedger();
        var runner = new TenantMigrationRunner(source, new InProcessMigrationTargetLockProvider(),
            executor.Object, ledger, Options.Create(new TenantMigrationOptions { MaxConcurrency = 2 }));

        var first = await runner.RunAsync(CancellationToken.None);
        var second = await runner.RunAsync(CancellationToken.None);

        var outcome = Assert.Single(first);
        Assert.True(outcome.Succeeded);
        Assert.Single(second);
        executor.Verify(value => value.ExecuteAsync(target, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Provisioner_does_not_activate_when_validation_fails()
    {
        var provisioning = new TenantPlacement(TenantA, TenantIsolation.Row, "sql-01", null,
            "region-1", 1, TenantLifecycle.Provisioning);
        var allocator = new Mock<ITenantPlacementAllocator>(MockBehavior.Strict);
        allocator.Setup(value => value.AllocateAsync(TenantA, TenantIsolation.Row, It.IsAny<CancellationToken>()))
            .ReturnsAsync(provisioning);
        var executor = new Mock<ITenantProvisioningExecutor>(MockBehavior.Strict);
        executor.Setup(value => value.ExecuteAsync(provisioning, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        executor.Setup(value => value.ValidateAsync(provisioning, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("validation"));
        var writer = new Mock<ITenantCatalogWriter>(MockBehavior.Strict);
        writer.Setup(value => value.TrySaveAsync(provisioning, 0, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var cache = new Mock<ITenantPlacementCache>(MockBehavior.Strict);
        var provisioner = new TenantProvisioner(allocator.Object, executor.Object, writer.Object, cache.Object,
            new InProcessTenantProvisioningLockProvider());

        await Assert.ThrowsAsync<InvalidOperationException>(() => provisioner.ProvisionAsync(TenantA, TenantIsolation.Row, default));
        writer.Verify(value => value.TrySaveAsync(It.Is<TenantPlacement>(p => p.Lifecycle == TenantLifecycle.Active),
            It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        cache.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Admission_releases_all_budgets_when_lease_is_disposed()
    {
        using var policy = new TenantAdmissionPolicy(Options.Create(new TenantAdmissionOptions
        {
            MaxConcurrentWork = 1,
            MaxConcurrentPerTenant = 1,
            MaxConcurrentPerTarget = 1,
            WaitMilliseconds = 0
        }));

        await using var lease = await policy.AcquireAsync(TenantA, "sql-01", default);
        Assert.NotNull(lease);
        Assert.False(await policy.CanAdmitAsync(TenantB, default));
        await lease.DisposeAsync();
        Assert.True(await policy.CanAdmitAsync(TenantB, default));
    }

    private static TenantContext Context(Guid tenant)
        => new(new TenantPlacement(tenant, TenantIsolation.Row, "sql-01", null,
            "region-1", 1, TenantLifecycle.Active), "subject", "issuer");

    private sealed class FakeTargetSource(params MigrationTarget[] targets) : IMigrationTargetSource
    {
        public async IAsyncEnumerable<MigrationTarget> ReadAsync(
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            foreach (var target in targets)
            {
                cancellationToken.ThrowIfCancellationRequested();
                yield return target;
                await Task.Yield();
            }
        }
    }
}
