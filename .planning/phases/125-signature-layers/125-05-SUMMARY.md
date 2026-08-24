---
phase: 125-signature-layers
plan: 05
subsystem: ui
tags: [fonts, self-hosted-webfonts, code-splitting, briefings, typography, vitest]

requires:
  - phase: 125-signature-layers
    provides: "plan 125-01 landed --font-voice, .briefing-voice, and its [data-theme=\"readable\"] override in src/index.css"
provides:
  - "Instrument Serif italic face self-hosted via @fontsource/instrument-serif, loaded only by the lazy Briefings route module"
  - "briefing-voice applied to BriefingFeedItem's collapsed summary and expanded narrative, and nowhere else"
  - "Source-shape, class-application, and theme-scope test coverage with three live mutation proofs"
affects: [125-06, 125-10]

tech-stack:
  added: ["@fontsource/instrument-serif@5.3.0"]
  patterns:
    - "Module-scoped side-effect CSS import inside a lazy route module keeps a webfont out of the entry chunk, proven on build output rather than by reasoning about lazy() alone"

key-files:
  created:
    - src/components/BriefingFeedItem.test.tsx
  modified:
    - package.json
    - package-lock.json
    - src/pages/Briefings.tsx
    - src/components/BriefingFeedItem.tsx

key-decisions:
  - "Re-verified package legitimacy live rather than trusting the 2026-08-21 audit document: npm view confirmed 5.3.0 / github.com/fontsource/font-files, slopcheck returned OK with zero flags, both recorded verbatim below."
  - "Imported the /400-italic.css SUBPATH, not the bare package root, per D-14 -- confirmed by reading the installed @font-face blocks, not by trusting the filename."
  - "Dropped text-base from both elements that gained briefing-voice, since the class sets font-size: 17px explicitly and leaving the Tailwind utility in place would make the rendered size depend on stylesheet ordering."

requirements-completed: [SIGNAL-03]

duration: ~25min
completed: 2026-08-24
---

# Phase 125 Plan 05: Serif Voice Trial (Briefings-only Instrument Serif) Summary

**Self-hosted Instrument Serif italic face, subpath-imported inside the lazy Briefings chunk, applied to exactly two prose elements in `BriefingFeedItem`, with a source-shape/class-scope/theme-scope test suite and three fired-and-reverted mutation proofs.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 5 (package.json, package-lock.json, src/pages/Briefings.tsx, src/components/BriefingFeedItem.tsx, src/components/BriefingFeedItem.test.tsx created)

## Accomplishments

- `@fontsource/instrument-serif@5.3.0` installed and re-verified live (not trusted from the prior audit document)
- The italic-subpath import (`@fontsource/instrument-serif/400-italic.css`) lands inside `src/pages/Briefings.tsx`, proven on the actual `dist/` build output to be absent from the entry stylesheet and present in the Briefings chunk's stylesheet
- `briefing-voice` applied to exactly the collapsed summary span and the expanded narrative paragraph in `BriefingFeedItem.tsx` -- nothing else on the card, nothing in `/chat`
- A new test file with 7 passing tests across three groups (source shape, class application, theme scope), each backed by a live mutation proof that was run, confirmed RED, then reverted and confirmed GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-verify and install the font, import the italic subpath** - `4983a5ea` (feat)
2. **Task 2: Apply the voice to her authored prose, and nothing else** - `439a70c8` (feat)
3. **Task 3: Guard the subpath, the class application and the theme scope** - `9114eba2` (test)

_No separate "docs: complete plan" metadata commit — STATE.md/ROADMAP.md updates follow this SUMMARY in a final commit per the execution protocol._

## Legitimacy Re-verification (Task 1, verbatim)

`npm view @fontsource/instrument-serif version repository.url`:
```
version = '5.3.0'
repository.url = 'git+https://github.com/fontsource/font-files.git'
```
Matches the audit exactly -- version had not moved past 5.3.0, so it was installed pinned (`npm install @fontsource/instrument-serif@5.3.0`) rather than trusting an unpinned `npm install @fontsource/instrument-serif` to resolve to the same thing at commit time.

`slopcheck scan --pkg npm @fontsource/instrument-serif`:
```
slopcheck checking @fontsource/instrument-serif on npm...

  [OK] @fontsource/instrument-serif (npm)
```
Zero flags -- disposition stays Approved / [VERIFIED]. No STOP branch triggered.

