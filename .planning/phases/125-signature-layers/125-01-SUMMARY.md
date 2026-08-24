---
phase: 125-signature-layers
plan: 01
subsystem: ui
tags: [css, tokens, oklch, canvas-rasterisation, playwright, vitest, event-taxonomy, websocket, build-ratchet, vite]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "--primary/--astridr/--status-ok hue owners, all five theme blocks, the tokenSweep.ratchet.test.ts shape this plan's ratchet copies"
  - phase: 124-shell-information-architecture
    provides: "the header slot the Signal Horizon attaches beneath, App.tsx's static/lazy chunk split this plan's ratchet measures"
provides:
  - "--aurora-a/b/c CSS tokens, declared once in :root, deriving from --primary/--astridr/--status-ok"
  - "--font-voice token + .briefing-voice rule with a CSS-level [data-theme=readable] override"
  - "src/lib/eventHue.ts: eventTypeToHue()/HUE_TOKEN, the single event_type -> hue vocabulary"
  - "TOPIC_EVENT_MAP exported from AstridrWSContext.tsx"
  - "src/entryChunk.ratchet.test.ts: an executable entry-chunk byte ceiling anchored to the pre-125 baseline"
affects: [125-04, 125-05, 125-06, 125-08, 125-09, 126-page-body-and-convex-read-defect-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single :root token derivation (var(--x)) instead of five hand-picked per-theme literals -- D-03's pattern, reusable for any future cross-theme-consistent token"
    - "Ratchet-with-skip-reason shape (existsSync -> null sentinel -> it.skipIf -> console.warn) copied verbatim a second time (tokenSweep -> entryChunk), confirming it as the house idiom for any build-artifact assertion"

key-files:
  created:
    - src/lib/eventHue.ts
    - src/lib/eventHue.test.ts
    - src/entryChunk.ratchet.test.ts
    - e2e/signal-tokens.spec.ts
  modified:
    - src/index.css
    - src/contexts/AstridrWSContext.tsx

key-decisions:
  - "Kept the plan's :root placement choice (one new block after the existing :root closes) rather than folding aurora declarations into the existing :root block -- clearer diff, matches the plan's own D-03 comment intent."
  - "Restored data-theme via try/finally inside the e2e test body, not a Playwright afterAll hook -- `page` is a test-scoped fixture, not worker-scoped, so afterAll cannot receive it as written in the plan's literal instruction."

patterns-established:
  - "eventTypeToHue()'s priority-ordered rule chain (error-shaped checked before the run.* prefix) is the reference shape for any future producer-string classifier that must not let a broad prefix rule shadow a narrower exception."

requirements-completed: [SIGNAL-01, SIGNAL-02, SIGNAL-03]

duration: 20min
completed: 2026-08-24
---

# Phase 125 Plan 01: Signature Layers Foundations Summary

**Declared the aurora/voice CSS tokens with rendered-pixel proof across 5 themes, built the single event_type -> hue vocabulary with a mutation-proven parity guard against the live `TOPIC_EVENT_MAP`, and landed an entry-chunk byte ratchet anchored to the measured pre-125 baseline (583,049 JS / 237,359 CSS bytes at +2%).**

## Performance

- **Duration:** ~20 min (first file read ~08:29, last commit 08:48)
- **Started:** 2026-08-24T08:29:00-04:00 (approx, first Read call)
- **Completed:** 2026-08-24T08:48:13-04:00
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- `--aurora-a/b/c` derive once in `:root` from `--primary`/`--astridr`/`--status-ok`; `e2e/signal-tokens.spec.ts` rasterises all five reachable themes (`cyan`, `emerald`, `amber`, `readable`, `aubergine`) via `canvas.getImageData` and proves each aurora channel samples byte-identical to its hue owner, with a discriminating control (`--aurora-a` must NOT equal `--status-ok`'s sample).
- `--font-voice` + `.briefing-voice` (17px/400/1.5/italic) with a `[data-theme="readable"] .briefing-voice` CSS-level override back to Geist/normal -- inert until plan 125-05 applies the class.
- `src/lib/eventHue.ts` exports `eventTypeToHue()`/`HUE_TOKEN` exactly as this plan's `<interfaces>` contract declares. `run.error` is checked before the `run.` prefix rule so it paints error-red, not astridr-violet. Unknown types always fall to `machine`.
- `TOPIC_EVENT_MAP` exported from `AstridrWSContext.tsx` (one-line change: `const` -> `export const`) so `eventHue.test.ts` iterates the live map rather than transcribing a fixture.
- Both required mutation proofs performed live, captured RED, then reverted: (2) swallowing `run.error` into the `run.` prefix rule turns case (b) RED; (3a) `ALLOWANCE=0.99` turns the ratchet RED with printed measured/ceiling/delta bytes; (3b) renaming `dist/index.html` reports SKIPPED with a printed reason, never a pass.
- `src/entryChunk.ratchet.test.ts` resolves the entry via `dist/index.html`'s `<script type="module">`/`<link rel="stylesheet">` tags (never the `index-<hash>` filename convention), anchored to D-18's baseline (583,049 JS / 237,359 CSS bytes) at a stated +2% allowance.
- Full `npm test` run after all three tasks: 4960 passed, 0 failed, 195 todo (354 files passed, 17 skipped) -- not made red by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the aurora and voice tokens, and prove the derivation renders per theme** - `8481670e` (feat)
2. **Task 2: Create the single event_type -> hue vocabulary and its parity guard** - `ba3b20c2` (feat)
3. **Task 3: Land the entry-chunk byte ratchet against the pre-125 baseline** - `2027adc7` (test)

_No TDD tasks in this plan -- all three are `type="auto"` with `tdd` unset._

## Files Created/Modified

- `src/index.css` - added `--font-voice` to the `@theme` block, a new `:root` block declaring `--aurora-a/b/c`, and `.briefing-voice` + its readable override
- `e2e/signal-tokens.spec.ts` - rasterised per-theme proof that the aurora derivation renders (created)
- `src/lib/eventHue.ts` - the D-06 event_type -> hue vocabulary (created)
- `src/lib/eventHue.test.ts` - the `TOPIC_EVENT_MAP`-parity guard (created)
- `src/contexts/AstridrWSContext.tsx` - added `export` to the existing `TOPIC_EVENT_MAP` const (1 insertion, 1 deletion; nothing else changed)
- `src/entryChunk.ratchet.test.ts` - the D-10/D-18 entry-chunk byte ratchet (created)

## Decisions Made

- The aurora `:root` block was placed as a new, separately-commented block immediately after the existing `:root` block closes (rather than merged into it), matching how the plan's own D-03 rationale reads as a standalone unit and keeping the diff easy to review in isolation.
- `e2e/signal-tokens.spec.ts` restores the original `data-theme` via `try/finally` inside the single test body rather than a Playwright `afterAll` hook -- `page` is a per-test fixture in this project's Playwright config (not worker-scoped), so `afterAll` cannot receive it the way the plan's literal instruction assumed. Functionally equivalent: the original value is captured before the loop and restored regardless of pass/fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two of the plan's own acceptance-criteria greps were self-contradicting and needed rewording in my own prose, not the plan**
- **Found during:** Task 1 and Task 3
- **Issue:** My first draft of the D-03 rationale comment in `src/index.css` used the literal substring `--aurora-b` in prose, which the acceptance criterion `grep -c -- "--aurora-" src/index.css` (expected exactly 3) counted as a 4th hit. Separately, my first draft of `src/entryChunk.ratchet.test.ts`'s doc comment used the literal substring `index-*` to describe the filename convention being avoided, which the acceptance criterion `grep -cE "index-\*|index-\[" ... ` (expected 0) then flagged as a false positive on itself.
- **Fix:** Reworded both comments to describe the same thing without the literal trigger substrings ("the second aurora token below" instead of "`--aurora-b`"; "`index-<hash>.js`" instead of "`index-*`").
- **Files modified:** `src/index.css`, `src/entryChunk.ratchet.test.ts`
- **Verification:** Re-ran both greps after the edit; both return the exact counts the plan specifies.
- **Committed in:** `8481670e` (Task 1), `2027adc7` (Task 3)

**2. [Rule 1 - Bug, plan-text correction only, no code change] One acceptance-criteria grep collides with a legitimate pre-existing, unrelated token**
- **Found during:** Task 1
- **Issue:** The plan's acceptance criterion `grep -cE "#14b8a6|#6366f1|#22c55e" src/index.css` returns 0 (to prove no hand-picked aurora hex was hardcoded) does not literally hold: `--dept-consulting: #22c55e;` (cyan theme's department colour token, shipped by an earlier phase, `git show HEAD:src/index.css` confirms it pre-existed at the commit before this plan started) shares one of the three sketch-reference hex values by coincidence. This is a false positive in the acceptance criterion's literal text, not a defect in the implementation -- verified via `git blame`-equivalent (`git show <pre-plan-SHA>:src/index.css | grep dept-consulting`) that this line was never touched by this plan.
- **Fix:** None needed to code -- `--dept-consulting` is out of this plan's `files_modified` scope and unrelated to the aurora derivation. Documented here per the CLAUDE.md house rule that a plan's inline acceptance criteria are a draft, correctable against live code, not a spec to transcribe faithfully.
- **Files modified:** none (documentation-only correction)
- **Verification:** `grep -n "22c55e" src/index.css` shows exactly one hit, at `--dept-consulting` inside the cyan theme block, not inside the new aurora `:root` block.
- **Committed in:** N/A (no code change; noted here for the record)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 bug in my own prose across two tasks, 1 plan-text correction with no code change)
**Impact on plan:** Neither affected the actual implementation; both were caught during acceptance-criteria verification before committing, and both tasks' real acceptance criteria (grep counts, test results, mutation proofs) all pass as specified.

