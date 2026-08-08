---
phase: 109
slug: per-agent-engine-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `109-RESEARCH.md` § "Validation Architecture" (lines 85–143).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/component, jsdom) + Playwright (E2E) |
| **Config file** | `vite.config.ts` (Vitest via plugin), `playwright.config.ts` |
| **Quick run command** | `npx vitest run src/components/brains src/hooks/useResolvedBrain.test.tsx src/hooks/useActiveEngine.test.ts src/hooks/useControlVerbSwaps.test.ts convex/controlVerbSwaps.test.ts convex/runtimeIngest.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | quick ~15–30s · full suite TBD (planner to record actual on first Wave-0 run) |

---

## Sampling Rate

- **After every task commit:** Run the quick command (scoped to touched files).
- **After every plan wave:** Run `npm test` (full Vitest suite).
- **Before `/gsd:verify-work`:** Full suite green **AND** the operator-attended live gate below signed off.
- **Max feedback latency:** ~30 seconds (quick command).

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This table records the requirement → test-type
> contract each task must satisfy; the planner fills in Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ENGINE-03 | T-103-03 | `VITE_BRAINS_STUB` removed — no build-time flag can make the UI show fabricated data | unit | `npx vitest run src/components/brains` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-03 | — | `resolveActiveBrain` ranks per-profile override above global override | unit | `npx vitest run src/hooks/useResolvedBrain.test.tsx` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-03 | — | Scoped read with no telemetry returns `source:"none"` — never a fabricated engine | unit | `npx vitest run src/hooks/useResolvedBrain.test.tsx` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-03 | — | `modelIdsMatch` holds at **all six** equality sites (vendor-prefixed vs bare id treated equal) | unit | `npx vitest run src/hooks/useActiveEngine.test.ts src/components/brains` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-03 | — | Cost-confirm gate agrees for mouse AND keyboard paths across every (scope, costTier) combo (UI-SPEC §F) | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx src/components/brains/BrainPickerRow.test.tsx` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-03 | — | Unmapped catalogue vendor renders in an explicit group — never silently defaulted to `api` | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENGINE-04 | — | Per-profile dispatch reuses `GlobalSwapModal`'s outcome vocabulary (pending/confirming/confirmed/accepted/error) | unit | `npx vitest run src/hooks/useProfileSwap.test.ts` *(name TBD)* | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENGINE-04 | — | Confirm resolves against the **override slot** from `swap.state`, not a resolved telemetry row | unit | `npx vitest run src/hooks/useProfileSwap.test.ts` *(name TBD)* | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENGINE-04 | — | Scoped **restore** confirms against the *absence* of that profile's override | unit | `npx vitest run src/hooks/useProfileSwap.test.ts` *(name TBD)* | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENGINE-04 | — | Server-confirmed (not optimistic) swap against the REAL running stack | **manual / live gate** | operator-attended — see below | N/A | ⬜ pending |
| TBD | TBD | TBD | TELE-02 | — | `listGlobal` matches rows whose `scope` field is **absent** (`undefined`, not `null`) | unit | `npx vitest run convex/controlVerbSwaps.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TELE-02 | — | Merged history renders history / empty / truncation / pinned-note states honestly | component | `npx vitest run src/pages/Settings.test.tsx` | ❔ confirm | ⬜ pending |
| TBD | TBD | TBD | TELE-02 | CR-01 | New Convex query is a `query` (read); no client-callable write to a telemetry table is added | unit | `npx vitest run convex/controlVerbSwaps.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test file for the per-profile swap/outcome hook (e.g. `src/hooks/useProfileSwap.test.ts` — final name planner's call). The hook does not exist yet; build its test alongside it, not after.
- [ ] **Confirm `src/pages/Settings.test.tsx` exists and record what it covers** before assuming D-10's collapsible history section slots into existing test infrastructure. Research explicitly did NOT verify this (`109-RESEARCH.md:141`) — grep first thing in Wave 0, do not assume.
- [ ] Framework install: **none required** — Vitest / Playwright / Testing Library already fully wired.
- [ ] Record the actual `npm test` full-suite runtime on the first Wave-0 run (fills the estimate above).

---

## Manual-Only Verifications

> ENGINE-04's central claim — "server-confirmed rather than optimistic" — is a claim about
> cross-process, cross-language, real-time behavior. A green unit suite structurally cannot
> prove it: CodePulse-side mocks are already in the shape the TypeScript expects, and
> astridr-side tests never pass their payload through Convex's real validator. The defect
> class a live gate uniquely catches here is **type-shape mismatch at the
> Python → JSON → Convex-validator boundary**, plus **state-machine asymmetries that only
> appear across two real dispatches in sequence**. Phase 108's live gate (108-07) caught
> three such defects that unit tests, an adversarial gate, a code review and the phase
> verifier had all passed over.
>
> Phase 109 introduces this exact boundary risk in three new places: D-03's `default_profile_id`
> field, D-05's per-profile override map, and D-11's `scope`-absent Convex query.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **D-03 live probe** — `default_profile_id` arrives on the chosen ack | ENGINE-03 | New field crossing the Python→JSON boundary; a mock can only assert the shape we already assumed | Dispatch the chosen ack command against the running `astridr-agent`; read the value back in the browser console or a raw WS client. Assert it is a real profile id, not `undefined`/empty. Do not infer from code. |
| **D-05 live probe** — per-profile override map on `swap.state` | ENGINE-04 | Same boundary; plus the absent-vs-null distinction that §D.10 proved is non-obvious in this stack | Dispatch a scoped `swap.set`; read `swap.state` and confirm the map contains the pinned profile with the correct model. Then dispatch a scoped **restore** and confirm that profile is **ABSENT** from the map — not present with a `null` value. |
| **D-06 live probe** — per-profile override outranks global | ENGINE-03 | Requires **two real overrides active simultaneously**; no single mocked test naturally constructs this state | Pin a profile via scoped `swap.set` while a DIFFERENT global override is active. Confirm the picker, header badge, and Settings row all render the **pinned** model, not the global one. |
| **D-11 live probe** — `listGlobal` actually matches unscoped rows | TELE-02 | Highest-risk item in the phase: a wrong `null`/`undefined` choice returns zero rows silently and looks identical to "no history yet" | Dispatch a real **unscoped** swap, then confirm `listGlobal` returns it. Pair with a control that MUST be present (a known scoped row via `listByScope`) so an empty result cannot be misread as correct. |
| **Environment reachability** | all three | Preconditions must be proven before the gate starts, exactly as Phase 108's plan did | Confirm before the gate: `astridr-agent` **rebuilt** with this phase's D-03/D-05 changes (`COMPOSE_PROFILES=prod,war-room docker compose up --build -d` — never `restart`), self-hosted Convex reachable, and reads targeted at the **local** instance, not the cloud deployment `npx convex` defaults to. |

**Gate ownership:** schedule as a dedicated `autonomous: false` plan in the LAST wave, mirroring Phase 108's ENGINE-05 pattern. ENGINE-03 / ENGINE-04 / TELE-02 must NOT be marked satisfied from tests alone.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 30s on the quick command
- [ ] Live gate completed and operator-signed before verify-work
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
