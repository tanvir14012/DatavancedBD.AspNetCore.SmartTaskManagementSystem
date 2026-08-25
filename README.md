# Smart Task Management System

A comprehensive full-stack task and project management platform with real-time AI-assisted task descriptions, role-based access control, and analytics. This monorepo includes an ASP.NET Core 10 backend API and an Angular 19 frontend application.

---

## Project Overview

Smart Task Management System is a modern, feature-rich platform for managing projects and tasks with advanced capabilities:

- **Identity & Access Control:** ASP.NET Core Identity with JWT authentication and role-based access control (RBAC)
- **Project Management:** Create, organize, and manage projects with team members
- **Task Management:** Full-featured task lifecycle management with status tracking, assignment, and prioritization
- **Dashboard Analytics:** Real-time dashboard with project summary, task urgency tracking, and team metrics
- **AI-Assisted Features:** Intelligent task description improvement using GitHub Models API (free tier available)
- **Enterprise Ready:** Comprehensive security, audit logging, rate limiting, request tracing, and versioning

---

## Technology Stack

### Backend
- **.NET:** .NET 10 with ASP.NET Core
- **API:** Minimal APIs with OpenAPI/Swagger documentation
- **Database:** SQL Server with Entity Framework Core 9
- **Authentication:** ASP.NET Core Identity with JWT + Refresh Tokens
- **Patterns:** CQRS (Command Query Responsibility Segregation), MediatR
- **Validation:** FluentValidation
- **AI Integration:** Groq API for high-speed AI inference
- **Middleware:** Security headers, rate limiting, audit logging, request tracing, versioning

### Frontend
- **Framework:** Angular 19 (Standalone Components)
- **Styling:** Tailwind CSS + SCSS
- **State Management:** RxJS Observables
- **HTTP Client:** Angular HttpClient with Interceptor Pipeline
- **Forms:** Reactive Forms with Custom Validators
- **Routing:** Feature-based lazy-loaded routes
- **Internationalization:** ngx-translate (9 languages supported)
- **UI Components:** Angular Material, Custom Components

### DevOps & Tools
- **Language:** C#, TypeScript
- **Version Control:** Git
- **API Documentation:** OpenAPI/Swagger
- **Build Tools:** dotnet CLI, npm/Node.js
- **Web Server:** nginx (Frontend deployment)

---

## Setup Instructions

### Prerequisites

- **.NET SDK 10+** - [Download](https://dotnet.microsoft.com/download)
- **SQL Server 2019+** or **SQL Server Express** - [Download](https://www.microsoft.com/sql-server/sql-server-downloads)
- **Node.js 20+ & npm 10+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

### Backend Setup

#### 1. Configure Database Connection

Edit `Api/appsettings.json` and update the connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=SmartTaskManagementSystem;Trusted_Connection=true;Encrypt=false;"
  }
}
```

Or use environment variable:
```bash
$env:ConnectionStrings__DefaultConnection = "Your-Connection-String"
```

#### 2. Configure JWT Settings

Update `Api/appsettings.json` JWT section:

```json
{
  "AuthenticationOptions": {
    "JwtKey": "your-secret-key-minimum-32-characters",
    "JwtExpiry": 900,
    "RefreshTokenExpiry": 604800
  }
}
```

#### 3. Setup Database

```bash
cd Api
dotnet restore
dotnet build
dotnet ef database update
```

#### 4. Run Backend API

```bash
dotnet run --project Api/Api.csproj
```

Backend will be available at:
- **API:** `http://localhost:5000`
- **Swagger UI:** `http://localhost:5000/swagger`

### Frontend Setup

#### 1. Install Dependencies

```bash
cd Frontend/Angular
npm install
```

#### 2. Configure Environment

Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  apiUrl: 'http://localhost:5000/api',
  production: false
};
```

#### 3. Run Development Server

```bash
npm start
```

Frontend will be available at `http://localhost:4200`

#### 4. Build for Production

```bash
npm run build
# Output in dist/ folder
```

### Optional: AI Feature Setup

To enable AI-powered task description improvement using Groq API:

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

**Configuration Details:**
- `GroqApiKey`: Your Groq API key from the console
- `GroqEndpoint`: Groq's OpenAI-compatible API endpoint
- `Model`: Available models include `mixtral-8x7b-32768`, `llama-2-70b-chat`, `gemma-7b-it`

See [AI_SETUP.md](./AI_SETUP.md) for detailed AI configuration and available models.

---

