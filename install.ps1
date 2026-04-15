param(
  [string]$DatabaseUrl,
  [string]$JwtSecret,
  [int]$BackendPort = 3000,
  [int]$FrontendPort = 4173,
  [string]$ApiBaseUrl,
  [string]$BackupDir,
  [switch]$SkipSeed
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

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Invoke-Step {
  param(
    [string]$Description,
    [scriptblock]$Action
  )

  Write-Info $Description
  & $Action
  Write-Success $Description
}

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando requerido: $Name"
  }
}

function New-RandomSecret {
  $guidA = [Guid]::NewGuid().ToString('N')
  $guidB = [Guid]::NewGuid().ToString('N')
  return "$guidA$guidB"
}

function Get-DataRoot {
  if ($env:LOCALAPPDATA) {
    return (Join-Path $env:LOCALAPPDATA 'LaCasonaPOS')
  }

  return (Join-Path $RootPath '.runtime-data')
}

function Get-DefaultSocketUrl {
  if ($ApiBaseUrl) {
    return $ApiBaseUrl
  }

  return "http://localhost:$BackendPort"
}

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

if (-not (Test-Path (Join-Path $RootPath 'apps\backend\package.json'))) {
  throw 'No se encontro apps/backend/package.json en la instalacion.'
}

Require-Command 'node'
Require-Command 'npm'

if (-not $DatabaseUrl) {
  $DatabaseUrl = Read-Host 'DATABASE_URL (ej: postgresql://postgres:clave@localhost:5432/lacasona)'
}

if (-not $DatabaseUrl) {
  throw 'DATABASE_URL es obligatorio.'
}

if (-not $JwtSecret) {
  Write-Warn 'No se proporciono JWT_SECRET. Se generara uno aleatorio.'
  $JwtSecret = New-RandomSecret
}

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = "http://localhost:$BackendPort"
}

if (-not $BackupDir) {
  $BackupDir = Join-Path (Get-DataRoot) 'backups'
}

$BackendPath = Join-Path $RootPath 'apps/backend'
$FrontendDistPath = Join-Path $RootPath 'apps/frontend/dist'
$BackendEnvPath = Join-Path $RootPath 'apps/backend/.env'
$FrontendRuntimeConfigPath = Join-Path $FrontendDistPath 'runtime-config.js'

$backendEnvContent = @(
  "DATABASE_URL=$DatabaseUrl"
  "JWT_SECRET=$JwtSecret"
  "PORT=$BackendPort"
) -join "`r`n"

$socketUrl = Get-DefaultSocketUrl
$frontendRuntimeConfig = @(
  'window.__LACASONA_CONFIG__ = {'
  "  apiUrl: '$ApiBaseUrl',"
  "  socketUrl: '$socketUrl'"
  '};'
) -join "`r`n"

Invoke-Step 'Escribiendo apps/backend/.env' {
  Set-Content -Path $BackendEnvPath -Value $backendEnvContent -Encoding UTF8
}

Invoke-Step 'Escribiendo apps/frontend/dist/runtime-config.js' {
  if (-not (Test-Path $FrontendDistPath)) {
    throw 'No se encontro apps/frontend/dist. Debes instalar un paquete de produccion ya compilado.'
  }

  Set-Content -Path $FrontendRuntimeConfigPath -Value $frontendRuntimeConfig -Encoding UTF8
}

Invoke-Step 'Creando carpeta de backups' {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

Invoke-Step 'Instalando dependencias runtime del backend' {
  Push-Location $BackendPath
  try {
    npm install --omit=dev
  } finally {
    Pop-Location
  }
}

Invoke-Step 'Generando cliente Prisma' {
  Push-Location $BackendPath
  try {
    npm run prisma:generate
  } finally {
    Pop-Location
  }
}

Invoke-Step 'Aplicando migraciones de base de datos (production deploy)' {
  Push-Location $BackendPath
  try {
    npm exec prisma migrate deploy
  } finally {
    Pop-Location
  }
}

if (-not $SkipSeed) {
  Invoke-Step 'Ejecutando seed inicial' {
    Push-Location $BackendPath
    try {
      npm run prisma:seed
    } finally {
      Pop-Location
    }
  }
} else {
  Write-Warn 'Seed omitido por parametro -SkipSeed.'
}

Write-Host ''
Write-Success 'Instalacion completada.'
Write-Host 'Pasos siguientes sugeridos:' -ForegroundColor White
Write-Host "1) Inicio normal: usa el acceso directo 'La Casona POS - Iniciar'"
Write-Host "2) Accede desde la red en: http://<IP-SERVIDOR>:$FrontendPort"
Write-Host "3) Para detener: .\stop-prod.ps1"
Write-Host "4) Carpeta de backups: $BackupDir"
Write-Host ''
Write-Host 'Comando ejemplo de instalacion:' -ForegroundColor White
Write-Host 'powershell -ExecutionPolicy Bypass -File .\install.ps1 -DatabaseUrl "postgresql://postgres:clave@localhost:5432/lacasona" -ApiBaseUrl "http://192.168.1.50:3000" -BackupDir "$env:LOCALAPPDATA\LaCasonaPOS\backups"'
