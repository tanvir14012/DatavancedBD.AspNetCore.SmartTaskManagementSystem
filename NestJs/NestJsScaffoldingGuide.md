# NestJS scaffolding and daily development in VS Code

This is a practical workstation guide: generate repetitive structure with npm and the Nest CLI,
edit implementation in VS Code, and use the terminal for checks and operations. “100% productivity”
is a direction, not a measurable guarantee: templates save typing, while types, tests and review
keep generated mistakes from becoming application behavior.

Use a **new `nest-scaffold-lab` directory**, outside this repository. These examples do not modify
the existing SQL Server backend. The small lab is a loopback-only teaching API without identity;
do not expose it publicly or interpret a project ID as authorization. For authenticated CRUD and
tenant isolation, use [StepByStepGuide.md](StepByStepGuide.md). Tenant debugging below targets that
separate reference application, not an invented tenant header in this lab.

Prerequisites: Windows 11, VS Code, Node.js **24.21.0 LTS**, npm, Git, Docker Desktop in Linux-container
mode. Bash means **Git Bash on Windows**, unless a section explicitly says otherwise. WSL has its
own filesystem, Node installation and process space; do not share Windows `node_modules` with WSL.

Run one command at a time and stop on errors. `sh` blocks work in PowerShell, CMD and Git Bash unless
labelled otherwise. In PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the `.ps1`
launchers. All file-content blocks are **VS Code edits**, never terminal input. Save with Ctrl+S.
Examples under “optional recipe” are alternatives, not instructions to apply every variant.

