---
phase: 110-convex-durability
verified: 2026-08-11T14:30:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 110: Convex Durability Verification Report

**Phase Goal:** `aggregates` bounded by the existing batch-capped retention machinery, a verified full nightly prune pass, and the memory-growth root cause documented
**Verified:** 2026-08-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `aggregates` is bounded and pruned in batch-capped increments (DUR-01), period-aware, never a bulk delete | ✓ VERIFIED | `convex/retention.ts:38-121` — `aggregates: 90` in `RETENTION_DAYS`; `PRUNE_PREDICATES.aggregates = (doc) => doc.period !== "daily"` (`retention.ts:140-142`), tested at `retention.test.ts:111-125` against both `period` values, not against a comment. Live confirmation (110-06, `110-DUR-EVIDENCE.md` "DUR-01 live confirmation"): oldest `period:"daily"` row byte-identical pre/post real prune (`_creationTime 1778029200021.6772` unchanged); oldest `period:"hourly"` row's `_creationTime` moved forward ~49.9 days (control satisfied — predicate is actually pruning, not skipping everything). |
| 2 | The delete loop sources `lastCreationTime` from every doc read, not only deleted ones (Pitfall-1 fix), so a predicate-skipped batch still advances the cursor | ✓ VERIFIED | `convex/retentionCursor.ts:141-154` `partitionBatchForPrune` sets `lastCreationTime` from every iterated doc (`for (const doc of batch) { ...; lastCreationTime = doc._creationTime; }`), independent of whether it lands in `toDelete`. Guarded by `retentionCursor.test.ts:159-201`, including an explicit negative control ("the negative control proving the test above is not vacuous") that feeds `lastCreationTime: null` and shows the cursor would otherwise stay unchanged. |
| 3 | The rotation cursor replaces the hardcoded `tableIndex: 0` start, so a capped run doesn't always restart at the firehose head | ✓ VERIFIED | `grep -c "tableIndex: 0," convex/retention.ts` → `0`. `startNightlyPrune` (`retention.ts:158-181`) reads a persisted `agentConfigs` row via `resolveRotationStart` (bounds-checked, untrusted-input-safe, `retentionCursor.ts:246-256`, 7 test cases incl. NaN/negative/out-of-range). Live: pre-deploy cursor row confirmed absent (110-04 Probe 4), post-prune reads `value: 0`, exactly one row, `updatedAt` inside the observed run window (110-06). |
| 4 | `listRetentionPolicy` exists and is `internalQuery`, not a public `query` (no security regression) | ✓ VERIFIED | `convex/retention.ts:347-350`: `export const listRetentionPolicy = internalQuery({...})`. `grep -n "internalQuery" convex/retention.ts` shows it imported at line 1 and used at both `listRetentionPolicy` (347) and `oldestPrunableDoc` (379) — no `query(` downgrade anywhere in the file. Live-confirmed reachable only via `npx convex run --env-file <path> retention:listRetentionPolicy` (the authenticated CLI/env-file shape), not as a public endpoint (110-DUR-EVIDENCE.md "Function form shipped"). |
| 5 | A full nightly pass across every table in `RETENTION_DAYS` is observed on the live instance, not read from code (DUR-02) | ✓ VERIFIED | `retention-health-check.ps1` on disk (`C:/Users/mandr/convex-selfhost/retention-health-check.ps1:61`) confirmed reading `retention:listRetentionPolicy` live — zero hand-copied `$RetentionDays` hits, zero "Keep in sync" hits (re-checked directly, not only via the evidence file's own grep). Coverage: 14→19 tables (three-way cross-check: script `tables=19`, source `RETENTION_DAYS.length=19`, deployed readback `19` keys — all equal). Completion: `_scheduled_functions` durable record (110-06) shows 268 `pruneBatchV3` invocations inside the 09:00–09:20 UTC cron window, distinct `tableIndex` covering `[0..18]` (19/19, no gaps), `stateCounts: {"success": 268}`, zero non-success rows — corroborated by the independent 05:30 UTC post-prune health check (`verdict=OK tables=19`, all caught up or sub-hour overhang) and by the rotation cursor (`value: 0`, one row, timestamp inside the window). |
| 6 | Memory-growth root cause is probed for a bounding knob and, either way, documented as understood, with `ConvexNightlyRestart` recorded as deliberate (DUR-03) | ✓ VERIFIED | `110-MEMORY-EVIDENCE.md`: 6 candidate knobs probed with a control-paired binary grep (known-present `DOCUMENT_RETENTION_DELAY` hits, known-absent bogus var returns 0); only that one knob is actually set on the container, and it governs tombstone GC, not working-set. Summed bounded budget of the candidate caches (~1.44–2.44 GiB) re-derived from live `knobs.rs`, shown incapable of explaining the observed ~15.7 GiB/14.7h climb. Strongest candidate contributor identified and live-re-verified via `gh issue/pr view` at execution time: upstream `#495` (open, community-filed) with fix `PR #522` (open, unmerged). `#525` ruled out with a positive control (0 `.searchIndex()`/`.vectorIndex()` vs. 288 `.index()` in `schema.ts`). Per D-09/D-10, closes as documented (no knob to enable). `CLAUDE.md:94` carries the D-11 bullet: "`ConvexNightlyRestart` is deliberate, not an unexplained workaround," with the growth rate, the knob-absent finding, and a pointer to the evidence file. |
| 7 | The D-01/D-03 keep-forever guard is narrowed (not deleted) — `llmMetrics`/`sessions`/`alerts` stay absent from `RETENTION_DAYS`; `aggregates` is protected by a positive predicate assertion instead | ✓ VERIFIED | `retention.test.ts:95-125` — `keepForever` loop still asserts `llmMetrics`/`sessions`/`alerts` absent; a separate test asserts `PRUNE_PREDICATES.aggregates!({period:"daily"})).toBe(false)` and `({period:"hourly"})).toBe(true)`, plus a source-text check that the rationale (`D-01`, `PRUNE_PREDICATES`) is documented in place. |

**Score:** 7/7 sub-truths verified (rolled up into the 3 roadmap-level must-haves: DUR-01, DUR-02, DUR-03 — score 3/3).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/retention.ts` | `RETENTION_DAYS.aggregates=90`, `PRUNE_PREDICATES.aggregates`, rotation cursor, `listRetentionPolicy`, `oldestPrunableDoc` | ✓ VERIFIED | All present, all wired into `pruneBatchV3`/`startNightlyPrune` (read above). |
| `convex/retentionCursor.ts` | `partitionBatchForPrune`, `resolveRotationStart`, `planRotationWrite`, `summarizeOverhangProbe` | ✓ VERIFIED | All present, dependency-free, imported and used by `retention.ts` (not orphaned). |
| `convex/retention.test.ts`, `convex/retentionCursor.test.ts` | Real assertions against predicate/cursor behavior, not descriptive-only | ✓ VERIFIED | `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` → 2 files, 40 tests, all passed (re-run live by this verifier, not taken from a SUMMARY claim). Includes negative controls (Pitfall-1 regression + its own "guard the guard" control). |
| `CLAUDE.md` D-11 bullet | Present in "Self-Hosted Convex — Operational Rules" | ✓ VERIFIED | `CLAUDE.md:94`, confirmed live in the working tree. |
| `retention-health-check.ps1` (unversioned, `convex-selfhost/`) | Reads live policy, no hand-copied table list | ✓ VERIFIED | Read directly off disk: line 61 calls `retention:listRetentionPolicy`; zero `$RetentionDays`/"Keep in sync" hits. |
| `110-DUR-EVIDENCE.md`, `110-MEMORY-EVIDENCE.md` | Verbatim command transcripts, corrections preserved not deleted | ✓ VERIFIED | Both amendments (aggregates-ALERT retraction, growth-rate timezone correction) present with original text preserved and dated follow-ups appended. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `pruneBatchV3` | `partitionBatchForPrune` | direct call, `lastCreationTime` sourced from every doc | ✓ WIRED | `retention.ts:239` — `partitionBatchForPrune(batch, PRUNE_PREDICATES[table])`, used for both `toDelete` and cursor advancement. |
| `startNightlyPrune` | `resolveRotationStart` | reads persisted `agentConfigs` cursor, bounds-checks fresh | ✓ WIRED | `retention.ts:167-171`. |
| `pruneBatchV3` terminal branches | `planRotationWrite` | write only at `cap-reached`/`done`, `null` at interior steps | ✓ WIRED | `retention.ts:263-282` — write only executes when `rotationWrite !== null`. |
| `retention-health-check.ps1` | `retention:listRetentionPolicy` (deployed) | `npx convex run --env-file <path>` CLI | ✓ WIRED | Confirmed both by source diff (110-05 evidence) and live disk read (this verification). |
| `retention-health-check.ps1` | `retention:oldestPrunableDoc`/`summarizeOverhangProbe` | predicate-aware overhang probe | ✓ WIRED | 110-06 evidence: 2026-08-11 05:30 log line phrasing ("caught up (... that the pruner may delete)") is the predicate-aware wording, textually distinct from the pre-fix "empty or fully caught up," confirming the new probe is what ran. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| DUR-01 | 110-01, 110-03, 110-04, 110-06 | `aggregates` bounded, batch-capped, never bulk-deleted | ✓ SATISFIED | Predicate + tests + live pre/post-prune row-level proof (110-06). |
| DUR-02 | 110-03, 110-04, 110-05, 110-06 | Full nightly pass across every `RETENTION_DAYS` table, observed live | ✓ SATISFIED | Coverage 14→19 (110-05) + completion via `_scheduled_functions` durable record, 268/268 success, indices 0-18 (110-06). |
| DUR-03 | 110-02 | Memory-growth root cause identified/documented, restart recorded as deliberate | ✓ SATISFIED | Knob probe + upstream issue re-derivation (110-MEMORY-EVIDENCE.md) + `CLAUDE.md:94` D-11 bullet. |

No orphaned requirement IDs: every DUR-* ID in `.planning/REQUIREMENTS.md` §"Convex Durability" is claimed by at least one of this phase's 6 plans, and every plan's `requirements:` frontmatter entry maps to a real REQUIREMENTS.md row.

**Traceability bookkeeping gap (not a goal-achievement gap):** `.planning/REQUIREMENTS.md`'s DUR-01/02/03 checkboxes (lines 40-42) are still `[ ]` and the traceability table (lines 90-92) still reads "Pending," even though all three requirements are demonstrably satisfied by code and live evidence and `ROADMAP.md` was already updated to "6/6 Complete" in commit `e4a485ce`. This is a one-file doc-sync omission for the orchestrator/roadmapper to close, not a defect in the phase's work.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/phases/110-convex-durability/110-06-SUMMARY.md` | 123, 138 | Stale "Next Phase Readiness"/closing line still reads "DUR-01 and DUR-02 are NOT yet closed" / "Task 3 checkpoint pending" | ⚠️ Warning | The frontmatter (`requirements-completed: [DUR-01, DUR-02]`) and title were updated in commit `7a572576` to reflect Task 3's operator sign-off, but two prose lines in the body were not touched in the same commit and now contradict the frontmatter within the same file. Purely a doc-consistency issue — `110-DUR-EVIDENCE.md` (the authoritative record) is internally consistent and correctly shows Task 3 closed with "approved." No code or evidence impact. |

No `TBD`/`FIXME`/`XXX` debt markers found in any file touched by this phase's 6 plans (`convex/retention.ts`, `convex/retentionCursor.ts`, `convex/retention.test.ts`, `convex/retentionCursor.test.ts`, `convex/llm.ts`, `convex/llm.test.ts`, `CLAUDE.md`).

### Corrections Landed (mid-phase, verified present in the artifact each claims to amend)

1. **`110-DUR-EVIDENCE.md` aggregates-ALERT retraction** — the original 2026-08-10 claim ("the ALERT does not clear — it persists and grows forever") is preserved verbatim, followed by a dated `### FOLLOW-UP (2026-08-11, plan 110-06)` section that re-verifies against the live `retention-health.log` (`aggregates -> caught up`, `verdict=OK`) and explicitly states what NOT to conclude from the reversal. ✓ Present, not silently deleted.
2. **`convex/llm.ts` / `convex/llm.test.ts` unbounded-growth retraction** — `llm.ts:378-395` carries a `CORRECTED 2026-08-11 (second pass)` block retracting the "grows without limit"/"guaranteed" framing, replaced with the sliding-window measurement (5,274 rows, down from ~7,080). Matching correction present in `llm.test.ts:308-319`. Commits `d2acdc31` and `c4a53541` both present in `git log`. ✓ Present in both files it claims to amend.
3. **`110-06-PLAN.md` DUR-02 leg-1 container-log-source correction** — line 31 (objective) and line 208 (Task 1 summary) both state the container-log source was shown structurally unavailable (Convex UDF `console.log` never reaches container stdout; no queryable log history) with positive controls, and that evidence moved to `_scheduled_functions`. The corresponding threat-register row `T-110-06-01` (line 247) documents the same correction. `110-DUR-EVIDENCE.md`'s "DUR-02 leg 1" section independently re-runs all four log-string greps plus both positive controls in the verifying session itself, not merely citing the correction. ✓ Present and independently re-verified, not merely described.

### Scope Notes Respected

- `0053c596` (`llm:subscriptionUsage` fix) is correctly outside DUR-01/02/03's requirement text but is documented as fixed under the project's "errors found during a phase get fixed" rule, blocking only the Task 3 operator chart-check, not the phase's own requirements. Not penalized.
- `.planning/todos/pending/llm-analytics-rollup-migration-cr01.md` is a recorded, deliberate deferral of Phase 104's CR-01, not an unmet DUR requirement. Not penalized.
- DUR-02 leg 1's evidence source substitution (container logs → `_scheduled_functions`) is a corrected plan defect with controls, verified above on substance rather than penalized for method deviation.

### Human Verification Required

None. The one human-verification gate this phase required (Task 3's live dashboard chart check) already ran during phase execution — operator response "approved," recorded verbatim in `110-DUR-EVIDENCE.md` — and is not being re-opened here.

### Gaps Summary

No blocking gaps. All three DUR-* requirements are independently confirmed against live code (retention.ts/retentionCursor.ts + passing tests, re-run by this verifier), a live self-hosted instance (three rounds of evidence across 110-04/05/06, internally cross-checked and self-correcting when a claim was found wrong), and an operator sign-off already on record. The only two findings are documentation-consistency nits (a stale internal section in `110-06-SUMMARY.md`, and `REQUIREMENTS.md`'s traceability table not yet flipped to Complete) — both easy one-line fixes, neither affecting the phase goal, the shipped code, or the live instance's behavior.

---

*Verified: 2026-08-11*
*Verifier: Claude (gsd-verifier)*
