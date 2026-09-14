# AKS — TODO(SAAS-08)

Define Bicep infrastructure and manifests/Helm for web, worker and release Jobs. Separate runtime/admin identities, configure workload identity, readiness/liveness, shutdown, resource budgets and bounded autoscaling. Deploy identical digests across environments. Do not run per-pod migration init containers. Test rollback compatibility and all-tier smoke requests.
