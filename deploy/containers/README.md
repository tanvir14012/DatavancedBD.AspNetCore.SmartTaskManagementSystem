# Containers

The repository supplies reproducible multi-stage images in `Dockerfile.api`, `Dockerfile.admin`,
`Dockerfile.worker`, and `Frontend/Angular/Dockerfile`. `docker-compose.saas.yml` runs the API,
Angular shell, SQL Server and Redis with persistent volumes and health-gated startup.

For local tenancy acceptance, run `deploy/local/Start-LocalSaas.ps1`. It generates a private Compose
file with three SQL Server instances, nine tenant-aware APIs, nine Angular/Nginx frontends, nine
one-shot Admin initializers, and Loki/Alloy/Tempo/Prometheus/Grafana. The long-running company
services use loopback ports 8101–8305 (Angular) and 9101–9305 (API); see `deploy/local/README.md`
for the complete map. The composition represents one dedicated database company, three
schema-isolated companies, and five companies sharing row tables with `TenantId` and SQL row-level
security. Run `deploy/local/Test-LocalSaas.ps1` after startup to verify health, browser delivery,
tenant login, CRUD, cross-company token rejection, schema boundaries, RLS, and telemetry services.

Admin migrations remain a separately invoked release operation; the API image does not run migrations,
provisioning, target enumeration or seeding during startup. Production builds should replace the local
Compose connection values with secret references and promote the same image digest through environments.