Installed `node_modules/@fontsource/instrument-serif/400-italic.css`, both `@font-face` blocks read verbatim:
```css
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-display: swap;
  font-weight: 400;
  src: url(./files/instrument-serif-latin-ext-400-italic.woff2) format('woff2'), url(./files/instrument-serif-latin-ext-400-italic.woff) format('woff');
  ...
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-display: swap;
  font-weight: 400;
  src: url(./files/instrument-serif-latin-400-italic.woff2) format('woff2'), url(./files/instrument-serif-latin-400-italic.woff) format('woff');
  ...
}
```
Both declare `font-style: italic` and both `src` lines point at italic-specific woff2/woff files -- this is the real italic face, not a synthesised oblique. This is the check that makes the trial meaningful (R-6).

## Chunk Isolation Proof (build output, not reasoning)

Entry stylesheet resolved from `dist/index.html`'s `rel="stylesheet"` link: **`index-B1dFshfH.css`** (239,031 bytes).

`grep -l "Instrument Serif" dist/assets/*.css` lists two files: `index-B1dFshfH.css` and `Briefings-CHUiSS9E.css`. The contrast, not the single hit, is the evidence:
- `index-B1dFshfH.css` contains **zero** `@font-face` blocks referencing Instrument Serif -- its one string match is the `--font-voice:"Instrument Serif", Georgia, serif;` CSS custom-property VALUE landed by 125-01 (a fallback-stack literal, not a font import), and it has zero `@font-face` blocks for `instrument-serif` woff/woff2 files. Its single `@font-face` occurrence overall is Geist (`font-family: Geist Variable ...`), unrelated.
- `Briefings-CHUiSS9E.css` contains the real `@font-face` block with `src: url(/assets/instrument-serif-latin-ext-400-italic-C9HzH3YL.woff2)` and `url(/assets/instrument-serif-latin-400-italic-DKMiL14s.woff2)` -- the actual font bytes.

Nobody who never opens `/briefings` downloads this font.

## Files Created/Modified

- `package.json`, `package-lock.json` - add `@fontsource/instrument-serif` at `5.3.0`
- `src/pages/Briefings.tsx` - module-scoped side-effect import of the italic subpath, with a comment naming D-14 and both load-bearing facts (subpath-required, lazy-scoped)
- `src/components/BriefingFeedItem.tsx` - `briefing-voice` on the collapsed summary span and the expanded narrative paragraph, `text-base` dropped from both
- `src/components/BriefingFeedItem.test.tsx` - new, 121 lines, 7 tests across 3 describe blocks

## Decisions Made

- Re-verified legitimacy live at install time rather than trusting the 2026-08-21 document, per Task 1's instruction and T-125-05-SC's mitigation -- both checks came back identical to the prior audit, so no STOP fired.
- Followed the plan's line-level scope exactly: `BriefingFeedItem.tsx:49-50` (collapsed span) and `:62` (expanded paragraph), confirmed by reading the live file before editing, matched the plan's cited line numbers exactly.

## Deviations from Plan

None - plan executed exactly as written. The plan's `interfaces` section (the `--font-voice`/`.briefing-voice`/readable-override CSS landed by 125-01) matched live code exactly on inspection; no correction needed.

## Verification Performed

- `npm run build` -- exits 0, both before and after Task 3 (fresh build). Entry CSS: **239,031 bytes** (unchanged from the 125-04 baseline, confirming zero bytes leaked into the entry chunk); entry JS: 583,141 bytes.
- `npx vitest run src/entryChunk.ratchet.test.ts` -- **3 passed**, run against the fresh build above. Ceiling is 242,106 bytes; measured 239,031 bytes leaves **3,075 bytes of headroom**, identical to the pre-plan headroom, for 125-06.
- `npx vitest run src/components/BriefingFeedItem.test.tsx` -- **7 passed** (final state).
- `npx tsc --noEmit` -- exits 0, no output.
- `npm test` (full suite) -- **5,012 passed, 195 todo, 358 test files passed, 1 failed** (`src/components/voice/AvatarAura.browser.test.tsx`, a chromium-mode browser test unrelated to fonts/Briefings, last touched by Phase 193 (`828a5b08`), whose only failure was `Failed to fetch dynamically imported module` from the vitest browser dev server). Re-ran that file alone: **3/3 passed**, confirming the full-run failure was a transient browser-mode dev-server race, not caused by this plan's changes -- out of scope per the CLAUDE.md scope boundary (unrelated file, unrelated feature area).
- `grep -c "@fontsource/instrument-serif" package.json` = 1; `grep -c '@fontsource/instrument-serif/400-italic.css' src/pages/Briefings.tsx` = 1; `grep -rc "instrument-serif" index.html src/main.tsx` = 0 for both (index.css intentionally carries the `--font-voice` fallback-stack string from 125-01, which the test suite explicitly exempts as a CSS value, not a package import).
- `grep -c "briefing-voice" src/components/BriefingFeedItem.tsx` = 2; `grep -c "text-base" src/components/BriefingFeedItem.tsx` = 0; `git diff --stat src/components/BriefingFeedItem.tsx` (against the pre-Task-2 state) showed 2 changed lines; `git diff --name-only` across the whole plan span lists no file under `ChatBubble*`, `InsightsChat.tsx`, or `Chat*`.

