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
  $commandArguments = switch ($Mode) {
    'upload' { @('pnpm', 'run', 'collect:browser') }
    'dry-run' { @('pnpm', 'run', 'collect:dry-run') }
    'list-sources' { @('pnpm', 'exec', 'node', 'collector/run.mjs', '--list-sources') }
  }
  $stdoutPath = Join-Path $runLogPath "$timestamp-$Mode.stdout.tmp"
  $stderrPath = Join-Path $runLogPath "$timestamp-$Mode.stderr.tmp"
  try {
    # Start-Process keeps routine native stderr separate from PowerShell's terminating-error stream.
    $collectorProcess = Start-Process -FilePath $corepackPath -ArgumentList $commandArguments -WorkingDirectory $dashboardPath -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath | Out-File -LiteralPath $logPath -Append -Encoding utf8 }
    if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath | Out-File -LiteralPath $logPath -Append -Encoding utf8 }
    $collectorExitCode = $collectorProcess.ExitCode
    if ($Mode -eq 'upload') {
      $snapshotDate = (Get-Date).ToString('yyyy-MM-dd')
      $snapshotUrl = "https://library-loop-60457.nilkamals463352.chatgpt.site/api/events?start=$snapshotDate&days=60&refresh=1"
      $refreshToken = [Environment]::GetEnvironmentVariable('LIBRARY_LOOP_INGEST_TOKEN', 'Process')
      if ([string]::IsNullOrWhiteSpace($refreshToken)) {
        $refreshToken = [Environment]::GetEnvironmentVariable('LIBRARY_LOOP_INGEST_TOKEN', 'User')
      }
      if ([string]::IsNullOrWhiteSpace($refreshToken)) { throw 'The calendar refresh token is not configured.' }
      $snapshotHeaders = @{ Authorization = "Bearer $refreshToken" }
      $snapshotResponse = Invoke-WebRequest -Uri $snapshotUrl -Headers $snapshotHeaders -UseBasicParsing -TimeoutSec 300
      if ($snapshotResponse.StatusCode -lt 200 -or $snapshotResponse.StatusCode -ge 300) {
        throw "Daily calendar snapshot returned HTTP $($snapshotResponse.StatusCode)."
      }
      $snapshot = $snapshotResponse.Content | ConvertFrom-Json
      if ($snapshot.persisted -ne $true) { throw 'Daily calendar snapshot did not confirm persistence.' }
      $expectedSnapshotEnd = [DateTime]::ParseExact($snapshotDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture).AddDays(59).ToString('yyyy-MM-dd')
      if ($snapshot.window.start -ne $snapshotDate -or [int]$snapshot.window.days -ne 60 -or $snapshot.window.end -ne $expectedSnapshotEnd) {
        throw 'Daily calendar snapshot did not confirm the requested 60-day window.'
      }
      $eventCount = @($snapshot.events).Count
      $sourceCount = $snapshot.sourceStatus.attempted
      "60-day calendar refreshed (HTTP $($snapshotResponse.StatusCode)): $eventCount events from $sourceCount configured sources." | Out-File -LiteralPath $logPath -Append -Encoding utf8
    }
  } finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
} catch {
  $_ | Out-String | Out-File -LiteralPath $logPath -Append -Encoding utf8
  $collectorExitCode = 1
}

exit $collectorExitCode
