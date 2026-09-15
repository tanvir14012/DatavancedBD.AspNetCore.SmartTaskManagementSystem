#!/usr/bin/env bash
set -Eeuo pipefail

environment="${1:?Usage: deploy-infrastructure.sh <dev|prod>}"
case "$environment" in
  dev|prod) ;;
  *) echo "Environment must be dev or prod." >&2; exit 2 ;;
esac

: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"
: "${AZURE_CLIENT_ID:?AZURE_CLIENT_ID is required}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
location="${AZURE_LOCATION:-southeastasia}"
shared_resource_group="${SHARED_RESOURCE_GROUP:-stms-shared-rg}"
resource_group="${RESOURCE_GROUP:-stms-${environment}-rg}"
acr_name="${ACR_NAME:-stmsplatformacr}"
ci_principal_object_id="${CI_PRINCIPAL_OBJECT_ID:-$(az ad sp show --id "$AZURE_CLIENT_ID" --query id --output tsv)}"

if [[ -z "$ci_principal_object_id" ]]; then
  echo "The deployment identity object ID could not be resolved." >&2
  exit 1
fi

az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az group create --name "$shared_resource_group" --location "$location" --tags application=stms managedBy=bicep environment=shared --output none
az deployment group create \
  --resource-group "$shared_resource_group" \
  --name "stms-shared-${environment}" \
  --mode Incremental \
  --template-file "$root_dir/Azure/infra/shared.bicep" \
  --parameters "@$root_dir/Azure/infra/parameters/shared.json" \
  --parameters acrName="$acr_name" \
  --parameters ciPrincipalObjectId="$ci_principal_object_id" \
  --only-show-errors \
  --output none

az group create --name "$resource_group" --location "$location" --tags application=stms managedBy=bicep environment="$environment" --output none
az deployment group create \
  --resource-group "$resource_group" \
  --name "stms-aks-${environment}" \
  --mode Incremental \
  --template-file "$root_dir/Azure/infra/aks.bicep" \
  --parameters "@$root_dir/Azure/infra/parameters/aks-${environment}.json" \
  --parameters \
    ciPrincipalObjectId="$ci_principal_object_id" \
    acrName="$acr_name" \
    acrResourceGroupName="$shared_resource_group" \
    clusterName="${AKS_CLUSTER_NAME:-stms-${environment}-aks}" \
    keyVaultName="${KEY_VAULT_NAME:-stms-${environment}-kv}" \
    logAnalyticsName="${LOG_ANALYTICS_NAME:-stms-${environment}-law}" \
    namespace="${NAMESPACE:-stms-${environment}}" \
  --only-show-errors \
  --output none

echo "Infrastructure ready for $environment in resource group $resource_group."
