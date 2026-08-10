---
phase: 109-per-agent-engine-ui
verified: 2026-08-10T19:20:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 109: Per-Agent Engine UI Verification Report

**Phase Goal:** Per-Agent Engine UI — the already-built picker/badge/confirm-modal surfaces light up on real telemetry with honest server-confirmed swap status
**Verified:** 2026-08-10
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (roadmap Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Picker "This profile" scope, header badge, and pre-swap confirm modal's current-engine column show a profile's actual current engine from telemetry, never config | ✓ VERIFIED | `resolveActiveBrain` (`src/hooks/useResolvedBrain.ts:328-384`) implements the precedence chain: per-profile override → global override → telemetry → fleet-only lastTurn → none. Wired into `BrainPicker.tsx`, `BrainHeaderBadge.tsx`, `GlobalSwapModal.tsx` confirm column. Live-proven at Probe E (`109-LIVE-EVIDENCE.md` L544-611): every surface that can show the pinned SUBJECT showed the pin (modelA), every control showed the global (modelC), in the same state. Operator-signed ENGINE-03. |
| 2 | A per-profile swap shows honest live status (in-flight → success/failure) reconciled to the resulting active engine read from Ástríðr — no optimistic success | ✓ VERIFIED | `useProfileSwap.ts` confirms `confirming → confirmed` only against the server-pushed `swap.state` readback (`:161-180`), never the ack alone. Live-proven twice: 109-09 Probe D showed the base label held its OLD value 272-364ms into the ack window and only flipped after (no optimistic flip). 109-09 found a real dev-mode defect (outcome machine stuck in `pending`, root cause: `unmountedRef` never reset on remount under StrictMode) — fixed in 109-10 (`useProfileSwap.ts:143-159`, one-line reset), regression-guarded by a test that mutation-tests RED against unmodified source (independently reproduced by this verifier — see below), and re-verified live on `:5173` with all four legs passing (`109-LIVE-EVIDENCE.md` "109-10 re-verification"). Operator-signed ENGINE-04. |
| 3 | A profile with no engine telemetry yet renders an honest absent/unknown state, never a fabricated current engine | ✓ VERIFIED | Canonical string `"Not reported"` is the sole absent-state literal across `BrainHeaderBadge.tsx:111`, `BrainPicker.tsx:344,435`, `Chat.tsx:196`, `LlmStatusPanel.tsx:82` — grep for `"Auto"` as a literal (excluding tests) returns zero hits in these files. Live-proven at Probe F (`109-10`, "Probe F — COMPLETE"): a genuinely telemetry-less profile (`gate-probe-f`, created via the new `profiles.removeConfig`-enabled round trip) read exactly `Not reported` on all three measurable surfaces (picker's `isCurrent` marker on ZERO rows, confirm-modal column, Settings row), each against real-valued controls in the same measurement. Header badge is a structural non-measurable (bound to the active profile only), correctly not counted as a failure. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `astridr/providers/router.py::get_all_profile_overrides` | override enumerator | ✓ VERIFIED | Present at line 847; sibling `get_all_profile_override_sources` at 858. |
| `astridr/engine/control_verbs/dispatch.py` `profile_overrides` key | swap.state payload field | ✓ VERIFIED | Built at lines 106-123 from `router.get_all_profile_overrides()`. |
| `astridr/api/ws_commands.py` `default_profile_id` | swap.catalogue ack field | ✓ VERIFIED | Line 1258, sourced from `self._default_profile_id` (bootstrap-threaded config), not Convex ordering. |
| `convex/controlVerbSwaps.ts::listGlobal` | bounded query matching absent `scope` | ✓ VERIFIED | Line 111-120: `withIndex("by_scope", (q) => q.eq("scope", undefined))`, capped at `SWAP_HISTORY_CAP`. Matches on `undefined` per its own docstring reasoning (L100-109), not `null`. |
| `convex/controlVerbSwapsFilters.ts::mergeSwapHistory` | dependency-free pure helper | ✓ VERIFIED | Line 64; confirmed no `_generated`/`convex/values` imports (only explanatory comments reference them). |
| `src/hooks/useBrainCatalogue.ts` | single swap.catalogue fetcher | ✓ VERIFIED | Stub seam fully retired: zero hits for `VITE_BRAINS_STUB`, `BRAINS_STUB_ACTIVE`, `brainsFixtures`, `gateway.model.set` across `src/`, `e2e/`, `playwright.config.ts`. `e2e/brain-swap.spec.ts` and `src/lib/brainsFixtures.ts` deliberately deleted (109-03-SUMMARY.md documents the reasoning: Playwright's `webServer` never runs an astridr backend, so a live rewrite had nothing to connect to). |
| `src/hooks/useResolvedBrain.ts::useProfileBrainOverrides` + override rung | top-rung precedence | ✓ VERIFIED | `resolveActiveBrain` L337-345 checks `profileOverrides[profileId]` before the global override (L347-349). |
| `src/lib/brainsApi.ts::modelIdsMatch` | single equality comparator | ✓ VERIFIED | Exported L95; consumed in `BrainHeaderBadge.tsx`, `BrainPicker.tsx`, `GlobalSwapModal.tsx`, `useActiveEngine.ts`, `Chat.tsx`, `Settings.tsx` (6 consumer files, not just the 4 originally enumerated). |
| `src/lib/catalogueBilling.ts::mapCatalogueVendorToBilling` | vendor→billing translation with Unclassified fallback | ✓ VERIFIED | L58-71: empty/missing vendor is the only path to `unclassified`/`costTier:"unknown"`. |
| `src/components/brains/BrainPickerRow.tsx` `needsConfirm` prop | required, hoisted computation | ✓ VERIFIED | Required prop (L60), computed once in `BrainPicker.tsx:548` via `shouldConfirmCost(entry)`, consumed at both click and keyboard-activation sites. |
| `src/components/brains/SwapHistoryList.tsx` | shared row-rendering component | ✓ VERIFIED | Exported L46; consumed by both `Settings.tsx` (inside `CollapsibleContent`, L231) and `GlobalSwapModal.tsx` (L256). |
| `src/hooks/useProfileSwap.ts` `unmountedRef` reset | StrictMode remount fix | ✓ VERIFIED | L153, `unmountedRef.current = false` inside the mount effect. Mutation-tested by this verifier: commenting the line out reproduces exactly the live gate's failure (`expected {status:'pending'} to deeply equal {status:'confirming'}`, 2 of 18 tests fail); restoring it returns 18/18 green with an empty `git diff`. |
| `convex/profiles.ts::removeConfig` | single-row delete, closing the Probe F one-way door | ✓ VERIFIED | L215-246: index-seeked `.first()`, single `ctx.db.delete`, audited, idempotent (`{deleted:false}` on absent row), `newValue: null` (not `undefined`, avoiding the required-field validator abort the 109-10 gate caught live). Regression-tested in `convex/profilesRemoveConfig.test.ts` (11/11 passing, verified by this verifier). |
| `.planning/phases/109-per-agent-engine-ui/109-LIVE-EVIDENCE.md` | pasted raw evidence + operator sign-off | ✓ VERIFIED | Contains dated operator sign-offs for all three requirements (2026-08-10), each with raw command/DOM/WS output directly above the verdict, per this plan type's own contract. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `dispatch.py::build_swap_state_payload` | `router.py::get_all_profile_overrides` | enumerator call | ✓ WIRED | Confirmed at `dispatch.py:115`. |
| `useProfileSwap.ts` | `useResolvedBrain.ts::useProfileBrainOverrides` | readback confirm | ✓ WIRED | `useProfileSwap.ts:61,111,170`. |
| `BrainPicker.tsx` | `catalogueBilling.ts::mapCatalogueVendorToBilling` | vendor group/billing derivation | ✓ WIRED | Confirmed via grep; `PROVIDER_BILLING` membership test used, not `getBillingType`'s api fallback. |
| `useControlVerbSwaps.ts` | `convex listByScope` + `listGlobal` | merged via `mergeSwapHistory` | ✓ WIRED | Confirmed consumer wiring in Settings/SwapHistoryList chain. |
| running `astridr-agent` container | rebuilt image with D-03/D-05 symbols | in-container symbol probe | ✓ WIRED | `109-LIVE-EVIDENCE.md` Section 3: pre-rebuild probes returned `False` for all three symbols with a bogus-symbol negative control also `False`; post-rebuild all three `True`. |
| live Convex reads | self-hosted instance | explicit `--url 127.0.0.1:3210` | ✓ WIRED | Confirmed throughout `109-LIVE-EVIDENCE.md`; no `npx convex` cloud-default invocation found. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `BrainPicker.tsx` "This profile" scope | `resolvedTrigger.model` via `resolveActiveBrain` | `useProfileBrainOverrides()` ← `swap.state` push / `swap.get_state` ack over the live WS | Live-proven non-empty, correct per-profile values (Probe A/B/E) | ✓ FLOWING |
| `SwapHistoryList.tsx` | merged scoped+global rows | `convex listByScope`/`listGlobal` ← real `controlVerbSwaps` rows on the self-hosted instance | Live-proven 17→18 row counts with correct GLOBAL marking (Probe H) | ✓ FLOWING |
| `useProfileSwap.ts` outcome machine | `outcome.status` | server-pushed `swap.state` readback, not the ack | Live-proven server-confirmed timing (272-626ms after ack across three separate runs) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Regression test fails without the `unmountedRef` fix (mutation test) | comment out `useProfileSwap.ts:153`, run `npx vitest run src/hooks/useProfileSwap.test.ts` | 2/18 failed with `expected {status:'pending'} to deeply equal {status:'confirming'}` | ✓ PASS |
| Regression test passes with the fix restored | restore line, re-run same command, `git diff --stat` confirms clean revert | 18/18 passed, empty diff | ✓ PASS |
| `profiles.removeConfig` regression suite | `npx vitest run convex/profilesRemoveConfig.test.ts` | 11/11 passed | ✓ PASS |
| Full suite + typecheck at verification time | `npx vitest run` / `npx tsc --noEmit` | 3758 passed / 285 files, 17 skipped, todo 193; tsc exit 0 | ✓ PASS |

### Probe Execution

Not applicable in the `scripts/*/tests/probe-*.sh` sense — this phase's "probes" (A-H) are the operator-attended live gate documented in `109-LIVE-EVIDENCE.md`, not shell scripts. Per the phase's own design (109-09/109-10 are `autonomous: false` human-verify checkpoints), this verifier did not and could not re-run those against the live stack — they require a live astridr container, self-hosted Convex, and a browser session with an authenticated WS. The durable record was read and cross-checked against the code (this report's artifact/key-link sections above); the operator sign-offs are dated 2026-08-10 and are internally consistent (each verdict sits directly under raw pasted output, per the file's own stated premise).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ENGINE-03 | 109-01, 109-03, 109-04, 109-05, 109-07, 109-09, 109-10 | Operator sees each profile's current engine, sourced from telemetry | ✓ SATISFIED | Code verified (precedence chain, wired surfaces) + live Probe A/E, operator sign-off 2026-08-10. |
| ENGINE-04 | 109-01, 109-03, 109-06, 109-09, 109-10 | Per-profile swap reports honest server-confirmed status | ✓ SATISFIED | Code verified (readback-only confirmation, StrictMode fix present and mutation-tested) + live Probe D full four-leg pass on 109-10 re-run, operator sign-off 2026-08-10. |
| TELE-02 | 109-02, 109-08, 109-09 | `control_verb_swap` routed and surfaced as per-profile swap history | ✓ SATISFIED | Code verified (`listGlobal`, `mergeSwapHistory`, `SwapHistoryList` host) + live Probe G/H, operator sign-off 2026-08-10. |

No orphaned requirements: `REQUIREMENTS.md` maps only ENGINE-03, ENGINE-04, TELE-02 to Phase 109, and all three appear in at least one plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/pages/Settings.tsx` | 239 | Stale comment: "`agentProfiles` … zero rows in production" | ℹ️ Info | Confirmed false as written — live self-hosted instance returns 3993 rows (per 109-10-SUMMARY.md and STATE.md, already disclosed as a known follow-up, not new). The rendering decision it justifies (render from `profileConfigs`, not `agentProfiles`) may still be correct; only the stated justification is stale. |
| `convex/profiles.ts` | ~113 | Same stale claim, sibling location | ℹ️ Info | Same as above — already recorded as a known follow-up in 109-10-SUMMARY.md, not reported here as new. |
| `src/hooks/useAgentProfiles.ts` / `Settings.tsx` (Agent Profiles card) | 9 / 237-240 | "New Profile" writes `agentProfiles` (`api.agentProfiles.create`), while the card it lives in renders exclusively from `profileConfigs` | ℹ️ Info | Confirmed structurally: a profile created via that button is invisible in the section it appears in. Already recorded as a known follow-up (109-10-SUMMARY.md, STATE.md), not a new gap. Whether defect or intentional (serving a separate Roster feature) is unresolved and out of this phase's scope. |
| `ROADMAP.md` | 725 | States "9 plans (7 waves)" | ℹ️ Info | 10 plan files exist (`109-01` through `109-10`); 109-10 is gap-closure work added after the roadmap entry was written. Cosmetic only — does not affect requirement satisfaction. |

No blocking anti-patterns. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 14 non-test source files modified across this phase's 10 plans (astridr + codepulse), verified by direct grep.

### Human Verification Required

None. Both blocking human-verify checkpoints this phase required (109-09 Task 2/3, 109-10 Task 2) were already executed and dated-signed by the operator (Larry Mandras, 2026-08-10) against the running stack, with raw evidence pasted directly above each verdict in `109-LIVE-EVIDENCE.md`. This verifier cross-checked those claims against the live source code (all artifacts, key links, and the specific fix/regression-test pair the live gate's own defect required) and found them consistent — no further human action is needed for this phase to be considered complete.

### Gaps Summary

None found. All three phase requirements (ENGINE-03, ENGINE-04, TELE-02) are:
1. Implemented in code, verified artifact-by-artifact and link-by-link against the plans' `must_haves`.
2. Live-proven against the running self-hosted stack, with the one real defect the live gate found (`useProfileSwap.ts`'s `unmountedRef` StrictMode bug) fixed, regression-guarded by a test independently mutation-tested by this verifier (fails on unmodified source, passes with the fix, clean revert confirmed), and re-verified live.
3. Dated operator sign-offs recorded, consistent with STATE.md and REQUIREMENTS.md.

Two items are already known, out-of-scope follow-ups (not new gaps, confirmed accurate by this verifier per the task's instruction not to re-report them): the `agentProfiles`/`profileConfigs` split leaving `New Profile`-created rows invisible in the Agent Profiles card, and the stale "zero rows in production" comment at `Settings.tsx:239` / `convex/profiles.ts:~113` (live instance holds 3993 rows).

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_
