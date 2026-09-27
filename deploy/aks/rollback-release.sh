#!/usr/bin/env bash
set -Eeuo pipefail
: "${NAMESPACE:?NAMESPACE is required}"
: "${ROLLBACK_REVISION:?An explicit Helm revision is required}"
[[ "$ROLLBACK_REVISION" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid revision" >&2; exit 1; }
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python_bin="${PYTHON_BIN:-python3}"
bash "$root_dir/deploy/aks/connect-cluster.sh"
history="$(helm history stms -n "$NAMESPACE" --max 256 -o json)"
"$python_bin" -c 'import json,sys; rows=json.load(sys.stdin); target=int(sys.argv[1]); assert any(int(r["revision"]) == target and r["status"] in ("deployed", "superseded") for r in rows), "Revision must be a retained successful release"' "$ROLLBACK_REVISION" <<< "$history"
values="$(helm get values stms -n "$NAMESPACE" --revision "$ROLLBACK_REVISION" -o json)"
"$python_bin" -c 'import json,sys; assert json.load(sys.stdin).get("rollbackContract") == "v1", "Cannot restore a legacy hook-based release through this workflow"' <<< "$values"
# Never run legacy migration/secret hooks when restoring a release.
helm rollback stms "$ROLLBACK_REVISION" -n "$NAMESPACE" --no-hooks --wait --wait-for-jobs \
  --timeout "${RELEASE_TIMEOUT:-10m}" --cleanup-on-fail
bash "$root_dir/deploy/aks/health-check.sh"
echo "Rollback to revision $ROLLBACK_REVISION verified."
