# Phase 118 — gate evidence

Written by plan `118-15`, Task 2, on 2026-08-16. Every number below is read off the command's own
output, not carried forward from a plan SUMMARY.

> **STATUS: TASK 2 COMPLETE. TASK 3 (the `D-01..D-16` coverage roll-up) IS NOT YET RUN.**
>
> It is deliberately absent rather than partially filled. The roll-up's whole value is that a reader
> can trust every row, and D-09 cannot be scored until `118-14` runs — so a roll-up written now would
> carry one row that is provisional and fifteen that are not, which is exactly the shape that gets
> misread as final. See "What is still open" at the bottom.

---

## 1. `npx tsc --noEmit`

```
(no output)
TSC_EXIT=0
```

Clean.

## 2. Full Vitest suite

```
Test Files  331 passed | 17 skipped (348)
     Tests  4601 passed | 197 todo (4798)
```

Run **twice consecutively** with identical results, after the fix in §2a.

**Against the pre-phase baseline** recorded in `118-01-SUMMARY.md` — **4,397 passed at Phase 114's
close**:

| | files | tests |
|---|---|---|
| pre-phase baseline (Phase 114 close) | 323 | 4,397 |
| now | 331 passed + 17 skipped = 348 | 4,601 |
| delta | +25 | **+204** |

The direction matters as much as the number. **A DROP would be a signal even with everything shown
green**, because a suite that silently stopped collecting a file reports green while covering less.
This is growth, so there is nothing to explain.

### 2a. A gate failure found and fixed, recorded rather than glossed

The first full run of this gate was **RED**: `4599 passed | 2 failed`. It is recorded here because a
gate that was red before it was green is part of the evidence.

**The reproducible one — a date bomb in `convex/aggregates.test.ts`.** `rollupDaily`'s zero-arg
CONTROL test asserted `dailyRows toHaveLength(1)`. The zero-arg path is the CRON path, which
deliberately runs COST-01's repair sweep after rolling up yesterday, and `repairDayTargets` picks its
days by `((dayIndex * n + i) % span) + 1` — **which rotates with the real calendar date**.

Measured rather than inferred: at the fixture's `retentionDays=30`, today's `dayIndex 20681` yields
sweep offsets **`[9, 10]`**, and the fixture's older row sits at exactly **offset 9**. Enumerating
forward, the same collision fires on **2026-08-30** and **2026-09-14**. Dormant since COST-01 shipped
on 2026-08-07; it happened to land today.

**The product is correct.** Revisiting older days is the entire purpose of the repair sweep. A row
count was never the property under test — it conflated "the default path rolls up yesterday" (true,
and what the control exists for) with "and touches nothing else" (false by design).

The test now asserts the property directly. The relaxation is **mutation-proven non-vacuous**, each
restored byte-identical (`convex/aggregates.ts` sha256 `36bb0fe7…` before and after both):

| mutation | RED evidence |
|---|---|
| skip `rollupOneDay` on the zero-arg path | `no daily row for yesterday — the zero-arg (cron) path did not roll up the default day: expected undefined to be defined` |
| widen `rollupOneDay`'s day filter so the days merge | `expected 542 to be 42` |

A relaxation that merely stops failing is worthless; these two prove it still bites.

**The second failure is NOT claimed as fixed.** It appeared in one run and was not captured by name
before it cleared. It has not recurred across three subsequent full runs. `STATE.md` already
documents intermittent flakiness under parallel runs in the Phase 106 and Phase 115 test files, and
this is consistent with that — but "consistent with" is not "identified", and it is recorded as
unidentified rather than attributed.

## 3. `npm run build`

```
✓ built in 12.36s
BUILD_EXIT=0
```

Succeeds. The pre-existing `chunks are larger than 500 kB` advisory is unchanged by this phase.

## 4. `npx playwright test e2e/studio.spec.ts --project=chromium`

```
Running 4 tests using 4 workers
  ✓ D-16: clicking Studio in the COMMAND nav group reaches /studio and it renders (2.4s)
  ✓ D-07: a complete-recipe card and a no-provenance card render in the SAME grid, and their fields discriminate (3.1s)
  ✓ D-08: trash then restore round-trips through Gallery -> Trash -> Gallery (6.0s)
  ✓ D-02: the page fetches thumbnails and never the original media file (2.9s)
  4 passed (8.1s)
```

Run against the auth-disabled server (`PW_BASE_URL=http://localhost:5181`, started from **Git Bash**
— PowerShell's empty-string assignment deletes the variable and would silently leave the Clerk gate
live).

