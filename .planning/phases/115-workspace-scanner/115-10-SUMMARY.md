---
phase: 115-workspace-scanner
plan: 10
subsystem: infra
tags: [powershell, scheduled-task, windows, run-hidden-vbs, logging]

requires:
  - phase: 115-09
    provides: a live, proven ingest path and a D-12 gate that no longer refuses on ordinary file churn
provides:
  - "scripts/run-workspace-scan.ps1 - logging wrapper with exit-code meanings, bounded secret-filtered output tail, rotation"
  - "scripts/install-workspace-scan-task.ps1 - registers CodePulse-WorkspaceScan daily 04:15 via wscript.exe + run-hidden.vbs, with -Remove and a mutation-proven -SelfTest"
  - "CodePulse-WorkspaceScan registered and its action proven end to end"

affects: [115-09]

tech-stack:
  added: []
  patterns:
    - "Read-back verification probes a KNOWN-PRESENT control first and skips its assertions entirely if that control fails, rather than printing an unverifiable PASS"
    - "Scheduled-task logs live outside the repo, so no .gitignore entry can be forgotten in a public repo"

key-files:
  created:
    - scripts/run-workspace-scan.ps1
    - scripts/install-workspace-scan-task.ps1
  modified:
    - .planning/phases/115-workspace-scanner/115-LIVE-EVIDENCE.md

key-decisions:
  - "Trigger 04:15 local, NOT the plan's 03:15. The plan's rationale compared a LOCAL trigger against UTC cron times, and 04:30 UTC is commented out anyway. What matters is this machine's own tasks: ConvexBackup 03:00 and ConvexBackupFull 03:30 - 03:15 would have landed the scan between two I/O-heavy backups on a single-node SQLite backend."
  - "Failure signalling is log-only for now (Larry's choice); no Telegram/webhook alerting added."

patterns-established:
  - "LastTaskResult is documented in the installer's own output as NOT evidence the task ran - it cannot distinguish 'never fired' from 'fired and succeeded' and does not reflect a battery-gated no-op."

requirements-completed: []
# D-05 is NOT in decisions-completed, deliberately. Its scripts are built, the task is
# registered and its ACTION is proven end to end - but D-05's claim is that the scheduler
# fires it UNATTENDED, and that cannot be true before a 04:15 log line nobody triggered
# exists. Listing it here would contradict this summary's own D-05 section.
decisions-completed: []
decisions-open:
  - "D-05 - unattended firing unverified until a ~04:15 log line appears; due 2026-08-14 morning"

duration: ~45min
completed: 2026-08-13
---

# Phase 115-10: Nightly Scheduled Task Summary

**A console-less nightly scanner task registered at 04:15 with the two Task Scheduler traps this machine has actually been bitten by designed out - and D-05 deliberately left OPEN, because a manual trigger proves the action works, not that the scheduler fires it.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-13
- **Tasks:** 2 (1 auto, 1 blocking human-verify checkpoint)
- **Files modified:** 2 created

## Accomplishments

