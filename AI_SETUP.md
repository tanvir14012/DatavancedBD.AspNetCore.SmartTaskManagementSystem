# GitHub Models AI Feature Setup Guide

## Overview
The Smart Task Management System includes an AI-powered task description improvement feature that uses GitHub's free models API through GitHub Copilot. This guide explains how to set up and configure it.

## Prerequisites
- GitHub account with access to GitHub Models
- GitHub CLI (optional, for testing)

## Step-by-Step Setup

### 1. Get Your GitHub Personal Access Token

**Option A: Via GitHub Web UI**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "STMS AI Feature")
4. **Select Scopes:**
   - ✅ `model-usage` (required for GitHub Models)
   - ✅ `api` (recommended for broader access)
5. Click "Generate token"
6. **⚠️ Copy and save the token immediately** (it won't be shown again)

**Option B: Via GitHub CLI**
```bash
gh auth token
```
This will return your current authentication token.

### 2. Get the GitHub Models API Endpoint

The endpoint for GitHub's free models API is:
```
https://models.inference.ai.azure.com
```

This is the official GitHub Models inference endpoint.

### 3. Available Models

GitHub Models offers these free models via Copilot:
- `gpt-4o-mini` ← **Recommended** (best for descriptions)
- `gpt-4o`
- `claude-3.5-sonnet`
- `claude-opus`
- `mistral-large`
- `llama-2-7b`

### 4. Configure appsettings.json

Update your `Api/appsettings.json`:

```json
{
  "Logging": { ... },
  "Authentication": { ... },
  "Ai": {
    "Enabled": true,
    "GitHubModelsApiKey": "github_pat_YOUR_TOKEN_HERE",
    "GitHubModelsEndpoint": "https://models.inference.ai.azure.com",
    "Model": "gpt-4o-mini"
  }
}
```

**Replace `github_pat_YOUR_TOKEN_HERE` with your actual token from Step 1.**

### 5. Alternative: Environment Variables

**For production/security, use environment variables instead:**

```bash
# .env or system environment
export AI_GITHUB_MODELS_API_KEY="github_pat_YOUR_TOKEN_HERE"
export AI_GITHUB_MODELS_ENABLED="true"
export AI_GITHUB_MODELS_ENDPOINT="https://models.inference.ai.azure.com"
export AI_GITHUB_MODELS_MODEL="gpt-4o-mini"
```

Then update `appsettings.json` to read from environment:
```json
"Ai": {
  "Enabled": "${AI_GITHUB_MODELS_ENABLED:false}",
  "GitHubModelsApiKey": "${AI_GITHUB_MODELS_API_KEY}",
  "GitHubModelsEndpoint": "${AI_GITHUB_MODELS_ENDPOINT:https://models.inference.ai.azure.com}",
  "Model": "${AI_GITHUB_MODELS_MODEL:gpt-4o-mini}"
}
```

### 6. Testing the Setup

**Test API Connection (curl):**
```bash
curl -X POST https://models.inference.ai.azure.com/chat/completions \
  -H "Authorization: Bearer github_pat_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Say hello"}],
    "model": "gpt-4o-mini"
  }'
```

**Test via Application UI:**
1. Start the application
2. Go to Tasks page
3. Click "Create Task"
4. Enter a messy description (e.g., "fix bug in login page plz")
5. Click "Improve with AI"
6. Should see improved version after a moment

### 7. Rate Limits & Usage

**Free tier limits:**
- Requests per minute: 15 RPM
- Requests per day: 200 RPD
- Max tokens per request: 4,096

**Monitor usage at:**
https://github.com/account/copilot/billing/summary

### 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| **401 Unauthorized** | Token is invalid or expired. Regenerate at https://github.com/settings/tokens |
| **403 Forbidden** | Token missing `model-usage` scope. Add scope and regenerate. |
| **404 Not Found** | Endpoint URL might be wrong. Use `https://models.inference.ai.azure.com` |
| **429 Too Many Requests** | Hit rate limit. Wait a minute and retry. |
| **Button disabled in UI** | Ensure `"Enabled": true` in appsettings.json |
| **"Failed to improve description"** | Check API credentials, check GitHub Models status, review browser console |

### 9. Security Best Practices

⚠️ **Never commit your token to GitHub!**

**Recommended approach:**
1. Add `appsettings.*.json` to `.gitignore`
2. Use `appsettings.Development.json` for local development
3. Use environment variables/secrets for staging/production
4. For Azure/AWS deployments, use managed secrets services

Example `.gitignore` addition:
```
appsettings.Development.json
appsettings.Production.json
.env
.env.local
```

### 10. Disabling AI Feature

If you want to disable the AI feature:
```json
"Ai": {
  "Enabled": false,
  ...
}
```

The "Improve with AI" button will not appear, and API calls will be skipped.

## Resources

- [GitHub Models Documentation](https://github.com/marketplace/models)
- [Create Personal Access Token](https://github.com/settings/tokens)
- [GitHub Models Status](https://github.com/account/copilot/billing/summary)
- [API Reference](https://docs.github.com/en/github/copilot/github-copilot-chat-in-ide/using-github-copilot-chat-in-your-ide#api-reference)

## Support

For issues with:
- **GitHub Models API**: Visit https://github.com/orgs/community/discussions/categories/github-models
- **This Application**: Check the project's GitHub Issues
