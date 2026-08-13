# install-workspace-scan-task.ps1
# Registers CodePulse-WorkspaceScan: the nightly workspace scanner (Phase 115, D-05).
#
# BEFORE RETIRING THIS TASK, grep EVERY automation root for the string
# 'CodePulse-WorkspaceScan' -- C:\Users\mandr\scripts, C:\Users\mandr\convex-selfhost, and any
# other repo's watchdogs -- not just the scheduled-task list. A prior retirement on this machine
# verified no tasks of a given name remained but missed a watchdog calling it by name via
# Start-ScheduledTask; that watchdog then alerted every 30 minutes for three days.
#
# WHY ELEVATED: the task uses LogonType S4U so it runs whether or not Larry is signed in.
# Registering an S4U principal requires administrator rights.
#
# Run from an elevated PowerShell (right-click -> Run as administrator):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-workspace-scan-task.ps1
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

$TaskName    = 'CodePulse-WorkspaceScan'
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$WrapperPath = Join-Path $RepoRoot 'scripts\run-workspace-scan.ps1'
$ScannerPath = Join-Path $RepoRoot 'hooks\workspaceScan.mjs'
$LogPath     = 'C:\Users\mandr\.forge\codepulse-workspace-scan.log'
# 04:15 local, chosen against this machine's ACTUAL neighbours rather than against the Convex
# cron list in UTC. ConvexBackup runs 03:00 and ConvexBackupFull 03:30 (both I/O-heavy against a
# single-node SQLite backend); the retention-prune cron is 09:00 UTC = 05:00 local and
# ConvexRetentionHealthCheck is 05:30. 04:15 is ~45 minutes clear on both sides. The wider
# rationale matters: an earlier draft specified 03:15 "to avoid the 04:00 and 04:30 UTC Convex
# crons", which compared a LOCAL trigger against UTC cron times and would have landed the scan
# squarely between the two backups.
$TriggerTime = '04:15'

function Test-Prereq {
  param([string]$Path, [string]$What)
  if (-not (Test-Path $Path)) {
    Write-Host ("REFUSING: missing {0}: {1}" -f $What, $Path) -ForegroundColor Red
    return $false
  }
  return $true
}

