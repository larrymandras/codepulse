---
phase: 111
slug: mission-board
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
---

# Phase 111 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Reconstructed retroactively (State B — no VALIDATION.md existed) from the three PLAN/SUMMARY pairs,
`111-VERIFICATION.md`, and `111-SECURITY.md`. Every status below was established by **running the
command**, not by reading a prior artifact's claim.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `vitest.config.ts` (E2E lives separately in `playwright.config.ts` — not used by this phase) |
| **Setup file** | `src/test/setup.ts` — mocks Clerk, Recharts, Three.js, Globe, React Flow, Tone.js |
| **Path alias** | `@/` → `./src/` (Vite + tsconfig) |
| **Quick run command** | `npx vitest run src/components/JobsPanel.test.tsx src/pages/Chat.test.tsx src/pages/LiveRun.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Type check** | `npx tsc --noEmit` → exit 0 (measured 2026-08-11) |
| **Estimated runtime** | ~4s quick · ~38s full |

**Measured full-suite state, 2026-08-11 (post-gap-fill):**
`Test Files 298 passed | 17 skipped (315)` · `Tests 3958 passed | 193 todo (4151)` · 37.91s.
Pre-gap-fill baseline was 297 files / 3951 tests; the delta is exactly the +1 file and +7 tests
added by this audit, with zero regressions and no existing test weakened, skipped or `.todo()`'d.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <the touched test file>` (~4s)
- **After every plan wave:** `npx vitest run` (~38s) + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** full suite must be green
- **Max feedback latency:** ~38 seconds

Sampling continuity holds: no run of 3 consecutive tasks lacks an automated behavioral verify.
Wave 1's two `tsc`-only tasks (111-01-01, 111-02-01) are each immediately followed by a
behavioral-test task in the same plan, and both are now additionally guarded by the tests added
below.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 111-01-01 | 01 | 1 | MISSION-01, MISSION-03 | T-111-01 / T-111-02 / T-111-03 | Emitter strings render as escaped React text children; no `dangerouslySetInnerHTML`; unmapped status falls back to a muted `Clock`, absent rather than fabricated | unit (behavior asserted by 111-01-02) | `npx vitest run src/components/JobsPanel.test.tsx` | ✅ | ✅ green |
| 111-01-02 | 01 | 1 | MISSION-01, MISSION-03 | T-111-01 | Copy contract, all four elapsed tiers + the 25h boundary, epoch-seconds guard, unmapped-status fallback with a discriminating control | unit | `npx vitest run src/components/JobsPanel.test.tsx` | ✅ | ✅ green (12 tests) |
| 111-01-03 | 01 | 1 | Stale Docs rule | — | The `<JobsPanel />` mount comment cannot re-acquire a live-streaming claim the data can't support | source-text (`node:fs`) | `npx vitest run src/pages/LiveRun.test.tsx` | ✅ **added by this audit** | ✅ green (2 tests) |
| 111-02-01 | 02 | 1 | MISSION-03 | T-111-04 / T-111-05 / T-111-06 | `ActiveAgentsPanel` and its unfalsifiable "No agents running." empty state cannot be reintroduced; `cc-left-rail` holds exactly one child | unit (regression guard) | `npx vitest run src/pages/Chat.test.tsx` | ✅ **added by this audit** | ✅ green (5 tests) |
| 111-02-02 | 02 | 1 | MISSION-03 | T-111-06 | The six surviving command-center panels mount for real behind their error boundaries | unit | `npx vitest run src/pages/Chat.test.tsx` | ✅ | ✅ green |
| 111-03-01 | 03 | 2 | MISSION-01/02/03 traceability | T-111-07 / T-111-08 | `REQUIREMENTS.md` cannot assert a status Phase 111 did not ship | doc probe | `grep -c "blocked-on-astridr\|Blocked on astridr" .planning/REQUIREMENTS.md` | ✅ | ✅ green |
| 111-03-02 | 03 | 2 | MISSION-02 deferral | T-111-09 | Every deferred item has exactly one owner (SEED-007); probe evidence carries no credential | doc probe | `test -f .planning/seeds/SEED-007-mission-emitter-revival.md && grep -c "SEED-007" .planning/seeds/SEED-007-mission-emitter-revival.md` | ✅ | ✅ green |
| 111-03-03 | 03 | 2 | all | — | Operator confirms neither changed surface claims a mission state the data cannot back | **checkpoint:human-verify** (gate: blocking) | none — manual by design | n/a | 🔵 manual — executed and **approved** 2026-08-11 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔵 manual*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — Vitest, jsdom and `src/test/setup.ts` were
already in place before Phase 111 began. No framework install, no conftest/fixture scaffolding, and
no stub files were needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both changed surfaces read truthfully against the **running** app, with real `subagentJobs` rows | MISSION-01, MISSION-03 | A jsdom test asserts rendered strings against mocked rows; it cannot judge whether the surface *reads* as honest to an operator looking at live data, nor catch visual overflow in the trailing timestamp cluster (the `finished moments ago` string is materially longer than the `5s` it replaced). 111-01 explicitly carried this forward for human evaluation rather than silently fixing it. | Start `npm run dev` (:5173). (1) Open `/live-run` — the panel header reads `MISSION HISTORY`, the badge reads `{n} missions`, every row's trailing timestamp reads `finished … ago` with no bare duration and no pulsing dot; check the trailing cluster does not wrap or clip. (2) Open `/chat`, enable command-center mode — the left rail shows Intelligence Feed only, with no empty boundary, placeholder or "coming soon" tile. (3) Both devtools consoles show zero errors. |

