#!/usr/bin/env bash
set -Eeuo pipefail

: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"
: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
: "${AKS_CLUSTER_NAME:?AKS_CLUSTER_NAME is required}"
: "${ACR_NAME:?ACR_NAME is required}"
: "${NAMESPACE:?NAMESPACE is required}"
: "${KEY_VAULT_NAME:?KEY_VAULT_NAME is required}"
: "${RUNTIME_CLIENT_ID:?RUNTIME_CLIENT_ID is required}"
: "${ADMIN_CLIENT_ID:?ADMIN_CLIENT_ID is required}"
: "${AZURE_TENANT_ID:?AZURE_TENANT_ID is required}"
: "${RELEASE_MANIFEST:?RELEASE_MANIFEST is required}"
: "${RELEASE_SOURCE:?RELEASE_SOURCE is required}"
: "${INGRESS_HOST:?INGRESS_HOST is required}"

environment="${ENVIRONMENT:?ENVIRONMENT is required}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
issuer_name="${CERT_ISSUER_NAME:-letsencrypt-prod}"
python_bin="${PYTHON_BIN:-python3}"
registry="$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)"

[[ "$environment" == dev || "$environment" == prod ]] || { echo "Invalid environment" >&2; exit 2; }
bash "$root_dir/deploy/aks/connect-cluster.sh"
validated="$("$python_bin" "$root_dir/deploy/aks/release-manifest.py" "$RELEASE_MANIFEST" "$registry" "$RELEASE_SOURCE")"
declare -A digests
while IFS='=' read -r component digest; do
  digests["$component"]="$digest"
done <<< "$validated"

chart_dir="$root_dir/deploy/aks/chart"
values_file="$chart_dir/values-${environment}.yaml"
helm lint "$chart_dir" \
  --values "$values_file" \
  --set-string keyVault.name="$KEY_VAULT_NAME" \
  --set-string workloadIdentity.tenantId="$AZURE_TENANT_ID" \
  --set-string workloadIdentity.runtimeClientId="$RUNTIME_CLIENT_ID" \
  --set-string workloadIdentity.adminClientId="$ADMIN_CLIENT_ID"

bash "$root_dir/deploy/aks/release-transaction.sh" "$chart_dir" \
  --values "$values_file" \
  --set-string environment="$environment" \
  --set-string ingress.host="$INGRESS_HOST" \
  --set-string ingress.tlsSecretName="stms-${environment}-tls" \
  --set-string ingress.annotations.'cert-manager\.io/cluster-issuer'="$issuer_name" \
  --set-string keyVault.name="$KEY_VAULT_NAME" \
  --set-string workloadIdentity.tenantId="$AZURE_TENANT_ID" \
  --set-string workloadIdentity.runtimeClientId="$RUNTIME_CLIENT_ID" \
  --set-string workloadIdentity.adminClientId="$ADMIN_CLIENT_ID" \
  --set-string images.api.repository="$registry/stms-api" \
  --set-string images.api.digest="${digests[api]}" \
  --set-string images.admin.repository="$registry/stms-admin" \
  --set-string images.admin.digest="${digests[admin]}" \
  --set-string images.worker.repository="$registry/stms-worker" \
  --set-string images.worker.digest="${digests[worker]}" \
  --set-string images.frontend.repository="$registry/stms-frontend" \
  --set-string images.frontend.digest="${digests[frontend]}" \
  --set admin.migrationEnabled=false \
  --set-string rollbackContract=v1

echo "Released STMS $environment from source $RELEASE_SOURCE."
