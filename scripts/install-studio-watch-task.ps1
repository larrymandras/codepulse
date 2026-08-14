# install-studio-watch-task.ps1
# Registers StudioWatch: the Studio media-vault watcher, every 5 minutes (Phase 118, D-04).
#
# BEFORE RETIRING THIS TASK, grep EVERY automation root for the string 'StudioWatch' --
# C:\Users\mandr\scripts, C:\Users\mandr\convex-selfhost, and any other repo's watchdogs -- not
# just the scheduled-task list. A prior retirement on this machine verified no tasks of a given
# name remained but missed a watchdog calling it by name via Start-ScheduledTask; that watchdog
# then alerted every 30 minutes for three days.
#
# WHY ELEVATED: the task uses LogonType S4U so it runs whether or not Larry is signed in.
# Registering an S4U principal requires administrator rights.
#
# Run from an elevated PowerShell (right-click -> Run as administrator):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-studio-watch-task.ps1
#
# The self-test registers NOTHING and needs no elevation:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-studio-watch-task.ps1 -SelfTest
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

$TaskName    = 'StudioWatch'
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$WrapperPath = Join-Path $RepoRoot 'scripts\run-studio-watch.ps1'
$WatcherPath = Join-Path $RepoRoot 'hooks\studioWatch.mjs'
$LogPath     = 'C:\Users\mandr\media-vault\studio-watch.log'
# D-04 locks the cadence: every 5 minutes. Unlike the nightly neighbours there is no time slot
# to choose here -- a 5-minute repetition overlaps every other task on this machine by
# construction. What bounds it instead is the work being small (a hash-cached vault walk) and
# -MultipleInstances IgnoreNew, so a slow cycle is skipped rather than stacked.
$RepeatMinutes = 5

function Test-Prereq {
  param([string]$Path, [string]$What)
  if (-not (Test-Path $Path)) {
    Write-Host ("REFUSING: missing {0}: {1}" -f $What, $Path) -ForegroundColor Red
    return $false
  }
  return $true
}

# The two battery flags are MANDATORY and this function is the single place they are set, so a
# future editor cannot change them in one code path and leave the self-test asserting another.
# New-ScheduledTaskSettingsSet defaults DisallowStartIfOnBatteries to $true, which SILENTLY
# NO-OPS THE ENTIRE ACTION whenever Windows reports battery power: no error, no log entry, and
# LastTaskResult/LastRunTime do not reliably reflect it. On this machine ClaudeConfigPull went
# 5+ weeks without a single real run from exactly that default. It also contradicts -WakeToRun,
# which is set here precisely because the task must fire regardless of machine state.
#
# ExecutionTimeLimit is 10 minutes rather than the workspace-scan donor's 30: this task repeats
# every 5 minutes with -MultipleInstances IgnoreNew, so a hung instance suppresses every later
# cycle until the limit expires. 10 minutes bounds that outage to two missed cycles while still
# leaving headroom for an encode ladder over a batch of newly-dropped files.
function New-StudioWatchSettings {
  New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
}

# The genuine gap versus the donor: no script in this repo uses a repeating trigger, so this is
# written fresh. Two encodings of "repeat forever" exist and this machine's acceptance of
# either could not be tested without elevation, so both are built here and the registration
# step below tries them in order, verifying the REGISTERED trigger after each:
#   BlankDuration:$false -> RepetitionDuration [TimeSpan]::MaxValue, which serialises as
#     P99999999DT23H59M59S. Some Windows builds reject that at Register time as "out of range".
#   BlankDuration:$true  -> an empty Duration, which is what the Task Scheduler UI's
#     "Indefinitely" writes.
# Both produce Repetition.Interval = PT5M, which is the property that actually matters and the
# one the read-back asserts.
function New-StudioWatchTrigger {
  param([switch]$BlankDuration)
  $t = New-ScheduledTaskTrigger -Once -At (Get-Date) `
        -RepetitionInterval (New-TimeSpan -Minutes $RepeatMinutes) `
        -RepetitionDuration ([TimeSpan]::MaxValue)
  if ($BlankDuration) { $t.Repetition.Duration = '' }
  return $t
}

