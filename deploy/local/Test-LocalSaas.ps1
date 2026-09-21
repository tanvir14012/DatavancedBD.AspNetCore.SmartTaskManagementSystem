$ErrorActionPreference = 'Stop'
$generated = Join-Path $PSScriptRoot 'generated'
$compose = Join-Path $generated 'compose.json'
$companies = Get-Content "$PSScriptRoot/companies.json" -Raw | ConvertFrom-Json
$secrets = Get-Content "$generated/secrets.json" -Raw | ConvertFrom-Json
function Assert($condition, $message) { if (!$condition) { throw $message } }
function Request($uri, $method = 'GET', $body = $null, $headers = @{}) {
    $args = @{ Uri = $uri; Method = $method; Headers = $headers; TimeoutSec = 30; SkipHttpErrorCheck = $true }
    if ($null -ne $body) { $args.Body = $body | ConvertTo-Json -Depth 5; $args.ContentType = 'application/json' }
    Invoke-WebRequest @args
}
$results = @()
$tokens = @{}
foreach ($company in $companies) {
    $base = "http://localhost:$($company.port)"
    $api = "$base/services/api"
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try { $ready = (Request "http://localhost:$($company.apiPort)/ready").StatusCode -eq 200 } catch { }
        if ($ready) { break }
        Start-Sleep -Seconds 2
    }
    Assert $ready "$($company.name) API is not ready."
    $html = Request $base
    Assert ($html.StatusCode -eq 200 -and $html.Content -match '<app-root') "$base does not serve Angular."
    $asset = [regex]::Match($html.Content, 'src="(main[^" ]+\.js)"').Groups[1].Value
    Assert ($asset -and (Request "$base/$asset").StatusCode -eq 200) "$base Angular bundle unavailable."
    $email = "admin@$($company.slug).example.test"
    $login = Request "$api/auth/login" POST @{ email = $email; password = $secrets.userPassword }
    if ($login.StatusCode -eq 401) {
        $register = Request "$api/auth/register" POST @{ firstName = $company.slug; lastName = 'Admin'; email = $email; password = $secrets.userPassword; role = 'Admin' }
        Assert ($register.StatusCode -eq 200) "Registration failed for $($company.slug): $($register.StatusCode) $($register.Content)"
        $login = Request "$api/auth/login" POST @{ email = $email; password = $secrets.userPassword }
    }
    Assert ($login.StatusCode -eq 200) "Login failed for $($company.slug): $($login.Content)"
    $tokens[$company.slug] = ($login.Content | ConvertFrom-Json).accessToken
    $headers = @{ Authorization = "Bearer $($tokens[$company.slug])" }
    $menu = Request "$api/menus/" GET $null $headers
    Assert ($menu.StatusCode -eq 200 -and $menu.Content -match 'Dashboard') "Menu failed for $($company.slug): $($menu.Content)"
    $list = Request "$api/projects/" GET $null $headers
    Assert ($list.StatusCode -eq 200) "Project list failed for $($company.slug): $($list.Content)"
    $name = "$($company.name) launch"
    $project = ($list.Content | ConvertFrom-Json).items | Where-Object name -EQ $name | Select-Object -First 1
    if (!$project) {
        $create = Request "$api/projects/" POST @{ name = $name; description = "Isolation acceptance: $($company.id)" } $headers
        Assert ($create.StatusCode -eq 201) "Create project failed for $($company.slug): $($create.StatusCode) $($create.Content)"
        $project = $create.Content | ConvertFrom-Json
        $task = Request "$api/tasks/" POST @{ projectId = $project.id; title = "$($company.name) first task"; description = 'Local Docker acceptance'; status = 'Todo'; priority = 'Medium'; assigneeEmail = $email } $headers
        Assert ($task.StatusCode -in @(200, 201)) "Create task failed for $($company.slug): $($task.Content)"
    }
    $list = Request "$api/projects/" GET $null $headers
    $items = ($list.Content | ConvertFrom-Json).items
    Assert (@($items | Where-Object name -EQ $name).Count -eq 1) "Own project missing for $($company.slug)"
    foreach ($other in $companies | Where-Object slug -NE $company.slug) {
        Assert (@($items | Where-Object name -EQ "$($other.name) launch").Count -eq 0) "Cross-company project leak!"
    }
    $tasks = Request "$api/tasks/" GET $null $headers
    Assert ($tasks.StatusCode -eq 200 -and $tasks.Content -match [regex]::Escape("$($company.name) first task")) "Task read failed for $($company.slug): $($tasks.Content)"
    # Refresh cookie names must be distinct because browser cookies are not isolated by port.
    $cookie = ($login.Headers['Set-Cookie'] | Select-Object -First 1).Split(';')[0]
    $refresh = Request "$api/auth/refresh" POST @{} @{ Cookie = $cookie }
    Assert ($refresh.StatusCode -eq 200) "Refresh failed for $($company.slug): $($refresh.Content)"
    $results += [pscustomobject]@{ company = $company.name; tier = $company.tier; tenantId = $company.id; frontend = $base; api = "http://localhost:$($company.apiPort)"; email = $email; status = 'passed' }
    Write-Host "$($company.name): Angular, readiness, login, menus, projects, tasks, refresh passed."
}
$rejections = 0
foreach ($source in $companies) {
    foreach ($target in $companies | Where-Object slug -NE $source.slug) {
        $response = Request "http://localhost:$($target.port)/services/api/projects/" GET $null @{ Authorization = "Bearer $($tokens[$source.slug])" }
        Assert ($response.StatusCode -eq 401) "$($source.slug) token accepted by $($target.slug)!"
        $rejections++
    }
}
function Sql($tier, $query) {
    $query | & docker compose -f $compose exec -T "sql-$tier" sh -c '/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -b -h -1 -W'
    if ($LASTEXITCODE) { throw "SQL isolation check failed: $tier" }
}
Sql dedicated "USE StmsLocaldedicated; IF (SELECT COUNT(DISTINCT TenantId) FROM dbo.Users) <> 1 THROW 51000, 'Expected one dedicated company', 1;"
Sql schema "USE StmsLocalschema; IF (SELECT COUNT(*) FROM sys.tables WHERE name='Users' AND SCHEMA_NAME(schema_id) IN ('atlas','beacon','cedar')) <> 3 THROW 51000, 'Expected three company schemas', 1;"
$rowQuery = "USE StmsLocalrow; DECLARE @total int=0;"
foreach ($company in $companies | Where-Object tier -EQ 'row') {
    $rowQuery += "EXEC sys.sp_set_session_context @key=N'TenantId', @value=N'$($company.id)'; IF NOT EXISTS(SELECT 1 FROM dbo.Users) THROW 51000, 'Missing row company', 1; IF EXISTS(SELECT 1 FROM dbo.Users WHERE TenantId <> '$($company.id)') THROW 51000, 'RLS leaked users', 1; SET @total += 1;"
}
$rowQuery += "EXEC sys.sp_set_session_context @key=N'TenantId', @value=NULL; IF EXISTS(SELECT 1 FROM dbo.Users) THROW 51000, 'Unbound session leaked rows', 1; IF @total <> 5 THROW 51000, 'Expected five row companies', 1;"
$rowQuery += @"
EXEC sys.sp_set_session_context @key=N'TenantId', @value=N'30000000-0000-0000-0000-000000000001';
BEGIN TRANSACTION;
BEGIN TRY
    INSERT INTO dbo.MenuItems (TenantId, Name, Route, Icon, DisplayOrder, Type, CreatedAt)
    VALUES ('30000000-0000-0000-0000-000000000002', 'Forbidden', '/forbidden', 'block', 99, 0, SYSUTCDATETIME());
    ROLLBACK TRANSACTION;
    THROW 51000, 'RLS allowed a cross-company insert', 1;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF ERROR_NUMBER() <> 33504 THROW;
END CATCH;
"@
Sql row $rowQuery
$containers = & docker compose -f $compose ps --format json | ForEach-Object { $_ | ConvertFrom-Json }
Assert ($LASTEXITCODE -eq 0) 'Could not inspect containers.'
$running = @($containers | Where-Object State -EQ 'running')
Assert ($running.Count -eq 18) "Expected 18 simultaneous containers (3 SQL + 9 API + 9 Angular), found $($running.Count)."
Assert (@($running | Where-Object Health -NE 'healthy').Count -eq 0) 'Some containers are not healthy.'
$report = @{ verifiedAt = (Get-Date).ToString('o'); runningContainers = $running.Count; crossCompanyTokenRejections = $rejections; sqlIsolation = 'passed'; companies = $results }
$report | ConvertTo-Json -Depth 6 | Set-Content "$generated/verification.json"
$results | Format-Table company, tier, frontend, status
Write-Host "PASS: 18 service containers running together; $rejections cross-company token rejections; SQL isolation passed."
Write-Host "Local account password is in $generated/secrets.json (userPassword)."
