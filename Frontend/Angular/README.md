# Angular Frontend

This Angular application is the web frontend for the US military inventory management platform in this repository. It provides the user interface for inventory operations, administration, identity and access management, and other domain workflows exposed by the backend services through the API gateway.

## Project structure

- `src/app/core/` - cross-cutting frontend concerns such as authentication, HTTP interceptors, caching, language handling, and app-wide services
- `src/app/features/` - feature areas organized by domain, such as `administration`, `iam`, and `dashboard`
- `src/app/layout/` - shell components like the main layout, navbar, sidebar, and breadcrumbs
- `src/app/shared/` - reusable UI components, directives, models, pipes, validators, and helper services
- `src/environments/` - environment-specific frontend configuration
- `src/assets/i18n/` - translation resources for supported languages

## Design patterns

- **Feature-based organization** - business capabilities are grouped under `features/` so screens and related logic stay close together
- **Core/shared separation** - singleton infrastructure lives in `core/`, while reusable presentation and utility pieces live in `shared/`
- **Standalone Angular APIs** - the app uses modern Angular configuration with standalone components, application-level providers, and functional routing setup
- **Lazy-loaded routes** - feature routes are loaded on demand to keep initial startup smaller and isolate domains
- **Interceptor pipeline** - authentication, loading state, error handling, caching, and language propagation are applied through HTTP interceptors
- **Gateway-oriented API access** - frontend services call backend capabilities through a shared API base URL rather than coupling directly to individual service hosts

## Development

- `npm start` - run the local development server
- `npm run start:https` - run the app over HTTPS with local certificates
- `npm run build` - create a production build
- `npm test` - run unit tests
