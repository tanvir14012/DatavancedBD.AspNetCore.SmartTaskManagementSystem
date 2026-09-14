using Application.Tenancy;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantContextScopeTests
{
    [Fact]
    public void AccessBeforeInitializationFailsClosed()
    {
        var scope = new TenantContextScope();
        Assert.Throws<InvalidOperationException>(() => scope.Current);
    }

    [Fact]
    public void InitializationPublishesTheSameImmutableSnapshot()
    {
        var scope = new TenantContextScope();
        var context = Context();
        scope.Initialize(context);
        Assert.Same(context, scope.Current);
        Assert.All(typeof(TenantContext).GetProperties(), property => Assert.Null(property.SetMethod));
    }

    [Fact]
    public void NullInitializationDoesNotPoisonTheScope()
    {
        var scope = new TenantContextScope();
        Assert.Throws<ArgumentNullException>(() => scope.Initialize(null!));
        var context = Context();
        scope.Initialize(context);
        Assert.Same(context, scope.Current);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ReinitializationCannotReplaceOrganizationOrSubject(bool sameContext)
    {
        var scope = new TenantContextScope();
        var first = Context();
        scope.Initialize(first);
        Assert.Throws<InvalidOperationException>(() => scope.Initialize(sameContext ? first : Context()));
        Assert.Same(first, scope.Current);
    }

    [Fact]
    public async Task ConcurrentInitializersHaveExactlyOneWinner()
    {
        var scope = new TenantContextScope();
        var contexts = Enumerable.Range(0, 32).Select(_ => Context()).ToArray();
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = contexts.Select(async context =>
        {
            await start.Task;
            try
            {
                scope.Initialize(context);
                return context;
            }
            catch (InvalidOperationException)
            {
                return null;
            }
        }).ToArray();
        start.SetResult();
        var results = await Task.WhenAll(tasks);
        Assert.Same(Assert.Single(results.Where(result => result is not null)), scope.Current);
    }

    [Fact]
    public async Task ConcurrentScopesRemainIndependentAcrossAsyncContinuations()
    {
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, 32).Select(async _ =>
        {
            var scope = new TenantContextScope();
            var context = Context();
            scope.Initialize(context);
            await start.Task;
            await Task.Yield();
            Assert.Same(context, scope.Current);
            return scope.Current;
        }).ToArray();
        start.SetResult();
        var results = await Task.WhenAll(tasks);
        Assert.Equal(32, results.Select(result => result.Placement.TenantId).Distinct().Count());
        Assert.Throws<InvalidOperationException>(() => new TenantContextScope().Current);
    }

    [Theory]
    [InlineData(TenantLifecycle.Provisioning)]
    [InlineData(TenantLifecycle.Moving)]
    [InlineData(TenantLifecycle.Suspended)]
    public void NonactivePlacementCannotBecomeRequestContext(TenantLifecycle lifecycle)
        => Assert.Throws<ArgumentException>(() => new TenantContext(Placement(lifecycle), "subject", "https://issuer.test"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t")]
    public void MissingSubjectCannotBecomeRequestContext(string? subject)
        => Assert.ThrowsAny<ArgumentException>(() => new TenantContext(Placement(), subject!, "https://issuer.test"));

    [Fact]
    public void MissingPlacementIsRejected()
        => Assert.Throws<ArgumentNullException>(() => new TenantContext(null!, "subject", "https://issuer.test"));

    [Fact]
    public void SubjectIdentityIsPreservedExactly()
        => Assert.Equal("Provider|Case-Sensitive", new TenantContext(Placement(), "Provider|Case-Sensitive", "https://issuer.test").SubjectId);

    private static TenantContext Context() => new(Placement(), Guid.NewGuid().ToString("N"), "https://issuer.test");

    private static TenantPlacement Placement(TenantLifecycle lifecycle = TenantLifecycle.Active)
        => new(Guid.NewGuid(), TenantIsolation.Row, "sql-01", null, "southeastasia", 1, lifecycle);
}
