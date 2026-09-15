#!/usr/bin/env bash
set -Eeuo pipefail

: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"
: "${KEY_VAULT_NAME:?KEY_VAULT_NAME is required}"
: "${DEFAULT_CONNECTION_STRING:?DEFAULT_CONNECTION_STRING is required}"
: "${JWT_ISSUER:?JWT_ISSUER is required}"
: "${JWT_AUDIENCE:?JWT_AUDIENCE is required}"
: "${JWT_KEY:?JWT_KEY is required}"
: "${REDIS_CONNECTION_STRING:?REDIS_CONNECTION_STRING is required}"
: "${TENANT_CATALOG_SQL_CONNECTION_STRING:?TENANT_CATALOG_SQL_CONNECTION_STRING is required}"
: "${GROQ_API_KEY:?GROQ_API_KEY is required when AI is enabled}"

az account set --subscription "$AZURE_SUBSCRIPTION_ID"

put_secret() {
  local name="$1"
  local value="$2"
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "$name" \
    --value "$value" \
    --only-show-errors \
    --output none
}

put_secret DefaultConnection "$DEFAULT_CONNECTION_STRING"
put_secret StorageTargetSharedConnection "${STORAGE_TARGET_CONNECTION_STRING:-$DEFAULT_CONNECTION_STRING}"
put_secret JwtIssuer "$JWT_ISSUER"
put_secret JwtAudience "$JWT_AUDIENCE"
put_secret JwtKey "$JWT_KEY"
put_secret GroqApiKey "$GROQ_API_KEY"
put_secret RedisConnection "$REDIS_CONNECTION_STRING"
put_secret TenantCatalogSqlConnection "$TENANT_CATALOG_SQL_CONNECTION_STRING"
put_secret TenantCatalogRedisConnection "${TENANT_CATALOG_REDIS_CONNECTION_STRING:-$REDIS_CONNECTION_STRING}"

echo "Key Vault secret versions updated for $KEY_VAULT_NAME."
