# GitHub Actions + Azure OIDC

The repository uses GitHub Actions with Microsoft Entra workload identity federation. No client
secret is stored in GitHub and no Azure administrator credential is embedded in an image.

## Environments

Create these GitHub Environments:

- `stms-dev`: automatic deployment from `saas`, `main`, or `master`.
- `stms-prod`: manual promotion only, with required reviewers and branch/tag restrictions.

Create one dedicated Entra application or user-assigned deployment identity per environment. Add a
federated credential whose subject is:

```text
repo:<owner>/<repo>:environment:stms-dev
repo:<owner>/<repo>:environment:stms-prod
```

Use audience `api://AzureADTokenExchange`.

Grant each deployment identity only the subscription/resource-group permissions required to deploy
its own Bicep resources and the shared ACR. The Bicep template further grants the identity:

- `Key Vault Secrets Officer` on that environment Key Vault, for secret version updates;
- `Azure Kubernetes Service Cluster User Role` on that environment AKS cluster;
- `Azure Kubernetes Service RBAC Cluster Admin` on that environment AKS cluster, required by the
  Helm release job to manage the namespaced release and CRDs.

The deployment identity also receives `AcrPush` on the shared registry; the AKS kubelet identity
receives `AcrPull` only.

Use separate identities for dev and prod. Production approval is enforced by GitHub Environment
protection, not by a value in YAML.

## Required secrets

Set the following secrets in both environments:

| Secret | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | OIDC deployment identity client ID |
| `AZURE_TENANT_ID` | Microsoft Entra tenant |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription |
| `DEFAULT_CONNECTION_STRING` | API/shared SQL connection |
| `STORAGE_TARGET_CONNECTION_STRING` | Tenant storage target connection |
| `JWT_ISSUER` | JWT issuer |
| `JWT_AUDIENCE` | JWT audience |
| `JWT_KEY` | JWT signing key |
| `REDIS_CONNECTION_STRING` | Application Redis connection |
| `TENANT_CATALOG_SQL_CONNECTION_STRING` | Durable tenant catalog connection |
| `TENANT_CATALOG_REDIS_CONNECTION_STRING` | Tenant placement cache connection; defaults to application Redis when omitted |
| `GROQ_API_KEY` | AI provider key |

Set nonsecret deployment variables in the same Environment as documented in
`deploy/aks/README.md`.

## Workflows

- `.github/workflows/ci.yml` runs backend/frontend tests and validates all container builds on pull
  requests and pushes.
- `.github/workflows/dev-cicd.yml` provisions dev infrastructure, publishes images with BuildKit
  provenance/SBOM attestations, scans them with Trivy, updates Key Vault, and deploys immutable digests.
- `.github/workflows/prod-cd.yml` promotes an existing dev image tag after approval, then performs
  the same infrastructure, secret, Helm, migration, and smoke-check gates against prod.

The production workflow never rebuilds source code. It deploys the exact image tag that passed dev,
and Helm resolves each tag to its immutable ACR digest before rollout.
