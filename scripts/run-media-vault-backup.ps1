# run-media-vault-backup.ps1
# The wrapper the MediaVaultBackup scheduled task actually invokes (Phase 118, D-14).
#
# WHY THIS EXISTS AT ALL: 118-09-PLAN.md's file list named only the installer, but its own
# action text requires three behaviours that cannot live in a raw robocopy command line --
# appending to backup.log, translating robocopy's BITMASK exit codes, and not redirecting
# native stderr under a strict error preference. The repo's established shape for exactly that
# is an installer + wrapper pair (install-workspace-scan-task.ps1 / run-workspace-scan.ps1), so
# this file mirrors the wrapper half. See 118-09-SUMMARY.md "Deviations".
#
# LastTaskResult IS NOT EVIDENCE THE TASK RAN -- it cannot distinguish "never fired" from
# "fired and succeeded", and it does not reflect a battery-gated no-op at all. A MISSING dated
# line in backup.log is the failure signal.
#
# ROBOCOPY EXIT CODES ARE A BITMASK AND 0-7 ARE ALL SUCCESS:
#     0  no files copied, source and destination already in sync
#     1  one or more files copied
#     2  extra files/dirs found in the destination (under /MIR these are the ones deleted)
#     4  mismatched files/dirs found
#     8  some files/dirs could NOT be copied (retry limit exceeded)   <-- failure
#    16  serious error, robocopy did not copy anything                <-- failure
# The codes add: 3 = copied + extras, 5 = copied + mismatch, 7 = 1+2+4, and so on. So a routine
# successful nightly mirror that deleted a trashed file returns 3. Treating "non-zero" as a
# failure would therefore report EVERY successful run as an error and train the operator to
# ignore this log -- which is the only durable evidence the task works. This wrapper exits 0 for
# 0-7 and propagates the raw code for 8 and above.
#
# ASCII-only, UTF-8 without BOM (PS 5.1 parses a UTF-8 em-dash as a curly quote).

