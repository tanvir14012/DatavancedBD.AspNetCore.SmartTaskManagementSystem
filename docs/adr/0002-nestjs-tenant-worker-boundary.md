# Reauthorize tenant work at execution

Status: accepted for the worker boundary; durable adapters and deployment pending.

## Context

Jobs may wait while a membership is revoked, a tenant is suspended, or placement
moves to another storage target. The queued tenant selector and placement snapshot
cannot authorize execution. The .NET Worker has queue, deduplication, admission,
and handler ports, but no registered business handler.

## Decision and alternatives

The NestJS worker core requires explicit queue, tenant-scoped deduplication,
admission, catalog authorizer, and handler adapters. It rechecks membership and
placement immediately before invoking the handler, acknowledges stale or revoked
jobs without writing, and fences target, isolation, and revision. Handlers receive
one immutable context and must use the tenant storage service, which reauthorizes
before storage access. An API request scope or cached placement is not reused.
Running queued work directly from the API was rejected because it bypasses the
separate worker boundary and reliable acknowledgement contract.

## Consequences

The core can be tested without SQL, but no worker process starts until a durable
queue, deduplication store, admission adapter, and concrete handler are supplied.
Retries for transient handler errors remain the queue adapter's responsibility.
Idempotency keys include the tenant ID. This does not establish durable delivery
or cross-process admission by itself.

## Migration

Configure and test durable adapters against isolated resources, register one
handler for each supported job, then run two-tenant and stale-placement acceptance
tests before enabling the NestJS worker. Keep .NET job consumers active until
payload compatibility and handoff are verified.

## Rollback

Stop the NestJS worker and return unacknowledged jobs to the existing consumer.
Preserve the queue and idempotency records until replay and tenant recovery are
verified; do not discard outstanding work.