## API Overview

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/auth/refresh` | Refresh JWT token |
| `POST` | `/api/auth/logout` | Logout user |

**Sample Login Request:**
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

### Project Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects (paginated, searchable) |
| `GET` | `/api/projects/{id}` | Get project details |
| `POST` | `/api/projects` | Create new project |
| `PATCH` | `/api/projects/{id}` | Update project |
| `DELETE` | `/api/projects/{id}` | Delete project |
| `GET` | `/api/projects/{id}/members` | Get project members |

### Task Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks (searchable, filterable) |
| `GET` | `/api/tasks/{id}` | Get task details |
| `POST` | `/api/tasks` | Create new task |
| `PATCH` | `/api/tasks/{id}` | Update task |
| `DELETE` | `/api/tasks/{id}` | Delete task |
| `POST` | `/api/tasks/{id}/assign` | Assign task to user |
| `GET` | `/api/tasks/board/{projectId}` | Get task board (Kanban) |
| `POST` | `/api/tasks/improve-description` | **[AI]** Improve task description |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/summary` | Get dashboard summary with metrics |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List users |
| `GET` | `/api/users/{id}` | Get user details |
| `POST` | `/api/users` | Create user (admin) |
| `PATCH` | `/api/users/{id}` | Update user |
| `DELETE` | `/api/users/{id}` | Delete user |

**Full API documentation available at:** `http://localhost:5000/swagger`

---

## Folder Structure

### Backend (Root)

```
.
├── Api/                          # ASP.NET Core API layer
│   ├── Endpoints/                # API endpoint handlers (organized by feature)
│   │   ├── Auth/                 # Authentication endpoints
│   │   ├── Project/              # Project management endpoints
│   │   ├── Task/                 # Task management endpoints
│   │   ├── Dashboard/            # Dashboard analytics endpoints
│   │   └── User/                 # User management endpoints
│   ├── Services/                 # API-layer services
│   │   ├── AuthService.cs        # Authentication service
│   │   ├── CurrentUser.cs        # Current user context
│   │   ├── IAiService.cs         # AI service interface
│   │   └── GitHubModelsAiService.cs
│   ├── Validators/               # Request validation
│   ├── Options/                  # Configuration options
│   ├── Program.cs                # Application bootstrap
│   └── appsettings.json          # Configuration file
│
├── Application/                  # Business logic layer (CQRS)
│   ├── Features/                 # Application features (organized by domain)
│   │   ├── Auth/                 # Authentication commands/queries
│   │   ├── Project/              # Project management commands/queries
│   │   ├── Task/                 # Task management commands/queries
│   │   ├── Dashboard/            # Dashboard queries
│   │   └── MenuItem/             # Navigation menu queries
│   ├── Interfaces/               # Abstractions for infrastructure
│   │   ├── IAppDbContext.cs      # Database context interface
│   │   ├── IAuthService.cs       # Authentication service interface
│   │   ├── ICacheService.cs      # Caching interface
│   │   └── ICurrentUser.cs       # Current user interface
│   ├── Models/                   # Application models
│   └── DependencyInjection.cs    # Service registration
│
├── Domain/                       # Domain models (entities)
│   ├── AppUser.cs                # User entity
│   ├── AppRole.cs                # Role entity
│   ├── Project.cs                # Project entity
│   ├── UserProject.cs            # User-Project relationship
│   ├── ProjectTask.cs            # Task entity
│   ├── UserTask.cs               # User-Task relationship
│   ├── MenuItem.cs               # Navigation menu item
│   ├── RefreshToken.cs           # Token entity
│   ├── BaseEntity.cs             # Base entity with ID
│   ├── AuditableEntity.cs        # Auditable base entity
│   ├── Enums/                    # Domain enums
│   └── Interfaces/               # Domain interfaces
│       ├── IAuditable.cs         # Audit logging interface
│       ├── ISoftDeletable.cs     # Soft delete interface
│       └── IMultiTenant.cs       # Multi-tenancy interface
│
├── Infrastructure/               # Infrastructure & Data Access
│   ├── Data/                     # EF Core DbContext
│   ├── Services/                 # Infrastructure services
│   ├── Repositories/             # Data access patterns
│   └── Persistence/              # Database configuration
│
├── Shared/                       # Shared utilities and contracts
│   ├── Constants/                # Application constants
│   ├── Exceptions/               # Custom exceptions
│   ├── Extensions/               # Extension methods
│   ├── Contracts/                # DTOs and contracts
│   └── Helpers/                  # Helper utilities
│
├── Frontend/                     # Angular frontend
│   ├── Angular/                  # Main Angular app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/         # Singleton services, guards, interceptors
│   │   │   │   ├── features/     # Feature modules (lazy-loaded)
│   │   │   │   ├── shared/       # Reusable components and utilities
│   │   │   │   ├── layout/       # App shell components
│   │   │   │   └── app.ts        # Root component
│   │   │   ├── assets/           # Static assets and translations
│   │   │   ├── environments/     # Environment configurations
│   │   │   └── styles/           # Global styles
│   │   └── angular.json          # Angular configuration
│   └── nginx/                    # nginx configuration for production
│
├── PROMPTS.md                    # AI prompt strategy guide
├── AI_SETUP.md                   # AI feature configuration guide
├── VALIDATION_IMPLEMENTATION.md  # Validation framework guide
└── README.md                     # This file
```

