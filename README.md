# Smart Task Management System

This repository contains a .NET 10 backend for a smart task and project management platform with identity, RBAC, project workflows, dashboard analytics, and AI-assisted task description improvement.

## What is included

- ASP.NET Core minimal API with OpenAPI and health checks
- Entity Framework Core + SQL Server data layer
- ASP.NET Core Identity for user registration and role-based access
- JWT authentication with refresh tokens
- Project and task APIs with search/filter/paging support
- Dashboard summary and urgency tracking
- AI description improver endpoint (uses GitHub Models free tier)
- Security, versioning, rate limiting, tracing, and audit middleware

## Key routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/projects`
- `GET /api/projects/{id}`
- `POST /api/projects`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/dashboard/summary`
- `POST /api/tasks/improve-description` (AI-powered)

## Run locally

1. Update the `Api/appsettings.json` JWT settings if needed.
2. Configure a SQL Server connection string in a local secrets file or environment variable.
3. **For AI feature (optional):** See [AI_SETUP.md](./AI_SETUP.md) for GitHub Models configuration.
4. Run:

   ```bash
   dotnet restore
   dotnet build
   dotnet run --project Api/Api.csproj
   ```

## AI Task Description Improvement

The system includes an AI feature to improve task descriptions. This requires GitHub Models API access:

- **Setup Guide:** [AI_SETUP.md](./AI_SETUP.md)
- **Features:** Grammar correction, clarity improvement, professionalism enhancement
- **Free Tier:** Yes, uses GitHub's free models API (gpt-4o-mini)
- **Configuration:** `Api/appsettings.json` → `"Ai"` section

Quick setup:
1. Get a GitHub personal access token (with `model-usage` scope)
2. Add to `appsettings.json`:
   ```json
   "Ai": {
     "Enabled": true,
     "GitHubModelsApiKey": "github_pat_YOUR_TOKEN_HERE",
     "GitHubModelsEndpoint": "https://models.inference.ai.azure.com",
     "Model": "gpt-4o-mini"
   }
   ```
3. Click "Improve with AI" on task create/edit form

See [AI_SETUP.md](./AI_SETUP.md) for detailed instructions.

## Notes

The solution is structured around the `Application` feature folders and infrastructure bootstrap code. The current implementation emphasizes a working backend foundation that can be extended with UI and deeper business rules as required.
