# Smart Task Management System

A full-stack task and project management platform with role-based access control, analytics, and AI-assisted task refinement. This repository contains an ASP.NET Core backend and an Angular frontend.

---

## Project overview
Smart Task Management System is a modern platform for organizing projects and tasks with:

- **Identity & access control:** ASP.NET Core Identity with JWT authentication and role-based access control (RBAC)
- **Project management:** Create, organize, and manage projects and team membership
- **Task management:** Full-featured task lifecycle management with statuses, assignments, and prioritization
- **Dashboard analytics:** Summary metrics, urgency tracking, and team insights
- **AI-assisted features:** Task description improvement using Groq's OpenAI-compatible API
- **Enterprise-ready patterns:** Validation, rate limiting, security headers, auditing, and tracing

---

## Technology stack

### Backend
- **.NET:** .NET 10 with ASP.NET Core
- **API:** ASP.NET Core Web API with Swagger/OpenAPI
- **Database:** SQL Server with Entity Framework Core
- **Authentication:** ASP.NET Core Identity with JWT + refresh tokens
- **Patterns:** CQRS, MediatR, FluentValidation
- **AI integration:** Groq API via OpenAI-compatible endpoint
- **Middleware:** Security headers, rate limiting, audit logging, request tracing, versioning

### Frontend
- **Framework:** Angular 19
- **Styling:** Tailwind CSS + SCSS
- **State management:** RxJS and Angular services
- **HTTP client:** Angular HttpClient with interceptors
- **Forms:** Reactive forms with custom validators
- **Routing:** Feature-based lazy routes
- **Internationalization:** ngx-translate

---

## Setup instructions

### Prerequisites
- **.NET SDK 10+**
- **SQL Server 2019+** or **SQL Server Express**
- **Node.js 20+ and npm 10+**
- **Git**

### Backend setup
#### 1. Configure the database connection
Edit `Api/appsettings.json` and update the connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=SmartTaskManagementSystem;Trusted_Connection=true;Encrypt=false;"
  }
}
```

Or use an environment variable:

```powershell
$env:ConnectionStrings__DefaultConnection = "Your-Connection-String"
```

#### 2. Configure JWT settings
Update the `AuthenticationOptions` section in `Api/appsettings.json`:

```json
{
  "AuthenticationOptions": {
    "JwtKey": "your-secret-key-minimum-32-characters",
    "JwtExpiry": 900,
    "RefreshTokenExpiry": 604800
  }
}
```

#### 3. Set up the database
```bash
cd Api
dotnet restore
dotnet build
dotnet ef database update
```

#### 4. Run the backend
```bash
dotnet run --project Api/Api.csproj
```

Backend endpoints are available at:
- **API:** `http://localhost:5000`
- **Swagger UI:** `http://localhost:5000/swagger`

### Frontend setup
#### 1. Install dependencies
```bash
cd Frontend/Angular
npm install
```

#### 2. Configure the environment
Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  apiUrl: 'http://localhost:5000/api',
  production: false
};
```

#### 3. Run the development server
```bash
npm start
```

The frontend is available at `http://localhost:4200`.

### Optional: AI feature setup
To enable AI-powered task description improvement using Groq:

1. Get a Groq API key from [console.groq.com](https://console.groq.com)
2. Update `Api/appsettings.json`:

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

Configuration details:
- `GroqApiKey`: Your Groq API key
- `GroqEndpoint`: Groq's OpenAI-compatible API endpoint
- `Model`: The Groq model used for prompt completion

See [AI_SETUP.md](./AI_SETUP.md) for the full setup guide.

### IIS deployment
For hosting the Angular frontend and .NET API on IIS, see [DeploymentToIIS.md](./DeploymentToIIS.md).

### nginx deployment on Ubuntu / WSL 2
For a Linux deployment using Ubuntu, nginx, SQL Server, a self-signed certificate, and the system-wide .NET 10 runtime, see [DeploymentToNginx.md](./DeploymentToNginx.md).

---

## API overview

### Authentication endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/auth/refresh` | Refresh JWT token |
| `POST` | `/api/auth/logout` | Logout user |

### Project endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List projects |
| `GET` | `/api/projects/{id}` | Get project details |
| `POST` | `/api/projects` | Create project |
| `PATCH` | `/api/projects/{id}` | Update project |
| `DELETE` | `/api/projects/{id}` | Delete project |

### Task endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks |
| `GET` | `/api/tasks/{id}` | Get task details |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/{id}` | Update task |
| `DELETE` | `/api/tasks/{id}` | Delete task |
| `POST` | `/api/tasks/improve-description` | Improve task description |

### Dashboard endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/summary` | Dashboard summary |

## Folder structure

### Backend
```text
.
├── Api/                          # ASP.NET Core API layer
│   ├── Endpoints/                # API endpoints
│   ├── Services/                 # API-layer services
│   │   ├── AuthService.cs        # Authentication service
│   │   ├── CurrentUser.cs        # Current user context
│   │   ├── IAiService.cs         # AI service interface
│   │   └── GitHubModelsAiService.cs  # Groq-backed AI provider (legacy name)
│   ├── Validators/               # Request validation
│   ├── Options/                  # Configuration options
│   ├── Program.cs                # Application bootstrap
│   └── appsettings.json          # Configuration file
│
├── Application/                  # Business logic layer
├── Domain/                       # Domain models and entities
├── Infrastructure/               # Data access and infrastructure
├── Shared/                       # Shared contracts and utilities
├── Frontend/                     # Angular frontend
├── PROMPTS.md                    # AI prompt strategy guide
├── AI_SETUP.md                   # AI configuration guide
├── VALIDATION_IMPLEMENTATION.md  # Validation guide
└── README.md                     # This file
```

---

## Key features

### 1. Authentication & authorization
- User registration and login
- JWT-based authentication with refresh tokens
- Role-based access control
- Secure password handling

### 2. Project management
- Create and organize projects
- Add team members with role assignments
- Track project status and progress

### 3. Task management
- Full task lifecycle
- Status tracking and workflow
- Assignment and prioritization
- Search, filtering, and kanban board support

### 4. AI-assisted features
- Intelligent task description improvement
- Grammar and clarity enhancement
- Professional tone conversion
- Includes Groq-based provider configuration

### 5. Dashboard & analytics
- Real-time summary metrics
- Project and task insights
- Team activity overview

### 6. Security & compliance
- Rate limiting
- Security headers
- Audit logging
- Request tracing
- Validation and sanitization

---

## Development workflow

### Running locally
**Terminal 1 - Backend:**
```bash
dotnet run --project Api/Api.csproj
```

**Terminal 2 - Frontend:**
```bash
cd Frontend/Angular
npm install
npm start
```

## References
- [AI_SETUP.md](./AI_SETUP.md)
- [PROMPTS.md](./PROMPTS.md)
- [Groq Console](https://console.groq.com)
