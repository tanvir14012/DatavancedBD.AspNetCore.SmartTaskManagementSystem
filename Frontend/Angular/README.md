# Angular Frontend - Smart Task Management System

Modern Angular 19 web application for the Smart Task Management System. Provides a responsive user interface for task management, project organization, team collaboration, and real-time dashboard analytics.

---

## Project Overview

This is a comprehensive Angular 19 frontend application that consumes the ASP.NET Core backend API. It delivers a complete task management experience with:

- **User Authentication:** Secure login and registration with JWT tokens
- **Dashboard Analytics:** Real-time metrics and project overview
- **Project Management:** Create, organize, and manage projects with team members
- **Task Management:** Full-featured task board with Kanban-style workflow
- **User Management:** Team member administration and role assignment
- **Responsive Design:** Mobile-friendly interface using Tailwind CSS
- **Internationalization:** Support for 9 languages
- **Secure:** HTTP interceptors, route guards, and role-based access control

---

## Technology Stack

### Core Framework
- **Angular 19** - Latest standalone components & signals
- **TypeScript 5.x** - Type-safe development
- **RxJS 7.x** - Reactive programming

### Styling & UI
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **SCSS** - Enhanced CSS with nesting and variables
- **Angular Material** - Pre-built UI components (optional)

### HTTP & State Management
- **Angular HttpClient** - HTTP communication
- **RxJS Observables** - Reactive state management
- **Interceptors** - HTTP interceptor pipeline for auth, logging, errors

### Forms & Validation
- **Reactive Forms** - Type-safe form handling
- **FluentValidation compatible** - Server-side validation integration
- **Custom Validators** - Business logic validation

### Routing & Navigation
- **Lazy-loaded Routes** - Feature-based code splitting
- **Route Guards** - Authentication and authorization
- **Route Resolvers** - Pre-load data before navigation

### Internationalization
- **ngx-translate** - Multi-language support
- **9 Languages:** English, Spanish, French, Portuguese, Russian, Arabic, Hindi, Bengali, Mandarin

### Development Tools
- **Angular CLI 19** - Project scaffolding and builds
- **Prettier** - Code formatting
- **ESLint** - Code quality

---

## Setup Instructions

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm 10+** - Included with Node.js
- **Angular CLI 19** - Install globally: `npm install -g @angular/cli@19`
- **Running Backend API** - See root [README.md](../../README.md)

### Installation

#### 1. Navigate to Angular Project

```bash
cd Frontend/Angular
```

#### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including Angular, Tailwind CSS, ngx-translate, and development tools.

#### 3. Configure Environment

Edit `src/environments/environment.ts` for development:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
};
```

Edit `src/environments/environment.prod.ts` for production:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com/api',
};
```

#### 4. Run Development Server

```bash
npm start
```

The application will be available at `http://localhost:4200`

The dev server automatically reloads when you modify source files.

---

## Development Commands

### Start Development Server
```bash
npm start
```
Runs the application with hot reload on `http://localhost:4200`

### Build for Production
```bash
npm run build
```
Creates optimized production build in `dist/` folder

### Run Unit Tests
```bash
npm test
```
Executes tests using Karma test runner

### Lint Code
```bash
npm run lint
```
Checks code quality with ESLint

### Format Code
```bash
npm run format
```
Auto-formats code with Prettier

### Development Server with HTTPS
```bash
npm run start:https
```
Runs the dev server over HTTPS with local certificates

---

## Project Structure

### `src/app/` - Application Code

#### `core/` - Singleton Infrastructure
Centralized services and infrastructure that should exist once per application:

```
core/
├── guards/                       # Route access control
│   ├── auth.guard.ts             # Requires authentication
│   ├── no-auth.guard.ts          # Restricts authenticated users
│   ├── project-role.guard.ts     # Project-level role checking
│   └── task-board.guard.ts       # Task board access control
│
├── interceptors/                 # HTTP interceptor pipeline
│   ├── auth.interceptor.ts       # Adds JWT token to requests
│   ├── error.interceptor.ts      # Centralized error handling
│   └── loading.interceptor.ts    # Loading state management
│
├── resolvers/                    # Route data pre-loading
│   └── dashboard.resolver.ts     # Pre-loads dashboard data
│
├── services/                     # Core domain services
│   ├── auth.service.ts           # Authentication & token management
│   ├── project.service.ts        # Project API communication
│   ├── task.service.ts           # Task API communication
│   ├── dashboard.service.ts      # Dashboard API communication
│   ├── menu.service.ts           # Navigation menu management
│   └── user.service.ts           # User management API
│
└── models/                       # TypeScript interfaces
    └── menu-item.model.ts        # Navigation menu model
```

#### `features/` - Feature Modules (Lazy-Loaded)
Feature-based organization keeps related screens and logic together:

