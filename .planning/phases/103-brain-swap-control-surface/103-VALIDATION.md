---
phase: 103
slug: brain-swap-control-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `103-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 (jsdom) + Playwright (E2E) |
| **Config file** | `vitest.config.ts` / Playwright config (existing, unchanged) |
| **Quick run command** | `npx vitest run src/components/brains src/lib/brainsApi.test.ts` |
| **Full suite command** | `npm test` then `npm run test:e2e` |
| **Estimated runtime** | ~15s quick · ~90s full Vitest · E2E separate |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the touched test file>`
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green, including `npm run test:e2e`
- **Max feedback latency:** 15 seconds (quick), 90 seconds (full)

---

## The BSC-05 Honesty Boundary (governs every row below)

This phase is **stub-backed on the per-profile axis and live on the global axis**
(CONTEXT.md `<blocker_reframing>`, corrected 2026-07-28). Validation must respect that split.

**Provable this phase — per-profile axis, against the stub:**
- Contract TypeScript shapes are internally consistent; the stub conforms (compile-time + runtime conformance test).
- All client-side logic: scope-selector reset (D-08), pending-never-optimistic (D-15), partial-failure row rendering (D-12), pinned-default overwrite count (D-11), revert restoring prior state incl. pin status, expensive/unknown-tier inline confirm, stub-data indicator visibility (D-16).
- "Mixed brains" badge computation, given a fixture with ≥2 distinct engine values.

**Provable this phase — global axis, FOR REAL (do not stub):**
- `swap.set` / `swap.catalogue` / `swap.state` exercised against the running stack. BSC-05's original wording is satisfiable here and **must** be satisfied. Endpoint-exists ≠ integration-works (Phase 90 lesson) — drive it end-to-end.

**NOT provable this phase — deferred to the follow-on gate (astridr Phase 184.1):**
- That a real `gateway.model.set` exists, accepts the contract payload, and changes the resolved model for the next real turn.
- That per-profile active-engine telemetry flows from a real astridr process into the new Convex table.
- That CLI subscription brains are reachable / healthy / quota-tracked through a real CLI Gateway.
- Any observed interaction between the per-profile mechanism and the live Phase-185/186 global override.

> **A green stub suite must never be reported as "BSC-05 verified."** Stub tests prove contract
> conformance and UI honesty. They do not prove live per-profile integration.

---

## Per-Task Verification Map

> Task IDs bound by `gsd-planner` 2026-07-28. No row was dropped and no thirteenth mapping was
> invented. **Two automated commands were re-pointed** at planning time to the file that genuinely
> contains the assertion — flagged inline as `[cmd corrected]`. Research had written both under a
> "same file as above" shorthand that pointed at the wrong test file:
> row 7 (scope-selector reset) lives in the picker, not the modal; row 9 (partial-failure result
> rows) lives in the modal, not the picker. A command pointing at a file that does not hold the
> assertion is a false verification, so the file was corrected rather than the row dropped.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 103-01-T3 | 103-01 | 1 | BSC-05 | T-103-01 | Stub adapter rejects malformed shapes in dev (contract-drift canary, ASVS V5) | unit | `npx vitest run src/lib/brainsApi.test.ts` | ❌ W0 | ⬜ pending |
| 103-06-T1 | 103-06 | 4 | BSC-01 | T-103-23 | Mixed state never presents one profile's value as the engine | unit | `npx vitest run src/components/brains/BrainHeaderBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 103-02-T3 | 103-02 | 1 | BSC-01 | T-103-05 | Ingest coalesces snake/camelCase defensively; bounded read | unit (Convex) | `npx vitest run convex/activeEngine.test.ts` | ❌ W0 | ⬜ pending |
| 103-01-T3 | 103-01 | 1 | BSC-02 | T-103-02 | Command follows the same non-admin auth tier as `swap.set` | unit | `npx vitest run src/lib/brainsApi.test.ts` | ❌ W0 | ⬜ pending |
| 103-05-T2 | 103-05 | 3 | BSC-02 | T-103-17 | Dispatch validated client-side before leaving the browser | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 103-04-T2 | 103-04 | 2 | BSC-03 | T-103-12 | Global swap enumerates every affected profile before firing | unit | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` | ❌ W0 | ⬜ pending |
| 103-05-T2 | 103-05 | 3 | BSC-03 | T-103-21 | Scope resets to "This profile" every open, so global requires a deliberate move | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` `[cmd corrected]` | ❌ W0 | ⬜ pending |
| 103-05-T2 | 103-05 | 3 | BSC-04 | T-103-18 | Pending never flips the base label; failure drops the suffix, claims nothing | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 103-04-T2 | 103-04 | 2 | BSC-04 | T-103-14 | Failed rows keep their real unchanged engine; target name absent | unit | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` `[cmd corrected]` | ❌ W0 | ⬜ pending |
| 103-05-T2 | 103-05 | 3 | BSC-05 | T-103-19 | Stub build cannot masquerade as live (persistent STUB indicators) | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 103-01-T3 | 103-01 | 1 | BSC-05 | T-103-01 | Stub return shapes match the `103-CONTRACT.md` interface | contract + typecheck | `npx vitest run src/lib/brainsApi.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 103-08-T1 | 103-08 | 5 | BSC-02, BSC-04 | T-103-30 | A green stub run is explicitly not live per-profile verification | e2e | `npm run test:e2e -- brain-swap.spec.ts` | ❌ W0 | ⬜ pending |

**Fixture ownership:** all five mandatory fixtures below are built as real work in **103-01-T2**
(`src/lib/brainsFixtures.ts`), not inline inside a test task.

**Additional plan-level gates not in the map above:**

