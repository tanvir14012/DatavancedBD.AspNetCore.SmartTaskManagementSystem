# A small NestJS CRUD application, built properly

This complete Windows lesson uses one PostgreSQL database and one business entity: **Project**.
There is no multi-tenancy. We construct the files manually to teach modules, providers, DTOs,
controllers, services, guards, interceptors, persistence and jobs without generic repositories
or CQRS plumbing. Existing repository code and the earlier guide remain unchanged.

We implement registration, JWT sign-in, rotating refresh tokens with replay detection, sign-out,
password changes, administrator-created users, user activation, role CRUD and assignments,
owner-authorized project CRUD, Redis response/query caching, BullMQ startup seeding, Pino logs,
Swagger, VS Code debugging and Windows CMD/Docker run scripts. This is an Identity-style subset:
email confirmation, MFA, recovery-email delivery and external providers are outside this lesson.

Prerequisites: Windows 11, PowerShell 5.1/7, Node.js 24 LTS, npm, Docker Desktop in Linux-container
mode, Git and optionally VS Code. Keep ports 3200, 55440, 56380 and debugger port 9230 free.
Use a fresh directory from Step 1. Every authored file appears in full. npm, Prisma and TypeScript
generate their lockfile, client and JavaScript output through the commands shown.

Request flow: Pino middleware → throttling → bootstrap readiness gate → Passport JWT guard →
role/permission guard → authentication-context interceptor → optional response cache → validation
pipes → controller → service → Prisma/Redis. Guards authenticate and authorize. The requested
auth interceptor safely attaches verified request context; it never replaces the JWT guard.

Run numbered steps in order in one PowerShell terminal so its helper functions remain available.
The final foreground startup commands use a second terminal for tests. Never paste Markdown fences.

## Step 1: Create an empty teaching workspace

- **Goal**: I isolate this single-database exercise from the existing backend.
- **Command / Action**:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$schoolRoot = Join-Path $env:USERPROFILE 'source\nestjs-crud-school'
if ((Test-Path $schoolRoot) -and @(Get-ChildItem $schoolRoot -Force).Count -gt 0) { throw 'Choose an empty folder.' }
New-Item -ItemType Directory -Path $schoolRoot -Force | Out-Null
Set-Location -LiteralPath $schoolRoot
function Write-Source {
    param([string]$Path, [string]$Content)
    [IO.File]::WriteAllText((Join-Path (Get-Location).Path $Path), $Content.Replace("`r`n", "`n").TrimEnd() + "`n", [Text.UTF8Encoding]::new($false))
}
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE." }
}
Invoke-Checked node @('--version')
if ([int](& node -p 'parseInt(process.versions.node)') -lt 24) { throw 'Use Node.js 24 LTS or newer supported LTS.' }
Invoke-Checked npm.cmd @('--version')
Invoke-Checked docker @('version')
Invoke-Checked docker @('compose', 'version')
Invoke-Checked git @('init')
```

Start Docker Desktop in Linux-container mode. Use PowerShell 5.1 or 7 for construction; later .cmd scripts also run directly in Windows CMD. Keep this terminal open for its helper functions. The file writer avoids BOM and UTF-16 defaults. The pinned Node image follows the [official Node 24.21.0 LTS release](https://nodejs.org/en/blog/release/v24.21.0).

## Step 2: Exclude secrets and generated output

- **Goal**: I prevent local credentials and build output from entering Git.
- **Command / Action**:

```powershell
Write-Source '.gitignore' @'
node_modules/
dist/
generated/
.env
.env.*
.local/
coverage/
*.log
'@
```

## Step 3: Set portable source formatting

- **Goal**: I make formatting independent of the Windows editor.
- **Command / Action**:

```powershell
Write-Source '.editorconfig' @'
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
'@
```

## Step 4: Configure readable formatting

- **Goal**: I use one style for all lesson files.
- **Command / Action**:

```powershell
Write-Source '.prettierrc.json' @'
{ "singleQuote": true, "trailingComma": "all" }
'@
```

## Step 5: Pin the compatible toolchain

- **Goal**: I declare every package before installing framework code.
- **Command / Action**:

```powershell
Write-Source 'package.json' @'
{
  "name": "nestjs-crud-school",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "generate": "prisma generate",
    "build": "tsc -p tsconfig.json && node scripts/copy-client.mjs",
    "build:watch": "tsc -p tsconfig.json --watch",
    "start": "node --env-file=.env dist/src/main.js",
    "start:docker": "node dist/src/main.js",
    "start:dev": "node --env-file=.env --watch dist/src/main.js",
    "start:debug": "node --env-file=.env --inspect=127.0.0.1:9230 --enable-source-maps dist/src/main.js",
    "migrate": "node --env-file=.env.admin node_modules/prisma/build/index.js migrate deploy",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test",
    "format": "prettier --write src test scripts/*.mjs package.json tsconfig.json eslint.config.mjs .vscode/*.json",
    "format:check": "prettier --check src test scripts/*.mjs package.json tsconfig.json eslint.config.mjs .vscode/*.json",
    "test": "node --test dist/test/security.test.js",
    "test:e2e": "node --env-file=.env dist/test/e2e.js"
  },
  "dependencies": {
    "@nestjs/common": "12.1.2",
    "@nestjs/core": "12.1.2",
    "@nestjs/platform-express": "12.1.2",
    "@nestjs/passport": "12.0.0",
    "passport": "0.7.0",
    "passport-jwt": "4.0.1",
    "@nestjs/jwt": "12.0.2",
    "@nestjs/throttler": "6.7.1",
    "@nestjs/bullmq": "12.0.0",
    "bullmq": "5.81.5",
    "ioredis": "5.11.1",
    "@nestjs/swagger": "12.0.2",
    "nestjs-pino": "5.2.1",
    "pino": "10.3.1",
    "pino-http": "11.0.0",
    "argon2": "0.45.1",
    "helmet": "8.3.0",
    "@prisma/client": "6.19.3",
    "class-validator": "0.15.1",
    "class-transformer": "0.5.1",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2"
  },
  "devDependencies": {
    "@types/node": "22.20.4",
    "@types/express": "5.0.6",
    "@types/passport": "1.0.17",
    "@types/passport-jwt": "4.0.1",
    "typescript": "5.9.3",
    "prisma": "6.19.3",
    "eslint": "10.11.0",
    "typescript-eslint": "8.70.1",
    "prettier": "3.9.9"
  },
  "overrides": {
    "deepmerge-ts": "8.0.0"
  }
}
'@
```

Peer dependencies were checked for Nest 12. BullMQ stays on its v5 line. Prisma 6 uses a schema-file datasource; do not mix Prisma 7/8 instructions into this lesson. We choose Argon2id. A global Nest CLI is unnecessary because every authored file is shown.

## Step 6: Enable strict types and source maps

- **Goal**: I catch unsafe contracts and support debugging the original TypeScript.
- **Command / Action**:

```powershell
Write-Source 'tsconfig.json' @'
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "Node16",
    "moduleResolution": "Node16",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
