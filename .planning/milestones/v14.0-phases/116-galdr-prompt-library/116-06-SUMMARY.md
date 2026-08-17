---
phase: 116-galdr-prompt-library
plan: 06
subsystem: ui

tags: [react, galdr, prompt-library, dialog, dropdown-menu, sheet, tdd]

# Dependency graph
requires:
  - phase: 116-02
    provides: "convex/galdrVariables.ts (detectVariables / unresolvedVariables / substituteVariables / VARIABLE_PATTERN_SOURCE) and convex/galdrSlug.ts (slugify)"
  - phase: 116-05
    provides: "the live backend the page plans will subscribe to"
provides:
  - "src/components/galdr/FillVariablesDialog.tsx — the single gate both Copy and Send-to-Chat pass through (D-11, D-12)"
  - "src/components/galdr/SendSplitButton.tsx — three targets: Send to Chat, Copy, Copy as command"
  - "src/components/galdr/PromptEditorDrawer.tsx — Sheet editor with variable chips, preview, and version history"
  - "src/components/galdr/previewSegments.ts — the shared placeholder-highlighting splitter"
affects: [116-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate component owns no side effects: FillVariablesDialog returns a resolved string and closes; the caller owns clipboard and navigate. This is what makes it testable without a router or the Clipboard API, and it removes the StrictMode double-invoke hazard by construction — there is no side effect in it to double."
    - "Verbatim copy held as a single-line const rather than inline JSX text. JSX wraps long text across source lines, which renders correctly but destroys the literal, so a verbatim-copy requirement can be silently unmet while looking right on screen."

key-files:
  created:
    - src/components/galdr/FillVariablesDialog.tsx
    - src/components/galdr/FillVariablesDialog.test.tsx
    - src/components/galdr/SendSplitButton.tsx
    - src/components/galdr/SendSplitButton.test.tsx
    - src/components/galdr/PromptEditorDrawer.tsx
    - src/components/galdr/previewSegments.ts
  modified: []

key-decisions:
  - "D-11/D-12 implemented as ONE component. Chat.tsx:544-556 was read directly to confirm the premise rather than taken from the plan: it calls sendMessage(handoff.text) inside an effect behind a firedRef guard with no confirmation step, so resolution has to be blocking on the Galdr side."
  - "Zero-variable prompts take the same code path, not a bypass: unresolvedVariables on a body with no variables is already empty, so the vacuous-truth case falls out of the rule instead of needing a special case."
  - "Copy as command deliberately does NOT call onUsage — the eventual /galdr <slug> run bumps the count. Commented in place so a future reader does not 'fix' the missing bump into a double count."
  - "splitPreview extracted to previewSegments.ts on its second consumer rather than copied, per UI-SPEC's 'shared pure function, not duplicated'."
  - "In edit mode the slug renders the STORED value, never a re-derivation from the title — renaming does not re-slug, because the slug is the identifier live Claude Code sessions already hold."

patterns-established:
  - "Mutation-test the gate, not just assert it: each decision-carrying condition was inverted and the suite re-run, to prove the tests fail when the behaviour is removed."

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-10
---

# 116-06: The three Galdr UI components

All three tasks complete, TDD with a proven RED for both test-carrying tasks.

## Results

| Gate | Result |
|------|--------|
| `npx vitest run src/components/galdr` | 2 files, **16 passed** |
| `npx tsc --noEmit` | exit 0 |
| Full suite `npx vitest run` | **292 files passed, 17 skipped; 3873 tests passed, 193 todo, 0 failures** |
| Hex literals / Tailwind palette colours across `src/components/galdr/` | none |

The full-suite delta is accounted for rather than waved at: the wave-3 baseline
(`bff1a77d`) was 290 files / 3849 tests. This run is 292 / 3873 — my two new
test files supply +16, and the remaining +8 come from `cf4cad03` (the brains
fix), which added tests to three *existing* files, which is why the file count
rose by exactly my two.

## Task 1 — FillVariablesDialog

9 tests. Disabled state asserted on the real button element; the submit case
asserts on the STRING the `onSubmit` spy received, including
`not.toContain("{{")`.

**Mutation-tested:** forcing `const blocked = false` fails 5 of 9, including the
negative control proving a disabled action cannot submit.

## Task 2 — SendSplitButton

7 tests. The D-12 assertion lands on the object the navigate spy actually
received, with the negative control (variables left unfilled → zero navigate
calls) in the same suite.

**Mutation-tested:** replacing the zero-variable branch with `if (true)`, so
every prompt bypasses the dialog, fails 5 of 7.

`tsc` caught a real defect in my own test that the green run did not: `writeText`
was declared `vi.fn(() => …)` with no parameter, so `calls` infers as `[][]` and
`calls[0][0]` is a compile error. Typed the parameter rather than casting it
away — the assertion on the copied string only means something if the tuple is
real.

## Task 3 — PromptEditorDrawer

Two defects found and fixed before they shipped, both of which would have
rendered plausibly:

1. **Timestamp unit.** `relativeTime()` takes epoch **seconds**
   (`Date.now()/1000 - arg`), while `convex/galdr.ts` writes every timestamp
   with `Date.now()` — **milliseconds**, confirmed by reading the mutation
   handlers rather than inferring from the schema's `v.number()`. Passing ms
   straight in drives the difference hugely negative, so the `< 60` branch always
   wins and every timestamp reads "just now" forever. Divided by 1000 at the call
   site.
2. **Verbatim copy destroyed by JSX wrapping**, as described in the patterns
   block above.

Both `dangerouslySetInnerHTML` and `DeleteSkillDialog` grep counts started at 1
— my own comments named the hazards they were promising to avoid. Reworded
rather than left, since a criterion a comment can satisfy is not measuring the
code.

## Deviations from plan

- `previewSegments.ts` is a fourth file the plan's `files_modified` does not
  list. It is the extraction UI-SPEC asked for, created when the second consumer
  appeared.
- `PromptEditorDrawer` takes an extra optional `versionsError?: boolean` prop.
  The plan specifies distinct loading and error states for version history, and
  `versions === undefined` alone cannot distinguish them.

## Open items

`PromptEditorDrawer` has no test file — the plan scopes tests to "the two that
carry a decision" and marks Task 3 `type="auto"` without `tdd="true"`. Its
behaviour is covered only by `tsc` and by the acceptance greps. Plan 116-08
wires it to real mutations; that is where its save/restore/archive paths first
get exercised.