Quick navigation: [editor/setup](#1-prepare-the-editor-and-generate-a-project),
[controllers](#2-scaffold-modules-controllers-services-and-methods),
[utilities/DI](#3-utilities-exports-and-dependency-injection),
[pipes/guards/errors](#4-pipes-guards-interceptors-and-exceptions),
[Prisma](#5-prisma-objects-migrations-sql-and-rollback),
[Git](#6-git-merges-upstream-tracking-and-clear-cache),
[debugging](#7-debugging-and-process-control),
[microservices](#8-add-and-run-a-separate-tcp-microservice),
[Docker/tenant debugging](#9-docker-compose-and-multiple-backends).

## 1. Prepare the editor and generate a project

### 1.1 Verify tools

Run each check in VS Code’s **Terminal → New Terminal**:

```sh
node --version
npm --version
git --version
docker version
docker compose version
```

Open a parent folder for practice projects using **File → Open Folder**. Check that it has no
existing `nest-scaffold-lab` directory, then scaffold:

```sh
npx --yes @nestjs/cli@12 new nest-scaffold-lab --package-manager npm --skip-install --skip-tests --no-observe
```

Choose **ESM** if asked. The CLI creates the application structure and Git repository. These
options are documented in the [Nest CLI reference](https://docs.nestjs.com/cli/usages).
Major version 12 constrains the template family; commit the resolved lockfile to preserve your
actual tool versions. A global Nest CLI installation is unnecessary.

```sh
cd nest-scaffold-lab
code .
```

If `code` is unavailable, open that child folder through VS Code. Use the new window’s terminal.

### 1.2 Install packages for the exercises

Keep the CLI-generated package metadata and development tooling. The lab pins its Nest runtime
family and uses Prisma **6.19.3** to match the reference guides. Do not apply Prisma 8 commands
to this schema: migration and configuration APIs differ across major versions.

```sh
npm install --save-exact @nestjs/common@12.1.2 @nestjs/core@12.1.2 @nestjs/platform-express@12.1.2
```

```sh
npm install --save-exact class-validator@0.15.1 class-transformer@0.5.1
```

```sh
npm install --save-exact @prisma/client@6.19.3
```

```sh
npm install --save-dev --save-exact prisma@6.19.3 typescript@5.9.3 @types/express@5.0.6
```

```sh
npm ls --depth=0
npx nest --version
npx prisma --version
```

The CLI resolves the local package when one is installed. Use `npm ci` on a subsequent clone;
use `npm install` when intentionally changing dependency declarations. Do not hand-edit the lockfile.

### 1.3 Choose a small extension set

Open Extensions with **Ctrl+Shift+X**, search by the exact ID, check the publisher, then install.
The links identify the extensions, not a required paid subscription.

| Extension | ID | Practical use |
| --- | --- | --- |
| [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | `esbenp.prettier-vscode` | Format with the project’s local Prettier version. |
| [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) | `Prisma.prisma` | Schema completion, validation and formatting. Check support for the pinned Prisma major. |
| [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | `dbaeumer.vscode-eslint` | Show diagnostics **when the project uses ESLint**. A generated v12 template may use a different linter. |
| [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) | `humao.rest-client` | Send saved `.http` requests from the editor. |
| [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) | `eamodio.gitlens` | Optional history/blame navigation; VS Code already handles commits and merges. |
| [Container Tools](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-containers) | `ms-azuretools.vscode-containers` | Optional container, image and log inspection. |

For example, terminal installation is an alternative to clicking Install:

```sh
code --install-extension esbenp.prettier-vscode
code --install-extension Prisma.prisma
code --install-extension humao.rest-client
```

TypeScript language support, Node debugging, JavaScript Debug Terminal, Git, Merge Editor,
terminal profiles and npm-script discovery are built in. Do not install duplicate debuggers or
multiple competing formatters. An extension does not install the application’s npm dependency.

In VS Code, create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "Prisma.prisma",
    "humao.rest-client"
  ]
}
```

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.snippetSuggestions": "top",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifierEnding": "js",
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[prisma]": { "editor.defaultFormatter": "Prisma.prisma" },
  "files.exclude": { "**/.git": true },
  "search.exclude": { "**/node_modules": true, "**/dist": true, "**/generated": true }
}
```

Keep one Prettier configuration: use the generated `.prettierrc`, or replace it with
`.prettierrc.json`, not both. Use **Format Document With…** to diagnose the active formatter.

### 1.4 Set a predictable TypeScript build

This lab uses direct TypeScript compilation so its debug paths remain unambiguous. In Explorer,
delete only the generated example files inside `src` and `test`, keeping those directories.
Keep `nest-cli.json` for `nest generate`. Remove generated test-runner config files if they
conflict with your chosen test setup; do not delete your own tests in an existing project.

Replace `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

In `package.json`, ensure `"type": "module"`. Merge these entries into `scripts`, retaining
other valid template commands:

```json
{
  "build": "tsc -p tsconfig.json",
  "build:watch": "tsc -p tsconfig.json --watch",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "start": "node --env-file=.env --enable-source-maps dist/main.js",
  "start:dev": "node --env-file=.env --enable-source-maps --watch dist/main.js",
  "start:debug": "node --env-file=.env --inspect=127.0.0.1:9230 --enable-source-maps dist/main.js"
}
```

Use `.js` suffixes on relative imports in TypeScript under this ESM configuration. Do not
copy extensionless CommonJS imports blindly. The runtime executes emitted JavaScript.

## 2. Scaffold modules, controllers, services and methods

### 2.1 Generate the feature structure

Start with a module and inspect the result before adding its providers:

```sh
npx nest generate module projects --dry-run
```

```sh
npx nest generate module projects
```

```sh
npx nest generate service projects --no-spec
```

```sh
npx nest generate controller projects --no-spec
```

Aliases are `g`, `mo`, `s`, `co`: `npx nest g co projects --no-spec` is the same controller
command. Do not run both versions. The CLI can update the closest module; inspect the diff.
With no root module yet, explicitly wire `ProjectsModule` into the root module below.

`--flat` avoids an extra directory; `--no-spec` omits generated test stubs, not the need for
meaningful tests. `--skip-import` leaves module wiring to you. A generated controller or
provider is not available until its module is imported by the application.

**Alternative, not an additional step:** generate a complete CRUD-shaped resource:

```sh
npx nest generate resource invoices --type rest --crud true --no-spec --dry-run
```

Remove `--dry-run` only if you want that extra feature. Resource generation creates DTO,
service, controller and module boilerplate; its canned return strings are not persistence,
validation, authorization or production behavior. The CLI has **no method generator**.
Add methods using editor snippets, code actions and normal TypeScript.

### 2.2 Define a validated request DTO

In VS Code, create `src/projects/create-project.dto.ts`:

```typescript
import { IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(1, 120)
  title = '';
}
```

Add the pure validation rule in `src/projects/project-title.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

export function projectTitle(value: string): string {
  const title = value.trim();
  if (title.length < 1 || title.length > 120) {
    throw new BadRequestException('Title must contain 1 to 120 characters.');
  }
  return title;
}
```

This small lab utility maps invalid input to HTTP. In a layered domain model, put the pure
domain error in Domain and map it at the HTTP boundary, as in the full guide.

### 2.3 Write a focused service

Replace `src/projects/projects.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { projectTitle } from './project-title.js';

export interface ProjectResponse {
  id: string;
  title: string;
}

@Injectable()
export class ProjectsService {
  private readonly projects = new Map<string, ProjectResponse>();

  create(title: string): ProjectResponse {
    const project = { id: randomUUID(), title: projectTitle(title) };
    this.projects.set(project.id, project);
    return { ...project };
  }

  findOne(id: string): ProjectResponse {
    const project = this.projects.get(id);
    if (!project) throw new NotFoundException('Project not found.');
    return { ...project };
  }
}
```

The map is a scaffolding exercise: process-local, non-durable and unbounded. Use only a few
test records. Section 5 replaces it with Prisma. Returning copies prevents callers mutating
the in-memory record accidentally.

### 2.4 Add controller methods in the editor

Replace `src/projects/projects.controller.ts`:

```typescript
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateProjectDto } from './create-project.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body() input: CreateProjectDto) {
    return this.projects.create(input.title);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.projects.findOne(id);
  }
}
```

Controller responsibilities: bind, validate, authorize, dispatch, return. Put database work,
transactions and resource ownership checks in the service/application layer.

Replace `src/projects/projects.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({ controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
```

### 2.5 Make a reusable method snippet

Use **Preferences: Configure Snippets → New Snippets file for this project**. Save
`.vscode/nest.code-snippets`:

```json
{
  "Nest GET method": {
    "scope": "typescript",
    "prefix": "nestget",
    "body": [
      "@Get('${1:path}')",
      "${2:findAll}() {",
      "  return this.${3:service}.${4:findAll}();",
      "}"
    ],
    "description": "Insert a GET handler; supply the real service method and import Get"
  }
}
```

Inside a controller, type `nestget`, select the suggestion, and use Tab through the fields.
Snippet tab stops are editor inputs, not finished application code. Use **Ctrl+. → Add import**
for missing decorators. A snippet does not verify that the referenced method exists.

## 3. Utilities, exports and dependency injection

### 3.1 Pick the simplest useful shape

| Need | Tool | Registration |
| --- | --- | --- |
| Stateless deterministic transformation | Exported function | Import it directly. |
| Shared immutable value | `export const` | Import it directly. |
| Type-only contract | `interface` / `type` | `import type`; erased at runtime. |
| Behavior with injected dependencies/lifetime | `@Injectable()` provider | Add to module `providers`. |
| Namespace of static helper methods | Usually use functions instead | Avoid unnecessary injectable state. |

Optional generators, run only for files you actually need:

```sh
npx nest generate class shared/date-range --no-spec
npx nest generate interface shared/page
npx nest generate provider shared/clock --no-spec
```

The generator does not create useful date-range rules or clock behavior. Implement these in
the editor. Avoid putting all business logic in a generic “utility” service.

For a concrete utility example, create `src/shared/pagination.ts`:

```typescript
export const MAX_PAGE_SIZE = 100;
export interface Page { offset: number; limit: number }

export function boundedPage(offset = 0, limit = 20): Page {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
    throw new RangeError('Invalid offset.');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError('Invalid limit.');
  }
  return { offset, limit };
}
```

Use a small explicit barrel, `src/shared/index.ts`, when it adds clarity:

```typescript
export { boundedPage, MAX_PAGE_SIZE } from './pagination.js';
export type { Page } from './pagination.js';
```

Do not import a feature’s own barrel from inside that feature: circular imports can break
decorator metadata and dependency injection. Direct imports are often clearer.

### 3.2 Understand module imports and exports

| Metadata | Meaning |
| --- | --- |
| `providers` | Instances/tokens created in this module. |
| `controllers` | HTTP/message entrypoints owned by this module. |
| `imports` | Other modules whose exported providers this module consumes. |
| `exports` | Providers/tokens this module allows other modules to inject. |

Export a provider from its owning module and import that module in the consumer. Do not put
the same service in every consumer’s `providers` list: that can create separate instances.
TypeScript `export` and Nest module `exports` solve different problems.

Use a symbol token and `useClass`/`useFactory` when a runtime abstraction is useful. An interface
alone cannot be injected because it does not exist in emitted JavaScript. Prefer constructor
injection; avoid global service-locator lookups.

## 4. Pipes, guards, interceptors and exceptions

### 4.1 Generate each kind independently

These are optional practice recipes; no generated provider is automatically a security policy:

```sh
npx nest generate pipe common/trim --flat --no-spec
npx nest generate guard common/maintenance --flat --no-spec
npx nest generate interceptor common/timing --flat --no-spec
npx nest generate filter common/http-error --flat --no-spec
```

Read the generated return behavior. A guard stub returning true allows access; do not register
it on protected endpoints. Prefer built-in pipes such as `ParseUUIDPipe`, `ParseIntPipe`, and
`ValidationPipe` before creating a custom class.

| Component | Primary job | Typical attachment |
| --- | --- | --- |
| Pipe | Validate/transform handler arguments | `@Param('id', ParseUUIDPipe)` or global validation |
| Guard | Decide whether the request may proceed | `@UseGuards(ActualAuthGuard)` or `APP_GUARD` |
| Interceptor | Wrap execution, timing, authorized caching | `@UseInterceptors(...)` or `APP_INTERCEPTOR` |
| Exception filter | Map exceptions into safe transport responses | `@UseFilters(...)` or `APP_FILTER` |

For DI-dependent global components, register `APP_GUARD`, `APP_PIPE`, `APP_INTERCEPTOR`, or
`APP_FILTER` as module providers. Constructing them manually with `new` bypasses Nest injection.
Guards run before interceptors and parameter pipes. Cached responses must still pass authentication
and resource authorization; an interceptor is not an authentication substitute.

### 4.2 Write a complete pipe

Replace the generated `src/common/trim.pipe.ts` for this optional recipe:

```typescript
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string') throw new BadRequestException('Expected text.');
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException('Text cannot be empty.');
    return trimmed;
  }
}
```

Use it only on a text argument, not an entire DTO: `@Query('search', TrimPipe) search: string`.
For an injected pipe, register it in its module’s `providers`.

### 4.3 Implement the optional guard, interceptor and filter

Replace `src/common/maintenance.guard.ts` for a concrete guard exercise:

```typescript
import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (process.env.READ_ONLY_MODE === 'true' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      throw new ServiceUnavailableException('Writes are temporarily paused.');
    }
    return true;
  }
}
```

This is a maintenance policy, not authentication. A protected API also needs independently
verified identity and resource authorization. Add `READ_ONLY_MODE=true` to the lab’s ignored
environment file, restart, and expect writes to return 503 once the guard is registered.
Remove that setting and restart when the exercise is complete.

Replace `src/common/timing.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { finalize, type Observable } from 'rxjs';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(_context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const started = performance.now();
    return next.handle().pipe(finalize(() => {
      this.logger.debug({ event: 'request_completed', durationMs: performance.now() - started });
    }));
  }
}
```

`next.handle()` returns the handler’s Observable; `finalize` runs on completion, failure or
unsubscription. This diagnostic example logs no headers or bodies. Production observability
also needs request correlation, consistent structured logs and dependency traces.

Replace `src/common/http-error.filter.ts`:

```typescript
import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter<HttpException> {
  catch(error: HttpException, host: ArgumentsHost): void {
    const status = error.getStatus();
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      error: status >= 500 ? 'Service unavailable.' : error.getResponse(),
    });
  }
}
```

This filter handles deliberate HTTP exceptions only; it does not swallow programming or database
errors. In `projects.controller.ts`, import `UseGuards`, `UseInterceptors`, and `UseFilters`,
plus these three classes from `../common/maintenance.guard.js`, `../common/timing.interceptor.js`,
and `../common/http-error.filter.js`. Add these class decorators above `ProjectsController`:

```typescript
@UseGuards(MaintenanceGuard)
@UseInterceptors(TimingInterceptor)
@UseFilters(HttpErrorFilter)
```

Import the same classes in `projects.module.ts` and add them to its existing `providers` array.
Keep `ProjectsService` and any existing imports/controllers. This registration keeps the optional
exercise scoped to the projects feature; use the APP_* tokens for a deliberate global policy.

### 4.4 Use exceptions deliberately

Use `BadRequestException` for malformed input, `UnauthorizedException` for missing/invalid
authentication, `ForbiddenException` for denied access, `NotFoundException` for absent or
non-disclosable resources, and `ConflictException` for stale versions or state conflicts.
Do not return `{ error: ... }` with HTTP 200, expose SQL errors, or catch every error and return
success. Unknown failures should reach a redacted exception boundary and correlated logs.

For practice, modify a controller to throw `new ConflictException('Reload before saving.')`,
observe HTTP 409, then undo that deliberate exercise. The real condition belongs in a service.

### 4.5 Wire the application and validate requests

Create `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ProjectsModule } from './projects/projects.module.js';

