# Containers

The repository supplies reproducible multi-stage images in `Dockerfile.api`, `Dockerfile.admin`,
`Dockerfile.worker`, and `Frontend/Angular/Dockerfile`. `docker-compose.saas.yml` runs the API,
Angular shell, SQL Server and Redis with persistent volumes and health-gated startup.

Admin migrations remain a separately invoked release operation; the API image does not run migrations,
provisioning, target enumeration or seeding during startup. Production builds should replace the local
Compose connection values with secret references and promote the same image digest through environments.