- `scripts/run-workspace-scan.ps1`: refuses with exit 2 rather than running node from the wrong
  directory, logs timestamp + exit code + that code's meaning from the scanner's own table, appends at
  most the final 5 output lines with any `Bearer`-bearing line filtered, rotates at ~1 MB, and
  propagates the exit code. The log lives at `C:\Users\mandr\.forge\` — **outside the repo**, so no
  `.gitignore` entry can be forgotten in a public repo.
- `scripts/install-workspace-scan-task.ps1`: registers via `wscript.exe` + `run-hidden.vbs`, sets
  `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries` explicitly, checks elevation with the
  `WindowsBuiltInRole` enum and never self-elevates, and supports `-Remove` and `-SelfTest`.
- Both files parse under PS 5.1, are ASCII-only and BOM-less.
- Registered and confirmed live on 2026-08-13.

## Task Commits

1. **Task 1: wrapper + installer** — `c02bc1d4` (feat)
2. **Task 2: registration evidence** — `56d60f73`, `45d5274f` (docs)

## Decisions Made

Recorded in frontmatter. The substantive one is the **04:15 trigger**, which corrects the plan.

## Deviations from Plan

### 1. Trigger time 04:15, not 03:15

The plan specified 03:15 and justified it as avoiding "the 04:00 and 04:30 UTC Convex crons". That
reasoning fails twice: it compares a **local** trigger against **UTC** cron times, and 04:30 UTC is
commented out (`convex/crons.ts:149`). The real neighbours are this machine's own scheduled tasks —
`ConvexBackup` at 03:00 and `ConvexBackupFull` at 03:30 — so 03:15 would have put a 4,912-directory
walk plus ingest between two I/O-heavy backups on a single-node SQLite backend. 04:15 is ~45 minutes
clear of those, of the 09:00 UTC retention cron (05:00 local), and of `ConvexRetentionHealthCheck`
(05:30). Larry chose 04:15.

### 2. The forbidden forms are named nowhere in the installer

The plan's acceptance criteria grep for `WindowStyle Hidden` and the string-form role check and
require **0**. Comments *warning against* them tripped those greps. Rather than weaken the checks, the
comments were reworded so the file is unambiguous — a check that cannot distinguish "uses the bad
form" from "warns about it" is worse than no check.

**Total deviations:** 2. No scope creep.

## Issues Encountered

**A self-test that printed the wrong evidence, twice.** `(a)` reported `logged: 2` — the first
*character* of the log line — because `Get-Content` returns a bare string for a single-line file. The
first fix moved the bug rather than removing it: `$x = if (...) { @(...) }` **unrolls** a one-element
array back to a scalar, and `.Count` still reports 1 via PowerShell's ETS, so the guard passed while
`[0]` indexed into the string. Fixed by wrapping the **assignment**: `@(if (...) { Get-Content ... })`.
The self-test now prints the full log line.

## Verification

- `-SelfTest` proves **both** refusal paths fire — the wrapper exits 2 with a real logged line on a
  bogus repo root, and the prerequisite check refuses a nonexistent `run-hidden.vbs` — plus a
  **control** that the same check accepts the real path, without which `(b)` would pass even if the
  check always refused.
- Installer read-back: the `ConvexNightlyRestart` control **resolved**, so its six PASS lines are
  trustworthy. This settles an open question in the plan: `Get-ScheduledTask` is *not* subject to the
  failure that makes `schtasks /query` return zero lines from the agent shell.
- AC-power condition verified programmatically, control-paired: `DisallowStartIfOnBatteries: False`,
  `StopIfGoingOnBatteries: False`, trigger `2026-08-13T04:15:00-04:00`, `State: Ready`.
- Manual trigger: Larry, verbatim — **"i did not see a window pop up"**. Two triggers (his own,
  confirmed) produced exactly two log lines, both `EXIT=0 success (ingested)`.
- The `EXIT=0` was **not** taken at face value: `activeVersion` went 8 → 10 in the database and
  `receivedAt` 08:30:43 EDT matches the 08:30:44 log line to the second, tying the write to this task
  run rather than to an earlier manual ingest.

## User Setup Required

Done: Larry ran the installer in an elevated shell on 2026-08-13.

To undo: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-workspace-scan-task.ps1 -Remove`

**Retirement note:** before ever unregistering this task, grep **all** automation roots
(`C:\Users\mandr\scripts`, `C:\Users\mandr\convex-selfhost`, other repos' watchdogs) for
`CodePulse-WorkspaceScan`. A prior retirement on this machine verified no tasks of a given name
remained but missed a watchdog calling it by name, which then alerted every 30 minutes for three days.
That instruction is also in the installer's header.

## D-05 status: OPEN, due 2026-08-14 morning

**D-05 is NOT verified and is not recorded as complete anywhere.** What is proven is that the *action*
works: no console window, a log line, the exit code propagated, and real data landing in Convex. What
is *not* proven is that the **scheduler fires it unattended**, which is D-05's actual claim. That
requires a line in `C:\Users\mandr\.forge\codepulse-workspace-scan.log` stamped near 04:15 that nobody
triggered — which cannot exist before 2026-08-14. Waiting one morning costs nothing; a wrong green in
a durable artifact is what the next session reads as ground truth.

## Next Phase Readiness

- The nightly pipeline is in place pending that one observation.
- Machine state, not repo state: this registration disappears on a rebuilt machine. `-Remove` reverses
  it; re-running the installer restores it.

---
*Phase: 115-workspace-scanner*
*Completed: 2026-08-13 (D-05 verification OPEN)*
