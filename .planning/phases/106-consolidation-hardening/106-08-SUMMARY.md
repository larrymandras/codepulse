---
phase: 106-consolidation-hardening
plan: 08
subsystem: testing
tags: [uat, forge-daemon, skill-lifecycle, drag-drop, cr-02, manual-verification, phase-closeout]

# Dependency graph
requires:
  - phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
    provides: "The drag-lane matrix (resolveScopeDrop), the CR-02 lane threading in SkillRow/ScopeRail, and 100-HUMAN-UAT.md — whose Test 1 PASS and Test 2 UNIT-VERIFIED status are this plan's factual basis"
  - phase: 106-consolidation-hardening
    provides: "106-06's disk-staging technique and 106-07's session-B results; both feed 106-HUMAN-UAT.md, which this plan closes"
provides:
  - "The first shadowed-merged skill row ever present in this project's live catalog, and the first live exercise of the CR-02 Cold Storage no-op against it"
  - "A live re-verification of the Forge-daemon drag round-trip across five legs, evidenced from forgeCommands rows rather than from UI state"
  - "106-HUMAN-UAT.md closed at status: passed with 9/9 reconciled across three sessions"
  - "DEBT-01..04 markers in REQUIREMENTS.md rewritten from cited artifacts, with DEBT-03 held at PARTIAL and its blocker named"
  - "STATE.md's stale Phase-100 claim corrected"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["An invalid trial is worth keeping as a CONTROL rather than discarding: trial 1 of test 9 (wrong source lane) and trial 2 (correct lane) differ in exactly one variable and produce different toasts, which discriminates a client-side no-op from a server-side rescue — a distinction the zero-row count alone cannot make"]

key-files:
  created:
    - .planning/phases/106-consolidation-hardening/106-08-SUMMARY.md
  modified:
    - .planning/phases/106-consolidation-hardening/106-HUMAN-UAT.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Test 8's leg ORDER was corrected before the session (Deviation 2, recorded in Task 1): the plan sequenced archive → move-to-project, but after an archive the row's only origin is claude-code:available, so resolveScopeDrop's dormant branch returns reject('Restore to Global first, then move.') at skills.ts:122. Larry would have seen a red rejection where the plan promised a workspace picker. Corrected to archive → restore → project → global → induced failure; no coverage dropped."
  - "Trial 1 of test 9 was recorded as an INVALID trial rather than as a FAIL. It dragged from Overview/All (lane defaults to 'active' at SkillRow.tsx:99) instead of from ColdStorageView (the only caller passing lane='cold', ColdStorageView.tsx:59), so it resolved to a genuine archive — the correct intent from that view — and the server refused it on the name collision. That is not CR-02."
  - "The rescan trigger was one archive→restore round-trip on enhance-prompt through the signed-in UI. Both shortcuts were refused again: CLI --identity impersonation (denied in session A, not worked around) and the bearer token observed in the daemon's own window.__FORGE_CONFIG__ (the same bypass by another route)."
  - "enhance-prompt was chosen for the trigger only after verifying it carries a single claude-code origin with no dormant copy, so the archive could not trip the LAYER-1 collision guard that trial 1 had just demonstrated is live."
  - "DEBT-03 is marked PARTIAL, not SATISFIED: the entry chunk is 563,616 bytes against a 512,000-byte threshold. chunkSizeWarningLimit was not raised to make the requirement appear met."

patterns-established:
  - "Close a UAT artifact only after asserting its own gate: zero blank `result:` lines, and Summary counts re-derived against every `### N.` section rather than incremented."

requirements-completed: [DEBT-01, DEBT-02, DEBT-04]

# Metrics
duration: ~95min (live session 21:10-21:45 UTC plus close-out)
completed: 2026-08-05
---

# Phase 106 Plan 08: UAT Session C & Phase Close-Out Summary

**The Forge-daemon drag round-trip re-verified live across five legs, and Phase 100's genuinely-open CR-02 shadowed-row no-op closed for the first time against the first shadowed-merged row this project's catalog has ever held — 9/9 across three UAT sessions, zero residue, zero source files modified.**

## Accomplishments

### Test 8 — drag round-trip (D-08 re-verification): PASS, five legs

Evidenced from `forgeCommands` rows read out of the live self-hosted backend, not from UI state — an optimistic overlay cannot manufacture a claim→execute→complete chain:

| Leg | Action | Origin → dest | Claim latency | Status |
|---|---|---|---|---|
| A | archive | `claude-code` → cold | 5.33 s | done |
| B | restore | `claude-code:available` → global | 3.54 s | done |
| C | move | `claude-code` → project | 1.09 s | done |
| D | move | `claude-code:project:559ce8ebf812` → global | 2.16 s | done |
| E | archive | `claude-code` → cold | never claimed | **expired** |

