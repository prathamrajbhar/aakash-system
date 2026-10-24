# Aakash Cloud System - Complete Uninstaller & Purge Script (Windows)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
#   powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -Force -All
#
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$All,
    [switch]$Images,
    [switch]$KeepData,
    [switch]$Help
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Write-Step([string]$Num, [string]$Msg) { Write-Host "[$Num] $Msg" -ForegroundColor Cyan }
function Write-Ok([string]$Msg)                 { Write-Host "  [✓] $Msg" -ForegroundColor Green }
function Write-Warn([string]$Msg)               { Write-Host "  [!] $Msg" -ForegroundColor Yellow }

if ($Help) {
    @"
Aakash Cloud System Uninstaller (Windows)

Usage:
  .\uninstall.ps1 [options]

Options:
  -Force       Skip confirmation prompt
  -All         Full purge: containers, data volumes, Docker images, and node_modules
  -Images      Remove downloaded Docker images
  -KeepData    Remove containers & caches but preserve .\aakash-data
  -Help        Show this help
"@
    exit 0
}

Write-Host "`n=== Aakash System Uninstaller ===" -ForegroundColor Red

if (-not $Force -and -not $All) {
    $confirm = Read-Host "Are you sure you want to uninstall and remove Aakash services? [y/N]"
    if ($confirm -notmatch "^[yY](es)?$") {
        Write-Host "Uninstallation aborted."
        exit 0
    }
}

Write-Step "1/4" "Stopping and removing Docker containers..."
if (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker compose down --volumes --remove-orphans 2>$null
    & docker rm -f aakash aakash-dashboard 2>$null
    & docker network rm aakash_default 2>$null
    Write-Ok "Containers and network removed"
}

if ($Images -or $All) {
    Write-Step "2/4" "Purging Docker images..."
    & docker rmi -f aws_local-dashboard floci/floci:latest 2>$null
    Write-Ok "Docker images removed"
} else {
    Write-Step "2/4" "Skipping Docker images (use -Images or -All to purge)"
}

Write-Step "3/4" "Cleaning data volumes..."
if (-not $KeepData) {
    Remove-Item -Recurse -Force "aakash-data", "aakash-dashboard-data" 2>$null
    Write-Ok "Data volumes deleted"
} else {
    Write-Warn "Data preserved in .\aakash-data"
}

Write-Step "4/4" "Cleaning build caches..."
Remove-Item -Recurse -Force ".next", "out", "dist", ".turbo", "tsconfig.tsbuildinfo" 2>$null
Write-Ok "Build caches cleared"

if ($All) {
    Remove-Item -Recurse -Force "node_modules" 2>$null
    Write-Ok "node_modules removed"
}

Write-Host "`n[✓] Aakash Cloud System successfully uninstalled!`n" -ForegroundColor Green
