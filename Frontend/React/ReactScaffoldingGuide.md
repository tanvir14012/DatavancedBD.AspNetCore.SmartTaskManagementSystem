# React scaffolding and daily development in VS Code

Build repetitive structure with npm and a small generator; edit components and configuration in
VS Code; use terminals for installation, checks, Git and runtime operations. Productivity comes
from a short, repeatable feedback loop, not from installing every extension or generating more layers.

This guide lives beside the repository’s React app but creates a **separate `react-scaffold-lab`**.
Do not paste its replacement files over the existing frontend. The reference stack is React 19,
Vite 8, TypeScript, React Router 7, TanStack Query 5, Zustand 5, React Hook Form and Zod 4.
The lab uses a browser-only mock API so it can run independently. That mock is not authentication,
durable storage, a database, or evidence of tenant isolation.

Use Windows 11, VS Code, Node.js **24.21.0 LTS**, npm and Git. Docker Desktop in Linux-container
mode is optional until the container section. Bash means Git Bash on Windows unless stated otherwise.
Common `sh` blocks work in PowerShell, CMD and Git Bash. Run commands one at a time, inspect the
result, and stop on errors. In PowerShell, `npm.cmd` / `npx.cmd` avoid blocked `.ps1` launchers.
**File-content blocks are VS Code edits, not terminal input.** Save with Ctrl+S.

