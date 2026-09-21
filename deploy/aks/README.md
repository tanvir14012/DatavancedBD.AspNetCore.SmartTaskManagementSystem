# AKS production deployment

For local Docker validation before an AKS deployment, use
[`deploy/local/README.md`](../local/README.md). It provisions nine fictional companies across
dedicated-database, schema, and shared-row layouts and validates API and Angular containers together.
It is an acceptance harness only; it does not replace the production catalog, Key Vault, managed SQL,
Redis, or Helm migration path described here.

This directory contains the deployable AKS release, not just a design contract.

The deployment has three layers:

1. `Azure/infra/shared.bicep` creates the shared Premium ACR.
2. `Azure/infra/aks.bicep` creates one cluster per environment with Azure CNI Overlay,
   Entra ID/RBAC, OIDC workload identity, Key Vault CSI, the AKS-managed application-routing
   add-on, Container Insights log collection, autoscaling, managed identities and
   least-privilege ACR/Key Vault access.
3. `chart/` deploys API, Angular, and the reviewed Admin migration Job. The Worker is intentionally
   disabled until the application supplies a durable queue and `ITenantWorkHandler`; it fails closed
   rather than acknowledging work it cannot execute.

## Bootstrap

Create two GitHub Environments named `stms-dev` and `stms-prod`. `stms-prod` must require reviewers.
Each environment needs these variables:

| Variable | Example dev value |
| --- | --- |
| `AZURE_LOCATION` | `southeastasia` |
| `CI_PRINCIPAL_OBJECT_ID` | Object ID of the environment deployment service principal |
| `SHARED_RESOURCE_GROUP` | `stms-shared-rg` |
| `RESOURCE_GROUP` | `stms-dev-rg` |
| `ACR_NAME` | `stmsplatformacr` |
| `AKS_CLUSTER_NAME` | `stms-dev-aks` |
| `KEY_VAULT_NAME` | `stms-dev-kv` |
| `NAMESPACE` | `stms-dev` |
| `INGRESS_HOST` | `stms-dev.example.com` |
| `ACME_EMAIL` | `platform@example.com` |

Each environment also needs OIDC secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and
`AZURE_SUBSCRIPTION_ID`, plus the runtime secrets consumed by
`sync-keyvault-secrets.sh`: `DEFAULT_CONNECTION_STRING`, `STORAGE_TARGET_CONNECTION_STRING`,
`JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_KEY`, `REDIS_CONNECTION_STRING`,
`TENANT_CATALOG_SQL_CONNECTION_STRING`, optional `TENANT_CATALOG_REDIS_CONNECTION_STRING`, and
`GROQ_API_KEY`.

The deployment identity must be allowed to create the narrowly scoped role assignments in the
shared and environment resource groups. The Bicep deployment grants it `AcrPush`, Key Vault Secrets Officer,
and AKS Kubernetes RBAC Cluster Admin at the cluster scope because Helm must manage the release
namespace. The cluster kubelet receives `AcrPull` only.
Use a dedicated identity per environment; do not reuse a human account.

## Manual run

```bash
az login
export AZURE_SUBSCRIPTION_ID="..."
export AZURE_CLIENT_ID="..."
export AKS_CLUSTER_NAME="stms-dev-aks"
export KEY_VAULT_NAME="stms-dev-kv"
export RESOURCE_GROUP="stms-dev-rg"
export NAMESPACE="stms-dev"
export ACR_NAME="stmsplatformacr"

bash deploy/aks/deploy-infrastructure.sh dev
bash deploy/aks/sync-keyvault-secrets.sh
export IMAGE_TAG="<immutable-commit-sha>"
bash deploy/aks/deploy-release.sh
```

The release uses `helm upgrade --install --atomic --wait`. Admin migrations run as a Helm
`pre-install,pre-upgrade` hook before API/Worker changes. Images are resolved from ACR tags to
digests before Helm is invoked. The same digest is promoted to production by running
`.github/workflows/prod-cd.yml` with the dev image tag after the production environment approval.

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
