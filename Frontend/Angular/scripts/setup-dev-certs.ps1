param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $projectRoot "certs"
$certFile = Join-Path $certDir "localhost.pem"
$keyFile = Join-Path $certDir "localhost-key.pem"

function Test-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  return $null -ne (Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:PATH = "$machinePath;$userPath"
}

function Install-Mkcert {
  if (Test-Command -Name "mkcert") {
    Write-Host "mkcert is already installed." -ForegroundColor Green
    return
  }

  Write-Host "mkcert not found. Installing..." -ForegroundColor Yellow

  if (Test-Command -Name "winget") {
    & winget install --id FiloSottile.mkcert --exact --accept-package-agreements --accept-source-agreements
  }
  elseif (Test-Command -Name "choco") {
    & choco install mkcert -y
  }
  else {
    throw "Neither Winget nor Chocolatey is installed. Install mkcert manually from https://github.com/FiloSottile/mkcert"
  }

  Refresh-Path

  if (-not (Test-Command -Name "mkcert")) {
    throw "mkcert was installed but is not yet available in PATH. Close PowerShell and rerun."
  }

  Write-Host "mkcert installed successfully." -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " HTTPS Development Certificate Setup " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Install-Mkcert

if (-not (Test-Path $certDir)) {
  New-Item -ItemType Directory -Path $certDir | Out-Null
}

Write-Host "Installing local Certificate Authority..." -ForegroundColor Cyan
& mkcert -install

if ((-not $Force) -and (Test-Path $certFile) -and (Test-Path $keyFile)) {
  Write-Host ""
  Write-Host "Existing certificate found." -ForegroundColor Green
  Write-Host "Use -Force to regenerate."
}
else {
  Write-Host ""
  Write-Host "Generating localhost certificate..." -ForegroundColor Cyan
  & mkcert -cert-file $certFile -key-file $keyFile "localhost" "127.0.0.1" "::1"
  Write-Host "Certificate generated." -ForegroundColor Green
}

Write-Host ""
Write-Host "Certificate : $certFile"
Write-Host "Private Key : $keyFile"
Write-Host ""
Write-Host "Done." -ForegroundColor Green