@Module({ imports: [ProjectsModule] })
export class AppModule {}
```

Create `src/main.ts`:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? '3300');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT.');
  }
  const host = process.env.HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Invalid HOST.');
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    validationError: { target: false, value: false },
  }));
  app.enableShutdownHooks();
  await app.listen(port, host);
}

bootstrap().catch(() => {
  console.error('Application startup failed.');
  process.exitCode = 1;
});
```

Before creating secrets, add these lines to the lab’s `.gitignore` in VS Code:

```gitignore
.env
.env.*
!.env.example
.local/
node_modules/
dist/
coverage/
```

Create `.env` containing only these initial nonsecret settings:

```dotenv
PORT=3300
HOST=127.0.0.1
```

Verify the completed milestone:

```sh
npm run typecheck
npm run build
npm run start
```

In another terminal:

```sh
curl.exe -i http://127.0.0.1:3300/projects/11111111-1111-4111-8111-111111111111
```

Expect 404, because that project does not exist. Use Ctrl+C in the first terminal to stop the API.
On non-Windows Bash, use `curl` instead of `curl.exe`.

Create `requests.http` in VS Code and use REST Client’s **Send Request** links:

```http
@base = http://127.0.0.1:3300

### Create
# @name createProject
POST {{base}}/projects
Content-Type: application/json

{"title":"Learn scaffolding"}

### Read the project created above
GET {{base}}/projects/{{createProject.response.body.id}}

### Verify rejection of overposting
POST {{base}}/projects
Content-Type: application/json

{"title":"Reject extra input","admin":true}
```

