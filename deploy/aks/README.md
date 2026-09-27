# AKS application delivery and recovery

CI, dev, and production use separate jobs and environment approvals. Application CD never
provisions infrastructure, changes Key Vault values, runs migrations, or installs cluster add-ons.
Those changes need their own reviewed operation because Helm cannot reverse them.

## Bootstrap and permissions

1. Use an infrastructure administrator to run `deploy-infrastructure.sh`, install add-ons with
   `deploy-addons.sh`, create the namespace, configure DNS/TLS, and populate Key Vault separately.
   Existing Bicep `ciPrincipalObjectId` grants are **bootstrap privileges**, not release privileges.
2. Create dedicated OIDC identities for the image builder and each environment's release jobs.
   Give the builder `AcrPush` on the shared registry only. Give the release identities `AcrPull`,
   AKS Cluster User on their cluster, and AKS RBAC Admin **only on their namespace** using
   `configure-release-access.sh` as the administrator. No release identity needs Contributor,
   role-assignment writes, Key Vault Secrets Officer, or cluster-wide Kubernetes Admin.
   Azure RBAC Admin permits namespace secret access and workload management; protect this identity.
   Test its access to SecretProviderClass and pods/portforward on the actual cluster.
3. Audit inherited assignments and retire the old broad CI identity after validating the replacement.
   Creating narrower assignments does not revoke existing grants. Bicep incremental deployment also
   does not revoke them. Do not point the old bootstrap `ciPrincipalObjectId` at a new release identity.
4. Create `stms-dev` and `stms-prod` GitHub Environments restricted to the protected `saas`, `main`,
   or `master` branches. Require production reviewers, prevent self-approval and administrative bypass,
   and protect workflow changes with repository review rules. Bind OIDC federations to those environments.
   Configure these controls in GitHub/Azure; this PR cannot enforce account-side settings.
5. Initialize databases using the privileged Admin process with verified backups and a restore plan.
   Keep runtime credentials distinct from provisioning credentials. This PR does not change tenant
   topology, existing storage strategies, or the existing Key Vault SQL credential layout.

