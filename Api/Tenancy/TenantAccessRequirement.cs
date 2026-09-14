using Microsoft.AspNetCore.Authorization;

namespace Api.Tenancy;

/// <summary>Requires matching authenticated organization, request selectors, membership and active placement.</summary>
public sealed record TenantAccessRequirement : IAuthorizationRequirement;