Navigation: [setup](#1-scaffold-the-workspace), [VS Code](#2-configure-vs-code),
[components and generators](#3-create-components-hooks-and-utilities),
[API contracts](#4-define-and-mock-the-api), [forms and queries](#5-build-forms-and-server-state),
[routing](#6-compose-routes-and-providers), [tests](#7-test-observable-behavior),
[debugging](#8-debug-the-browser-and-api-boundary), [Git](#9-git-and-targeted-cleanup),
[Docker](#10-build-and-run-containers), [tenant debugging](#11-debug-multiple-frontends-backends-and-tenants).

## 1. Scaffold the workspace

### 1.1 Check the tools

In VS Code, open a parent directory for practice projects and choose **Terminal → New Terminal**:

```sh
node --version
npm --version
git --version
```

Make sure the parent does not already contain `react-scaffold-lab`, then use the Vite template:

```sh
npm create vite@latest react-scaffold-lab -- --template react-ts
```

Choose the standard React + TypeScript template if prompted. If prompted to install and start
automatically, choose No so the following steps remain explicit. This uses npm’s scaffolding
mechanism; there is no official `react generate component` command. See
[Vite’s create-vite template documentation](https://github.com/vitejs/vite/blob/main/packages/create-vite/README.md).

```sh
cd react-scaffold-lab
code .
```

If `code` is not on PATH, use **File → Open Folder** to open the child project. All subsequent
commands run from this lab root unless explicitly stated otherwise.

### 1.2 Install the runtime in small groups

These runtime versions match the inspected repository lockfile; this does not modify that lockfile.
The Vite template itself follows its current release. Review generated changes and commit the lab’s
resolved lockfile so later installations are reproducible.

```sh
npm install --save-exact react@19.3.0 react-dom@19.3.0 react-router@7.18.4
```

```sh
npm install --save-exact @tanstack/react-query@5.103.1 zustand@5.0.15
```

```sh
npm install --save-exact react-hook-form@7.88.0 @hookform/resolvers@5.9.1 zod@4.6.5 react-error-boundary@6.1.6
```

```sh
npm install --save-dev --save-exact vite@8.3.0 @vitejs/plugin-react@6.1.1 typescript@6.0.3 prettier@3.9.8
```

Install the mock and test tools. `--save-exact` records the versions resolved at installation time;
these new tooling packages are not already present in the repository’s inspected lockfile:

```sh
npm install --save-dev --save-exact msw@2 vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

```sh
npm ls --depth=0
```

Stop and resolve any peer-dependency error instead of using `--force` or `--legacy-peer-deps`.
On a later clone, use `npm ci` to reproduce package-lock.json. Use `npm install` when deliberately
changing dependencies. Do not hand-edit dependency hashes or mix npm/yarn/pnpm lockfiles.

### 1.3 Keep strict TypeScript and add scripts

Keep the generated root tsconfig project references. In `tsconfig.app.json`, ensure these options
are present alongside the template’s bundler/JSX options:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

Those are properties to merge into `compilerOptions`, not a replacement tsconfig. In the app’s
bundler mode, relative imports can omit `.js`; this differs from Node ESM backend source.
Use `import type` for types when `verbatimModuleSyntax` is enabled.

In `package.json`, merge these entries into the existing `scripts` object:

```json
{
  "dev": "vite --host 127.0.0.1 --port 5173 --strictPort",
  "build": "tsc -b && vite build",
  "preview": "vite preview --host 127.0.0.1 --port 4173 --strictPort",
  "typecheck": "tsc -b --pretty false",
  "test": "vitest run",
  "test:watch": "vitest",
  "format": "prettier . --write",
  "format:check": "prettier . --check"
}
```

Retain the generated lint script/configuration. The existing repository frontend had no `test`
script when inspected; the commands above add testing **to this lab**, not retroactively to it.
`--strictPort` fails visibly if a port is occupied instead of silently moving the frontend.

## 2. Configure VS Code

### 2.1 Install a focused extension set

Use **Ctrl+Shift+X** and search by the exact extension ID. Read its publisher and required access.

| Extension | ID | When it helps |
| --- | --- | --- |
| [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | `dbaeumer.vscode-eslint` | Show project lint and Hooks diagnostics while editing. |
| [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | `esbenp.prettier-vscode` | Apply the project’s formatter consistently. |
| [React snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets) | `dsznajder.es7-react-js-snippets` | Optional typing shortcuts; review generated imports and component style. |
| [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) | `bradlc.vscode-tailwindcss` | Optional, only if the project actually uses Tailwind. |
| [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) | `eamodio.gitlens` | Optional history/blame exploration. Built-in Git covers ordinary operations. |
| [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) | `humao.rest-client` | Optional direct API requests, separately from the browser UI. |

Terminal installation is an alternative to clicking Install:

```sh
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

TypeScript completion, import fixes, rename/refactor, Git, Merge Editor, browser debugging and
npm script discovery are built in. Browser **React Developer Tools** is a browser extension,
not a VS Code debugger replacement; obtain it through the links in the
[React Developer Tools documentation](https://react.dev/learn/react-developer-tools).

Create `.vscode/extensions.json`:

```json
{
  "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
```

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "typescript.preferences.importModuleSpecifier": "relative",
  "search.exclude": { "**/dist": true, "**/node_modules": true, "**/coverage": true }
}
```

Create `.prettierrc.json`:

```json
{ "singleQuote": true, "semi": false, "trailingComma": "all" }
```

Keep only one Prettier configuration. Create `.prettierignore`:

```text
node_modules
dist
coverage
package-lock.json
public/mockServiceWorker.js
```

In the generated ESLint configuration, add `public/mockServiceWorker.js` to its existing global
ignore patterns. This file is generated by MSW, not application source to rewrite or lint.

### 2.2 Learn shortcuts that replace repetitive edits

| Action | Shortcut / command |
| --- | --- |
| Open a file | Ctrl+P |
| Find a workspace symbol | Ctrl+T |
| Add a missing import or fix a diagnostic | Ctrl+. |
| Rename a symbol and its references | F2 |
| Go to definition / references | F12 / Shift+F12 |
| Extract a component or function | Select the code, Ctrl+., inspect available refactorings |
| Format document | Shift+Alt+F |
| Multi-cursor next occurrence | Ctrl+D; review every selected occurrence |
| Open integrated terminal | Ctrl+` |

Prefer symbol-aware rename to global string replacement. Keep hooks at the top level of components
or custom hooks. Never call them conditionally or inside a click callback.

## 3. Create components, hooks and utilities

### 3.1 Organize by feature

Use Explorer to create files as each step introduces them. The target structure is:

```text
src/
  app/                 providers, router and application shell
  features/projects/   schemas, API calls, queries, components and tests
  shared/              small reusable UI/utilities
  stores/              client-only shared UI state
  mocks/               development API handlers
  test/                shared test setup
```

A component renders UI. A hook composes React behavior. An API module owns HTTP/decoding.
TanStack Query owns server state. Zustand is reserved for shared client state. Avoid generic
repositories, “base components,” or separate layers with no concrete responsibility.

### 3.2 Write one reusable component

Create `src/shared/StatusMessage.tsx`:

```tsx
type StatusMessageProps = {
  children: React.ReactNode
  error?: boolean
}

export function StatusMessage({ children, error = false }: StatusMessageProps) {
  return <p role={error ? 'alert' : 'status'}>{children}</p>
}
```

Alternatively import `ReactNode` with `import type` and use that alias; no default React import
is required just to compile JSX. Use props for inputs and callback props for events. Do not mutate
props or duplicate a prop in state unless the component intentionally owns an editable draft.

### 3.3 Functions, constants, types and exports

Create `src/shared/text.ts`:

```typescript
export const MAX_PROJECT_TITLE = 120

export function normalizeTitle(value: string): string {
  return value.trim()
}
```

Use named exports for ordinary utilities. A small barrel can explicitly re-export them, but
avoid importing a feature’s own barrel from inside that feature because it can create cycles.
Use `export type` for type-only exports. React normally needs functions and hooks, not static
utility classes or dependency-injection modules like NestJS.

### 3.4 Make a local component snippet

Run **Preferences: Configure Snippets → New Snippets file for this project** and create
`.vscode/react.code-snippets`:

```json
{
  "Typed React component": {
    "scope": "typescriptreact",
    "prefix": "rcomponent",
    "body": [
      "type ${1:Panel}Props = { title: string }",
      "",
      "export function ${1:Panel}({ title }: ${1:Panel}Props) {",
      "  return <section aria-label={title}>${2:content}</section>",
      "}"
    ],
    "description": "Create a named function component with explicit props"
  }
}
```

Type `rcomponent` in a `.tsx` file and press Tab through the editable fields. Snippet tab stops
are inputs for the developer, not code to paste unchanged into a finished feature.

### 3.5 Optional: use npm and Plop for repeated feature boilerplate

React has no Nest-style official artifact CLI. A project-owned generator makes conventions
reviewable instead of relying on an unmaintained template package.

```sh
npm install --save-dev --save-exact plop
```

Create `plopfile.mjs`:

```javascript
export default function configure(plop) {
  plop.setGenerator('component', {
    description: 'Create an isolated presentational component',
    prompts: [{
      type: 'input', name: 'name', message: 'Component name:',
      validate: (value) => /^[A-Z][A-Za-z0-9]*$/.test(value) || 'Use PascalCase letters/numbers.',
    }],
    actions: [{
      type: 'add',
      path: 'src/shared/{{pascalCase name}}/{{pascalCase name}}.tsx',
      templateFile: 'templates/component.tsx.hbs',
    }],
  })
}
```

Create `templates/component.tsx.hbs`:

```handlebars
type {{pascalCase name}}Props = { title: string }

export function {{pascalCase name}}({ title }: {{pascalCase name}}Props) {
  return <section aria-label={title}><h2>{title}</h2></section>
}
```

```sh
npx plop component
```

Enter `SummaryPanel`, inspect the new file, then implement its actual behavior. Do not auto-generate
placeholder tests and count them as coverage. Add `templates/` to `.prettierignore` if the formatter
cannot parse the template language. Plop does not register routes or decide where a component belongs.

## 4. Define and mock the API

### 4.1 Keep browser configuration public

Add these ignore rules in VS Code before creating local configuration:

```gitignore
.env
.env.*
!.env.example
.local/
node_modules/
dist/
coverage/
```

Create `.env.development.local`:

```dotenv
VITE_ENABLE_MOCKS=true
```

Every `VITE_*` value can be exposed to the browser bundle. Never put a database URL, private key,
client secret or backend credential there. Vite environment values are strings and are usually
read at dev-server startup or build time; changing an environment file requires restarting Vite.

### 4.2 Define the contract and validate untrusted responses

Create `src/features/projects/project.schema.ts`:

```typescript
import { z } from 'zod'
import { MAX_PROJECT_TITLE } from '../../shared/text'

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(MAX_PROJECT_TITLE),
})

export const projectSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(MAX_PROJECT_TITLE),
  completed: z.boolean(),
})

export const projectsSchema = z.array(projectSchema).max(50)
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type Project = z.infer<typeof projectSchema>
```

The lab contract is deliberately small: GET `/api/projects?limit=50` returns an array, POST creates
`{ title }`, PATCH `/api/projects/:id` changes `{ completed }`, and DELETE returns 204. Existing
NestJS/.NET endpoints may use different fields, authorization and pagination envelopes. Adapt the
API module to the real contract instead of assuming those backends implement this mock API.

Create `src/features/projects/project.api.ts`:

```typescript
import { projectSchema, projectsSchema, type CreateProjectInput } from './project.schema'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 403 ? 'Access denied.' : 'The request failed. Please retry.')
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) throw new ApiError(response.status)
  return response
}

export async function listProjects(signal: AbortSignal) {
  const response = await request('/projects?limit=50', { signal })
  const data: unknown = await response.json()
  return projectsSchema.parse(data)
}

export async function createProject(input: CreateProjectInput) {
  const response = await request('/projects', { method: 'POST', body: JSON.stringify(input) })
  const data: unknown = await response.json()
  return projectSchema.parse(data)
}

export async function updateProject(id: string, completed: boolean) {
  const response = await request(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ completed }),
  })
  const data: unknown = await response.json()
  return projectSchema.parse(data)
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
```

No `as Project[]` assertion converts unknown server data into truth. The schema validates it.
GET cancellation is passed to fetch. Do not retry mutations automatically without an idempotency
contract, and do not render arbitrary server exception text or HTML into the UI.

### 4.3 Supply an isolated mock API

Create `src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { createProjectSchema, type Project } from '../features/projects/project.schema'

let projects: Project[] = []
const updateSchema = z.object({ completed: z.boolean() })

export const handlers = [
  http.get('/api/projects', () => HttpResponse.json(projects.slice(0, 50))),
  http.post('/api/projects', async ({ request }) => {
    const data: unknown = await request.json()
    const parsed = createProjectSchema.safeParse(data)
    if (!parsed.success) return HttpResponse.json({ error: 'Invalid title' }, { status: 400 })
    if (projects.length >= 50) return HttpResponse.json({ error: 'Lab limit reached' }, { status: 409 })
    const project: Project = { id: crypto.randomUUID(), title: parsed.data.title, completed: false }
    projects = [project, ...projects]
    return HttpResponse.json(project, { status: 201 })
  }),
  http.patch('/api/projects/:id', async ({ params, request }) => {
    const data: unknown = await request.json()
    const parsed = updateSchema.safeParse(data)
    if (!parsed.success) return new HttpResponse(null, { status: 400 })
    const project = projects.find((item) => item.id === params.id)
    if (!project) return new HttpResponse(null, { status: 404 })
    const updated = { ...project, completed: parsed.data.completed }
    projects = projects.map((item) => item.id === project.id ? updated : item)
    return HttpResponse.json(updated)
  }),
  http.delete('/api/projects/:id', ({ params }) => {
    if (!projects.some((item) => item.id === params.id)) return new HttpResponse(null, { status: 404 })
    projects = projects.filter((item) => item.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
```

Create `src/mocks/browser.ts`:

```typescript
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

Generate the service-worker asset with the package CLI:

```sh
npx msw init public --save
```

Do not hand-write `public/mockServiceWorker.js`. Commit it or regenerate it deterministically in
the team’s build workflow. In this lab the state is held in the page’s handler module and resets
on reload; it is not shared across tabs, browser profiles or API processes. See
[MSW browser integration](https://mswjs.io/guides/integrations/browser).

## 5. Build forms and server state

### 5.1 Keep form behavior in a focused component

Create `src/features/projects/ProjectForm.tsx`:

```tsx
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProjectSchema, type CreateProjectInput } from './project.schema'

type ProjectFormProps = { onCreate: (input: CreateProjectInput) => Promise<void> }

export function ProjectForm({ onCreate }: ProjectFormProps) {
  const titleId = useId()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema), defaultValues: { title: '' },
  })

  async function submit(input: CreateProjectInput) {
    setServerError(null)
    try {
      await onCreate(input)
      reset()
    } catch {
      setServerError('Could not create the project. Your input has been kept.')
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <label htmlFor={titleId}>Project title</label>
      <input id={titleId} {...register('title')} aria-invalid={Boolean(errors.title)}
        aria-describedby={errors.title ? `${titleId}-error` : undefined} />
      {errors.title && <p id={`${titleId}-error`} role="alert">{errors.title.message}</p>}
      {serverError && <p role="alert">{serverError}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create project'}</button>
    </form>
  )
}
```

The form owns draft input. Failed submission preserves that draft; successful submission resets it.
Labels, announced errors and pending states are part of functionality, not final visual polish.
Validate again on the server; browser validation never establishes trust.

### 5.2 Create query and mutation hooks

Create `src/features/projects/project.queries.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, deleteProject, listProjects, updateProject } from './project.api'

export const projectKeys = { list: ['projects', 'list'] as const }

export function useProjects() {
  return useQuery({ queryKey: projectKeys.list, queryFn: ({ signal }) => listProjects(signal) })
}

export function useProjectMutations() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: projectKeys.list })
  const create = useMutation({ mutationFn: createProject, onSuccess: refresh })
  const update = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => updateProject(id, completed),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: deleteProject, onSuccess: refresh })
  return { create, update, remove }
}
```

Returning the invalidation Promise keeps the mutation pending through the refresh. Start with
server-confirmed updates; add optimistic updates only with cancellation, rollback and concurrency
handling. Query keys identify cached data; they are not authorization checks. This unscoped key
belongs only to the unauthenticated single-scope lab. Section 11 explains authenticated tenant keys.

### 5.3 Render loading, empty, error, forbidden and mutation states

Create `src/features/projects/ProjectsPage.tsx`:

```tsx
import { ProjectForm } from './ProjectForm'
import { useProjectMutations, useProjects } from './project.queries'
import { ApiError } from './project.api'
import { StatusMessage } from '../../shared/StatusMessage'