### Serif on exactly one surface -- how proven

`git diff --stat` across all three commits (`4983a5ea~1..9114eba2`) touches exactly `package.json`, `package-lock.json`, `src/pages/Briefings.tsx`, `src/components/BriefingFeedItem.tsx`, and the new `src/components/BriefingFeedItem.test.tsx` -- no `ChatBubble*`, `InsightsChat.tsx`, or any other component. `.briefing-voice` was never referenced anywhere in `src/` before this plan (grep-confirmed on the pre-plan tree via the 125-01 comment stating it was "inert until then"), and after this plan it appears only in `BriefingFeedItem.tsx` (2 occurrences) and `src/index.css` (the rule + its readable override, both landed by 125-01, unmodified here).

### Mutation Proofs (verbatim)

**Mutation 1 -- bare-root import in `Briefings.tsx`** (`import "@fontsource/instrument-serif/400-italic.css";` -> `import "@fontsource/instrument-serif";`):
```
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```
Failures: "imports the ITALIC SUBPATH, not the bare package root" and "does not import the bare @fontsource/instrument-serif package root" -- exactly the two source-shape assertions this mutation should break. Reverted; confirmed GREEN (7/7) and `git diff --stat` against the committed file showed no diff.

**Mutation 2 -- `briefing-voice` removed from only the expanded paragraph** (`<p className="briefing-voice whitespace-pre-wrap">` -> `<p className="whitespace-pre-wrap">`):
```
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

 FAIL  ... applies briefing-voice to the expanded narrative paragraph when the row is expanded
AssertionError: expected 'whitespace-pre-wrap' to contain 'briefing-voice'
```
Exactly the expansion test failed; "applies briefing-voice to the collapsed summary/narrative span" stayed green, proving the two elements are independently covered. Reverted; confirmed GREEN (7/7), no diff.

**Mutation 3 -- `[data-theme="readable"] .briefing-voice` deleted from `src/index.css`**:
```
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

 FAIL  ... has a [data-theme="readable"] override for .briefing-voice that sets Geist and normal style, after the base rule
AssertionError: expected -1 to be greater than -1
```
Exactly the theme-scope test failed. Reverted; confirmed GREEN (7/7), no diff against the committed file.

## Threat Flags

None -- all four register entries (T-125-05-SC, T-125-05-01, T-125-05-02, T-125-05-04) are mitigated exactly as described in the plan's threat model; no new surface was introduced beyond what the register already accounts for.

## Known Stubs

None.

## Issues Encountered

None beyond the transient `AvatarAura.browser.test.tsx` browser-mode failure documented above under Verification, which reproduced as a pass in isolation and is unrelated to this plan's files.

## Shared Checkout / State Notes

- `package.json`/`package-lock.json` were **clean** (`git status --porcelain` empty) immediately before the install, and again immediately before staging Task 1 -- no collision with the concurrent astridr-repo-f3 session.
- After each of the three commits, `git show --stat HEAD` was run and confirmed only the intended files were present -- no foreign file (PersonaDial*, dialBands.ts, ControlCenterPanel.tsx, CompactControlStrip.tsx, slider.tsx, or anything under `.planning/phases/126-*/`) was swept into any commit.
- One untracked directory, `.planning/phases/126-page-body-and-convex-read-defect-sweep/`, is present in the working tree throughout -- not created or touched by this plan, left alone per the shared-checkout warning.
- No `gsd-sdk query state.*` verb was run. STATE.md updated by hand in both the frontmatter (`completed_plans`) and body (`stopped_at`) copies below, per the state-file warning.

## Next Phase Readiness

- 125-06 (ECG canvas hero) inherits **3,075 bytes** of entry-CSS headroom under the D-18 ceiling, unchanged from before this plan -- this plan added zero bytes to the entry chunk.
- 125-10's blocking operator checkpoint can now record the adopt/reject/revisit verdict against a real italic face on `/briefings` -- this plan does not record that verdict itself, per its objective.

## Self-Check: PASSED

- FOUND: src/pages/Briefings.tsx
- FOUND: src/components/BriefingFeedItem.tsx
- FOUND: src/components/BriefingFeedItem.test.tsx
- FOUND: .planning/phases/125-signature-layers/125-05-SUMMARY.md
- FOUND: commit 4983a5ea
- FOUND: commit 439a70c8
- FOUND: commit 9114eba2

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*
