using Application.Tenancy;
using Application.Tenancy.Authorization;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantContextAuthorizerTests
{
    private static readonly Guid TenantId = Guid.Parse("dfc17bd9-eab0-480b-bec4-ed86116f9431");
    private static readonly TenantAccess Access = new(TenantId, "subject-1", "https://identity.example.com");

    [Fact]
    public async Task Active_membership_and_placement_create_context()
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        memberships.Setup(value => value.IsActiveMemberAsync(Access, CancellationToken.None)).ReturnsAsync(true);
        var placement = Placement(TenantLifecycle.Active);
        catalog.Setup(value => value.FindAsync(TenantId, CancellationToken.None)).ReturnsAsync(placement);
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        var context = await sut.AuthorizeAsync(Access, CancellationToken.None);

        Assert.Same(placement, context.Placement);
        Assert.Equal(Access.SubjectId, context.SubjectId);
        Assert.Equal(Access.Issuer, context.Issuer);
        memberships.VerifyAll();
        catalog.VerifyAll();
    }

    [Fact]
    public async Task Inactive_membership_is_denied_before_catalog_lookup()
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        memberships.Setup(value => value.IsActiveMemberAsync(Access, CancellationToken.None)).ReturnsAsync(false);
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => sut.AuthorizeAsync(Access, CancellationToken.None));
        catalog.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(TenantLifecycle.Provisioning)]
    [InlineData(TenantLifecycle.Moving)]
    [InlineData(TenantLifecycle.Suspended)]
    public async Task Non_active_placement_is_denied(TenantLifecycle lifecycle)
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        memberships.Setup(value => value.IsActiveMemberAsync(Access, CancellationToken.None)).ReturnsAsync(true);
        catalog.Setup(value => value.FindAsync(TenantId, CancellationToken.None)).ReturnsAsync(Placement(lifecycle));
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => sut.AuthorizeAsync(Access, CancellationToken.None));
    }

    [Fact]
    public async Task Missing_placement_is_denied_without_leaking_existence()
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        memberships.Setup(value => value.IsActiveMemberAsync(Access, CancellationToken.None)).ReturnsAsync(true);
        catalog.Setup(value => value.FindAsync(TenantId, CancellationToken.None)).ReturnsAsync((TenantPlacement?)null);
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        var exception = await Assert.ThrowsAsync<TenantAccessDeniedException>(() => sut.AuthorizeAsync(Access, CancellationToken.None));
        Assert.DoesNotContain(TenantId.ToString(), exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Catalog_identity_mismatch_fails_closed_as_corruption()
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        memberships.Setup(value => value.IsActiveMemberAsync(Access, CancellationToken.None)).ReturnsAsync(true);
        // A fake cannot construct a placement for another tenant through the private helper, so use a
        // strict mock catalog result that violates the interface's identity promise.
        var wrongTenant = new TenantPlacementForTests().Placement;
        catalog.Setup(value => value.FindAsync(TenantId, CancellationToken.None)).ReturnsAsync(wrongTenant);
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.AuthorizeAsync(Access, CancellationToken.None));
    }

    [Fact]
    public async Task Caller_cancellation_prevents_membership_lookup()
    {
        var memberships = new Mock<ITenantMembershipReader>(MockBehavior.Strict);
        var catalog = new Mock<IAuthoritativeTenantCatalog>(MockBehavior.Strict);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var sut = new TenantContextAuthorizer(new TenantAccessValidator(memberships.Object), catalog.Object);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.AuthorizeAsync(Access, cancellation.Token));
        memberships.VerifyNoOtherCalls();
        catalog.VerifyNoOtherCalls();
    }

    private static TenantPlacement Placement(TenantLifecycle lifecycle)
        => new(TenantId, TenantIsolation.Row, "sql-01", null, "southeastasia", 1, lifecycle);

    private sealed class TenantPlacementForTests
    {
        public TenantPlacement Placement { get; } = new(Guid.Parse("1a3c9c33-10f7-4eab-8f1d-6b31e82cb334"),
            TenantIsolation.Row, "sql-01", null, "southeastasia", 1, TenantLifecycle.Active);
    }
}