Leg C carries two corroborations independent of the UI: its `workspaceId` is byte-identical to the `drive-sync-test` id recorded pre-session, and leg D's `sourceOrigin` is a **fifth** project origin absent from the pre-session 4-origin census — which the registry could only mint if the skill genuinely came to live there.

**Leg E is the point of the test and it passed on a better observable than predicted.** The row aged out with `claimedAt`/`executedAt`/`completedAt` all null and the subject skill still on disk. The plan predicted the surfacing would be the transient `Expired — no daemon claimed this command.` toast (`usePendingLifecycleMoves.ts:49`); what appeared is a **persistent `Expired` row badge** (`RowStatusBadge`, `IntakeStatusBadge.tsx:91-94`). Recorded as a corrected prediction rather than reconciled away. It errs in the right direction — the assertion was that the pending state must not settle silently into something resembling success, and a persistent badge is harder to miss than a toast that disappears.

The known false-signal was excluded by measurement, not assumption: Larry quit Forge from the **tray** (the supervisor, PID 33516) rather than killing only the daemon (PID 33616), and `:57328/health` was confirmed refusing connections before the leg-E drag. A tray-respawned daemon would have claimed the queued command and turned a never-run leg into a recorded pass.

### Test 9 — CR-02 shadowed-row no-op: PASS, and it closes the item Phase 100 left open

Phase 100 accepted this as unit-verified for a stated reason: "the live catalog contains 0 shadowed-merged skills … fabricating one was deferred by operator." That condition was re-measured this session and still held (0 of 488 names carried both a dormant and a non-dormant origin), so `uat106-shadow` is **the first shadowed-merged row this catalog has ever held**. The Cold Storage count badge corroborated the fixture independently — 81 against a census of 80 dormant-only names.

**An invalid first trial turned into the test's control.** Trial 1 dragged the row from Overview/All, where `lane` defaults to `"active"` (`SkillRow.tsx:99`) because only `ColdStorageView.tsx:59` passes `lane="cold"`. With `isDormant()` false for a shadowed row, the lane is the *only* thing that can force `dormant` (`skills.ts:59`), so the drop fell to `skills.ts:131` and enqueued a real archive — the correct intent from that view — which the server's LAYER-1 preflight refused with `a dormant copy already exists in cold storage`.

Trial 2, from inside Cold Storage, produced the quiet `"Uat106 Shadow" is already in Cold Storage — nothing to move.`

The two trials differ in exactly one variable and yield different toasts, which resolves an ambiguity the row count cannot: **both** trials wrote zero rows, but the collision message can only exist if `enqueueLifecycle` was actually called, whereas the quiet message is emitted at `Skills.tsx:337-339` on the `noop` branch — before `beginPending`, before any mutation. So the client-side CR-02 no-op fired **on its own**; the server backstop was never reached. Per the test's own `expected:`, a collision toast on the real gesture would have been a FAIL — it appeared only on the invalid one.

The live active copy survived on disk (888 b), as did the dormant half (859 b).

## Deviations from Plan

1. **Leg order corrected before the session** (recorded in Task 1 as Deviation 2). The plan's `archive → move-to-project` sequence cannot succeed: post-archive the row is dormant-only, so `resolveScopeDrop` returns `reject("Restore to Global first, then move.")` at `skills.ts:122`. Reordered to archive → restore → project → global → induced failure. All intended legs still exercised.
2. **Trial 1 of test 9 recorded, not discarded.** It was an invalid trial (wrong source lane), not a CR-02 failure. Keeping it supplied the control described above.
3. **An unplanned ~56-row registry reconciliation was investigated rather than absorbed.** The `claude-code` origin went 185 → 129 real rows during the session. This was the daemon's own `computeSkillPrunes` running on rescans that our test drags triggered, removing rows for names with no directory on disk. Proven safe by set-diffing registry against filesystem rather than comparing counts: 131 registry names vs 131 disk directories, the only registry-side divergence being this plan's own fixtures, and the only disk-side divergence `_archived` / `mandras_made_skills` — neither of which has a `SKILL.md`, so the daemon correctly excludes them. **No name that exists on disk was pruned.** Recorded in `106-HUMAN-UAT.md` § Session C cleanup B, because a close-out claiming "zero residue" while silently changing 56 rows in the live registry would misrepresent the session.
4. **One REQUIREMENTS.md clause outside this plan's scope was already corrected by 106-05** (DEBT-03's "has not started" claim about the Tailscale half). This plan completed the remaining DEBT-01..04 reconciliation as its own Task 3 assigned.

## Stale claims corrected (Stale Docs rule)

