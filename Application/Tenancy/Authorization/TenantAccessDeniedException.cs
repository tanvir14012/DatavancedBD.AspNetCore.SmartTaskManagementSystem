namespace Application.Tenancy.Authorization;

/// <summary>A deliberately non-enumerating rejection for absent membership or unavailable organization access.</summary>
public sealed class TenantAccessDeniedException : Exception
{
    /// <summary>Constructs a fixed response with no subject, tenant, or provider details.</summary>
    public TenantAccessDeniedException() : base("Organization access is denied.") { }
}