'@
```

## Step 7: Enable typed linting

- **Goal**: I detect unsafe values and unobserved promises early.
- **Command / Action**:

```powershell
Write-Source 'eslint.config.mjs' @'
import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommendedTypeChecked, {
  languageOptions: {
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
'@
```

## Step 8: Install and lock dependencies

- **Goal**: I create the dependency lockfile and install its exact resolution.
- **Command / Action**:

```powershell
Invoke-Checked npm.cmd @('install', '--package-lock-only', '--ignore-scripts')
Invoke-Checked npm.cmd @('ci')
Invoke-Checked npm.cmd @('ls', '--depth=0')
```

Commit package-lock.json in the new project; subsequent installs use npm ci. Argon2 ships native binaries for supported platforms. If your platform needs compilation, use node-argon2’s official build prerequisites rather than weakening password hashing.

## Step 9: Generate local secrets once

- **Goal**: I separate API credentials from migration credentials and avoid hardcoded admin passwords.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/configure.mjs' @'
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const paths = [
  '.env',
  '.env.admin',
  '.env.compose',
  '.env.docker',
  '.env.admin.docker',
  '.local/init.sql',
  '.local/redis.conf',
];
if (paths.every((path) => existsSync(path))) {
  console.log('Existing configuration retained.');
  process.exit(0);
}
if (paths.some((path) => existsSync(path)))
  throw new Error(
    'Partial configuration exists; restore it instead of rotating credentials over an existing volume.',
  );
mkdirSync('.local', { recursive: true });
const secret = () => randomBytes(32).toString('hex');
const databaseAdmin = secret();
const databaseRuntime = secret();
const redisPassword = secret();
const jwtKey = secret();
const adminPassword = secret();
const write = (path, content) =>
  writeFileSync(path, content + '\n', { encoding: 'utf8', mode: 0o600 });
const database = (host, port, user, password) =>
  `postgresql://${user}:${password}@${host}:${port}/crud_school?schema=public&connection_limit=5&pool_timeout=5&connect_timeout=5&socket_timeout=10`;
const runtime = (docker) =>
  [
    'NODE_ENV=development',
    'PORT=3200',
    `HOST=${docker ? '0.0.0.0' : '127.0.0.1'}`,
    `DATABASE_URL=${database(docker ? 'postgres' : '127.0.0.1', docker ? 5432 : 55440, 'crud_api', databaseRuntime)}`,
    `REDIS_HOST=${docker ? 'redis' : '127.0.0.1'}`,
    `REDIS_PORT=${docker ? 6379 : 56380}`,
    `REDIS_PASSWORD=${redisPassword}`,
    `JWT_SECRET=${jwtKey}`,
    'JWT_ISSUER=crud-school',
    'JWT_AUDIENCE=crud-school-api',
    'ALLOWED_ORIGINS=http://localhost:5173',
    'SWAGGER_ENABLED=true',
    'SEED_ON_START=true',
    'SEED_ADMIN_EMAIL=admin@example.test',
    `SEED_ADMIN_PASSWORD=${adminPassword}`,
  ].join('\n');
write('.env', runtime(false));
write('.env.docker', runtime(true));
write(
  '.env.admin',
  `DATABASE_URL=${database('127.0.0.1', 55440, 'postgres', databaseAdmin)}`,
);
write(
  '.env.admin.docker',
  `DATABASE_URL=${database('postgres', 5432, 'postgres', databaseAdmin)}`,
);
write(
  '.env.compose',
  `POSTGRES_PASSWORD=${databaseAdmin}\nREDIS_PASSWORD=${redisPassword}`,
);
write(
  '.local/init.sql',
  `CREATE ROLE crud_api LOGIN PASSWORD '${databaseRuntime}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE crud_school FROM PUBLIC;
GRANT CONNECT ON DATABASE crud_school TO crud_api;
ALTER ROLE crud_api SET statement_timeout='10s';
ALTER ROLE crud_api SET lock_timeout='3s';
ALTER ROLE crud_api SET idle_in_transaction_session_timeout='15s';`,
);
write(
  '.local/redis.conf',
  `bind 0.0.0.0
protected-mode yes
requirepass ${redisPassword}
appendonly yes
maxmemory 256mb
maxmemory-policy noeviction`,
);
console.log(
  'Private configuration created. Read .env in your editor for the generated initial admin password; never commit it.',
);
'@
```

The administrator is admin@example.test with a generated password. File modes do not replace Windows ACLs: keep settings in your private profile. Seed secrets never enter Redis jobs. After initial provisioning, disable SEED_ON_START and remove its password from deployed settings.

## Step 10: Define healthy PostgreSQL and Redis services

- **Goal**: I isolate durable storage from the Node process.
- **Command / Action**:

```powershell
Write-Source 'compose.yaml' @'
name: nestjs-crud-school
services:
  postgres:
    image: postgres:17.11-bookworm
    environment:
      POSTGRES_DB: crud_school
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Generate configuration first}
    ports: ["127.0.0.1:55440:5432"]
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./.local/init.sql:/docker-entrypoint-initdb.d/01-runtime-role.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d crud_school"]
      interval: 3s
      timeout: 3s
      retries: 30
  redis:
    image: redis:8.2.9-alpine
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
    environment:
      REDISCLI_AUTH: ${REDIS_PASSWORD:?Generate configuration first}
    ports: ["127.0.0.1:56380:6379"]
    volumes:
      - redis-data:/data
      - ./.local/redis.conf:/usr/local/etc/redis/redis.conf:ro
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 3s
      retries: 30
volumes:
  postgres-data:
  redis-data:
'@
```

Init SQL runs only on an empty PostgreSQL volume. Redis persistence and noeviction protect jobs; cache entries use TTL and fail open on write errors. See [BullMQ operational guidance](https://docs.bullmq.io/guide/going-to-production). Production needs scanned image digests, TLS and separately planned resources.

## Step 11: Start and verify dependencies

- **Goal**: I check storage readiness before database administration.
- **Command / Action**:

```powershell
Invoke-Checked node @('scripts/configure.mjs')
Invoke-Checked docker @('compose', '--env-file', '.env.compose', 'config', '--quiet')
Invoke-Checked docker @('compose', '--env-file', '.env.compose', 'up', '-d', '--wait', '--wait-timeout', '120', 'postgres', 'redis')
Invoke-Checked docker @('compose', '--env-file', '.env.compose', 'exec', '-T', 'redis', 'redis-cli', 'ping')
```

Expect PONG and healthy containers. Never print resolved Compose configuration containing secrets; use --quiet. No existing repository stack is touched or reset.

## Step 12: Model users, roles, sessions and projects

- **Goal**: I put identity and project relations in one ordinary PostgreSQL database.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'prisma' -Force | Out-Null
Write-Source 'prisma/schema.prisma' @'
generator client {
  provider = "prisma-client-js"
  output = "../generated/prisma"
}
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}
model AppState {
  id String @id @db.VarChar(32)
  seeded Boolean @default(false)
  projectRevision BigInt @default(0)
}
model User {
  id String @id @default(uuid()) @db.Uuid
  email String @unique @db.VarChar(254)
  displayName String @db.VarChar(80)
  passwordHash String @db.VarChar(256)
  active Boolean @default(true)
  securityVersion Int @default(1)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  roles UserRole[]
  sessions AuthSession[]
  projects Project[]
}
model Role {
  id String @id @default(uuid()) @db.Uuid
  name String @db.VarChar(32)
  normalizedName String @unique @db.VarChar(32)
  system Boolean @default(false)
  permissions String[]
  users UserRole[]
}
model UserRole {
  userId String @db.Uuid
  roleId String @db.Uuid
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Restrict)
  @@id([userId, roleId])
  @@index([roleId])
}
model AuthSession {
  id String @id @default(uuid()) @db.Uuid
  userId String @db.Uuid
  expiresAt DateTime @db.Timestamptz(3)
  revokedAt DateTime? @db.Timestamptz(3)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]
  @@index([userId, expiresAt])
}
model RefreshToken {
  hash String @id @db.Char(64)
  sessionId String @db.Uuid
  usedAt DateTime? @db.Timestamptz(3)
  session AuthSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
}
model Project {
  id String @id @default(uuid()) @db.Uuid
  ownerId String @db.Uuid
  name String @db.VarChar(120)
  description String @db.VarChar(2000)
  version Int @default(1)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  owner User @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  @@index([ownerId, createdAt, id])
}
'@
```

AuthSession is a refresh-token family. Revoking it invalidates its access JWTs on the next request. Used refresh-token hashes remain until the session expires so reuse can be detected. Projects are private to their creator; administrator status does not bypass project ownership.

## Step 13: Pin PostgreSQL migration history

- **Goal**: I keep the migration dialect explicit.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'prisma/migrations' -Force | Out-Null
Write-Source 'prisma/migrations/migration_lock.toml' @'
provider = "postgresql"
'@
```

## Step 14: Write the complete initial migration

- **Goal**: I enforce relational integrity and seed readiness in the database.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'prisma/migrations/202609300001_initial' -Force | Out-Null
Write-Source 'prisma/migrations/202609300001_initial/migration.sql' @'
CREATE TABLE "AppState" (
  "id" VARCHAR(32) PRIMARY KEY, "seeded" BOOLEAN NOT NULL DEFAULT false,
  "projectRevision" BIGINT NOT NULL DEFAULT 0 CHECK ("projectRevision" >= 0)
);
INSERT INTO "AppState" ("id") VALUES ('app');
CREATE TABLE "User" (
  "id" UUID PRIMARY KEY, "email" VARCHAR(254) NOT NULL UNIQUE,
  "displayName" VARCHAR(80) NOT NULL CHECK (length(trim("displayName")) > 0),
  "passwordHash" VARCHAR(256) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "securityVersion" INTEGER NOT NULL DEFAULT 1 CHECK ("securityVersion" > 0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("email" = lower("email"))
);
CREATE TABLE "Role" (
  "id" UUID PRIMARY KEY, "name" VARCHAR(32) NOT NULL,
  "normalizedName" VARCHAR(32) NOT NULL UNIQUE,
  "system" BOOLEAN NOT NULL DEFAULT false, "permissions" TEXT[] NOT NULL,
  CHECK ("permissions" <@ ARRAY['projects:read','projects:write']::text[])
);
CREATE TABLE "UserRole" (
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "roleId")
);
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE TABLE "AuthSession" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "revokedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE TABLE "RefreshToken" (
  "hash" CHAR(64) PRIMARY KEY,
  "sessionId" UUID NOT NULL REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "usedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
CREATE TABLE "Project" (
  "id" UUID PRIMARY KEY,
  "ownerId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(120) NOT NULL CHECK (length(trim("name")) > 0),
  "description" VARCHAR(2000) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Project_ownerId_createdAt_id_idx" ON "Project"("ownerId", "createdAt", "id");
'@
```

## Step 15: Grant DML without DDL

- **Goal**: I permit runtime data seeding while withholding schema and migration-history access.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/grants.sql' @'
GRANT USAGE ON SCHEMA public TO crud_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "AppState", "User", "Role", "UserRole", "AuthSession", "RefreshToken", "Project"
TO crud_api;
'@
```

## Step 16: Validate and migrate the database

- **Goal**: I prepare tables before any API or worker starts.
- **Command / Action**:

```powershell
Invoke-Checked node @('--env-file=.env.admin', 'node_modules/prisma/build/index.js', 'validate')
Invoke-Checked npm.cmd @('run', 'generate')
Invoke-Checked npm.cmd @('run', 'migrate')
Get-Content 'scripts/grants.sql' -Raw | & docker compose --env-file .env.compose exec -T postgres psql -U postgres -d crud_school -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Grant application failed.' }
```

Migrations are explicit administrator work. API startup never runs DDL. The unseeded AppState row will keep authentication and business endpoints at 503 until BullMQ commits the initial data. Future migrations require reviewed grants and representative-data upgrade tests.

## Step 17: Validate environment configuration

- **Goal**: I fail startup on missing secrets and invalid connection settings.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/core' -Force | Out-Null
Write-Source 'src/core/settings.ts' @'
import { Injectable } from '@nestjs/common';
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() !== value) throw new Error(`Invalid ${name}.`);
  return value;
}
function port(name: string): number {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error(`Invalid ${name}.`);
  return value;
}
function flag(name: string): boolean {
  const value = required(name);
  if (!['true', 'false'].includes(value)) throw new Error(`Invalid ${name}.`);
  return value === 'true';
}
@Injectable()
export class Settings {
  readonly production = required('NODE_ENV') === 'production';
  readonly port = port('PORT');
  readonly host = required('HOST');
  readonly databaseUrl = required('DATABASE_URL');
  readonly redisHost = required('REDIS_HOST');
  readonly redisPort = port('REDIS_PORT');
  readonly redisPassword = required('REDIS_PASSWORD');
  readonly jwtSecret = required('JWT_SECRET');
  readonly issuer = required('JWT_ISSUER');
  readonly audience = required('JWT_AUDIENCE');
  readonly swagger = flag('SWAGGER_ENABLED');
  readonly seedOnStart = flag('SEED_ON_START');
  readonly seedEmail = required('SEED_ADMIN_EMAIL').toLowerCase();
  readonly seedPassword = process.env.SEED_ADMIN_PASSWORD;
  readonly origins = required('ALLOWED_ORIGINS').split(',');
  constructor() {
    if (!['development', 'test', 'production'].includes(required('NODE_ENV')))
      throw new Error('Invalid NODE_ENV.');
    const db = new URL(this.databaseUrl);
    if (db.protocol !== 'postgresql:' || !db.username || !db.password)
      throw new Error('Invalid database URL.');
    if (this.jwtSecret.length < 64 || this.redisPassword.length < 32)
      throw new Error('Secrets are too short.');
    if (!['127.0.0.1', '0.0.0.0'].includes(this.host))
      throw new Error('Invalid HOST.');
    if (
      this.seedOnStart &&
      (!this.seedPassword || this.seedPassword.length < 16)
    )
      throw new Error('Seed password is required.');
    for (const origin of this.origins) {
      const url = new URL(origin);
      if (
        url.origin !== origin ||
        !['http:', 'https:'].includes(url.protocol) ||
        (this.production && url.protocol !== 'https:')
      )
        throw new Error('Invalid origin.');
    }
    if (
      this.production &&
      (db.searchParams.get('sslmode') !== 'require' ||
        db.searchParams.get('sslaccept') !== 'strict')
    )
      throw new Error('Production requires verified PostgreSQL TLS.');
    if (this.production && (this.swagger || this.seedOnStart))
      throw new Error('Disable Swagger and initial seeding for production.');
  }
  redisConnection() {
    return {
      host: this.redisHost,
      port: this.redisPort,
      password: this.redisPassword,
      ...(this.production ? { tls: {} } : {}),
    };
  }
}
'@
```

Use a clean terminal without stale environment variables: Node --env-file does not override existing process variables. Local Compose explicitly uses development mode; production requires verified PostgreSQL/Redis TLS and external secret delivery.

## Step 18: Export settings and an injectable clock

- **Goal**: I keep shared providers small and make time-dependent behavior testable.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/core' -Force | Out-Null
Write-Source 'src/core/core.module.ts' @'
import { Injectable, Module } from '@nestjs/common';
import { Settings } from './settings.js';
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
@Module({ providers: [Settings, Clock], exports: [Settings, Clock] })
export class CoreModule {}
'@
```

## Step 19: Encapsulate Prisma lifetime

- **Goal**: I own one bounded pool and close it during graceful shutdown.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/database' -Force | Out-Null
Write-Source 'src/database/database.module.ts' @'
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';
import { CoreModule } from '../core/core.module.js';
import { Settings } from '../core/settings.js';
@Injectable()
export class Database extends PrismaClient implements OnModuleDestroy {
  constructor(settings: Settings) {
    super({
      datasources: { db: { url: settings.databaseUrl } },
      log: [],
      transactionOptions: { maxWait: 3000, timeout: 10000 },
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
@Module({ imports: [CoreModule], providers: [Database], exports: [Database] })
export class DatabaseModule {}
'@
```

## Step 20: Bound every list request

- **Goal**: I prevent unbounded database reads and validate pagination at the HTTP boundary.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/core' -Force | Out-Null
Write-Source 'src/core/page.dto.ts' @'
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class PageDto {
  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset = 0;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
'@
```

## Step 21: Build a small Redis cache service

- **Goal**: I keep cache failures from turning successful business reads into failures.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/cache' -Force | Out-Null
Write-Source 'src/cache/cache.module.ts' @'
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CoreModule } from '../core/core.module.js';
import { Settings } from '../core/settings.js';
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  constructor(settings: Settings) {
    this.redis = new Redis({
      ...settings.redisConnection(),
      db: 1,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 1000,
    });
    // Reads are best-effort; readiness separately reports dependency failure.
    this.redis.on('error', () => undefined);
  }
  async read<T>(
    key: string,
    decode: (value: unknown) => T | undefined,
  ): Promise<T | undefined> {
    try {
      const text = await this.redis.get(`school:cache:${key}`);
      return text === null ? undefined : decode(JSON.parse(text) as unknown);
    } catch {
      return undefined;
    }
  }
  async write(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(
        `school:cache:${key}`,
        JSON.stringify(value),
        'EX',
        60,
      );
    } catch {
      /* The SQL transaction has already committed; cache failure cannot undo it. */
    }
  }
  async healthy(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
@Module({
  imports: [CoreModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
'@
```

Caching is never an authorization source. Query keys will include user ID and a database revision; response keys include resource version and owner. Old keys expire after 60 seconds, so a concurrent cache fill cannot resurrect data under the new version. No Redis FLUSH command is used.

## Step 22: Define trusted principal and token contracts

- **Goal**: I separate verified identity from raw JWT input and persistence records.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/contracts.ts' @'
import { UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
export const PERMISSIONS = ['projects:read', 'projects:write'] as const;
export interface Principal {
  readonly id: string;
  readonly sessionId: string;
  readonly securityVersion: number;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}
export interface AccessClaims {
  sub: string;
  sid: string;
  ver: number;
}
export function accessClaims(value: unknown): AccessClaims {
  if (!value || typeof value !== 'object') throw new UnauthorizedException();
  const row = Object.fromEntries(Object.entries(value));
  if (
    typeof row.sub !== 'string' ||
    !isUUID(row.sub, '4') ||
    typeof row.sid !== 'string' ||
    !isUUID(row.sid, '4') ||
    typeof row.ver !== 'number' ||
    !Number.isSafeInteger(row.ver) ||
    row.ver < 1 ||
    typeof row.exp !== 'number' ||
    !Number.isSafeInteger(row.exp) ||
    row.exp <= 0
  )
    throw new UnauthorizedException();
  return { sub: row.sub, sid: row.sid, ver: row.ver };
}
export function permits(
  principal: Principal,
  roles: readonly string[],
  permissions: readonly string[],
): boolean {
  return (
    (roles.length === 0 ||
      roles.some((role) => principal.roles.includes(role))) &&
    permissions.every((permission) =>
      principal.permissions.includes(permission),
    )
  );
}
'@
```

## Step 23: Validate registration and administration input

- **Goal**: I prevent overposting and document exact request contracts for beginners.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/identity.dto.ts' @'
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PERMISSIONS } from './contracts.js';
export class RegisterDto {
  @ApiProperty({ example: 'learner@example.test' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email = '';
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  displayName = '';
  @ApiProperty({ minLength: 12, maxLength: 128, format: 'password' })
  @IsString()
  @Length(12, 128)
  password = '';
}
export class LoginDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email = '';
  @ApiProperty({ format: 'password' }) @IsString() @Length(12, 128) password =
    '';
}
export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9-]{36}\.[a-f0-9]{64}$/)
  refreshToken = '';
}
export class PasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(12, 128)
  currentPassword = '';
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(12, 128)
  newPassword = '';
}
export class RoleDto {
  @ApiProperty({ example: 'Reader' })
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_-]{2,31}$/)
  name = '';
  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions: string[] = [];
}
export class AssignRolesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds: string[] = [];
}
export class ActiveDto {
  @ApiProperty({ type: Boolean }) @IsBoolean() active: unknown;
}
'@
```

RegisterDto contains no role or active fields. The global validation pipe later rejects unknown properties. PUT role assignment replaces the full role set. System Admin/Member roles cannot be edited or deleted.

## Step 24: Hash passwords with bounded Argon2id work

- **Goal**: I keep memory-hard password verification asynchronous and cap concurrent hash operations.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/password.service.ts' @'
import {
  Injectable,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
@Injectable()
export class PasswordService implements OnModuleInit {
  private active = 0;
  private dummy = '';
  async onModuleInit(): Promise<void> {
    this.dummy = await this.hash('a non-user dummy password for timing');
  }
  private async bounded<T>(action: () => Promise<T>): Promise<T> {
    if (this.active >= 4)
      throw new ServiceUnavailableException('Password service is busy.');
    this.active++;
    try {
      return await action();
    } finally {
      this.active--;
    }
  }
  hash(password: string): Promise<string> {
    return this.bounded(() =>
      hash(password, {
        type: argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
    );
  }
  check(password: string, stored?: string): Promise<boolean> {
    return this.bounded(async () => {
      try {
        return await verify(stored ?? this.dummy, password);
      } catch {
        return false;
      }
    });
  }
}
'@
```

Argon2 stores a unique salt and parameters in its encoded hash. Unknown accounts still run a dummy verification. The per-process four-operation cap prevents unlimited concurrent memory allocations; login throttling is an additional control. Tune cost and capacity with measurements before production.

## Step 25: Implement authentication and rotating refresh tokens

- **Goal**: I keep credential handling, session revocation and replay detection out of controllers.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/auth.service.ts' @'
import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { isUUID } from 'class-validator';
import { Database } from '../database/database.module.js';
import { Clock } from '../core/core.module.js';
import { PasswordService } from './password.service.js';
import type { AccessClaims, Principal } from './contracts.js';
import type { RegisterDto, LoginDto, PasswordDto } from './identity.dto.js';

export const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const userSelect = {
  id: true,
  email: true,
  displayName: true,
  active: true,
  createdAt: true,
} as const;
@Injectable()
export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly clock: Clock,
  ) {}
  async register(input: RegisterDto) {
    const passwordHash = await this.passwords.hash(input.password);
    return this.db.$transaction(async (tx) => {
      const member = await tx.role.findUniqueOrThrow({
        where: { normalizedName: 'MEMBER' },
      });
      return tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          roles: { create: { roleId: member.id } },
        },
        select: userSelect,
      });
    });
  }
  async login(input: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    });
    const valid = await this.passwords.check(
      input.password,
      user?.passwordHash,
    );
    if (!valid || !user?.active)
      throw new UnauthorizedException('Invalid credentials.');
    const session = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (!current.active || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException();
      const now = this.clock.now();
      await tx.authSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: now } },
      });
      if (
        (await tx.authSession.count({
          where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
        })) >= 5
      )
        throw new HttpException('Sign out of an existing session first.', 429);
      const created = await tx.authSession.create({
        data: {
          userId: user.id,
          expiresAt: new Date(now.getTime() + 30 * 86400000),
        },
      });
      const refreshToken = `${created.id}.${randomBytes(32).toString('hex')}`;
      await tx.refreshToken.create({
        data: { hash: tokenHash(refreshToken), sessionId: created.id },
      });
      return {
        id: current.id,
        version: current.securityVersion,
        sessionId: created.id,
        refreshToken,
      };
    });
    return this.tokens(
      session.id,
      session.version,
      session.sessionId,
      session.refreshToken,
    );
  }
  private async tokens(
    id: string,
    version: number,
    sessionId: string,
    refreshToken: string,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: id,
      sid: sessionId,
      ver: version,
    });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 300 };
  }
  async refresh(raw: string) {
    const sessionId = raw.split('.')[0];
    if (!sessionId || !isUUID(sessionId, '4'))
      throw new UnauthorizedException();
    const result = await this.db.$transaction(async (tx) => {
      // Lock the family before re-reading token state: simultaneous refreshes cannot both win.
      await tx.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id"=${sessionId}::uuid FOR UPDATE`;
      const record = await tx.refreshToken.findUnique({
        where: { hash: tokenHash(raw) },
      });
      const family = await tx.authSession.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });
      const now = this.clock.now();
      if (
        !record ||
        record.sessionId !== sessionId ||
        !family ||
        family.revokedAt ||
        family.expiresAt <= now ||
        !family.user.active
      )
        return null;
      if (record.usedAt) {
        await tx.authSession.update({
          where: { id: sessionId },
          data: { revokedAt: now },
        });
        return null; // Commit the revocation; throw only after the transaction returns.
      }
      const refreshToken = `${sessionId}.${randomBytes(32).toString('hex')}`;
      await tx.refreshToken.update({
        where: { hash: record.hash },
        data: { usedAt: now },
      });
      await tx.refreshToken.create({
        data: { hash: tokenHash(refreshToken), sessionId },
      });
      return {
        id: family.userId,
        version: family.user.securityVersion,
        refreshToken,
      };
    });
    if (!result)
      throw new UnauthorizedException('Refresh rejected; sign in again.');
    return this.tokens(
      result.id,
      result.version,
      sessionId,
      result.refreshToken,
    );
  }
  async authenticate(claims: AccessClaims): Promise<Principal> {
    const family = await this.db.authSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: this.clock.now() },
        user: { active: true, securityVersion: claims.ver },
      },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!family) throw new UnauthorizedException();
    const roles = family.user.roles.map((entry) => entry.role);
    return Object.freeze({
      id: family.userId,
      sessionId: family.id,
      securityVersion: claims.ver,
      roles: Object.freeze(roles.map((role) => role.name)),
      permissions: Object.freeze([
        ...new Set(roles.flatMap((role) => role.permissions)),
      ]),
    });
  }
  async logout(principal: Principal): Promise<void> {
    await this.db.authSession.updateMany({
      where: { id: principal.sessionId, userId: principal.id, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }
  async changePassword(
    principal: Principal,
    input: PasswordDto,
  ): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: principal.id },
    });
    if (!(await this.passwords.check(input.currentPassword, user.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect.');
    if (input.currentPassword === input.newPassword)
      throw new ConflictException('Choose a different password.');
    const next = await this.passwords.hash(input.newPassword);
    await this.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: user.id, active: true, passwordHash: user.passwordHash },
        data: { passwordHash: next, securityVersion: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException('Account changed; sign in again.');
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
    });
  }
}
'@
```

Access JWTs last five minutes; refresh families expire absolutely after 30 days. Refresh tokens are random opaque credentials, stored only as hashes. Reusing an old token revokes the entire family, including the newly rotated token. Clients must serialize refresh attempts and replace tokens atomically. Sign-out revokes the session immediately. Password changes revoke every session. Tokens are returned in JSON for the API lesson, never put in URLs or logs; browser applications should use a separately designed HttpOnly-cookie/CSRF flow rather than localStorage.

## Step 26: Implement user and role administration

- **Goal**: I serialize privileged mutations and preserve at least one active administrator.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/admin.service.ts' @'
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/index.js';
import { Database } from '../database/database.module.js';
import { Clock } from '../core/core.module.js';
import type { PageDto } from '../core/page.dto.js';
import type { Principal } from './contracts.js';
import type { RegisterDto, RoleDto } from './identity.dto.js';
import { PasswordService } from './password.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly passwords: PasswordService,
  ) {}
  private async mutate<T>(
    actor: Principal,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      // All admin/role mutations share this transaction-scoped lock, including last-admin checks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74001)`;
      const allowed = await tx.authSession.findFirst({
        where: {
          id: actor.sessionId,
          userId: actor.id,
          revokedAt: null,
          expiresAt: { gt: this.clock.now() },
          user: {
            active: true,
            securityVersion: actor.securityVersion,
            roles: { some: { role: { normalizedName: 'ADMIN' } } },
          },
        },
      });
      if (!allowed) throw new ForbiddenException();
      const result = await action(tx);
      if (
        (await tx.user.count({
          where: {
            active: true,
            roles: { some: { role: { normalizedName: 'ADMIN' } } },
          },
        })) === 0
      )
        throw new ConflictException(
          'The last active administrator must remain.',
        );
      return result;
    });
  }
  users(page: PageDto) {
    return this.db.user.findMany({
      skip: page.offset,
      take: page.limit,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }
  async createUser(actor: Principal, input: RegisterDto) {
    const passwordHash = await this.passwords.hash(input.password);
    return this.mutate(actor, async (tx) => {
      const member = await tx.role.findUniqueOrThrow({
        where: { normalizedName: 'MEMBER' },
      });
      return tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          roles: { create: { roleId: member.id } },
        },
        select: { id: true, email: true, displayName: true, active: true },
      });
    });
  }
  roles(page: PageDto) {
    return this.db.role.findMany({
      skip: page.offset,
      take: page.limit,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, permissions: true, system: true },
    });
  }
  createRole(actor: Principal, input: RoleDto) {
    return this.mutate(actor, (tx) =>
      tx.role.create({
        data: {
          name: input.name,
          normalizedName: input.name.toUpperCase(),
          permissions: input.permissions,
        },
        select: { id: true, name: true, permissions: true },
      }),
    );
  }
  updateRole(actor: Principal, id: string, input: RoleDto) {
    return this.mutate(actor, async (tx) => {
      const role = await tx.role.findUnique({ where: { id } });
      if (!role) throw new NotFoundException();
      if (role.system)
        throw new ConflictException('System roles are immutable.');
      const updated = await tx.role.update({
        where: { id },
        data: {
          name: input.name,
          normalizedName: input.name.toUpperCase(),
          permissions: input.permissions,
        },
        select: { id: true, name: true, permissions: true },
      });
      await tx.user.updateMany({
        where: { roles: { some: { roleId: id } } },
        data: { securityVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { revokedAt: null, user: { roles: { some: { roleId: id } } } },
        data: { revokedAt: this.clock.now() },
      });
      return updated;
    });
  }
  async deleteRole(actor: Principal, id: string): Promise<void> {
    await this.mutate(actor, async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
      });
      if (!role) throw new NotFoundException();
      if (role.system || role._count.users > 0)
        throw new ConflictException(
          'Remove assignments first; system roles cannot be deleted.',
        );
      await tx.role.delete({ where: { id } });
    });
  }
  async assignRoles(
    actor: Principal,
    id: string,
    roleIds: string[],
  ): Promise<void> {
    await this.mutate(actor, async (tx) => {
      if (!(await tx.user.findUnique({ where: { id } })))
        throw new NotFoundException();
      if (
        (await tx.role.count({ where: { id: { in: roleIds } } })) !==
        roleIds.length
      )
        throw new NotFoundException('Role not found.');
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
      await tx.user.update({
        where: { id },
        data: { securityVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
    });
  }
  async setActive(
    actor: Principal,
    id: string,
    active: boolean,
  ): Promise<void> {
    await this.mutate(actor, async (tx) => {
      if (!(await tx.user.findUnique({ where: { id } })))
        throw new NotFoundException();
      await tx.user.update({
        where: { id },
        data: { active, securityVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
    });
  }
}
'@
```

Role changes revoke affected sessions and increment a security version. Built-in Admin and Member cannot be renamed or deleted. An assigned role cannot be deleted. Disabling a user retains project ownership/history. The final-admin invariant is protected by a database lock, not a race-prone controller count.

## Step 27: Define explicit access metadata and current-user access

- **Goal**: I make protected endpoints the default and declare exceptional public routes clearly.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/access.ts' @'
import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from './contracts.js';
export const PUBLIC = Symbol('public');
export const ROLES = Symbol('roles');
export const PERMS = Symbol('permissions');
export const BOOTSTRAP_EXEMPT = Symbol('bootstrap-exempt');
export const Public = () => SetMetadata(PUBLIC, true);
export const Roles = (...names: string[]) => SetMetadata(ROLES, names);
export const Permissions = (...names: string[]) => SetMetadata(PERMS, names);
export const BootstrapExempt = () => SetMetadata(BOOTSTRAP_EXEMPT, true);
export type PrincipalRequest = Request & { user?: Principal };
export function principal(request: PrincipalRequest): Principal {
  if (!request.user) throw new UnauthorizedException();
  return request.user;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    principal(context.switchToHttp().getRequest<PrincipalRequest>()),
);
'@
```

## Step 28: Verify JWTs using Passport

- **Goal**: I constrain algorithm, issuer, audience and lifetime before loading live identity state.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/jwt.strategy.ts' @'
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Settings } from '../core/settings.js';
import { AuthService } from './auth.service.js';
import { accessClaims } from './contracts.js';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    settings: Settings,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: settings.jwtSecret,
      algorithms: ['HS256'],
      issuer: settings.issuer,
      audience: settings.audience,
      ignoreExpiration: false,
    });
  }
  validate(payload: unknown) {
    return this.auth.authenticate(accessClaims(payload));
  }
}
'@
```

[Nest Passport integration](https://docs.nestjs.com/recipes/passport) supplies signature authentication through the strategy and guard. Authorization remains a separate live database decision. Roles are not accepted from the JWT payload.

## Step 29: Add the bootstrap, JWT and RBAC guards

- **Goal**: I reject premature requests and check both roles and permissions before controllers run.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/guards.ts' @'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Database } from '../database/database.module.js';
import {
  BOOTSTRAP_EXEMPT,
  PERMS,
  PUBLIC,
  ROLES,
  principal,
  type PrincipalRequest,
} from './access.js';
import { permits } from './contracts.js';
@Injectable()
export class BootstrapGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: Database,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(BOOTSTRAP_EXEMPT, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const state = await this.db.appState.findUnique({ where: { id: 'app' } });
    if (!state?.seeded)
      throw new ServiceUnavailableException('Initial data is not ready.');
    return true;
  }
}
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  override canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    return super.canActivate(context);
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    return permits(
      principal(context.switchToHttp().getRequest<PrincipalRequest>()),
      this.reflector.getAllAndOverride<string[]>(ROLES, targets) ?? [],
      this.reflector.getAllAndOverride<string[]>(PERMS, targets) ?? [],
    );
  }
}
'@
```