- **STATE.md** asserted Phase 100's drag round-trip "remains outstanding, same category as Phase 98/99's own deferred manual checks." `100-HUMAN-UAT.md` Test 1 records it `PASSED (operator-verified live 2026-07-25)` — one day *after* that 2026-07-24 note was written. Struck and replaced with what was genuinely open (Test 2's CR-02 no-op) and what this plan did about it. Applied as a single asserted string replacement; the surrounding block was not rewritten, per this file's documented clobber history.
- **REQUIREMENTS.md DEBT-02** still carried 106-01's `PRE-FLIGHT BLOCKED (NO-GO)` verdict, superseded by 106-03 on 2026-08-05. Now `✓ SATISFIED`, written from `106-03-SUMMARY.md`, with the superseded verdict retained inline for audit.
- **REQUIREMENTS.md DEBT-04** still said "SESSIONS B/C PENDING" after both had run. Now `✓ SATISFIED`, written from `106-HUMAN-UAT.md` § Summary.

## Requirement markers

| Req | Marker | Basis |
|---|---|---|
| DEBT-01 | ✓ SATISFIED | `106-DEBT-VERIFICATION.md` § DEBT-01 (unchanged) |
| DEBT-02 | ✓ SATISFIED | `106-03-SUMMARY.md` — 602,932-row archive, provenance proven from data, deployment deleted **and** subscription cancelled |
| DEBT-03 | ⚠ **PARTIAL** | D-10 half satisfied (`106-TAILSCALE-CHECKLIST.md`, 7/7). **Blocker named:** entry chunk **563,616 B, still above 512,000**; `chunkSizeWarningLimit` deliberately not raised |
| DEBT-04 | ✓ SATISFIED | `106-HUMAN-UAT.md` § Summary — 9 tests / 9 pass / 0 issues / 0 blocked across three sessions |

DEBT-03 is the one item this phase did not close. It is marked PARTIAL with its residual named rather than rounded up.

## Cleanup

Fixture directories enumerated first (a `*uat106*` sweep across all three scan roots returned exactly the three staged paths and nothing else), then removed. `drive-sync-test` was **not** deleted — this plan reused it, did not create it.

Registry reconciliation used the daemon's own rescan, triggered by one archive→restore round-trip on `enhance-prompt` through the signed-in UI. Both shortcuts were refused again for the reasons recorded in Task 1: CLI `--identity` impersonation, and the bearer token visible in the daemon's `window.__FORGE_CONFIG__`.

```
before rescan: 646 rows, 3 uat106 rows
after  rescan: 643 rows, 0 uat106 rows     <- delta exactly 3
```

The **delta of exactly 3** shows the prune removed this plan's residue and nothing else — which a bare "0 uat106 rows" would not have shown. Disk sweep after the rescan: 0 `uat106-*` directories in all three roots. The trigger skill was verified returned to its original state, not left half-moved: `enhance-prompt` carries a single `claude-code` origin, is present in `skills\`, and has no leftover in `skills-available\`.

## Issues Encountered

None that survived investigation. The 56-row reconciliation looked alarming until measured and is documented above as correct daemon behaviour.

## Next Phase Readiness

**Phase 106 is complete — 8/8 plans.** DEBT-01/02/04 satisfied; DEBT-03 PARTIAL with its blocker named.

The milestone's remaining open item is **OCC-01** (Phase 107): all 6 plans executed but `VERDICT: FAIL`, with the read set identified as the unsharded lever (`convex/analyticsRollup.ts:43-54` and `:101-111` `.collect()` the whole bucket). A 107-07 gap-closure plan — index `shard`, range-bound the bucket lookup — is the next work. Raising `AGGREGATE_SHARD_COUNT` first is contraindicated by 107-06's own evidence.

## Self-Check

- ✅ Both new `result:` lines filled from observed behaviour, quoting verbatim toast text; `grep -c '^result: *$'` → **0** (the plan's own automated gate).
- ✅ Test 8's result records the on-disk outcome, and states explicitly which legs were executor-verified vs inferred — leg C's transient in-workspace presence is marked inferred, not claimed as measured.
- ✅ Leg E's actual surfacing recorded verbatim, with the plan's own prediction marked corrected; no false success appeared.
- ✅ Test 9's result records the ACTIVE copy surviving, verified in the UI and on disk, with zero command rows across both trials.
- ✅ Each section carries a `pass` verdict; Summary counts re-derived against all 9 sections.
- ✅ Forge daemon confirmed restarted and healthy (tray 34020 / daemon 38964, health 200, heartbeat advancing 14.0 s).
- ✅ `git status --porcelain convex src` → empty.
- ✅ No bulk delete or patch issued against the live self-hosted Convex at any point.