Send Create before Read. Expect 201, 200, and 400 respectively. Do not save real tokens or
passwords in a tracked `.http` file.

## 5. Prisma objects, migrations, SQL and rollback

### 5.1 Start an isolated PostgreSQL database

Generate a local random password and copy the output into the ignored `.env`; do not commit it:

```sh
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

In `.env`, add `POSTGRES_PASSWORD` with that generated value. Add `DATABASE_URL` using the **same**
value, the PostgreSQL user `postgres`, host `127.0.0.1`, port `55441`, database `scaffold`, and
query `schema=public`. Its shape is `postgresql://postgres:PASSWORD@127.0.0.1:55441/scaffold?schema=public`;
`PASSWORD` is a description to replace in the editor, never a literal credential to use.
The generated hex requires no URL escaping. Keep secrets out of `.env.example`.

Create `compose.yaml`:

```yaml
name: nest-scaffold-lab
services:
  postgres:
    image: postgres:17.11-bookworm
    environment:
      POSTGRES_DB: scaffold
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - "127.0.0.1:55441:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d scaffold"]
      interval: 3s
      timeout: 3s
      retries: 30
volumes:
  postgres-data:
```

This disposable lab uses the bootstrap superuser for convenience. The production-shaped reference
guide separates migration and restricted runtime identities; do not carry this credential design
into a deployed service. Changing the password variable does not change credentials in an existing
PostgreSQL data volume.

```sh
docker compose config --quiet
docker compose up -d --wait postgres
docker compose ps
```

Use `--quiet` for configuration validation so expanded credentials are not printed.

### 5.2 Initialize and describe database objects

Prisma `init` writes a template; preserve your existing `.env` values when reviewing its output:

```sh
npx prisma init --datasource-provider postgresql
```

If this initialization also creates `prisma.config.ts`, remove that generated config in VS Code
for this Prisma 6 lab: the datasource URL below lives in schema.prisma and Prisma loads the root
.env. Do not combine this convention with a newer major-version configuration tutorial.

In VS Code, replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id        String   @id @default(uuid()) @db.Uuid
  title     String   @db.VarChar(120)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
}
```

`model` describes a table, `@id` a primary key, `@unique` a uniqueness constraint, `@@index`
an index, `@relation` foreign-key relationships, and `@@map` / `@map` existing SQL names.
Prefer real constraints to application-only assumptions. Use `prisma db pull` when introspecting
an existing database deliberately; it updates your schema file, so review the diff.

```sh
npx prisma format
npx prisma validate
npx prisma migrate dev --name initial_projects --create-only
```

Open the new `prisma/migrations/<timestamp>_initial_projects/migration.sql` in VS Code.
The timestamp is generated by Prisma; open the actual folder, not a hardcoded example name.
Review its tables, constraints and defaults, then apply:

```sh
npx prisma migrate dev
npx prisma generate
npx prisma migrate status
```

`migrate dev` uses a shadow database and is for development only. This lab’s local administrator
can create that shadow database. Restricted environments need a separately configured shadow DB,
never the live tenant database. Even `--create-only` can detect drift and request a reset; read
that prompt before answering. See [Prisma CLI documentation](https://docs.prisma.io/docs/orm/reference/prisma-cli-reference),
selecting the Prisma 6 contract where applicable. Verify installed flags with `npx prisma migrate dev --help`.

### 5.3 Connect Prisma through one module

Create `src/database/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
```

Create `src/database/database.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
```

In `projects.module.ts`, import `DatabaseModule` from `../database/database.module.js` and add
`imports: [DatabaseModule]` to `@Module`. Replace `projects.service.ts` with the persistent version:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { projectTitle } from './project-title.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly db: PrismaService) {}

  create(title: string) {
    return this.db.project.create({
      data: { title: projectTitle(title) },
      select: { id: true, title: true },
    });
  }

  async findOne(id: string) {
    const project = await this.db.project.findUnique({
      where: { id }, select: { id: true, title: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }
}
```

```sh
npm run typecheck
npm run build
npm run start
```

Send the REST Client Create/Read requests again. Restart the process and repeat Read: the record
now survives restart. Previously created in-memory records were not migrated.

### 5.4 Update a model and review the generated migration

Add `description String? @db.VarChar(2000)` inside `Project` in the editor. Then:

```sh
npx prisma migrate dev --name add_project_description --create-only
```

Inspect the generated SQL; it should add a nullable column rather than drop the table.
Apply and regenerate:

```sh
npx prisma migrate dev
npx prisma generate
npm run typecheck
```

For a rename, inspect whether generated SQL drops and recreates a column. Before this migration
has been applied anywhere, edit that draft SQL to a reviewed `ALTER TABLE ... RENAME COLUMN ...`
when that is the intended data-preserving change. Never rewrite applied migration history.

For an existing populated table, add a nullable field, backfill it, verify the data, then make it
required in a later migration. Adding `NOT NULL` directly can fail on existing rows.

### 5.5 Deploy migrations and run custom SQL

On a deployment job with approved migration credentials, use:

```sh
npx prisma migrate deploy
npx prisma migrate status
```

Deployment does not generate a new migration from your edited schema. Generate/review it in
development and commit the migration folder first. Do not run schema migrations in ordinary API
startup. `prisma generate` generates TypeScript/client artifacts; it is not a database migration.

