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
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${INGRESS_HOST:?INGRESS_HOST is required}"
: "${ACME_EMAIL:?ACME_EMAIL is required}"
: "${ACME_SERVER:?ACME_SERVER is required}"

environment="${ENVIRONMENT:?ENVIRONMENT is required}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
issuer_name="${CERT_ISSUER_NAME:-letsencrypt-prod}"
registry="$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)"

case "$IMAGE_TAG" in
  *[!A-Za-z0-9._-]*) echo "IMAGE_TAG contains unsupported characters." >&2; exit 2 ;;
esac

az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --overwrite-existing --only-show-errors
kubelogin convert-kubeconfig -l azurecli

bash "$root_dir/deploy/aks/deploy-addons.sh"

digest_for() {
  az acr manifest show \
    --registry "$ACR_NAME" \
    --name "stms-$1:$IMAGE_TAG" \
    --query digest \
    --output tsv
}

api_digest="$(digest_for api)"
admin_digest="$(digest_for admin)"
worker_digest="$(digest_for worker)"
frontend_digest="$(digest_for frontend)"
for digest in "$api_digest" "$admin_digest" "$worker_digest" "$frontend_digest"; do
  [[ "$digest" == sha256:* ]] || { echo "A published image digest could not be resolved." >&2; exit 1; }
done

chart_dir="$root_dir/deploy/aks/chart"
values_file="$chart_dir/values-${environment}.yaml"
helm lint "$chart_dir" \
  --values "$values_file" \
  --set-string keyVault.name="$KEY_VAULT_NAME" \
  --set-string workloadIdentity.tenantId="$AZURE_TENANT_ID" \
  --set-string workloadIdentity.runtimeClientId="$RUNTIME_CLIENT_ID" \
  --set-string workloadIdentity.adminClientId="$ADMIN_CLIENT_ID"

helm upgrade --install stms "$chart_dir" \
  --namespace "$NAMESPACE" \
  --create-namespace \
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
  --set-string images.api.digest="$api_digest" \
  --set-string images.admin.repository="$registry/stms-admin" \
  --set-string images.admin.digest="$admin_digest" \
  --set-string images.worker.repository="$registry/stms-worker" \
  --set-string images.worker.digest="$worker_digest" \
  --set-string images.frontend.repository="$registry/stms-frontend" \
  --set-string images.frontend.digest="$frontend_digest" \
  --atomic --wait --timeout 30m --history-max 10

bash "$root_dir/deploy/aks/health-check.sh"
echo "Released STMS $environment from immutable image tag $IMAGE_TAG."