Required roles use OR; required permissions use AND. Admin-only routes use Roles(Admin). Project routes use explicit permissions plus ownership inside the project service. A cache hit still passes all these guards. The bootstrap gate blocks public registration too, preventing a user from claiming the seed administrator before initial enrollment.

## Step 30: Add the authentication-context interceptor

- **Goal**: I enrich request logs and prevent client-side caching after identity has already been verified.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/auth-context.interceptor.ts' @'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import type { PrincipalRequest } from './access.js';
@Injectable()
export class AuthContextInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  constructor(private readonly logger: PinoLogger) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    if (request.user) this.logger.assign({ userId: request.user.id });
    return next.handle();
  }
}
'@
```

The interceptor runs after guards. It does not parse or trust an unverified token, silently refresh tokens, or decide access. No passwords, bearer tokens, refresh tokens or request bodies are logged.

## Step 31: Expose small authentication handlers

- **Goal**: I let DTOs and AuthService own validation and behavior.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/auth.controller.ts' @'
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './access.js';
import {
  LoginDto,
  PasswordDto,
  RefreshDto,
  RegisterDto,
} from './identity.dto.js';
import type { Principal } from './contracts.js';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a Member; role input is forbidden' })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Issue a five-minute access JWT and rotating refresh token',
  })
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: Principal): Promise<void> {
    return this.auth.logout(user);
  }
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(
    @CurrentUser() user: Principal,
    @Body() input: PasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(user, input);
  }
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: Principal) {
    return { id: user.id, roles: user.roles, permissions: user.permissions };
  }
}
'@
```