**Non-vacuity:** `grep -c 'test\.skip\|it\.skip' e2e/studio.spec.ts` → **0**. Control: the same
pattern finds skips in **4 other spec files** (`analytics-cache-tile`, `command-center-breakpoints`,
`quick-commands-stop`, `theme-contrast`), so the zero carries information rather than describing a
broken pattern.

**Both required mutations, RED then restored byte-identical:**

| mutation | RED evidence |
|---|---|
| remove the `No provenance recorded` badge from `MediaCard.tsx` | `Error: no "No provenance recorded" card in the grid — the sidecar-less control file is missing from media-vault\gen\, so D-07's pair cannot be proven` |
| make the `softDelete` handler a no-op in `MediaDetailSheet.tsx` | `expect(locator).toHaveCount(expected) failed / Expected: 0 / Received: 1` — **and only D-08 failed**; the other three stayed green, so the failure is targeted rather than collateral |

The **client** was mutated, never the Convex mutation, so nothing was deployed to the live backend.
Live data verified unchanged afterwards: **3 gallery rows, 0 with `deletedAt`**.

## 5. D-14 — the backup mirror, control-paired

`MediaVaultBackup` fired **unattended off its registered daily trigger**:

```
LastRunTime:    08/16/2026 06:30:01
LastTaskResult: 0
NextRunTime:    08/17/2026 06:30:00
Triggers:       1  (MSFT_TaskDailyTrigger, StartBoundary 2026-08-15T06:30:00-04:00)
```

Still exactly ONE trigger — a same-day one-time-trigger fallback was authored and **never run**, so
what fired is the registered daily encoding itself.

`C:\Users\mandr\media-vault\backup.log`, written by the run:

```
2026-08-16T06:30:02-04:00 START C:\Users\mandr\media-vault -> G:\My Drive\media-vault (6 mirrorable file(s) at source)
2026-08-16T06:30:02-04:00 ROBOCOPY=1 success: files copied
    Dirs  :  5 total, 5 copied, 0 skipped, 0 mismatch, 0 FAILED, 0 extras
    Files :  9 total, 6 copied, 3 skipped, 0 mismatch, 0 FAILED, 0 extras
2026-08-16T06:30:02-04:00 EXIT=0 (robocopy 1 is a success code)
```

**The outcome verified independently of what the log claims** — a log line is the action's report of
itself, not the state of the disk:

| check | result |
|---|---|
| `G:\My Drive\media-vault` exists | yes |
| files mirrored | **6** — `README.md`, 3 media files, 2 sidecars |
| every mirrored file SHA-256 vs its source | **byte-identical, 6 of 6** (hashed, not size-compared) |
| **CONTROL** — `backup.log` in the mirror | **ABSENT** (present locally, 1,067 b) |
| **CONTROL** — `studio-watch.log` in the mirror | **ABSENT** (present locally, 102,653 b) |
| **CONTROL** — `.studio-watch-state.json` in the mirror | **ABSENT** (present locally, 682 b) |

The three absences are the control the plan requires. Without them, "the mirror has files" is equally
consistent with a mirror that copied everything indiscriminately. Robocopy's own tally corroborates
from the other direction — **9 files seen, 6 copied, 3 skipped** — which is exactly the three
excluded names and no more. Two independent measurements of the same fact, agreeing.

The wrapper's non-empty-source precondition reported that it ran (`6 mirrorable file(s) at source`):
the guard that refuses to `/MIR` an empty source over the only copy of the originals.

**Assets present in the mirror:**

| plan | asset | in mirror |
|---|---|---|
| `118-12` | `gen\studio_lighthouse_a1_20260815T144604.png` + `.json` | yes |
| `118-13` | `gen\studio_falflux_a1_20260815T175919.png` + `.json` | yes |
| control | `gen\studio_control-no-sidecar_a1_20260815T144553.png` | yes |
| **`118-14`** | — | **does not exist yet; that plan has not run** |

Stated rather than omitted: the plan's criterion names "the assets generated in plans 118-12 through
118-14", and one of those three plans has not run.

## 6. D-04 — cadence proven by an observable side effect

`LastTaskResult` is explicitly **not** accepted as evidence here. `C:\Users\mandr\media-vault\studio-watch.log`:

```
total START lines: 305
first:  2026-08-15T09:50:39-04:00 START RepoRoot=C:\Users\mandr\codepulse
last:   2026-08-16T11:10:46-04:00 START RepoRoot=C:\Users\mandr\codepulse
```

