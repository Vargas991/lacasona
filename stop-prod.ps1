param(
  [switch]$PurgeRuntime
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

function Get-DataRoot {
  if ($env:LOCALAPPDATA) {
    return (Join-Path $env:LOCALAPPDATA 'LaCasonaPOS')
  }

  return (Join-Path $RootPath '.runtime-data')
}

function Stop-ByPidFile {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    Write-Warn "${Name}: no existe archivo PID ($PidFile)."
    return
  }

  $pidRaw = (Get-Content $PidFile -Raw).Trim()
  if (-not $pidRaw) {
    Write-Warn "${Name}: archivo PID vacio."
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return
  }

  $pid = [int]$pidRaw
  $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $pid -Force
    Write-Success "$Name detenido (PID $pid)."
  } else {
    Write-Warn "${Name}: proceso PID $pid no estaba activo."
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$PreferredRuntimeDir = Join-Path (Get-DataRoot) '.runtime'
$LegacyRuntimeDir = Join-Path $RootPath '.runtime'

$runtimeDirs = @($PreferredRuntimeDir)
if ($LegacyRuntimeDir -ne $PreferredRuntimeDir) {
  $runtimeDirs += $LegacyRuntimeDir
}

Write-Info 'Deteniendo servicios de produccion...'
foreach ($runtimeDir in $runtimeDirs) {
  $PidDir = Join-Path $runtimeDir 'pids'
  $BackendPidFile = Join-Path $PidDir 'backend.pid'
  $FrontendPidFile = Join-Path $PidDir 'frontend.pid'

  Stop-ByPidFile -Name 'Backend' -PidFile $BackendPidFile
  Stop-ByPidFile -Name 'Frontend' -PidFile $FrontendPidFile

  if ($PurgeRuntime -and (Test-Path $runtimeDir)) {
    Remove-Item $runtimeDir -Recurse -Force
    Write-Success "Directorio runtime eliminado: $runtimeDir"
  }
}

Write-Host ''
Write-Host 'Proceso de apagado completado.' -ForegroundColor White
Write-Host 'Comando para iniciar de nuevo:' -ForegroundColor White
Write-Host '.\start-prod.ps1 -NoBuild'
