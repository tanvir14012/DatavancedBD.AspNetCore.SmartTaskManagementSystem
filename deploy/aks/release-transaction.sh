#!/usr/bin/env bash
# Only this process owns recovery. Do not combine with Helm --atomic (double rollback).
set -Eeuo pipefail
: "${NAMESPACE:?NAMESPACE is required}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
timeout="${RELEASE_TIMEOUT:-10m}"
python_bin="${PYTHON_BIN:-python3}"
previous=""
mutating=false

if [[ "${INGRESS_SMOKE_REQUIRED:-true}" == true ]]; then
  "$python_bin" "$root_dir/deploy/aks/ingress-check.py" --validate
fi

# A failed API request must never be interpreted as an absent release.
releases="$(helm list -n "$NAMESPACE" --all --filter '^stms$' -o json)"
exists="$("$python_bin" -c 'import json,sys; print(len(json.load(sys.stdin)))' <<< "$releases")"
if [[ "$exists" != 0 ]]; then
  status="$(helm status stms -n "$NAMESPACE" -o json)"
  previous="$("$python_bin" -c 'import json,sys; s=json.load(sys.stdin); assert s["info"]["status"] == "deployed", "Release is not deployed; reconcile it before deploying"; assert s.get("config", {}).get("rollbackContract") == "v1", "Establish the v1 rollback baseline before using CD"; print(s["version"])' <<< "$status")"
  # Establish that the revision we promise to restore is healthy before changing anything.
  bash "$root_dir/deploy/aks/health-check.sh"
fi

recover() {
  local result=$?
  trap - EXIT INT TERM
  if [[ "$mutating" == true && "$result" != 0 ]]; then
    echo "Release failed; recovering the captured pre-deployment state." >&2
    if [[ -n "$previous" ]]; then
      if helm rollback stms "$previous" -n "$NAMESPACE" --no-hooks --wait --wait-for-jobs --timeout "$timeout" --cleanup-on-fail &&
         bash "$root_dir/deploy/aks/health-check.sh"; then
        echo "Recovery verified: restored revision $previous. Deployment remains failed." >&2
      else
        echo "RECOVERY FAILED. Operator intervention required; do not start another deployment." >&2
        exit 2
      fi
    else
      # No healthy revision existed. Remove only this failed first installation.
      if helm uninstall stms -n "$NAMESPACE" --ignore-not-found --no-hooks --wait --timeout "$timeout"; then
        echo "Failed first installation removed; there was no revision to restore." >&2
      else
        echo "FIRST-INSTALL CLEANUP FAILED. Operator intervention required." >&2
        exit 2
      fi
    fi
  fi
  exit "$result"
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mutating=true
helm upgrade --install stms "$@" -n "$NAMESPACE" --wait --wait-for-jobs \
  --timeout "$timeout" --history-max 20 --cleanup-on-fail
bash "$root_dir/deploy/aks/health-check.sh"
mutating=false
echo "Release rollout and smoke checks passed."
