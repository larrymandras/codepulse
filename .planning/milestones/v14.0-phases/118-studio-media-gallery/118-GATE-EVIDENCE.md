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

**RESOLVED 2026-08-16 — this section is superseded by the roll-up below.** It is rewritten rather
than deleted so the earlier state stays legible; all three items were open when §1-§7 were written
and none is open now.

| item | state then | state now |
|---|---|---|
| `118-14` — the OpenArt MCP leg (D-09's third) | NOT RUN: the OpenArt MCP was scoped to another project, and the balance was 7 credits against a 10-credit floor | **CLOSED.** MCP added to codepulse scope and authenticated; balance topped to 24000; `kling-3-omni` generated for 10 credits and landed in the gallery with a complete recipe. `118-D09-EVIDENCE.md` § `LEG: third — the proof` |
| `118-15` Task 3 — the `D-01..D-16` roll-up | NOT RUN, deliberately — D-09 could not be scored until `118-14` completed | **DONE**, below. 16 of 16 PROVEN, 0 PARTIAL, 0 OPEN |
| `118-VALIDATION.md` sign-off + `nyquist_compliant` | NOT TOUCHED — a frontmatter flag is a durable claim | **SIGNED OFF.** `nyquist_compliant: true`, each box measured with controls, and the one caveat recorded in the approval note |

Everything in §1-§7 remains complete and green as recorded.

## Decision coverage roll-up

Written 2026-08-16 at plan `118-15` Task 3, **after** `118-14` closed D-09 — the ordering Larry
approved and recorded in STATE.md, because scoring D-09 before its third leg ran would have put a
provisional row in a document that reads as final.

Status rules, applied strictly:

- **PROVEN** requires evidence that would have looked DIFFERENT had the mechanism been broken. A
  green test whose control was never checked is not PROVEN.
- **PARTIAL** for implemented but not exercised against reality — with the gap named.
- **OPEN** for anything skipped. **Not rounded up because everything else passed.**

| # | Decision | Plan(s) | Evidence | Status |
|---|---|---|---|---|
| D-01 | Thumbnails to Convex file storage; branch resolved first | 118-01 | `118-D01-EVIDENCE.md`. Branch `convex-storage`. Control-paired: a successful upload round-trip **and** an orphaned `avatars` storage id resolving `null` in the same run | **PROVEN** |
| D-02 | Hard 200 KB webp cap; browser never loads the original | 118-08, 118-15 | Encoder-loop units in `studioWatch.test.mjs`; e2e "the page fetches thumbnails and never the original media file"; **and the live rows**: `media.ts:443` rejects `thumbBytes > THUMB_MAX_BYTES` server-side, so all 4 live rows carrying a `thumbStorageId` necessarily passed the cap — including a 6,316,863-byte original, the hardest case, which produced a conforming thumbnail rather than refusing | **PROVEN** |
| D-03 | `media` / `mediaStyles` / `mediaModels` exempt from `RETENTION_DAYS` | 118-03 | `convex/retention.test.ts` asserts the three tables carry no key, plus the exemption comment. A test fails if anyone "fixes" it by adding one | **PROVEN** |
| D-04 | Scheduled task every 5 min + manual `/studio-sync` | 118-09 | `118-GATE-EVIDENCE.md` §6 — cadence proven by an **observable side effect**, not by `LastTaskResult` (which cannot distinguish "never fired" from "fired and succeeded") | **PROVEN** |
| D-05 | Row identity is the file's content SHA-256 | 118-07, 118-08 | `studioWatch.test.mjs` hashing units; live: this session's cycle reported `rehashed=1` for the one changed file | **PROVEN** |
| D-06 | A duplicate hash is an idempotent no-op, never a second row | 118-07, 118-08 | Units, **and live**: this session's cycle reported `ingested=1 duplicates=3` against 4 candidates. The 3 is the discriminating half — a broken dedup would have re-ingested them | **PROVEN** |
| D-07 | No sidecar → provenance explicitly ABSENT, never inferred | 118-04, 118-10, 118-11 | e2e control pair, mutation-proven (removing the badge → RED). **And live**: the sidecar-less control row sits in the same `api.media.list` response as a complete-recipe row, with `prompt`/`provider` absent | **PROVEN** |
| D-08 | Soft-delete = flags then watcher moves; grace period visible | 118-06, 118-11 | e2e `Gallery → Trash → Gallery` round-trip, mutation-proven (no-op `softDelete` → RED, **and only D-08 failed**, so the failure is targeted not collateral); 30-day janitor batch logic in `media.test.ts` | **PROVEN** |
| D-09 | Three backends proven end-to-end, genuinely different shapes | 118-12, 118-13, 118-14 | `118-D09-EVIDENCE.md`, three `LEG:` sections. CLI subprocess / our own HTTP queue-poll client / in-session MCP tool call. Each landed a real asset in the gallery with complete provenance | **PROVEN** |
| D-10 | Ástríðr as a generator DEFERRED to SEED-028 | 118-12 | `docs/studio-sidecar-contract.md` §10 — the deferral is documented **with the full handoff**, which is what the decision asked for. The decision was to defer legibly, and the legibility is the artifact | **PROVEN** |
| D-11 | One `/studio-generate` wrapper owns sidecar writing; the eight existing skills untouched | 118-12, 118-14 | The wrapper is the only sidecar writer. All **eight** verified untouched: 0 of 446 files modified, with `studio-generate` itself showing 1 as the control proving the probe detects modification | **PROVEN** |
| D-12 | Recipe cards only for models proven end-to-end; NAMES not values | 118-12, 118-13, 118-14 | Three cards for exactly the three proven models (`z_image`, `fal-ai/flux/schnell`, `openart-kling-3-omni`) and none for any unrun model. Each accepted by the **deployed** `detectCredentialValue` guard, then pulled back **out of Convex** and re-scanned clean. See the named gap below | **PROVEN** |
| D-13 | Greenfield — nothing is backfilled | 118-03 | No backfill/seed/migration path for any of the three tables. The pattern's 8 hits across phase-118 files are all either comments *stating* there is none (`schema.ts:2475` — "no backfill exists for this table (D-13) — it starts empty") or other phases' tables in the shared `schema.ts`. Control: the same pattern finds real backfill code in **34** other `convex/*.ts` files, so the zero carries information | **PROVEN** |
| D-14 | `MediaVaultBackup` nightly robocopy mirror, in-phase | 118-09 | `118-GATE-EVIDENCE.md` §5 control-paired, and closed by the **real unattended 06:30:01 fire** off its registered daily trigger with `LastTaskResult 0` — an observable side effect, not a task-scheduler status field | **PROVEN** |
| D-15 | Ingest route bearer-gated, fail-closed, no CORS/OPTIONS partner | 118-05 (+ closed this session) | See below — the deferred third leg is now closed | **PROVEN** |
| D-16 | `/studio` in the COMMAND nav group | 118-10 | e2e **real click-through** from the nav group, not a route-exists assertion | **PROVEN** |

**16 of 16 PROVEN. 0 PARTIAL. 0 OPEN.**

### D-15's deferred third leg — closed by this session's watcher run

`118-05` proved two legs live and **explicitly deferred the third**, honestly: unauthenticated
`POST /studio/ingest` → `401`, and a bogus path → `404`. That pair is genuinely discriminating (the
router matches a real handler, so the 401 comes from the handler rather than a catch-all) but, as
`118-05-SUMMARY.md` states in its own words, it **cannot distinguish a correctly auth-gating handler
from one hardcoded to always 401**. The missing leg was a request carrying the correct bearer that
actually reaches the mutation. It could not be run then: `STUDIO_API_KEY` was unset, and the
sanctioned `STUDIO_ALLOW_ANON=true` fallback was denied by the permission classifier and correctly
not worked around.

It is closed now, and by the real production path rather than a bypass. `STUDIO_API_KEY` is set on
the deployment (verified names-only). This session's `node hooks/studioWatch.mjs` cycle POSTed
through `bearerFetch` (`studioWatch.mjs:571`, `:716`) to `/studio/ingest` **with the correct
bearer**, reported `ingested=1`, and the row was then read back out of Convex. The watcher halts
immediately on a 401 (`studioWatch.mjs:1102`), so `ingested=1` could not have been produced by a
rejected request.

Three-way, complete:

| leg | request | result |
|---|---|---|
| experimental | no `Authorization` header, valid body | `401 Unauthorized` |
| control A | correct bearer, real body | **reaches the mutation — row created** |
| control B | correct bearer, bogus path | `404 No matching routes found` |

This is strictly better evidence than the originally-planned `400 MISSING_FIELD` probe: it exercises
the whole production write path rather than only the auth branch. No key value was ever handled by
this session — the watcher read it from its own environment.

---

## Mandatory control pairs

All three from `118-VALIDATION.md` § Control-Pair Requirement, each with where it is asserted.

**1. D-01 — upload round-trip paired with a known-null control.**
`118-D01-EVIDENCE.md`. A successful upload round-trip **in the same run as** an orphaned `avatars`
storage id resolving `null`. Without the null half, "the URL resolved" would look identical to a
resolver that returns a URL for anything.

**2. D-07 — a complete recipe and a sidecar-less card in the SAME grid view.**
`e2e/studio.spec.ts` — "a complete-recipe card and a no-provenance card render in the SAME grid, and
their fields discriminate", mutation-proven by removing the `No provenance recorded` badge from
`MediaCard.tsx` (RED). Independently re-confirmed live this session: both rows come back in a single
`api.media.list` call, one with the full prompt and `provider=openart`, the other with `prompt` and
`provider` absent.

**3. D-08 — soft-deleted row absent from Gallery, present in Trash, and RESTORED.**
`e2e/studio.spec.ts` — "trash then restore round-trips through Gallery → Trash → Gallery", covering
all three states rather than stopping at the first two as the design doc's own gate does.
Mutation-proven by making `softDelete` a no-op (RED), and **only that test failed**, so the mutation
was targeted rather than collateral. The client was mutated, never the Convex mutation, so nothing
was deployed; live data verified unchanged afterwards.

---

## Findings carried out of this phase

**A real gap in `detectCredentialValue`, surfaced and deliberately NOT fixed.** Rule A's name
alternation is `API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL`, so `FAL_KEY=<value>` and
`ANTHROPIC_KEY=<value>` are not caught — `_KEY` alone is not in it. Rule C cannot save them: its
bound is exactly 40 unbroken `[A-Za-z0-9_-]` characters (39 → false, 40 → true), and a realistic
fal.ai key `<uuid>:<32-hex>` is 69 chars whose longest unbroken run is 36. A pasted real `FAL_KEY`
value would pass the guard. This does not contradict the guard's docstring, which calls itself a
backstop and lists "a secret that simply does not look like one" as out of scope — it is recorded
because `FAL_KEY` is this repo's own primary provider credential, so the likeliest paste is the one
the pattern misses. Not fixed here because the guard belongs to closed plan `118-12` and widening a
security predicate without its own control pairs is how a guard that refuses legitimate cards ships.

**Nine defective checks or silent passes were found across this phase**, every one of which passed
while blind to the thing it existed to assert. The last two were in `118-14`: a whole-file substring
check that stayed GREEN when the branch string was changed, and a module that **exited 0 having done
nothing** because its `main()` was never invoked. That running total is the phase's most transferable
output, and it is why no gate here was believed on its green alone.


---

## 7b. Secret scan RE-RUN — 2026-08-16, after every write in `118-14` and `118-15` Task 3

§7's scan predates this session's writes, so it had gone vacuous for the new artifacts. Re-run with
the same three known-positive controls tripping first (`A` name-assignment, `B` provider prefix,
`C` high-entropy token) — a clean result from a scanner never shown to detect anything is a claim
about the scanner.

| artifact | result |
|---|---|
| `hooks/studioThirdLeg.mjs` | **CLEAN** |
| `hooks/__tests__/studioThirdLeg.test.mjs` | **CLEAN** |
| `scripts/check-118-14-task1.mjs` | **CLEAN** |
| `scripts/check-118-15-task3.mjs` | **CLEAN** |
| `118-14-SUMMARY.md` | **CLEAN** |
| `118-15-SUMMARY.md` | **CLEAN** |
| `118-GATE-EVIDENCE.md` (this file) | **CLEAN** |
| `118-VALIDATION.md` | **CLEAN** |
| `~/.claude/skills/studio-generate/SKILL.md` | **CLEAN** |
| the stored `openart-kling-3-omni` `recipeMd` (pulled from Convex) | **CLEAN** |
| `118-D09-EVIDENCE.md` | 4 hits — all classified below |

**All four `118-D09-EVIDENCE.md` hits are benign, and each was opened and read rather than waved
through on a rule name:**

- `:234` and `:641` — the 47-character timestamped control filename tripping rule C. The documented
  false positive, recorded in `convex/media.ts`'s own doc comment with its remedy and pinned by a
  test carrying a shorter-filename control. `:641` is this session's new occurrence of the same
  string.
- `:634` — the media file's **SHA-256 content hash** (64 hex chars). It is the row's public
  identity, already stored in Convex, and is not credential material.
- `:670` — `HIGGSFIELD_API_KEY=hf3x9q2v8m1p0zt4`, which is the `detectCredentialValue` **docstring's
  own example**, quoted while documenting rule A's behaviour. Verified with a fixed-string search
  that it already exists in tracked source in **three** places (`convex/media.ts:819`,
  `convex/media.test.ts:979` and `:1052`); control: a deliberately bogus string returns 0 hits, so
  the probe discriminates. Quoting it introduces no new disclosure.

**Home paths**, fixed-string (`grep -F`, never a hand-escaped backslash pattern): of the six files
written this session, exactly **one** contains the operator's home path — `studioThirdLeg.test.mjs`,
asserting the vault-root default constant. **Controls:** the repo's own tracked `CLAUDE.md` returns
**2**, and **243** tracked files repo-wide contain it, so the count is a real measurement and the
precedent is long established. Not a credential, not new.

The literal values of `STUDIO_API_KEY` and `FAL_KEY` were **never read** by this session. The
watcher read `STUDIO_API_KEY` from its own environment; `npx convex env list` was run through a
name-only filter (`| ForEach-Object { ($_ -split '=')[0] }`), never bare, because against this
self-hosted backend the bare form prints full `NAME=VALUE`.
