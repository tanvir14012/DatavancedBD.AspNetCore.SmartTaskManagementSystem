# Angular Frontend - Smart Task Management System

Modern Angular 19 web application for the Smart Task Management System. It provides a responsive user interface for task management, project organization, team collaboration, and dashboard analytics.

---

## Project overview
This frontend consumes the ASP.NET Core backend API and delivers a full task management experience with:

- **User authentication:** Secure login and registration with JWT tokens
- **Dashboard analytics:** Project overview and team metrics
- **Project management:** Create, organize, and manage projects with team members
- **Task management:** Board-style task workflows
- **User management:** Team administration and role assignment
- **Responsive design:** Mobile-friendly interface using Tailwind CSS
- **Internationalization:** Support for multiple languages
- **Secure access:** HTTP interceptors, route guards, and role-based access control
- **AI integration:** The backend handles AI description improvements through Groq; the Angular app simply triggers the endpoint and displays the result

---

## Technology stack

### Core framework
- **Angular 19**
- **TypeScript 5.x**
- **RxJS 7.x**

### Styling & UI
- **Tailwind CSS 4.x**
- **SCSS**
- **Angular Material**

### HTTP & state management
- **Angular HttpClient**
- **RxJS Observables**
- **Interceptors** for auth, logging, and error handling

### Routing & navigation
- **Lazy-loaded routes**
- **Route guards**
- **Route resolvers**

### Development tools
- **Angular CLI 19**
- **Prettier**
- **ESLint**

---

## Setup instructions

### Prerequisites
- **Node.js 20+**
- **npm 10+**
- **Angular CLI 19**
- **Running backend API** - See the root [README.md](../../README.md)

### Installation
```bash
cd Frontend/Angular
npm install
```

### Configure environment
Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
};
```

### Run development server
```bash
npm start
```

The app is available at `http://localhost:4200`.

### Build for production
```bash
npm run build
```

---

## Development commands
```bash
npm start
npm run build
npm test
npm run lint
npm run format
```

## AI note
The UI does not call Groq directly. The Angular frontend calls the backend endpoint for task improvement; the backend uses Groq's OpenAI-compatible API and returns the polished description.

See the root [AI_SETUP.md](../../AI_SETUP.md) for the provider setup details.
