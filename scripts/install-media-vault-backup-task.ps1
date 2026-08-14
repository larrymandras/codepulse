# install-media-vault-backup-task.ps1
# Registers MediaVaultBackup: the nightly media-vault mirror to Google Drive (Phase 118, D-14).
#
# BEFORE RETIRING THIS TASK, grep EVERY automation root for the string 'MediaVaultBackup' --
# C:\Users\mandr\scripts, C:\Users\mandr\convex-selfhost, and any other repo's watchdogs -- not
# just the scheduled-task list. A prior retirement on this machine verified no tasks of a given
# name remained but missed a watchdog calling it by name via Start-ScheduledTask; that watchdog
# then alerted every 30 minutes for three days.
#
# WHY ELEVATED: the task uses LogonType S4U so it runs whether or not Larry is signed in.
# Registering an S4U principal requires administrator rights.
#
# Run from an elevated PowerShell (right-click -> Run as administrator):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-media-vault-backup-task.ps1
#
# The self-test registers NOTHING, copies NOTHING, and needs no elevation:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-media-vault-backup-task.ps1 -SelfTest
#
# ASCII-only, UTF-8 without BOM (PS 5.1 parses a UTF-8 em-dash as a curly quote).

param(
  [switch]$Remove,
  [switch]$SelfTest,
  # Injectable ONLY so -SelfTest can prove the prerequisite check actually refuses. Every real
  # invocation leaves this at the default. A guard that has never been shown to refuse is not a
  # guard.
  [string]$HiddenVbs = 'C:\Users\mandr\scripts\run-hidden.vbs'
)

$ErrorActionPreference = 'Stop'

$TaskName    = 'MediaVaultBackup'
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$WrapperPath = Join-Path $RepoRoot 'scripts\run-media-vault-backup.ps1'
$VaultRoot   = 'C:\Users\mandr\media-vault'
$MirrorRoot  = 'G:\My Drive\media-vault'
$LogPath     = 'C:\Users\mandr\media-vault\backup.log'
# 06:30 LOCAL, chosen against this machine's ACTUAL neighbours read back from Get-ScheduledTask,
# comparing LOCAL against LOCAL. An earlier script on this machine nearly landed between two
# backups by comparing a local trigger against UTC cron times, so the conversions are spelled
# out: ConvexNightlyRestart 02:00, ConvexBackup 03:00 (ConvexBackupFull is also 03:00 and is
# currently Disabled -- the plan brief's "03:30" is stale), CodePulse-WorkspaceScan 04:15 with a
# 30-minute limit so it can run to 04:45, the Convex retention-prune cron at 09:00 UTC = 05:00
# local, ConvexRetentionHealthCheck 05:30, ConvexRetentionRootCause 05:45, and
# CodePulse-WorkspaceScan-D05Check 08:00. 06:30 is 45 minutes clear after 05:45 and 90 minutes
# before 08:00. StudioWatch's 5-minute cadence necessarily overlaps whatever time is chosen;
# that is inherent to D-04 and its per-cycle work is small.
$TriggerTime = '06:30'

function Test-Prereq {
  param([string]$Path, [string]$What)
  if (-not (Test-Path $Path)) {
    Write-Host ("REFUSING: missing {0}: {1}" -f $What, $Path) -ForegroundColor Red
    return $false
  }
  return $true
}

# Single source of truth for the two battery flags, so a future editor cannot change them in one
# code path and leave the self-test asserting another. New-ScheduledTaskSettingsSet defaults
# DisallowStartIfOnBatteries to $true, which SILENTLY NO-OPS THE ENTIRE ACTION whenever Windows
# reports battery power: no error, no log entry, and LastTaskResult/LastRunTime do not reliably
# reflect it. On this machine ClaudeConfigPull went 5+ weeks without a single real run from
# exactly that default. It also contradicts -WakeToRun, which is set here precisely because the
# task must fire regardless of machine state.
#
# ExecutionTimeLimit is 4 hours rather than the workspace-scan donor's 30 minutes: the first run
# seeds an entire media vault across Google Drive File Stream, which is network-bound and can be
# far slower than any local job. Later runs are incremental and finish in seconds.
function New-MediaVaultBackupSettings {
  New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
}

