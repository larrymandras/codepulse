# verify-workspace-scan-d05.ps1
# Closes Phase 115's D-05 the only way it can be closed: by observing a workspace-scan log
# line from a run NOBODY TRIGGERED.
#
# WHY THIS EXISTS: a manual Start-ScheduledTask proves the ACTION works (no window, log line,
# exit code propagated). It does NOT prove the SCHEDULER fires it, which is D-05's actual
# claim. Only a line stamped near the trigger time on a morning nobody touched it settles that.
#
# This script is deliberately LOCAL. A cloud routine cannot read
# C:\Users\mandr\.forge\codepulse-workspace-scan.log - the log lives outside the repo on
# purpose, so that no .gitignore entry can be forgotten in a public repo.
#
# It reports by Telegram using the SAME credential file and send shape as the other watchdogs
# on this machine (scripts\monthly-repo-guard.ps1). It never prints or logs the token.
#
# ASCII-only, UTF-8 without BOM (PS 5.1 parses a UTF-8 em-dash as a curly quote).

param(
  [string]$LogPath     = 'C:\Users\mandr\.forge\codepulse-workspace-scan.log',
  # The date to look for. Defaults to TODAY, which is correct when this runs the morning
  # after registration.
  [string]$Date        = (Get-Date).ToString('yyyy-MM-dd'),
  # The scheduled task fires at 04:15; accept the whole 04:00-04:59 hour so a slightly late
  # start (StartWhenAvailable after a wake) still counts.
  [int]$ExpectHour     = 4,
  [string]$AlertConfig = 'C:\Users\mandr\scripts\notebooklm-keepwarm.alert.conf',
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

function Read-AlertConf([string]$path) {
  $h = @{}
  if (-not (Test-Path $path)) { return $h }
  foreach ($line in (Get-Content $path)) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$') { $h[$matches[1]] = $matches[2] }
  }
  return $h
}

function Send-Telegram([string]$text) {
  $conf  = Read-AlertConf $AlertConfig
  $token = $conf['TELEGRAM_BOT_TOKEN']
  $chat  = $conf['TELEGRAM_NOTIFICATION_CHAT_ID']
  if (-not $chat) { $chat = $conf['TELEGRAM_ALLOWED_USER_IDS'] }
  if ((-not $token) -or (-not $chat) -or ($token -like '*REPLACE*')) {
    Write-Output 'WARN: no usable Telegram config; verdict printed only.'
    return $false
  }
  try {
    Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/sendMessage" -Method Post `
      -Body @{ chat_id = $chat; text = $text } -TimeoutSec 30 | Out-Null
    return $true
  } catch {
    Write-Output "WARN: Telegram send failed: $($_.Exception.Message)"
    return $false
  }
}

# Returns the verdict text for a given set of log lines. Pure, so -SelfTest can exercise
# BOTH outcomes without waiting for a real morning.
function Get-Verdict {
  param([string[]]$Lines, [string]$Day, [int]$Hour)

  $prefix = '{0}T{1:D2}:' -f $Day, $Hour
  $hits = @($Lines | Where-Object { $_ -like ($prefix + '*') })

  if ($hits.Count -eq 0) {
    $tail = @($Lines | Select-Object -Last 6) -join "`n"
    return @{
      Pass = $false
      Text = ("CodePulse D-05 NOT PROVEN`n`nNo workspace-scan log line for {0} in the {1:D2}:00 hour. " -f $Day, $Hour) +
             "The task's ACTION is known good (a manual trigger worked), so this means the SCHEDULER did not fire it, " +
             "or it fired and the machine was off/asleep past the StartWhenAvailable window.`n`n" +
             "Check the Conditions tab in taskschd.msc, and LastRunTime - but remember LastTaskResult cannot " +
             "distinguish 'never fired' from 'fired and succeeded', and does not reflect a battery-gated no-op at all.`n`n" +
             "Last lines in the log:`n" + $tail
    }
  }

  $exit = @($hits | Where-Object { $_ -match 'EXIT=' })
  $text = ("CodePulse D-05 PROVEN`n`nAn unattended workspace scan ran at {0} {1:D2}:xx - nobody triggered it. " -f $Day, $Hour) +
          "That closes D-05 and seals Phase 115.`n`n" + (($hits | Select-Object -First 4) -join "`n")
  if ($exit.Count -eq 0) {
    $text = ("CodePulse D-05 PARTIAL`n`nA {0} {1:D2}:xx log line exists, but no EXIT= line for that run - " -f $Day, $Hour) +
            "it may have started and not finished.`n`n" + (($hits | Select-Object -First 4) -join "`n")
    return @{ Pass = $false; Text = $text }
  }
  return @{ Pass = $true; Text = $text }
}

if ($SelfTest) {
  # A guard that has never been shown to refuse is not a guard: exercise BOTH verdicts.
  Write-Output 'SELF-TEST (sends nothing)'
  $good = @('2026-08-14T04:15:02-04:00 START RepoRoot=C:\Users\mandr\codepulse',
            '2026-08-14T04:15:07-04:00 EXIT=0 success (ingested)')
  $bad  = @('2026-08-14T09:30:02-04:00 START RepoRoot=C:\Users\mandr\codepulse',
            '2026-08-14T09:30:07-04:00 EXIT=0 success (ingested)')
  $rGood = Get-Verdict -Lines $good -Day '2026-08-14' -Hour 4
  $rBad  = Get-Verdict -Lines $bad  -Day '2026-08-14' -Hour 4
  $ok = $true
  if ($rGood.Pass) { Write-Output '    PASS 04:15 line -> PROVEN' } else { Write-Output '    FAIL 04:15 line did not read as proven'; $ok = $false }
  # CONTROL: a log with only a MANUAL 09:30 run must NOT read as proven, or this check
  # would pass on exactly the evidence it exists to reject.
  if (-not $rBad.Pass) { Write-Output '    PASS manual-only 09:30 log -> NOT PROVEN (control)' } else { Write-Output '    FAIL a manual-only log read as proven'; $ok = $false }
  if ($ok) { Write-Output 'SELF-TEST PASSED'; exit 0 }
  Write-Output 'SELF-TEST FAILED'; exit 1
}

if (-not (Test-Path $LogPath)) {
  $msg = "CodePulse D-05 NOT PROVEN`n`nThe log does not exist at $LogPath. The task has never written a line, " +
         "which means it has never run at all - not even the wrapper's own START entry."
  Write-Output $msg
  Send-Telegram $msg | Out-Null
  exit 1
}

$lines = @(Get-Content $LogPath)
$verdict = Get-Verdict -Lines $lines -Day $Date -Hour $ExpectHour
Write-Output $verdict.Text
Send-Telegram $verdict.Text | Out-Null

# Leave the verdict in the log itself too, so the evidence and the judgement live together.
Add-Content -Path $LogPath -Encoding ascii -Value (
  '{0} D-05-CHECK {1} (looked for {2} hour {3:D2})' -f (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK'),
  $(if ($verdict.Pass) { 'PROVEN' } else { 'NOT-PROVEN' }), $Date, $ExpectHour)

if ($verdict.Pass) { exit 0 } else { exit 1 }
