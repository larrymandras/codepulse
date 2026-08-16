---
phase: 118-studio-media-gallery
plan: 15
status: complete
completed: 2026-08-16
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16]
key-files:
  created:
    - e2e/studio.spec.ts
    - scripts/check-118-15-task3.mjs
  modified:
    - .planning/phases/118-studio-media-gallery/118-GATE-EVIDENCE.md
    - .planning/phases/118-studio-media-gallery/118-VALIDATION.md
---

# 118-15 — regression spec, full gate, and the D-01..D-16 roll-up

Tasks 1 and 2 (the e2e spec and the full phase gate) were completed in an earlier session and are
recorded in `118-GATE-EVIDENCE.md` §1–§7. **Task 3 — the roll-up and validation sign-off — was
deliberately left unrun then**, because D-09 could not be scored until `118-14` completed and a
roll-up carrying one provisional row reads as final. It ran now, in the order Larry approved and
recorded in STATE.md: `118-14`, then this, then the phase verifier.

## Result

**16 of 16 decisions PROVEN. 0 PARTIAL. 0 OPEN.** Full table with per-decision evidence:
`118-GATE-EVIDENCE.md` § Decision coverage roll-up.

Nothing was rounded up. Two decisions were specifically re-measured rather than scored from
documents, because their evidence shape invited a false green:

- **D-13 ("nothing is backfilled")** is an *absence* claim, which needs a control. The pattern
  returned **8 hits** in phase-118 files, not 0 — and reading them rather than the count showed all
  eight are either comments *stating* there is no backfill (`schema.ts:2475`) or other phases'
  tables in the shared `schema.ts`. Control: the same pattern finds real backfill code in **34**
  other `convex/*.ts` files, so the zero carries information.
- **D-02 (200 KB thumbnail cap)** claimed a live byte bound I had not measured. It is provable from
  the live rows after all: `media.ts:443` rejects `thumbBytes > THUMB_MAX_BYTES` server-side, so
  each of the 4 live rows carrying a `thumbStorageId` necessarily passed the cap — including a
  6,316,863-byte original, which produced a conforming thumbnail rather than refusing.

## D-15's deferred third leg is closed

`118-05` proved unauthenticated → `401` and bogus path → `404`, and stated honestly that the pair
**cannot** distinguish a real auth gate from a handler hardcoded to 401. The missing leg — a request
with the correct bearer that reaches the mutation — was blocked then (no `STUDIO_API_KEY`, and the
`STUDIO_ALLOW_ANON` fallback was denied by the permission classifier and correctly not worked
around).

It closed as a side effect of `118-14`'s proof: `STUDIO_API_KEY` is now set, and the watcher cycle
POSTed through `bearerFetch` with the correct bearer and reported `ingested=1`, with the row read
back out of Convex afterwards. The watcher halts on a 401 (`studioWatch.mjs:1102`), so `ingested=1`
could not have come from a rejected request. That is strictly better evidence than the originally
planned `400 MISSING_FIELD` probe — it exercises the whole production write path, not just the auth
branch — and no key value was handled by this session.

## Validation sign-off

`118-VALIDATION.md`: `status: complete`, `wave_0_complete: true`, `nyquist_compliant: true`, every
map row filled with its plan/wave and set green, every sign-off box ticked.

`nyquist_compliant` was set on measurement, not on the phase otherwise passing: **45 of 45** tasks
across all 15 plans carry an `<automated>` block, and the longest consecutive run without one is
**0**. Controls: a `<nonexistent_tag>` probe returns 0/45 so the parser discriminates, and phase 113
returns 24/24 so 45/45 is the house standard rather than an artifact.

**Caveat recorded in the approval note rather than smoothed over:** "has an `<automated>` block" is
a claim about presence, not about the check being sound. This phase found **nine** checks that
passed while blind to what they existed to assert. The PROVEN verdicts rest on the mutation evidence
attached to each decision, not on that count.

## Deviations

**The plan's Task 3 `<automated>` check cannot be run correctly from a shell.** Its `\\b` word
boundaries are eaten by shell escaping and arrive as literal backspace characters, so the regex
matches nothing and it reports **all sixteen** decisions missing. That failure is at least loud — an
all-16 result is obviously an invocation fault rather than a finding — but a check that can only be
run wrong is not a check. Moved to `scripts/check-118-15-task3.mjs`, which also strengthens it:
scoped to the roll-up section (a decision id mentioned elsewhere in the 500-line gate log must not
satisfy it), requires a status verdict per decision, and requires each of D-01 / D-07 / D-08 to be
individually claimed rather than summarised as "all present".

Its first version then miscounted its own verdicts — `{"PROVEN":17,"PARTIAL":1,"OPEN":1}` for a
table containing 16 PROVEN and nothing else, because the status-rules legend above the table bolds
each verdict word in order to define it. Left alone it would have reported two unproven decisions
that do not exist. Now counted from table rows only: `{"PROVEN":16}`. Mutation matrix: 5 real
failure modes RED, 1 control GREEN, gate evidence restored byte-identical.

**`118-GATE-EVIDENCE.md`'s "What is still open" section was rewritten, not deleted** — all three of
its items are now closed, and a stale open-items list next to a completed roll-up is exactly the
kind of contradiction that gets read as ground truth later.

## Self-Check: PASSED

- `node scripts/check-118-15-task3.mjs` — PASS, 16 verdicts, all three pairs individually asserted
- `npx tsc --noEmit` — exit 0
- full `npx vitest run` — 4651 passed, 0 failed, 332 files
- `npx playwright test e2e/studio.spec.ts` — 4 passed (recorded in §4, both mutations RED)
- secret scan re-run AFTER every write in this task