## Step 32: Expose administrator-only user and role routes

- **Goal**: I keep access requirements visible while delegating mutations to a service.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/admin.controller.ts' @'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageDto } from '../core/page.dto.js';
import { CurrentUser, Roles } from './access.js';
import { AdminService } from './admin.service.js';
import {
  ActiveDto,
  AssignRolesDto,
  RegisterDto,
  RoleDto,
} from './identity.dto.js';
import type { Principal } from './contracts.js';
@ApiTags('Identity administration')
@ApiBearerAuth()
@Roles('Admin')
@Controller('identity')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('users') users(@Query() page: PageDto) {
    return this.admin.users(page);
  }
  @Post('users') createUser(
    @CurrentUser() actor: Principal,
    @Body() input: RegisterDto,
  ) {
    return this.admin.createUser(actor, input);
  }
  @Patch('users/:id/active')
  @HttpCode(204)
  active(
    @CurrentUser() actor: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ActiveDto,
  ): Promise<void> {
    return this.admin.setActive(actor, id, input.active === true);
  }
  @Put('users/:id/roles')
  @HttpCode(204)
  assign(
    @CurrentUser() actor: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: AssignRolesDto,
  ): Promise<void> {
    return this.admin.assignRoles(actor, id, input.roleIds);
  }
  @Get('roles') roles(@Query() page: PageDto) {
    return this.admin.roles(page);
  }
  @Post('roles') createRole(
    @CurrentUser() actor: Principal,
    @Body() input: RoleDto,
  ) {
    return this.admin.createRole(actor, input);
  }
  @Put('roles/:id') updateRole(
    @CurrentUser() actor: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: RoleDto,
  ) {
    return this.admin.updateRole(actor, id, input);
  }
  @Delete('roles/:id')
  @HttpCode(204)
  deleteRole(
    @CurrentUser() actor: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.admin.deleteRole(actor, id);
  }
}
'@
```

## Step 33: Compose the identity module

- **Goal**: I register the strategy, services and guards once and export only reusable providers.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/identity' -Force | Out-Null
Write-Source 'src/identity/identity.module.ts' @'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CoreModule } from '../core/core.module.js';
import { Settings } from '../core/settings.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthService } from './auth.service.js';
import { AdminService } from './admin.service.js';
import { PasswordService } from './password.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { BootstrapGuard, JwtGuard, RolesGuard } from './guards.js';
import { AuthContextInterceptor } from './auth-context.interceptor.js';
import { AuthController } from './auth.controller.js';
import { AdminController } from './admin.controller.js';
@Module({
  imports: [
    CoreModule,
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      imports: [CoreModule],
      inject: [Settings],
      useFactory: (settings: Settings) => ({
        secret: settings.jwtSecret,
        signOptions: {
          algorithm: 'HS256',
          issuer: settings.issuer,
          audience: settings.audience,
          expiresIn: 300,
        },
      }),
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    AdminService,
    PasswordService,
    JwtStrategy,
    BootstrapGuard,
    JwtGuard,
    RolesGuard,
    AuthContextInterceptor,
  ],
  exports: [
    PasswordService,
    BootstrapGuard,
    JwtGuard,
    RolesGuard,
    AuthContextInterceptor,
  ],
})
export class IdentityModule {}
'@
```

