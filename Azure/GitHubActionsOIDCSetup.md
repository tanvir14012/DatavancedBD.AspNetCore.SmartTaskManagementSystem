# GitHub Actions + Azure OIDC Setup Guide (Manual Portal Steps)

This guide documents the manual Azure Portal and GitHub setup for GitHub Actions CI/CD authentication using OpenID Connect (OIDC).

The infrastructure provisioning (resource group, role assignment) is handled separately via Bicep.

## Prerequisites

- Azure subscription
- GitHub repository (public or private)
- Access to Azure Portal
- Access to GitHub repository settings

## Step 1: Create Azure App Registration

1. Open Azure Portal
2. Navigate to **Microsoft Entra ID** > **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: `github-actions-stms-dev`
   - **Supported account types**: Single tenant
5. Click **Register**
6. Copy and save:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## Step 2: Get GitHub Organization ID and Repository ID

Your GitHub username/organization numeric ID and repository numeric ID are required for the federated credential.

**Get Organization ID via GitHub API:**
```bash
curl https://api.github.com/users/tanvir14012 | jq '.id'
```

Example output:
```
44893629
```

Or visit in browser: `https://api.github.com/users/tanvir14012` and look for the `"id"` field.

**Get Repository ID via GitHub API:**
```bash
curl https://api.github.com/repos/tanvir14012/DatavancedBD.AspNetCore.SmartTaskManagementSystem | jq '.id'
```

Example output:
```
1343056561
```

Or visit in browser: `https://api.github.com/repos/tanvir14012/DatavancedBD.AspNetCore.SmartTaskManagementSystem` and look for the `"id"` field.

## Step 3: Create Federated Credential for GitHub

1. In the app registration, go to **Manage** menu on the left
2. Click **Certificates & secrets**
3. Click **Federated credentials** tab
4. Click **Add credential**
5. Choose credential scenario: **GitHub Actions deploying Azure**
6. Fill in:
   - **Organization**: `44893629` (your GitHub organization numeric ID from Step 2)
   - **Repository**: `1343056561` (your GitHub repository numeric ID from Step 2)
   - **Entity type**: Environment (recommended for multi-environment setups)
   - **Environment**: `Development`
7. In credential details section:
   - **Name**: `github-dev`
   - **Description**: `GitHub Actions CI/CD for dev environment`
   - **Audience**: `api://AzureADTokenExchange`
8. Click **Add**

**Note:** The Entity type can be either:
- **Branch**: if you use `ref:refs/heads/dev` (workflow without `environment:` keyword)
- **Environment**: if you use `environment: Development` (recommended for separating dev/qa/prod)

The federated credential subject must match what GitHub sends in the workflow. Use Environment type for better organization.

## Step 4: Assign Contributor Role to Service Principal

The service principal needs permissions to create and manage Azure resources.

1. Go to Azure Portal
2. Search for **Subscriptions**
3. Click your subscription name
4. Go to **Access control (IAM)**
5. Click **Add role assignment**
6. Fill in:
   - **Role**: Contributor (found in "Privileged administrator roles" tab)
   - **Assign access to**: User, group, or service principal
7. Click **Select members**
8. Search for and select: `github-actions-stms-dev`
9. Click **Select**
10. Click **Review + assign**

This grants the service principal Contributor permissions on the subscription, allowing it to create resource groups and deploy resources via Bicep.

## Step 5: Get Subscription ID

1. Search for **Subscriptions**
2. Click your subscription
3. Copy the **Subscription ID**

Or use Azure CLI:
```bash
az account show --query id -o tsv
```

## Step 6: Store Secrets in GitHub

1. Go to GitHub repository
2. Navigate to **Settings** > **Environments**
3. Click **New environment**
4. Name: `Development`
5. Click **Add environment**
6. Add secrets:
   - **AZURE_CLIENT_ID** = (Application ID from Step 1)
   - **AZURE_TENANT_ID** = (Directory ID from Step 1)
   - **AZURE_SUBSCRIPTION_ID** = (Subscription ID from Step 5)

