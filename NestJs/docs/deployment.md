# NestJS deployment boundary

The NestJS image is built from `NestJs/Dockerfile` with Node 24.19.0. The runtime stage
contains only production dependencies and compiled output and runs as UID/GID 10001 without
an interactive shell. The image does not run Prisma migrations or provision tenants.

The API requires the catalog and tenant storage targets to be supplied by deployment
configuration. Secrets such as SQL credentials, `JWT_KEY`, and optional AI credentials must
come from the platform secret provider. They must not be placed in the image or browser
configuration. `NESTJS_CUTOVER_ENABLED` remains an explicit rollout gate.

Tenant provisioning, catalog changes, and physical database/schema migrations remain
Admin-owned. The API may read placement and membership state, but it cannot create targets,
change schemas, or activate an incomplete tenant. Worker delivery must use a durable queue
adapter before production cutover; the current NestJS worker boundary deliberately requires
explicit queue, deduplication, admission, and handler adapters.

Before deployment, validate the image, probes, secret references, and the existing Admin
migration/backup workflow in the target environment. A successful image build does not prove
SQL isolation, migration safety, or recovery readiness.
