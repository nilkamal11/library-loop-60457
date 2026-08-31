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
    # Preserve the native program's real exit code; pnpm may write ordinary progress
    # output to stderr, which must not turn an accepted upload into a PowerShell error.
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
    $arguments = switch ($Mode) {
      'upload' { @('pnpm', 'run', 'collect:overnight') }
      'dry-run' { @('pnpm', 'run', 'collect:dry-run') }
      'list-sources' { @('pnpm', 'exec', 'node', 'collector/run.mjs', '--list-sources') }
    }
    & $corepackPath @arguments 2>&1 | Out-File -LiteralPath $logPath -Append -Encoding utf8
    $collectorExitCode = $LASTEXITCODE
    if ($Mode -eq 'upload' -and $collectorExitCode -eq 0) {
      $snapshotDate = (Get-Date).ToString('yyyy-MM-dd')
      $snapshotUrl = "https://library-loop-60457.nilkamals463352.chatgpt.site/api/events?start=$snapshotDate&days=7&snapshot=$snapshotDate"
      $snapshotResponse = Invoke-WebRequest -Uri $snapshotUrl -UseBasicParsing -TimeoutSec 180
      if ($snapshotResponse.StatusCode -lt 200 -or $snapshotResponse.StatusCode -ge 300) {
        throw "Daily calendar snapshot returned HTTP $($snapshotResponse.StatusCode)."
      }
      $snapshot = $snapshotResponse.Content | ConvertFrom-Json
      $eventCount = @($snapshot.events).Count
      $sourceCount = $snapshot.sourceStatus.attempted
      "Daily calendar snapshot refreshed (HTTP $($snapshotResponse.StatusCode)): $eventCount events from $sourceCount configured sources." | Out-File -LiteralPath $logPath -Append -Encoding utf8
    }
  } finally {
    $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
    Pop-Location
  }
} catch {
  $_ | Out-String | Out-File -LiteralPath $logPath -Append -Encoding utf8
  $collectorExitCode = 1
}

exit $collectorExitCode
