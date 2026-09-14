# Resource governance — TODO(SAAS-07)

Implement ITenantAdmissionPolicy with injected quota storage and TimeProvider. Budget pools across targets and maximum replica count; bound local concurrent work and distributed tenant quotas. Test fairness, timeout/cancellation, Redis outage policy and per-target breakers. No per-tenant thread pools.
