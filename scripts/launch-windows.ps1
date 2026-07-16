param(
  [ValidateSet('apply', 'remove')]
  [string]$Mode = 'apply'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$port = 9341
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexBackgroundColor'
$stateFile = Join-Path $stateRoot 'state'
$logFile = Join-Path $stateRoot 'injector.log'
$errorLogFile = Join-Path $stateRoot 'injector-error.log'

function Find-Codex {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Codex\Codex.exe'),
    (Join-Path $env:ProgramFiles 'Codex\Codex.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Codex\Codex.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }
  if ($candidates) { return $candidates[0] }
  $app = Get-Command Codex.exe -ErrorAction SilentlyContinue
  if ($app) { return $app.Source }
  throw '找不到 Codex.exe。请安装官方 Codex，或将其加入 PATH。'
}

function Test-Cdp {
  try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$port/json/list").StatusCode -eq 200 }
  catch { return $false }
}

function Stop-Injector {
  if (Test-Path $stateFile) {
    $watcherPid = Get-Content $stateFile -ErrorAction SilentlyContinue
    if ($watcherPid -match '^\d+$') { Stop-Process -Id $watcherPid -ErrorAction SilentlyContinue }
    Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
  }
}

New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
Stop-Injector

if ($Mode -eq 'remove') {
  if (Test-Cdp) { node (Join-Path $root 'src\inject.mjs') $port --remove }
  Write-Host '已停止背景注入器。'
  exit 0
}

if (-not (Test-Cdp)) {
  $codex = Find-Codex
  Get-Process Codex -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Process -FilePath $codex -ArgumentList "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port"
  $ready = $false
  1..60 | ForEach-Object {
    if (-not $ready) { Start-Sleep -Milliseconds 500; $ready = Test-Cdp }
  }
  if (-not $ready) { throw 'Codex 未能启动本机调试接口。' }
}

node (Join-Path $root 'src\inject.mjs') $port --remove 2>$null
node (Join-Path $root 'src\inject.mjs') $port
$watcher = Start-Process -FilePath 'node' -ArgumentList "`"$root\src\inject.mjs`" $port --watch" -RedirectStandardOutput $logFile -RedirectStandardError $errorLogFile -PassThru
$watcher.Id | Set-Content $stateFile
Write-Host '已应用背景控件。'
