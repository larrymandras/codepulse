# run-studio-watch.ps1
# The wrapper the StudioWatch scheduled task actually invokes (Phase 118, D-04).
#
# WHY THIS EXISTS AT ALL: the task launches through wscript.exe + run-hidden.vbs, which is a
# GUI-subsystem process with NO console, so the watcher's stdout is swallowed entirely. This
# log file is the ONLY durable evidence that an unattended run happened and what it did.
#
# LastTaskResult IS NOT EVIDENCE THE TASK RAN. It reports an exit code IF the action executed.
# It cannot distinguish "never fired" from "fired and succeeded", and it does NOT reflect a
# battery-gated no-op at all -- DisallowStartIfOnBatteries silently skips the whole action with
# no error and no log entry (that default cost ClaudeConfigPull 5+ weeks of never running).
# So: a MISSING line in this log is the failure signal, not a non-zero LastTaskResult.
#
# The log lives OUTSIDE the repo (in media-vault\, alongside the vault it serves), matching the
# run-workspace-scan.ps1 precedent, so no .gitignore entry can be forgotten and a log line can
# never be committed to this PUBLIC repo. It is excluded from the G:\ mirror by
# install-media-vault-backup-task.ps1 (/XF studio-watch.log): it is a host-local operational
# file, not media.
#
# ASCII-only, UTF-8 without BOM (PS 5.1 parses a UTF-8 em-dash as a curly quote -> "missing
# terminator").

param(
  [string]$RepoRoot = 'C:\Users\mandr\codepulse',
  [string]$LogPath  = 'C:\Users\mandr\media-vault\studio-watch.log'
)

$ErrorActionPreference = 'Stop'

# Exit-code meanings, read from hooks/studioWatch.mjs's OWN table (its main() docstring, and
# confirmed against every exitImpl() call site: there are exactly three, two of them 2 and one
# 0). 118-09-PLAN.md's prose named four codes -- "0 ok / 2 configuration / 3 transport / 4
# refusal" -- but 3 and 4 do not exist in the code; the plan's text is a draft and the code
# wins. A thumbnail refusal or a transport failure is counted in the cycle totals and still
# exits 0, by design. An unrecognised code (including node's own 1 for an uncaught throw) is
# logged as UNKNOWN rather than guessed at.
$ExitMeanings = @{
  0 = 'success (cycle complete)'
  2 = 'configuration error (STUDIO_API_KEY missing, or a 401 mid-run)'
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
  # This runs every 5 minutes, not nightly, so an unbounded log is a real problem here rather
  # than a small one. Rotate at ~1 MB, keeping one generation.
  if ((Get-Item $LogPath).Length -gt 1MB) {
    Move-Item -Path $LogPath -Destination ($LogPath + '.1') -Force
  }
}

# --- preconditions -----------------------------------------------------------------------
# Never silently run node from the wrong directory: a wrong CWD would scan nothing and could
# still exit 0, which is exactly the shape of a green result that measured nothing.
$watcherPath = Join-Path $RepoRoot 'hooks\studioWatch.mjs'
if (-not (Test-Path $RepoRoot)) {
  Write-Log ("{0} EXIT=2 {1} - RepoRoot not found: {2}" -f (Get-Stamp), $ExitMeanings[2], $RepoRoot)
  exit 2
}
if (-not (Test-Path $watcherPath)) {
  Write-Log ("{0} EXIT=2 {1} - watcher not found: {2}" -f (Get-Stamp), $ExitMeanings[2], $watcherPath)
  exit 2
}

Set-Location $RepoRoot
Write-Log ("{0} START RepoRoot={1}" -f (Get-Stamp), $RepoRoot)

# --- run ----------------------------------------------------------------------------------
# Wrapped in cmd /c so native stderr is captured WITHOUT tripping $ErrorActionPreference='Stop'
# -- redirecting a native command's stderr directly turns its first progress line into a
# terminating error under PS 5.1.
$output = cmd /c "node hooks\studioWatch.mjs 2>&1"
$code = $LASTEXITCODE

$meaning = if ($ExitMeanings.ContainsKey($code)) { $ExitMeanings[$code] } else { 'UNKNOWN' }
Write-Log ("{0} EXIT={1} {2}" -f (Get-Stamp), $code, $meaning)

# --- bounded, secret-filtered output tail ---------------------------------------------------
# At most the final 5 lines, and never a line containing a bearer token. studioWatch.mjs is
# written never to print STUDIO_API_KEY or an Authorization header value (T-118-04), so this
# filter is the second layer rather than the only one -- which is the point: a filter that
# only works because the thing upstream also works is not a filter.
if ($output) {
  $lines = @($output) | Where-Object { $_ -notmatch 'Bearer' }
  $tail = $lines | Select-Object -Last 5
  foreach ($line in $tail) { Write-Log ("    | " + $line) }
}

# Propagate, so run-hidden.vbs propagates it and LastTaskResult reflects a real failure IF the
# task actually ran.
exit $code