# --- self-test ------------------------------------------------------------------------------
# Runs BEFORE the elevation gate on purpose: it registers nothing, so requiring administrator
# rights to prove the guards refuse would make the proof harder to run than the thing it guards.
if ($SelfTest) {
  Write-Host "SELF-TEST (registers nothing)" -ForegroundColor Cyan
  $failures = 0

  Write-Host ""
  Write-Host "(a) wrapper with a bogus -RepoRoot must exit non-zero AND write a log line"
  $tmpLog = Join-Path $env:TEMP ('ws-selftest-{0}.log' -f [guid]::NewGuid().ToString('N'))
  & powershell -NoProfile -ExecutionPolicy Bypass -File $WrapperPath `
      -RepoRoot 'C:\definitely-not-a-real-repo-9x7q2' -LogPath $tmpLog | Out-Null
  $wrapperCode = $LASTEXITCODE
  # @() must wrap the ASSIGNMENT, not the value inside the if-block. Get-Content returns a bare
  # string for a single-line file, and `$x = if (...) { @(...) }` UNROLLS a one-element array
  # back to that scalar - after which .Count still reports 1 (PowerShell's ETS gives every
  # object a .Count), so the guard passes while [0] silently yields the first CHARACTER. That
  # is how this printed "logged: 2" for a line beginning "2026-08-13...".
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
  Write-Host "(b) prerequisite check must refuse a nonexistent run-hidden.vbs"
  if (-not (Test-Prereq -Path 'C:\definitely-not-a-real-vbs-9x7q2.vbs' -What 'run-hidden.vbs')) {
    Write-Host "    PASS refused as expected"
  } else {
    Write-Host "    FAIL accepted a path that does not exist" -ForegroundColor Red
    $failures++
  }

  Write-Host ""
  Write-Host "    CONTROL: the same check must ACCEPT the real run-hidden.vbs, or (b) would"
  Write-Host "             pass even if Test-Prereq always refused."
  if (Test-Prereq -Path $HiddenVbs -What 'run-hidden.vbs') {
    Write-Host "    PASS accepted the real path"
  } else {
    Write-Host "    FAIL could not find the real run-hidden.vbs" -ForegroundColor Red
    $failures++
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
  Write-Host "This removes ONLY the task. It does not touch the scripts, the log, the config,"
  Write-Host "the approval marker, or any stored snapshot."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host ("Unregistered {0}" -f $TaskName) -ForegroundColor Green
  exit 0
}

# --- preconditions --------------------------------------------------------------------------
$ok = $true
if (-not (Test-Prereq -Path $HiddenVbs   -What 'run-hidden.vbs'))          { $ok = $false }
if (-not (Test-Prereq -Path $WrapperPath -What 'run-workspace-scan.ps1'))  { $ok = $false }
if (-not (Test-Prereq -Path $ScannerPath -What 'hooks\workspaceScan.mjs')) { $ok = $false }
$nodeOut = cmd /c "node --version 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host ("REFUSING: node did not resolve: {0}" -f $nodeOut) -ForegroundColor Red
  $ok = $false
} else {
  Write-Host ("node {0}" -f $nodeOut)
}
if (-not $ok) { exit 1 }

# --- register -------------------------------------------------------------------------------
# wscript.exe + run-hidden.vbs, NEVER powershell's hidden-window switch. (That switch is named
# literally nowhere in this file on purpose: the acceptance check for this script greps for it and
# must be able to tell "uses the forbidden launcher" from "mentions it in a comment".)
# Its post-creation hide is ignored when Windows Terminal is the default terminal: a
# persistent black window appears, and
# closing it console-kills the task's entire process tree. That was the cause of both the
# "cmd windows that never close" and the CodePulse supervisor's phantom-Ctrl+C deaths. wscript is
# GUI-subsystem, so no console is ever created, and run-hidden.vbs propagates the child's exit code.
# The full WindowsPowerShell\v1.0 path is deliberate: do not rely on PATH under an S4U logon.
$argStr = '//B //Nologo "' + $HiddenVbs + '" C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe ' +
          '-NoProfile -ExecutionPolicy Bypass -File "' + $WrapperPath + '"'

$action    = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument $argStr
$trigger   = New-ScheduledTaskTrigger -Daily -At $TriggerTime
$principal = New-ScheduledTaskPrincipal -UserId 'mandr' -LogonType S4U -RunLevel Limited

# AllowStartIfOnBatteries / DontStopIfGoingOnBatteries are MANDATORY, and this comment is
# load-bearing documentation rather than decoration -- it is what should stop a future editor
# tidying these flags away. New-ScheduledTaskSettingsSet defaults DisallowStartIfOnBatteries to
# $true, which SILENTLY NO-OPS THE ENTIRE ACTION whenever Windows reports battery power: no
# error, no log entry, and LastTaskResult/LastRunTime do not reliably reflect it. On this machine
# ClaudeConfigPull went 5+ weeks without a single real run from exactly this default. It also
# contradicts -WakeToRun, which is set here precisely because the task must fire regardless of
# machine state.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
              -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew

$desc = 'Nightly CodePulse workspace scanner (Phase 115, D-05) - walks declared roots, POSTs a ' +
        'versioned snapshot. Log: ' + $LogPath
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
    @{ Name = 'launches via wscript.exe';          Ok = ($t.Actions[0].Execute -like '*wscript.exe') },
    @{ Name = 'launches via run-hidden.vbs';       Ok = ($t.Actions[0].Arguments -like '*run-hidden.vbs*') },
    @{ Name = 'DisallowStartIfOnBatteries = false';Ok = ($t.Settings.DisallowStartIfOnBatteries -eq $false) },
    @{ Name = 'StopIfGoingOnBatteries = false';    Ok = ($t.Settings.StopIfGoingOnBatteries -eq $false) },
    @{ Name = ("trigger contains {0}" -f $TriggerTime); Ok = ($t.Triggers[0].StartBoundary -like ("*T{0}:00*" -f $TriggerTime)) },
    @{ Name = 'LogonType = S4U';                   Ok = ($t.Principal.LogonType -eq 'S4U') }
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
Write-Host ("The evidence is a dated line in {0}." -f $LogPath)

Write-Host ""
Write-Host "TWO THINGS FOR YOU:" -ForegroundColor Cyan
Write-Host "  1. Open taskschd.msc, find CodePulse-WorkspaceScan, and on the Conditions tab"
Write-Host "     confirm 'Start the task only if the computer is on AC power' is UNCHECKED."
Write-Host "     (That checkbox is DisallowStartIfOnBatteries. If it is checked, the task will"
Write-Host "     silently never run on any night the laptop is unplugged.) Then use Run to"
Write-Host "     trigger it once: NO window should appear at all, and a new line should land in"
Write-Host ("     {0}." -f $LogPath)
Write-Host ("  2. Tomorrow morning, check that log for a line timestamped near {0} that you did" -f $TriggerTime)
Write-Host "     NOT trigger. A manual Run proves the action works; only that line proves the"
Write-Host "     SCHEDULER fires it. That check is what closes D-05."
Write-Host ""
Write-Host ("To undo: powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Remove" -f $PSCommandPath)
