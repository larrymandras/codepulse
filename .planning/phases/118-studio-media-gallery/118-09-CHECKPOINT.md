---
phase: 118-studio-media-gallery
plan: 09
subsystem: infra
tags: [powershell, scheduled-task, robocopy, backup, watcher, skill, windows]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery (plan 07)
    provides: "hooks/studioWatch.mjs's scan core and the media-vault\\{gen,refs,styles,trash} layout the mirror copies"
  - phase: 118-studio-media-gallery (plan 08)
    provides: "hooks/studioWatch.mjs's complete watcher and its real exit-code table (0 ok, 2 configuration) — the wrapper's $ExitMeanings is read from it, not from this plan's prose"
provides:
  - "scripts/run-studio-watch.ps1: the StudioWatch task's wrapper — rotating ASCII log at media-vault\\studio-watch.log, cmd /c node wrapping, Bearer-filtered bounded tail"
  - "scripts/install-studio-watch-task.ps1: StudioWatch registration, 5-minute repeating trigger, both D-04 guards, -SelfTest with three discriminating controls"
  - "scripts/run-media-vault-backup.ps1: robocopy /MIR wrapper with bitmask exit-code translation and three /MIR data-loss preconditions"
  - "scripts/install-media-vault-backup-task.ps1: MediaVaultBackup registration, daily 06:30 local, same guards, -SelfTest with five discriminating controls"
  - "~/.claude/skills/studio-sync/SKILL.md: the D-04 manual path (outside the repo, not committed)"
