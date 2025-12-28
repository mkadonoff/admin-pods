[CmdletBinding()]
param(
  [int]$ApiPort = 3000,
  [int]$WebPort = 5173,
  [int]$WaitSeconds = 60
)

$ErrorActionPreference = 'Stop'

function Assert-PathExists([string]$Path, [string]$Message) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPath = Join-Path $repoRoot 'api'
$webPath = Join-Path $repoRoot 'web'

Assert-PathExists $apiPath "Could not find 'api' folder at: $apiPath"
Assert-PathExists $webPath "Could not find 'web' folder at: $webPath"
Assert-PathExists (Join-Path $apiPath 'package.json') "Missing api/package.json"
Assert-PathExists (Join-Path $webPath 'package.json') "Missing web/package.json"

Write-Host "Starting API dev server (port $ApiPort)..." -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', "cd /d `"$apiPath`" & npm run dev") | Out-Null

Write-Host "Starting Web dev server (port $WebPort)..." -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', "cd /d `"$webPath`" & npm run dev") | Out-Null

Write-Host "Waiting for http://localhost:$WebPort to be ready (up to $WaitSeconds seconds)..." -ForegroundColor Cyan
$ready = $false
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
  try {
    if (Test-NetConnection -ComputerName 'localhost' -Port $WebPort -InformationLevel Quiet) {
      $ready = $true
      break
    }
  } catch {
    # Ignore transient errors while the dev server boots.
  }
  Start-Sleep -Seconds 1
}

if ($ready) {
  $url = "http://localhost:$WebPort"
  Write-Host "Opening $url" -ForegroundColor Green
  Start-Process $url | Out-Null
} else {
  Write-Warning "Web server did not become reachable on port $WebPort within $WaitSeconds seconds."
  Write-Warning "Try opening http://localhost:$WebPort manually once Vite finishes starting."
}