export function ProjectsPage() {
  const query = useProjects()
  const { create, update, remove } = useProjectMutations()
  const busy = update.isPending || remove.isPending

  if (query.isPending) return <StatusMessage>Loading projects…</StatusMessage>
  if (query.isError) {
    const denied = query.error instanceof ApiError && query.error.status === 403
    return <section>
      <StatusMessage error>{denied ? 'You cannot view these projects.' : 'Could not load projects.'}</StatusMessage>
      {!denied && <button onClick={() => void query.refetch()}>Retry</button>}
    </section>
  }

  return (
    <section aria-labelledby="projects-heading">
      <h1 id="projects-heading">Projects</h1>
      <ProjectForm onCreate={async (input) => { await create.mutateAsync(input) }} />
      {query.isFetching && <StatusMessage>Refreshing projects…</StatusMessage>}
      {(update.isError || remove.isError) && <StatusMessage error>The change failed. Please retry.</StatusMessage>}
      {query.data.length === 0 ? <p>No projects yet. Create your first one.</p> : (
        <ul>{query.data.map((project) => <li key={project.id}>
          <label>
            <input type="checkbox" checked={project.completed} disabled={busy}
              onChange={(event) => update.mutate({ id: project.id, completed: event.target.checked })} />
            {project.title}
          </label>
          <button disabled={busy} onClick={() => remove.mutate(project.id)}
            aria-label={`Delete ${project.title}`}>Delete</button>
        </li>)}</ul>
      )}
    </section>
  )
}
```

Use stable IDs as keys, never array indexes for editable lists. Avoid maintaining a second local
copy of `query.data` in state. React’s text rendering escapes strings; do not replace it with
`dangerouslySetInnerHTML` for server content.

### 5.4 Reserve Zustand for shared UI state

Create `src/stores/preferences.ts`:

```typescript
import { create } from 'zustand'

