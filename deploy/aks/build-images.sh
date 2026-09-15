#!/usr/bin/env bash
set -Eeuo pipefail

: "${ACR_NAME:?ACR_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

registry="$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)"
builder="stms-buildx"
if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
  docker buildx create --name "$builder" --use
else
  docker buildx use "$builder"
fi
docker buildx inspect --bootstrap >/dev/null

build_image() {
  local name="$1"
  local dockerfile="$2"
  local context="${3:-.}"
  docker buildx build \
    --file "$dockerfile" \
    --tag "$registry/stms-${name}:${IMAGE_TAG}" \
    --provenance=true \
    --sbom=true \
    --cache-from "type=gha,scope=stms-${name}" \
    --cache-to "type=gha,mode=max,scope=stms-${name}" \
    --push "$context"
}

build_image api Dockerfile.api
build_image admin Dockerfile.admin
build_image worker Dockerfile.worker
build_image frontend Frontend/Angular/Dockerfile Frontend/Angular

echo "Published immutable source images to $registry with tag $IMAGE_TAG."
