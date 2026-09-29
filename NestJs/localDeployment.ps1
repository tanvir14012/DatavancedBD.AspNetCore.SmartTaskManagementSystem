[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$ApiPort = 3002,
    [ValidateRange(1, 65535)][int]$FrontendPort = 5173,
    [ValidateRange(1, 65535)][int]$SqlPort = 56093,
    [string]$ContainerName = 'nestjs-local-sql',
    [string]$TestPassword
)

$ErrorActionPreference = 'Stop'
$nestRoot = (Resolve-Path $PSScriptRoot).Path
$repo = (Resolve-Path (Join-Path $nestRoot '..')).Path
$state = Join-Path $nestRoot '.local'
$secretPath = Join-Path $state 'secrets.json'
$envPath = Join-Path $nestRoot '.env'
$logPath = Join-Path $state 'logs'
New-Item -ItemType Directory -Force $state, $logPath | Out-Null

function New-RandomBytes {
    param([int]$Length)
    $bytes = New-Object byte[] $Length
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return $bytes
}

function Convert-ToHex {
    param([byte[]]$Bytes)
    return ([BitConverter]::ToString($Bytes)).Replace('-', '')
}

function Stop-PortListener {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {
            $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
            if ($process -and $process.Path -match 'node(\.exe)?$') {
                Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    $output = & $File @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Arguments can contain SQL passwords; never echo the command line.
        throw "$File failed with exit code $LASTEXITCODE.`n$($output -join [Environment]::NewLine)"
    }
    return $output
}

function Invoke-Sql {
    param([string]$Database, [string]$Query)
    $result = & docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $sqlPassword -d $Database -b -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SQL command failed for $Database.`n$result" }
}

function Wait-Sql {
    $lastError = $null
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        try {
            Invoke-Sql master 'SELECT 1' | Out-Null
            return
        } catch {
            $lastError = $_.Exception.Message
            Start-Sleep -Seconds 2
        }
    }
    $containerLogs = & docker logs --tail 40 $ContainerName 2>&1
    throw "SQL Server did not become ready within 120 seconds.`nLast probe: $lastError`nContainer logs:`n$($containerLogs -join [Environment]::NewLine)"
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI is required.' }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 is required.' }
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
if (!(Get-Command dotnet -ErrorAction SilentlyContinue)) { throw '.NET SDK is required for Admin local-init.' }
Invoke-Checked docker @('info') | Out-Null

if (Test-Path $secretPath) {
    $secrets = Get-Content $secretPath -Raw | ConvertFrom-Json
    $sqlPassword = [string]$secrets.sqlPassword
} else {
    $sqlPassword = 'Sql!9a' + (Convert-ToHex (New-RandomBytes 20))
    $secrets = [pscustomobject]@{
        sqlPassword = $sqlPassword
        jwtKey = [Convert]::ToBase64String((New-RandomBytes 48))
        testPassword = 'Test!' + (Convert-ToHex (New-RandomBytes 12))
    }
    $secrets | ConvertTo-Json | Set-Content $secretPath
}

if ($PSBoundParameters.ContainsKey('TestPassword')) {
    if ([string]::IsNullOrWhiteSpace($TestPassword) -or $TestPassword.Length -lt 8) {
        throw 'TestPassword must contain at least 8 characters.'
    }
    $secrets.testPassword = $TestPassword
    $secrets | ConvertTo-Json | Set-Content $secretPath
}

$existing = & docker ps -a --filter "name=^/${ContainerName}$" --format '{{.Status}}' 2>$null
if (!$existing) {
    Invoke-Checked docker @('volume', 'create', "$ContainerName-data")
    Invoke-Checked docker @('run', '-d', '--name', $ContainerName, '--restart', 'unless-stopped', '-e', 'ACCEPT_EULA=Y', '-e', "MSSQL_SA_PASSWORD=$sqlPassword", '-p', "127.0.0.1:${SqlPort}:1433", '-v', "$ContainerName-data:/var/opt/mssql", 'mcr.microsoft.com/mssql/server:2022-latest')
} elseif ($existing -notmatch '^Up') {
    Invoke-Checked docker @('start', $ContainerName)
}

if ($existing) {
    $containerEnvironment = & docker inspect $ContainerName --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null
    $containerPassword = $containerEnvironment |
        Where-Object { $_.StartsWith('MSSQL_SA_PASSWORD=') } |
        Select-Object -First 1
    if ($containerPassword) {
        $sqlPassword = $containerPassword.Substring('MSSQL_SA_PASSWORD='.Length)
        $secrets.sqlPassword = $sqlPassword
        $secrets | ConvertTo-Json | Set-Content $secretPath
    }
}
Wait-Sql

$databases = @('StmsNestCatalog', 'StmsLocalNestDbA', 'StmsLocalNestSchema', 'StmsLocalNestRow')
foreach ($database in $databases) {
    Invoke-Sql master "IF DB_ID(N'$database') IS NULL CREATE DATABASE [$database];"
}
Invoke-Sql StmsLocalNestSchema "IF SCHEMA_ID(N'alpha') IS NULL EXEC(N'CREATE SCHEMA [alpha] AUTHORIZATION [dbo]');"

$catalogScripts = @(
    'Infrastructure/Tenancy/Catalog/TenantCatalogBaseline.sql',
    'Infrastructure/Tenancy/Authorization/TenantAuthorityBaseline.sql',
    'Infrastructure/Tenancy/Authorization/TenantMembershipBaseline.sql'
)
foreach ($relative in $catalogScripts) {
    $tableName = switch -Wildcard ($relative) {
        '*TenantCatalogBaseline.sql' { 'TenantPlacements' }
        '*TenantAuthorityBaseline.sql' { 'TenantAuthorities' }
        '*TenantMembershipBaseline.sql' { 'TenantMemberships' }
    }
    $present = (& docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $sqlPassword -d StmsNestCatalog -h -1 -W -Q "SELECT CASE WHEN OBJECT_ID(N'[catalog].[$tableName]', N'U') IS NULL THEN 0 ELSE 1 END" 2>$null).Trim()
    if ($present -eq '1') { continue }
    $source = Join-Path $repo $relative
    $remote = '/tmp/' + [IO.Path]::GetFileName($source)
    Invoke-Checked docker @('cp', $source, "${ContainerName}:$remote")
    $result = & docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $sqlPassword -d StmsNestCatalog -b -i $remote 2>&1
    if ($LASTEXITCODE -ne 0 -and $result -notmatch 'already exists') { throw "Catalog script failed: $relative`n$result" }
}

$bindings = @(
    @{ Id = 'a93c4ba4-1bcb-46c9-ad6e-3dde4c7860be'; Isolation = 'Database'; Target = 'acceptdb'; Schema = 'dbo'; Database = 'StmsLocalNestDbA' },
    @{ Id = 'dfc17bd9-eab0-480b-bec4-ed86116f9431'; Isolation = 'Schema'; Target = 'acceptschema'; Schema = 'alpha'; Database = 'StmsLocalNestSchema' },
    @{ Id = '71a1a446-808d-446a-a69e-305e8f608bf7'; Isolation = 'Row'; Target = 'acceptrow'; Schema = 'dbo'; Database = 'StmsLocalNestRow' }
)
foreach ($binding in $bindings) {
    $env:ASPNETCORE_ENVIRONMENT = 'LocalDocker'
    $env:DOTNET_ENVIRONMENT = 'LocalDocker'
    $env:ConnectionStrings__DefaultConnection = "Server=127.0.0.1,$SqlPort;Database=$($binding.Database);User Id=sa;Password=$sqlPassword;Encrypt=False;TrustServerCertificate=True"
    $env:LocalTenant__Id = $binding.Id
    $env:LocalTenant__Isolation = $binding.Isolation
    $env:LocalTenant__Target = $binding.Target
    $env:LocalTenant__Schema = $binding.Schema
    Invoke-Checked dotnet @('run', '--project', (Join-Path $repo 'Admin/Admin.csproj'), '--configuration', 'Release', '--', 'local-init')
}

$catalogUrl = "sqlserver://127.0.0.1:$SqlPort;user=sa;password=$sqlPassword;encrypt=true;trustServerCertificate=true;database=StmsNestCatalog;schema=catalog"
$databaseUrl = "sqlserver://127.0.0.1:$SqlPort;user=sa;password=$sqlPassword;encrypt=true;trustServerCertificate=true;database=StmsLocalNestDbA;schema=dbo"
$schemaUrl = "sqlserver://127.0.0.1:$SqlPort;user=sa;password=$sqlPassword;encrypt=true;trustServerCertificate=true;database=StmsLocalNestSchema;schema=alpha"
$rowUrl = "sqlserver://127.0.0.1:$SqlPort;user=sa;password=$sqlPassword;encrypt=true;trustServerCertificate=true;database=StmsLocalNestRow;schema=dbo"
$env:CATALOG_DATABASE_URL = $catalogUrl
$env:TENANT_DATABASE_URL = $databaseUrl
$env:NESTJS_TEST_TENANT_ID = $bindings[0].Id
$env:NESTJS_TEST_EMAIL = 'accept0@example.test'
$env:NESTJS_TEST_PASSWORD = [string]$secrets.testPassword
$env:JWT_ISSUER = 'accept-issuer'
Stop-PortListener $ApiPort
Stop-PortListener $FrontendPort
if (!(Test-Path (Join-Path $nestRoot 'node_modules'))) {
    Invoke-Checked $npm @('--prefix', $nestRoot, 'ci')
}
if (!(Test-Path (Join-Path $repo 'Frontend/React/node_modules'))) {
    Invoke-Checked $npm @('--prefix', (Join-Path $repo 'Frontend/React'), 'ci')
}
Invoke-Checked $npm @('--prefix', $nestRoot, 'run', 'prisma:generate:catalog')
Invoke-Checked $npm @('--prefix', $nestRoot, 'run', 'prisma:generate:tenant')
Invoke-Checked $npm @('--prefix', $nestRoot, 'run', 'build')

Invoke-Sql StmsNestCatalog "IF NOT EXISTS (SELECT 1 FROM [catalog].[TenantPlacements] WHERE [TenantId] = '$($bindings[0].Id)') INSERT INTO [catalog].[TenantPlacements] ([TenantId],[Isolation],[TargetId],[SchemaName],[Region],[Version],[Lifecycle]) VALUES ('$($bindings[0].Id)', 0, 'acceptdb', NULL, 'local', 1, 1);"
Invoke-Sql StmsNestCatalog "IF NOT EXISTS (SELECT 1 FROM [catalog].[TenantPlacements] WHERE [TenantId] = '$($bindings[1].Id)') INSERT INTO [catalog].[TenantPlacements] ([TenantId],[Isolation],[TargetId],[SchemaName],[Region],[Version],[Lifecycle]) VALUES ('$($bindings[1].Id)', 1, 'acceptschema', 'alpha', 'local', 1, 1);"
Invoke-Sql StmsNestCatalog "IF NOT EXISTS (SELECT 1 FROM [catalog].[TenantPlacements] WHERE [TenantId] = '$($bindings[2].Id)') INSERT INTO [catalog].[TenantPlacements] ([TenantId],[Isolation],[TargetId],[SchemaName],[Region],[Version],[Lifecycle]) VALUES ('$($bindings[2].Id)', 2, 'acceptrow', NULL, 'local', 1, 1);"
Invoke-Sql StmsNestCatalog "IF NOT EXISTS (SELECT 1 FROM [catalog].[TenantAuthorities] WHERE [Authority]='a.accept.test') INSERT INTO [catalog].[TenantAuthorities] VALUES ('a.accept.test','$($bindings[0].Id)',1);"
Invoke-Sql StmsNestCatalog "IF NOT EXISTS (SELECT 1 FROM [catalog].[TenantAuthorities] WHERE [Authority]='a.accept.test:$ApiPort') INSERT INTO [catalog].[TenantAuthorities] VALUES ('a.accept.test:$ApiPort','$($bindings[0].Id)',1);"
Invoke-Checked $npm @('--prefix', $nestRoot, 'run', 'seed:local')

$targets = @(
    @{ targetId = 'acceptdb'; region = 'local'; isolation = 0; schema = 'dbo'; connectionString = $databaseUrl -replace ';schema=dbo$',''; commandTimeoutSeconds = 30 },
    @{ targetId = 'acceptschema'; region = 'local'; isolation = 1; schema = 'alpha'; connectionString = $schemaUrl -replace ';schema=alpha$',''; commandTimeoutSeconds = 30 },
    @{ targetId = 'acceptrow'; region = 'local'; isolation = 2; schema = 'dbo'; connectionString = $rowUrl -replace ';schema=dbo$',''; commandTimeoutSeconds = 30 }
)
$jwtKey = [string]$secrets.jwtKey
$envLines = @(
    "PORT=$ApiPort", 'NESTJS_CUTOVER_ENABLED=true', 'TENANT_REGION=local', 'JWT_ISSUER=accept-issuer', 'JWT_AUDIENCE=accept-audience', "JWT_KEY=$jwtKey", "ALLOWED_ORIGINS=https://localhost:$FrontendPort", "CATALOG_DATABASE_URL=$catalogUrl", ('TENANT_STORAGE_TARGETS=' + ($targets | ConvertTo-Json -Compress)), 'NESTJS_TEST_EMAIL_PREFIX=accept', "NESTJS_TEST_PASSWORD=$($secrets.testPassword)"
)
$envLines | Set-Content $envPath -Encoding utf8

# Node's --env-file does not override variables inherited from PowerShell. Set the
# deployment values explicitly so a stale PORT or JWT setting cannot leak into the child.
$env:PORT = [string]$ApiPort
$env:NESTJS_CUTOVER_ENABLED = 'true'
$env:TENANT_REGION = 'local'
$env:JWT_ISSUER = 'accept-issuer'
$env:JWT_AUDIENCE = 'accept-audience'
$env:JWT_KEY = $jwtKey
$env:ALLOWED_ORIGINS = "https://localhost:$FrontendPort"
$env:CATALOG_DATABASE_URL = $catalogUrl
$env:TENANT_STORAGE_TARGETS = ($targets | ConvertTo-Json -Compress)

$node = (Get-Command node).Source
$apiLog = Join-Path $logPath 'nestjs-api.log'
$apiErrorLog = Join-Path $logPath 'nestjs-api.error.log'
Set-Content -LiteralPath $apiLog -Value ''
Set-Content -LiteralPath $apiErrorLog -Value ''
$api = Start-Process -FilePath $node -ArgumentList "--env-file=$envPath", 'dist/src/main.js' -WorkingDirectory $nestRoot -RedirectStandardOutput $apiLog -RedirectStandardError $apiErrorLog -PassThru -WindowStyle Hidden
$env:VITE_API_BASE_URL = '/services'
$env:VITE_DEV_API_TARGET = "http://127.0.0.1:$ApiPort"
$env:STMS_DEV_TENANT_AUTHORITY = "a.accept.test:$ApiPort"
$vite = Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js', '--host=127.0.0.1', "--port=$FrontendPort", '--strictPort' -WorkingDirectory (Join-Path $repo 'Frontend/React') -RedirectStandardOutput (Join-Path $logPath 'react.log') -RedirectStandardError (Join-Path $logPath 'react.error.log') -PassThru -WindowStyle Hidden
$alive = $null
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $alive = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/alive" -TimeoutSec 2
        break
    } catch {
        if ($api.HasExited) {
            $apiOutput = if (Test-Path $apiLog) { Get-Content $apiLog -Raw } else { '' }
            $apiErrors = if (Test-Path $apiErrorLog) { Get-Content $apiErrorLog -Raw } else { '' }
            throw "NestJS API exited with code $($api.ExitCode).`n$apiOutput`n$apiErrors"
        }
        Start-Sleep -Seconds 1
    }
}
if (!$alive) {
    $apiErrors = if (Test-Path $apiErrorLog) { Get-Content $apiErrorLog -Raw } else { '' }
    throw "NestJS API did not listen on port $ApiPort.`n$apiErrors"
}
$ready = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/ready" -TimeoutSec 10
# Readiness alone does not prove the seeded account, tenant authority, or JWT flow.
$loginBody = @{ email = 'accept0@example.test'; password = [string]$secrets.testPassword } | ConvertTo-Json -Compress
$loginHeaders = @{ Host = "a.accept.test:$ApiPort"; Origin = "https://localhost:$FrontendPort" }
$login = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/api/auth/login" -Method Post -ContentType 'application/json' -Headers $loginHeaders -Body $loginBody -SessionVariable loginSession -TimeoutSec 15
if (!(($login.Content | ConvertFrom-Json).accessToken)) { throw 'Local login verification did not issue an access token.' }
# Secure cookies are not automatically sent over this loopback HTTP probe.
$refreshCookie = ([string]($login.Headers['Set-Cookie'] -join ';')).Split(';')[0]
if ($refreshCookie -notlike 'stms_refresh_token=*') { throw 'Local login verification did not issue a refresh cookie.' }
$loginHeaders['Cookie'] = $refreshCookie
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/api/auth/logout" -Method Post -Headers $loginHeaders -WebSession $loginSession -TimeoutSec 10 | Out-Null
Write-Host "NestJS API: http://127.0.0.1:$ApiPort (PID $($api.Id))"
Write-Host "React client: https://localhost:$FrontendPort (PID $($vite.Id))"
Write-Host "Tenant API authority: http://a.accept.test:$ApiPort"
Write-Host "Login: accept0@example.test / $($secrets.testPassword)"
Write-Host "Alive: $($alive.StatusCode); Ready: $($ready.StatusCode); Login: $($login.StatusCode)"
