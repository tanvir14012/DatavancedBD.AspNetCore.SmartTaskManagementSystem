# Groq AI Feature Setup Guide

## Overview
The Smart Task Management System uses Groq's OpenAI-compatible API to improve task descriptions. The backend reads the AI configuration from the `Ai` section in `Api/appsettings.json` and enables the feature when `Enabled` is `true` and a valid `GroqApiKey` is present.

> Note: the repository still contains a legacy class name, `GitHubModelsAiService`, but the runtime configuration and request path are Groq-based.

## Prerequisites
- A Groq account and API key from [console.groq.com](https://console.groq.com)
- Access to the Groq API from the machine running the backend
- Optional: `curl` or a REST client for quick connectivity checks

## Step-by-step setup

### 1. Create a Groq API key
1. Sign in to [Groq Console](https://console.groq.com)
2. Open your API keys section
3. Create a new key and copy it immediately
4. Store it in a secure environment variable or secret store

### 2. Configure the AI section in appsettings.json
Update `Api/appsettings.json`:

```json
{
  "Ai": {
    "Enabled": true,
    "GroqApiKey": "gsk_YOUR_GROQ_API_KEY_HERE",
    "GroqEndpoint": "https://api.groq.com/openai/v1",
    "Model": "mixtral-8x7b-32768"
  }
}
```

The important values are:
- `Enabled`: Enables or disables the feature
- `GroqApiKey`: Your Groq API key
- `GroqEndpoint`: Groq's OpenAI-compatible endpoint
- `Model`: The Groq model to use for generation

### 3. Common model choices
Groq supports many fast OpenAI-compatible models. Common examples include:
- `mixtral-8x7b-32768`
- `llama-3.1-70b-versatile`
- `llama-3.3-70b-versatile`
- `gemma2-9b-it`

Choose a model that fits your latency and quality needs. The default in this project is `mixtral-8x7b-32768`.

### 4. Alternative: environment variables
For local development or deployment secrets, prefer environment variables instead of storing the key in source control:

#### PowerShell
```powershell
$env:AI_GROQ_API_KEY = "gsk_YOUR_GROQ_API_KEY_HERE"
$env:AI_GROQ_ENDPOINT = "https://api.groq.com/openai/v1"
$env:AI_GROQ_MODEL = "mixtral-8x7b-32768"
$env:AI_GROQ_ENABLED = "true"
```

Then mirror those values into `Ai` config as needed in your environment-specific configuration.

### 5. Test the connection
Use a quick API request to verify that the key works:

```bash
curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mixtral-8x7b-32768",
    "messages": [{"role": "user", "content": "Improve this task description: fix login page"}],
    "temperature": 0.7
  }'
```

### 6. Validate through the app
1. Start the backend and frontend
2. Open the task creation or task editing screen
3. Enter a rough task description such as `fix login page plz`
4. Click `Improve with AI`
5. Confirm that the text is rewritten into a more polished task description

### 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| **401 Unauthorized** | The API key is missing, invalid, or expired. Regenerate it in Groq Console. |
| **404 Not Found** | Ensure the endpoint is `https://api.groq.com/openai/v1` |
| **429 Too Many Requests** | Wait and retry; the current Groq plan may be rate limited. |
| **Button disabled in UI** | Check that `Ai:Enabled` is `true` and the key is populated. |
| **"Failed to improve description"** | Review the backend logs and verify the Groq endpoint and model name. |

### 8. Security best practices
- Never commit API keys to GitHub
- Prefer environment variables or a secret manager in staging/production
- Keep `appsettings.Development.json` local-only when needed
- Rotate keys if they are exposed or shared

### 9. Disabling the AI feature
If you want to disable AI enhancement temporarily:

```json
"Ai": {
  "Enabled": false,
  "GroqApiKey": "",
  "GroqEndpoint": "https://api.groq.com/openai/v1",
  "Model": "mixtral-8x7b-32768"
}
```

When disabled, the UI will skip the AI improvement flow.

## References
- [Groq Console](https://console.groq.com)
- [Groq Documentation](https://console.groq.com/docs)
- [OpenAI-compatible API reference](https://platform.openai.com/docs/api-reference)

## Support
For issues with this application, check the repo's GitHub issues or review the backend logs while testing the Groq endpoint.
