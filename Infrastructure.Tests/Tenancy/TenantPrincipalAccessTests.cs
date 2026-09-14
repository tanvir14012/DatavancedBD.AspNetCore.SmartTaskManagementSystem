using System.Security.Claims;
using Application.Tenancy;
using Application.Tenancy.Authorization;

namespace Infrastructure.Tests.Tenancy;

public sealed class TenantPrincipalAccessTests
{
    private static readonly Guid TenantId = Guid.Parse("dfc17bd9-eab0-480b-bec4-ed86116f9431");

    [Fact]
    public void Reads_one_authenticated_organization_bound_identity()
    {
        var principal = Principal(
            new Claim("sub", "subject-1"),
            new Claim("iss", "https://identity.example.com"),
            new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("D")),
            new Claim(ClaimTypes.NameIdentifier, "subject-1"));

        Assert.True(TenantPrincipalAccess.TryRead(principal, out var access));
        Assert.Equal(new TenantAccess(TenantId, "subject-1", "https://identity.example.com"), access);
    }

    [Theory]
    [MemberData(nameof(InvalidPrincipals))]
    public void Rejects_ambiguous_or_unbound_principals(ClaimsPrincipal principal)
    {
        Assert.False(TenantPrincipalAccess.TryRead(principal, out var access));
        Assert.Null(access);
    }

    [Fact]
    public void Does_not_merge_subject_or_organization_from_different_identities()
    {
        var first = new ClaimsIdentity(
        [
            new Claim("sub", "subject-1"),
            new Claim("iss", "https://identity.example.com")
        ], "jwt");
        var second = new ClaimsIdentity(
        [new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("D"))], "jwt");

        Assert.False(TenantPrincipalAccess.TryRead(new ClaimsPrincipal([first, second]), out _));
    }

    [Fact]
    public void Rejects_conflicting_legacy_name_identifier_alias()
    {
        var principal = Principal(
            new Claim("sub", "subject-1"),
            new Claim("iss", "https://identity.example.com"),
            new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("D")),
            new Claim(ClaimTypes.NameIdentifier, "different-subject"));

        Assert.False(TenantPrincipalAccess.TryRead(principal, out _));
    }

    public static IEnumerable<object[]> InvalidPrincipals()
    {
        yield return [new ClaimsPrincipal()];
        yield return [new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "subject-1")], "jwt"))];
        yield return [Principal(new Claim("sub", "subject-1"), new Claim("iss", "https://identity.example.com"))];
        yield return [Principal(new Claim("sub", "subject-1"), new Claim("iss", "https://identity.example.com"), new Claim(TenantPrincipalAccess.TenantIdClaimType, Guid.Empty.ToString("D")))];
        yield return [Principal(new Claim("sub", "subject-1"), new Claim("iss", "https://identity.example.com"), new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("N")))];
        yield return [Principal(new Claim("sub", "subject-1"), new Claim("sub", "subject-2"), new Claim("iss", "https://identity.example.com"), new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("D")))];
        yield return [Principal(new Claim("sub", "subject-1"), new Claim("iss", "https://identity.example.com"), new Claim("iss", "https://other.example.com"), new Claim(TenantPrincipalAccess.TenantIdClaimType, TenantId.ToString("D")))];
    }

    private static ClaimsPrincipal Principal(params Claim[] claims)
        => new(new ClaimsIdentity(claims, "jwt"));
}