Environment variables: `RESOURCE_GROUP`, `AKS_CLUSTER_NAME`, `NAMESPACE`, `ACR_NAME`,
`KEY_VAULT_NAME`, `RUNTIME_CLIENT_ID`, `ADMIN_CLIENT_ID`, and `INGRESS_HOST`.
Environment secrets: `AZURE_CLIENT_ID` (release identity), `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, plus `AZURE_BUILD_CLIENT_ID` in dev (registry-only build identity).
The application secrets remain in Key Vault; release jobs no longer receive or rewrite them.
Both environments must use the shared registry recorded in the release manifest.
Helm 3.19.0 is pinned because the recovery scripts use Helm 3 command semantics.
The kubectl client must remain within the supported version skew of the configured AKS version;
update the pinned client with cluster upgrades. Python 3, curl, and Bash are runner prerequisites.

## Delivery

- CI runs a strict Release backend build and tests, Angular lint/test/build, React lint/build,
  recovery regression tests, rendered chart checks, Bicep compilation, and container builds.
  React has no automated behavioral test script. Existing warnings or dependency vulnerabilities
  can block the stricter gates; fix them rather than weakening the gates.
- Dev calls CI before publishing. Each build gets a unique commit/run/attempt tag, then captures
  four immutable digests in `release-manifest`. Scanning, signing, verification, and deployment
  use those captured digests. HIGH/CRITICAL findings, including unfixed ones, block deployment.
- Production takes `dev_run_id`, not a tag. It requires a successful trusted dev workflow,
  downloads that run's manifest, checks out that exact source revision (including chart/scripts),
  validates the registry/source/digests, and verifies signatures before deploying.
  Keep the artifact (90 days) and referenced ACR manifests/signatures for the rollback window.
  An expired artifact blocks promotion; a retained Helm revision can still be restored.
- Both environments serialize deployments and manual rollback using the same workflow concurrency
  group, without automatic cancellation. Operators must not run overlapping out-of-band Helm commands.
  GitHub concurrency is not a durable FIFO queue; intermediate queued pushes may be superseded.

## Recovery behavior

`release-transaction.sh` captures the deployed revision and verifies baseline health before mutation.
Unhealthy, pending, failed, or legacy releases block ordinary deployment; an API/authentication error
is never interpreted as a missing release. It then waits for rollout and checks API `/alive`, API
`/ready`, frontend `/health`, and frontend `/`. Failure restores **the captured revision**, with
hooks disabled, waits for recovery, and repeats health checks. The deployment still exits nonzero.
Recovery failure exits 2 with an explicit operator intervention message. First-install failure
uninstalls only the failed release because no healthy revision exists; it retains the namespace.

Use `rollback_revision` in dev or production workflow dispatch for an explicit retained successful
Helm revision. Production accepts exactly one of `dev_run_id` or `rollback_revision`. The rollback
path does not build, resolve mutable tags, change secrets, or run migrations. It waits and verifies
health. Use `helm history stms -n <namespace>` to identify the revision; never guess revision 0.
A manual rollback failure stays failed and requires an operator, rather than guessing another target.

SIGINT/SIGTERM received by the transaction initiate recovery, but runner loss, SIGKILL, cancellation
of the entire process tree, and exhausted job timeout cannot guarantee cleanup. After such an event,
inspect Helm history/status, deployments, and events with the incident identity, then dispatch an
explicit verified revision. Never delete Helm storage secrets just to clear a pending status.
No routine workflow dumps secret-bearing manifests or Kubernetes Secrets into logs/artifacts.

## One-time transition from chart 1.0

Legacy SecretProviderClass resources were Helm hooks; secret-sync pre-install jobs also referenced
service accounts not yet created on first install. Version 1.1 makes providers ordinary managed
resources and relies on CSI mount synchronization before container startup. Routine migration hooks
are removed. Automated recovery refuses legacy revisions without `rollbackContract: v1`, since
rolling back to their incomplete managed-resource inventory can remove required secret providers.

Before enabling the new CD workflow on an existing installation:

1. Schedule a reviewed baseline transition with an infrastructure operator. Preserve the old chart,
   values, image digests, secret-provider definitions, and database backups in restricted storage.
   Verify restore procedures. Freeze database contracts and secret rotation across this transition.
2. With **the currently running image digests and configuration**, upgrade only the chart to 1.1,
   setting `admin.migrationEnabled=false` and `rollbackContract=v1` as explicit Helm values.
   Do not deploy a new application version in this step. Inspect ownership of existing hook-created
   providers; they must be adopted by this release, never indiscriminately deleted.
3. Migrate replica ownership deliberately: removing `spec.replicas` can briefly reset to one before
   HPA reconciles. Observe Metrics Server, HPA desired/current replicas, PDBs, available endpoints,
   and real traffic. Schedule this transition for low traffic with sufficient capacity.
4. Verify workload identity/CSI, both application smoke checks, TLS ingress, tenant login/task flows,
   and replica availability. Record the successful baseline revision. If transition fails, the
   operator must restore the saved old chart **and hook resources**, not blindly use the new wrapper.
5. Only then enable routine CD. Rollback targets must be at or after this baseline. For a fresh
   installation, provision the database/schema first; the first successful CD release establishes it.

## Migrations and secret rotation

Use expand/contract changes compatible with both the new and rollback application versions.
The optional Admin Job can be rendered separately with `helm template --show-only templates/admin-job.yaml`
using the exact approved values, immutable Admin digest, and `admin.migrationEnabled=true`.
Submit that reviewed Job only after its service account, ConfigMap, SecretProviderClass, network access,
backup/restore evidence, and correct privileged SQL credentials exist. Use a unique Job name per
approved operation and wait for completion. Do not enable migrations in the application release.
Helm rollback never undoes committed SQL, external effects, or secret rotation. CSI still reads current
Key Vault versions: retain backward-compatible secrets throughout the rollback window and rotate them
as a separate operation. An incompatible schema/secret change requires its own recovery plan.

## Probes, scaling, and shutdown

API liveness/startup use dependency-independent `/alive`; readiness uses `/ready`. Frontend has bounded
startup/liveness/readiness probes. Rolling updates permit no unavailable replicas and require 10 seconds
of stable readiness. When HPA is enabled, Helm omits replicas; CPU/memory requests and stabilized scale-down
remain configured. Dev starts at two replicas so its PDB permits one voluntary disruption.
Resource/HPA settings are starting values, not load-tested capacity claims; calibrate with measured traffic.

API and frontend wait 10 seconds in preStop to allow endpoint propagation, then their existing runtime
signal handlers drain work. API gets 60 seconds total (including the default .NET 30-second shutdown);
frontend gets 45 seconds. Validate real requests under SIGTERM/node drain. The read-only API filesystem
has a writable `/tmp`. Kubernetes API token automount is disabled; Azure workload identity separately
projects its audience-specific token. Verify this mutation and CSI access on AKS.
Worker stays disabled: its process-only probes, missing durable adapter, and shutdown lifecycle do not
establish safe processing or autoscaling. This PR does not claim worker readiness.

## Verification and acceptance

```bash
python -m pip install -r deploy/aks/tests/requirements.txt
python -m unittest discover -s deploy/aks/tests -v
python deploy/aks/tests/check_chart.py
```

The tests execute recovery scripts with deterministic command doubles and render both environment charts.
They do not prove Kubernetes/Azure runtime behavior. Before production, use an isolated AKS namespace to
exercise failed image startup, readiness failure, post-rollout smoke failure, first-install cleanup,
failed recovery, process interruption, and explicit rollback. Assert both exact restored digests and
healthy traffic; test HPA scale-up/down, drain, PDBs, RBAC denials, CSI synchronization and TLS ingress.
The smoke checker uses port-forward and therefore does not validate external ingress, TLS, network-policy
reachability, or tenant operations. Run the existing two-tenant adversarial and migration/restore acceptance
suites separately; skipped placeholders are missing evidence. Do not use destructive local provisioning
scripts against existing local data as routine validation.

## Network and DNS prerequisites

The cluster API endpoint is public but can be restricted with `authorizedApiServerIpRanges` in
the environment parameter file. The AKS-managed application-routing controller gets a standard
public load balancer. Microsoft supports the managed NGINX path during the current Gateway API
migration; plan the long-term move to Gateway API or Application Gateway for Containers before
that support window closes.
Point each environment DNS A record at that IP. cert-manager uses HTTP-01 and the production
workflow uses the Let's Encrypt production issuer; use the dev staging issuer to avoid rate limits.

For a private AKS control plane, run the workflows on a self-hosted runner with VNet access and
set `enablePrivateCluster` in `aks.bicep` together with the required private DNS design.
