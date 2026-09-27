#!/usr/bin/env bash
# Run once as the infrastructure administrator, not from application CD.
set -Eeuo pipefail
: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
: "${AKS_CLUSTER_NAME:?AKS_CLUSTER_NAME is required}"
: "${NAMESPACE:?NAMESPACE is required}"
: "${ACR_NAME:?ACR_NAME is required}"
: "${RELEASE_PRINCIPAL_OBJECT_ID:?Use a dedicated application release identity}"
[[ "$NAMESPACE" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || exit 2
cluster="$(az aks show -g "$RESOURCE_GROUP" -n "$AKS_CLUSTER_NAME" --query id -o tsv)"
registry="$(az acr show -n "$ACR_NAME" --query id -o tsv)"
grant() {
  az role assignment create --assignee-object-id "$RELEASE_PRINCIPAL_OBJECT_ID" \
    --assignee-principal-type ServicePrincipal --role "$1" --scope "$2" --output none
}
grant 'Azure Kubernetes Service Cluster User Role' "$cluster"
grant 'Azure Kubernetes Service RBAC Admin' "$cluster/namespaces/$NAMESPACE"
grant 'AcrPull' "$registry"
echo "Release grants configured. Audit and revoke inherited/legacy broad roles separately."