type Preferences = {
  compact: boolean
  toggleCompact: () => void
}

export const usePreferences = create<Preferences>((set) => ({
  compact: false,
  toggleCompact: () => set((state) => ({ compact: !state.compact })),
}))
```

This is a display preference. Do not put query results, passwords or refresh tokens in a globally
persisted store. Components should select the state they need instead of subscribing to the entire store.

## 6. Compose routes and providers

### 6.1 Define routes and an error boundary

Create `src/app/App.tsx`:

```tsx
import { Link, Navigate, Route, Routes } from 'react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { usePreferences } from '../stores/preferences'

export function App() {
  const compact = usePreferences((state) => state.compact)
  const toggleCompact = usePreferences((state) => state.toggleCompact)
  return <div data-compact={compact}>
    <a href="#main">Skip to content</a>
    <header>
      <nav aria-label="Main"><Link to="/projects">Projects</Link></nav>
      <button aria-pressed={compact} onClick={toggleCompact}>Compact view</button>
    </header>
    <main id="main">
      <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <section>
        <h1>Something went wrong</h1>
        <button onClick={resetErrorBoundary}>Try rendering again</button>
      </section>}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="*" element={<section><h1>Page not found</h1><Link to="/projects">Go to projects</Link></section>} />
        </Routes>
      </ErrorBoundary>
    </main>
  </div>
}
```

This is React Router’s **declarative mode**, not its framework/file-route mode. See the
[declarative installation guide](https://reactrouter.com/start/declarative/installation).
A client route guard can improve navigation but cannot secure an API. Error boundaries catch
rendering errors; event-handler and ordinary fetch failures need explicit handling as above.

### 6.2 Initialize providers once

Replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './app/App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
    mutations: { retry: false },
  },
})

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing root element')
  createRoot(root).render(<StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>)
}

start().catch(() => {
  const root = document.getElementById('root')
  if (root) root.textContent = 'The application could not start. Reload and check your configuration.'
})
```