## Step 34: Compile the identity foundation

- **Goal**: I check the schema-generated types and module contracts before adding projects.
- **Command / Action**:

```powershell
Invoke-Checked npm.cmd @('run', 'typecheck')
Invoke-Checked node @('node_modules/eslint/bin/eslint.js', 'src')
```

These checks do not prove token rotation or PostgreSQL locking. A later HTTP acceptance script exercises those behaviors against the running app. Keep password and refresh-token handling inside the service rather than moving it into controllers.

## Step 35: Define project input and response contracts

- **Goal**: I validate writes and expose only deliberately selected response fields.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/projects' -Force | Out-Null
Write-Source 'src/projects/project.dto.ts' @'
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateProjectDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name = '';
  @ApiProperty({ maxLength: 2000 }) @IsString() @Length(0, 2000) description =
    '';
}
export class UpdateProjectDto extends CreateProjectDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) @Max(2147483646) version = 0;
}
export class ProjectResponse {
  @ApiProperty({ format: 'uuid' }) id = '';
  @ApiProperty() name = '';
  @ApiProperty() description = '';
  @ApiProperty() version = 1;
  @ApiProperty({ format: 'date-time' }) createdAt = '';
}
export function decodeProject(value: unknown): ProjectResponse | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = Object.fromEntries(Object.entries(value));
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.description !== 'string' ||
    typeof row.version !== 'number' ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1 ||
    typeof row.createdAt !== 'string'
  )
    return undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    createdAt: row.createdAt,
  };
}
export function decodeProjects(value: unknown): ProjectResponse[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.map((item: unknown) => decodeProject(item));
  if (rows.some((row) => row === undefined)) return undefined;
  return rows.filter((row): row is ProjectResponse => row !== undefined);
}
'@
```

## Step 36: Implement transactional owner-scoped CRUD

- **Goal**: I keep controllers clean and make cache invalidation part of successful database writes.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/projects' -Force | Out-Null
Write-Source 'src/projects/projects.service.ts' @'
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Project } from '../../generated/prisma/index.js';
import { Database } from '../database/database.module.js';
import { CacheService } from '../cache/cache.module.js';
import type { PageDto } from '../core/page.dto.js';
import {
  decodeProjects,
  type CreateProjectDto,
  type ProjectResponse,
  type UpdateProjectDto,
} from './project.dto.js';
const response = (row: Project): ProjectResponse => ({
  id: row.id,
  name: row.name,
  description: row.description,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
});
@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: Database,
    private readonly cache: CacheService,
  ) {}
  async list(ownerId: string, page: PageDto): Promise<ProjectResponse[]> {
    const state = await this.db.appState.findUniqueOrThrow({
      where: { id: 'app' },
    });
    const key = `query:projects:${ownerId}:${state.projectRevision}:${page.offset}:${page.limit}`;
    const cached = await this.cache.read(key, decodeProjects);
    if (cached !== undefined) return cached;
    const rows = (
      await this.db.project.findMany({
        where: { ownerId },
        skip: page.offset,
        take: page.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(response);
    await this.cache.write(key, rows);
    return rows;
  }
  async get(ownerId: string, id: string): Promise<ProjectResponse> {
    const row = await this.db.project.findFirst({ where: { id, ownerId } });
    if (!row) throw new NotFoundException();
    return response(row);
  }
  create(ownerId: string, input: CreateProjectDto): Promise<ProjectResponse> {
    return this.db.$transaction(async (tx) => {
      const row = await tx.project.create({
        data: { ownerId, name: input.name, description: input.description },
      });
      await tx.appState.update({
        where: { id: 'app' },
        data: { projectRevision: { increment: 1 } },
      });
      return response(row);
    });
  }
  update(
    ownerId: string,
    id: string,
    input: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    return this.db.$transaction(async (tx) => {
      if (!(await tx.project.findFirst({ where: { id, ownerId } })))
        throw new NotFoundException();
      const result = await tx.project.updateMany({
        where: { id, ownerId, version: input.version },
        data: {
          name: input.name,
          description: input.description,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Project changed; reload before saving.');
      await tx.appState.update({
        where: { id: 'app' },
        data: { projectRevision: { increment: 1 } },
      });
      return response(await tx.project.findUniqueOrThrow({ where: { id } }));
    });
  }
  async remove(ownerId: string, id: string, version: number): Promise<void> {
    await this.db.$transaction(async (tx) => {
      if (!(await tx.project.findFirst({ where: { id, ownerId } })))
        throw new NotFoundException();
      if (
        (await tx.project.deleteMany({ where: { id, ownerId, version } }))
          .count !== 1
      )
        throw new ConflictException('Project changed; reload before deleting.');
      await tx.appState.update({
        where: { id: 'app' },
        data: { projectRevision: { increment: 1 } },
      });
    });
  }
}
'@
```

All users—including Admin—access only their own projects. Unknown and unowned IDs both return 404. Updates/deletes require an expected version; competing writers get 409. A committed database revision changes list-cache keys even if Redis is unavailable, avoiding stale reads caused by failed cache deletion. In-flight reads may see their earlier snapshot, as with normal concurrent database reads.

## Step 37: Cache authorized project responses

