# Phase 122 Plan 11: PageHeader Contract Summary

Grew `PageHeader` from a 23-line title/icon/actions wrapper into the page-layer contract D-17
requires (eyebrow, subtitle, token-only), converted the two pages that hand-rolled its exact
shape, and re-derived adoption to 45 of 47 routes with a named, checkable exemption register for
the two that remain.

## Tasks completed

1. **Extend `PageHeader` with eyebrow, subtitle and a token-driven surface** — added two optional
   props (`eyebrow`: 11px mono uppercase; `subtitle`: muted-ink line below the title), additive to
   the four existing props so all pre-existing callers are unaffected. RED confirmed before GREEN.
   `src/components/PageHeader.tsx`, `src/components/PageHeader.test.tsx` (new, 6 tests).
2. **Convert the two pages that hand-rolled the header** — `Analytics.tsx:54` and
   `BuildProgress.tsx:24` now render `PageHeader`; both hand-rolled classes were byte-identical to
   what the component already generates. `Analytics.tsx`'s two `SectionHeader` subsection dividers
   and Phase 121's structural ratchet are untouched and still both pass and can still fail.
3. **Re-derive adoption and write the named exemption register** — `122-PAGEHEADER-ADOPTION.md`,
   re-deriving all four figures from the corpus with a reproduction command that was independently
   re-run and confirmed to reproduce them.

## Key decisions