For the disposable lab, create `scripts/backfill-description.sql` in VS Code:

```sql
BEGIN;
UPDATE "Project"
SET "description" = 'Imported from the scaffolding lesson'
WHERE "description" IS NULL;
COMMIT;
```

Run once after the nullable description migration:

```sh
npx prisma db execute --schema prisma/schema.prisma --file scripts/backfill-description.sql
```

This is the **Prisma 6** invocation. `db execute` does not record a migration. Put durable schema
or data changes into reviewed migration history when reproducibility is required. For unsupported
DDL, create an explicit new migration directory in VS Code, put complete SQL in `migration.sql`,
then test it against a disposable database. Avoid injecting request values into SQL strings;
application queries use Prisma’s parameterized tagged templates.

### 5.6 Rollback, reset and drop are different operations

| Situation | Correct action |
| --- | --- |
| Draft migration never applied/shared | Edit or remove that draft after verifying its status; update schema to match intent. |
| Successful migration already applied | Create a **new corrective forward migration**. Prisma 6 has no automatic `migrate down`. |
| Failed migration | Inspect partial effects, repair/revert actual database state, then reconcile migration history. |
| Disposable local database can be destroyed | `migrate reset` drops/recreates schema state and reapplies migrations. |
| Model/table no longer needed | Remove the model in the editor and generate/review a destructive migration. |
| Accidental production data deletion | Recovery requires a tested backup/restore plan; schema rollback does not resurrect rows. |

Example corrective rollback: remove the optional `description` field from the schema, then
generate `remove_project_description`. Review its `DROP COLUMN` and decide whether to preserve
that column’s data before applying. This is an **alternative exercise**, not part of the main lab.

```sh
npx prisma migrate dev --name remove_project_description --create-only
```

`migrate resolve --rolled-back <failed-migration-folder>` only marks a **failed** migration for
retry; it does not reverse SQL. `--applied` marks a migration after its intended changes are
already present and verified. Replace the argument with the actual inspected migration folder.
Do not use these to pretend a successful migration was undone or to hide drift.

**Destructive optional lab reset:** first check `.env` points to the disposable `scaffold`
database on port 55441, stop the lab API, and accept the loss of its rows. Run interactively:

```sh
npx prisma migrate reset
```

Do not add `--force` to routine workflows. `prisma db push` is useful for disposable prototyping
but does not create migration history. Avoid mixing it into a migration-managed database.
`prisma migrate deploy` is the ordinary release command, not reset or db push.

## 6. Git, merges, upstream tracking and “clear cache”

### 6.1 Start a focused feature branch

```sh
git status --short
git switch -c codex/project-scaffolding
git diff
```

Before a commit, run the available scripts listed by `npm run`, including typecheck/build and
the chosen test suite. Generated test stubs and a successful compile do not prove authorization.

```sh
git add src prisma package.json package-lock.json .gitignore .vscode
git diff --cached --check
git diff --cached
git commit -m "Add project scaffolding and database migration"
```

Inspect the staged diff for secrets. Stage other authored files, such as Compose and scripts,
explicitly when they are ready. `git add -u` stages modifications/deletions to tracked files;
it does not add a new untracked file. It is unrelated to `git push -u`.

### 6.2 Push and understand `-u`

Configure a remote through VS Code **Publish Branch** or add the URL of a repository you own
using `git remote add origin URL`. `URL` is a value to supply, not a literal command argument.
Verify the destination before pushing:

```sh
git remote -v
git push -u origin HEAD
```