```
features/
├── auth/                         # Authentication pages (login, register)
│   ├── login.page.ts             # Login form component
│   ├── login.page.html
│   ├── login.page.scss
│   ├── register.page.ts          # Registration form component
│   ├── register.page.html
│   └── register.page.scss
│
├── dashboard/                    # Dashboard feature
│   ├── dashboard.page.ts         # Main dashboard component
│   ├── dashboard.page.html
│   └── dashboard.page.scss
│
├── projects/                     # Project management feature
│   ├── projects.page.ts          # Projects list
│   ├── projects.page.html
│   ├── projects.page.scss
│   ├── project-form.page.ts      # Create/edit project
│   ├── project-form.page.html
│   ├── project-form.page.scss
│   ├── project-assignments.page.ts  # Manage project members
│   ├── project-assignments.page.html
│   └── project-assignments.page.scss
│
├── tasks/                        # Task management feature
│   ├── tasks.page.ts             # Tasks list
│   ├── tasks.page.html
│   ├── tasks.page.scss
│   ├── task-board.page.ts        # Kanban board view
│   ├── task-board.page.html
│   └── task-board.page.scss
│
├── users/                        # User management feature
│   ├── users.page.ts             # Users list
│   ├── users.page.html
│   └── users.page.scss
│
└── home/                         # Home/landing page
    ├── homepage.page.ts
    ├── homepage.page.html
    └── homepage.page.scss
```

#### `shared/` - Reusable Components & Utilities
Shared across multiple features:

```
shared/
├── components/                   # Reusable UI components
│   ├── form-field/
│   ├── loading-spinner/
│   └── error-message/
│
├── validators/                   # Custom form validators
│   └── custom-validators.ts
│
├── pipes/                        # Custom pipes (if any)
│   └── date-format.pipe.ts
│
├── directives/                   # Custom directives
│   └── require-permission.directive.ts
│
└── models/                       # Shared TypeScript interfaces
    ├── project.model.ts
    ├── task.model.ts
    └── user.model.ts
```

#### `layout/` - App Shell Components
Main layout components used throughout the application:

```
layout/
├── app-shell.component.ts        # Main layout wrapper
├── app-shell.component.html      # Layout template
├── app-shell.component.scss      # Layout styles
├── top-nav.component.ts          # Header/Navbar
├── top-nav.component.html
├── top-nav.component.scss
├── side-nav.component.ts         # Sidebar navigation
├── side-nav.component.html
└── side-nav.component.scss
```

### `src/` - Application Entry Point

```
src/
├── app.ts                        # Root component
├── app.routes.ts                 # Application routing configuration
├── app.config.ts                 # Application dependency injection
├── app.html                      # Root template
├── app.scss                      # Global component styles
├── main.ts                       # Bootstrap application
├── index.html                    # HTML entry point
├── styles.scss                   # Global styles
├── styles/
│   └── _usm-utils.scss           # Utility classes
├── assets/                       # Static assets
│   └── i18n/                     # Translation files
│       ├── en.json               # English
│       ├── es.json               # Spanish
│       ├── fr.json               # French
│       ├── pt.json               # Portuguese
│       ├── ru.json               # Russian
│       ├── ar.json               # Arabic
│       ├── hi.json               # Hindi
│       ├── bn.json               # Bengali
│       └── zh.json               # Mandarin Chinese
└── environments/                 # Environment configurations
    ├── environment.ts            # Development
    └── environment.prod.ts       # Production
```

---

## Key Design Patterns

### 1. **Feature-Based Organization**
Business capabilities are grouped under `features/` so screens and related logic stay close together. This improves maintainability and scalability.

```
features/
├── projects/           ← All project-related screens & logic
├── tasks/              ← All task-related screens & logic
└── auth/               ← Authentication pages
```

### 2. **Core/Shared Separation**
- **Core:** Singleton infrastructure (services, guards, interceptors)
- **Shared:** Reusable components, directives, validators used across features

### 3. **Standalone Components**
Modern Angular using standalone components for simpler dependency injection:

```typescript
@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  // ...
})
export class TaskBoardPage { }
```

### 4. **Lazy-Loaded Routes**
Feature routes load on-demand to minimize initial bundle size:

```typescript
const routes: Routes = [
  { path: 'projects', loadComponent: () => import('./features/projects/projects.page').then(m => m.ProjectsPage) }
];
```

### 5. **Interceptor Pipeline**
HTTP requests flow through a series of interceptors:

```
Request → Auth Interceptor → Loading Interceptor → HTTP Call
Response → Error Interceptor → Loading Interceptor → Component
```

### 6. **Route Guards for Authorization**
Protect routes based on authentication status and user role:

```typescript
{
  path: 'admin',
  component: AdminPage,
  canActivate: [authGuard, roleGuard(['Admin'])]
}
```