- **Eyebrow/subtitle styling.** Eyebrow: `text-[11px] font-mono uppercase tracking-widest
  text-muted-foreground`, matching the existing codebase convention for this exact look
  (`ActiveSessions.tsx:14`'s `font-mono tracking-widest ... uppercase`) and the design law's "one
  11px mono uppercase eyebrow style." Subtitle: `text-sm text-muted-foreground`. Both wrapped in a
  new inner `<div>` around the `<h1>` (needed to stack eyebrow/title/subtitle vertically while
  keeping the icon horizontally beside the whole block) — conditionally rendered so the
  no-eyebrow/no-subtitle case adds no empty elements, verified by a dedicated test.
- **ForgePage.tsx `:151` is DEFERRED, not converted, and not a genuine exemption either.** It
  hand-rolls the identical shape to BuildProgress (its own comment says so) and is convertible,
  but: (a) it is outside this plan's `files_modified`, (b) no other wave-4 plan owns it either —
  checked all of 122-08 (already-shipped, touched only a motion-duration class at `:175`, verified
  via `git show 7350d327`) and 122-12 through 122-19's frontmatter, none touch this file's header
  block, (c) `PageHeader` bakes in `mb-4` while ForgePage's current header has none (spacing comes
  entirely from the parent's `space-y-4`), so a straight substitution would double the vertical gap
  above the master-detail body — a visual regression this plan has no visual-check step to catch.
  Filed as `.planning/todos/pending/forgepage-pageheader-adoption.md` with the exact conversion
  rather than left silently unconverted, per D-18's "every route means something checkable."
- **`Chat.tsx:928` is a genuine exemption**, matching what `122-CONTEXT.md` predicted: it's a mono
  brand wordmark inside a voice/avatar status row on the full-bleed `/chat` presence view, not a
  page title. Recorded with that specific reason, not "by design."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Phase 121's structural ratchet correctly flagged the new bare
`PageHeader` as an unwrapped custom element**
- **Found during:** Task 2's required run of `Analytics.structuralGuard.test.ts`
- **Issue:** The ratchet's CHECK 2 fails any capitalized JSX element rendered in `Analytics()`
  without a `SectionErrorBoundary` ancestor, unless it is on the file's own
  `PRESENTATIONAL_ALLOWLIST`. Converting the hand-rolled `<h1>` to `<PageHeader>` tripped this by
  design — `PageHeader` is exactly the kind of pure-presentational, no-query component that
  allowlist exists for, and the ratchet's own file documents the required evidence before adding
  an entry.
- **Fix:** Verified `PageHeader.tsx` has zero `useQuery`/`usePaginatedQuery` matches, then added it
  to `PRESENTATIONAL_ALLOWLIST` with a comment following the exact `GlassPanel`/`SectionHeader`
  precedent (component, evidence, where it's rendered).
- **Files modified:** `src/pages/Analytics.structuralGuard.test.ts` (not in this plan's declared
  `files_modified` — added because Task 2's own acceptance criteria required the ratchet to pass,
  and the ratchet's allowlist is its documented mechanism for exactly this case)
- **Commit:** `83ed9e1f`

### Out of scope, noted

- **ForgePage.tsx's header conversion** — see "Key decisions" above. Filed as a todo, not fixed
  here; not in this plan's scope and no wave-4 plan owns it.

## Mutation proofs

- **`PageHeader.test.tsx`:** written before the implementation. `npx vitest run
  src/components/PageHeader.test.tsx` failed 2 of 6 for the right reason
  (`getByTestId("page-header-eyebrow"/"page-header-subtitle")` not found — the props didn't exist
  yet) before the eyebrow/subtitle implementation landed; 6/6 passed after.
- **`Analytics.structuralGuard.test.ts`:** unmodified by this plan except the allowlist addition.
  Re-ran its own two synthetic-mutation cases (Case A: synthetic hoisted hook; Case B: synthetic
  unwrapped element) after the `PageHeader` conversion — both still report the violation, and the
  negative control (unmutated real source) still trips neither check. 5/5 pass. The ratchet was not
  weakened by adding `PageHeader` to the allowlist; it was correctly told about one more legitimate
  presentational element, the same way it already knows about `GlassPanel` and `SectionHeader`.

## Adoption figures (full detail in `122-PAGEHEADER-ADOPTION.md`)

| population | denominator (FILES) | before (FILES) | after (FILES) |
|---|---|---|---|
| top-level `src/pages/*.tsx` | 42 | 38 | 40 |
| subdirectory `src/pages/*/*.tsx` (`hr/`) | 5 | 5 | 5 |
| combined (D-24's 47-route population) | 47 | 43 | 45 |

Non-adopting after this plan: `Chat.tsx` (exempt), `ForgePage.tsx` (deferred, todo filed).
`SectionHeader` count in `Analytics.tsx`: 4 before, 4 after (unchanged — `git grep -cF
'SectionHeader' -- src/pages/Analytics.tsx`).

## Self-Check

- `test -f src/components/PageHeader.test.tsx` → FOUND
- `test -f .planning/phases/122-tokens-primitives-contrast-measurement/122-PAGEHEADER-ADOPTION.md` → FOUND
- `test -f .planning/todos/pending/forgepage-pageheader-adoption.md` → FOUND
- `git log --oneline -3` → `88ac2cad`, `83ed9e1f`, `dde0b613` all present in history
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `npx vitest run` → 342 files passed | 17 skipped (359), 4829 tests passed | 197 todo (5026), 0
  failing — baseline was 341/4823/0 before this plan; delta of +1 file / +6 tests matches
  `PageHeader.test.tsx`'s 6 new tests exactly
- `git grep -cF '<h1' -- src/pages/Analytics.tsx src/pages/BuildProgress.tsx` → 0 (git grep exit 1)
- `git grep -cF 'PageHeader' -- src/pages/Analytics.tsx src/pages/BuildProgress.tsx` → 2, 2
- `git grep -cF 'SectionHeader' -- src/pages/Analytics.tsx` → 4 (unchanged from pre-edit value)
- Reproduction command in `122-PAGEHEADER-ADOPTION.md` re-run independently: 42/40, 5/5,
  non-adopting = {Chat.tsx, ForgePage.tsx} — matches the document's quoted figures exactly
- No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/index.css` — `git show
  --stat` on all three commits (`dde0b613`, `83ed9e1f`, `88ac2cad`) confirms none of those three
  paths appear
- `git show --stat` on each of the three commits lists only the files this summary names — no
  files from a concurrent session were swept in

## Self-Check: PASSED
