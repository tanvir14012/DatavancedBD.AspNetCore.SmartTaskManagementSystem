param(
    [Parameter(Mandatory = $true)][string]$Location
)

$ErrorActionPreference = 'Stop'

$candidates = @(
    'Standard_B2s_v2',
    'Standard_B2as_v2',
    'Standard_D2as_v5',
    'Standard_D2s_v5'
)

$usage = (az vm list-usage --location $Location --output json --only-show-errors | Out-String) | ConvertFrom-Json
$skus = (az vm list-skus --location $Location --resource-type virtualMachines --all --output json --only-show-errors | Out-String) | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) { throw 'Unable to query Azure VM quota/SKUs.' }

$regional = $usage | Where-Object { $_.name.value -eq 'cores' } | Select-Object -First 1

foreach ($name in $candidates) {
    $sku = $skus | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $sku) { continue }

    $vcpu = [int](($sku.capabilities | Where-Object { $_.name -eq 'vCPUs' } | Select-Object -First 1).value)
    $familyQuota = $usage | Where-Object { $_.name.value -eq $sku.family } | Select-Object -First 1
    if (-not $familyQuota) { continue }

    $familyRemaining = [int]$familyQuota.limit - [int]$familyQuota.currentValue
    $regionalRemaining = if ($regional) { [int]$regional.limit - [int]$regional.currentValue } else { 999999 }

    Write-Host "$name : required=$vcpu, familyRemaining=$familyRemaining, regionalRemaining=$regionalRemaining"

    if ($familyRemaining -ge $vcpu -and $regionalRemaining -ge $vcpu) {
        Write-Host "VM quota check passed with candidate: $name"
        exit 0
    }
}

throw "No approved VM family has enough vCPU quota in $Location."
