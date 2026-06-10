---
phase: 75
slug: agent-console
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `75-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) |
| **Config file** | `vite.config.ts` (vitest configured inline; `npm test` script in `package.json`) |
| **Setup file** | `src/test/setup.ts` (mocks Clerk, Recharts, Three.js, etc.) |
| **Quick run command** | `npx vitest run src/lib/runReducer.test.ts src/lib/runUtils.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (jsdom unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/runReducer.test.ts src/lib/runUtils.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs (`75-NN-NN`) are assigned by the planner; rows below are anchored to the requirement
> and target test file from RESEARCH § Phase Requirements → Test Map. The planner MUST attach each
> row to a concrete task and confirm the `<automated>` command.

| Target | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| `submitTask()` → `POST /tasks` payload + returns `task_id` | TBD | TBD | CON-01 | V5 (input validation) | Prompt/workdir/max_turns validated before POST; Bearer `VITE_GATEWAY_API_KEY` attached | unit | `npx vitest run src/lib/astridrApi.test.ts -t "submitTask"` | ❌ W0 | ⬜ pending |
| `cancelTask()` → `DELETE /tasks/{id}` | TBD | TBD | CON-01 / CON-03 | V4 (access control) | DELETE carries gateway key; cancels by task_id only | unit | `npx vitest run src/lib/astridrApi.test.ts -t "cancelTask"` | ❌ W0 | ⬜ pending |
| `runMapReducer` folds `EVENT/CLOSED/ERROR` onto `RunState` | TBD | TBD | CON-02 | — | N/A | unit | `npx vitest run src/lib/runReducer.test.ts` | ❌ W0 | ⬜ pending |
| `appendBlocksWithDedup` caps at 500 + dedupes | TBD | TBD | CON-02 | V5 | Bounded buffer prevents unbounded DOM/memory growth | unit | `npx vitest run src/lib/runUtils.test.ts` | ❌ W0 | ⬜ pending |
| `stopping → stopped` transition on **WS close** (no cancel event) | TBD | TBD | CON-02 / CON-03 | — | Cancel-ack derived from `ws.onclose`, not a spoofable event | unit | `npx vitest run src/lib/runReducer.test.ts -t "stopping to stopped"` | ❌ W0 | ⬜ pending |
| Stop button dispatches `SET_STOPPING` + calls `cancelTask` | TBD | TBD | CON-03 | V4 | Stop wires to cancellation flag (asyncio cancel), NOT pid-kill | unit | `npx vitest run src/components/console/RunCard.test.tsx` | ❌ W0 | ⬜ pending |
| Global e-stop iterates `DELETE` over all active task IDs | TBD | TBD | CON-03 | V4 | E-stop only targets active task_ids owned by this client | unit | `npx vitest run src/components/console/GlobalEStopButton.test.tsx` | ❌ W0 | ⬜ pending |
| `saveRunSummary` mutation upserts by `taskId` (idempotent) | TBD | TBD | CON-04 | — | Idempotent upsert prevents duplicate history rows on retry | unit (Convex) | `npx vitest run convex/agentRuns.test.ts` | ❌ W0 | ⬜ pending |
| Terminal state triggers `saveRunSummary` call | TBD | TBD | CON-04 | — | N/A | unit | `npx vitest run src/pages/AgentConsole.test.tsx -t "persists on terminal"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/runUtils.ts` — extract `appendBlocksWithDedup` + `BLOCK_CAP` from `LiveRun.tsx`
- [ ] `src/lib/runUtils.test.ts` — dedup/cap logic (migrate existing implicit coverage)
- [ ] `src/lib/runReducer.ts` — `runMapReducer` + `RunState` types
- [ ] `src/lib/runReducer.test.ts` — ADD_RUN, EVENT fold, SET_STOPPING, CLOSED, stopping→stopped
- [ ] `src/lib/astridrApi.test.ts` (extend) — `submitTask`, `cancelTask`
- [ ] `convex/agentRuns.test.ts` — `saveRunSummary` idempotency, `listRecent`
- [ ] `src/components/console/` — Wave 0 component stubs directory

---

## Manual-Only Verifications

> The live end-to-end flow (success criteria 1–2) requires a running gateway (`:8200`) plus a real
> Claude Code / Codex run, and the Stop flow (criterion 3) requires Ástríðr `estop.py`. These are
> **execution-blocked on Ástríðr M1.P0 + M1.P3** and verified manually as an integration pass once
> those ship. Unit tests above cover the deterministic logic in isolation (mocked WS/fetch).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Task POSTed from dashboard reaches gateway and starts a real run | CON-01 | Needs live gateway + agent CLI | Start gateway on `:8200`; submit a run from the console; confirm `task_id` returned and a run begins |
| Live run streams over local-direct WS into run-reducer visualization | CON-02 | Needs live NDJSON stream | Watch a real run; confirm blocks append live, buffer caps at 500, reconnect on transient WS drop |
| Cross-request Stop cancels via cancellation flag (not pid-kill) | CON-03 | Needs live `estop.py` + gateway cancel path | Stop a running task; confirm `Stopping…` then `stopped` on WS close; verify process cancelled via asyncio cancel, not SIGKILL |
| Completed run summary persists to Convex | CON-04 | Needs live Convex + completed run | Complete a run; confirm a row appears in `agentRuns` and renders in history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