StrictMode can repeat renders and effect setup/cleanup in development to expose bugs; it is not
a reason to disable correctness checks. Do not start mutations in a mount effect. MSW starts
before rendering so the first query is intercepted. Production builds never start this mock.

Remove the unused generated `src/App.tsx`, `src/App.css` and starter assets through Explorer after
confirming nothing imports them. Keep `index.html` and its root element/module entrypoint.

Replace `src/index.css`:

```css
:root { font-family: system-ui, sans-serif; color: #172033; background: #f5f7fb; }
body { margin: 0; }
header, main, body > #root > div > a { display: block; max-width: 60rem; margin: auto; padding: 1rem; }
header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
form { display: grid; gap: .5rem; max-width: 32rem; }
input, button { font: inherit; padding: .6rem; }
button { cursor: pointer; }
button:disabled { cursor: wait; opacity: .65; }
li { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: .8rem 0; }
ul { padding: 0; list-style: none; }
[data-compact="true"] li { padding: .25rem 0; }
[role="alert"] { color: #a31b26; }
:focus-visible { outline: 3px solid #155eef; outline-offset: 3px; }
```

Run the finished milestone:

```sh
npm run format
npm run lint
npm run build
npm run dev
```

Open `http://127.0.0.1:5173/projects`. Create a project, toggle completion, delete it, and try a
blank title. Refreshing clears the mock records. Use Ctrl+C to stop Vite.

### 6.3 Switch from mocks to a real backend

Set `VITE_ENABLE_MOCKS=false` and restart Vite. Replace `vite.config.ts` with this lab configuration:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3405' },
    },
  },
})
```

This assumes a backend implementing the contract in section 4 on port 3405. The lab does not
start that backend. The browser calls its own `/api` origin; Vite forwards server-side during
development. Vite’s dev proxy is not included in a production bundle.

**PowerShell — select another backend temporarily:**

```powershell
$previousApiTarget = $env:API_PROXY_TARGET
try {
    $env:API_PROXY_TARGET = 'http://127.0.0.1:3406'
    npm.cmd run dev
} finally {
    $env:API_PROXY_TARGET = $previousApiTarget
}
```

**Bash:**

```bash
API_PROXY_TARGET=http://127.0.0.1:3406 npm run dev
```

The repository frontend has a different setup: HTTPS via mkcert, port 4200, `/services` rewriting,
and trusted local tenant-authority forwarding. Preserve that existing proxy behavior when working
on the repository app; this lab configuration is not a drop-in replacement.

### 6.4 Optional styling/component tooling

For Tailwind v4, install the packages and add its Vite plugin; use `@import "tailwindcss";` in
your CSS. Do not copy a Tailwind v3 init/config workflow into v4 without checking its migration docs.
For accessible complex controls, evaluate headless primitives and review keyboard/focus behavior;
CSS classes alone do not implement a usable dialog or combobox. For a shared component library,
Storybook can provide isolated stories, but add it only when the team will maintain those stories.

## 7. Test observable behavior

### 7.1 Configure Vitest separately from the dev server

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
})
```

