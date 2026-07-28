---
phase: 103-brain-swap-control-surface
verified: 2026-07-28T00:00:00Z
status: gaps_found
score: 1/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "BSC-01 — Live view of the current reasoning engine, per agent AND globally, reactive from Convex/telemetry (not a stale config read)"
    status: failed
    reason: >
      The global half of this truth is live (astridr Phase 185/186's swap.set/swap.catalogue/swap.state),
      but every surface Phase 103 built to read it is blind to an already-active global override on page
      load, and the per-profile write path that is supposed to make the badge's "confirmed-live" trust
      signal honest is a public, unauthenticated mutation any client can forge. Live-observed on the
      running stack 2026-07-28: with claude-haiku-4-5-20251001 genuinely active as a global override,
      BrainHeaderBadge read "No brain reported" and the Chat composer pill read "Auto" — only the
      pre-existing Control Center BrainControl (not built by this phase) read the correct value.
    artifacts:
      - path: "src/components/brains/BrainHeaderBadge.tsx:71-91"
        issue: "useGlobalEngineFallback only subscribeEvent('swap.state', ...) — a change-event listener. It never sends `swap.get_state` on mount (the same command Chat.tsx:309 already issues for BrainControl), so an override active before the page loaded produces zero swap.state frames and the badge shows the empty fallback forever."
      - path: "src/pages/Chat.tsx (BrainComposerPill, 103-07)"
        issue: "Scopes to brainsApi.getDefaultProfileId(), which routes through the 184.1-deferred per-profile adapter and structurally cannot observe the global swap.state axis at all — a third, independently-wrong code path, not fixable by a badge-only patch."
      - path: "convex/activeEngine.ts:69-81"
        issue: "recordRouting is declared with the public `mutation` builder (not `internalMutation`) and invoked from runtimeIngest.ts:534 via the public api. namespace. The file's own docstring says the UI must never call this directly to assert an engine — but nothing server-side enforces that; any holder of the shipped VITE_CONVEX_URL can call api.activeEngine.recordRouting from devtools and insert a fabricated 'server-confirmed' row, which BrainHeaderBadge would render with its isConfirmedLive trust-signal pulse dot. Deviates from the cited gatewayQuota.ts precedent, which uses internalMutation."
    missing:
      - "BrainHeaderBadge and the Chat composer pill must both request a global-state snapshot on mount (swap.get_state), not merely subscribe to future changes — one shared resolution order consumed by badge, pill, and BrainControl alike (VALIDATION.md's own gap-closure guidance; do not patch the badge alone)."
      - "convex/activeEngine.ts: recordRouting must become an internalMutation invoked only via internal.activeEngine.recordRouting from runtimeIngest.ts, closing the forgeable public write path."

  - truth: "BSC-02 — Switch the engine on the fly across keyed API models and subscription CLIs"
    status: failed
    reason: >
      The mouse-driven swap path works end-to-end against both the stub and the live global catalogue
      (331 real engines observed live). But the picker's own designed primary interaction — type to
      search (autoFocus input), arrow-navigate, press Enter — is completely non-functional for keyboard
      users, verified against the installed cmdk source.
    artifacts:
      - path: "src/components/brains/BrainPicker.tsx:414-419"
        issue: "CommandItem never receives an onSelect prop. cmdk's Enter handler dispatches a cmdk-item-select DOM event to the currently arrow-highlighted item; Item's own listener calls `onSelect?.(value)`, a no-op when onSelect is undefined. Every other CommandItem usage in this codebase (src/components/CommandPalette.tsx) wires onSelect; this one does not. Only a literal mouse click on BrainPickerRow's nested <button> works, which is why e2e/brain-swap.spec.ts (mouse-click-driven) never caught it."
    missing:
      - "Wire CommandItem's onSelect to the same activation path BrainPickerRow's button uses (must still route through the expand-to-confirm branch for expensive/unknown-tier entries per D-11/UI-SPEC §3, not a naive handleSelect(entry) that skips it)."

  - truth: "BSC-04 — Honest live status: in-flight → success/failure → the resulting active engine reconciled back from astridr (server-confirmed, not optimistic-only)"
    status: failed
    reason: >
      Three independent, compounding defects break end-to-end honesty for the one path this phase
      exists to make trustworthy — a global swap's result and its revert.
    artifacts:
      - path: "src/components/brains/GlobalSwapModal.tsx:154,159-169"
        issue: "Fires the real, live, working `swap.set` (line 154) but discards its result with `.catch(() => {})` — nothing in the success case is even read. The modal's result rows are populated exclusively from a Promise.allSettled fan-out of N `gateway.model.set` calls (lines 159-169), the 184.1-deferred per-profile command, which on a real swap always fails with union_tag_invalid for every profile. Net effect: the modal reports 0/N success for the axis that is deferred by design and says nothing about the global swap.set that actually succeeded. Directly violates 103-CONTRACT.md §8 ('All profiles scope ... dispatches the existing live swap.set, not N gateway.model.set calls')."
      - path: "src/components/brains/GlobalSwapModal.tsx:191-248, src/components/brains/BrainPicker.tsx:437-446"
        issue: "handleDismiss() (behind the 'Done' button, the normal completion path) builds the 'Revert global swap' toast action closing over runRevert(), then calls onOpenChange(false). BrainPicker's handler responds to next===false by setGlobalTarget(null), which unmounts GlobalSwapModal on the very next render ({globalTarget && (...)}). When the toast's Revert action later fires runRevert() against the now-unmounted fiber, its setPhase/setResults calls are no-ops, onOpenChange(true) does nothing (BrainPicker only reacts to false), and the modal never remounts — yet dispatch({type:'swap.set', restore:true}) and the per-profile restore fan-out are plain async calls that DO execute for real, with zero dialog, zero result rows, and (dispatch is called without a successMsg) no success toast of any kind."
      - path: "convex/activeEngine.ts:69-81"
        issue: "Same forgeable-write defect as under BSC-01 — undermines the 'server-confirmed' half of this truth specifically, since a forged row is indistinguishable from a genuine model_routing-sourced snapshot."
    missing:
      - "GlobalSwapModal must read and report the real swap.set outcome for global scope and stop fanning out the deferred per-profile command there (contract §8 compliance)."
      - "Decouple GlobalSwapModal's mount lifecycle from BrainPicker's globalTarget state (e.g. a separate dialogOpen boolean, or drive visibility purely off Dialog's own open prop) so the component instance survives past 'Done' long enough for a Revert click to actually render a result."
      - "recordRouting must become an internalMutation (see BSC-01 gap — same fix closes both)."

  - truth: "BSC-05 (integration gate) — astridr's brain-swap endpoints verified working end-to-end on the running stack before UI was built against them"
    status: failed
    reason: >
      Explicitly not satisfied per the ROADMAP.md success-criteria text itself and 103-VALIDATION.md's
      own sign-off. The global axis's read path (catalogue, 331 live engines) and the D-15 confirm gate
      (zero WS frames dispatch before explicit confirm) ARE genuinely live-verified. The dispatch →
      readback → revert leg is NOT verified — steps 4b, 5, and 6 of the live checkpoint (103-08-T2) all
      failed or were not exercisable, blocked by the BSC-04 defects above. The per-profile axis remains
      correctly and honestly deferred to astridr Phase 184.1 (not a defect — do not report as one).
    artifacts:
      - path: "103-VALIDATION.md:88-107"
        issue: "Per-step live results table: steps 4b (badge update from readback), 5 and 6 (revert affordance + badge reverting) all FAIL / NOT VERIFIED."
    missing:
      - "Re-run 103-08-T2's manual live checkpoint steps 4b/5/6 after the BSC-01/BSC-04 gaps above are closed."
deferred: []
human_verification:
  - test: "Composer pill placement on Chat.tsx at narrow width"
    expected: "Pill renders in the composer without displacing the send affordance"
    why_human: "Visual layout/overlap in the real composer is not assertable in jsdom; VALIDATION.md notes this was not independently re-verified in the 103-08-T2 session (last verified during 103-07 execution only)."
  - test: "GlobalSwapModal confirm-modal content (step 3 of the live checkpoint)"
    expected: "Lists every affected profile current → new, flags pinned-default overwrite count"
    why_human: "Not independently re-verified live this session — relies on existing unit coverage (GlobalSwapModal.test.tsx) only, per VALIDATION.md's own per-step table."
---

# Phase 103: Brain-Swap Control Surface Verification Report

**Phase Goal:** Live current-engine view + on-the-fly swap (keyed API models + subscription CLIs), per-agent vs global scope, server-confirmed status
**Verified:** 2026-07-28
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | BSC-01 — current engine visible globally + per agent, reactive from Convex/telemetry | ✗ FAILED | Headline live finding: `BrainHeaderBadge` and the Chat composer pill both misreported a genuinely-active global override (`No brain reported` / `Auto` vs. the correct `claude-haiku-4-5-20251001`); `BrainHeaderBadge.tsx:71-91` never sends `swap.get_state` on mount. `convex/activeEngine.ts:69-81`'s public `recordRouting` mutation makes the "server-confirmed" trust signal forgeable. |
| 2 | BSC-02 — switch engine on the fly (keyed API + subscription CLIs) | ✗ FAILED | Mouse-driven swap genuinely works against the live 331-engine global catalogue and the stub per-profile catalogue. But `BrainPicker.tsx:414-419`'s `CommandItem`s never wire `onSelect` — keyboard search→arrow→Enter (the component's own designed primary flow, `autoFocus` search input) is completely non-functional; verified against installed `cmdk` source. |
| 3 | BSC-03 — explicit scope control, global swap requires deliberate confirm | ✓ VERIFIED | D-15 confirm gate live-verified: selecting an engine in "All profiles" scope dispatches zero WS frames until "Swap all profiles to {X}" is clicked. Scope resets to "This profile" on every open (`BrainPicker.test.tsx`, unit-verified). `GlobalSwapModal.test.tsx` unit-covers the confirm listing. (Note: the modal's *post-confirm* dispatch has real defects — see truth 4 — but the confirm gate itself holds.) |
| 4 | BSC-04 — honest end-to-end status, server-confirmed, no optimistic "switched" state | ✗ FAILED | `GlobalSwapModal.tsx:154,159-169` fires the real `swap.set` and discards its result via `.catch(() => {})`, reporting failure only for the deferred axis (contract §8 violation). `GlobalSwapModal.tsx:191-248` + `BrainPicker.tsx:437-446`: the "Revert global swap" toast action closes over a component instance that `BrainPicker` unmounts on "Done," so Revert fires real WS commands with zero visible feedback (code review CR-03). Public `recordRouting` mutation (see truth 1) undermines "server-confirmed" for the per-profile axis's future readback too. |
| 5 | BSC-05 — brain-swap endpoints verified end-to-end on the running stack before UI built | ✗ FAILED | Explicitly recorded as NOT satisfied in both `103-VALIDATION.md` and the live ROADMAP success-criteria text itself. Catalogue read + D-15 confirm gate ARE live-verified; the dispatch→readback→revert leg is NOT (steps 4b/5/6 of the 103-08-T2 checkpoint failed or were unexercisable, blocked by truth 4's defects). Per-profile axis deferral to astridr Phase 184.1 is by design, not counted as a defect here. |

**Score:** 1/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `.planning/phases/103-brain-swap-control-surface/103-CONTRACT.md` | Client contract for astridr Phase 184.1 | ✓ VERIFIED | Exists, defines `gateway.model.set`/`models.catalog`/`model_routing`/`brain.fallback`, 280 lines. |
| `src/lib/brainsApi.ts` | Stub/live adapter seam behind `VITE_BRAINS_STUB` | ✓ VERIFIED | 218 lines; `BRAINS_STUB_ACTIVE` flag, module-scope read confirmed (`brainsApi.ts:212,218`). |
| `src/lib/brainsFixtures.ts` | 5 mandatory fixtures | ✓ VERIFIED | 139 lines; fixture ownership confirmed in VALIDATION.md's per-fixture table. |
| `src/lib/brainsApi.test.ts` | Contract-conformance tests | ✓ VERIFIED | 185 lines, passing per VALIDATION.md task map. |
| `convex/schema.ts` (`activeEngineSnapshots`) | New reactive table | ✓ VERIFIED | Schema-pushed to live self-hosted Convex 2026-07-28 (VALIDATION.md sign-off). |
| `convex/activeEngine.ts` | latest-per-profile query + ingest mutation | ⚠️ VERIFIED-WITH-DEFECT | Exists, wired (81 lines), but `recordRouting` is a public `mutation` not `internalMutation` — see CR-01, gap above. |
| `convex/runtimeIngest.ts` (`model_routing` case) | Routes telemetry into activeEngine | ✓ VERIFIED | Present and invoked (line 534), though currently calls the public namespace (tied to the CR-01 fix). |
| `src/hooks/useActiveEngine.ts` | Per-profile + mixed-state hook | ✓ VERIFIED | 97 lines, exports `useActiveEngine`/`deriveMixedState`. |
| `src/components/brains/BrainPickerRow.tsx` | Catalogue row | ✓ VERIFIED | 199 lines. WR-03 (nested focusable span inside button) noted as a lesser accessibility defect, not blocking. |
| `src/components/brains/BrainPicker.tsx` | Popover/cmdk picker, scope, dual-branch dispatch | ⚠️ VERIFIED-WITH-DEFECT | 449 lines, mounted correctly, mouse path works — but keyboard `onSelect` wiring missing (CR-02). |
| `src/components/brains/GlobalSwapModal.tsx` | Confirm→result dialog, snapshot, fan-out, revert | ⚠️ VERIFIED-WITH-DEFECT | 352 lines — confirm gate and row rendering work; result-reporting axis and revert lifecycle are broken (defect #5, CR-03). |
| `src/components/brains/BrainHeaderBadge.tsx` | Dashboard-wide active-brain badge | ⚠️ VERIFIED-WITH-DEFECT | 267 lines, mounted in `DashboardLayout.tsx:583`, `SectionErrorBoundary`-wrapped — but blind to an already-active global override on load (defect #6a). |
| `src/pages/Settings.tsx` | Live per-profile rows, stale `p.model` deleted | ✓ VERIFIED | `useActiveEngine` import present; stale row genuinely replaced (confirmed by grep — no `p.model` config read remains). |
| `src/pages/Chat.tsx` (composer pill) | Pill opening the picker | ⚠️ VERIFIED-WITH-DEFECT | `BrainPicker` wired into the composer, but the pill's data source (`getDefaultProfileId()`) is blind to the global axis (defect #6b). |
| `src/components/brains/BrainFallbackNotice.tsx` | CLI→API fallback toast | ✓ VERIFIED | 54 lines, exports `useBrainFallbackNotice`. |
| `src/components/brains/BrainsWsRegistrar.tsx` | Registers the live WS sender | ✓ VERIFIED | 40 lines; fixed this phase (defect #3) after being found dead (never called) during live testing. |
| `e2e/brain-swap.spec.ts` | Stub round-trip Playwright spec | ✓ VERIFIED | 129 lines, passing; explicitly documented as not live per-profile verification. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `BrainHeaderBadge.tsx` | `useActiveEngine` | reactive per-profile map | ✓ WIRED | Correct for the per-profile (stub-backed, deferred) axis. |
| `BrainHeaderBadge.tsx` | `swap.state` (global) | `subscribeEvent`, never `swap.get_state` | ⚠️ PARTIAL | Subscribes to future changes only; no snapshot request on mount — see gap. |
| `DashboardLayout.tsx` | `BrainHeaderBadge.tsx` | mount + `SectionErrorBoundary` | ✓ WIRED | `DashboardLayout.tsx:18,583`. |
| `BrainPicker.tsx` | `brainsApi.ts` | `This profile` branch dispatch | ✓ WIRED | Confirmed. |
| `BrainPicker.tsx` | `GlobalSwapModal.tsx` | `All profiles` branch opens confirm modal | ✓ WIRED | Confirmed, `BrainPicker.tsx:437-446`. |
| `GlobalSwapModal.tsx` | live `swap.set` | global-scope dispatch | ⚠️ HOLLOW (result discarded) | Dispatch genuinely fires and works (operator-observed live), but its result is thrown away — see defect #5. |
| `GlobalSwapModal.tsx` | `brainsApi.dispatchSwap` (per-profile fan-out) | populates result rows for "All profiles" scope | ✗ CONTRACT VIOLATION | Should not be used for global scope per `103-CONTRACT.md` §8; always fails live, and its failure is what the modal reports. |
| `Chat.tsx` | `BrainPicker.tsx` | composer pill trigger | ✓ WIRED | Confirmed. |
| `Settings.tsx` | `useActiveEngine.ts` | live engine lookup replacing `p.model` | ✓ WIRED | Confirmed, stale read deleted. |
| `runtimeIngest.ts` | `activeEngine.recordRouting` | `model_routing` case | ⚠️ WIRED-BUT-INSECURE | Wired and functioning, but through the public `api.` namespace — see CR-01. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `BrainHeaderBadge` (per-profile path) | `activeEngines` | `useActiveEngine` → `api.activeEngine.latestByProfile` | No live rows yet (astridr Phase 184.1 not shipped — by-design deferral) | ⚠️ STATIC (deferred, not a defect) |
| `BrainHeaderBadge` (global fallback path) | `globalModel` | `swap.state` WS subscription, no `swap.get_state` snapshot | Only reflects changes that occur *while the page is open*; a pre-existing override never appears | ✗ DISCONNECTED on load — defect #6a |
| `GlobalSwapModal` result rows | `results` | `Promise.allSettled` fan-out of deferred `gateway.model.set` | Always fails live (union_tag_invalid); the genuinely-succeeding `swap.set` result is discarded | ✗ HOLLOW — defect #5 |
| Chat composer pill | pill label | `brainsApi.getDefaultProfileId()` (per-profile, stub-backed) | Cannot observe the global axis | ✗ DISCONNECTED from global truth — defect #6b |

### Behavioral Spot-Checks

Not re-run independently this verification pass — `103-VALIDATION.md`'s 103-08-T2 live checkpoint (2026-07-28, against the running Ástríðr WS + CodePulse dev server without `VITE_BRAINS_STUB`) is treated as authoritative per this task's explicit instructions, and its per-step table is reproduced in the Observable Truths section above. Source-level re-verification (this pass) confirmed the cited line evidence for every defect still matches the current code (`BrainHeaderBadge.tsx:71-91`, `GlobalSwapModal.tsx:154,159-169,191-248`, `BrainPicker.tsx:414-419,437-446`, `convex/activeEngine.ts:69-81` all read directly and match VALIDATION.md/REVIEW.md's citations exactly).

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention in this repo/phase; none declared in any of the 8 PLAN/SUMMARY files. Skipped — no runnable probe entry points for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| BSC-01 | 103-01..103-07 | Live current-engine view, per-agent + global | ✗ BLOCKED | REQUIREMENTS.md marks this "✅ satisfied 2026-07-28" — **that claim is contradicted by this verification's own live evidence** (see truth 1 above). This VERIFICATION.md's finding supersedes the SUMMARY-derived claim. |
| BSC-02 | 103-01..103-07 | Switch engine on the fly (keyed API + subscription CLI) | ✗ BLOCKED | REQUIREMENTS.md marks this "✅ satisfied 2026-07-28" — **contradicted by CR-02** (keyboard selection non-functional). Mouse path does work. |
| BSC-03 | 103-04, 103-05 | Scope control, explicit global confirm | ✓ SATISFIED | Confirm gate and scope-reset genuinely verified (live + unit). |
| BSC-04 | 103-04, 103-08 | Honest live status, server-confirmed | ✗ BLOCKED | See truth 4 — defect #5, CR-01, CR-03. |
| BSC-05 | 103-08 | Integration gate | ✗ BLOCKED | Explicitly not satisfied per ROADMAP.md's own success-criteria text and VALIDATION.md sign-off. |

**Note on REQUIREMENTS.md drift:** BSC-01 and BSC-02 are currently marked satisfied in `.planning/REQUIREMENTS.md` (lines 13-14). Those markers were written from SUMMARY-level claims before the 103-08-T2 live checkpoint and code review ran, and are now stale — both truths FAILED live verification. `.planning/REQUIREMENTS.md` should be corrected (unchecked, or annotated with the same gap references as this report) as part of gap closure, since a stale "satisfied" marker is exactly the kind of stale-config-read failure this phase exists to eliminate.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `convex/activeEngine.ts` | 69-81 | Public mutation as the sole honesty-critical write path (CR-01) | 🛑 Blocker | Forgeable "server-confirmed" state; undermines BSC-01/BSC-04 architecturally, not just cosmetically. |
| `src/components/brains/BrainPicker.tsx` | 414-419 | Missing `CommandItem.onSelect` (CR-02) | 🛑 Blocker | Keyboard-only selection completely non-functional; only mouse click works. |
| `src/components/brains/GlobalSwapModal.tsx` | 154, 159-169 | Discards real `swap.set` result; fans out deferred axis for global scope (defect #5, contract §8 violation) | 🛑 Blocker | Modal always reports failure for a swap that actually succeeded. |
| `src/components/brains/GlobalSwapModal.tsx` | 191-248 | Revert action closes over an instance the parent unmounts on "Done" (CR-03) | 🛑 Blocker | Revert fires real commands with zero UI feedback on the normal completion path. |
| `src/components/brains/BrainHeaderBadge.tsx` | 71-91 | No `swap.get_state` snapshot on mount (defect #6a) | 🛑 Blocker | Badge blind to any override active before page load. |
| `src/pages/Chat.tsx` (composer pill) | — | Reads deferred per-profile seam only (defect #6b) | 🛑 Blocker | Composer pill structurally cannot observe global axis. |
| `src/components/brains/BrainPicker.tsx` | 197-220, 361-373 | No staleness guard on scope-driven catalogue fetch (WR-01) | ⚠️ Warning | Rapid scope toggling can dispatch through the wrong axis. |
| `src/components/brains/BrainPicker.tsx` | 422 | `isCurrent` highlight ignores scope (WR-02) | ⚠️ Warning | Misleading highlight in "All profiles" view. |
| `src/components/brains/BrainPickerRow.tsx` | 138-163 | Focusable `<span tabIndex={0}>` nested inside `<button>` (WR-03) | ⚠️ Warning | Invalid content model, dead keyboard tab stop. |

No `TBD`/`FIXME`/`XXX` markers found in any file touched by this phase (checked `src/components/brains/*`, `convex/activeEngine.ts`).

### Human Verification Required

#### 1. Composer pill placement at narrow width

**Test:** Load `/chat` at a narrow viewport, confirm the pill renders without displacing the send affordance.
**Expected:** Pill fits without layout breakage.
**Why human:** Visual overlap/placement not assertable in jsdom; not independently re-verified in the most recent (103-08-T2) live session.

#### 2. Global confirm-modal content accuracy

**Test:** Trigger an "All profiles" swap and read the confirm dialog's per-profile `current → new` list and pinned-default count against real profile data.
**Expected:** Every affected profile listed correctly, pinned-default count accurate.
**Why human:** Relies on unit-test coverage only (`GlobalSwapModal.test.tsx`); not independently re-exercised against live data in the 103-08-T2 session.

### Gaps Summary

Phase 103 shipped real, substantive infrastructure — the Convex `activeEngineSnapshots` substrate, the `103-CONTRACT.md` deliverable, the D-15 confirm-gate mechanic (genuinely live-verified: zero dispatch before explicit confirm), the live 331-engine global catalogue read, and the removal of the stale `Settings.tsx` `p.model` read are all real and correctly wired. That work should not be discarded.

But the phase's own headline goal — "an operator can see which reasoning engine Ástríðr is running... with... an honest, server-confirmed result" — fails on live evidence in exactly the way BSC-01 exists to prevent. With one global override genuinely active, three surfaces gave three different answers; two of those wrong answers were built by this phase. The root cause is one shared class of bug across two files (badge + composer pill never request a state snapshot / read from the wrong axis) plus one shared class of bug in `GlobalSwapModal` (dispatches the wrong axis for global scope and loses its own successful result, and its revert path is unreachable from the normal completion flow). Code review additionally found the picker's designed keyboard interaction is entirely non-functional, and the per-profile write path — meant to be the trust anchor for this entire feature — is a public mutation any client can call to forge state.

None of these six defects (2 open from VALIDATION.md + 3 Critical + 1 Warning-adjacent from REVIEW.md, WR-01/02/03 noted but not blocking) were caught by the 2,813-test green unit suite, because `VITE_BRAINS_STUB` masked every one of them from the entire test suite — consistent with this task's framing. A gap-closure cycle (`/gsd-plan-phase 103 --gaps`) should resolve the badge/pill blindness (6a/6b) together via one shared "what brain is actually running" resolution order, fix `GlobalSwapModal`'s axis violation and result-discarding (defect #5) together with its unmount-before-revert lifecycle bug (CR-03) since both live in the same component and the same result-reporting code path, harden `recordRouting` to `internalMutation` (CR-01), and wire `CommandItem.onSelect` (CR-02). `.planning/REQUIREMENTS.md`'s stale "✅ satisfied" markers on BSC-01/BSC-02 should also be corrected as part of the same cycle.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