Consecutive fires, sampled from the tail:

```
2026-08-16T10:45:39  10:50:39  10:55:39  11:00:39  11:05:39  11:10:46
```

**305 fires at a 5-minute cadence across 25½ hours**, every one later than the registration time
recorded in `118-09-SUMMARY.md`. Counting distinct `START` occurrences rather than log LINES is
deliberate — one fire emits three lines, and a line-counting probe would have called repetition
proven after a single fire (a defect caught and fixed during `118-09`).

## 7. Secret scan — run LAST, after every other write in this task

Run **after** §1–§6 and after this file was written, then again after the final edit. A disclosure
check that runs before the last write passes vacuously.

Fixed-string matching is used for every literal containing a backslash. A hand-escaped backslash
pattern silently returns zero — in a single-quoted BRE `\\` means ONE literal backslash and in
PowerShell's `-SimpleMatch` it means two — and this repo has been bitten by that exact false negative
more than once, most recently on a public-repo disclosure gate.

**Three known-positive controls trip first.** A clean result from a scanner never shown to detect
anything is a claim about the scanner:

```
CONTROL prefix:     PROVIDER_KEY_PREFIX
CONTROL assignment: CREDENTIAL_NAME_ASSIGNED_A_VALUE
CONTROL entropy:    HIGH_ENTROPY_TOKEN
```

| artifact | result |
|---|---|
| `hooks/studioFal.mjs` | **CLEAN** |
| `hooks/__tests__/studioFal.test.mjs` | **CLEAN** |
| `e2e/studio.spec.ts` | **CLEAN** |
| `convex/aggregates.test.ts` | **CLEAN** |
| `~/.claude/skills/studio-generate/SKILL.md` | **CLEAN** |
| the stored `z_image` `recipeMd` (pulled from Convex) | **CLEAN** |
| the stored `fal-ai/flux/schnell` `recipeMd` (pulled from Convex) | **CLEAN** |
| `118-09-SUMMARY.md` | **CLEAN** |
| `118-12-SUMMARY.md` | **CLEAN** |
| `118-13-SUMMARY.md` | **CLEAN** |
| `118-GATE-EVIDENCE.md` (this file) | **CLEAN** |
| `118-D09-EVIDENCE.md` | 1 hit (`:234`) |

**One finding, already classified twice.** `118-D09-EVIDENCE.md:234` is the plan-12 control file's
47-character timestamped filename tripping rule C — a **documented false positive**, recorded in
`convex/media.ts`'s own `detectCredentialValue` doc comment along with its remedy, and pinned by a
test carrying a shorter-filename control that proves it is a length threshold rather than a blanket
refusal of anything file-like. Not a credential; never was.

The literal values of `STUDIO_API_KEY` and `FAL_KEY` were **never read** by this task, so they cannot
have been written anywhere. Presence was confirmed only by boolean probe through the real resolver,
with a bogus variable name as the control returning `false`.

**Home paths, scanned separately with fixed-string matching** (`grep -F`, never a hand-escaped
pattern): this file carries **5** occurrences of the operator's home path. **Control:** the same
fixed-string probe returns **2** in the repo's own tracked `CLAUDE.md`, so the count is a real
measurement rather than a broken pattern returning a comfortable number. These are the operator's own
username in absolute paths, already present throughout this repo's tracked documentation including
`CLAUDE.md` itself — established precedent, not a new disclosure, and not a credential. Recorded so
the decision is visible rather than implied by silence.

---

## What is still open

| item | state |
|---|---|
| `118-14` — the OpenArt MCP leg (D-09's third) | **NOT RUN.** Blocked: the OpenArt MCP is configured only under the `nordic-mv-factory` project scope, so its tools are absent from a codepulse session. Needs `claude mcp add --transport http openart https://mcp.openart.ai/mcp` and a session restart. `118-02` also recorded a balance prerequisite: ≥ 10 credits, against 7 at measurement. |
| `118-15` Task 3 — the `D-01..D-16` roll-up | **NOT RUN**, deliberately. D-09 cannot be scored until `118-14` completes, and a roll-up with one provisional row reads as final. |
| `118-VALIDATION.md` sign-off + `nyquist_compliant` | **NOT TOUCHED.** A frontmatter flag is a durable claim and is not set on the basis that everything else passed. |

Everything in §1–§7 is complete and green as recorded.