- **Goal**: I demonstrate response caching without letting a cache hit bypass ownership or ID validation.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/projects' -Force | Out-Null
Write-Source 'src/projects/project-cache.interceptor.ts' @'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { from, mergeMap, of, type Observable } from 'rxjs';
import type { Response } from 'express';
import { Database } from '../database/database.module.js';
import { CacheService } from '../cache/cache.module.js';
import { principal, type PrincipalRequest } from '../identity/access.js';
import { decodeProject } from './project.dto.js';
@Injectable()
export class ProjectCacheInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  constructor(
    private readonly db: Database,
    private readonly cache: CacheService,
  ) {}
  async intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const id = request.params.id;
    // Interceptors run before pipes; malformed IDs must reach the normal validation path.
    if (typeof id !== 'string' || !isUUID(id, '4')) return next.handle();
    const user = principal(request);
    const row = await this.db.project.findFirst({
      where: { id, ownerId: user.id },
      select: { version: true },
    });
    if (!row) throw new NotFoundException();
    const key = `response:project:${user.id}:${user.securityVersion}:${id}:${row.version}`;
    const cached = await this.cache.read(key, decodeProject);
    const reply = context.switchToHttp().getResponse<Response>();
    if (cached !== undefined) {
      reply.setHeader('X-Cache', 'HIT');
      return of(cached);
    }
    reply.setHeader('X-Cache', 'MISS');
    return next
      .handle()
      .pipe(
        mergeMap((value) =>
          from(this.cache.write(key, value).then(() => value)),
        ),
      );
  }
}
'@
```

This cache applies only to GET by ID. It still reads ownership/version metadata from SQL before returning a cached representation. JWT, session, role and permission guards have already run. This deliberately trades one small SQL check for safe caching; it is not a claim that every cache hit avoids the database.

## Step 38: Expose five project endpoints

- **Goal**: I keep each handler to binding, dispatch and response mapping.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/projects' -Force | Out-Null
Write-Source 'src/projects/projects.controller.ts' @'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../identity/access.js';
import type { Principal } from '../identity/contracts.js';
import { PageDto } from '../core/page.dto.js';
import {
  CreateProjectDto,
  ProjectResponse,
  UpdateProjectDto,
} from './project.dto.js';
import { ProjectsService } from './projects.service.js';
import { ProjectCacheInterceptor } from './project-cache.interceptor.js';
@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get()
  @Permissions('projects:read')
  @ApiOkResponse({ type: ProjectResponse, isArray: true })
  list(@CurrentUser() user: Principal, @Query() page: PageDto) {
    return this.projects.list(user.id, page);
  }
  @Get(':id')
  @Permissions('projects:read')
  @UseInterceptors(ProjectCacheInterceptor)
  @ApiOkResponse({ type: ProjectResponse })
  get(
    @CurrentUser() user: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.projects.get(user.id, id);
  }
  @Post()
  @Permissions('projects:write')
  @ApiCreatedResponse({ type: ProjectResponse })
  create(@CurrentUser() user: Principal, @Body() input: CreateProjectDto) {
    return this.projects.create(user.id, input);
  }
  @Put(':id')
  @Permissions('projects:write')
  @ApiOkResponse({ type: ProjectResponse })
  update(
    @CurrentUser() user: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, id, input);
  }
  @Delete(':id')
  @Permissions('projects:write')
  @HttpCode(204)
  @ApiQuery({ name: 'version', type: Number })
  remove(
    @CurrentUser() user: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('version', ParseIntPipe) version: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(version) || version < 1 || version > 2147483646)
      throw new BadRequestException('Invalid version.');
    return this.projects.remove(user.id, id, version);
  }
}
'@
```

## Step 39: Encapsulate project behavior

- **Goal**: I import shared infrastructure without making the project service global.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/projects' -Force | Out-Null
Write-Source 'src/projects/projects.module.ts' @'
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CacheModule } from '../cache/cache.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectCacheInterceptor } from './project-cache.interceptor.js';
@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectCacheInterceptor],
})
export class ProjectsModule {}
'@
```

## Step 40: Make initial enrollment transactional and idempotent

- **Goal**: I create the administrator and examples once without resetting later user changes.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/seeding' -Force | Out-Null
Write-Source 'src/seeding/seed.service.ts' @'
import { Injectable } from '@nestjs/common';
import { Database } from '../database/database.module.js';
import { Settings } from '../core/settings.js';
import { PasswordService } from '../identity/password.service.js';
import { PERMISSIONS } from '../identity/contracts.js';
@Injectable()
export class SeedService {
  constructor(
    private readonly db: Database,
    private readonly settings: Settings,
    private readonly passwords: PasswordService,
  ) {}
  async run(): Promise<void> {
    if (
      (await this.db.appState.findUniqueOrThrow({ where: { id: 'app' } }))
        .seeded
    )
      return;
    const password = this.settings.seedPassword;
    if (!this.settings.seedOnStart || !password)
      throw new Error('Initial enrollment is disabled.');
    const passwordHash = await this.passwords.hash(password);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AppState" WHERE "id"='app' FOR UPDATE`;
      if (
        (await tx.appState.findUniqueOrThrow({ where: { id: 'app' } })).seeded
      )
        return;
      // Fail instead of promoting an unexpected pre-existing account.
      if (
        await tx.user.findUnique({ where: { email: this.settings.seedEmail } })
      )
        throw new Error('Enrollment state is inconsistent.');
      const admin = await tx.role.create({
        data: {
          name: 'Admin',
          normalizedName: 'ADMIN',
          system: true,
          permissions: [...PERMISSIONS],
        },
      });
      await tx.role.create({
        data: {
          name: 'Member',
          normalizedName: 'MEMBER',
          system: true,
          permissions: [...PERMISSIONS],
        },
      });
      const user = await tx.user.create({
        data: {
          email: this.settings.seedEmail,
          displayName: 'Initial Administrator',
          passwordHash,
          roles: { create: { roleId: admin.id } },
        },
      });
      await tx.project.createMany({
        data: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            ownerId: user.id,
            name: 'Learn NestJS',
            description:
              'Trace one request from controller to service and database.',
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            ownerId: user.id,
            name: 'Practice project CRUD',
            description: 'Create, edit, and remove your own practice project.',
          },
        ],
      });
      await tx.appState.update({
        where: { id: 'app' },
        data: { seeded: true, projectRevision: { increment: 1 } },
      });
    });
  }
}
'@
```

The database row lock—not a Redis-only lock—makes redelivery and concurrent workers safe. All initial data and readiness commit together. A crash rolls back the transaction; a retry can run safely. Once seeded, future startup never restores the original admin password or overwrites sample projects.

## Step 41: Run initial enrollment through BullMQ after listening

- **Goal**: I separate queue scheduling from worker execution and keep secrets out of jobs.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/seeding' -Force | Out-Null
Write-Source 'src/seeding/seeding.module.ts' @'
import { Injectable, Module } from '@nestjs/common';
import {
  BullModule,
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { CoreModule } from '../core/core.module.js';
import { Settings } from '../core/settings.js';
import { Database, DatabaseModule } from '../database/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { SeedService } from './seed.service.js';
@Processor('bootstrap', { concurrency: 1 })
class SeedProcessor extends WorkerHost {
  constructor(
    private readonly seed: SeedService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }
  override async process(job: Job<unknown>): Promise<void> {
    if (job.name !== 'initial-data-v1')
      throw new Error('Unknown bootstrap job.');
    await this.seed.run();
    this.logger.info({ event: 'bootstrap_completed' }, 'Initial data is ready');
  }
  @OnWorkerEvent('failed') failed(): void {
    this.logger.error(
      { event: 'bootstrap_failed' },
      'Initial enrollment failed; inspect configuration and migration status',
    );
  }
}
@Injectable()
export class SeedScheduler {
  constructor(
    @InjectQueue('bootstrap') private readonly queue: Queue,
    private readonly db: Database,
    private readonly settings: Settings,
  ) {}
  async enqueue(): Promise<void> {
    if (
      !this.settings.seedOnStart ||
      (await this.db.appState.findUniqueOrThrow({ where: { id: 'app' } }))
        .seeded
    )
      return;
    // A unique queue ID allows recovery after a database restore or a prior failed job.
    // SQL idempotency makes multiple API instances scheduling this operation safe.
    await this.queue.add(
      'initial-data-v1',
      {},
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );
  }
}
@Module({
  imports: [
    CoreModule,
    DatabaseModule,
    IdentityModule,
    BullModule.forRootAsync({
      imports: [CoreModule],
      inject: [Settings],
      useFactory: (settings: Settings) => ({
        connection: { ...settings.redisConnection(), db: 0 },
        prefix: 'school:jobs',
      }),
    }),
    BullModule.registerQueue({ name: 'bootstrap' }),
  ],
  providers: [SeedService, SeedProcessor, SeedScheduler],
  exports: [SeedScheduler],
})
export class SeedingModule {}
'@
```

The worker is hosted in the same process to keep this lesson small. It still executes a durable BullMQ job after main starts listening. For heavier jobs, deploy a separate worker with the same service boundaries. The bounded retry is safe because the seed transaction is idempotent; permanent configuration failures remain failed jobs with readiness false. See [Nest BullMQ integration](https://docs.nestjs.com/techniques/queues).

## Step 42: Return safe errors and correlated logs

- **Goal**: I map expected failures without exposing database statements, credentials or stack traces.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/core' -Force | Out-Null
Write-Source 'src/core/error.filter.ts' @'
import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}
  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    let status = 503;
    let message: string | object = 'Service temporarily unavailable.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.getResponse();
    } else if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code)
    ) {
      status = 409;
      message = 'Resource conflict; reload or choose a different value.';
    }
    if (status >= 500)
      this.logger.error(
        { event: 'request_failed', requestId: request.id },
        'Request failed',
      );
    response
      .status(status)
      .json({ statusCode: status, error: message, requestId: request.id });
  }
}
'@
```

## Step 43: Separate liveness and readiness

- **Goal**: I report healthy process state independently from database, Redis and seed readiness.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src/core' -Force | Out-Null
Write-Source 'src/core/health.controller.ts' @'
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Database } from '../database/database.module.js';
import { CacheService } from '../cache/cache.module.js';
import { BootstrapExempt, Public } from '../identity/access.js';
@ApiTags('Health')
@Public()
@BootstrapExempt()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: Database,
    private readonly cache: CacheService,
  ) {}
  @Get('live') live() {
    return { status: 'alive' };
  }
  @Get('ready') async ready() {
    try {
      const state = await this.db.appState.findUnique({ where: { id: 'app' } });
      if (state?.seeded && (await this.cache.healthy()))
        return { status: 'ready' };
    } catch {
      /* Public probes expose no internal exception details. */
    }
    throw new ServiceUnavailableException('Not ready.');
  }
}
'@
```

## Step 44: Assemble modules and global security

