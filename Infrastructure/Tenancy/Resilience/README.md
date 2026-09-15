# Resource governance

`TenantAdmissionPolicy` bounds global, per-target and per-organization work using shared semaphores;
it returns a disposable lease and never creates a thread pool per organization. `TenantWorker` adds
fresh scopes, duplicate suppression, placement-version fencing, bounded in-flight jobs and retryable
abandonment. `ChannelTenantJobQueue` and `InMemoryTenantJobDeduplicator` are local/test adapters.

Production queue, quota and circuit-breaker adapters are explicit registrations and must implement the
same contracts with durable storage. Redis or a target outage must fail a job or return it to the queue,
not consume capacity indefinitely. Configure `Saas:Resilience` limits from deployment configuration.
