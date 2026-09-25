param(
    [switch]$GenerateOnly,
    [switch]$SkipBuild,
    [ValidateSet('Angular', 'React')][string]$FrontendClient,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')][string]$ProjectName = 'stms-local'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$settings = Get-Content "$PSScriptRoot/settings.json" -Raw | ConvertFrom-Json
if (!$FrontendClient) { $FrontendClient = $settings.frontendClient }
if ($FrontendClient -notin @('Angular', 'React')) { throw 'frontendClient must be Angular or React.' }
$FrontendClient = if ($FrontendClient -ieq 'React') { 'React' } else { 'Angular' }
$frontendImage = if ($FrontendClient -eq 'React') { 'stms-local-web-react' } else { 'stms-local-web' }
if (!$GenerateOnly) {
    $dockerInfo = & docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Desktop Linux engine is unavailable. Start Docker Desktop, switch to Linux containers, wait for the engine to become ready, then rerun this script.`n$dockerInfo"
    }
}
$generated = Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force $generated | Out-Null
$compose = Join-Path $generated 'compose.json'
if (Test-Path $compose) {
    $previous = Get-Content $compose -Raw | ConvertFrom-Json
    if (!$GenerateOnly) {
        & docker compose -f $compose down --volumes --remove-orphans | Out-Host
        if ($LASTEXITCODE) { throw "Unable to reset the previous local project '$($previous.name)'." }
    }
}
$secretPath = Join-Path $generated 'secrets.json'
if (!(Test-Path $secretPath)) {
    @{ sqlPassword = 'Sql!9a' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(20)); jwtKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)); userPassword = 'Demo!9a' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(10)) } |
        ConvertTo-Json | Set-Content $secretPath
}
$secrets = Get-Content $secretPath -Raw | ConvertFrom-Json
$companies = Get-Content "$PSScriptRoot/companies.json" -Raw | ConvertFrom-Json
$services = [ordered]@{}
$volumes = @{}
$services['loki'] = @{
    image = 'grafana/loki:3.5.0'
    command = @('-config.file=/etc/loki/config.yml')
    volumes = @("$root/deploy/observability/loki-config.yml:/etc/loki/config.yml:ro", 'loki-data:/loki')
    ports = @('127.0.0.1:3100:3100')
    healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:3100/ready'); interval = '10s'; timeout = '5s'; retries = 20 }
}
$services['grafana'] = @{
    image = 'grafana/grafana:12.1.1'
    environment = @{ GF_SECURITY_ADMIN_USER = 'admin'; GF_SECURITY_ADMIN_PASSWORD = 'admin' }
    volumes = @('grafana-data:/var/lib/grafana', "$root/deploy/observability/grafana/provisioning:/etc/grafana/provisioning:ro")
    ports = @('127.0.0.1:3000:3000')
    depends_on = @{ loki = @{ condition = 'service_healthy' } }
}
$volumes['loki-data'] = @{}
$volumes['grafana-data'] = @{}
$services['tempo'] = @{
    image = 'grafana/tempo:2.8.2'; command = @('-config.file=/etc/tempo/config.yml')
    volumes = @("$root/deploy/observability/tempo-config.yml:/etc/tempo/config.yml:ro", 'tempo-data:/var/tempo')
    ports = @('127.0.0.1:3200:3200')
    healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:3200/ready'); interval = '10s'; timeout = '5s'; retries = 20 }
}
$services['prometheus'] = @{
    image = 'prom/prometheus:v3.5.0'; command = @('--config.file=/etc/prometheus/prometheus.yml', '--web.enable-remote-write-receiver')
    volumes = @("$root/deploy/observability/prometheus.yml:/etc/prometheus/prometheus.yml:ro", 'prometheus-data:/prometheus')
    ports = @('127.0.0.1:9090:9090')
    healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:9090/-/ready'); interval = '10s'; timeout = '5s'; retries = 20 }
}
$services['alloy'] = @{
    image = 'grafana/alloy:v1.10.2'; command = @('run', '/etc/alloy/config.alloy', '--storage.path=/var/lib/alloy/data')
    volumes = @("$root/deploy/observability/alloy-config.alloy:/etc/alloy/config.alloy:ro", 'alloy-data:/var/lib/alloy/data')
    ports = @('127.0.0.1:4317:4317', '127.0.0.1:4318:4318')
    healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:12345/-/ready'); interval = '10s'; timeout = '5s'; retries = 20 }
    depends_on = @{ tempo = @{ condition = 'service_healthy' }; prometheus = @{ condition = 'service_healthy' } }
}
$volumes['tempo-data'] = @{}
$volumes['prometheus-data'] = @{}
$volumes['alloy-data'] = @{}
foreach ($tier in @('dedicated', 'schema', 'row')) {
    $volumes["sql-$tier"] = @{}
    $services["sql-$tier"] = @{
        image = 'mcr.microsoft.com/mssql/server:2022-latest'
        environment = @{ ACCEPT_EULA = 'Y'; MSSQL_SA_PASSWORD = $secrets.sqlPassword; MSSQL_MEMORY_LIMIT_MB = '2048' }
        volumes = @("sql-${tier}:/var/opt/mssql")
        healthcheck = @{ test = @('CMD-SHELL', '/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$${MSSQL_SA_PASSWORD}" -Q "SELECT 1" -b -o /dev/null'); interval = '10s'; timeout = '5s'; retries = 30; start_period = '30s' }
    }
}
$lastInit = @{}
foreach ($company in $companies) {
    $slug = $company.slug
    $tier = $company.tier
    $env = @{
        ASPNETCORE_ENVIRONMENT = 'LocalDocker'; DOTNET_ENVIRONMENT = 'LocalDocker'
        ConnectionStrings__DefaultConnection = "Server=sql-$tier;Database=StmsLocal$tier;User Id=sa;Password=$($secrets.sqlPassword);Encrypt=False;TrustServerCertificate=True"
        LocalTenant__Id = $company.id; LocalTenant__Isolation = $company.isolation
        LocalTenant__Schema = $company.schema; LocalTenant__Target = $tier
        Jwt__Issuer = "http://localhost:$($company.port)"; Jwt__Audience = "http://localhost:$($company.port)"; Jwt__Key = $secrets.jwtKey
        Authentication__RefreshTokenCookieName = "stms_${slug}_refresh"
        Ai__Enabled = 'false'; Caching__Provider = 'Memory'; Caching__KeyPrefix = "local-$slug"
        Observability__Loki__Endpoint = 'http://loki:3100/loki/api/v1/push'; Observability__Loki__Tenant = $slug
        Observability__Otlp__TracesEndpoint = 'http://alloy:4318'; Observability__Otlp__MetricsEndpoint = 'http://alloy:4318'
        Cors__AllowedOrigins__0 = "http://localhost:$($company.port)"
        Logging__LogLevel__Default = 'Warning'
    }
    $dependencies = @{ "sql-$tier" = @{ condition = 'service_healthy' } }
    if ($lastInit.ContainsKey($tier)) { $dependencies[$lastInit[$tier]] = @{ condition = 'service_completed_successfully' } }
    $services["init-$slug"] = @{
        image = 'stms-local-admin'; build = @{ context = $root; dockerfile = 'Dockerfile.admin' }
        command = @('local-init'); environment = $env; depends_on = $dependencies
    }
    $lastInit[$tier] = "init-$slug"
    $services["api-$slug"] = @{
        image = 'stms-local-api'; build = @{ context = $root; dockerfile = 'Dockerfile.api' }
        environment = $env; ports = @("127.0.0.1:$($company.apiPort):8080")
        depends_on = @{ "init-$slug" = @{ condition = 'service_completed_successfully' }; loki = @{ condition = 'service_healthy' }; alloy = @{ condition = 'service_started' } }
        healthcheck = @{ test = @('CMD', 'dotnet', 'Api.dll', '--healthcheck'); interval = '30s'; timeout = '10s'; retries = 10; start_period = '30s' }
    }
    $nginx = @'
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location = /health { return 200 'ok'; }
    location /services/api/ {
        proxy_pass http://API_SERVICE:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / { try_files $uri $uri/ /index.html; }
}
'@
    $nginxPath = Join-Path $generated "$slug.conf"
    $nginx.Replace('API_SERVICE', "api-$slug") | Set-Content $nginxPath
    $tenantConfigPath = Join-Path $generated "$slug-tenant-config.js"
    "window.__STMS_TENANT__ = { tenantId: '$($company.id)', displayName: '$($company.name)' };" | Set-Content $tenantConfigPath
    $services["web-$slug"] = @{
        image = $frontendImage; build = @{ context = "$root/Frontend/$FrontendClient"; dockerfile = 'Dockerfile' }
        labels = @{ 'stms.frontend-client' = $FrontendClient }
        ports = @("127.0.0.1:$($company.port):8080")
        volumes = @("${nginxPath}:/etc/nginx/conf.d/default.conf:ro", "${tenantConfigPath}:/usr/share/nginx/html/tenant-config.js:ro")
        depends_on = @{ "api-$slug" = @{ condition = 'service_healthy' } }
        healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/health'); interval = '10s'; timeout = '5s'; retries = 12 }
    }
}
@{ name = $ProjectName; services = $services; volumes = $volumes } | ConvertTo-Json -Depth 15 | Set-Content $compose
if ($GenerateOnly) { Write-Host "Generated $compose"; return }
if (!$SkipBuild) {
    & docker compose -f $compose build api-titan init-titan web-titan
    if ($LASTEXITCODE) { throw 'Container build failed.' }
}
& docker compose -f $compose up -d --no-build
if ($LASTEXITCODE) { throw 'Container startup failed.' }
& "$PSScriptRoot/Test-LocalSaas.ps1"
