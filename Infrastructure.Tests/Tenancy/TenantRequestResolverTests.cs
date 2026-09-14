using Application.Tenancy;
using Application.Tenancy.Resolution;
using Moq;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantRequestResolverTests
{
    private static readonly Guid Organization = Guid.Parse("a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be");

    [Theory]
    [InlineData("CUSTOM.Example.COM", "custom.example.com")]
    [InlineData("tenant.example.com:443", "tenant.example.com:443")]
    [InlineData("localhost:5000", "localhost:5000")]
    [InlineData("LOCALHOST", "localhost")]
    [InlineData("127.0.0.1:5000", "127.0.0.1:5000")]
    [InlineData("service-name.example:1", "service-name.example:1")]
    [InlineData("service.example:65535", "service.example:65535")]
    public async Task ApprovedHostUsesExactCanonicalDirectoryMapping(string host, string expectedAuthority)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        using var cancellation = new CancellationTokenSource();
        directory.Setup(value => value.FindTenantAsync(expectedAuthority, cancellation.Token)).ReturnsAsync(Organization);
        var sut = Resolver(directory);

        var organization = await sut.ResolveAsync(new(host, null), cancellation.Token);

        Assert.Equal(Organization, organization);
        directory.Verify(value => value.FindTenantAsync(expectedAuthority, cancellation.Token), Times.Once);
        directory.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SharedApiAuthorityAcceptsExplicitSelectorWithoutDirectoryLookup(bool uppercase)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, "API.Example.com");
        var selector = Organization.ToString("D");

        var organization = await sut.ResolveAsync(new("api.example.COM", uppercase ? selector.ToUpperInvariant() : selector), CancellationToken.None);

        Assert.Equal(Organization, organization);
        directory.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SharedAuthorityWithoutSelectorIsRejectedWithoutDirectoryFallback()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, "api.example.com");

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(new("api.example.com", null), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.MissingSelector, error.Failure);
        directory.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("api.example.com:443")]
    [InlineData("api.example.com.attacker.test")]
    [InlineData("child.api.example.com")]
    public async Task SharedAuthorityAllowlistHasNoImplicitPortSubdomainOrSuffixMatches(string host)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync(host, CancellationToken.None)).ReturnsAsync((Guid?)null);
        var sut = Resolver(directory, "api.example.com");

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(new(host, Organization.ToString("D")), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.UnknownHost, error.Failure);
    }

    [Fact]
    public async Task ExplicitPortMustMatchTheConfiguredSharedAuthority()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, "localhost:5000");

        Assert.Equal(Organization, await sut.ResolveAsync(new("LOCALHOST:5000", Organization.ToString("D")), CancellationToken.None));
        directory.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task MatchingSelectorCanAccompanyAnApprovedOrganizationHost()
    {
        var directory = KnownHostDirectory();
        var sut = Resolver(directory);

        Assert.Equal(Organization, await sut.ResolveAsync(new("custom.example.com", Organization.ToString("D").ToUpperInvariant()), CancellationToken.None));
        directory.Verify(value => value.FindTenantAsync("custom.example.com", CancellationToken.None), Times.Once);
    }

    [Fact]
    public async Task ConflictingHostAndSelectorAreRejected()
    {
        var directory = KnownHostDirectory();
        var sut = Resolver(directory);

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(
            new("custom.example.com", Guid.NewGuid().ToString("D")), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.ConflictingSelector, error.Failure);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UnknownHostNeverUsesSelectorAsFallback(bool supplySelector)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("unknown.example.com", CancellationToken.None)).ReturnsAsync((Guid?)null);
        var sut = Resolver(directory);

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(
            new("unknown.example.com", supplySelector ? Organization.ToString("D") : null), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.UnknownHost, error.Failure);
    }

    [Fact]
    public async Task EmptyDirectoryIdentityIsCorruptionAndDoesNotUseSelectorFallback()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("custom.example.com", CancellationToken.None)).ReturnsAsync(Guid.Empty);
        var sut = Resolver(directory);

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.ResolveAsync(
            new("custom.example.com", Organization.ToString("D")), CancellationToken.None));
    }

    [Theory]
    [MemberData(nameof(InvalidAuthorities))]
    public async Task InvalidAuthorityIsRejectedBeforeDirectoryLookup(string? host)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, "api.example.com");

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(
            new(host, Organization.ToString("D")), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.InvalidHost, error.Failure);
        directory.VerifyNoOtherCalls();
    }

    [Theory]
    [MemberData(nameof(InvalidAuthorities))]
    public void InvalidConfiguredAuthorityIsRejectedWithoutEchoingItsValue(string? authority)
    {
        var error = Assert.Throws<ArgumentException>(() => new TenantResolutionOptions([authority!]));

        Assert.StartsWith("Shared API authority configuration contains an invalid DNS authority.", error.Message);
    }

    [Theory]
    [MemberData(nameof(InvalidSelectors))]
    public async Task InvalidSelectorIsRejectedBeforeLookupEvenOnAKnownSharedHost(string selector)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, "api.example.com");

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(new("api.example.com", selector), CancellationToken.None));

        Assert.Equal(TenantResolutionFailure.InvalidSelector, error.Failure);
        directory.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task MaximumDnsLengthAndLabelLengthsAreAccepted()
    {
        var authority = $"{new string('a', 63)}.{new string('b', 63)}.{new string('c', 63)}.{new string('d', 61)}:65535";
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, authority);

        Assert.Equal(Organization, await sut.ResolveAsync(new(authority, Organization.ToString("D")), CancellationToken.None));
        directory.VerifyNoOtherCalls();
    }

    [Fact]
    public void ConfigurationIsAnImmutableSnapshotAndCanonicalDuplicatesAreDeduplicated()
    {
        var authorities = new List<string> { "API.EXAMPLE.com", "api.example.com" };
        var options = new TenantResolutionOptions(authorities);
        authorities.Clear();
        authorities.Add("attacker.test");

        Assert.Equal("api.example.com", Assert.Single(options.SharedApiAuthorities));
        Assert.False(options.SharedApiAuthorities.Contains("attacker.test"));
        Assert.Null(typeof(TenantResolutionOptions).GetProperty(nameof(options.SharedApiAuthorities))!.SetMethod);
    }

    [Fact]
    public async Task DirectoryFailurePropagatesUnchangedWithoutSelectorFallback()
    {
        var expected = new IOException("Directory dependency unavailable");
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("custom.example.com", CancellationToken.None)).ThrowsAsync(expected);
        var sut = Resolver(directory);

        var actual = await Assert.ThrowsAsync<IOException>(() => sut.ResolveAsync(
            new("custom.example.com", Organization.ToString("D")), CancellationToken.None));

        Assert.Same(expected, actual);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PreCancellationNeverReturnsAHostOrSelectorCandidate(bool shared)
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory, shared ? ["api.example.com"] : []);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.ResolveAsync(
            new("api.example.com", Organization.ToString("D")), new CancellationToken(true)));

        directory.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CancellationAfterDirectoryCompletionWinsOverSuccessOrFailure(bool failure)
    {
        using var cancellation = new CancellationTokenSource();
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("custom.example.com", cancellation.Token)).Returns(() =>
        {
            cancellation.Cancel();
            return failure ? Task.FromException<Guid?>(new IOException("Unavailable")) : Task.FromResult<Guid?>(Organization);
        });
        var sut = Resolver(directory);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.ResolveAsync(
            new("custom.example.com", Organization.ToString("D")), cancellation.Token));
    }

    [Fact]
    public async Task DirectoryCancellationIsNotTranslatedToUnknownHost()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("custom.example.com", CancellationToken.None))
            .Returns(Task.FromCanceled<Guid?>(cancellation.Token));
        var sut = Resolver(directory);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sut.ResolveAsync(new("custom.example.com", null), CancellationToken.None));
    }

    [Fact]
    public async Task RejectionDoesNotRetainOrEchoUntrustedAuthorityOrSelector()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var sut = Resolver(directory);
        const string secret = "do-not-echo-secret";

        var error = await Assert.ThrowsAsync<TenantResolutionException>(() => sut.ResolveAsync(
            new($"https://user:{secret}@example.com/private", secret), CancellationToken.None));

        Assert.DoesNotContain(secret, error.ToString(), StringComparison.Ordinal);
        Assert.Null(error.InnerException);
        Assert.Empty(error.Data);
    }

    [Fact]
    public async Task ConstructorsDoNotPerformIoAndRejectNullDependencies()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        var options = new TenantResolutionOptions([]);
        var sut = new TenantRequestResolver(directory.Object, options);

        Assert.Throws<ArgumentNullException>(() => new TenantResolutionOptions(null!));
        Assert.Throws<ArgumentNullException>(() => new TenantRequestResolver(null!, options));
        Assert.Throws<ArgumentNullException>(() => new TenantRequestResolver(directory.Object, null!));
        await Assert.ThrowsAsync<ArgumentNullException>(() => sut.ResolveAsync(null!, CancellationToken.None));
        directory.VerifyNoOtherCalls();
    }

    public static IEnumerable<object?[]> InvalidAuthorities()
    {
        string?[] invalid =
        [
            null, "", " ", " api.example.com", "api.example.com ", "api. example.com", "api\texample.com", "api\r\n.example.com",
            "https://api.example.com", "http://api.example.com", "user@api.example.com", "api.example.com/path",
            "api.example.com?tenant=id", "api.example.com#fragment", "*.example.com", ".example.com", "example..com",
            "example.com.", "-api.example.com", "api-.example.com", "api._example.com", "éxample.com", "api。example.com",
            "api\\example.com", "api.example.com,other.example.com", "api.example.com:0", "api.example.com:65536", "api.example.com:",
            "api.example.com:-1", "api.example.com:+443", "api.example.com:0443", "api.example.com: 443", "api.example.com:4.43",
            "api.example.com:443:80", "[::1]:5000", "::1", ":443", "api\0.example.com",
            $"{new string('a', 64)}.example.com", $"{new string('a', 63)}.{new string('b', 63)}.{new string('c', 63)}.{new string('d', 62)}"
        ];
        return invalid.Select(authority => new object?[] { authority });
    }

    public static IEnumerable<object[]> InvalidSelectors()
    {
        var id = Organization.ToString("D");
        return new[] { "", " ", "\t", "invalid", Guid.Empty.ToString("D"), Organization.ToString("N"), Organization.ToString("B"),
            Organization.ToString("P"), Organization.ToString("X"), $" {id}", $"{id} ", $"{id},{id}", $"{id}\r\n", id.Replace('-', '_') }
            .Select(selector => new object[] { selector });
    }

    private static TenantRequestResolver Resolver(Mock<ITenantHostDirectory> directory, params string[] shared)
        => new(directory.Object, new TenantResolutionOptions(shared));

    private static Mock<ITenantHostDirectory> KnownHostDirectory()
    {
        var directory = new Mock<ITenantHostDirectory>(MockBehavior.Strict);
        directory.Setup(value => value.FindTenantAsync("custom.example.com", CancellationToken.None)).ReturnsAsync(Organization);
        return directory;
    }
}
