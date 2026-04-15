param(
  [int]$BackendPort = 3000,
  [int]$FrontendPort = 4173,
  [switch]$NoBuild,
  [switch]$ForceRestart
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

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando requerido: $Name"
  }
}

function Get-DataRoot {
  if ($env:LOCALAPPDATA) {
    return (Join-Path $env:LOCALAPPDATA 'LaCasonaPOS')
  }

  return (Join-Path $RootPath '.runtime-data')
}

function Stop-ProcessFromPidFile {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -Raw).Trim()
  if (-not $pidValue) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return
  }

  $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Info "Proceso detenido (PID $($process.Id))"
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

Require-Command 'node'

$NodeCmd = (Get-Command node).Source

$DataRoot = Get-DataRoot
$RuntimeDir = Join-Path $DataRoot '.runtime'
$LogDir = Join-Path $RuntimeDir 'logs'
$PidDir = Join-Path $RuntimeDir 'pids'

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $PidDir | Out-Null

$BackendPidFile = Join-Path $PidDir 'backend.pid'
$FrontendPidFile = Join-Path $PidDir 'frontend.pid'

if ($ForceRestart) {
  Write-Info 'ForceRestart activo. Deteniendo procesos existentes.'
  Stop-ProcessFromPidFile -PidFile $BackendPidFile
  Stop-ProcessFromPidFile -PidFile $FrontendPidFile
} else {
  foreach ($pidFile in @($BackendPidFile, $FrontendPidFile)) {
    if (Test-Path $pidFile) {
      $pidValue = (Get-Content $pidFile -Raw).Trim()
      if ($pidValue -and (Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue)) {
        throw 'Ya hay procesos de produccion en ejecucion. Usa -ForceRestart para reiniciar.'
      }
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

if (-not $NoBuild) {
  $hasSourceTree = (Test-Path (Join-Path $RootPath 'package.json')) -and
    (Test-Path (Join-Path $RootPath 'apps\backend\src')) -and
    (Test-Path (Join-Path $RootPath 'apps\frontend\src'))

  if ($hasSourceTree) {
    Require-Command 'npm'
    Write-Info 'Compilando proyecto...'
    npm run build
    Write-Success 'Compilacion completada.'
  } else {
    Write-Warn 'Paquete de produccion detectado. Se usaran los archivos dist existentes.'
  }
} else {
  Write-Warn 'Se omitio compilacion por parametro -NoBuild.'
}

$backendOut = Join-Path $LogDir 'backend.out.log'
$backendErr = Join-Path $LogDir 'backend.err.log'
$frontendOut = Join-Path $LogDir 'frontend.out.log'
$frontendErr = Join-Path $LogDir 'frontend.err.log'

$backendWorkDir = Join-Path $RootPath 'apps\backend'
$frontendWorkDir = Join-Path $RootPath 'apps\frontend'
$backendEntry = Join-Path $backendWorkDir 'dist\src\main.js'
$frontendEntry = Join-Path $frontendWorkDir 'scripts\preview-static.mjs'

if (-not (Test-Path $backendEntry)) {
  throw 'No se encontro apps/backend/dist/src/main.js. Ejecuta la compilacion o reinstala el paquete de produccion.'
}

if (-not (Test-Path (Join-Path $frontendWorkDir 'dist\index.html'))) {
  throw 'No se encontro apps/frontend/dist/index.html. Ejecuta la compilacion o reinstala el paquete de produccion.'
}

if (-not (Test-Path $frontendEntry)) {
  throw 'No se encontro apps/frontend/scripts/preview-static.mjs.'
}

Write-Info 'Iniciando backend (Nest)...'
$backendProcess = Start-Process -FilePath $NodeCmd `
  -ArgumentList @('dist/src/main.js') `
  -WorkingDirectory $backendWorkDir `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $BackendPidFile -Value $backendProcess.Id -Encoding ASCII
Write-Success "Backend iniciado. PID: $($backendProcess.Id)"

Write-Info 'Iniciando frontend (preview)...'
$frontendProcess = Start-Process -FilePath $NodeCmd `
  -ArgumentList @('./scripts/preview-static.mjs', '--host', '0.0.0.0', '--port', $FrontendPort.ToString()) `
  -WorkingDirectory $frontendWorkDir `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $FrontendPidFile -Value $frontendProcess.Id -Encoding ASCII
Write-Success "Frontend iniciado. PID: $($frontendProcess.Id)"

Write-Host ''
Write-Host 'Servicios iniciados:' -ForegroundColor White
Write-Host "- Backend:  http://localhost:$BackendPort"
Write-Host "- Frontend: http://localhost:$FrontendPort"
Write-Host "- Logs:     $LogDir"
Write-Host "- Datos:    $DataRoot"
Write-Host ''
Write-Host 'Uso normal: .\start-prod.ps1 -NoBuild'
Write-Host 'Para reiniciar: .\start-prod.ps1 -ForceRestart -NoBuild'