affects: [118-12-studio-generate-skill, 118-14-openart-leg, 118-15-live-behavioral-proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "installer + wrapper pair for a scheduled task (mirrors scripts/install-workspace-scan-task.ps1 / run-workspace-scan.ps1)"
    - "-SelfTest that runs BEFORE the elevation gate and registers nothing, so proving the guards refuse is cheaper than the thing it guards"
    - "every self-test assertion paired with a control that must FAIL, so a check that can never fail is not mistaken for a passing one"
    - "repeating scheduled-task trigger with both 'repeat forever' duration encodings tried in order and each verified by reading Repetition.Interval back off the REGISTERED task"
    - "robocopy bitmask exit-code translation (0-7 success, 8+ failure) as one testable function"

key-files:
  created:
    - scripts/run-studio-watch.ps1
    - scripts/install-studio-watch-task.ps1
    - scripts/run-media-vault-backup.ps1
    - scripts/install-media-vault-backup-task.ps1
    - "C:\\Users\\mandr\\.claude\\skills\\studio-sync\\SKILL.md (outside the repo, not committed)"
  modified: []

key-decisions:
  - "Added scripts/run-media-vault-backup.ps1, which 118-09-PLAN.md's files_modified list does NOT name. The plan's own action text for Task 2 requires three behaviours a raw robocopy command line cannot carry — appending to backup.log, translating robocopy's bitmask exit codes, and not redirecting native stderr under a strict error preference — and this repo's established shape for exactly that is an installer + wrapper pair. Inlining a -RunBackup mode into the installer was rejected as diverging from the donor for no benefit."
  - "$ExitMeanings for the watcher lists ONLY 0 and 2. 118-09-PLAN.md's read_first names four codes (0 ok / 2 configuration / 3 transport / 4 refusal); 3 and 4 do not exist in hooks/studioWatch.mjs — its main() docstring documents 0 and 2, and all three exitImpl() call sites are 2, 2, 0. A thumbnail refusal or a transport failure is counted in the cycle totals and still exits 0. Claiming codes the code never emits would put a fiction in the log's own legend."
  - "Three /MIR preconditions beyond D-14's text (Rule 2): refuse when the source is missing, refuse when it holds zero mirrorable files, and refuse when 'G:\\My Drive' is unreachable rather than creating it locally. T-118-09 accepts deletion propagation BECAUSE trash\\ gives a real deletion a 30-day local grace; it does not accept propagating an empty or unmounted source, which would empty the only copy of the originals with no grace at all."
  - "MediaVaultBackup runs 06:30 LOCAL, chosen against neighbours read back from Get-ScheduledTask comparing LOCAL against LOCAL. The brief's stated neighbour set was partly stale: ConvexBackupFull is 03:00, not 03:30, and is currently Disabled. Measured neighbours: 02:00 ConvexNightlyRestart, 03:00 ConvexBackup, 04:15 CodePulse-WorkspaceScan (30-min limit, so to 04:45), 05:00 local = 09:00 UTC retention prune, 05:30 ConvexRetentionHealthCheck, 05:45 ConvexRetentionRootCause, 08:00 CodePulse-WorkspaceScan-D05Check. 06:30 is 45 min clear after 05:45 and 90 min before 08:00."
  - "ExecutionTimeLimit differs from the donor's 30 minutes in BOTH scripts, for opposite reasons: StudioWatch gets 10 minutes because a 5-minute cadence with -MultipleInstances IgnoreNew means a hung instance suppresses every later cycle until the limit expires; MediaVaultBackup gets 4 hours because the first run seeds an entire vault across Google Drive File Stream."
  - "The D-01 fallback static thumbnail server was NOT built. 118-D01-EVIDENCE.md records BRANCH: convex-storage (the probe PASSed), so plan Task 2's conditional does not apply. convex-selfhost/docker-compose.yml was not touched."

requirements-completed: []

# Metrics
duration: ~75min
completed: 2026-08-14
---

# Phase 118 Plan 09: Scheduled Tasks — StudioWatch and MediaVaultBackup Summary

**Two installer/wrapper pairs copied from this machine's proven exemplar, carrying both of D-04's
locked guards and a robocopy bitmask translation that stops every successful mirror reading as an
error — every guard mutation-tested to RED and restored, and NOT registered: an S4U principal needs
elevation this agent cannot obtain, so registration is handed to Larry at the Task 3 checkpoint.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 2/3 completed (Task 3 is the elevation checkpoint, correctly not executed)
- **Files created:** 5 (4 committed `.ps1`, 1 `SKILL.md` outside the repo)

## Accomplishments

### Task 1 — StudioWatch (D-04)

- **`scripts/run-studio-watch.ps1`** — the donor `run-workspace-scan.ps1` near-verbatim: append-only
  ASCII log at `C:\Users\mandr\media-vault\studio-watch.log` (outside the repo, so no `.gitignore`
  entry can be forgotten in this PUBLIC repo), 1 MB rotation keeping one generation,
  `cmd /c "node hooks\studioWatch.mjs 2>&1"` so native stderr never trips
  `$ErrorActionPreference='Stop'`, and a bounded 5-line tail filtered by
  `Where-Object { $_ -notmatch 'Bearer' }`.
- **`scripts/install-studio-watch-task.ps1`** — `wscript.exe` + `run-hidden.vbs` launcher, S4U
  principal, `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun
  -MultipleInstances IgnoreNew`, elevation check via the `WindowsBuiltInRole` enum, and the donor's
  control-first read-back that probes a known-installed task before trusting a "not found".
- **The genuine gap — the 5-minute repeating trigger.** No script in this repo uses one. Two
  encodings of "repeat forever" exist and neither could be tested at *registration* time without
  elevation, so both are built and the register step tries them in order, verifying
  `Repetition.Interval` **read back off the registered task** after each and moving on if it does
  not survive. Both construct correctly unelevated (measured: `Interval=PT5M`,
  `Duration=[P99999999DT23H59M59S]` and `Duration=[]` respectively).
- **`~/.claude/skills/studio-sync/SKILL.md`** — D-04's manual path. Documents one command
  (`node hooks/studioWatch.mjs` from the repo root), the real exit-code table, and the three config
  variables by NAME only. Credential-shaped scan returns zero hits (control: the same pattern finds
  a hit in a synthetic `Bearer abc123def456` line).

### Task 2 — MediaVaultBackup (D-14)

- **`scripts/run-media-vault-backup.ps1`** — `robocopy "C:\Users\mandr\media-vault"
  "G:\My Drive\media-vault" /MIR /R:2 /W:5 /NP /XF ...`, wrapped in `cmd /c`, output appended to
  `media-vault\backup.log` as a bounded 12-line summary tail.
- **Robocopy's exit codes are a bitmask and 0-7 are all success.** The mapping, quoted from the
  script's own header:

  ```
  #     0  no files copied, source and destination already in sync
  #     1  one or more files copied
  #     2  extra files/dirs found in the destination (under /MIR these are the ones deleted)
  #     4  mismatched files/dirs found
  #     8  some files/dirs could NOT be copied (retry limit exceeded)   <-- failure
  #    16  serious error, robocopy did not copy anything                <-- failure
  ```

  A routine nightly mirror that dropped a trashed file returns **3**, so a naive
  "non-zero is a failure" rule would report every successful run as an error and train the operator
  to ignore the log — which is the only durable evidence the task works. `Test-RobocopySuccess`
  owns the rule and the self-test asserts it over 0..16 against a naive-rule control.
- **Exclusions:** `backup.log` (D-14), plus `studio-watch.log` and `.studio-watch-state.json` (same
  category — host-local operational files, not media), plus their rotated `.1` generations because
  `/XF` matches names, not prefixes.
- **`scripts/install-media-vault-backup-task.ps1`** — daily 06:30 local, `-Daily -At` (the correct
  trigger shape here), same launcher, same principal, same battery guards, `ExecutionTimeLimit` 4h.
- **`G:\My Drive` reachability probed and recorded:** `G:\My Drive` is **PRESENT**;
  `G:\My Drive\media-vault` is **ABSENT** (robocopy creates it on the first run). Control: a bogus
  path under the same probe returned absent, so the probe discriminates. If Drive is ever unmounted
  at run time the wrapper refuses with a logged line rather than mirroring into a local folder Drive
  would never sync.
- **D-01 fallback SKIPPED.** `118-D01-EVIDENCE.md:77` records `**BRANCH: convex-storage** (the probe
  PASSed; the local-static-origin fallback is not needed)`, so no static thumbnail server was built
  and `convex-selfhost/docker-compose.yml` was not touched (it is outside this repo besides).

### Task 3 — NOT executed (elevation boundary)

`autonomous: false`. Registering an S4U principal requires administrator rights; the `!` prefix runs
in a non-elevated Bash context and cannot satisfy a UAC prompt. No elevation was attempted, no task
was registered. Confirmed by probe with a control:

```
StudioWatch            ABSENT
MediaVaultBackup       ABSENT
ConvexNightlyRestart   PRESENT state=Ready     <-- control: the probe CAN see a present task
BogusControl9x7q2      ABSENT
```

`Get-ScheduledTask` (CIM/WMI) works from this shell; `schtasks /query` is the code path known to
return zero lines here and was not used.

## Task Commits

1. **Task 1 — StudioWatch wrapper and installer** — `cd8fc8df` (feat)
2. **Task 1 — self-test hardening after mutation testing** — `5b5c3459` (test)
3. **Task 2 — MediaVaultBackup wrapper and installer** — `e96b50d6` (feat)
4. **Task 2 — name the exclusions in the registered task description** — `4daaeee5` (docs)

`git show --stat HEAD` was checked after each; every commit contained only the files named above.
No concurrent-session files were swept in.

## Verification

| Check | Result |
|-------|--------|
| ASCII-only (bytes > 127) | **0** in all four `.ps1`. Control: `118-CONTEXT.md` returns **95**, so the scan discriminates. |
| UTF-8 BOM | None — all four start `23 20` (`# `). |
| Parses under PS 5.1 | `[ScriptBlock]::Create((Get-Content -Raw ...))` succeeds for all four. |
| `grep -cF WindowStyle` on both installers | **0** and **0**. Control: the same pattern finds hits in `118-PLAN`/`118-CONTEXT`/`118-RESEARCH`. |
| Elevation check form | `install-studio-watch-task.ps1:215` and `install-media-vault-backup-task.ps1:208`, both: `if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {`. String form: **0** hits in both. Control: `WindowsBuiltInRole` returns 2 hits in each, so the tool can find it. |
| `AllowStartIfOnBatteries` / `DontStopIfGoingOnBatteries` | 1 each in both installers (the single `New-*Settings` function). |
| `wscript.exe` / `run-hidden.vbs` | 3 / 10 in both installers. |
| `RepetitionInterval` with a 5-minute timespan | `install-studio-watch-task.ps1`: 1 hit, `New-TimeSpan -Minutes $RepeatMinutes` with `$RepeatMinutes = 5` asserted against the literal. |
| `/MIR`, `/R:2`, `/W:5`, `backup.log` in the backup installer | 1 / 1 / 1 / 3 (the registered task description names the command and the exclusions, which is what an operator reads in `taskschd.msc`; the invocation itself lives in the wrapper). |
| `ExitMeanings`, `cmd /c`, `Bearer` in `run-studio-watch.ps1` | 4 / 2 / 1. |
| `install-studio-watch-task.ps1 -SelfTest` | **exit 0**, SELF-TEST PASSED. |
| `install-media-vault-backup-task.ps1 -SelfTest` | **exit 0**, SELF-TEST PASSED (it invokes the wrapper's own `-SelfTest` as check (a)). |
| `npm test` | **4555 passed \| 197 todo** (330 files passed, 17 skipped), exit 0 — above 118-08's recorded 4506 baseline, and this plan adds no JS. |

## Mutation Proofs

Every load-bearing guard was broken and shown RED before being restored. A guard that has never
been shown to refuse is not a guard.

**1. StudioWatch battery guard** — removed `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`
from `New-StudioWatchSettings`:
```
(c) the settings this script builds must have both battery guards cleared
    FAIL DisallowStartIfOnBatteries=True StopIfGoingOnBatteries=True
SELF-TEST FAILED (1)   exit 1
```
Restored via `git checkout --`; `git diff HEAD -- <file>` empty.

**2. StudioWatch cadence** — set `$RepeatMinutes = 15`:
```
(d) the cadence D-04 locks is 5 minutes, and both trigger encodings must carry it
    FAIL RepeatMinutes = 15, but D-04 locks 5
    FAIL MaxValue-duration: Interval=PT15M, expected PT5M
    FAIL blank-duration: Interval=PT15M, expected PT5M
SELF-TEST FAILED (3)   exit 1
```
This check only exists **because** the mutation test exposed that it could not fail: (d) originally
derived its expected interval from `$RepeatMinutes`, the same variable that builds the trigger, so
raising the variable moved both sides and stayed green. Fixed in `5b5c3459` — the comparison is now
against the literal `PT5M` plus an assertion on the constant itself, because D-04 locks the cadence
rather than offering it as a knob.

**3. Robocopy bitmask classifier** — replaced `($Code -ge 0 -and $Code -lt 8)` with `($Code -eq 0)`,
i.e. the naive rule:
```
    FAIL code 1 classified as failure: success: files copied
    FAIL code 3 classified as failure: success: files copied, extra files removed from destination
    ... (codes 1-7, seven FAIL lines)
    FAIL classifier agrees with the naive rule everywhere - it is not doing anything
WRAPPER SELF-TEST FAILED (8)   exit 1
```
Both the direct assertion **and** the naive-rule control fired. Restored; `git diff HEAD` empty.

**4. D-14's `backup.log` exclusion** — removed `'backup.log'` from `$ExcludedFiles`:
```
(w2) backup.log must be excluded from the mirror (D-14), and so must the two host-local watcher files
    FAIL backup.log is NOT excluded
WRAPPER SELF-TEST FAILED (1)   exit 1
```
Restored; `git diff HEAD` empty; self-test back to PASSED.

**5. MediaVaultBackup battery guard** — same mutation as (1) on the other installer:
```
(d) the settings this script builds must have both battery guards cleared
    FAIL DisallowStartIfOnBatteries=True StopIfGoingOnBatteries=True
SELF-TEST FAILED (1)   exit 1
```
Restored; `git status --porcelain` clean.

### Controls that must FAIL, built into the self-tests

These exist so a green self-test cannot be mistaken for one that measured nothing. All five pass
(that is, all five correctly FAIL their check):

- **`install-studio-watch-task.ps1`:** the real `run-hidden.vbs` must be ACCEPTED by the same
  `Test-Prereq` that refuses a bogus path; a settings object built without the battery flags must
  FAIL (`cmdlet default is DisallowStartIfOnBatteries=True StopIfGoingOnBatteries=True` — that
  default is the hazard); a plain daily trigger must FAIL the repetition check (`Interval=[]`).
- **`run-media-vault-backup.ps1`:** the naive non-zero rule must DISAGREE with the classifier
  (`would misreport 7 successful code(s) as errors: 1, 2, 3, 4, 5, 6, 7`); a real media filename
  must NOT be in the exclusion list.
- **`install-media-vault-backup-task.ps1`:** the same battery control, plus a control proving the
  wrapper's source refusal is not a blanket refusal — the same invocation against the REAL source
  with a bogus destination gets PAST the source check and refuses at the destination check
  (`REFUSED - destination root not reachable ... Q:\definitely-not-a-real-drive-9x7q2`), copying
  nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's file list named only the installer, but its action text required
a wrapper**

- **Found during:** Task 2, writing the robocopy action.
- **Issue:** `118-09-PLAN.md`'s `files_modified` lists only
  `scripts/install-media-vault-backup-task.ps1`, while the same task's `<action>` requires output
  appended to `backup.log`, explicit bitmask exit-code handling, and "wrap it the same way the
  watcher wrapper wraps node." None of those can live in a raw robocopy command line handed to
  `New-ScheduledTaskAction`.
- **Fix:** Added `scripts/run-media-vault-backup.ps1`, mirroring the repo's established installer +
  wrapper pair. Inlining a `-RunBackup` mode into the installer was considered and rejected: it
  diverges from the donor for no benefit and makes the scheduled task depend on a script named
  `install-...`.
- **Committed in:** `e96b50d6`

**2. [Rule 1 - Bug] The plan's exit-code table for the watcher named two codes the code never emits**

- **Found during:** Task 1, writing `$ExitMeanings`.
- **Issue:** The plan's `<read_first>` states the table is "0 ok / 2 configuration / 3
  transport/server / 4 refusal". `hooks/studioWatch.mjs`'s `main()` docstring documents only 0 and
  2, and all three `exitImpl()` call sites (lines 1156, 1170, 1173) are `2`, `2`, `0`. A refusal or
  a transport failure is counted in the cycle totals and still exits 0.
- **Fix:** `$ExitMeanings` lists 0 and 2 only; anything else logs as `UNKNOWN`. The discrepancy is
  documented in the script so a future reader does not "restore" the missing entries.
- **Committed in:** `cd8fc8df`

**3. [Rule 2 - Missing Critical] `/MIR` had no guard against mirroring a missing or empty source**

- **Found during:** Task 2, writing the wrapper's preconditions.
- **Issue:** T-118-09 accepts deletion propagation **because** `trash\` gives a real deletion a
  30-day local grace. That reasoning does not cover a source that is absent or empty for an
  unrelated reason — a wrong path, an unmounted volume, a half-finished move. Robocopy would
  cheerfully mirror an empty directory over the only copy of the originals, with no grace at all.
- **Fix:** Three refusals, each logged: source missing; source holds zero mirrorable files;
  destination root (`G:\My Drive`) unreachable, rather than creating that folder locally where
  Drive would never sync it.
- **Verification:** Self-test (b) drives the source refusal and its control proves the refusal is
  not blanket (the real source reaches the destination check).
- **Committed in:** `e96b50d6`

**4. [Rule 1 - Bug] The trigger self-test could not detect a wrong cadence**

- **Found during:** Mutation-testing Task 1's self-test.
- **Issue:** Check (d) derived its expected interval from `$RepeatMinutes` — the same variable that
  builds the trigger — so setting it to 15 moved both sides and passed green while violating D-04.
- **Fix:** Compare against the literal `PT5M` and assert the constant is 5.
- **Verification:** Proven RED at `$RepeatMinutes = 15` (three FAIL lines, exit 1), restored, green.
- **Committed in:** `5b5c3459`

**5. [Rule 1 - Stale premise] The brief's neighbour list was partly wrong**

- **Found during:** Task 2, choosing the trigger time.
- **Issue:** The brief gave `ConvexBackupFull 03:30`. Read back from `Get-ScheduledTask`, it is
  **03:00** and currently **Disabled**. Two neighbours the brief did not mention exist:
  `ConvexRetentionRootCause` 05:45 and `CodePulse-WorkspaceScan-D05Check` 08:00.
- **Fix:** Chose 06:30 against the measured set, comparing local against local, with the full
  conversion spelled out in the script's own comment.

### Not deviations, recorded for completeness

- **The D-01 fallback static server was skipped**, correctly: `118-D01-EVIDENCE.md` records
  `BRANCH: convex-storage`. The plan's conditional does not fire. `convex-selfhost/docker-compose.yml`
  untouched.
- **`~/.claude/skills/studio-sync/SKILL.md` is outside the repo** and therefore not in any commit.
  It is a machine-local artifact like the rest of `~/.claude/skills/`.

## Issues Encountered

- The 5-minute repeating trigger has two competing "repeat forever" encodings and **which one this
  machine accepts at Register time could not be determined without elevation** — `[TimeSpan]::MaxValue`
  serialises as `P99999999DT23H59M59S`, which some Windows builds reject as out of range, while an
  empty `Duration` is what the Task Scheduler UI writes for "Indefinitely". Both construct correctly
  unelevated. Rather than guess, the installer tries them in order and verifies the registered
  `Repetition.Interval` after each, failing loudly if neither survives.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface. Two threat-register entries are strengthened rather than merely
mitigated as written:

| Threat ID | Change |
|-----------|--------|
| T-118-09 | `/MIR` deletion propagation was `accept, with control`. Three additional refusals now bound the accepted case to "the source genuinely changed", excluding missing/empty/unmounted sources entirely. |
| T-118-31 | The bitmask handling is not only documented but asserted over 0..16 with a naive-rule control, and proven RED by mutation. |

## User Setup Required

**Registration is the remaining work and requires an elevated PowerShell.** See the checkpoint
handed to Larry with Task 3: two `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\...`
commands, the read-back verification each prints, and the observable-side-effect proofs (a dated
line in `studio-watch.log`, mirrored content plus a `backup.log` line and the absence of
`G:\My Drive\media-vault\backup.log`) that close D-04 and D-14. `LastTaskResult` is not evidence
either way.

## Next Phase Readiness

- D-04 and D-14 are **authored, not closed**. `requirements-completed` is deliberately empty: both
  decisions require a registered task proven to have executed, which is the Task 3 checkpoint.
- `/studio-sync` is available now and needs no registration, so any later gate can force a sync
  without waiting 5 minutes or for the elevated run.
- `STUDIO_API_KEY` must be set for the watcher to do anything but exit 2 — the scheduled task will
  otherwise log `EXIT=2 configuration error` every 5 minutes, which is loud and correct, not silent.

## Self-Check: PASSED

- FOUND: `scripts/run-studio-watch.ps1`
- FOUND: `scripts/install-studio-watch-task.ps1`
- FOUND: `scripts/run-media-vault-backup.ps1`
- FOUND: `scripts/install-media-vault-backup-task.ps1`
- FOUND: `C:\Users\mandr\.claude\skills\studio-sync\SKILL.md`
- FOUND commit `cd8fc8df`, `5b5c3459`, `e96b50d6`, `4daaeee5` — all four in `git log --oneline`
- NOT MODIFIED: `.planning/STATE.md`, `.planning/ROADMAP.md` (this agent is forbidden to write them;
  `git status` shows neither touched)
- NOT REGISTERED: `StudioWatch` and `MediaVaultBackup` both ABSENT from `Get-ScheduledTask`, with
  `ConvexNightlyRestart` PRESENT as the control proving the probe can see a registered task

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
