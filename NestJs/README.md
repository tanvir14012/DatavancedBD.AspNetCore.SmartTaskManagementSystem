# NestJS backend migration

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

Liveness: `/alive`. Readiness and `/health` deliberately return 503 until the cutover
dependencies are wired and verified. No default database, development credentials,
automatic migrations or permissive CORS are configured.

Set `ALLOWED_ORIGINS` to a comma-separated list of exact trusted browser origins.
Fastify rejects other browser origins and accepts credentialed preflight requests only
for listed origins. `trustProxy` remains disabled, so deployments must preserve a
trusted Host header and must not depend on unvalidated forwarded headers.

See [parity tracking](docs/parity.md) and [architecture decision](../docs/adr/0001-nestjs-parallel-backend.md).

The description assistant defaults to the local clarity pass. An optional Groq call
requires `AI_ENABLED=true`, `GROQ_API_KEY` from a secret provider, and `GROQ_MODEL`;
`GROQ_ENDPOINT` may point only to `https://api.groq.com`. Provider failures fall back
to local processing after a five-second deadline. Never place the API key in source or
the browser bundle.

Prisma is pinned to 6.19.3. Its `deepmerge-ts` tooling dependency is overridden to
8.0.0 for GHSA-ggr8-5vv4-36mx; schema validation and client generation must pass before
changing that override. Prisma 7.10 additionally pulled an affected MySQL driver
into this SQL Server-only project's tooling. Reevaluate on the next stable upgrade.
