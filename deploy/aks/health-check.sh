#!/usr/bin/env bash
set -Eeuo pipefail
: "${NAMESPACE:?NAMESPACE is required}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python_bin="${PYTHON_BIN:-python3}"

kubectl -n "$NAMESPACE" rollout status deployment/stms-api --timeout=2m
kubectl -n "$NAMESPACE" rollout status deployment/stms-frontend --timeout=2m
workers="$(kubectl -n "$NAMESPACE" get deployment -l app.kubernetes.io/instance=stms,app.kubernetes.io/component=worker -o name)"
if [[ -n "$workers" ]]; then
  kubectl -n "$NAMESPACE" rollout status "$workers" --timeout=2m
fi

"$python_bin" "$root_dir/deploy/aks/port-forward-check.py" stms-api /alive /ready
"$python_bin" "$root_dir/deploy/aks/port-forward-check.py" stms-frontend /health /
if [[ "${INGRESS_SMOKE_REQUIRED:-true}" == true ]]; then
  "$python_bin" "$root_dir/deploy/aks/ingress-check.py"
fi
echo "Release smoke checks passed."
