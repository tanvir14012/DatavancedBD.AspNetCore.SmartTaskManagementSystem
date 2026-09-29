# Backend parity and verification ledger

Source of truth: `Api/Endpoints`, `Application/Features`, `Domain`,
`Infrastructure/Services`, `Infrastructure/Tenancy`, `Admin`, and `Worker`.
An endpoint name alone does not establish parity: inputs, validation, response shape,
status, authorization, transactional changes and invalidation all require evidence.

| Chunk | Scope | Status |
| --- | --- | --- |
| 1 | NestJS/Fastify host, strict tooling, liveness, locked dependencies | Implemented; readiness checks explicit cutover setting, required configuration, and catalog connectivity; live success path pending SQL acceptance |
| 2 | Tenant resolution, immutable context, authoritative authorization | Implemented; unit and live HTTP tests cover colliding user IDs, conflicting selectors, stale membership and unauthorized tokens |
| 3 | Prisma catalog and tenant model, three storage strategies, RLS transactions | Clients generated; runtime routing and RLS transaction implemented; live SQL Server mapping, database/schema collision and row-RLS acceptance passes |
| 4 | Identity password compatibility, register/login/refresh/logout, cookies and CSRF | Login/refresh/logout and password hash compatibility implemented; HTTP acceptance exercises token rotation, replay rejection, logout and membership revocation; the expanded SQL rerun is pending environment approval; public register intentionally closed pending invite/provisioning policy |
| 5 | Projects CRUD, members, assignments, pagination and permissions | Routes, status filters, sorting and bounded pagination implemented; SQL-backed and contract acceptance pending |
| 6 | Tasks CRUD, assignment, board, filters and permissions | Routes and role-specific list scope implemented; colliding-ID two-tenant query-scope test passes; SQL-backed and HTTP contract acceptance pending |
| 7 | Users CRUD, dashboard, menus, AI description improvement | User list/get/update, account deactivation, dashboard, menus, optional Groq description provider and local fallback implemented; user creation pending; SQL-backed, provider, and HTTP contract acceptance pending |
| 8 | Tenant caches/invalidation, admission, reauthorized background jobs | Worker authorization/fencing boundary and two-tenant test implemented; durable queue, deduplication, Redis cache adapters and invalidation remain deployment work |
| 9 | Admin provisioning/migration, release fencing, deployment and recovery | Provisioning and migration remain Admin-owned by design; NestJS multi-stage non-root image and deployment boundary are documented, while target-environment probe, secret, migration and recovery validation remain pending |
| 10 | SQL Server/Redis and HTTP parity acceptance across all strategies | SQL Server disposable acceptance passes for catalog mapping, database/schema collision isolation, row RLS, login, protected reads and cross-tenant denial; expanded refresh/logout SQL rerun and Redis/full endpoint differential coverage pending |

The .NET shared API's incomplete tenant wiring is documented in `docs/Multitenancy.md`.
Do not reproduce default-database fallback, insecure default keys, or missing resource
authorization as compatibility features. Security-related behavior changes need explicit
documentation and tests. Nine tenants remain deployment data, never an application limit.

Chunk 2 evidence: concurrent two-tenant scope isolation with the same subject ID;
missing/malformed/conflicting selectors; exact host allowlists; wrong issuer; revoked
membership; nonactive lifecycle; region mismatch; stale placement; cancellation.
These are application tests, not proof of SQL persistence isolation or JWT verification.

The legacy public register endpoint lets a caller request an application role. This
port rejects registration until an invitation or privileged provisioning flow can
establish catalog membership and restrict roles. This is an intentional security
contract change; clients must use the Admin enrollment process once implemented.

User creation is also closed until privileged catalog enrollment exists. User deletion
deactivates the account and revokes refresh tokens instead of hard-deleting a referenced
identity. This intentionally changes the legacy delete implementation to preserve audit
history and prevent dependent foreign-key failures. Access tokens are checked against
current tenant roles and account lockout on every protected request.

Chunk 3 evidence: both Prisma schemas pass `prisma validate` and clients generate.
The generated clients are copied into the build output and omitted from Git. A disposable
SQL Server 2022 instance was used for catalog mapping and all three storage strategies.
The acceptance suite uses a test-only container and databases and leaves the repository's
existing local SaaS volumes untouched. The row-RLS suite intentionally logs SQL Server's
expected block-predicate error while asserting the cross-tenant write is rejected.

The existing catalog baseline's BIN2 `TargetId` check rejects hyphens even though the
application's logical-handle validator permits them. Acceptance therefore uses an
alphanumeric target ID. Aligning that deployed constraint requires an Admin migration
with expand/contract and rollback planning; it is not silently changed by this port.

The catalog membership table also has a collation boundary that rejects some Prisma
parameterized writes under the existing SQL baseline. Acceptance seeds that system-owned
fixture with parameterized SQL and verifies runtime membership through Prisma reads. The
Admin writer must retain ownership of this collation-sensitive boundary until its migration
is planned and tested.
