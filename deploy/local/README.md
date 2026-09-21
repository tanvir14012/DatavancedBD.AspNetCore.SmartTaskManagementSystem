# Local SaaS acceptance environment

Run in PowerShell 7 with Docker Desktop using Linux containers:

```powershell
./deploy/local/Start-LocalSaas.ps1
# Re-test an existing deployment:
./deploy/local/Test-LocalSaas.ps1
# Stop without deleting company data:
docker compose -f deploy/local/generated/compose.json stop
```

The script builds the actual .NET API and Angular application, initializes new local tenant
databases through the Admin image, starts every company together with Loki, Alloy, Tempo,
Prometheus, and Grafana, and runs acceptance checks.
Allow memory for three SQL Server instances (2 GB configured per server) plus nine APIs.
The first run downloads SQL Server, .NET, Node and Nginx images.

| Company | Storage | Angular | API |
| --- | --- | --- | --- |
| Titan Technologies (fictional tech giant) | Dedicated SQL instance / StmsLocaldedicated | http://localhost:8101 | http://localhost:9101 |
| Atlas Systems | StmsLocalschema / atlas | http://localhost:8201 | http://localhost:9201 |
| Beacon Labs | StmsLocalschema / beacon | http://localhost:8202 | http://localhost:9202 |
| Cedar Software | StmsLocalschema / cedar | http://localhost:8203 | http://localhost:9203 |
| Delta Studio | StmsLocalrow / dbo | http://localhost:8301 | http://localhost:9301 |
| Ember Design | StmsLocalrow / dbo | http://localhost:8302 | http://localhost:9302 |
| Fern Consulting | StmsLocalrow / dbo | http://localhost:8303 | http://localhost:9303 |
| Grove Retail | StmsLocalrow / dbo | http://localhost:8304 | http://localhost:9304 |
| Harbor Media | StmsLocalrow / dbo | http://localhost:8305 | http://localhost:9305 |

These are three storage deployment groups representing nine companies. Every company has its
own API and frontend containers and localhost ports. The three medium companies share one SQL
instance and database with three schemas. The five small companies share one SQL instance,
database and schema: **each row has one TenantId**, with five distinct company TenantIds across
the shared tables. Tenant-aware composite keys, EF filters, write guards and SQL RLS apply.

`companies.json` contains the nonsecret fictional inventory. Generated Compose configuration,
Nginx proxy configuration, credentials and test reports are ignored by Git and Docker builds.
Login as `admin@<slug>.example.test` (for example `admin@titan.example.test`), using `userPassword`
from `generated/secrets.json`. Acceptance checks create a project and assigned task per company.
Credentials and SQL volumes persist across runs; retain secrets.json when retaining the volumes.
All published ports bind to loopback; SQL has no published host ports.

The `LocalDocker` environment explicitly replaces legacy application and Identity stores with
the existing tenant-aware model. Placement comes from each API container's server configuration;
headers cannot change it. Each local Angular container receives a generated `tenant-config.js`
containing only its tenant ID and display name, so the browser store initializes before the first
authenticated API request. Tokens carry the tenant ID and use a company-specific issuer/audience.
Cookies use company-specific names to avoid localhost port collisions. Nginx proxies
`/services/api/` to the matching company's API.

This is local acceptance composition, not the production catalog/authority/membership cutover.
Admin `local-init` only accepts the LocalDocker environment and StmsLocal-prefixed databases.
It generates the full tenant model for empty schemas, installs RLS for shared-row storage, and
seeds navigation. It does not retrofit legacy databases or run DDL during API startup.
Local SQL connections use the generated administrator password; production must use managed,
least-privilege credentials and the production provisioning path.

Grafana is available at `http://localhost:3000` (`admin`/`admin`), Loki at
`http://localhost:3100/ready`, Tempo at `http://localhost:3200/ready`, and Prometheus at
`http://localhost:9090/-/ready`. APIs push logs to Loki and OTLP traces/metrics to Alloy; Alloy
forwards traces to Tempo and metrics to Prometheus. Console exporters remain diagnostic fallbacks.
Telemetry export is best effort; an unavailable observability backend does not block API startup.

`generated/verification.json` records the latest successful acceptance run: Angular document
and bundle delivery, database-backed API readiness, registration/login, menus, project/task
creation and reads, refresh, 72 cross-company JWT rejections, SQL isolation checks and all 26
long-running service containers running simultaneously. The nine initializer containers exit
successfully after provisioning.
