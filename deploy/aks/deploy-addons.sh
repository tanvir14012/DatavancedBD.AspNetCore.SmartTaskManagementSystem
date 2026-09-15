#!/usr/bin/env bash
set -Eeuo pipefail

: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
: "${AKS_CLUSTER_NAME:?AKS_CLUSTER_NAME is required}"
: "${ACME_EMAIL:?ACME_EMAIL is required}"
: "${ACME_SERVER:?ACME_SERVER is required}"

namespace="${NAMESPACE:?NAMESPACE is required}"
issuer_name="${CERT_ISSUER_NAME:-letsencrypt-prod}"
cert_manager_chart_version="${CERT_MANAGER_CHART_VERSION:-v1.21.1}"

az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER_NAME" \
  --overwrite-existing \
  --only-show-errors
kubelogin convert-kubeconfig -l azurecli

helm repo add jetstack https://charts.jetstack.io --force-update
helm repo update

for _ in {1..60}; do
  if kubectl -n app-routing-system get service nginx >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
kubectl -n app-routing-system get service nginx >/dev/null

helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version "$cert_manager_chart_version" \
  --set crds.enabled=true \
  --set replicaCount=2 \
  --wait --timeout 15m

kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: ${issuer_name}
spec:
  acme:
    email: ${ACME_EMAIL}
    server: ${ACME_SERVER}
    privateKeySecretRef:
      name: ${issuer_name}
    solvers:
      - http01:
          ingress:
            ingressClassName: webapprouting.kubernetes.azure.com
EOF

kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
echo "Cluster add-ons ready."