`-u` / `--set-upstream` records the remote tracking branch. Later `git push` and `git pull`
can infer that branch. It does not grant permissions or force an overwrite.
[Git’s push documentation](https://git-scm.com/docs/git-push) defines upstream and lease behavior.

```sh
git branch -vv
git fetch --prune origin
git pull --ff-only
```

Fetch updates remote-tracking information; it does not change your working files. Pull fetches
and integrates. `--ff-only` refuses divergence so you choose merge or rebase deliberately.
`--prune` removes stale remote-tracking references, not your local feature branches.

### 6.3 Merge and resolve a real conflict

Start from committed or intentionally stashed work. Substitute the real default branch if it
is not `main`:

```sh
git fetch origin
git merge origin/main
```

In VS Code Source Control, open each item under **Merge Changes**, then **Open in Merge Editor**.
Inspect Incoming, Current and Result. Accepting both can create duplicate imports, routes or
JSON keys; understand the combined behavior before saving. Remove conflict markers and run tests.

```sh
git diff --name-only --diff-filter=U
git add src/projects/projects.service.ts
git diff --cached --check
git merge --continue
```

Stage each resolved file, not just the example service. The unresolved-file command must produce
no paths before completing the merge. To abandon this in-progress merge:

```sh
git merge --abort
```

For an **unpublished** local feature, rebase is an alternative:

```sh
git rebase origin/main
```

Resolve each conflict, stage it, then `git rebase --continue`; use `git rebase --abort` to abandon
the rebase. “Ours/theirs” during rebase does not mean the same intuitive side as an ordinary merge;
inspect the actual code. Do not rewrite a shared branch without coordination.

If a coordinated rewrite of your own published feature is required, `git push --force-with-lease`
is safer than `--force`, but still rewrites history. The lease checks an expected remote state;
background fetches can update that expectation. It is not a normal push or a conflict-resolution tool.

For package-lock conflicts, first resolve package.json, choose a coherent lockfile baseline,
run `npm install` to reconcile, inspect the resulting dependency changes, then run `npm ci` and
tests. Do not retain conflict markers or edit hundreds of dependency hashes manually.

### 6.4 Update `.gitignore` and stop tracking an ignored file

Edit `.gitignore` in VS Code. Ignore secrets and output, not schema/migrations or the lockfile.
If a file was already tracked, adding a pattern does not remove it from Git’s index:

```sh
git check-ignore -v --no-index .env
git ls-files -- .env
git rm --cached -- .env
git add .gitignore
git diff --cached
```

Run `git rm --cached` only if `git ls-files` confirmed it was tracked. It keeps the local file
and stages its removal from the next commit. Previously committed secrets remain in history:
rotate/revoke them and follow the repository’s approved history-remediation procedure.

### 6.5 Clear the right thing

| Symptom | Targeted action |
| --- | --- |
| Git still tracks an ignored output directory | Inspect `git ls-files -- dist`, then `git rm -r --cached -- dist` if appropriate. |
| Suspected npm cache corruption | `npm cache verify` first. |
| Deliberate npm cache rebuild | `npm cache clean --force`, then `npm ci`; this affects npm’s cache, not application data. |
| Stale installed dependencies | `npm ci` replaces node_modules from the committed lockfile. |
| Stale Prisma typings | `npx prisma generate`, then **TypeScript: Restart TS Server**. |
| Stale emitted JavaScript after deleting a source file | Run the safe, scoped dist cleanup below, then build. |
| Stale Redis data | Invalidate the application-owned keys for the right user/tenant; do not flush shared Redis. |
| Docker image not reflecting changed source | `docker compose build api-a` then `docker compose up -d api-a`. |

Do not use `git rm -r --cached .`, `git clean -fdx`, `git reset --hard`, volume deletion or a
Redis FLUSH command as a generic “clear cache” ritual. They affect different resources.

**PowerShell — confirm and remove only this lab’s dist directory:**

```powershell
$labRoot = (Get-Location).Path
$distPath = Join-Path $labRoot 'dist'
if ((Split-Path $labRoot -Leaf) -ne 'nest-scaffold-lab') { throw 'Open the lab root first.' }
if (Test-Path -LiteralPath $distPath) {
    $resolvedDist = (Resolve-Path -LiteralPath $distPath).Path
    if ($resolvedDist -ne $distPath) { throw 'Unexpected dist target.' }
    if ((Get-Item -LiteralPath $resolvedDist).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Refusing to recurse into a linked directory.'
    }
    Remove-Item -LiteralPath $resolvedDist -Recurse -Force
}
```

**Bash alternative, only from the verified lab root:**

```bash
test "${PWD##*/}" = "nest-scaffold-lab" || exit 1
test ! -L dist || exit 1
rm -rf -- ./dist
```

## 7. Debugging and process control

### 7.1 Run and watch deliberately

After a build, start the API normally:

```sh
npm run start
```

For live development, terminal A compiles TypeScript:

```sh
npm run build:watch
```

Wait for “0 errors.” Terminal B restarts the API when emitted JavaScript changes:

```sh
npm run start:dev
```

Both processes are needed with this direct-tsc setup. Ctrl+C stops the process attached to the
current terminal. Stop both when finished. A compiled entrypoint running without `--watch` does
not automatically reload edits.

For a second manually launched host API, give it its own HTTP and inspector ports.
**Bash** can scope an environment override to one command:

```bash
PORT=3301 node --env-file=.env --inspect=127.0.0.1:9234 dist/main.js
```

**PowerShell** can temporarily set and then restore the process environment:

```powershell
$previousLabPort = $env:PORT
try {
    $env:PORT = '3301'
    node --env-file=.env --inspect=127.0.0.1:9234 dist/main.js
} finally {
    $env:PORT = $previousLabPort
}
```

Existing process environment values take precedence over Node’s env-file values. Keep HOST on
loopback for these host exercises. A second API port does not create a second database or tenant.

### 7.2 Add launch and attach configurations

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "build lab", "type": "npm", "script": "build", "problemMatcher": "$tsc" }
  ]
}
```

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch API A", "type": "node", "request": "launch",
      "program": "${workspaceFolder}/dist/main.js",
      "cwd": "${workspaceFolder}", "envFile": "${workspaceFolder}/.env",
      "env": { "PORT": "3300", "HOST": "127.0.0.1" },
      "preLaunchTask": "build lab", "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"], "console": "integratedTerminal"
    },
    {
      "name": "Launch API B", "type": "node", "request": "launch",
      "program": "${workspaceFolder}/dist/main.js",
      "cwd": "${workspaceFolder}", "envFile": "${workspaceFolder}/.env",
      "env": { "PORT": "3301", "HOST": "127.0.0.1" },
      "sourceMaps": true, "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"], "console": "integratedTerminal"
    },
    {
      "name": "Attach host API", "type": "node", "request": "attach",
      "address": "127.0.0.1", "port": 9230,
      "sourceMaps": true, "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Attach container A", "type": "node", "request": "attach",
      "address": "127.0.0.1", "port": 9231,
      "localRoot": "${workspaceFolder}", "remoteRoot": "/app",
      "sourceMaps": true, "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "name": "Attach container B", "type": "node", "request": "attach",
      "address": "127.0.0.1", "port": 9232,
      "localRoot": "${workspaceFolder}", "remoteRoot": "/app",
      "sourceMaps": true, "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ],
  "compounds": [
    {
      "name": "Launch two host APIs", "configurations": ["Launch API A", "Launch API B"],
      "preLaunchTask": "build lab", "stopAll": true
    },
    {
      "name": "Attach both containers",
      "configurations": ["Attach container A", "Attach container B"], "stopAll": true
    }
  ]
}
```

Build before launching API B alone. The compound builds first; API A’s individual prelaunch task
may perform a second sequential build. Avoid two simultaneous watch compilers targeting the same
dist directory. Source paths here are for this lab’s `dist/main.js`; the reference guide uses
`dist/src/main.js`. Use its actual tsconfig/output when adapting a configuration.

Stop a manually running API before Launch uses the same HTTP port. For Attach, first run:

```sh
npm run start:debug
```

