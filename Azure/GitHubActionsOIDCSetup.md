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

## Step 2: Get GitHub Organization ID

Your GitHub username/organization numeric ID is required for the federated credential.

**Via GitHub API:**
```bash
curl https://api.github.com/users/tanvir14012 | jq '.id'
```

Example output:
```
12345678
```

Or visit in browser: `https://api.github.com/users/tanvir14012` and look for the `"id"` field.

## Step 3: Create Federated Credential for GitHub

1. In the app registration, go to **Manage** menu on the left
2. Click **Certificates & secrets**
3. Click **Federated credentials** tab
4. Click **Add credential**
5. Choose credential scenario: **GitHub Actions deploying Azure**
6. Fill in:
   - **Organization**: `12345678` (your GitHub numeric ID from Step 2)
   - **Repository**: `DatavancedBD.AspNetCore.SmartTaskManagementSystem`
   - **Entity type**: Branch
   - **Branch**: `dev`
7. In credential details section:
   - **Name**: `github-dev`
   - **Description**: `GitHub Actions CI/CD for dev branch`
   - **Audience**: `api://AzureADTokenExchange`
8. Click **Add**

## Step 4: Get Subscription ID

1. Search for **Subscriptions**
2. Click your subscription
3. Copy the **Subscription ID**

Or use Azure CLI:
```bash
az account show --query id -o tsv
```

## Step 5: Store Secrets in GitHub

1. Go to GitHub repository
2. Navigate to **Settings** > **Environments**
3. Click **New environment**
4. Name: `Development`
5. Click **Add environment**
6. Add secrets:
   - **AZURE_CLIENT_ID** = (Application ID from Step 1)
   - **AZURE_TENANT_ID** = (Directory ID from Step 1)
   - **AZURE_SUBSCRIPTION_ID** = (Subscription ID from Step 4)

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
```

## Summary

| Item | Value |
|------|-------|
| App Registration Name | `github-actions-stms-dev` |
| GitHub Environment | `Development` |
| Federated Credential Subject | `repo:tanvir14012/DatavancedBD.AspNetCore.SmartTaskManagementSystem:ref:refs/heads/dev` |

---

**Note:** Infrastructure provisioning (resource group creation and role assignment) is automated via Bicep templates. See `infra/` directory for details.
