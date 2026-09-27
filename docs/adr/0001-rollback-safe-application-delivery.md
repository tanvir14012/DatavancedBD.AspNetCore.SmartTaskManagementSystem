# ADR 0001: Bound application releases to recoverable Helm state

Status: accepted for implementation; cluster acceptance remains required.

## Context

Dev and production mixed provisioning, secret rotation, migrations, and workload rollout.
Helm atomic upgrade did not include subsequent smoke checks. Production resolved tags again
and used the dispatch branch chart, so it could differ from the release tested in dev.
Hook-created secret providers were outside Helm's normal rollback inventory.

## Decision

CI gates dev publication. A successful dev run supplies an immutable digest manifest and source
revision for production. Pin actions and Helm semantics; scope OIDC permissions to privileged jobs.
Separate registry build credentials from namespace release credentials and bootstrap permissions.
Never rewrite secrets, infrastructure, or schemas in an application release.

One shell transaction owns rollback, instead of combining manual recovery with Helm atomic recovery.
Capture a healthy deployed revision before upgrade; on rollout or smoke-check failure, restore exactly
that revision without hooks, wait, and verify health. Return failure even when recovery succeeds.
Clean up failed first installations; report unsuccessful recovery distinctly. Explicit rollback uses
retained successful revisions, not mutable tags or revision arithmetic.

Manage secret providers as ordinary chart resources; let CSI mounts synchronize secrets. Disable
automatic migrations and Kubernetes API token automount. Keep Azure's separately projected workload
identity tokens. HPA owns replica count; preserve dependency-independent liveness, stable readiness,
bounded startup, PDBs, zero-unavailable rolling updates, and time for endpoint propagation/shutdown.

## Alternatives

- Helm `--atomic` alone misses smoke failures. Combining it with another rollback risks restoring
  the wrong revision or rolling back twice.
- Rebuilding/promoting by tag can change source, chart, or image digest between environments.
- Automatically reversing SQL or Key Vault writes is not a safe substitute for compatibility,
  reviewed migrations, and verified backup/restore.
- Cluster-admin application identities simplify bootstrap but expose unrelated namespaces/resources.

## Consequences

Bootstrap is now an explicit prerequisite. Promotion requires a retained successful dev artifact.
Runtime SQL privileges and tenant topology remain unchanged and need independent evidence.
Namespace RBAC Admin still allows sensitive namespace operations; environments and workflow reviews
must be protected. SIGKILL/runner loss cannot be made transactional by a shell trap. Operators must
reconcile interrupted releases. Port-forward smoke checks do not prove ingress or tenant correctness.

## Migration and rollback

Follow `deploy/aks/README.md` to establish chart 1.1 with the current application digests, frozen
compatible secrets/schema, adopted providers, HPA ownership transition, and explicit
`rollbackContract=v1`. Do not deploy a new application version during that baseline transition.
Legacy hook-based revisions are rejected by automatic/manual recovery. Baseline failure requires
operator restoration of saved chart and hook resources. After baseline verification, retain Helm
history and ACR digests and exercise failure/recovery in an isolated AKS environment. Keep database
changes expand/contract-compatible and secret rotation separate throughout the rollback window.

## References

- [Helm 3 rollback flags](https://helm.sh/docs/v3/helm/helm_rollback/)
- [Kubernetes HPA replica ownership](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [Kubernetes pod termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
