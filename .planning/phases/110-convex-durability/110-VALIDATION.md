---
phase: 110
slug: convex-durability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 110 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `110-RESEARCH.md` §"Validation Architecture" (lines 311-361).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing — `convex/**/*.test.ts`, `src/**/*.test.tsx`) |
| **Config file** | Project-root Vitest config (existing; no new config needed) |
| **Quick run command** | `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5s quick / full suite per project norm |

> No framework install required. There is **no `convex-test` harness in this repo** — `planNextPruneStep`
> (`convex/retentionCursor.ts`) is the only directly-testable part of the prune chain, which is why
> D-02 and D-05 must express themselves through pure functions rather than inline in the mutation.

---

## Sampling Rate

- **After every task commit:** `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts`
  — fastest signal that D-02's "existing chain, not a parallel one" constraint has not been violated.
- **After every plan wave:** `npm test` — catches regressions from touching `convex/retention.ts`,
  whose shape other tests indirectly assume (e.g. the table-existence guard against `schema.ts`).
- **Before `/gsd:verify-work`:** full suite green **plus** both live legs below captured verbatim
  in the phase evidence file.
- **Max feedback latency:** < 30 seconds for the automated tier.

---

## Per-Task Verification Map

*Populated by the planner — task IDs do not exist until PLAN.md files are written. The requirement-level
map below is the binding contract each task must map onto.*

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| DUR-01 | `aggregates` pruned batch-capped + cursor-seeked, never bulk | unit | `npx vitest run convex/retention.test.ts -t "aggregates"` | ❌ W0 |
| DUR-01 | A `period:"daily"` row can **never** be deleted by the predicate (D-03 positive guard) | unit | `npx vitest run convex/retention.test.ts -t "period"` | ❌ W0 |
| DUR-01 | Predicate-skip case does **not** stall the cursor (Pitfall 1 regression) | unit | `npx vitest run convex/retentionCursor.test.ts` | ❌ W0 |
| DUR-01 | `RETENTION_DAYS.aggregates === 90` (D-04 window) | unit | `npx vitest run convex/retention.test.ts` | ❌ W0 |
| DUR-02 | Complete pass across **every** `RETENTION_DAYS` table | live observable | none — see Manual-Only below | ❌ inherent |
| DUR-03 | Memory-growth driver documented with evidence (either branch) | source assertion + live observable | none — see Manual-Only below | ❌ inherent |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/retention.test.ts` — new assertions: `RETENTION_DAYS.aggregates === 90`; the **positive**
      predicate guard (D-03 — asserted against the predicate itself, not against a comment); and a
      table-existence check extended over the predicate map's keys, inheriting the existing
      "a typo'd table name is a caught error, not a permanent silent no-op" protection.
- [ ] `convex/retentionCursor.test.ts` (or a sibling file for a new pure helper) — coverage for the
      rotation-cursor value computation (D-05/D-06) **plus** the Pitfall-1 regression:
      **a full batch of all-skipped docs must still advance the cursor.**
- [ ] `110-DUR-EVIDENCE.md` — the pasted-verbatim evidence artifact required by D-08/D-11. Not a code
      file; matches the `108-ENGINE-05-EVIDENCE.md` / `109-LIVE-EVIDENCE.md` precedent.

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Daily aggregate rows survive a real prune | DUR-01 | Needs a real nightly run against the live self-hosted instance | Count `period:"daily"` rows before/after the first post-deploy prune via the bounded `npx convex run` probe recipe at `retention-health-check.ps1:105-115`. **Expected:** count identical or growing — **a shrinking count is a hard fail and blocks the phase.** **Control:** run the same probe for `period:"hourly"` and confirm its count drops or its oldest `_creationTime` moves forward; an hourly count that never changes is the opposite failure (predicate skipping everything). |
| A complete pass across every table | DUR-02 | Only observable on the running system (Success Criterion 2 says so explicitly) | Leg 1: pull the chain's terminal `retention: all tables pruned` line from the running container's logs, bounding with **both** `--tail` and `--since` (never `--since` alone). This line is reachable only when the chain reaches its final `done` action, so its presence disambiguates a completed pass from a quiet one — which a per-table "caught up" reading cannot, being ambiguous between pruned / empty / nothing-aged-out. |
| Health check sees every table | DUR-02 | Cross-repo: the PS1 lives outside git until Phase 113 | Leg 2: post-D-07 `retention-health-check.ps1` run printing every key from the live retention map — not the stale hand-copied 14. **Control:** cross-check the printed table count against the live `Object.keys(RETENTION_DAYS).length`; a run that still prints 14 (or 18, missing `aggregates`) is a bug in D-07's implementation, not a clean pass. |
| Memory-growth driver understood | DUR-03 | Upstream research + live measurement; D-09 explicitly declines to fund a multi-day attribution study | **Knob-found branch:** name the env var + default, and paste a measured before/after across a full inter-restart cycle with `ConvexNightlyRestart` left running (D-10), compared against the ~0.17 GiB/h baseline on record. **Knob-absent branch:** cite the upstream issues with `state` **and** `state_reason` **re-verified at write-up time** (not carried over from research — and note any linked PR's merge state, which changes the operational options), re-run the `.searchIndex()`/`.vectorIndex()` grep as a schema-drift control, and add the D-11 line to CLAUDE.md's "Self-Hosted Convex — Operational Rules". |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 30s for the automated tier
- [ ] Every live leg carries its **control** (an absence/"caught up" reading proves nothing without one)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
