param(
    [Parameter(Mandatory = $true)][string]$Location,
    [Parameter(Mandatory = $true)][string]$ResourceGroup,
    [Parameter(Mandatory = $true)][string]$StorageAccount,
    [Parameter(Mandatory = $true)][string]$StorageContainer,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$VmAdminPassword
)

$ErrorActionPreference = 'Stop'
$paramFile = "@$Root\parameters\vm-windows-prod.json"

az deployment sub create `
    --name stms-prod-rg-deployment `
    --location $Location `
    --template-file "$Root\rg.bicep" `
    --parameters location=$Location resourceGroupName=$ResourceGroup `
    --only-show-errors `
    --output none

if ($LASTEXITCODE -ne 0) { throw 'Resource group deployment failed.' }

az deployment group create `
    --name stms-prod-storage-deployment `
    --resource-group $ResourceGroup `
    --template-file "$Root\storage.bicep" `
    --parameters location=$Location storageAccountName=$StorageAccount containerName=$StorageContainer `
    --only-show-errors `
    --output none

if ($LASTEXITCODE -ne 0) { throw 'Storage deployment failed.' }

$candidates = @(
    'Standard_B2s_v2',
    'Standard_B2as_v2',
    'Standard_D2as_v5',
    'Standard_D2s_v5'
)

$usage = (az vm list-usage --location $Location --output json --only-show-errors | Out-String) | ConvertFrom-Json
$skus = (az vm list-skus --location $Location --resource-type virtualMachines --all --output json --only-show-errors | Out-String) | ConvertFrom-Json
$regional = $usage | Where-Object { $_.name.value -eq 'cores' } | Select-Object -First 1
$retryable = 'QuotaExceeded|SkuNotAvailable|AllocationFailed|ZonalAllocationFailed|OverconstrainedAllocationRequest|Capacity Restrictions'
$deployed = $null

foreach ($name in $candidates) {
    $sku = $skus | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $sku) { continue }

    $vcpu = [int](($sku.capabilities | Where-Object { $_.name -eq 'vCPUs' } | Select-Object -First 1).value)
    $familyQuota = $usage | Where-Object { $_.name.value -eq $sku.family } | Select-Object -First 1

    if ($familyQuota) {
        $familyRemaining = [int]$familyQuota.limit - [int]$familyQuota.currentValue
        $regionalRemaining = if ($regional) { [int]$regional.limit - [int]$regional.currentValue } else { 999999 }

        if ($familyRemaining -lt $vcpu -or $regionalRemaining -lt $vcpu) {
            Write-Host "Skipping $name: insufficient quota."
            continue
        }
    }

    Write-Host "Deploying VM with $name..."

    $result = az deployment group create `
        --name stms-prod-vm-deployment `
        --resource-group $ResourceGroup `
        --template-file "$Root\vm-windows.bicep" `
        --parameters $paramFile adminPassword=$VmAdminPassword vmSize=$name `
        --only-show-errors `
        --output none 2>&1

    if ($LASTEXITCODE -eq 0) {
        $deployed = $name
        break
    }

    $errorText = $result | Out-String

    if ($errorText -match $retryable) {
        Write-Warning "$name rejected by Azure; trying next size."
        continue
    }

    Write-Host $errorText
    throw "VM deployment failed for $name."
}

if (-not $deployed) {
    throw "No approved VM size could be deployed in $Location. Check vCPU quota."
}

$pipName = az deployment group show `
    --resource-group $ResourceGroup `
    --name stms-prod-vm-deployment `
    --query properties.outputs.publicIpName.value `
    --output tsv

$vmIp = az network public-ip show `
    --resource-group $ResourceGroup `
    --name $pipName `
    --query ipAddress `
    --output tsv

if ([string]::IsNullOrWhiteSpace($vmIp)) { throw 'Could not resolve VM public IP.' }

Write-Host "VM: $deployed"
Write-Host "IP: $vmIp"
Write-Host "##vso[task.setvariable variable=DEPLOYED_VM_SIZE]$deployed"
Write-Host "##vso[task.setvariable variable=VM_PUBLIC_IP]$vmIp"
