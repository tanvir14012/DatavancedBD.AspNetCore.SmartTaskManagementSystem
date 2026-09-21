$ErrorActionPreference = 'Stop'
$generated = Join-Path $PSScriptRoot 'generated'
$compose = Join-Path $generated 'compose.json'
$companies = Get-Content (Join-Path $PSScriptRoot 'companies.json') -Raw | ConvertFrom-Json
$secrets = Get-Content (Join-Path $generated 'secrets.json') -Raw | ConvertFrom-Json
$dockerInfo = & docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop Linux engine is unavailable. Start Docker Desktop, switch to Linux containers, and rerun this script.`n$dockerInfo"
}

function Assert($condition, $message) { if (-not $condition) { throw $message } }

function Invoke-Curl($uri, $method = 'GET', $body = $null, $headers = @{}, $timeout = 10) {
    $outputFile = [IO.Path]::GetTempFileName()
    $headerFile = [IO.Path]::GetTempFileName()
    $errorFile = [IO.Path]::GetTempFileName()
    $bodyFile = $null
    try {
        $curlArgs = @('--noproxy', '*', '-sS', '-L', '--max-time', [string]$timeout,
            '-X', $method, '-D', $headerFile, '-o', $outputFile, '-w', '%{http_code}')
        foreach ($header in $headers.GetEnumerator()) {
            $curlArgs += @('-H', ('{0}: {1}' -f $header.Key, $header.Value))
        }
        if ($null -ne $body) {
            $bodyFile = [IO.Path]::GetTempFileName()
            ($body | ConvertTo-Json -Depth 8 -Compress) | Set-Content -NoNewline $bodyFile
            $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
        }
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { $statusText = & curl.exe @curlArgs $uri 2> $errorFile } finally { $ErrorActionPreference = $oldErrorAction }
        $status = 0
        [int]::TryParse(($statusText | Out-String).Trim(), [ref]$status) | Out-Null
        $content = if (Test-Path $outputFile) { Get-Content $outputFile -Raw } else { '' }
        $responseHeaders = @{}
        foreach ($line in Get-Content $headerFile) {
            if ($line -match '^([^:]+):\s*(.*)$') { $responseHeaders[$matches[1]] = $matches[2] }
        }
        [pscustomobject]@{ StatusCode = $status; Content = $content; Headers = $responseHeaders; Error = (Get-Content $errorFile -Raw) }
    } finally {
        foreach ($file in @($bodyFile, $outputFile, $headerFile, $errorFile)) {
            if ($file -and (Test-Path $file)) { Remove-Item -LiteralPath $file -Force }
        }
    }
}

function Wait-Api($company) {
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        $probe = Invoke-Curl "http://127.0.0.1:$($company.apiPort)/ready" -timeout 3
        if ($probe.StatusCode -eq 200) { return }
        if (($attempt % 5) -eq 0) { Write-Host "  API not ready yet ($attempt/60)..." }
        Start-Sleep -Seconds 2
    }
    $status = & docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "stms-local-api-$($company.slug)-1" 2>&1
    throw "$($company.name) API is not ready. Docker state: $status"
}

$tokens = @{}
$results = @()
foreach ($company in $companies) {
    Write-Host "Checking $($company.name) [$($company.slug)] API :$($company.apiPort) and Angular :$($company.port)..."
    Wait-Api $company
    $base = "http://127.0.0.1:$($company.port)"
    $api = "$base/services/api"
    $front = Invoke-Curl $base
    Assert ($front.StatusCode -eq 200 -and $front.Content -match 'app-root') "$($company.name) Angular frontend failed."
    $email = "admin@$($company.slug).example.test"
    $login = Invoke-Curl "$api/auth/login" 'POST' @{ email = $email; password = $secrets.userPassword }
    if ($login.StatusCode -eq 401) {
        $register = Invoke-Curl "$api/auth/register" 'POST' @{ firstName = $company.slug; lastName = 'Admin'; email = $email; password = $secrets.userPassword; role = 'Admin' }
        Assert ($register.StatusCode -eq 200) "Registration failed for $($company.slug): $($register.Content)"
        $login = Invoke-Curl "$api/auth/login" 'POST' @{ email = $email; password = $secrets.userPassword }
    }
    Assert ($login.StatusCode -eq 200) "Login failed for $($company.slug): $($login.Content)"
    $loginJson = $login.Content | ConvertFrom-Json
    $tokens[$company.slug] = $loginJson.accessToken
    $auth = @{ Authorization = "Bearer $($tokens[$company.slug])" }
    $menus = Invoke-Curl "$api/menus/" 'GET' $null $auth
    Assert ($menus.StatusCode -eq 200) "Menus failed for $($company.slug): $($menus.Content)"
    $projects = Invoke-Curl "$api/projects/" 'GET' $null $auth
    Assert ($projects.StatusCode -eq 200) "Projects failed for $($company.slug): $($projects.Content)"
    $projectName = "$($company.name) launch"
    $existing = ($projects.Content | ConvertFrom-Json).items | Where-Object name -EQ $projectName | Select-Object -First 1
    if ($null -eq $existing) {
        $created = Invoke-Curl "$api/projects/" 'POST' @{ name = $projectName; description = "Isolation acceptance: $($company.id)" } $auth
        Assert ($created.StatusCode -eq 201) "Project create failed for $($company.slug): $($created.Content)"
        $project = $created.Content | ConvertFrom-Json
        $task = Invoke-Curl "$api/tasks/" 'POST' @{ projectId = $project.id; title = "$($company.name) first task"; description = 'Local Docker acceptance'; status = 'Todo'; priority = 'Medium'; assigneeEmail = $email } $auth
        Assert ($task.StatusCode -eq 201) "Task create failed for $($company.slug): $($task.Content)"
    }
    $refreshCookie = $login.Headers['Set-Cookie']
    if ($refreshCookie) {
        $refresh = Invoke-Curl "$api/auth/refresh" 'POST' @{} @{ Cookie = ($refreshCookie -split ';')[0] }
        Assert ($refresh.StatusCode -eq 200) "Refresh failed for $($company.slug): $($refresh.Content)"
    }
    $results += [pscustomobject]@{ company = $company.name; tier = $company.tier; frontend = $base; api = "http://127.0.0.1:$($company.apiPort)"; status = 'passed' }
    Write-Host "$($company.name): frontend, API, login, menus, projects, and refresh passed."
}

foreach ($source in $companies) {
    foreach ($target in $companies | Where-Object slug -NE $source.slug) {
        $response = Invoke-Curl "http://127.0.0.1:$($target.apiPort)/api/projects/" 'GET' $null @{ Authorization = "Bearer $($tokens[$source.slug])" }
        Assert ($response.StatusCode -eq 401) "$($source.slug) token accepted by $($target.slug)."
    }
}

function Invoke-Sql($tier, $query) {
    $output = $query | & docker compose -f $compose exec -T "sql-$tier" sh -c '/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -b -h -1 -W' 2>&1
    Assert ($LASTEXITCODE -eq 0) "SQL isolation check failed for ${tier}: $output"
}
Invoke-Sql dedicated "USE StmsLocaldedicated; IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='Users') THROW 51000, 'Dedicated schema missing', 1;"
Invoke-Sql schema "USE StmsLocalschema; IF (SELECT COUNT(*) FROM sys.schemas WHERE name IN ('atlas','beacon','cedar')) <> 3 THROW 51000, 'Schema isolation missing', 1;"
Invoke-Sql row "USE StmsLocalrow; IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name='TenantIsolationPolicy') THROW 51000, 'RLS policy missing', 1;"

$services = @(& docker compose -f $compose ps --format json | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object State -EQ 'running')
Assert ($services.Count -eq 26) "Expected 26 running services; found $($services.Count)."
$report = @{ verifiedAt = (Get-Date).ToString('o'); runningContainers = $services.Count; companies = $results; status = 'passed' }
$report | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $generated 'verification.json')
Write-Host "PASS: 26 service containers, all company API/frontend checks, token isolation, and SQL layout checks passed."
