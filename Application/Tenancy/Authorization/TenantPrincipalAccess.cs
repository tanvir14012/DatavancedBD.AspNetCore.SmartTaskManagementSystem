using System.Security.Claims;

namespace Application.Tenancy.Authorization;

/// <summary>Extracts one organization-bound identity from an authenticated principal.</summary>
/// <remarks>
/// Claims are read by exact protocol names. A principal with multiple identities or duplicate
/// security claims is rejected instead of merging values from different authentication sources.
/// </remarks>
public static class TenantPrincipalAccess
{
    private const string SubjectClaimType = "sub";
    private const string IssuerClaimType = "iss";

    /// <summary>The organization claim required by the tenant authorization boundary.</summary>
    public const string TenantIdClaimType = "tenant_id";

    /// <summary>Returns false for an unauthenticated, ambiguous or structurally invalid principal.</summary>
    public static bool TryRead(ClaimsPrincipal principal, out TenantAccess? access)
    {
        ArgumentNullException.ThrowIfNull(principal);
        access = null;
        var identities = principal.Identities.ToArray();
        if (identities.Length != 1 || !identities[0].IsAuthenticated)
            return false;

        var identity = identities[0];
        var subject = SingleValue(identity, SubjectClaimType);
        var issuer = SingleValue(identity, IssuerClaimType);
        var organization = SingleValue(identity, TenantIdClaimType);
        if (subject is null || issuer is null || organization?.Length != 36 ||
            !Guid.TryParseExact(organization, "D", out var tenantId) || tenantId == Guid.Empty)
            return false;

        // Legacy Identity emits NameIdentifier for the same subject. It may agree, but must never
        // override the protocol subject or be taken from a second identity.
        if (identity.FindAll(ClaimTypes.NameIdentifier)
            .Any(claim => !string.Equals(claim.Value, subject, StringComparison.Ordinal)))
            return false;

        try
        {
            access = new TenantAccess(tenantId, subject, issuer);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static string? SingleValue(ClaimsIdentity identity, string claimType)
    {
        var values = identity.Claims
            .Where(claim => string.Equals(claim.Type, claimType, StringComparison.Ordinal))
            .Take(2)
            .ToArray();
        return values.Length == 1 ? values[0].Value : null;
    }
}