# --- self-test ------------------------------------------------------------------------------
# Runs BEFORE the elevation gate on purpose: it registers nothing, so requiring administrator
# rights to prove the guards refuse would make the proof harder to run than the thing it guards.
if ($SelfTest) {
  Write-Host "SELF-TEST (registers nothing, copies nothing)" -ForegroundColor Cyan
  $failures = 0

  Write-Host ""
  Write-Host "(a) the wrapper's own self-test (robocopy bitmask + exclusion list) must pass"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $WrapperPath -SelfTest
  if ($LASTEXITCODE -eq 0) {
    Write-Host "    PASS wrapper self-test exited 0"
  } else {
    Write-Host ("    FAIL wrapper self-test exited {0}" -f $LASTEXITCODE) -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "(b) wrapper with a bogus -Source must REFUSE (non-zero) AND write a log line -"
  Write-Host "    an unreachable source must never be mirrored over the real backup"
  $tmpLog = Join-Path $env:TEMP ('mvbackup-selftest-{0}.log' -f [guid]::NewGuid().ToString('N'))
  & powershell -NoProfile -ExecutionPolicy Bypass -File $WrapperPath `
      -Source 'C:\definitely-not-a-real-vault-9x7q2' -Dest 'C:\definitely-not-a-real-dest-9x7q2' `
      -LogPath $tmpLog | Out-Null
  $wrapperCode = $LASTEXITCODE
  # @() must wrap the ASSIGNMENT, not the value inside the if-block: Get-Content returns a bare
  # string for a single-line file, `$x = if (...) { @(...) }` unrolls the one-element array back
  # to that scalar, and .Count still reports 1 (ETS) while [0] yields the first CHARACTER.
  $logLines = @(if (Test-Path $tmpLog) { Get-Content $tmpLog })
  $wroteLine = $logLines.Count -gt 0
  if ($wrapperCode -ne 0 -and $wroteLine) {
    Write-Host ("    PASS refused with exit {0} and logged: {1}" -f $wrapperCode, $logLines[0])
  } else {
    Write-Host ("    FAIL exit={0} wroteLogLine={1}" -f $wrapperCode, $wroteLine) -ForegroundColor Red
    $failures++
  }
  if (Test-Path $tmpLog) { Remove-Item $tmpLog -Force }

  Write-Host ""
  Write-Host "    CONTROL: the SAME invocation against the real source must NOT refuse at the"
  Write-Host "             source check, or (b) would pass even if the wrapper refused always."
  Write-Host "             Destination is a bogus path so nothing is ever copied - the wrapper"
  Write-Host "             must get PAST the source check and refuse at the destination check."
  $tmpLog2 = Join-Path $env:TEMP ('mvbackup-selftest-{0}.log' -f [guid]::NewGuid().ToString('N'))
  & powershell -NoProfile -ExecutionPolicy Bypass -File $WrapperPath `
      -Source $VaultRoot -Dest 'Q:\definitely-not-a-real-drive-9x7q2\media-vault' `
      -LogPath $tmpLog2 | Out-Null
  $ctlLines = @(if (Test-Path $tmpLog2) { Get-Content $tmpLog2 })
  $ctlLine = if ($ctlLines.Count -gt 0) { $ctlLines[0] } else { '' }
  if ($ctlLine -like '*destination root not reachable*') {
    Write-Host ("    PASS reached the destination check: {0}" -f $ctlLine)
  } else {
    Write-Host ("    FAIL expected a destination refusal, got: {0}" -f $ctlLine) -ForegroundColor Red
    $failures++
  }
  if (Test-Path $tmpLog2) { Remove-Item $tmpLog2 -Force }

  Write-Host ""
  Write-Host "(c) prerequisite check must refuse a nonexistent run-hidden.vbs"
  if (-not (Test-Prereq -Path 'C:\definitely-not-a-real-vbs-9x7q2.vbs' -What 'run-hidden.vbs')) {
    Write-Host "    PASS refused as expected"
  } else {
    Write-Host "    FAIL accepted a path that does not exist" -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "    CONTROL: the same check must ACCEPT the real run-hidden.vbs, or (c) would"
  Write-Host "             pass even if Test-Prereq always refused."
  if (Test-Prereq -Path $HiddenVbs -What 'run-hidden.vbs') {
    Write-Host "    PASS accepted the real path"
  } else {
    Write-Host "    FAIL could not find the real run-hidden.vbs" -ForegroundColor Red
    $failures++
  }

  # (d) is the guard whose failure mode is TOTAL SILENCE, so it is asserted before registration
  # rather than discovered five weeks later.
  Write-Host ""
  Write-Host "(d) the settings this script builds must have both battery guards cleared"
  $goodSettings = New-MediaVaultBackupSettings
  if ($goodSettings.DisallowStartIfOnBatteries -eq $false -and
      $goodSettings.StopIfGoingOnBatteries -eq $false) {
    Write-Host "    PASS DisallowStartIfOnBatteries=False StopIfGoingOnBatteries=False"
  } else {
    Write-Host ("    FAIL DisallowStartIfOnBatteries={0} StopIfGoingOnBatteries={1}" -f `
      $goodSettings.DisallowStartIfOnBatteries, $goodSettings.StopIfGoingOnBatteries) -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "    CONTROL: a settings object built WITHOUT those flags must FAIL the same check."
  Write-Host "             Without this, (d) would pass even if the check could never fail."
  $badSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable
  $badPasses = ($badSettings.DisallowStartIfOnBatteries -eq $false -and
                $badSettings.StopIfGoingOnBatteries -eq $false)
  if (-not $badPasses) {
    Write-Host ("    PASS control correctly FAILED the check (cmdlet default is " +
                ("DisallowStartIfOnBatteries={0} StopIfGoingOnBatteries={1}) -- that default is the hazard" -f `
                  $badSettings.DisallowStartIfOnBatteries, $badSettings.StopIfGoingOnBatteries))
  } else {
    Write-Host "    FAIL control PASSED - the check cannot detect a missing battery guard" -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "(e) destination reachability, recorded rather than assumed"
  $destParent = Split-Path -Parent $MirrorRoot
  if (Test-Path $destParent) {
    $mirrorState = if (Test-Path $MirrorRoot) { 'present' } else { 'absent (robocopy creates it on the first run)' }
    Write-Host ("    OK   {0} is reachable; {1} is {2}" -f $destParent, $MirrorRoot, $mirrorState)
  } else {
    Write-Host ("    NOTE {0} is NOT reachable right now. This is recorded, not ignored: the" -f $destParent) -ForegroundColor Yellow
    Write-Host "         wrapper refuses loudly with a logged line rather than mirroring into a"
    Write-Host "         local folder Drive would never sync. Registration is still valid."
  }

  Write-Host ""
  if ($failures -eq 0) { Write-Host "SELF-TEST PASSED" -ForegroundColor Green; exit 0 }
  Write-Host ("SELF-TEST FAILED ({0})" -f $failures) -ForegroundColor Red
  exit 1
}

# --- elevation check ------------------------------------------------------------------------
# MUST use the WindowsBuiltInRole enum, as below. Passing the role as a bare STRING instead
# returns False even in a genuinely elevated shell, which silently blocks the script -- and
# combined with self-elevation produces an infinite UAC-relaunch loop. This script therefore
# NEVER self-elevates; it prints the command and stops. (The string form is not written out
# anywhere in this file: the acceptance check greps for it and must be able to tell a real use
# from a warning about it.)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalCheck = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "NOT ELEVATED. Re-run this script as Administrator." -ForegroundColor Red
  Write-Host "Open an elevated PowerShell yourself and run:"
  Write-Host ("  powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $PSCommandPath)
  exit 1
}

# --- remove ---------------------------------------------------------------------------------
if ($Remove) {
  Write-Host ("About to unregister scheduled task: {0}" -f $TaskName) -ForegroundColor Yellow
  Write-Host "This removes ONLY the task. It does not touch the scripts, the log, the media"
  Write-Host "vault, or anything already mirrored to Google Drive."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host ("Unregistered {0}" -f $TaskName) -ForegroundColor Green
  exit 0
}

# --- preconditions --------------------------------------------------------------------------
$ok = $true
if (-not (Test-Prereq -Path $HiddenVbs   -What 'run-hidden.vbs'))              { $ok = $false }
if (-not (Test-Prereq -Path $WrapperPath -What 'run-media-vault-backup.ps1')) { $ok = $false }
if (-not (Test-Prereq -Path $VaultRoot   -What 'media-vault source'))          { $ok = $false }
$roboOut = cmd /c "robocopy /? > nul 2>&1 & echo probe"
if ($roboOut -notlike '*probe*') {
  Write-Host "REFUSING: robocopy did not resolve on PATH." -ForegroundColor Red
  $ok = $false
} else {
  Write-Host "robocopy resolved"
}
$destParent = Split-Path -Parent $MirrorRoot
if (-not (Test-Path $destParent)) {
  # Recorded, not fatal: Drive may simply not be mounted at install time. The wrapper refuses
  # loudly at run time rather than mirroring into a folder Drive would never sync.
  Write-Host ("NOTE: {0} is not reachable right now. Registering anyway; the wrapper will refuse" -f $destParent) -ForegroundColor Yellow
  Write-Host ("      and log a line in {0} on any run where it is still unreachable." -f $LogPath) -ForegroundColor Yellow
}
if (-not $ok) { exit 1 }

# --- register -------------------------------------------------------------------------------
# wscript.exe + run-hidden.vbs, NEVER powershell's hidden-window switch. (That switch is named
# literally nowhere in this file on purpose: the acceptance check for this script greps for it
# and must be able to tell "uses the forbidden launcher" from "mentions it in a comment".)
# Its post-creation hide is ignored when Windows Terminal is the default terminal: a persistent
# black window appears, and closing it console-kills the task's entire process tree. That was
# the cause of both the "cmd windows that never close" and the CodePulse supervisor's
# phantom-Ctrl+C deaths. wscript is GUI-subsystem, so no console is ever created, and
# run-hidden.vbs propagates the child's exit code.
# The full WindowsPowerShell\v1.0 path is deliberate: do not rely on PATH under an S4U logon.
$argStr = '//B //Nologo "' + $HiddenVbs + '" C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe ' +
          '-NoProfile -ExecutionPolicy Bypass -File "' + $WrapperPath + '"'

$action    = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument $argStr
$trigger   = New-ScheduledTaskTrigger -Daily -At $TriggerTime
$principal = New-ScheduledTaskPrincipal -UserId 'mandr' -LogonType S4U -RunLevel Limited
$settings  = New-MediaVaultBackupSettings

# The description is what an operator reads in taskschd.msc, so it names the actual command and
# the actual exclusions rather than pointing at a file they would have to go open.
$desc = 'Nightly media-vault mirror to Google Drive (Phase 118, D-14) - robocopy /MIR /R:2 /W:5, ' +
        'excluding backup.log, studio-watch.log and .studio-watch-state.json (host-local ' +
        'operational files, not media). Log: ' + $LogPath
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force -Description $desc | Out-Null

Write-Host ""
Write-Host ("Registered {0} (daily {1})" -f $TaskName, $TriggerTime) -ForegroundColor Green

# --- read-back verification, CONTROL FIRST --------------------------------------------------
# schtasks /query is already proven broken from the agent shell on this machine: it returns zero
# lines even for ConvexNightlyRestart, which is documented as deliberately installed.
# Get-ScheduledTask is a DIFFERENT code path (CIM/WMI, not the legacy console tool) and may or
# may not share that failure. So probe a KNOWN-PRESENT task first. Without this control, a "task
# not found" result is indistinguishable from "the read API does not work here", and either a
# false PASS or an unfounded FAIL would get written down.
Write-Host ""
Write-Host "Read-back verification (control first):"
$control = Get-ScheduledTask -TaskName 'ConvexNightlyRestart' -ErrorAction SilentlyContinue
if (-not $control) {
  Write-Host "CONTROL FAILED: Get-ScheduledTask cannot see the known-installed ConvexNightlyRestart task from this shell. Registration read-back is UNRELIABLE here - verify manually in taskschd.msc." -ForegroundColor Yellow
} else {
  Write-Host "    control OK: ConvexNightlyRestart is visible, so this API works here."
  $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $t) {
    Write-Host "    FAIL: task not found after register." -ForegroundColor Red
    exit 1
  }
  $checks = @(
    @{ Name = 'launches via wscript.exe';           Ok = ($t.Actions[0].Execute -like '*wscript.exe') },
    @{ Name = 'launches via run-hidden.vbs';        Ok = ($t.Actions[0].Arguments -like '*run-hidden.vbs*') },
    @{ Name = 'DisallowStartIfOnBatteries = false'; Ok = ($t.Settings.DisallowStartIfOnBatteries -eq $false) },
    @{ Name = 'StopIfGoingOnBatteries = false';     Ok = ($t.Settings.StopIfGoingOnBatteries -eq $false) },
    @{ Name = ("trigger contains {0}" -f $TriggerTime); Ok = ($t.Triggers[0].StartBoundary -like ("*T{0}:00*" -f $TriggerTime)) },
    @{ Name = 'LogonType = S4U';                    Ok = ($t.Principal.LogonType -eq 'S4U') }
  )
  foreach ($c in $checks) {
    if ($c.Ok) { Write-Host ("    PASS {0}" -f $c.Name) }
    else       { Write-Host ("    FAIL {0}" -f $c.Name) -ForegroundColor Red }
  }
}

# --- what LastTaskResult is and is not ------------------------------------------------------
Write-Host ""
Write-Host "NOTE on LastTaskResult: it reports an exit code IF the action ran. It CANNOT"
Write-Host "distinguish 'never fired' from 'fired and succeeded', and it does not reflect a"
Write-Host "battery-gated no-op at all. It is not evidence this task is installed or working."
Write-Host ("The evidence is a dated line in {0} plus mirrored content under {1}." -f $LogPath, $MirrorRoot)

Write-Host ""
Write-Host "THREE THINGS FOR YOU:" -ForegroundColor Cyan
Write-Host "  1. Open taskschd.msc, find MediaVaultBackup, and on the Conditions tab confirm"
Write-Host "     'Start the task only if the computer is on AC power' is UNCHECKED."
Write-Host "     (That checkbox is DisallowStartIfOnBatteries. If it is checked, the task will"
Write-Host "     silently never run on any night the laptop is unplugged.) Then use Run to"
Write-Host "     trigger it once: NO window should appear at all."
Write-Host ("  2. Confirm {0} now holds the vault's media, and that backup.log is NOT there" -f $MirrorRoot)
Write-Host "     (it is excluded by name - its presence in the mirror would mean the exclusion"
Write-Host "     silently stopped working)."
Write-Host ("  3. Tomorrow morning, check {0} for a line timestamped near {1} that you did" -f $LogPath, $TriggerTime)
Write-Host "     NOT trigger. A manual Run proves the action works; only that line proves the"
Write-Host "     SCHEDULER fires it. That check is what closes D-14."
Write-Host ""
Write-Host ("To undo: powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Remove" -f $PSCommandPath)
