# NestJS backend migration

For the detailed architecture and onboarding tutorial, start with [READ.md](READ.md).

Parallel implementation of the .NET backend using NestJS, the Fastify HTTP adapter,
Prisma and SQL Server. The existing .NET hosts remain the active implementation until
contract and SQL Server isolation acceptance gates pass. This directory is an incremental
migration, not yet a drop-in replacement.

Use Node 24 LTS or later:

```powershell
cd NestJs
npm ci
npm run lint
npm test
npm run format:check
npm start
```

For a disposable local SQL Server, seeded account, NestJS API, and React client in one
PowerShell run, use `./localDeployment.ps1`. It keeps a named SQL volume and does not delete
existing containers or data:

```powershell
cd NestJs
./localDeployment.ps1
```

The script prints the local login and writes its private state under `.local/`. The seeded
account uses `accept0@example.test`; its password is retained in ignored local state. To
choose a known password for a local test run, pass it explicitly, for example
`./localDeployment.ps1 -TestPassword '<choose-a-local-password>'`. The script runs the existing Admin
`local-init` path for the database, schema, and row targets before starting the API and React
development server. The React dev server proxies `/services` to the API and forwards the
registered local tenant authority, so browser login does not depend on cross-origin HTTP.

The proposed `Dockerfile` uses non-root UID 10001, but its Prisma generation and runtime
dependency packaging still need verification; see the production gaps in [READ.md](READ.md).
Migrations and tenant provisioning remain owned by Admin.

Liveness: `/alive`. Readiness and `/health` return 503 until `NESTJS_CUTOVER_ENABLED=true`,
required authentication and storage settings are present, and the catalog responds to a
database probe. Tenant target health and SQL isolation still require separate acceptance
checks before cutover. No default database, development credentials,
automatic migrations or permissive CORS are configured.

Set `ALLOWED_ORIGINS` to a comma-separated list of exact trusted browser origins.
Fastify rejects other browser origins and accepts credentialed preflight requests only
for listed origins. `trustProxy` remains disabled, so deployments must preserve a
trusted Host header and must not depend on unvalidated forwarded headers.

See [parity tracking](docs/parity.md) and [architecture decision](../docs/adr/0001-nestjs-parallel-backend.md).

The SQL acceptance command is intentionally separate from the unit suite. It requires the
test-only `SAAS_TEST_*` SQL Server URLs and runs only against disposable databases; it does
not provision or migrate deployed databases:

```powershell
npm run test:sql
```

The current acceptance evidence covers all three storage strategies, colliding tenant and
user IDs, row-level security, login, refresh-token rotation, logout, membership revocation,
and cross-tenant request denial. The existing catalog baseline has a hyphen/collation
constraint mismatch documented in the parity ledger and remains an Admin migration task.

The description assistant defaults to the local clarity pass. An optional Groq call
requires `AI_ENABLED=true`, `GROQ_API_KEY` from a secret provider, and `GROQ_MODEL`;
`GROQ_ENDPOINT` may point only to `https://api.groq.com`. Provider failures fall back
to local processing after a five-second deadline. Never place the API key in source or
the browser bundle.

Prisma is pinned to 6.19.3. Its `deepmerge-ts` tooling dependency is overridden to
8.0.0 for GHSA-ggr8-5vv4-36mx; schema validation and client generation must pass before
changing that override. Prisma 7.10 additionally pulled an affected MySQL driver
into this SQL Server-only project's tooling. Reevaluate on the next stable upgrade.
