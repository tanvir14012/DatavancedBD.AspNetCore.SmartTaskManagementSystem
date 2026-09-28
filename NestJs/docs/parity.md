# Backend parity and verification ledger

Source of truth: `Api/Endpoints`, `Application/Features`, `Domain`,
`Infrastructure/Services`, `Infrastructure/Tenancy`, `Admin`, and `Worker`.
An endpoint name alone does not establish parity: inputs, validation, response shape,
status, authorization, transactional changes and invalidation all require evidence.

| Chunk | Scope | Status |
| --- | --- | --- |
| 1 | NestJS/Fastify host, strict tooling, liveness, locked dependencies | Implemented; verification recorded in commits |
| 2 | Tenant resolution, immutable context, authoritative authorization | Implemented application boundary; unit tests pass; HTTP authentication wiring pending |
| 3 | Prisma catalog and tenant model, three storage strategies, RLS transactions | Clients generated; runtime routing and RLS transaction implemented; live SQL Server acceptance pending |
| 4 | Identity password compatibility, register/login/refresh/logout, cookies and CSRF | Pending |
| 5 | Projects CRUD, members, assignments, pagination and permissions | CRUD routes implemented; members/assignments and SQL-backed acceptance pending |
| 6 | Tasks CRUD, assignment, board, filters and permissions | Pending |
| 7 | Users CRUD, dashboard, menus, AI description improvement | Pending |
| 8 | Tenant caches/invalidation, admission, reauthorized background jobs | Pending |
| 9 | Admin provisioning/migration, release fencing, deployment and recovery | Pending |
| 10 | SQL Server/Redis and HTTP parity acceptance across all strategies | Pending |

The .NET shared API's incomplete tenant wiring is documented in `docs/Multitenancy.md`.
Do not reproduce default-database fallback, insecure default keys, or missing resource
authorization as compatibility features. Security-related behavior changes need explicit
documentation and tests. Nine tenants remain deployment data, never an application limit.

Chunk 2 evidence: concurrent two-tenant scope isolation with the same subject ID;
missing/malformed/conflicting selectors; exact host allowlists; wrong issuer; revoked
membership; nonactive lifecycle; region mismatch; stale placement; cancellation.
These are application tests, not proof of SQL persistence isolation or JWT verification.

Chunk 3 evidence: both Prisma schemas pass `prisma validate` and clients generate.
The generated clients are copied into the build output and omitted from Git. No SQL Server
instance was available for mapping, transaction, RLS, or migration acceptance.