Add `vitest.config.ts` to the existing `include` array in `tsconfig.node.json`, retaining
`vite.config.ts`. Avoid incompatible duplicated Vite versions; check `npm ls vite vitest` if
plugin types disagree rather than hiding the error with a type assertion. See
[Vitest setup](https://vitest.dev/guide/) and [setup files](https://vitest.dev/config/setupfiles).

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

Create `src/features/projects/ProjectForm.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectForm } from './ProjectForm'

describe('ProjectForm', () => {
  it('rejects a blank title without submitting', async () => {
    const onCreate = vi.fn(async () => {})
    const user = userEvent.setup()
    render(<ProjectForm onCreate={onCreate} />)
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a title')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('submits trimmed input and resets after success', async () => {
    const onCreate = vi.fn(async () => {})
    const user = userEvent.setup()
    render(<ProjectForm onCreate={onCreate} />)
    const input = screen.getByRole('textbox', { name: 'Project title' })
    await user.type(input, '  First project  ')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ title: 'First project' }))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('keeps the draft when the server rejects submission', async () => {
    const onCreate = vi.fn(async () => { throw new Error('Service unavailable') })
    const user = userEvent.setup()
    render(<ProjectForm onCreate={onCreate} />)
    const input = screen.getByRole('textbox', { name: 'Project title' })
    await user.type(input, 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your input has been kept')
    expect(input).toHaveValue('Keep this draft')
  })
})
```

```sh
npm test
npm run test:watch
```

Stop watch mode with Ctrl+C before another foreground exercise. Test what users observe; do not
assert internal hook calls or implementation-specific DOM structure. Use roles and accessible names.
For API integration tests, use MSW’s Node setup with per-test handler/state reset; browser mocks alone
do not prove real server behavior. For end-to-end flows, use Playwright against a controlled test API
and isolated data; include keyboard navigation, loading/error states and authorization failures.

## 8. Debug the browser and API boundary

### 8.1 Launch Chrome or Edge from VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "React lab: Chrome", "type": "chrome", "request": "launch",
      "url": "http://127.0.0.1:5173/projects", "webRoot": "${workspaceFolder}",
      "sourceMaps": true, "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "React lab: Edge", "type": "msedge", "request": "launch",
      "url": "http://127.0.0.1:5173/projects", "webRoot": "${workspaceFolder}",
      "sourceMaps": true
    },
    {
      "name": "React lab: second frontend", "type": "chrome", "request": "launch",
      "url": "http://127.0.0.1:5174/projects", "webRoot": "${workspaceFolder}",
      "sourceMaps": true
    }
  ],
  "compounds": [
    { "name": "Debug two frontends", "configurations": ["React lab: Chrome", "React lab: second frontend"], "stopAll": true }
  ]
}
```

Start Vite first, then select the configuration and press F5. The browser debugger is built into
VS Code; a Node inspector port is not required for browser React code. Debug the Vite process
separately only when investigating dev-server/plugin behavior.

### 8.2 Breakpoints and inspection

| Action | Shortcut / place |
| --- | --- |
| Set/remove a breakpoint | Click gutter or F9 |
| Continue | F5 |
| Step over | F10 |
| Step into | F11 |
| Step out | Shift+F11 |
| Stop debug session | Shift+F5 |
| Remove all breakpoints | Run → Remove All Breakpoints |
| Conditional breakpoint/logpoint | Right-click gutter |
| Inspect a component’s props/state | React Developer Tools Components panel |
| Find expensive renders | React Developer Tools Profiler |
| Inspect requests/status/payloads | Browser Network panel |

Set a breakpoint inside `ProjectForm.submit`, submit a title, and inspect `input`. Step into
the API function and inspect the Network request. “Step up” usually means Step Out; choosing
another call-stack frame changes inspection, not time. Debug-console expressions can have real
side effects. Avoid logging tokens, personal data or full request bodies.

Hollow breakpoints usually mean wrong source maps, a stale bundle, or a mismatched `webRoot`.
Check the actual served URL and source path before changing code. Vite dev maps differ from
production maps; do not publicly ship sensitive source maps just to make debugging easier.

When a request appears successful but real backend logs are empty, check whether MSW intercepted
it. Disable mocks and restart Vite; if needed, unregister the lab’s service worker from the
browser Application panel. Do not clear unrelated sites’ storage or service workers.

### 8.3 Hooks, effects and stale state

Use effects for synchronizing with external systems, with cleanup. Derive simple values during
render instead of mirroring props/query data through an effect. State setters schedule a new
render; the current event closure still sees its original state. Use functional updates when
the next value depends on previous state. Do not silence exhaustive-deps warnings to make an
effect stop rerunning; fix its ownership and dependencies.

Use `useMemo`/`useCallback` only where profiling or dependency stability justifies them. Do not
wrap every value as a default productivity technique. Keep component identity stable instead of
declaring a component inside another component’s render when it should retain state.

## 9. Git and targeted cleanup

### 9.1 Branch, review, commit and push

Vite may not initialize Git. In this new standalone lab only, initialize once if needed:

```sh
git init
git switch -c codex/react-scaffolding
git status --short
```

```sh
npm run lint
npm run build
npm test
npm run format:check
```

Stage focused, reviewed files rather than secret-bearing local configuration:

```sh
git add src public package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json .gitignore .vscode
git diff --cached --check
git diff --cached
git commit -m "Add React project scaffolding and form tests"
```

Also stage the authored formatter/configuration files and generator templates when ready. Configure
your own repository remote through VS Code Publish Branch or `git remote add origin` with its real
URL. Verify `git remote -v` before pushing:

```sh
git push -u origin HEAD
```

`-u` sets upstream tracking. Later `git push` can infer the branch. `git add -u` is different: it
stages changes/deletions of tracked files but does not add untracked files.

### 9.2 Pull, merge and resolve conflicts

```sh
git fetch --prune origin
git pull --ff-only
```

Fetch updates remote references. Pull also integrates changes; `--ff-only` stops on divergence
instead of choosing a history rewrite for you. For a feature branch, fetch then merge the actual
default branch (`main` is an example):

```sh
git merge origin/main
```

In Source Control → Merge Changes → Merge Editor, inspect Current, Incoming and Result. “Accept
Both” can duplicate JSX, imports or JSON keys; reconcile the intended behavior. Resolve package.json
first, then reconcile package-lock.json with npm and inspect changes. Re-run tests before finishing:

```sh
git diff --name-only --diff-filter=U
git add src/features/projects/ProjectsPage.tsx
git merge --continue
```

Stage every resolved file, not just that example. The unresolved-file command must report no paths.
Use `git merge --abort` to abandon an in-progress merge. Rebase is an alternative for coordinated
or unpublished branches; use `git rebase --continue`/`--abort` for its conflict workflow. Do not
force-push shared history as a normal conflict fix. Even `--force-with-lease` rewrites history.

### 9.3 Ignore files and clear the correct cache

Edit `.gitignore` in VS Code. Ignoring a tracked file does not remove it from Git:

```sh
git ls-files -- .env.development.local
git check-ignore -v --no-index .env.development.local
```

If it was tracked, `git rm --cached -- .env.development.local` stages its removal while retaining
the local file. Committed secrets remain in history; rotate them and follow the team’s remediation
process. Do not delete the whole index to refresh one ignore rule.

| Problem | Targeted action |
| --- | --- |
| Vite dependency optimization is stale | Stop Vite, then `npm run dev -- --force`. |
| npm cache might be corrupt | `npm cache verify` first. |
| Installed packages differ from lockfile | `npm ci`; it replaces node_modules. |
| Stale TypeScript diagnostics | TypeScript: Restart TS Server, after fixing real errors. |
| Old mock behavior | Reload the lab, inspect MSW, unregister only its worker if switching to real API. |
| Stale server data | Invalidate the relevant TanStack Query key; fix the backend if its data is stale. |
| Stale tenant data after switching | Clear/cancel the previous identity scope, not all browser sites. |
| Old Docker frontend image | Rebuild and recreate the affected service. |

`git reset --hard`, `git clean -fdx`, clearing all localStorage, deleting Docker volumes and
`npm cache clean --force` solve different problems and can discard work. None is a routine
“React cache clear.” Dist cleanup, if needed, must target only this lab’s verified output directory.

## 10. Build and run containers

### 10.1 Verify the production build separately

```sh
npm run build
npm run preview
```

Preview serves the built files locally; it is not a production server. The mock is deliberately
disabled in production, and this lab needs a real API/reverse proxy for its projects screen to
load successfully in preview. A successful static build is not an end-to-end API test.

VITE_* values are normally compiled into assets. Setting a container variable later does not
rewrite the JavaScript bundle. For one image across environments, design a public runtime-config
file or a same-origin `/api` gateway; neither should expose backend secrets.

### 10.2 Serve the SPA without running Vite in production

Create `.dockerignore`:

```text
.git
.env
.env.*
.local
node_modules
dist
coverage
```

Create `nginx.conf`:

```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    return 503;
  }

  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

