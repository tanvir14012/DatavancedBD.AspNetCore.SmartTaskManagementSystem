#!/usr/bin/env bash
set -Eeuo pipefail
: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"
: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
: "${AKS_CLUSTER_NAME:?AKS_CLUSTER_NAME is required}"
: "${NAMESPACE:?NAMESPACE is required}"
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --overwrite-existing --only-show-errors
kubelogin convert-kubeconfig -l azurecli
# Namespace and cluster-scoped add-ons are owned by bootstrap, never application CD.
kubectl get namespace "$NAMESPACE" -o name >/dev/null
