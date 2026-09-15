# AKS release contract

AKS deployment must run API and Worker as separate workloads and Admin as a release Job. Runtime and
Admin use separate workload identities; only the release identity may access migration/provisioning
permissions. Configure `/alive` for liveness and `/ready` for readiness, a finite termination grace
period, CPU/memory budgets, bounded autoscaling and a queue-backed worker.

Deploy immutable image digests, never per-pod migration init containers. Release Jobs acquire the SQL
application lock, run the reviewed Admin command, and complete before incompatible API/Worker changes
are rolled out. Rollback is image-only and does not reverse a tenant move.
