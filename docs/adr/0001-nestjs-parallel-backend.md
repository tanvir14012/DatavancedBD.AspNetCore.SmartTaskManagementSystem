# Parallel NestJS backend with a fail-closed cutover

Status: accepted for incremental implementation; production cutover pending validation.

## Context

The requested NestJS/Fastify/Prisma implementation must preserve the .NET business
contracts, SQL Server persistence, and tenant boundaries. The repository includes
Database, Schema and Row isolation, Identity password hashes, and separate API,
Admin and Worker responsibilities. Shared .NET tenant wiring has documented gaps.

## Decision and alternatives

Build a separate top-level `NestJs` implementation with strict TypeScript. Keep
HTTP composition, application authorization/ports, framework-free domain rules,
and Prisma infrastructure separate. Use the Fastify adapter rather than Express.
Keep SQL Server; switching database products would add unrelated migration risk.
Reject a generic CRUD scaffold or wholesale replacement of the .NET hosts: neither
establishes behavioral or operational parity. Unsupported paths fail closed.

## Consequences

Each chunk has a local commit and explicit parity evidence. Prisma mapping must
retain tenant-prefixed keys and foreign keys. Row isolation requires SQL Server RLS
and session binding on the same transaction connection. Configuration resolves
logical storage targets; client input never chooses credentials or database names.
Runtime identities cannot provision or migrate. No production readiness claim is
made from schema generation, unit tests or a fresh-database test alone.

## Migration

Keep current ingress on .NET. Validate mappings against disposable copies of every
affected SQL Server model, including Identity and computed columns. Run differential
HTTP tests and two-tenant adversarial tests before routing a pilot tenant. Rehearse
upgrade, backup/restore, stale placement fencing, and credential rotation before
broader rollout. Do not run Prisma schema push against existing tenant databases.

## Rollback

Until cutover, remove the new host from deployment without altering data. Before
cutover, retain backward-compatible schemas and verify .NET can read all writes from
the new implementation. Roll back ingress per tenant after fencing in-flight work;
restore data only through a tested recovery plan if schema compatibility is lost.
