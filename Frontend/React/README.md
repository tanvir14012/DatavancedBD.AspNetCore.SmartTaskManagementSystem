# React frontend — Smart Task Management System

This is the parallel React 19 browser client for the Smart Task Management System. It uses the same ASP.NET Core API and can be developed and hosted alongside the Angular client.

## Technology

- React 19, TypeScript 6, and Vite 8
- React Router 7 for route composition and protected navigation
- TanStack Query for server state, caching, and request invalidation
- Zustand for session, theme, palette, and language preferences
- React Hook Form and Zod for forms and validation
- Tailwind CSS 4 with Radix-based UI primitives
- Axios with bearer-token injection and refresh-token retry handling
- i18next and react-i18next with English and Bengali translations

## Prerequisites

- Node.js 22 or later
- npm 10 or later
- The API running with HTTPS at `https://localhost:7108`
- A trusted local development certificate; `vite-plugin-mkcert` provisions one for Vite

## Setup

From the repository root:

```bash
cd Frontend/React
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell users can copy the environment file with `Copy-Item .env.example .env.local`.

Vite serves the application at `https://localhost:4200`. The API certificate must be trusted by the browser for authentication and refresh-token cookies to work reliably.

## Environment

`VITE_API_BASE_URL` is validated at startup and must be an absolute URL:

```dotenv
VITE_API_BASE_URL=https://localhost:7108
```

Use an environment-specific value when the API is hosted elsewhere. Do not commit `.env.local` or other machine-specific environment files.

## Npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with HTTPS. |
| `npm run build` | Type-check and create the production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format the frontend with Prettier. |
| `npm run format:check` | Verify Prettier formatting without changing files. |

## Application areas

- `/homepage`, `/login`, and `/register`: public entry and authentication flows.
- `/dashboard`: summary cards, task status, priorities, and upcoming work.
- `/projects/list`, `/projects/new`, and `/projects/assign`: project management and membership.
- `/tasks/list` and `/tasks/board`: task management and board workflow.
- `/users/list`: administrator user management.

Protected routes use the same API authorization model as the backend. The shell loads menu definitions from `/api/menus`, highlights the current route, and adapts the top navigation and collapsible sidebar for mobile and desktop layouts.

## Source structure

```text
src/
├── app/                 # Router, guards, and error boundary
├── components/          # Shared layout and UI primitives
├── config/              # Validated Vite environment
├── features/            # Auth, dashboard, home, navigation, projects, tasks, users
├── hooks/               # Shared React hooks
├── lib/                 # HTTP, i18n, and query-client setup
├── locales/             # English and Bengali translation files
├── store/               # Zustand stores
└── utils/               # Pure helpers and API error handling
```

## Static hosting

`npm run build` produces `Frontend/React/dist`. Serve that directory from a static web server with SPA fallback to `index.html`, and set `VITE_API_BASE_URL` to the API origin before building. The repository's existing GitHub Actions and Azure DevOps deployment pipelines currently package the Angular client; switching a deployment to React requires selecting this build directory and preserving the API, HTTPS, and SPA fallback settings.

See the [root README](../../README.md) for backend setup, API routes, deployment, and operational guidance.