## Issues Encountered

- The keyless `dev:noauth` server (port 5181) required by the plan's `PW_BASE_URL=http://localhost:5181` Playwright command was not already running -- started it in the background (`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`) before running `e2e/signal-tokens.spec.ts`. No code change; a one-time environment setup step.
- `npm run build`'s emitted CSS grew from the D-18 baseline's 237,359 bytes to 237,668 bytes (+309 bytes) purely from Task 1's own CSS additions (the new `:root` aurora block plus `.briefing-voice`/readable-override rules) -- well inside the +2% (242,106-byte) ceiling. This is expected, not a defect: it's the ratchet correctly measuring the first real CSS this phase adds, and confirms the ratchet responds to genuine change rather than being a no-op check.

## User Setup Required

None - no external service configuration required. (The `dev:noauth` server started for e2e verification is a local dev convenience, not a persistent setup step; nothing was installed or configured beyond running an existing `npm` script.)

## Next Phase Readiness

- `--aurora-a/b/c`, `--font-voice`, `.briefing-voice` are ready for plan 125-05 (serif trial) to consume.
- `eventTypeToHue`/`HUE_TOKEN`/exported `TOPIC_EVENT_MAP` are ready for plans 125-04 (Signal Horizon) and 125-06 (Pulse ECG) to import.
- The entry-chunk ratchet is live and will catch any regression the Signal Horizon's static-import chrome introduces once 125-04 lands, per F-3's inversion finding (the horizon, not the ECG, is the entry-chunk risk).
- No blockers for downstream plans in this wave.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*
