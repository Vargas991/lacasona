param(
  [string]$Branch = 'main',
  [switch]$SkipGitPull,
  [switch]$RunSeed,
  [switch]$NoRestart,
  [int]$BackendPort = 3000,
  [int]$FrontendPort = 4173
)

$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando requerido: $Name"
  }
}

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

if (-not (Test-Path (Join-Path $RootPath '.git'))) {
  throw 'Esta instalacion es un paquete de produccion. Para actualizar, ejecuta el nuevo instalador de La Casona POS.'
}

Require-Command 'node'
Require-Command 'npm'
Require-Command 'git'

if (-not $SkipGitPull) {
  Write-Info "Actualizando codigo desde origin/$Branch ..."
  git fetch origin
  git pull --ff-only origin $Branch
  Write-Success 'Codigo actualizado.'
} else {
  Write-Info 'Se omitio git pull por parametro -SkipGitPull.'
}

Write-Info 'Instalando dependencias...'
npm install
Write-Success 'Dependencias actualizadas.'

Write-Info 'Generando cliente Prisma...'
npm run prisma:generate
Write-Success 'Cliente Prisma actualizado.'

Write-Info 'Aplicando migraciones de produccion...'
npm --workspace apps/backend exec prisma migrate deploy
Write-Success 'Migraciones aplicadas.'

if ($RunSeed) {
  Write-Info 'Ejecutando seed...'
  npm run prisma:seed
  Write-Success 'Seed completado.'
}

Write-Info 'Compilando backend y frontend...'
npm run build
Write-Success 'Compilacion completada.'

if (-not $NoRestart) {
  Write-Info 'Reiniciando servicios de produccion...'
  & (Join-Path $RootPath 'start-prod.ps1') -ForceRestart -NoBuild -BackendPort $BackendPort -FrontendPort $FrontendPort
  Write-Success 'Servicios reiniciados.'
} else {
  Write-Info 'NoRestart activo. No se reiniciaron servicios.'
}

Write-Host ''
Write-Host 'Actualizacion completada.' -ForegroundColor White
Write-Host 'Comando recomendado de uso:' -ForegroundColor White
Write-Host '.\update.ps1 -Branch main'