# --- self-test ------------------------------------------------------------------------------
# Runs BEFORE the elevation gate on purpose: it registers nothing, so requiring administrator
# rights to prove the guards refuse would make the proof harder to run than the thing it guards.
if ($SelfTest) {
  Write-Host "SELF-TEST (registers nothing)" -ForegroundColor Cyan
  $failures = 0

  Write-Host ""
  Write-Host "(a) wrapper with a bogus -RepoRoot must exit non-zero AND write a log line"
  $tmpLog = Join-Path $env:TEMP ('studio-selftest-{0}.log' -f [guid]::NewGuid().ToString('N'))
  & powershell -NoProfile -ExecutionPolicy Bypass -File $WrapperPath `
      -RepoRoot 'C:\definitely-not-a-real-repo-9x7q2' -LogPath $tmpLog | Out-Null
  $wrapperCode = $LASTEXITCODE
  # @() must wrap the ASSIGNMENT, not the value inside the if-block. Get-Content returns a bare
  # string for a single-line file, and `$x = if (...) { @(...) }` UNROLLS a one-element array
  # back to that scalar - after which .Count still reports 1 (PowerShell's ETS gives every
  # object a .Count), so the guard passes while [0] silently yields the first CHARACTER.
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

  # (c) is this script's own new logic, and the reason it is here: the battery guard's failure
  # mode is TOTAL SILENCE, so it is the one setting that must be asserted before registration
  # rather than discovered five weeks later.
  Write-Host ""
  Write-Host "(c) the settings this script builds must have both battery guards cleared"
  $goodSettings = New-StudioWatchSettings
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
  Write-Host "             Without this, (c) would pass even if the check could never fail."
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
  Write-Host ("(d) both trigger encodings must carry a {0}-minute repetition interval" -f $RepeatMinutes)
  $expectedInterval = 'PT{0}M' -f $RepeatMinutes
  foreach ($blank in @($false, $true)) {
    $label = if ($blank) { 'blank-duration' } else { 'MaxValue-duration' }
    $trg = New-StudioWatchTrigger -BlankDuration:$blank
    if ($trg.Repetition.Interval -eq $expectedInterval) {
      Write-Host ("    PASS {0}: Interval={1} Duration=[{2}]" -f $label, $trg.Repetition.Interval, $trg.Repetition.Duration)
    } else {
      Write-Host ("    FAIL {0}: Interval={1}, expected {2}" -f $label, $trg.Repetition.Interval, $expectedInterval) -ForegroundColor Red
      $failures++
    }
  }

  Write-Host ""
  Write-Host "    CONTROL: a plain daily trigger (the donor's shape) must FAIL the same check,"
  Write-Host "             or (d) would pass on any trigger at all."
  $dailyTrigger = New-ScheduledTaskTrigger -Daily -At '04:15'
  if ($dailyTrigger.Repetition.Interval -ne $expectedInterval) {
    Write-Host ("    PASS control correctly FAILED (daily trigger Interval=[{0}])" -f $dailyTrigger.Repetition.Interval)
  } else {
    Write-Host "    FAIL control PASSED - the repetition check cannot tell a repeating trigger from a daily one" -ForegroundColor Red
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
  Write-Host "This removes ONLY the task. It does not touch the scripts, the log, the media"
  Write-Host "vault, or any ingested row."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host ("Unregistered {0}" -f $TaskName) -ForegroundColor Green
  exit 0
}

# --- preconditions --------------------------------------------------------------------------
$ok = $true
if (-not (Test-Prereq -Path $HiddenVbs   -What 'run-hidden.vbs'))          { $ok = $false }
if (-not (Test-Prereq -Path $WrapperPath -What 'run-studio-watch.ps1'))    { $ok = $false }
if (-not (Test-Prereq -Path $WatcherPath -What 'hooks\studioWatch.mjs'))   { $ok = $false }
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
$principal = New-ScheduledTaskPrincipal -UserId 'mandr' -LogonType S4U -RunLevel Limited
$settings  = New-StudioWatchSettings

$desc = 'Studio media-vault watcher (Phase 118, D-04) - every ' + $RepeatMinutes + ' minutes: ' +
        'scans media-vault, encodes thumbnails, POSTs new rows, reconciles trash. Log: ' + $LogPath

# Register, then VERIFY THE REGISTERED TRIGGER -- never the registration command's success.
# Repetition properties are exactly where an accepted cmdlet call and the resulting task can
# disagree, so if the first duration encoding does not survive registration the second is
# tried and re-read rather than assumed.
$expectedInterval = 'PT{0}M' -f $RepeatMinutes
$registered = $null
foreach ($blank in @($false, $true)) {
  $label = if ($blank) { 'blank Duration (Indefinitely)' } else { 'Duration=[TimeSpan]::MaxValue' }
  Write-Host ""
  Write-Host ("Registering with {0} ..." -f $label)
  $trigger = New-StudioWatchTrigger -BlankDuration:$blank
  try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
      -Principal $principal -Settings $settings -Force -Description $desc | Out-Null
  } catch {
    Write-Host ("    register threw: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    continue
  }
  $back = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($back -and $back.Triggers[0].Repetition.Interval -eq $expectedInterval) {
    Write-Host ("    read-back OK: Repetition.Interval={0}" -f $back.Triggers[0].Repetition.Interval)
    $registered = $back
    break
  }
  $got = if ($back) { $back.Triggers[0].Repetition.Interval } else { '<task not found>' }
  Write-Host ("    read-back MISMATCH: Repetition.Interval=[{0}], expected {1} - trying the next encoding" -f $got, $expectedInterval) -ForegroundColor Yellow
}

if (-not $registered) {
  Write-Host ""
  Write-Host ("FAILED: {0} could not be registered with a {1}-minute repetition that survives read-back." -f $TaskName, $RepeatMinutes) -ForegroundColor Red
  Write-Host "Nothing further was attempted. Inspect taskschd.msc before re-running."
  exit 1
}

Write-Host ""
Write-Host ("Registered {0} (repeats every {1} minutes)" -f $TaskName, $RepeatMinutes) -ForegroundColor Green

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
    @{ Name = ("repetition interval = {0}" -f $expectedInterval); Ok = ($t.Triggers[0].Repetition.Interval -eq $expectedInterval) },
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
Write-Host ("The evidence is a dated line in {0}." -f $LogPath)

Write-Host ""
Write-Host "TWO THINGS FOR YOU:" -ForegroundColor Cyan
Write-Host "  1. Open taskschd.msc, find StudioWatch, and on the Conditions tab confirm"
Write-Host "     'Start the task only if the computer is on AC power' is UNCHECKED."
Write-Host "     (That checkbox is DisallowStartIfOnBatteries. If it is checked, the task will"
Write-Host "     silently never run on any battery cycle.) On the Triggers tab confirm it reads"
Write-Host ("     'Repeat task every {0} minutes'. Then use Run to trigger it once: NO window" -f $RepeatMinutes)
Write-Host ("     should appear at all, and a new line should land in {0}." -f $LogPath)
Write-Host ("  2. In ~10 minutes, check that log for TWO lines you did not trigger, {0} minutes" -f $RepeatMinutes)
Write-Host "     apart. A manual Run proves the action works; only those lines prove the"
Write-Host "     SCHEDULER repeats it. That check is what closes D-04."
Write-Host ""
Write-Host ("To undo: powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Remove" -f $PSCommandPath)
