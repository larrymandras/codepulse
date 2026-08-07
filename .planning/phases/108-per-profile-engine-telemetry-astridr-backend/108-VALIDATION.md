---
phase: 108
slug: per-profile-engine-telemetry-astridr-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 108 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Cross-repo phase.** Two test stacks run side by side: astridr-repo (pytest) is the primary
> build target, codepulse (Vitest) is the receiving half. Derived from `108-RESEARCH.md`
> § "Validation Architecture".

---

## Test Infrastructure

| Property | astridr-repo (primary) | codepulse (secondary) |
|----------|------------------------|------------------------|
| **Framework** | pytest, `asyncio_mode = "auto"` | Vitest (jsdom) |
| **Config file** | `pyproject.toml:160-162` `[tool.pytest.ini_options]`, `testpaths = ["tests"]` | `vitest.config.ts` |
| **Quick run command** | `pytest tests/unit/providers/test_router.py tests/unit/engine/test_swap_model.py tests/unit/engine/test_swap_voice.py tests/unit/engine/test_ws_commands.py -x` | `npx vitest run convex/activeEngine.test.ts convex/activeEngineFilters.test.ts convex/retention.test.ts` |
| **Full suite command** | `pytest tests/` | `npm test` |
| **Estimated runtime** | quick ~30s / full several minutes | quick ~10s / full ~60s |
| **Branch** | `feature/brain-swap` | `master` |

> ⚠ **Concurrent-session hazard.** astridr-repo `feature/brain-swap` moved three times during
> planning of this phase (`0d23f06e` → `645e8f83` → `5b8bbde1`, Phase 188.x work by another
> session). Re-verify every astridr line number at execution time, and never `git commit --amend`
> in that checkout — assert `git log -1 --format=%H` matches the hash you created before any
> history edit.

---

## Sampling Rate

- **After every task commit:** run the quick command for whichever repo the task touched.
- **After every plan wave:** full suite on **both** repos (`pytest tests/` and `npm test`).
- **Before `/gsd:verify-work`:** both full suites green, **plus** the D-16 live proof below.
- **Max feedback latency:** ~60 seconds (quick commands).

---

## Per-Task Verification Map

*Populated by the planner — one row per task in the phase's PLAN.md files. Every task must map
to an automated command or to a Wave 0 dependency, except the ENGINE-05 rows, which are
manual-only by decision D-16.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner fills)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → verification anchor (from research, pre-plan)

| Req ID | Behavior | Type | Command | File |
|--------|----------|------|---------|------|
| ENGINE-01 | `_resolve_model` / `_emit_model_routing` read `get_profile_context()`; payload carries real `profileId` + `model` | unit | `pytest tests/unit/providers/test_router.py -x` | ✅ extend |
| ENGINE-01 | No profile in context → **no** `model_routing` send (D-02 refuse-to-emit) | unit | `pytest tests/unit/providers/test_router.py -k refuse_to_emit -x` | ❌ Wave 0 |
| ENGINE-01 | Boot seed: one event per profile, `mode:"inherited"` (D-03) | unit/integration | targeted bootstrap test | ⚠ Wave 0 — confirm coverage |
| ENGINE-01 | `selectedModel` → `model` rename propagates through ingest (D-11) | unit (codepulse) | `npx vitest run convex/runtimeIngest.test.ts` | ⚠ Wave 0 — existence unconfirmed |
| ENGINE-02 | Scoped `swap.set` applies only to the named profile; **unscoped byte-identical** | unit | `pytest tests/unit/engine/test_swap_model.py tests/unit/engine/test_ws_commands.py -x` | ✅ extend |
| ENGINE-02 | Restore: scoped clears only that profile; unscoped clears global only | unit | `pytest tests/unit/engine/test_swap_model.py -k restore -x` | ✅ extend |
| ENGINE-05 | Live scoped swap + unscoped control, read from Convex rows | **manual-only** | see Manual-Only Verifications | N/A |
| TELE-02 | All 6 `control_verb_swap` emit sites write the new table with correct scope + outcome (D-13) | unit | `pytest tests/unit/engine/test_swap_model.py tests/unit/engine/test_swap_voice.py -x` + `npx vitest run convex/controlVerbSwaps.test.ts` | ❌ Wave 0 (codepulse side) |
| TELE-02 / D-10 | Retention entries exist for both new/newly-growing tables | unit | `npx vitest run convex/retention.test.ts` | ✅ extend |

---

## Wave 0 Requirements

- [ ] `tests/unit/providers/test_router.py` (astridr) — add cases: per-profile precedence rung
      inserted above the global override; `profileId` sourced from `get_profile_context()`;
      refuse-to-emit when context is `None`; `status="failed"` payload shape.
- [ ] `tests/unit/providers/test_router.py:664,686,703,719` — **update 4 existing assertions**
      on `payload["selectedModel"]` to `payload["model"]` (D-11 rename; these go red on the
      rename commit if not updated in the same task).
- [ ] `tests/unit/engine/test_swap_model.py` / `test_swap_voice.py` (astridr) — cases for the
      new scope field across the 6 emit-site payloads, and the scoped-vs-unscoped restore branch.
- [ ] `tests/unit/engine/test_ws_commands.py` (astridr) — `SwapSetCommand` scope-field validation
      (unknown profile id → error ack; voice-target handling per research Item 8).
- [ ] `convex/controlVerbSwaps.test.ts` (codepulse) — **new file**, mirroring
      `convex/activeEngine.test.ts`'s structure: the new ingest case plus the bounded readout query.
- [ ] **Verify existence** of a `convex/runtimeIngest.test.ts` covering the `model_routing` case.
      If absent, add one exercising `d.model` only (no `selectedModel` fallback — D-11's rejected
      alternative) and the `status==="failed"` disposition.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A live scoped `swap.set` produces a real `activeEngineSnapshots` row (real `profileId` + model, never a sentinel) and a matching swap-history row, with the **other** profiles unchanged | ENGINE-05 (D-16) | The stack is self-hosted with no CI path to it. BSC-05 / the Phase-90 lesson is that "endpoint exists" and "integration works" diverge on the live machine specifically. A rendered UI value is not proof of a stored row — and Phase 109, not 108, is what makes those surfaces read telemetry. | Per `108-RESEARCH.md` § Item 9, in order: (1) rebuild astridr with the war-room profile included; (2) issue a real scoped `swap.set` over the WS command path; (3) read `activeEngineSnapshots` and the swap-history table **out of the local self-hosted backend** (`--url http://127.0.0.1:3210` + admin key from `docker exec convex-backend ./generate_admin_key.sh`; note the Git-Bash `MSYS_NO_PATHCONV=1` trap). Assert the row values directly. |
| An **unscoped** global swap still behaves byte-identically to today | ENGINE-05 (D-04, D-07) | This is the **control**. Without it, "per-profile works" is a claim that *something changed*, not that the right thing changed — an absence/behaviour proof with no control is vacuous (2026-08-05 lesson). | Same sequence, issuing an unscoped `swap.set`; assert the global override path fires exactly as it does on the pre-change build, and that no per-profile pin was created. |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency (ENGINE-05 excepted, manual by D-16)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Both repos' full suites green
- [ ] D-16 live proof executed and its **row output pasted as evidence**, not summarized
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