Then select **Attach host API** in Run and Debug. `--inspect` starts immediately; use
`--inspect-brk=127.0.0.1:9230` when you must pause before bootstrap. Never publish an inspector
on a public interface. Node debugging and source maps are documented in the
[VS Code Node debugger guide](https://code.visualstudio.com/docs/nodejs/nodejs-debugging).

### 7.3 Breakpoints and stepping

| Action | Windows shortcut / UI | What to expect |
| --- | --- | --- |
| Set/remove a breakpoint | F9 or click the gutter | Toggles a pause at that executable line. |
| Start/continue | F5 | Launches selected configuration or resumes execution. |
| Step over | F10 | Executes the current statement without entering its function. |
| Step into | F11 | Enters the called function when available. |
| Step out | Shift+F11 | Runs until the current function returns. |
| Stop | Shift+F5 | Stops a launched process; attach may only disconnect. |
| Remove every breakpoint | Run → Remove All Breakpoints | Clears persisted breakpoints. |
| Disable without deleting | Breakpoints panel checkbox | Keeps the location for later. |
| Conditional breakpoint | Right-click gutter → Add Conditional Breakpoint | Pauses only when the expression is true. |
| Logpoint | Right-click gutter → Add Logpoint | Prints selected nonsensitive values without pausing. |

“Step up” usually means **Step Out**. Selecting an earlier frame in Call Stack changes what you
inspect; it does not reverse execution. Restart Frame, when supported, can rerun code and does
not undo database or external effects. Never assume stepping backward restores state.

Try a breakpoint inside `ProjectsService.create`, send the REST Client request, inspect `title`
in Variables, add `title.length` to Watch, then Step Over and Continue. The Debug Console evaluates
expressions in the selected frame and can execute real code: avoid mutations and secret dumps.
Async stepping may pause at another callback rather than follow a simple synchronous stack.

A hollow/unbound breakpoint usually means stale output, wrong `outFiles`, missing source maps,
or a mismatched local/container source tree. Build, confirm the actual JS path and `.map` files,
then inspect **Debug: Diagnose Breakpoint Problems** when available. Do not debug an old image
with new local TypeScript and assume line mappings remain valid.

### 7.4 Identify the process before stopping it

**PowerShell, read-only port inspection:**

```powershell
Get-NetTCPConnection -LocalPort 3300 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

Find that PID in VS Code’s terminal/process output or `Get-Process`. Prefer Ctrl+C or the debugger’s
Stop action. If a process is orphaned, use `Stop-Process -Id` with the **confirmed** PID. Do not
kill every node.exe process: other applications and developers may be using them.

**Git Bash on Windows, read-only:**

```bash
netstat.exe -ano | grep ':3300'
```

On Linux/macOS Bash, use the platform’s `lsof`/`ss` instead; Windows PID tools are not portable.

## 8. Add and run a separate TCP microservice

This optional exercise creates a separate process, not another HTTP route. Install the matching
Nest package:

```sh
npm install --save-exact @nestjs/microservices@12.1.2
```

Create `src/worker/worker.controller.ts`:

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class WorkerController {
  @MessagePattern({ cmd: 'ping' })
  ping(): { status: string } { return { status: 'ok' }; }
}
```

Create `src/worker/worker.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller.js';

@Module({ controllers: [WorkerController] })
export class WorkerModule {}
```

Create `src/worker.ts`:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { WorkerModule } from './worker/worker.module.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.WORKER_PORT ?? '3400');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid WORKER_PORT.');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(WorkerModule, {
    transport: Transport.TCP, options: { host: '127.0.0.1', port },
  });
  app.enableShutdownHooks();
  await app.listen();
}
bootstrap().catch(() => { console.error('Worker startup failed.'); process.exitCode = 1; });
```

Create `src/worker-ping.ts` for a bounded smoke check:

```typescript
import 'reflect-metadata';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

const client = ClientProxyFactory.create({
  transport: Transport.TCP, options: { host: '127.0.0.1', port: 3400 },
});
try {
  const reply: unknown = await firstValueFrom(
    client.send<unknown>({ cmd: 'ping' }, {}).pipe(timeout(3000)),
  );
  console.log(reply);
} finally { client.close(); }
```

```sh
npm run build
node --inspect=127.0.0.1:9233 dist/worker.js
```

In another terminal:

```sh
node dist/worker-ping.js
```

Expect `{ status: 'ok' }`. Curl cannot speak Nest’s TCP transport. Duplicate the Attach host
configuration in VS Code, rename it Attach worker, and set port 9233. HTTP 3300, TCP 3400 and
debug 9233 are different listeners. Ctrl+C stops the worker. For non-default WORKER_PORT, update
the smoke client consistently. This local ping worker has no remote authentication and remains
loopback-only. See [Nest microservices](https://docs.nestjs.com/microservices/basics).

## 9. Docker Compose and multiple backends

### 9.1 Know the lifecycle commands

| Command | Effect |
| --- | --- |
| `docker compose up -d --wait postgres` | Create/start and wait for the DB health check. |
| `docker compose logs --tail 100 -f postgres` | Follow logs; Ctrl+C stops following, not the container. |
| `docker compose stop postgres` | Stop, retaining the container and named data volume. |
| `docker compose start postgres` | Start the existing stopped container. |
| `docker compose restart postgres` | Restart the existing container with its existing configuration. |
| `docker compose up -d postgres` | Reconcile changed Compose configuration; may recreate the container. |
| `docker compose down` | Remove project containers/network; retain named volumes by default. |
| `docker compose down --volumes` | **Delete the lab’s named volumes and database data.** Explicit disposal only. |

`restart` does not apply changed environment variables or port mappings. Use `up -d` to reconcile
them. See the [restart reference](https://docs.docker.com/reference/cli/docker/compose/restart/).
Do not use system-wide Docker prune as routine project cleanup.

### 9.2 Understand host and container ports

`127.0.0.1:55441:5432` means host loopback 55441 forwards to container 5432. Another container
connects to `postgres:5432`, using the Compose service name, not `localhost:55441`. Each container
has its own localhost. `EXPOSE` documents a port; it does not publish one.
[Compose networking](https://docs.docker.com/compose/how-tos/networking) explains service DNS.

Two host processes need different HTTP and inspector ports. Two containers can both listen on
internal 3300/9229 but need different published host ports. Do not add fixed `container_name`
values; Compose project/service naming supports independent stacks better.

### 9.3 Build a development image with matching source maps

Create `.dockerignore`:

```text
.git
node_modules
dist
.env
.env.*
.local
coverage
```

Create `Dockerfile.dev` in VS Code:

```dockerfile
FROM node:24.21.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
USER node
CMD ["node", "--inspect=0.0.0.0:9229", "--enable-source-maps", "dist/main.js"]
```

This is a development image containing build tools and source. For production, use a multistage
build, omit dev dependencies, remove the inspector and apply deployment controls. Generate Prisma
inside Linux; do not copy Windows node_modules or generated native binaries into the image.

In VS Code create ignored `.env.api-a` by copying `.env`. Change PORT to 3300, HOST to 0.0.0.0,
and DATABASE_URL’s host/port to `postgres:5432`, retaining its password and database. Remove
POSTGRES_PASSWORD from this API-only file. Make `.env.api-b` with the same internal settings.
The two APIs intentionally share the **lab database**, so each observes the other’s writes.

Create `compose.debug.yaml`:

```yaml
services:
  api-a:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env.api-a
    ports:
      - "127.0.0.1:3300:3300"
      - "127.0.0.1:9231:9229"
    depends_on:
      postgres:
        condition: service_healthy
    init: true
  api-b:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env.api-b
    ports:
      - "127.0.0.1:3301:3300"
      - "127.0.0.1:9232:9229"
    depends_on:
      postgres:
        condition: service_healthy
    init: true
