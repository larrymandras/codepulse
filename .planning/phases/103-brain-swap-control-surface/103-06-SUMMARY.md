---
phase: 103-brain-swap-control-surface
plan: 06
subsystem: ui
tags: [react, mutation-observer, brain-swap, dashboard-layout, honesty, tokenized-status]

# Dependency graph
requires:
  - phase: 103-03
    provides: "src/hooks/useActiveEngine.ts (useActiveEngine + deriveMixedState — the shared per-profile view-model)"
  - phase: 103-05
    provides: "src/components/brains/BrainPicker.tsx (the assembled picker this badge relays clicks into)"
provides:
  - "src/components/brains/BrainHeaderBadge.tsx — dashboard-wide active-brain badge, mixed-state honest, opens BrainPicker without a second picker"
  - "BrainHeaderBadge mounted in DashboardLayout's status cluster, boundary-isolated"
affects: [103-07, 103-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Invisible-trigger relay: a real, fully-functional instance of an existing self-contained Popover component (BrainPicker) is mounted with opacity-0/pointer-events-none exactly behind a custom-styled accessible button; the visible button forwards a real DOM click via ref to the hidden component's own trigger (matched by a stable aria-label-prefix selector) rather than reimplementing the popover"
    - "MutationObserver-based state mirroring: instead of duplicating a child component's internal pending-dispatch tracking, observe its own rendered pending-suffix DOM node (data-testid) and mirror its presence/text into local state — avoids a second, independently-tracked (and therefore potentially divergent) dispatch state"

key-files:
  created:
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
  modified:
    - src/layouts/DashboardLayout.tsx

key-decisions:
  - "BrainHeaderBadge does not accept BrainPicker's own trigger UI as its visible surface (aria-label there is profile-scoped, not mixed-state-aware) — it mounts a real BrainPicker instance invisibly and relays clicks via a DOM ref, matched by BrainPicker's own stable aria-label prefix, rather than building a second hand-rolled picker (explicitly forbidden by prior_wave_context)"
  - "Pending state is mirrored from BrainPicker's own rendered data-testid=brain-picker-pending-suffix node via MutationObserver, never independently dispatched or tracked — BrainHeaderBadge performs zero swap dispatches of its own"
  - "Provider-identity dot color is resolved via a one-time brainsApi.getCatalogue() fetch on mount, joining ActiveEngine.model against CatalogueEntry.id -> vendor -> PROVIDER_COLORS, with a token-based (var(--muted-foreground)) fallback — never a literal hex, and never a heuristic guess parsed from the model id string"
  - "The picker's profileId prop is sourced from brainsApi.getDefaultProfileId() (falling back to the first known profile), matching the same 103-CONTRACT.md §3 default_profile_id resolution 103-07's composer pill uses for the same profile-less-surface problem — not a locally invented default"
  - "BSC-01 intentionally NOT marked complete in REQUIREMENTS.md — this plan ships the header badge; the composer pill and Settings row (103-07) haven't landed yet. Matches every prior Phase-103 plan's per-plan-vs-full-delivery deferral precedent."

patterns-established:
  - "Invisible-trigger relay pattern for composing a custom-styled accessible entry point in front of an existing self-contained Popover/Dialog component that exposes no controlled-open or custom-trigger prop, without forking or wrapping that component's internals."

requirements-completed: []  # BSC-01 intentionally NOT marked complete — see Decisions Made below

# Metrics
duration: ~35min
completed: 2026-07-28
---

# Phase 103 Plan 06: BrainHeaderBadge Summary

**Dashboard-wide active-brain badge that renders "Mixed brains" plus a stacked provider-color dot cluster whenever profiles disagree — never silently presenting one profile's engine as the fleet's truth — and opens the real `BrainPicker` via an invisible-trigger relay rather than a second, hand-built picker.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-28 (session continuation from Plan 05)
- **Completed:** 2026-07-28
- **Tasks:** 2/2 completed
- **Files modified:** 2 created, 1 modified

## Accomplishments

- `src/components/brains/BrainHeaderBadge.tsx` — reads exclusively through `useActiveEngine()` + the pure `deriveMixedState()` (103-03), so it structurally cannot disagree with itself or any other brain surface (D-14). Renders a single provider-color dot + engine name on agreement, "Mixed brains" + a stacked 3-dot cluster on disagreement, and an honest "No brain reported" state when nothing has been reported yet — all without throwing.
- Session-override vs pinned-default secondary line (D-02, `Clock`/`Pin` icons — never both at once), a `--primary` confirmed-live pulse dot gated on server-confirmed/non-pending/non-stub, and the persistent dashed `STUB` chip (D-16) — all token-driven, zero hardcoded hex, zero `text-[10px]`.
- Solved the "reuse `BrainPicker`, don't build a second picker" constraint (prior_wave_context) against a real architectural gap: `BrainPicker` owns its own Popover open-state and trigger button internally with no controlled-open or custom-trigger prop, and `BrainPicker.tsx` was out of this plan's file scope. Resolved via an **invisible-trigger relay**: a real `BrainPicker` instance is mounted `opacity-0 pointer-events-none` exactly behind the visible, accessible badge button (same box via `absolute inset-0` inside a `relative` wrapper); clicking the visible button forwards a real DOM click to `BrainPicker`'s own trigger (found via its stable `button[aria-label^="Active brain"]` signature) via a ref. Because Radix `PopoverContent` renders through a portal, the resulting popover opens fully visible and interactive at the badge's own screen position even though its trigger element is invisible.
- Solved the resulting "how does the badge know a swap dispatched through the (invisible) real `BrainPicker` is pending" problem without duplicating dispatch logic: a `MutationObserver` watches the hidden host for `BrainPicker`'s own `data-testid="brain-picker-pending-suffix"` node and mirrors its presence/text into the badge's own visible pending state (D-15) — one honest signal, not two independently-tracked ones that could drift apart.
- Wired the badge into `DashboardLayout.tsx`'s status cluster (leftmost after `EStopButton`, before `NotificationBell`, per UI-SPEC §2), wrapped in `<SectionErrorBoundary name="Active Brain">` — a fault in the dashboard-wide engine query now degrades to one boundary message instead of blanking every page. No new keyboard shortcut; the existing `Ctrl+K`/`Ctrl+Shift+K` bindings (`DashboardLayout.tsx`/`SkillCommandPalette.tsx`) are untouched.
- 14/14 new tests, `tsc --noEmit` clean, `npm run build` clean, full suite 2760/2760 passing (0 failures, no regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: BrainHeaderBadge with mixed-state handling** — `f303a3c3` (feat)
2. **Task 2: Mount the badge in the DashboardLayout status cluster** — `29b86827` (feat)

_No plan-metadata commit issued separately — this SUMMARY + STATE/ROADMAP updates are committed together per the final_commit step below._

## Files Created/Modified

- `src/components/brains/BrainHeaderBadge.tsx` — `BrainHeaderBadge`
- `src/components/brains/BrainHeaderBadge.test.tsx` — 14 tests: agreement (2), mixed-state honesty (2), no-engine-reported (1), confirmed-live pulse dot (3: present / absent-under-stub / absent-while-pending), session-vs-pinned secondary line (2), click relay into the real picker (1), pending-never-lies mirroring (2), accessibility (1)
- `src/layouts/DashboardLayout.tsx` — imports `SectionErrorBoundary` (newly imported into this file) and `BrainHeaderBadge`; mounts the badge inside the existing status cluster, boundary-wrapped

## Decisions Made

- **Invisible-trigger relay instead of a second picker.** `BrainPicker`'s own trigger button hardcodes its `aria-label` from its own single `profileId`'s engine — wrong for the badge's dashboard-wide, potentially-mixed context, and `BrainPicker.tsx` is not in this plan's `files_modified`. Rather than fork or wrap its internals, `BrainHeaderBadge` mounts a real, fully-functional `BrainPicker` invisibly at the same screen position as its own visible, correctly-labeled button, and relays clicks via a DOM ref matched against `BrainPicker`'s own stable `aria-label` prefix. This keeps `BrainPicker` reused verbatim (prior_wave_context's explicit requirement) while giving the badge full control over its own accessible surface.
- **`MutationObserver` mirrors `BrainPicker`'s own pending-suffix DOM node** rather than the badge performing its own dispatch or maintaining independent pending state. This was necessary because `BrainPicker` exposes no pending-state callback/prop, and building a second dispatch path would risk the badge's pending indicator disagreeing with the actual in-flight swap (the exact class of honesty failure D-15 forbids).
- **Provider-identity dot color resolved via a one-time `brainsApi.getCatalogue()` fetch**, joining `ActiveEngine.model` (a catalogue entry id, e.g. `"anthropic-sonnet-5"`) against `CatalogueEntry.id -> vendor -> PROVIDER_COLORS`. `ActiveEngine` itself carries no vendor field. A prefix/substring heuristic on the model id string was considered and rejected — it would work for most stub fixture ids but silently guess wrong for others (e.g. `"anthropic-opus-4-8"` vs the vendor key `"anthropic_direct"`), which is exactly the kind of invented reading this phase exists to avoid, even for a purely decorative color. The fallback (`var(--muted-foreground)`, a CSS var, never a literal hex) covers the pre-fetch and fetch-failure cases.
- **Picker `profileId` sourced from `brainsApi.getDefaultProfileId()`**, falling back to the first known profile from `useProfileConfigs()` while that resolves. The badge is not bound to any single profile (unlike `BrainPicker`'s other future callers), so it reuses the same `103-CONTRACT.md` §3 `default_profile_id` resolution 103-07's composer pill will use for the identical "profile-less surface needs a defined dispatch target" problem, rather than inventing a second convention.
- **BSC-01 intentionally NOT marked complete in REQUIREMENTS.md.** This plan ships the header badge; 103-07 (composer pill, Settings row) hasn't landed. Matches every prior Phase-103 plan's own per-plan-vs-full-delivery deferral precedent (Plans 103-01 through 103-05).
- **`STATE.md`/`ROADMAP.md` updated by hand, not via `gsd-sdk state.*`/`roadmap.update-plan-progress`** — per this project's established anti-clobber workaround, consistent with every prior Phase-103 plan.

## Deviations from Plan

None — plan executed as written. The invisible-trigger-relay and MutationObserver-mirroring designs were exercises of Claude's explicit discretion over "exact component decomposition of the picker" (`103-CONTEXT.md`), not deviations from any stated instruction; they are documented above as key decisions because they resolve a real architectural constraint (`BrainPicker.tsx` is out of this plan's file scope) not spelled out mechanically in the plan text.

## Issues Encountered

**Shared-checkout note:** per the session's explicit warning, another Claude session was concurrently active on unrelated Phase-187 `KnowledgeGraph` work in this same checkout throughout this plan (confirmed via `git status --short` before/after each commit — `src/hooks/useKnowledgeGraph.ts`, `src/lib/kgApi.ts`, `src/lib/kgApi.test.ts` appeared modified in the working tree after this plan's own commits landed, never staged or touched by this plan). Verified before and after every commit (`git branch --show-current` = `master`, `git diff --cached --name-only` and `git show --stat HEAD` both confirmed to contain only this plan's own files each time) — no cross-contamination occurred.

No other issues. Both tasks' automated verification (`tsc --noEmit`, `npx vitest run`, `npm run build`) passed on first attempt; no auth gates, no checkpoints in this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `BrainHeaderBadge` is live on every page via `DashboardLayout`, boundary-isolated, and honest about mixed-profile state — ready for 103-07 to build the composer pill (`Chat.tsx`) and Settings → Agents row against the same `useActiveEngine()`/`deriveMixedState()`/`brainsApi` seam.
- The invisible-trigger-relay pattern established here is directly reusable if 103-07's composer pill needs the same "custom visible surface + real `BrainPicker` underneath" composition (the composer pill's own UI-SPEC treatment may differ enough to render `BrainPicker` directly instead — Claude's discretion at that plan).
- BSC-01 remains open in REQUIREMENTS.md pending 103-07's completion of the remaining two surfaces.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: `src/components/brains/BrainHeaderBadge.tsx`
- FOUND: `src/components/brains/BrainHeaderBadge.test.tsx`
- FOUND: `src/layouts/DashboardLayout.tsx`
- FOUND: `.planning/phases/103-brain-swap-control-surface/103-06-SUMMARY.md`
- FOUND commit `f303a3c3` in `git log --oneline --all`
- FOUND commit `29b86827` in `git log --oneline --all`