**Status:** ✅ executed 2026-08-11, verdict **approved**, with per-leg screenshot evidence recorded
in `111-03-SUMMARY.md`'s CHECKPOINT section. Two observations were routed to follow-ups rather than
treated as phase gaps — task-snippet truncation at 80 chars with no ellipsis (upstream astridr
emitter policy, SEED-007 item 7) and an unexamined devtools "1 Issue" badge
(`.planning/todos/pending/111-devtools-issues-panel-entry-unexamined.md`).

---

## Validation Audit 2026-08-11

| Metric | Count |
|--------|-------|
| Tasks audited | 8 |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Manual-only (by design) | 1 |

### GAP-1 — `ActiveAgentsPanel` deletion had no regression guard (task 111-02-01, MISSION-03, T-111-06)

Phase 111's central deliverable was deleting `ActiveAgentsPanel` under D-07: it filtered
`subagentJobs` for `status === "running"`, and no `running` row can ever arrive
(`convex/runtimeIngest.ts` routes terminal-state events only), so its "No agents running." empty
state was an unfalsifiable claim. **Nothing asserted the deletion.**
`Chat.test.tsx:779`'s `COMMAND_CENTER_PANEL_LABELS` loop is positive-only — it asserts the six
survivors are present, so re-adding a seventh panel, or `ActiveAgentsPanel` itself, would have kept
all 55 tests in that file green.

Closed by a new describe block at `src/pages/Chat.test.tsx:986` — 5 tests asserting the
`cc-left-rail` child count, the absence of both `ACTIVE AGENTS` and `No agents running.` in mode-ON
and mode-OFF, and an **exhaustive** panel-header count so a seventh panel cannot hide behind the
positive-only loop.

**Mutation-proven — independently, by the orchestrator, not only by the auditor.** A second
rail child shaped like the deleted panel was added to `src/pages/Chat.tsx`, the mutation was
confirmed to have landed (`git diff --stat` → `1 file changed, 6 insertions(+)`), and the suite went
RED for the right reasons:

```
× cc-left-rail has exactly one child element with mode ON …
× never renders ACTIVE AGENTS or the unfalsifiable 'No agents running.' empty state while mode is ON
× renders EXACTLY six panel-chrome headers with mode ON …
AssertionError: expected 2 to be 1
expected document not to contain element, found <span …>ACTIVE AGENTS</span>
AssertionError: expected 7 to be 6
Test Files  1 failed (1)
     Tests  3 failed | 45 passed (48)
```

`Chat.tsx` was then restored from a `cp` backup (never `git checkout --`, which would have wiped a
concurrent session's uncommitted work in this shared checkout) and confirmed byte-identical:
`git diff --stat -- src/pages/Chat.tsx` → empty.

### GAP-2 — the corrected `LiveRun.tsx` mount comment had no guard (task 111-01-03, Stale Docs rule)

111-01 Task 3 rewrote the comment above `<JobsPanel />` because the old one claimed a
live-streaming surface that became false when the panel became a history board. There was **no
`LiveRun` test file at all**, so the correction could rot on the next edit.

Closed by a new `src/pages/LiveRun.test.tsx` (2 tests) using this repo's existing `node:fs`
source-text idiom (`CostBreakdown.test.tsx:287`, `CostBreakdownTable.test.tsx:180/185`,
`CostBudgetsAdmin.test.tsx:226`). The assertion is windowed to 400 chars around the mount so
legitimate live-timeline text elsewhere in the file cannot confound it. Mutation: the comment was
replaced with a stale live-streaming claim → both tests RED; restored byte-identical.

### Dropped, and why

`src/components/AgentTopology.tsx:196` renders the string `"No agents running"` — the same claim
class that got `ActiveAgentsPanel` deleted. **Not reported as a gap:** it reads `api.agents.*`
(`src/hooks/useAgentTopology.ts:5-26`), never `subagentJobs`, so it sits outside MISSION-03's stated
scope ("every `subagentJobs` consumer"), and its empty state is conditioned on a different table
whose `running` rows were never shown to be impossible. The complete `subagentJobs` consumer set in
`src/` is now `JobsPanel.tsx`, `JobsPanel.test.tsx`, `useSubagentJobs.ts` and `LiveRun.tsx` —
`Chat.tsx` correctly no longer appears. Flagging it here as an observation, not a finding.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a documented manual-only entry
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — none were needed; existing infra sufficed
- [x] No watch-mode flags (every command is `vitest run`, non-interactive)
- [x] Feedback latency < 40s
- [x] Every new test mutation-proven RED before being accepted as green
- [x] No implementation file modified — `git diff --stat` empty on `Chat.tsx`, `LiveRun.tsx`, `JobsPanel.tsx`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-11
