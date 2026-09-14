namespace Api.Tenancy;

// TODO(SAAS-02): Compose resolver -> authentication/access validation -> immutable context -> persistence.
// TODO(SAAS-02): Reject conflicting host/header/claim selectors; trust forwarded headers only from ingress.
// TODO(SAAS-02): Test via WebApplicationFactory with fake catalog and authenticated principals.
// Intentionally not registered: no partial tenant authorization pipeline may serve requests.
internal static class TenantPipeline
{
}