### 7. **Reactive Forms with Custom Validators**
Type-safe form handling with custom validation:

```typescript
this.form = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, customPasswordValidator()]],
});
```

### 8. **RxJS Observables for State**
Reactive patterns using RxJS for data flow:

```typescript
tasks$ = this.taskService.getTasks();
filteredTasks$ = this.filter$.pipe(
  switchMap(filter => this.taskService.getTasks(filter))
);
```

---

## Authentication Flow

1. **User Registers:**
   - Submits email and password
   - Backend creates account
   - Auto-redirects to login

2. **User Logs In:**
   - Submits credentials
   - Backend validates and returns JWT + Refresh Token
   - App stores tokens in localStorage
   - HTTP interceptor adds JWT to requests

3. **JWT Usage:**
   - Each API request includes `Authorization: Bearer <token>` header
   - Token includes user ID, email, and roles

4. **Token Refresh:**
   - When JWT expires, interceptor uses refresh token to get new JWT
   - Refresh token automatically renewed on each login

5. **Logout:**
   - Clear stored tokens
   - Redirect to login page
   - Notify backend

---

## Internationalization (i18n)

The app supports 9 languages using ngx-translate:

**Supported Languages:**
- English (en)
- Spanish (es)
- French (fr)
- Portuguese (pt)
- Russian (ru)
- Arabic (ar)
- Hindi (hi)
- Bengali (bn)
- Mandarin Chinese (zh)

**Usage:**
```html
<!-- Template -->
<h1>{{ 'PROJECT.TITLE' | translate }}</h1>
```

```typescript
// Component
constructor(private translate: TranslateService) {
  this.translate.use('en');
}
```

Translation files are in `src/assets/i18n/`

---

## Common Tasks

### Adding a New Page

1. Generate component in feature folder
2. Create route in `app.routes.ts`
3. Add to navigation menu
4. Implement component logic

### Calling Backend API

```typescript
// In service
getTasks(): Observable<Task[]> {
  return this.http.get<Task[]>(`${this.apiUrl}/tasks`);
}

// In component
tasks$ = this.taskService.getTasks();

// In template
<div *ngFor="let task of tasks$ | async">
  {{ task.title }}
</div>
```

### Adding Form Validation

```typescript
form = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});

// In template
<input formControl="email">
<small *ngIf="form.get('email')?.hasError('email')">
  {{ 'VALIDATION.INVALID_EMAIL' | translate }}
</small>
```

### Protecting Routes

```typescript
// Define routes with guards
{
  path: 'admin',
  component: AdminComponent,
  canActivate: [authGuard, roleGuard(['Admin'])]
}
```

---

## Building & Deployment

### Build Optimization

```bash
# Development build (unoptimized)
npm run build

# Production build (optimized, minified)
npm run build -- --configuration production
```

### Serving Production Build

The `Frontend/nginx/nginx.conf` provides production nginx configuration:

```bash
# Build the app
npm run build

# Copy dist/ to web server
# Configure nginx with provided config
```

---

## Performance Optimization

- **Lazy Loading:** Routes load on demand
- **OnPush Change Detection:** Minimize unnecessary change detection
- **TrackBy in *ngFor:** Optimize list rendering
- **Tree-Shaking:** Unused code removed during build
- **Gzip Compression:** Enable in nginx

---

## Testing

### Unit Tests

```bash
npm test
```

Tests use Karma test runner and Jasmine framework.

### Writing Tests

```typescript
describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectService]
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should fetch projects', () => {
    service.getProjects().subscribe(data => {
      expect(data.length).toBe(2);
    });

    const req = httpMock.expectOne('/api/projects');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Project 1' }]);
  });
});
```

---

## Debugging

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Go to **Sources** tab
3. Enable source maps in Angular config
4. Set breakpoints in TypeScript files

### Debug Environment Variables

Edit `angular.json`:

```json
{
  "configurations": {
    "development": {
      "sourceMap": true,
      "optimization": false
    }
  }
}
```

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4200
lsof -i :4200
kill -9 <PID>
```

### Clear Node Modules Cache
```bash
rm -rf node_modules package-lock.json
npm install
```

### CORS Issues
Ensure backend API has correct CORS configuration for `http://localhost:4200`

---

## Documentation

- **[Root README.md](../../README.md)** - Full project overview
- **[Backend API Documentation](../../README.md#api-overview)** - API endpoints
- **[AI Setup Guide](../../AI_SETUP.md)** - AI feature configuration

---

## Contributing

1. Create feature branch from `develop`
2. Follow Angular style guide
3. Add unit tests for new features
4. Submit pull request
5. Code review required before merge

---

## Support

For questions about Angular development:
- Check [Angular Documentation](https://angular.io/docs)
- Review existing code patterns
- Check issue tracker on GitHub