param(
  [string]$Source  = 'C:\Users\mandr\media-vault',
  [string]$Dest    = 'G:\My Drive\media-vault',
  [string]$LogPath = 'C:\Users\mandr\media-vault\backup.log',
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

# The mirror carries MEDIA. These three are host-local operational files that happen to sit in
# the vault directory, and D-14 excludes backup.log by name; studio-watch.log and the watcher's
# hash cache are the same category and would otherwise churn the mirror every 5 minutes. The
# rotated .1 generations are listed explicitly because /XF matches names, not prefixes.
$ExcludedFiles = @(
  'backup.log', 'backup.log.1',
  'studio-watch.log', 'studio-watch.log.1',
  '.studio-watch-state.json'
)

function Get-Stamp { (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK') }

# The whole point of the bitmask comment above, as one testable function.
function Test-RobocopySuccess {
  param([int]$Code)
  return ($Code -ge 0 -and $Code -lt 8)
}

function Get-RobocopyMeaning {
  param([int]$Code)
  if ($Code -ge 16) { return 'FAILURE: serious error, nothing was copied' }
  if ($Code -ge 8)  { return 'FAILURE: some files could not be copied (retry limit exceeded)' }
  $parts = @()
  if ($Code -band 1) { $parts += 'files copied' }
  if ($Code -band 2) { $parts += 'extra files removed from destination' }
  if ($Code -band 4) { $parts += 'mismatched files' }
  if ($parts.Count -eq 0) { return 'success: already in sync, nothing to do' }
  return ('success: ' + ($parts -join ', '))
}

# --- self-test ------------------------------------------------------------------------------
# Registers nothing, copies nothing, needs no elevation. Invoked by the installer's own
# -SelfTest as well as directly.
if ($SelfTest) {
  Write-Host "WRAPPER SELF-TEST (copies nothing)" -ForegroundColor Cyan
  $failures = 0

  Write-Host ""
  Write-Host "(w1) robocopy codes 0-7 must classify as SUCCESS, 8 and above as FAILURE"
  foreach ($c in 0..7) {
    if (-not (Test-RobocopySuccess -Code $c)) {
      Write-Host ("    FAIL code {0} classified as failure: {1}" -f $c, (Get-RobocopyMeaning $c)) -ForegroundColor Red
      $failures++
    }
  }
  foreach ($c in @(8, 9, 15, 16)) {
    if (Test-RobocopySuccess -Code $c) {
      Write-Host ("    FAIL code {0} classified as success" -f $c) -ForegroundColor Red
      $failures++
    }
  }
  if ($failures -eq 0) {
    Write-Host ("    PASS 0-7 success (e.g. 3 = {0}), 8/16 failure (8 = {1})" -f `
      (Get-RobocopyMeaning 3), (Get-RobocopyMeaning 8))
  }

  Write-Host ""
  Write-Host "     CONTROL: the naive 'any non-zero is a failure' rule must DISAGREE with this"
  Write-Host "              classifier on a real successful code, or (w1) proves nothing."
  $naiveDisagrees = @(1..7 | Where-Object { (Test-RobocopySuccess -Code $_) -and ($_ -ne 0) })
  if ($naiveDisagrees.Count -gt 0) {
    Write-Host ("    PASS naive rule would misreport {0} successful code(s) as errors: {1}" -f `
      $naiveDisagrees.Count, ($naiveDisagrees -join ', '))
  } else {
    Write-Host "    FAIL classifier agrees with the naive rule everywhere - it is not doing anything" -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "(w2) backup.log must be excluded from the mirror (D-14), and so must the two"
  Write-Host "     host-local watcher files"
  foreach ($f in @('backup.log', 'studio-watch.log', '.studio-watch-state.json')) {
    if ($ExcludedFiles -contains $f) {
      Write-Host ("    PASS {0} is excluded" -f $f)
    } else {
      Write-Host ("    FAIL {0} is NOT excluded" -f $f) -ForegroundColor Red
      $failures++
    }
  }

  Write-Host ""
  Write-Host "     CONTROL: a real media filename must NOT be excluded, or (w2) would pass on a"
  Write-Host "              list that excluded everything."
  if ($ExcludedFiles -notcontains 'render-001.png') {
    Write-Host "    PASS a media file is not excluded"
  } else {
    Write-Host "    FAIL the exclusion list swallows media" -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  if ($failures -eq 0) { Write-Host "WRAPPER SELF-TEST PASSED" -ForegroundColor Green; exit 0 }
  Write-Host ("WRAPPER SELF-TEST FAILED ({0})" -f $failures) -ForegroundColor Red
  exit 1
}

function Write-Log {
  param([string]$Line)
  # Append-only, ascii so grep and human eyes agree (Add-Content otherwise defaults to the
  # system ANSI codepage).
  Add-Content -Path $LogPath -Value $Line -Encoding ascii
}

# --- log directory + rotation ------------------------------------------------------------
$logDir = Split-Path -Parent $LogPath
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

if (Test-Path $LogPath) {
  if ((Get-Item $LogPath).Length -gt 1MB) {
    Move-Item -Path $LogPath -Destination ($LogPath + '.1') -Force
  }
}

# --- preconditions -------------------------------------------------------------------------
# /MIR makes the destination match the source, which means every precondition here is a
# data-loss guard rather than a convenience. T-118-09 accepts deletion propagation BECAUSE
# trash\ gives a real deletion a 30-day local grace first -- it does not accept propagating a
# source that is missing or empty for an unrelated reason (a wrong path, an unmounted volume, a
# half-finished move). Robocopy would happily mirror an empty directory over the only copy of
# the originals.
if (-not (Test-Path $Source)) {
  Write-Log ("{0} EXIT=2 REFUSED - source not found: {1}" -f (Get-Stamp), $Source)
  exit 2
}
$sourceFiles = @(Get-ChildItem -Path $Source -Recurse -File -Force -ErrorAction SilentlyContinue |
                 Where-Object { $ExcludedFiles -notcontains $_.Name })
if ($sourceFiles.Count -eq 0) {
  Write-Log ("{0} EXIT=2 REFUSED - source holds zero mirrorable files; /MIR would empty the destination: {1}" -f (Get-Stamp), $Source)
  exit 2
}

# The destination's PARENT must already exist. Google Drive File Stream owns the 'G:\My Drive'
# name; if the volume is not mounted, creating that folder locally would silently write the
# whole vault to a directory Drive will never sync, and the operator would believe there was a
# backup. Robocopy creates the leaf (media-vault) itself, which is correct.
$destParent = Split-Path -Parent $Dest
if (-not (Test-Path $destParent)) {
  Write-Log ("{0} EXIT=2 REFUSED - destination root not reachable (Drive not mounted?): {1}" -f (Get-Stamp), $destParent)
  exit 2
}

Write-Log ("{0} START {1} -> {2} ({3} mirrorable file(s) at source)" -f `
  (Get-Stamp), $Source, $Dest, $sourceFiles.Count)

# --- run ------------------------------------------------------------------------------------
# D-14's command, verbatim apart from the exclusions and /NP (progress percentages are
# meaningless in a log file and would flood it). Wrapped in cmd /c so native stderr is captured
# WITHOUT tripping $ErrorActionPreference='Stop' -- redirecting a native command's stderr
# directly turns its first progress line into a terminating error under PS 5.1.
$xf = ($ExcludedFiles | ForEach-Object { '"' + $_ + '"' }) -join ' '
$cmdLine = 'robocopy "' + $Source + '" "' + $Dest + '" /MIR /R:2 /W:5 /NP /XF ' + $xf + ' 2>&1'
$output = cmd /c $cmdLine
$code = $LASTEXITCODE

$meaning = Get-RobocopyMeaning -Code $code
Write-Log ("{0} ROBOCOPY={1} {2}" -f (Get-Stamp), $code, $meaning)

# Bounded tail: robocopy's closing summary table is the part worth keeping. The Bearer filter
# is carried over from the watcher wrapper -- robocopy never prints a token, and that is
# exactly why it costs nothing to keep the same rule everywhere.
if ($output) {
  $lines = @($output) | Where-Object { $_ -notmatch 'Bearer' } | Where-Object { $_.Trim() -ne '' }
  $tail = $lines | Select-Object -Last 12
  foreach ($line in $tail) { Write-Log ("    | " + $line) }
}

if (Test-RobocopySuccess -Code $code) {
  Write-Log ("{0} EXIT=0 (robocopy {1} is a success code)" -f (Get-Stamp), $code)
  exit 0
}
Write-Log ("{0} EXIT={1} FAILED" -f (Get-Stamp), $code)
exit $code