| Task ID | Plan | Wave | Gate |
|---------|------|------|------|
| 103-02-T2 | 103-02 | 1 | **[BLOCKING]** Convex schema push — must land before any reactive-path claim |
| 103-03-T1 | 103-03 | 2 | `useActiveEngine` never returns `undefined`; no fallback to `modelPreferences` |
| 103-03-T2 | 103-03 | 2 | Health/quota thresholds re-tokenized to `--status-*`; rows never truncate |
| 103-06-T2 | 103-06 | 4 | Badge wrapped in `SectionErrorBoundary` inside `DashboardLayout` |
| 103-07-T1 | 103-07 | 4 | `p.model` stale read deleted from `Settings.tsx`, live value wins when they differ |
| 103-07-T3 | 103-07 | 4 | CLI-to-API fallback surfaced as a warn-toned toast (D-04 honesty) |
| 103-08-T2 | 103-08 | 5 | **Live global-axis verification against the running stack** — BSC-05's satisfiable half |
| 103-08-T3 | 103-08 | 5 | Validation sign-off records what remains unproven |

**Behavior covered per row (research § Phase Requirements → Test Map):**
1. BSC-05/W0 — stub adapter shape validation.
2. BSC-01 — badge + Settings row render the reactive active engine per profile; "Mixed brains" when they disagree.
3. BSC-01 — the active-engine ingest handler writes/dedupes per-profile rows correctly.
4. BSC-02 — stub and live adapters satisfy one identical interface.
5. BSC-02 — picker dispatches the per-profile command via `useCommandDispatch`.
6. BSC-03 — confirm modal lists every affected profile `current → new` and flags the pinned-default overwrite count.
7. BSC-03 — scope selector resets to "This profile" on every open, except the mixed-badge entry exception (UI-SPEC line 144).
8. BSC-04 — pending state never optimistically flips the base label; failed dispatch drops the pending suffix with no error styling on the pill.
9. BSC-04 — partial-failure global swap keeps failed rows on their real unchanged engine.
10. BSC-05 — STUB banner + chip render iff the stub flag is on, never otherwise.
11. BSC-05 — stub return shapes match the `103-CONTRACT.md` interface.
12. E2E — picker open → swap → toast round trip against the stub.

---

## Fixtures That Actually Exercise the Behavior

> A fixture that does not trigger the behavior proves nothing. Each of these is mandatory —
> the corresponding test is invalid without it.

- **Expensive/unknown-tier inline confirm** — catalogue fixture MUST include ≥1 `costTier: "expensive"` and ≥1 `costTier: "unknown"` entry. An all-`"normal"` fixture exercises only the immediate-dispatch path and proves nothing about the confirm expansion (UI-SPEC §3/§11).
- **Global-swap pinned-default restore** — fixture MUST include ≥2 profiles with at least one *pinned* default and at least one *inherited* value. A uniform fixture cannot distinguish D-11's pin-status-preserving revert from a naive "restore last known model".
- **Partial-failure result rows** — the stub's `dispatchSwap` MUST be configurable to fail a subset of profiles (e.g. profileId deny-list). A stub that always succeeds cannot exercise D-12 at all.
- **Mixed-brains header badge** — seed the active-engine query with ≥2 distinct engine values across profiles simultaneously. A single-profile or all-agree fixture cannot reach the stacked-dot path (UI-SPEC §2, line 120).
- **cmdk duplicate-value regression guard** — include two catalogue entries sharing a display `name` but differing `id`s; assert both stay independently selectable. Guards the known cmdk value-keyed selection defect (duplicate values ⇒ double-highlight + ArrowDown loop).

---

## Wave 0 Requirements

- [ ] `src/lib/brainsApi.ts` + `src/lib/brainsApi.test.ts` — the D-16 adapter seam and its contract-conformance test
- [ ] `convex/activeEngine.ts` (or equivalent) + `convex/activeEngine.test.ts` + a `convex/schema.ts` table addition — the new reactive per-profile table
- [ ] `src/hooks/useActiveEngine.ts` — per-profile + mixed-state reactive hook
- [ ] `src/components/brains/*.test.tsx` — no component in this directory exists yet
- [ ] `103-CONTRACT.md` — the D-17 deliverable this phase must produce
- [ ] `brain-swap.spec.ts` — new Playwright E2E spec against the stub

**Schema-push note (self-hosted Convex):** the new table means TypeScript types come from
`convex/schema.ts`, so `npm run build` and `npx tsc --noEmit` will pass **whether or not the table
exists on the live instance**. That is a false-positive verification state. A schema push
(`npx convex deploy` against the self-hosted instance) must land before any test claims the
reactive path works. Never `import --replace-all`; never bulk-delete on the live instance.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Global swap against the running stack | BSC-05 (global axis) | Requires a live astridr process; `swap.set` mutates real process-wide state | With astridr up: open the picker, select `All profiles` scope, pick a different brain, confirm. Assert the `swap.state` push updates the badge, then use "Restore usual brain" to revert. Endpoint-exists ≠ integration-works. |
| Composer pill placement on `Chat.tsx` | BSC-02 (D-05 corrected) | Visual placement/overlap in the real composer, not assertable in jsdom | Load `/chat`, confirm the pill renders in the composer without displacing the send affordance at narrow widths. |
| Live catalogue scale behavior | BSC-02 | The real catalogue is ~300+ entries; fixtures are small | With astridr up, open the picker and confirm rows wrap without truncation and provider grouping holds — the three UX lessons already learned in `BrainControl.tsx`'s checkpoint rounds. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (quick) / 90s (full)
- [ ] Every fixture in "Fixtures That Actually Exercise the Behavior" is realized
- [ ] Schema push landed before any reactive-path test is claimed green
- [ ] Global-axis manual verification performed against the running stack (not stubbed)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
