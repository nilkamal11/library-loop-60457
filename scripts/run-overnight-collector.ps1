param(
  [ValidateSet('upload', 'dry-run', 'list-sources')]
  [string]$Mode = 'upload'
)

$ErrorActionPreference = 'Stop'
$dashboardPath = Split-Path -Parent $PSScriptRoot
$runLogPath = Join-Path $dashboardPath 'collector\runs\scheduled'
New-Item -ItemType Directory -Path $runLogPath -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $runLogPath "$timestamp-$Mode.log"

try {
  $corepackPath = (Get-Command corepack.cmd -ErrorAction Stop).Source
  Push-Location -LiteralPath $dashboardPath
  try {
    $arguments = switch ($Mode) {
      'upload' { @('pnpm', 'run', 'collect:overnight') }
      'dry-run' { @('pnpm', 'run', 'collect:dry-run') }
      'list-sources' { @('pnpm', 'exec', 'node', 'collector/run.mjs', '--list-sources') }
    }
    & $corepackPath @arguments 2>&1 | Out-File -LiteralPath $logPath -Append -Encoding utf8
    $collectorExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} catch {
  $_ | Out-String | Out-File -LiteralPath $logPath -Append -Encoding utf8
  $collectorExitCode = 1
}

exit $collectorExitCode