The 503 explicitly marks the missing API gateway; it prevents API requests from accidentally
receiving index.html with HTTP 200. Configure a reviewed upstream before deploying a working app.
The SPA fallback allows browser refreshes at `/projects`. Cache fingerprinted assets aggressively,
but let index.html discover new asset versions after a deployment.

Create `Dockerfile`:

```dockerfile
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN node -e "require('node:fs').rmSync('dist/mockServiceWorker.js', {force:true})"

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

This uses an unprivileged runtime and excludes the mock worker asset from the shipped output.
Image tags are version references, not immutable digests: review current security/support status
and pin approved image digests for deployment. Add the real API gateway, TLS, headers and release
checks before describing it as production-ready.

Create `compose.yaml`:

```yaml
name: react-scaffold-lab
services:
  web:
    build: .
    ports:
      - "127.0.0.1:8085:8080"
    security_opt:
      - no-new-privileges:true
```

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 web
```

Open `http://127.0.0.1:8085/projects`. The shell/route should load; the API should show the documented
error state until a gateway is configured. Follow logs with `-f`; Ctrl+C stops following logs,
not the container. Stop with `docker compose stop`; remove project containers/network with
`docker compose down`. `restart` does not rebuild changed source or apply new port mappings.
Use `build` and `up -d` for source changes. No volume deletion is needed for this static frontend.

