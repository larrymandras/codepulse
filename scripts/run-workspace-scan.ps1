# run-workspace-scan.ps1
# The wrapper the CodePulse-WorkspaceScan scheduled task actually invokes (Phase 115, D-05).
#
# WHY THIS EXISTS AT ALL: the task launches through wscript.exe + run-hidden.vbs, which is a
# GUI-subsystem process with NO console, so the scanner's stdout is swallowed entirely. This
# log file is the ONLY durable evidence that an unattended run happened and what it did.
#
# LastTaskResult IS NOT EVIDENCE THE TASK RAN. It reports an exit code IF the action executed.
# It cannot distinguish "never fired" from "fired and succeeded", and it does NOT reflect a
# battery-gated no-op at all -- DisallowStartIfOnBatteries silently skips the whole action with
# no error and no log entry (that default cost ClaudeConfigPull 5+ weeks of never running).
# So: a MISSING line in this log is the failure signal, not a non-zero LastTaskResult.
#
# The log lives OUTSIDE the repo, matching the ~/.forge/codepulse-autostart.log precedent, so
# no .gitignore entry can be forgotten and a log line can never be committed to this PUBLIC repo.
#
# ASCII-only, UTF-8 without BOM (PS 5.1 parses a UTF-8 em-dash as a curly quote -> "missing
# terminator").

param(
  [string]$RepoRoot = 'C:\Users\mandr\codepulse',
  [string]$LogPath  = 'C:\Users\mandr\.forge\codepulse-workspace-scan.log'
)

$ErrorActionPreference = 'Stop'

# Exit-code meanings, taken from hooks/workspaceScan.mjs's own table. An unrecognised code is
# logged as UNKNOWN rather than guessed at.
$ExitMeanings = @{
  0 = 'success (ingested)'
  2 = 'config/usage error'
  3 = 'D-12 refusal (report unapproved or approval stale)'
  4 = 'POST failed (unreachable backend or non-2xx)'
  5 = 'unexpected throw'
}

function Get-Stamp { (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK') }

function Write-Log {
  param([string]$Line)
  # Append-only. -Encoding ascii is deliberate: this file is read by humans and by grep, and
  # Set-Content/Add-Content otherwise default to the system ANSI codepage.
  Add-Content -Path $LogPath -Value $Line -Encoding ascii
}

# --- log directory + rotation ------------------------------------------------------------
$logDir = Split-Path -Parent $LogPath
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

if (Test-Path $LogPath) {
  # An unbounded nightly log is its own small problem. Rotate at ~1 MB, keeping one generation.
  if ((Get-Item $LogPath).Length -gt 1MB) {
    Move-Item -Path $LogPath -Destination ($LogPath + '.1') -Force
  }
}

# --- preconditions -----------------------------------------------------------------------
# Never silently run node from the wrong directory: a wrong CWD would scan nothing and could
# still exit 0, which is exactly the shape of a green result that measured nothing.
$scannerPath = Join-Path $RepoRoot 'hooks\workspaceScan.mjs'
if (-not (Test-Path $RepoRoot)) {
  Write-Log ("{0} EXIT=2 {1} - RepoRoot not found: {2}" -f (Get-Stamp), $ExitMeanings[2], $RepoRoot)
  exit 2
}
if (-not (Test-Path $scannerPath)) {
  Write-Log ("{0} EXIT=2 {1} - scanner not found: {2}" -f (Get-Stamp), $ExitMeanings[2], $scannerPath)
  exit 2
}

Set-Location $RepoRoot
Write-Log ("{0} START RepoRoot={1}" -f (Get-Stamp), $RepoRoot)

# --- run ----------------------------------------------------------------------------------
# Wrapped in cmd /c so native stderr is captured WITHOUT tripping $ErrorActionPreference='Stop'
# -- redirecting a native command's stderr directly turns its first progress line into a
# terminating error under PS 5.1.
$output = cmd /c "node hooks\workspaceScan.mjs 2>&1"
$code = $LASTEXITCODE

$meaning = if ($ExitMeanings.ContainsKey($code)) { $ExitMeanings[$code] } else { 'UNKNOWN' }
Write-Log ("{0} EXIT={1} {2}" -f (Get-Stamp), $code, $meaning)

# --- bounded, secret-filtered output tail ---------------------------------------------------
# At most the final 5 lines, and never a line containing a bearer token. The dry-run summary can
# carry directory paths, so there is no reason to accumulate the whole thing in a file.
if ($output) {
  $lines = @($output) | Where-Object { $_ -notmatch 'Bearer' }
  $tail = $lines | Select-Object -Last 5
  foreach ($line in $tail) { Write-Log ("    | " + $line) }
}

# Propagate, so run-hidden.vbs propagates it and LastTaskResult reflects a real failure IF the
# task actually ran.
exit $code