- **Goal**: I apply security consistently instead of relying on each controller author to remember a guard.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src' -Force | Out-Null
Write-Source 'src/app.module.ts' @'
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { CoreModule } from './core/core.module.js';
import { DatabaseModule } from './database/database.module.js';
import { CacheModule } from './cache/cache.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { BootstrapGuard, JwtGuard, RolesGuard } from './identity/guards.js';
import { AuthContextInterceptor } from './identity/auth-context.interceptor.js';
import { ProjectsModule } from './projects/projects.module.js';
import { SeedingModule } from './seeding/seeding.module.js';
import { HealthController } from './core/health.controller.js';
@Module({
  imports: [
    CoreModule,
    DatabaseModule,
    CacheModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: () => randomUUID(),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        serializers: {
          req: (request: { id?: unknown; method?: unknown }) => ({
            id: request.id,
            method: request.method,
          }),
        },
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    IdentityModule,
    ProjectsModule,
    SeedingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: BootstrapGuard },
    { provide: APP_GUARD, useExisting: JwtGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_INTERCEPTOR, useExisting: AuthContextInterceptor },
  ],
})
export class AppModule {}
'@
```

[nestjs-pino](https://github.com/iamolegga/nestjs-pino) supplies request-context logging; the serializer omits URLs, headers and bodies that could carry credentials. The default throttler store is per-process: this guide runs one API instance. Before horizontal scaling, use a tested shared throttler store or trusted gateway limits. Proxy trust is disabled; configure exact trusted proxies only when deploying behind one.

## Step 45: Configure validation, Helmet and Swagger

- **Goal**: I establish HTTP safety and documentation before accepting requests.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src' -Force | Out-Null
Write-Source 'src/bootstrap.ts' @'
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { Settings } from './core/settings.js';
import { ErrorFilter } from './core/error.filter.js';
export async function createApplication() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
    bodyParser: false,
  });
  const settings = app.get(Settings);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', false);
  app.use(
    helmet({ contentSecurityPolicy: settings.swagger ? false : undefined }),
  );
  app.useBodyParser('json', { limit: '16kb' });
  app.useBodyParser('urlencoded', { limit: '16kb', extended: false });
  app.enableCors({
    origin: settings.origins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ErrorFilter(app.get(PinoLogger)));
  app.enableShutdownHooks();
  if (settings.swagger) {
    const config = new DocumentBuilder()
      .setTitle('NestJS CRUD School')
      .setVersion('1.0')
      .setDescription(
        'Register, sign in, copy accessToken into Authorize, and practice on your projects.',
      )
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, config),
      { swaggerOptions: { persistAuthorization: false } },
    );
  }
  return app;
}
'@
```

Swagger is available at /docs only when explicitly enabled outside production. Helmet CSP is relaxed only for that local documentation mode; production disables Swagger and restores Helmet defaults. CORS is a browser policy, never authentication. The API uses Authorization headers, not ambient authentication cookies, so this lesson does not need a cookie CSRF flow.

## Step 46: Listen before scheduling initial data

- **Goal**: I run the requested bootstrap job asynchronously after the server starts.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'src' -Force | Out-Null
Write-Source 'src/main.ts' @'
import { createApplication } from './bootstrap.js';
import { Settings } from './core/settings.js';
import { SeedScheduler } from './seeding/seeding.module.js';
async function main(): Promise<void> {
  const app = await createApplication();
  const settings = app.get(Settings);
  try {
    await app.listen(settings.port, settings.host);
    await app.get(SeedScheduler).enqueue();
  } catch {
    await app.close();
    throw new Error('Startup failed.');
  }
}
void main().catch(() => {
  console.error(
    'Startup failed. Check private configuration and dependency health.',
  );
  process.exitCode = 1;
});
'@
```

/api/health/live can succeed while /api/health/ready is still 503. Registration, login and project routes stay gated until the transaction commits. Do not race the seed by repeatedly registering the initial administrator.

## Step 47: Package the generated Prisma client

- **Goal**: I preserve relative imports in the compiled output.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/copy-client.mjs' @'
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/generated', { recursive: true });
cpSync('generated/prisma', 'dist/generated/prisma', {
  recursive: true,
  force: true,
});
'@
```

Stop running Node processes before replacing a Windows Prisma native engine. Container builds generate their own Linux client instead of copying a Windows binary.

## Step 48: Test authorization and password boundaries

