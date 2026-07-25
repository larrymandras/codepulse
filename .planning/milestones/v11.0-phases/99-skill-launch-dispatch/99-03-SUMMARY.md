---
phase: 99-skill-launch-dispatch
plan: 03
subsystem: ui
tags: [react, radix-popover, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch (Plan 01)
    provides: "src/lib/skillRun.ts (RunTarget/AutoSendHandoff) + src/lib/profiles.ts (PROFILES/ProfileId single source, D-08)"
provides:
  - "src/components/skills/RunChatPopover.tsx — controlled w-72 p-4 arg-input popover, calls onSubmit(text) (LAUNCH-01, D-04/D-05)"
  - "src/components/skills/RunAstridrPopover.tsx — same shell + PROFILES-sourced persona picker, calls onSubmit(text, profile) (LAUNCH-03, D-07/D-08/D-09)"
affects: [99-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Callback ref (not useEffect keyed on `open`) for focus/cursor placement inside Radix Popover.Content — PopoverContent only mounts its children a render pass after `open` first flips true, so an effect on the outer `open` prop can run before the <input> exists in the DOM; a callback ref fires exactly when the real node appears."
    - "Pure controlled capture popover: prefill + onSubmit(text[, profile]) only — no send/navigate/record side effects inside the component itself (D-05); caller wires the real effect after navigation."

key-files:
  created:
    - src/components/skills/RunChatPopover.tsx
    - src/components/skills/RunChatPopover.test.tsx
    - src/components/skills/RunAstridrPopover.tsx
    - src/components/skills/RunAstridrPopover.test.tsx
  modified: []

key-decisions:
  - "Focus/cursor-placement logic lives in a callback ref (`attachInputRef`), not a `useEffect` keyed on `open` — empirically verified via a throwaway debug harness that Radix's `PopoverContent` defers actually mounting its children by one render pass after the controlled `open` prop first flips true (it settles its own internal controllable state first). An effect scoped to the outer `open` prop fires too early and reads a null ref; the callback ref fires at the exact commit the `<input>` DOM node is inserted, regardless of which render pass that lands in."
  - "PopoverAnchor's `virtualRef` prop types against `React.RefObject<Measurable>` from the internal (non-direct-dependency) `@radix-ui/rect` package. Bridged via a local structurally-identical `Measurable` interface + an `as unknown as` cast, rather than importing the transitive dependency directly or widening this plan's fixed `anchorRef?: React.RefObject<HTMLElement | null>` prop contract."
  - "Test-file acceptance checks (`does not import useAstridrChat/useNavigate/recordSkillLaunch`) strip comment lines before matching — both components' own header docstrings describe, in prose, what they deliberately do NOT do (D-05), which would otherwise false-positive a naive substring/regex grep against the raw file text."

requirements-completed: [LAUNCH-01, LAUNCH-03]

# Metrics
duration: 45min
completed: 2026-07-23
---

# Phase 99 Plan 03: Run Chat / Ástríðr Popovers Summary

**Two pure, controlled pre-send capture popovers (RunChatPopover, RunAstridrPopover) built on KGViewsPopover's `w-72 p-4` shell — prefill the skill invocation, collect optional args, and hand `onSubmit(text[, profile])` back to the caller with zero send/navigate/record side effects of their own.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 completed
- **Files modified:** 4 (all created, 0 modified)

## Accomplishments
- `RunChatPopover.tsx` — controlled Radix `Popover` (`w-72 p-4`, anchored via `PopoverAnchor`/`virtualRef`), prefilled `Input` (cursor at end, never auto-selected), Enter/Send submit the trimmed invocation via `onSubmit(text)`, Escape/close is a zero-side-effect no-op (D-04/D-05). 10 tests green.
- `RunAstridrPopover.tsx` — same shell plus a 3-way "Answer as" segmented persona control (`role="tablist"`/`role="tab"`) sourced verbatim from `PROFILES` (`src/lib/profiles.ts`, D-08 — no second copy), forwarding the chosen `ProfileId` via `onSubmit(text, profile)`. Persona dots read `--status-ok`/`--status-warn`/`--status-info` via CSS var, no hardcoded hex. Honesty guard (D-09/D-14a): copy never claims "answered as {persona}" — Send stays target-agnostic, verified by a negative-assertion test scanning `document.body.textContent`. 9 tests green.
- Diagnosed and fixed a real Radix Popover timing gap during implementation (see Decisions/Deviations below) — the plan's suggested `useEffect`-based cursor-placement approach silently failed against the real Radix component tree; both components now use a callback-ref pattern that is provably correct against the actual DOM mount timing.

## Task Commits

Each task was committed atomically:

1. **Task 1: RunChatPopover — controlled arg-input pre-send capture (D-04/D-05)** - `8a2e2cd` (feat)
2. **Task 2: RunAstridrPopover — persona picker + arg input (D-07/D-08/D-09)** - `400f598` (feat)

_Both tasks were written test-first per the plan's `<behavior>` blocks (all 6 + 5 behavior tests plus copy/acceptance checks authored alongside the implementation in a single commit each, since the components didn't exist yet — there was no pre-existing green baseline to regress from)._

## Files Created/Modified
- `src/components/skills/RunChatPopover.tsx` - Controlled Chat-target arg-capture popover; `onSubmit(text)`
- `src/components/skills/RunChatPopover.test.tsx` - 10 tests: prefill/cursor, Enter/Send/typed-args submit, Escape/close no-op, empty-value guard, D-05 pure-capture import guard
- `src/components/skills/RunAstridrPopover.tsx` - Controlled Ástríðr-target popover with `PersonaSwitch`; `onSubmit(text, profile)`
- `src/components/skills/RunAstridrPopover.test.tsx` - 9 tests: 3-tab persona render + default selection, profile forwarding, Escape/close no-op, honesty negative-assertion, D-08/D-05 import guards, no-hardcoded-hex guard

## Decisions Made

See frontmatter `key-decisions` above (callback-ref timing fix, `Measurable` type bridge, comment-stripped acceptance-test greps).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cursor-placement `useEffect` keyed on `open` never fired against the real DOM node**
- **Found during:** Task 1, while writing the first `<behavior>` test (prefill + cursor-at-end assertion)
- **Issue:** The plan's `<action>` guidance suggested a `useEffect` scoped to `open` to focus the input and place the cursor at the end. Empirically (via a throwaway debug harness, deleted before commit), this effect fired with `inputRef.current === null` — Radix's `PopoverContent` doesn't mount its children into the DOM in the same render pass where the controlled `open` prop first becomes `true`; it settles its own internal controllable state first. The ref-object + `useEffect` combination read the ref one render pass too early. The resulting behavior (confirmed via jsdom) was that Radix's own internal `FocusScope` autofocus took over instead, selecting the entire prefilled text (`selectionStart:0, selectionEnd:16`) rather than the required collapsed cursor at the end — the opposite of D-04's "never auto-selected" requirement.
- **Fix:** Replaced the ref-object + `useEffect` pair with a callback ref (`attachInputRef`) that runs the focus + `setSelectionRange` logic directly when React attaches the real DOM node, regardless of which render pass that occurs in. Applied identically to both `RunChatPopover.tsx` and `RunAstridrPopover.tsx`.
- **Files modified:** `src/components/skills/RunChatPopover.tsx`, `src/components/skills/RunAstridrPopover.tsx`
- **Verification:** Both files' "opens with cursor at end, not auto-selected" tests pass deterministically (`selectionStart === selectionEnd === invocation.length`); full `npx vitest run src/components/skills/` (22 files, 205 tests) green.
- **Committed in:** `8a2e2cd` (Task 1), `400f598` (Task 2 — same pattern applied)

**2. [Rule 3 - Blocking] `PopoverAnchor`'s `virtualRef` prop type incompatible with this plan's fixed `anchorRef` prop contract**
- **Found during:** Task 1, `npx tsc --noEmit`
- **Issue:** Radix's `PopoverAnchor` types `virtualRef` as `React.RefObject<Measurable>` (`Measurable` from the internal, non-direct-dependency `@radix-ui/rect` package). This plan's interface contract fixes `anchorRef?: React.RefObject<HTMLElement | null>`, and TypeScript rejected the direct assignment (the `null` member of the union isn't assignable to `Measurable`).
- **Fix:** Added a local, structurally-identical `Measurable` interface (`{ getBoundingClientRect(): DOMRect }`) in each file and bridged the two `RefObject<T>` generics via `as unknown as React.RefObject<Measurable>` at the single call site, rather than importing the transitive `@radix-ui/rect` package directly or widening the plan's prop contract.
- **Files modified:** `src/components/skills/RunChatPopover.tsx`, `src/components/skills/RunAstridrPopover.tsx`
- **Verification:** `npx tsc --noEmit` clean across the repo.
- **Committed in:** `8a2e2cd` (Task 1), `400f598` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary to make the plan's own D-04 ("never auto-selected") and D-05 ("pure capture, positioned via `anchorRef`") requirements genuinely true against the real Radix component, and to keep `tsc --noEmit` clean. No scope creep — both fixes are contained entirely within the two files the plan already scoped.

## Issues Encountered

None beyond the two auto-fixed deviations above (both diagnosed and resolved inline).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both popovers exist exactly per the plan's `<interfaces>` contract (`onSubmit(text)` / `onSubmit(text, profile)`, `anchorRef`, `defaultProfile`) and are ready for Plan 04 (the target chooser) to render + wire `open`/`onOpenChange`/`onSubmit`/`anchorRef` — no further changes needed to either file.
- `npx tsc --noEmit` clean; `npx vitest run src/components/skills/RunChatPopover.test.tsx src/components/skills/RunAstridrPopover.test.tsx` — 19/19 green; full `src/components/skills/` suite (22 files, 205 tests) — zero regressions.
- No blockers for Plan 04.

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files verified present (`RunChatPopover.tsx`, `RunChatPopover.test.tsx`, `RunAstridrPopover.tsx`, `RunAstridrPopover.test.tsx`, this SUMMARY.md); all 3 commits (`8a2e2cd`, `400f598`, `51af947`) verified present in git log.
