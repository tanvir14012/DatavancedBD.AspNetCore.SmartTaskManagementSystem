param([switch]$GenerateOnly, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$generated = Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force $generated | Out-Null
$secretPath = Join-Path $generated 'secrets.json'
if (!(Test-Path $secretPath)) {
    @{ sqlPassword = 'Sql!9a' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(20)); jwtKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)); userPassword = 'Demo!9a' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(10)) } |
        ConvertTo-Json | Set-Content $secretPath
}
$secrets = Get-Content $secretPath -Raw | ConvertFrom-Json
$companies = Get-Content "$PSScriptRoot/companies.json" -Raw | ConvertFrom-Json
$services = [ordered]@{}
$volumes = @{}
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
        depends_on = @{ "init-$slug" = @{ condition = 'service_completed_successfully' } }
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
    $services["web-$slug"] = @{
        image = 'stms-local-web'; build = @{ context = "$root/Frontend/Angular"; dockerfile = 'Dockerfile' }
        ports = @("127.0.0.1:$($company.port):8080")
        volumes = @("${nginxPath}:/etc/nginx/conf.d/default.conf:ro")
        depends_on = @{ "api-$slug" = @{ condition = 'service_healthy' } }
        healthcheck = @{ test = @('CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/health'); interval = '10s'; timeout = '5s'; retries = 12 }
    }
}
$compose = Join-Path $generated 'compose.json'
@{ name = 'stms-local'; services = $services; volumes = $volumes } | ConvertTo-Json -Depth 15 | Set-Content $compose
if ($GenerateOnly) { Write-Host "Generated $compose"; return }
if (!$SkipBuild) {
    & docker compose -f $compose build api-titan init-titan web-titan
    if ($LASTEXITCODE) { throw 'Container build failed.' }
}
& docker compose -f $compose up -d --no-build
if ($LASTEXITCODE) { throw 'Container startup failed.' }
& "$PSScriptRoot/Test-LocalSaas.ps1"
