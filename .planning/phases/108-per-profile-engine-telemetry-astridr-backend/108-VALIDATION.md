---
phase: 108
slug: per-profile-engine-telemetry-astridr-backend
status: planned
nyquist_compliant: true
wave_0_complete: true  # no separate Wave-0 plan: each task creates the test scaffold it needs, in the same task
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

> **Wave 0 disposition (planner, 2026-08-07):** there is no separate Wave-0 scaffold plan. Every
> test gap listed under "Wave 0 Requirements" below is created by the same task that needs it, in the
> same commit, so no task ships ahead of its own verification. The two genuinely-new test files
> (`convex/controlVerbSwaps.test.ts`, `tests/unit/channels/test_agent_processor_profile_context.py`,
> plus `tests/unit/engine/bootstrap/test_boot_model_routing_seed.py` and
> `src/hooks/useControlVerbSwaps.test.ts`) are each authored inside their owning task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 108-01 T1 | 108-01 | 1 | ENGINE-01 | T-108-07 | Profile ContextVar token-paired and reset in `finally` at both live set-points — no cross-profile leak | unit | `pytest tests/unit/channels/test_agent_processor_profile_context.py tests/unit/engine/bootstrap/test_wiring_chat_persistence.py -x -q` | ❌ new file | ⬜ pending |
| 108-01 T2 | 108-01 | 1 | ENGINE-01 | T-108-08 | `profileId` sourced only from the server-set ContextVar; unresolved profile or model refused at emit | unit | `pytest tests/unit/providers/test_router.py -x -q` | ✅ extend | ⬜ pending |
| 108-01 T3 | 108-01 | 1 | ENGINE-01 | T-108-10 | `mode` derived once with a proven default arm; emit-on-change caps telemetry write volume | unit | `pytest tests/unit/providers/test_router.py -x -q` | ✅ extend | ⬜ pending |
| 108-02 T1 | 108-02 | 1 | TELE-02 | T-108-05 | Both engine-axis tables bounded by the existing batch-capped prune BEFORE they grow | unit | `npx vitest run convex/retention.test.ts` | ✅ auto-covers new keys | ⬜ pending |
| 108-02 T2 | 108-02 | 1 | TELE-02 | T-108-03, T-108-12 | Write path `internalMutation`-only; read path `.take()`-bounded | typecheck | `npx tsc --noEmit` | n/a | ⬜ pending |
| 108-02 T3 | 108-02 | 1 | TELE-02 | T-108-03 | CR-01 authorization-boundary guard, mutation-checked | unit | `npx vitest run convex/controlVerbSwaps.test.ts` | ❌ new file | ⬜ pending |
| 108-03 T1 | 108-03 | 2 | TELE-02, ENGINE-01 | T-108-14, T-108-15 | Ingest case breaks-never-throws; failed resolution never stored as a current engine | typecheck | `npx tsc --noEmit` | n/a | ⬜ pending |
| 108-03 T2 | 108-03 | 2 | TELE-02, ENGINE-01 | T-108-15 | Bounded-window source guards on both cases; failed-skip mutation-checked | unit | `npx vitest run convex/runtimeIngest.test.ts` | ⚠ file exists, ZERO coverage of either case today | ⬜ pending |
| 108-04 T1 | 108-04 | 2 | ENGINE-02 | T-108-19 | Per-profile rung outranks global; unscoped path proven byte-identical by equality | unit | `pytest tests/unit/providers/test_router.py -x -q` | ✅ extend | ⬜ pending |
| 108-04 T2 | 108-04 | 2 | ENGINE-02 | T-108-02, T-108-17, T-108-18 | Unknown / unvalidatable / voice-target scope rejected before dispatch (verb mock: zero calls) | unit | `pytest tests/unit/engine/test_ws_commands.py -x -q` | ✅ extend | ⬜ pending |
| 108-04 T3 | 108-04 | 2 | ENGINE-02 (D-08) | — | Contract doc no longer describes an unbuilt axis or a rejected command | doc gate | `! grep -n "Not built" .planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` | ✅ exists | ⬜ pending |
| 108-05 T1 | 108-05 | 3 | ENGINE-02 | T-108-22 | Scoped write touches only the profile store; unscoped only the global — both asserted negatively too | unit | `pytest tests/unit/engine/test_swap_model.py -x -q` | ✅ extend | ⬜ pending |
| 108-05 T2 | 108-05 | 3 | TELE-02 | T-108-20 | All four outcomes emit with `scope`; voice disposition guarded | unit | `pytest tests/unit/engine/test_swap_model.py tests/unit/engine/test_swap_voice.py -x -q` | ✅ extend | ⬜ pending |
| 108-05 T3 | 108-05 | 3 | ENGINE-01 | T-108-21 | Boot seed distinguishable from a live reading; falsy default skipped | unit | `pytest tests/unit/engine/bootstrap/test_boot_model_routing_seed.py -x -q` | ❌ new file | ⬜ pending |
| 108-06 T1 | 108-06 | 3 | TELE-02 | T-108-24 | Outcome vocabulary derived once, tested against the four real producer shapes | unit | `npx vitest run src/hooks/useControlVerbSwaps.test.ts` | ❌ new file | ⬜ pending |
| 108-06 T2 | 108-06 | 3 | TELE-02 | T-108-16, T-108-24 | A refusal renders as a refusal; the row cap is stated on screen from the shared constant | unit | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` | ✅ extend | ⬜ pending |
| 108-07 T1 | 108-07 | 4 | ENGINE-05 | T-108-26 | Consent before any live deploy or assistant restart | **manual** | MISSING — consent gate (D-16) | n/a | ⬜ pending |
| 108-07 T2 | 108-07 | 4 | ENGINE-05 | T-108-29 | Every read targets the self-hosted instance explicitly; container freshness probed from inside | **manual** | `npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"` | n/a | ⬜ pending |
| 108-07 T3 | 108-07 | 4 | ENGINE-05, ENGINE-01, ENGINE-02, TELE-02 | T-108-02, T-108-27, T-108-28 | Scoped swap + isolation + **unscoped control** + restore + fail-closed negative control, all as pasted rows | **manual** | MISSING — live gate (D-16), evidence in `108-ENGINE-05-EVIDENCE.md` | n/a | ⬜ pending |
| 108-07 T4 | 108-07 | 4 | ENGINE-05 | T-108-28 | Operator reviews that every verdict is preceded by the rows supporting it | **manual** | MISSING — sign-off gate (D-16) | n/a | ⬜ pending |

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
- [x] **RESOLVED at pattern-mapping (2026-08-07):** `convex/runtimeIngest.test.ts` **exists** but
      `grep -n "model_routing\|control_verb_swap"` returns **zero hits** — neither case has any
      coverage. This is a confirmed gap, not an unknown. Closed by plan 108-03 Task 2, which adds
      both describe blocks to the existing file (`d.model` only — no `selectedModel` fallback, D-11's
      rejected alternative — plus the `status==="failed"` skip).

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

**Approval:** plan-time sections filled 2026-08-07 by the planner; execution-time boxes remain pending.