## Usage in GitHub Actions

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: Development
    steps:
      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      
      - name: Verify Azure login
        run: az account show --query '{tenantId: tenantId, subscriptionId: id}' -o table
```

**Important:** The `environment: Development` keyword in the workflow must match the federated credential Entity type and Environment name in Azure.

## Important: Grant Role-Assignment Permission for Bicep-Managed RBAC

Contributor (Step 4) does **not** include `Microsoft.Authorization/roleAssignments/write`. Azure deliberately excludes this action from Contributor to prevent privilege escalation. If your Bicep templates need to assign roles themselves (for example, granting the service principal **Key Vault Secrets Officer** on a Key Vault so the pipeline can write secrets), the deployment will fail with:

```
AuthorizationFailed: The client '...' does not have permission to perform action
'Microsoft.Authorization/roleAssignments/write' at scope '...'
```

This permission can only be granted by someone who already has it (e.g., the subscription Owner) — it **cannot be automated away**, but it only needs to be done **once**. After that, all future role assignments made by Bicep (Key Vault access, managed identity access, storage, etc.) work with no further manual steps.

**One-time fix — run in Azure Cloud Shell** (already authenticated as you, no `az login` needed):

```bash
SP_OBJECT_ID=$(az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv)
RG_ID=$(az group show --name stms-dev-rg --query id -o tsv)

az role assignment create \
  --role "User Access Administrator" \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $RG_ID
```

- Replace `<AZURE_CLIENT_ID>` with the Application (client) ID from Step 1 (same value as the `AZURE_CLIENT_ID` GitHub secret).
- The role is scoped to the **resource group only** (`stms-dev-rg`), not the whole subscription — this keeps the elevated permission as narrow as possible while still letting Bicep manage RBAC for any resource created inside that group.
- Verify success: the command returns a JSON object with `"roleDefinitionName": "User Access Administrator"`.

Once this is granted, Bicep templates can safely include `Microsoft.Authorization/roleAssignments` resources (e.g., to grant the service principal `Key Vault Secrets Officer` on a Key Vault) and the pipeline will run end-to-end with zero manual intervention going forward.

## Troubleshooting

If you see: `AADSTS700213: No matching federated identity record found`

**Solution:** Verify the federated credential subject matches the workflow:
- If workflow uses `environment: Development` → create federated credential with Entity type **Environment** and Environment **Development**
- If workflow uses no environment → create federated credential with Entity type **Branch** and Branch **dev**

The federated credential subject format will be shown in Azure when you view the credential details.

## Summary

| Item | Value |
|------|-------|
| App Registration Name | `github-actions-stms-dev` |
| GitHub Organization ID | `44893629` |
| GitHub Repository ID | `1343056561` |
| GitHub Environment | `Development` |
| Federated Credential Entity Type | Environment |
| Federated Credential Subject | `repo:tanvir14012@44893629/DatavancedBD.AspNetCore.SmartTaskManagementSystem@1343056561:environment:Development` |

---

**Note:** Infrastructure provisioning (resource group creation and role assignment) is automated via Bicep templates. See `infra/` directory for details.

## Additional GitHub Secrets Required for Full Deployment

Beyond the OIDC secrets in Step 6, the pipeline also needs these secrets in the `Development` environment (**Settings** > **Environments** > **Development** > **Add secret**):

| Secret | Purpose |
|--------|---------|
| `SQL_ADMIN_PASSWORD` | Admin password for the Azure SQL Server (`stms-dev-sql-server`), used both when provisioning the server via Bicep and when building the connection string stored in Key Vault |
| `VM_ADMIN_PASSWORD` | Admin password for the Ubuntu VM (`stms-dev-vm`) that hosts nginx + the ASP.NET Core app, used when provisioning the VM via Bicep. Port 22 (SSH) is intentionally **not** opened in the NSG — deployment happens via `az vm run-command`, not SSH |

Use strong, randomly generated values for both (e.g. `openssl rand -base64 24`). These are provisioning-time credentials, not used for day-to-day access.
