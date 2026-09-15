#!/usr/bin/env bash
set -Eeuo pipefail

: "${NAMESPACE:?NAMESPACE is required}"
local_port="${HEALTHCHECK_PORT:-18080}"
service_name="${HEALTHCHECK_SERVICE:-stms-api}"
log_file="$(mktemp)"
port_forward_pid=""
cleanup() {
  if [[ -n "$port_forward_pid" ]]; then
    kill "$port_forward_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$log_file"
}
trap cleanup EXIT

kubectl -n "$NAMESPACE" rollout status deployment/stms-api --timeout=10m
kubectl -n "$NAMESPACE" rollout status deployment/stms-frontend --timeout=10m
kubectl -n "$NAMESPACE" port-forward "service/$service_name" "${local_port}:8080" >"$log_file" 2>&1 &
port_forward_pid=$!

for _ in {1..60}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${local_port}/alive" >/dev/null 2>&1; then
    curl --fail --silent --show-error "http://127.0.0.1:${local_port}/ready" >/dev/null
    echo "API liveness and readiness checks passed."
    exit 0
  fi
  sleep 2
done

cat "$log_file" >&2
echo "API smoke check timed out." >&2
exit 1