- **Goal**: I test security decisions without depending on a running database.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'test' -Force | Out-Null
Write-Source 'test/security.test.ts' @'
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import {
  accessClaims,
  permits,
  type Principal,
} from '../src/identity/contracts.js';
import { PasswordService } from '../src/identity/password.service.js';
await test('claims reject malformed identities, versions and missing expiry', () => {
  const claims = {
    sub: randomUUID(),
    sid: randomUUID(),
    ver: 1,
    exp: 2000000000,
  };
  assert.equal(accessClaims(claims).sub, claims.sub);
  for (const invalid of [
    null,
    {},
    { ...claims, sub: 'bad' },
    { ...claims, ver: 0 },
    { ...claims, exp: undefined },
  ]) {
    assert.throws(() => accessClaims(invalid), UnauthorizedException);
  }
});
await test('role alternatives and all required permissions must both pass', () => {
  const member: Principal = {
    id: randomUUID(),
    sessionId: randomUUID(),
    securityVersion: 1,
    roles: ['Member'],
    permissions: ['projects:read'],
  };
  assert.equal(permits(member, [], ['projects:read']), true);
  assert.equal(permits(member, ['Member', 'Admin'], ['projects:read']), true);
  assert.equal(permits(member, ['Admin'], []), false);
  assert.equal(permits(member, [], ['projects:read', 'projects:write']), false);
});
await test('Argon2 hashes are salted and incorrect passwords fail', async () => {
  const passwords = new PasswordService();
  await passwords.onModuleInit();
  const first = await passwords.hash('a long test password');
  const second = await passwords.hash('a long test password');
  assert.notEqual(first, second);
  assert.match(first, /^\$argon2id\$/);
  assert.equal(await passwords.check('a long test password', first), true);
  assert.equal(await passwords.check('wrong password', first), false);
  assert.equal(await passwords.check('wrong password'), false);
});
'@
```

## Step 49: Exercise the real HTTP security and CRUD flows

- **Goal**: I verify observable behavior against the actual PostgreSQL and Redis backed application.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'test' -Force | Out-Null
Write-Source 'test/e2e.ts' @'
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://127.0.0.1:3200/api';
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown): string {
  assert.equal(typeof value, 'string');
  return String(value);
}
async function request(
  method: string,
  path: string,
  expected: number,
  token?: string,
  body?: unknown,
): Promise<{ body: unknown; headers: Headers }> {
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, got ${response.status}`,
  );
  return {
    body: response.status === 204 ? null : ((await response.json()) as unknown),
    headers: response.headers,
  };
}
async function login(email: string, password: string): Promise<Row> {
  return row(
    (await request('POST', '/auth/login', 200, undefined, { email, password }))
      .body,
  );
}
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const password = randomUUID() + '!aA';
const aliceEmail = `alice-${suffix}@example.test`;
const bobEmail = `bob-${suffix}@example.test`;
await request('GET', '/health/ready', 200);
await request('GET', '/projects', 401);
await request('POST', '/auth/register', 400, undefined, {
  email: aliceEmail,
  displayName: 'Alice',
  password,
  roles: ['Admin'],
});
const alice = row(
  (
    await request('POST', '/auth/register', 201, undefined, {
      email: aliceEmail,
      displayName: 'Alice',
      password,
    })
  ).body,
);
const bob = row(
  (
    await request('POST', '/auth/register', 201, undefined, {
      email: bobEmail,
      displayName: 'Bob',
      password,
    })
  ).body,
);
assert.equal(alice.passwordHash, undefined);
const admin = await login(
  string(process.env.SEED_ADMIN_EMAIL),
  string(process.env.SEED_ADMIN_PASSWORD),
);
const adminToken = string(admin.accessToken);
const aliceSession = await login(aliceEmail, password);
const aliceToken = string(aliceSession.accessToken);
const bobSession = await login(bobEmail, password);
const bobToken = string(bobSession.accessToken);
await request('GET', '/identity/users', 403, aliceToken);
await request('POST', '/identity/users', 201, adminToken, {
  email: `created-${suffix}@example.test`,
  displayName: 'Created member',
  password,
});
await request('GET', '/projects', 200, aliceToken);
const project = row(
  (
    await request('POST', '/projects', 201, aliceToken, {
      name: 'First project',
      description: 'Acceptance test',
    })
  ).body,
);
const projectId = string(project.id);
const listing = (await request('GET', '/projects', 200, aliceToken)).body;
assert.ok(
  Array.isArray(listing) &&
    listing.some((item: unknown) => row(item).id === projectId),
);
await request('GET', `/projects/${projectId}`, 200, aliceToken);
assert.equal(
  (await request('GET', `/projects/${projectId}`, 200, aliceToken)).headers.get(
    'x-cache',
  ),
  'HIT',
);
await request('GET', `/projects/${projectId}`, 404, bobToken);
await request('PUT', `/projects/${projectId}`, 404, bobToken, {
  name: 'Intrusion',
  description: '',
  version: 1,
});
const updates = await Promise.all(
  ['Second', 'Third'].map((name) =>
    fetch(`${base}/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description: '', version: 1 }),
      signal: AbortSignal.timeout(10000),
    }),
  ),
);
assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
assert.equal(
  row((await request('GET', `/projects/${projectId}`, 200, aliceToken)).body)
    .version,
  2,
);
await request('DELETE', `/projects/${projectId}?version=1`, 409, aliceToken);
await request('DELETE', `/projects/${projectId}?version=2`, 204, aliceToken);
await request('GET', `/projects/${projectId}`, 404, aliceToken);
const roles = (await request('GET', '/identity/roles', 200, adminToken)).body;
assert.ok(Array.isArray(roles));
const member = roles
  .map((value: unknown) => row(value))
  .find((value) => value.name === 'Member');
assert.ok(member);
const reader = row(
  (
    await request('POST', '/identity/roles', 201, adminToken, {
      name: `Reader${suffix}`,
      permissions: ['projects:read'],
    })
  ).body,
);
await request(
  'PUT',
  `/identity/users/${string(alice.id)}/roles`,
  204,
  adminToken,
  { roleIds: [reader.id] },
);
await request('GET', '/auth/me', 401, aliceToken);
const readerSession = await login(aliceEmail, password);
await request('POST', '/projects', 403, string(readerSession.accessToken), {
  name: 'Denied',
});
await request(
  'DELETE',
  `/identity/roles/${string(reader.id)}`,
  409,
  adminToken,
);
await request(
  'PUT',
  `/identity/users/${string(alice.id)}/roles`,
  204,
  adminToken,
  { roleIds: [member.id] },
);
await request('PUT', `/identity/roles/${string(reader.id)}`, 200, adminToken, {
  name: `Read${suffix}`,
  permissions: ['projects:read'],
});
await request(
  'DELETE',
  `/identity/roles/${string(reader.id)}`,
  204,
  adminToken,
);
const me = row((await request('GET', '/auth/me', 200, adminToken)).body);
await request(
  'PATCH',
  `/identity/users/${string(me.id)}/active`,
  409,
  adminToken,
  { active: false },
);
const finalAlice = await login(aliceEmail, password);
const rotated = row(
  (
    await request('POST', '/auth/refresh', 200, undefined, {
      refreshToken: finalAlice.refreshToken,
    })
  ).body,
);
await request('POST', '/auth/refresh', 401, undefined, {
  refreshToken: finalAlice.refreshToken,
});
await request('GET', '/auth/me', 401, string(rotated.accessToken));
await request('POST', '/auth/logout', 204, bobToken);
await request('GET', '/auth/me', 401, bobToken);
await request(
  'PATCH',
  `/identity/users/${string(alice.id)}/active`,
  204,
  adminToken,
  { active: false },
);
await request(
  'PATCH',
  `/identity/users/${string(bob.id)}/active`,
  204,
  adminToken,
  { active: false },
);
console.log(
  'HTTP acceptance checks passed. Test users remain for audit; Alice and Bob are disabled.',
);
'@
```

Run only against this disposable lesson instance, with no other administrator accounts and no parallel manual login traffic. The test makes exactly five login requests. Repeated runs inside one minute can receive 429; let the configured rate-limit window expire. Failures are not retried or hidden.

## Step 50: Wait for asynchronous bootstrap readiness

- **Goal**: I give the seed worker a bounded readiness check before sending requests.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/wait-ready.mjs' @'
const deadline = Date.now() + 120000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://127.0.0.1:3200/api/health/ready', {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Connection is unavailable while the process starts. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready)
  throw new Error(
    'Application did not become ready within 120 seconds. Inspect the API and worker logs.',
  );
console.log('Application and initial data are ready.');
'@
```

## Step 51: Define the debugger build task

- **Goal**: I compile TypeScript and copy the generated Prisma runtime before debugging.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path '.vscode' -Force | Out-Null
Write-Source '.vscode/tasks.json' @'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build backend",
      "type": "npm",
      "script": "build",
      "problemMatcher": "$tsc",
      "group": "build"
    }
  ]
}
'@
```

## Step 52: Configure launch and attach debugging

- **Goal**: I keep debugger ports local and load development secrets from the ignored environment file.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path '.vscode' -Force | Out-Null
Write-Source '.vscode/launch.json' @'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/src/main.js",
      "cwd": "${workspaceFolder}",
      "envFile": "${workspaceFolder}/.env",
      "preLaunchTask": "build backend",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Attach to local NestJS",
      "type": "node",
      "request": "attach",
      "address": "127.0.0.1",
      "port": 9230,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
'@
```

Launch requires the database migrations and role grants already completed. Put a breakpoint in ProjectsService.create, press F5, and submit a project through Swagger. Stop any other API process before Launch. Attach connects to the debug CMD runner shown below.

## Step 53: Exclude local secrets from Docker build context

- **Goal**: I keep credentials, dependencies and host-native Prisma binaries out of image layers.
- **Command / Action**:

```powershell
Write-Source '.dockerignore' @'
.git
.env
.env.*
.local
node_modules
dist
generated
coverage
*.log
'@
```

## Step 54: Build a non-root API image

- **Goal**: I generate Prisma for the Linux image and ship only production dependencies and compiled code.
- **Command / Action**:

```powershell
Write-Source 'Dockerfile' @'
FROM node:24.21.0-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run generate && npm run build
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3200
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 CMD node -e "fetch('http://127.0.0.1:3200/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
'@
```

The Compose lesson overrides NODE_ENV to development through its environment file so local non-TLS containers work. For production use TLS, an approved secret store, controlled migrations, SEED_ON_START=false after explicit provisioning, and SWAGGER_ENABLED=false. This is a teaching deployment, not evidence of production readiness.

## Step 55: Add application and one-shot migration containers

- **Goal**: I separate DDL credentials from the ordinary API runtime.
- **Command / Action**:

```powershell
Write-Source 'compose.app.yaml' @'
services:
  migrate:
    profiles: ["tools"]
    build:
      context: .
      target: build
    env_file: .env.admin.docker
    command: ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
    depends_on:
      postgres:
        condition: service_healthy
  api:
    build:
      context: .
      target: runtime
    env_file: .env.docker
    ports:
      - "127.0.0.1:3200:3200"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: ["ALL"]
    security_opt: ["no-new-privileges:true"]
    init: true
    stop_grace_period: 30s
'@
```

## Step 56: Create the Windows CMD development runner

- **Goal**: I make the full local startup sequence repeatable without PowerShell-only syntax.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/run-local.cmd' @'
@echo off
setlocal
cd /d "%~dp0.."
node scripts\configure.mjs
if errorlevel 1 exit /b 1
call npm ci
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose up -d --wait --wait-timeout 120 postgres redis
if errorlevel 1 exit /b 1
call npm run generate
if errorlevel 1 exit /b 1
call npm run migrate
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose exec -T postgres psql -U postgres -d crud_school -v ON_ERROR_STOP=1 < scripts\grants.sql
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
if /i "%~1"=="debug" (
  call npm run start:debug
) else (
  call npm run start:dev
)
exit /b %errorlevel%
'@
```

In CMD run `scriptsun-local.cmd` or `scriptsun-local.cmd debug`. It requires the package-lock.json generated earlier by npm install. The API stays in the foreground. The watch process watches compiled JavaScript: run `npm run build:watch` in another terminal while editing TypeScript.

## Step 57: Create the Windows CMD Docker runner

- **Goal**: I run migrations once before starting the restricted application container.
- **Command / Action**:

```powershell
New-Item -ItemType Directory -Path 'scripts' -Force | Out-Null
Write-Source 'scripts/run-docker.cmd' @'
@echo off
setlocal
cd /d "%~dp0.."
node scripts\configure.mjs
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose up -d --wait --wait-timeout 120 postgres redis
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose -f compose.yaml -f compose.app.yaml build api migrate
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose -f compose.yaml -f compose.app.yaml run --rm migrate
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose exec -T postgres psql -U postgres -d crud_school -v ON_ERROR_STOP=1 < scripts\grants.sql
if errorlevel 1 exit /b 1
docker compose --env-file .env.compose -f compose.yaml -f compose.app.yaml up -d --wait --wait-timeout 120 api
if errorlevel 1 exit /b 1
node scripts\wait-ready.mjs
exit /b %errorlevel%
'@
```

## Step 58: Format, compile and run focused security tests

- **Goal**: I verify the finished program before launching it.
- **Command / Action**:

```powershell
Invoke-Checked npm.cmd @('run', 'format')
Invoke-Checked npm.cmd @('run', 'format:check')
Invoke-Checked npm.cmd @('run', 'typecheck')
Invoke-Checked npm.cmd @('run', 'lint')
Invoke-Checked npm.cmd @('run', 'build')
Invoke-Checked npm.cmd @('test')
Invoke-Checked docker @('compose', '--env-file', '.env.compose', '-f', 'compose.yaml', '-f', 'compose.app.yaml', 'config', '--quiet')
```

Commit package-lock.json and use npm ci thereafter. Investigate dependency advisories with npm audit before deployment; do not blindly run npm audit fix --force.

## Step 59: Start the local application

- **Goal**: I let BullMQ provision the initial administrator and sample projects after HTTP startup.
- **Command / Action**:

```powershell
Invoke-Checked cmd.exe @('/d', '/c', 'scripts\run-local.cmd')
```

This command remains in the foreground; stop it with Ctrl+C. In a second terminal, from the application directory, continue with the next step. Credentials are generated in the ignored .env file: inspect it locally in your editor, never commit or paste it into logs. Seeding runs once per database marker and does not reset an existing administrator password.

## Step 60: Verify readiness and the complete user journey

- **Goal**: I test real authentication, authorization, caching, concurrency and session revocation.
- **Command / Action**:

```powershell
node scripts/wait-ready.mjs
if ($LASTEXITCODE -ne 0) { throw 'Application readiness failed.' }
npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { throw 'HTTP acceptance checks failed.' }
Start-Process 'http://localhost:3200/docs'
```

Swagger: sign in with the seeded credentials, copy only the accessToken into Authorize, then exercise projects. Refresh tokens are secrets; do not store them in logs or browser localStorage in a real client. This lesson accepts tokens in request bodies and Authorization headers, not cookies. A browser client using HttpOnly cookies also needs CSRF protections and a deliberate cookie policy. Each client must serialize refresh requests: replay revokes the entire session, including concurrently rotated tokens.

## Step 61: Run the same application entirely in Docker

- **Goal**: I verify the alternative execution path after stopping the local API.
- **Command / Action**:

```powershell
cmd.exe /d /c scripts\run-docker.cmd
if ($LASTEXITCODE -ne 0) { throw 'Docker application startup failed.' }
npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { throw 'Docker HTTP acceptance checks failed.' }
docker compose --env-file .env.compose -f compose.yaml -f compose.app.yaml logs --tail 100 api
if ($LASTEXITCODE -ne 0) { throw 'Log inspection failed.' }
```

Do not run local and container APIs together on port 3200. They deliberately share the lesson database. The acceptance suite uses unique accounts on each run; the default administrator and original sample projects are not replaced.

## Step 62: Stop the lesson without deleting data

- **Goal**: I preserve PostgreSQL and Redis volumes for the next learning session.
- **Command / Action**:

```powershell
docker compose --env-file .env.compose -f compose.yaml -f compose.app.yaml down
if ($LASTEXITCODE -ne 0) { throw 'Container shutdown failed.' }
git status --short
```

Do not add --volumes unless intentionally discarding this lesson database. Common failures: 503 before seed completion means inspect worker logs and dependency health; 401 after role/password changes is expected session invalidation; 409 on stale project versions means reload before retrying; 429 means a rate limit was reached. Pino logs deliberately exclude request/response bodies and credentials. The built-in throttler is process-local, so this lesson uses one API replica. Scaling requires a shared throttler store, a separate worker deployment, measured resource limits and integration/operations evidence. Expired sessions are pruned on subsequent user sign-in; a production retention job is an explicit follow-up, not hidden startup maintenance.

Author verification: the extracted source was compiled and linted, Prisma schema/client generation was checked, and all three focused security tests passed on Node 24.21.0. PowerShell blocks were syntax-checked and Compose configuration validated. Live database migrations, HTTP acceptance tests and Docker image startup were not executed during documentation authoring; run the supplied commands to establish those results in your environment. The older installed Node 22.12.0 crashed loading the Argon2 native module; use the specified Node 24 runtime.