```

Stop host APIs occupying 3300/3301, ensure migrations have already been applied, and run:

```sh
docker compose -f compose.yaml -f compose.debug.yaml config --quiet
docker compose -f compose.yaml -f compose.debug.yaml up -d --build api-a api-b
docker compose -f compose.yaml -f compose.debug.yaml ps
docker compose -f compose.yaml -f compose.debug.yaml logs --tail 50 api-a api-b
```

The database has a health check; this example does not claim API readiness merely from “running.”
Send REST requests to both ports to verify startup, then choose **Attach both containers**.
The inspector binds 0.0.0.0 inside each container but is published on host loopback only.
Trusted containers on that network can still reach it; do not put untrusted workloads there.

This image does not bind-mount source. After edits, rebuild the affected service and `up -d` it;
also rebuild locally to keep VS Code’s source maps aligned. Restart alone does not copy new code.
If you adopt bind mounts, keep Linux node_modules in a container volume and use a deliberate watch
workflow; never mount host Windows node_modules over container dependencies.

For a second **independent** stack, a different `-p` project name isolates networks/volumes but
does not change host ports. Create a reviewed Compose variant with different published HTTP,
database and debug ports before running that second stack. Do not start both with this port map.

```sh
docker compose -f compose.yaml -f compose.debug.yaml down
```

### 9.4 Debug tenant A and tenant B at the same time

Use the protected application built from **StepByStepGuide.md** for this exercise. Keep its
catalog and two tenant databases; do not retrofit a tenant selector into the unauthenticated lab.
Its fixtures deliberately use colliding IDs to expose accidental cross-tenant routing.

1. Open the reference project in VS Code. Build its source and use its actual output path
   `dist/src/main.js` in a copied launch configuration.
2. Create two ignored environment files from its working environment. Set API A’s PORT to 3102
   and API B’s PORT to 3103. Preserve the catalog, target allowlist, region and separate database
   credentials; both API processes may use the same authorized catalog.
3. Assign distinct host inspector ports, such as 9241 and 9242, when starting manually. For a
   launch compound, use two configurations with separate envFile paths and ports, and one build
   task before starting them. Select the intended session in VS Code’s debug toolbar/Call Stack.
4. Sign in separately as `owner@example.test` for tenant alpha and tenant beta, using the local
   fixture password from ignored configuration. Alpha ID is `11111111-1111-4111-8111-111111111111`;
   beta ID is `22222222-2222-4222-8222-222222222222`. Store tokens only in private runtime state.
5. Send alpha’s token with alpha’s `X-Tenant-ID` to A; send beta’s token and selector to B.
   A port is a process identity, **not** a tenant boundary. The same properly configured API can
   serve both tenants only after independent catalog, membership and resource authorization.
6. In the reference database adapter, set a conditional breakpoint where its verified `context`
   is in scope: `context.tenantId === '11111111-1111-4111-8111-111111111111'`. Set the corresponding
   beta condition in the other session. Inspect tenant/user/placement identifiers, never passwords
   or full connection strings. Header resolution alone is not authorization.
7. Request colliding project IDs through each authorized context and verify the correct database.
   Pair alpha’s token with beta’s selector and verify denial. Verify another member cannot access
   the owner’s project. A debugger pause is not proof of isolation; run the reference HTTP acceptance
   tests, including spoofed selectors and cross-tenant cases.
8. For jobs, break after the worker establishes and reauthorizes its own immutable tenant context.
   Do not copy a request-scoped service or trust a stale request token as job authorization.

Pausing one Node process pauses all requests on its event loop, possibly triggering client,
database, queue-lock or probe timeouts. Separate processes make concurrent investigation clearer.
Use conditional breakpoints/logpoints for narrow inspection; never weaken authorization or tenant
filters to make a debugging request succeed. Namespace cache/job keys by tenant and required user
scope, and verify those keys while tracing cache hits and background processing.

## 10. A repeatable daily workflow

1. Fetch, inspect status, and choose the correct branch and environment.
2. Generate the smallest useful artifact with `--dry-run`, then apply it once.
3. Implement one behavior in VS Code; use Ctrl+. imports, F2 rename, F12 definition and Shift+F12
   references instead of broad text replacement.
4. Confirm module wiring and `.js` import suffixes. Format and typecheck.
5. For persistence, create a draft migration, inspect SQL, apply locally, regenerate, then test.
6. Use saved HTTP requests and meaningful automated tests for success, validation, authorization
   and concurrency failures. Debug the specific failing behavior.
7. Review the Git diff, migration SQL and lockfile. Stage focused files and check for secrets.
8. Commit, push with the correct upstream, and use the team’s review process.

This guide is a documentation artifact. Its snippets and configuration examples are intended for
the separate lab described above. Scaffolding, package installation, migrations, Docker builds and
live tenant acceptance must be executed in that lab before claiming those results. The reference
repository’s application code, databases, Git remotes and VS Code extensions are not changed by
creating this guide.

Authoring checks: JSON examples parsed; the complete TypeScript examples were syntax-parsed
(not typechecked as an installed application); PowerShell/common-shell command blocks were
syntax-parsed without execution; the two Compose examples passed configuration validation
using temporary nonproduction environment values. These checks do not establish runtime,
database-migration, authentication or tenant-isolation guarantees.
