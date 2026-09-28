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
| 4 | Identity password compatibility, register/login/refresh/logout, cookies and CSRF | Login/refresh/logout and password hash compatibility implemented; public register intentionally closed pending invite/provisioning policy; SQL/HTTP acceptance pending |
| 5 | Projects CRUD, members, assignments, pagination and permissions | Routes implemented; SQL-backed and contract acceptance pending |
| 6 | Tasks CRUD, assignment, board, filters and permissions | Routes implemented; SQL-backed and HTTP contract acceptance pending |
| 7 | Users CRUD, dashboard, menus, AI description improvement | User list/get/update, account deactivation, dashboard, and menus routes implemented; creation and AI improvement pending; SQL-backed and HTTP contract acceptance pending |
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
The generated clients are copied into the build output and omitted from Git. No SQL Server
instance was available for mapping, transaction, RLS, or migration acceptance.