### Frontend Project Structure

```
Frontend/Angular/src/app/
├── core/                         # Singleton infrastructure
│   ├── guards/                   # Route guards (auth, role-based)
│   ├── interceptors/             # HTTP interceptors
│   ├── resolvers/                # Route resolvers
│   ├── services/                 # Core services
│   │   ├── auth.service.ts       # Authentication
│   │   ├── project.service.ts    # Project API calls
│   │   ├── task.service.ts       # Task API calls
│   │   ├── dashboard.service.ts  # Dashboard API calls
│   │   └── user.service.ts       # User management
│   └── models/                   # Core data models
│
├── features/                     # Feature-based organization (lazy-loaded)
│   ├── auth/                     # Login & Register pages
│   ├── dashboard/                # Dashboard page
│   ├── projects/                 # Project management pages
│   ├── tasks/                    # Task management pages
│   ├── users/                    # User management pages
│   └── home/                     # Homepage
│
├── shared/                       # Reusable components & utilities
│   ├── validators/               # Custom form validators
│   ├── pipes/                    # Custom pipes
│   ├── directives/               # Custom directives
│   └── helpers/                  # Utility functions
│
├── layout/                       # App shell components
│   ├── app-shell.component.ts    # Main layout wrapper
│   ├── top-nav.component.ts      # Header/Navbar
│   └── side-nav.component.ts     # Sidebar navigation
│
├── app.ts                        # Root component
├── app.routes.ts                 # Application routing config
└── app.config.ts                 # Application configuration
```

---

## Key Features

### 1. **Authentication & Authorization**
- User registration and login with email validation
- JWT-based authentication with refresh token rotation
- Role-based access control (RBAC)
- Secure password storage with hashing
- Token expiration and renewal

### 2. **Project Management**
- Create and organize projects
- Add team members with role assignments
- Track project status and timeline
- Project-level access control

### 3. **Task Management**
- Full task lifecycle (Create, Read, Update, Delete)
- Task status tracking and workflow
- Task assignment to team members
- Priority and urgency classification
- Task filtering and search capabilities
- Kanban board view for visual task management

### 4. **AI-Assisted Features**
- Intelligent task description improvement
- Grammar and clarity enhancement
- Professional tone conversion
- Uses GitHub Models free tier (gpt-4o-mini)

### 5. **Dashboard & Analytics**
- Real-time dashboard summary
- Project metrics and statistics
- Task urgency tracking
- Team member activity overview

### 6. **Security & Compliance**
- Rate limiting to prevent abuse
- Security headers for XSS/CSRF protection
- Audit logging of critical actions
- Request tracing and monitoring
- Data validation and sanitization

---

## Development Workflow

### Running Locally

**Terminal 1 - Backend:**
```bash
cd Api
dotnet run
```

**Terminal 2 - Frontend:**
```bash
cd Frontend/Angular
npm start
```

### Testing

**Backend Tests:**
```bash
dotnet test
```

**Frontend Tests:**
```bash
npm test
```

### Code Quality

- **Backend:** Code analysis via .NET analyzers
- **Frontend:** ESLint, Prettier code formatting

---

## Documentation Files

- **[AI_SETUP.md](./AI_SETUP.md)** - Complete AI feature configuration guide
- **[PROMPTS.md](./PROMPTS.md)** - AI prompt strategy and design
- **[VALIDATION_IMPLEMENTATION.md](./VALIDATION_IMPLEMENTATION.md)** - Validation framework details
- **[Frontend/Angular/README.md](./Frontend/Angular/README.md)** - Angular application documentation

---

## Deployment

### Backend Deployment

```bash
dotnet publish -c Release -o ./publish
```

### Frontend Deployment

```bash
npm run build
# Deploy dist/ folder to web server or nginx
```

See `Frontend/nginx/nginx.conf` for production nginx configuration.

---

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Submit a pull request with description
4. Ensure all tests pass
5. Code review approval required

---

## Support & Documentation

For questions or issues:
- Check existing documentation files
- Review API documentation at `/swagger` endpoint
- Check issue tracker on GitHub

---

## License

See [LICENSE.txt](./LICENSE.txt) for details.
