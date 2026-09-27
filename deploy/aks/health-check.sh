#!/usr/bin/env bash
set -Eeuo pipefail

: "${NAMESPACE:?NAMESPACE is required}"
local_port="${HEALTHCHECK_PORT:-18080}"
log_file="$(mktemp)"
port_forward_pid=""
cleanup() {
  if [[ -n "$port_forward_pid" ]]; then
    kill "$port_forward_pid" >/dev/null 2>&1 || true
    wait "$port_forward_pid" 2>/dev/null || true
    port_forward_pid=""
  fi
  rm -f "$log_file"
}
trap cleanup EXIT

kubectl -n "$NAMESPACE" rollout status deployment/stms-api --timeout=2m
kubectl -n "$NAMESPACE" rollout status deployment/stms-frontend --timeout=2m
# An enabled worker must also complete its rollout. API errors are not "disabled".
workers="$(kubectl -n "$NAMESPACE" get deployment -l app.kubernetes.io/instance=stms,app.kubernetes.io/component=worker -o name)"
if [[ -n "$workers" ]]; then
  kubectl -n "$NAMESPACE" rollout status "$workers" --timeout=2m
fi

for component in api frontend; do
  kubectl -n "$NAMESPACE" port-forward --address 127.0.0.1 "service/stms-$component" "${local_port}:8080" >"$log_file" 2>&1 &
  port_forward_pid=$!
  paths=(/alive /ready)
  [[ "$component" == api ]] || paths=(/health /)
  for path in "${paths[@]}"; do
    # Bound each attempt and the whole retry window, including readiness failures.
    curl --fail --silent --show-error --connect-timeout 2 --max-time 5 \
      --retry 20 --retry-delay 1 --retry-max-time 60 --retry-all-errors \
      "http://127.0.0.1:${local_port}${path}" >/dev/null
  done
  cleanup
done
echo "API and frontend smoke checks passed."