## 11. Debug multiple frontends, backends and tenants

### 11.1 Run two frontends concurrently

Terminal A:

```sh
npm run dev
```

Terminal B, using Vite directly so the script’s fixed port does not compete:

```sh
npx vite --host 127.0.0.1 --port 5174 --strictPort
```

Use **Debug two frontends** in VS Code. The two origins have separate browser storage/service
workers, but a different frontend port does not imply a different backend or tenant. Set each
terminal’s API_PROXY_TARGET to the intended backend when mocks are disabled.

For Docker, another Compose project name isolates container/network naming, not published host
ports. Assign the second frontend a different host port. A browser uses published host names;
an Nginx gateway inside Compose uses backend service names and internal ports. `localhost` inside
a container refers to that container. Windows-host APIs are reachable from Linux containers via
the appropriate Docker Desktop host address, subject to their actual bind/firewall configuration.

### 11.2 Carry tenant identity through an authorized API contract

The repository uses tenant-authority behavior documented in `docs/Multitenancy.md`; the NestJS
reference guide demonstrates catalog-validated selectors. Preserve the contract of the backend
you are debugging. Never infer tenant authorization from an arbitrary query parameter, port,
localStorage entry or a client route.

For a real authenticated application, scope server-state keys with verified session identity:

```typescript
export function scopedProjectKey(tenantId: string, userId: string, securityVersion: number) {
  return ['tenant', tenantId, 'user', userId, securityVersion, 'projects'] as const
}
```

The function names a cache scope; it does not verify those inputs. Obtain identity from the real
session flow, not an unchecked URL parameter. The server independently validates membership,
permissions, active placement and resource ownership on every request.

When switching tenant or logging out: freeze old-scope mutations/navigation, abort/cancel active
queries, remove old-scope cache data, reset forms and client state, establish the new authorized
session context, then allow new queries. In-flight mutations may already have reached the server:
do not relabel their callbacks as belonging to the new tenant. Guard completion handling by its
captured session/scope, and handle concurrent changes deliberately.

Do not persist identity-sensitive query caches casually. Clear persisted state as part of the
same transition, and ensure an old response cannot populate the new tenant’s cache. Browser-side
guards never substitute for server authorization. Cookie authentication also requires deliberate
CSRF/SameSite/CORS controls; bearer tokens should not be copied into tracked files or logs.

### 11.3 Debug two tenants without mixing sessions

1. Run the real backend’s provisioned alpha/beta fixtures and its isolation tests. The mock API
   in this guide cannot prove tenant separation.
2. Open independent browser profiles or isolated browser contexts. Tabs alone usually share
   authentication cookies/storage; use distinct profiles when testing separate users.
3. Sign in through the normal flow for each authorized tenant. Keep each frontend origin/proxy
   aligned with its trusted development authority configuration.
4. Inspect Network requests and the returned status codes without exposing authorization values
   in screenshots/logs. Set a breakpoint where the UI receives validated session context.
5. Use conditional breakpoints keyed to the verified tenant ID and the appropriate debug session.
   Inspect query keys, pending mutations and route/form state while switching contexts.
6. Test colliding project IDs, an unauthorized member, mismatched tenant selectors, and an old
   response arriving after a tenant switch. Verify denial and absence of stale data in the UI.
7. Correlate frontend requests with backend logs. Pausing the backend may cause frontend timeouts;
   distinguish that from a React bug. Do not disable guards or filters to make a test request pass.

## 12. Keep the daily loop short

Generate only the structure you need. Implement one user-visible behavior, format, typecheck,
run the smallest meaningful tests, and use the browser debugger for the failing path. Check empty,
pending, denied and failed states along with the happy path. Review the source, dependency and
configuration diffs before pushing. Keep generators and snippets small enough that the team
understands their output.

Verification boundary: this document creates a separate lab workflow and does not change the
existing React application, its lockfile, tests, backend or deployment. The lab’s npm installation,
builds, tests, browser behavior and Docker image must be run before claiming those results.
