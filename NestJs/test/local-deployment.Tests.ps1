$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '../localDeployment.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $scriptPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors) { throw 'Deployment script parsing failed.' }

# Load only the command wrapper: this test must not provision or restart services.
$wrapper = $ast.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq 'Invoke-Checked'
}, $true)
if (!$wrapper) { throw 'Invoke-Checked was not found.' }
Invoke-Expression $wrapper.Extent.Text

$fixture = Join-Path ([IO.Path]::GetTempPath()) ('native-stderr-' + [guid]::NewGuid().ToString('N') + '.cjs')
try {
    [IO.File]::WriteAllText($fixture,
        'process.stderr.write("Environment variables loaded from .env\n"); process.exit(Number(process.argv[2]));')
    $result = Invoke-Checked node @($fixture, '0')
    if (($result -join '') -notmatch 'Environment variables loaded') {
        throw 'Successful stderr output was lost.'
    }
    $failed = $false
    try { Invoke-Checked node @($fixture, '7') } catch {
        if ($_.Exception.Message -notmatch 'exit code 7') { throw }
        $failed = $true
    }
    if (!$failed) { throw 'Nonzero native exit code was ignored.' }
    if ($ErrorActionPreference -ne 'Stop') { throw 'Error preference was not restored.' }
    Write-Output "PowerShell $($PSVersionTable.PSVersion): native command regression passed."
} finally {
    Remove-Item -LiteralPath $fixture -ErrorAction SilentlyContinue
}
