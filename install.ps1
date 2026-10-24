# Aakash Management Console - Installer & Runner Script (Windows)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Dev
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Start
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Docker
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Verify
#
# Or run install.bat.

[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$Start,
    [switch]$Build,
    [switch]$Docker,
    [switch]$Verify,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$AppName = "Aakash Console"
$MinNodeMajor = 20
$RecommendedNodeMajor = 22
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Write-Info([string]$Message)  { Write-Host "[aakash] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)    { Write-Host "[✓] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message)  { Write-Host "[!] $Message" -ForegroundColor Yellow }
function Fail([string]$Message)        { Write-Host "[✗] $Message" -ForegroundColor Red; exit 1 }

if ($Help) {
    @"
$AppName Installer (Windows)

Usage:
  .\install.ps1 [options]

Options:
  -Dev        Install dependencies, then start the development server (default)
  -Start      Install, build, then start the production server
  -Build      Install and build production bundle
  -Docker     Build and start the full Docker Compose stack
  -Verify     Run typecheck, linter, and test suite
  -Help       Show this help
"@
    exit 0
}

function Get-NodeMajor {
    try {
        return [int](& node -p "process.versions.node.split('.')[0]" 2>$null)
    } catch {
        return 0
    }
}

function Ensure-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail "Node.js $MinNodeMajor+ is required. Please install Node.js LTS from https://nodejs.org"
    }

    $major = Get-NodeMajor
    if ($major -lt $MinNodeMajor) {
        Fail "Detected Node.js $major; version $MinNodeMajor+ is required."
    }

    Write-Ok "Node.js $(& node --version) - npm $(& npm --version)"
}

function Ensure-Deps {
    if (-not (Test-Path "node_modules")) {
        Write-Info "Installing dependencies..."
        & npm install
        if ($LASTEXITCODE -ne 0) { Fail "Dependency installation failed." }
        Write-Ok "Dependencies installed"
    } else {
        Write-Ok "Dependencies already present"
    }
}

if ($Verify) {
    Ensure-Node
    Ensure-Deps
    Write-Info "Running verification checks..."
    & npm run typecheck
    & npm run lint
    & npm run test
    Write-Ok "All checks passed!"
    exit 0
}

if ($Build) {
    Ensure-Node
    Ensure-Deps
    Write-Info "Building production bundle..."
    & npm run build
    Write-Ok "Build complete."
    exit 0
}

if ($Start) {
    Ensure-Node
    Ensure-Deps
    Write-Info "Building production bundle..."
    & npm run build
    Write-Info "Starting production server on http://localhost:3050..."
    & npm run start
    exit 0
}

if ($Dev) {
    Ensure-Node
    Ensure-Deps
    Write-Info "Starting development server on http://localhost:3050..."
    & npm run dev
    exit 0
}

# Default: Production Docker deployment
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Info "Deploying production Docker stack..."
    & docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        & docker-compose up -d --build
    }
    Write-Ok "Docker stack active: Console http://localhost:3050, Emulator http://localhost:4566"
    exit 0
}

Write-Warn "Docker not detected on host. Falling back to local Node.js development server."
Ensure-Node
Ensure-Deps
Write-Info "Starting development server on http://localhost:3050..."
& npm run dev
