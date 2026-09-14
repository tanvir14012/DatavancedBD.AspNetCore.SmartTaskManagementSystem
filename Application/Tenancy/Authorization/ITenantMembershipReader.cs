namespace Application.Tenancy.Authorization;

/// <summary>Checks current organization membership against durable authority, never JWT roles or a placement cache.</summary>
public interface ITenantMembershipReader
{
    /// <summary>False means absent or inactive membership; provider failures must propagate.</summary>
    Task<bool> IsActiveMemberAsync(TenantAccess access, CancellationToken cancellationToken);
}
