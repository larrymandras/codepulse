---
phase: 118-studio-media-gallery
plan: 11
subsystem: ui

tags: [react, shadcn, radix, convex, xss, accessibility]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery
    provides: "Studio page shell, MasonryGrid, MediaCard, StudioFilterBar (plan 118-10)"
  - phase: 118-studio-media-gallery
    provides: "api.media.list/listTrash/listStyles/listModels + toggleStar/softDelete/restore (plan 118-04)"
provides:
  - "MediaDetailSheet: the right-side recipe panel realizing D-07's control pair at FIELD level"
  - "D-08's full three-state loop wired end to end — Move to Trash (no modal) / Trash tab with a server-computed countdown / Restore"
  - "StylesPanel + ModelsPanel: default-collapsed, read-only curated tables (D-12)"
  - "recipeMd proven inert as HTML at the DOM level, not merely by a source grep (T-118-05)"
  - "14 new component tests in src/pages/Studio.test.tsx, two of them mutation-proven"
affects: ["118-15 (e2e/studio.spec.ts)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disabled-control reason wired BOTH as a Radix tooltip (pointer) and an always-present aria-describedby target (keyboard/AT) — a disabled button is not focusable, so a tooltip alone leaves the reason unreachable"
    - "Agent-authored free text rendered as plain text in a <pre>, guarded by a DOM-level XSS test rather than a source grep (same rule as PromptEditorDrawer.tsx:258-259)"
    - "Sheet action row swapped by context (`trashVariant`) rather than duplicated into a second component"

key-files:
  created:
    - src/components/studio/MediaDetailSheet.tsx
    - src/components/studio/StylesPanel.tsx
    - src/components/studio/ModelsPanel.tsx
  modified:
    - src/pages/Studio.tsx
    - src/pages/Studio.test.tsx
    - src/components/studio/MediaCard.tsx

key-decisions:
  - "`media.styleId` is an id reference and no read path resolves it to a name, so the Sheet's Style row is resolved by the CALLER against the same api.media.listStyles subscription the Styles panel renders from — no backend change, no deploy, and a dangling styleId resolves to the D-07 sentinel rather than showing a raw id."
  - "Copy Recipe's disabled reason is wired as aria-describedby in ADDITION to the Radix tooltip. A `disabled` button is not focusable, so the tooltip is a pointer-only affordance; the sr-only description is what makes the reason reachable for everyone."
  - "The trash `opacity-60` was extended from the `<img>` branch to the broken-thumbnail and audio placeholders too — a trashed row whose thumbnail was broken previously rendered at full opacity and did not read as trashed."
  - "Two acceptance-criteria greps were literal-string checks blind to prose. Following 118-04's precedent, the PROSE was reworded (never the check weakened): ModelsPanel's docstring now mirrors PromptEditorDrawer.tsx's own phrasing ('never raw-HTML injection, never a markdown renderer') without naming the raw-HTML prop, and MediaDetailSheet says 'no manual permanent-deletion control' rather than 'delete forever'."

requirements-completed: [D-02, D-07, D-08, D-12]

duration: ~45min
completed: 2026-08-14
---

# Phase 118 Plan 11: Media Detail Sheet, Trash Grace Period, Curated Panels Summary

**The `/studio` surface finished: a right-side recipe Sheet where an absent provenance field is visually unmistakable from a populated one, D-08's full hide/countdown/restore loop with no modal anywhere, and two read-only curated panels whose `recipeMd` is proven inert as HTML by a DOM-level assertion — zero new npm dependencies.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files created:** 3
- **Files modified:** 3

## Task Commits

1. **Task 1: MediaDetailSheet — the recipe panel and its actions** — `8d1dcd04` (feat)
2. **Task 2: Trash view — dimmed cards, visible countdown, restore** — `f4c3d53a` (fix)
3. **Task 3: Styles/Models panels + component tests** — `1354a987` (feat)

`git show --stat HEAD` was read after every commit. Every commit touched only the files it names below; nothing from the concurrent session in this checkout was swept in, and `git diff --diff-filter=D` was empty after all three (zero deletions).

## Accomplishments

- **D-07 now holds at field level, not only at card level.** A populated recipe value and an absent one sit side by side in one panel with different class strings, and the test asserts they DIFFER rather than asserting either in isolation.
- **D-08's three-state loop is complete and testable end to end.** Move to Trash takes one click with no modal, closes the Sheet, and the row leaves the Gallery grid on the Convex subscription with no host round-trip; the Trash tab shows it with the server-computed `Deletes automatically in N days` caption; Restore (Sheet-footer only, never a card control) returns it.
- **`recipeMd`'s XSS rule is guarded by the DOM, not by a grep.** Feeding `<img src=x onerror=alert(1)>` renders the literal text and creates zero `img` elements — and breaking the rule turns that exact assertion red (quoted below).
- **Both curated panels are read-only and default collapsed**, with the "default collapsed" claim itself control-tested (grid absent before the trigger click, present after).
- **A real defect was found and fixed in Task 2:** the Trash `opacity-60` reached only the `<img>` branch, so a trashed row with a broken thumbnail or an audio placeholder rendered undimmed.
- **Zero new dependencies** — `git diff --stat package.json package-lock.json` empty across all three commits.

## `data-testid` Values Introduced (for plan `118-15`'s `e2e/studio.spec.ts`)

**Detail Sheet — static:**
`studio-detail-sheet`, `studio-detail-filename`, `studio-detail-thumb`,
`studio-detail-fallback`, `studio-detail-badge-mediatype`, `studio-detail-badge-kind`,
`studio-detail-dimensions`, `studio-detail-size`, `studio-detail-created`,
`studio-detail-abspath`, `studio-detail-purge-caption`, `studio-detail-copy-recipe`,
`studio-detail-copy-recipe-wrap`, `studio-detail-copy-recipe-tooltip`,
`studio-detail-copy-recipe-reason`, `studio-detail-copy-path`, `studio-detail-trash`,
`studio-detail-restore`, `studio-detail-star`.

**Detail Sheet — recipe field rows (one per field, this is D-07's field-level pair surface):**
`studio-detail-field-prompt`, `studio-detail-field-model`, `studio-detail-field-provider`,
`studio-detail-field-style`, `studio-detail-field-project`, `studio-detail-field-params`.
Each also carries `data-present="true"|"false"`, so an E2E spec can assert the pair without
depending on Tailwind class strings.

**Panels — static:**
`studio-styles-panel`, `studio-styles-trigger`, `studio-styles-grid`, `studio-styles-empty`,
`studio-models-panel`, `studio-models-trigger`, `studio-models-list`, `studio-models-empty`.

**Panels — templated (suffixed with the row's `_id`):**
`` studio-style-card-${style._id} ``, `` studio-style-fallback-${style._id} ``,
`` studio-model-card-${model._id} ``, `` studio-model-type-${model._id} ``,
`` studio-model-enabled-${model._id} ``, `` studio-model-docs-${model._id} ``,
`` studio-model-recipe-${model._id} ``.

`118-10`'s card-level testids (`studio-media-card-*`, `studio-media-star-*`,
`studio-media-provenance-badge-*`, `studio-media-fallback-*`, `studio-media-audio-*`,
`studio-media-purge-caption-*`, the chips, the Selects, the tabs, the empty states) are
unchanged by this plan.

## D-07's Field-Level Pair — the two class strings, quoted

`src/components/studio/MediaDetailSheet.tsx:86-87`:

```ts
export const PRESENT_FIELD_CLASS = "text-foreground font-mono";
export const ABSENT_FIELD_CLASS = "text-muted-foreground italic";
```

Rendered, with the shared base (`MediaDetailSheet.tsx:136-139`):

- populated → `text-xs break-words whitespace-pre-wrap text-foreground font-mono`
- absent → `text-xs break-words whitespace-pre-wrap text-muted-foreground italic`

The populated string contains `font-mono` and does NOT contain `italic`; the absent string
contains both `italic` and `text-muted-foreground`. The difference is the D-07 mechanism, and
`Studio.test.tsx` asserts `populated.className` is not equal to `absent.className` in addition
to asserting each side.

## Mutation Proof (Task 3 acceptance criterion) — both failure messages quoted

Two implementation rules broken, confirmed RED, restored from a `cp` backup (never
`git checkout --`, per this repo's own lesson about that command discarding uncommitted work),
each restore proven byte-identical with `diff` before continuing.

**Mutation A — `ModelsPanel`'s `<pre>` changed to inject raw HTML:**

```
FAIL  src/pages/Studio.test.tsx > ModelsPanel — recipeMd is inert as HTML (T-118-05) > an HTML payload in recipeMd renders as literal text and creates ZERO img elements
AssertionError: expected <img src="x" onerror="alert(1)"></img> to have a length of +0 but got 1
 ❯ src/pages/Studio.test.tsx:466:46
```

The first run of this mutation failed one line earlier, on the `toHaveTextContent` assertion,
which would have proven only that the text changed — not that the payload became an element.
The assertions were reordered so the DOM-level `img` count fires first, and the mutation was
re-run to produce the message above. That reorder is the difference between proving the guard
and proving a side effect of it.

**Mutation B — `ABSENT_FIELD_CLASS` set identical to `PRESENT_FIELD_CLASS`:**

```
FAIL  src/pages/Studio.test.tsx > MediaDetailSheet — D-07's control pair at FIELD level > a populated field and an absent field render with DIFFERENT class strings in the same panel
AssertionError: expected 'text-xs break-words whitespace-pre-wr…' to contain 'italic'
Expected: "italic"
Received: "text-xs break-words whitespace-pre-wrap text-foreground font-mono"
 ❯ src/pages/Studio.test.tsx:201:30
```

Both D-07 field-level tests went red on this one mutation (2 failed | 19 skipped).

## `npm test` Before/After (full suite)

- **Before** (clean tree at `6dd3aecc`): `329 test files passed | 1 failed | 17 skipped (347)`;
  `4540 tests passed | 1 failed | 197 todo (4738)`.
- **After** (this plan): `330 test files passed | 17 skipped (347)`;
  `4555 tests passed | 0 failed | 197 todo (4752)`.

Delta: +14 tests (all in `src/pages/Studio.test.tsx`, 7 → 21), zero regressions.

**About the baseline failure.** The pre-plan run had one failure —
`src/App.test.tsx:165`, a lazy-route resolution test — on a clean working tree, before any file
in this plan existed. Run in isolation the same file is `19 passed (19)`, and the test carries
its own comment explaining that it exceeds testing-library's default wait "under a loaded
full-suite run", which is why it already ships a widened 20 s window. It did not recur in the
post-plan full run. It is a load-induced timeout in a test already engineered against that
condition, not a code regression, and nothing in this plan touches `App.tsx`'s lazy routes —
but it is recorded here rather than silently dropped, and the after-count is quoted against the
executed total (4541) so the +14 arithmetic is checkable.

## Verification Evidence

- `npx tsc --noEmit` — exit 0 after every task and after every mutation restore.
- `npm run build` — succeeds after every task (`✓ built in 1.13s` on the final run).
- `git diff --stat package.json package-lock.json` — **empty**. No markdown renderer, no
  masonry package, no dependency of any kind added.
- `grep -c "dangerouslySetInnerHTML"` over `src/components/studio/*.tsx` and
  `src/pages/Studio.tsx` → **0 for all 9 files**. Paired with a known-positive control proving
  the pattern discriminates: the same grep over `src/` still hits
  `src/components/BlockRenderer.tsx`, `src/components/forge/ArtifactPreview.test.tsx`,
  `src/components/forge/FileBrowser.test.tsx`.
- Hardcoded-colour grep `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\("` over every file this plan
  created → **no match (exit 1)**. Control proving the pattern is not simply inert:
  the same pattern over `src/index.css` returns
  `124:  --glow-xs: 0 0 8px rgba(6, 182, 212, 0.15);` and two siblings.
- `grep -c "AlertDialog" src/components/studio/MediaDetailSheet.tsx` → **0**. No modal
  confirmation on either destructive action.
- `grep -F` was used for every literal check (never hand-escaped backslashes into a matcher).
- Every `absPath` occurrence in `MediaDetailSheet.tsx` inspected line by line — 4 total:
  line 8 (docstring), line 298 (the D-02 comment), line 305 (rendered as text inside a `<p>`),
  line 312 (`copyToClipboard(row.absPath)`). It is never an `<img src>`, never an `<a href>`,
  and no URL is built from it. A test walks every `img` and `a` in the rendered Sheet and
  asserts none of their `src`/`href` contains `media-vault`.
- Copy Recipe's disabled condition, quoted (`MediaDetailSheet.tsx:191, 337`):
  `const hasProvenance = row.hasProvenance;` … `{hasProvenance ? ( …enabled… ) : ( …disabled… )}`
  — the server's own D-07 derivation, never re-derived client-side, so the button and the
  `Missing Provenance` filter chip can never disagree.
- Trash: `opacity-60` applied at three sites (`<img>`, `ThumbnailFallback`, `AudioPlaceholder`),
  **zero** `grayscale` CSS classes. The single textual occurrence of `grayscale` in the Studio
  surface is `MediaCard.tsx:60`, the comment the acceptance criterion itself requires
  ("deliberately not grayscale — grayscale would fight with broken-thumbnail detection").
  That criterion's literal "ZERO occurrences" and its "with a comment explaining why" cannot
  both be satisfied; the substantive reading — no grayscale is applied — is satisfied.
- Countdown source, quoted (`MediaCard.tsx:210-213`): `(row.daysUntilPurge ?? 99) <= 3 ?
  "text-[var(--status-error)]" : "text-muted-foreground"`. The value is `listTrash`'s
  server-computed `daysUntilPurge`; `grep -rnE "2592000000|\+ 30 \* |30 \* 24 \* 60" src/`
  returns **nothing**, with the control that the same 30-day constant DOES exist server-side
  (`convex/media.ts:48  const TRASH_GRACE_MS = 30 * ONE_DAY_MS;`) — so the zero is a real
  absence in `src/`, not a broken pattern.
- No "delete forever" control: `grep -rinE "delete forever|permanently delete|purge now"`
  over `src/components/studio` and `src/pages/Studio.tsx` returns **nothing (exit 1)**. The
  same pattern over all of `src/` returns 3 pre-existing hits in unrelated surfaces
  (`hr/TeamEditor.tsx`, `skills/ColdStorageView.tsx` and its test) — none of them Studio.
- Trash tab renders no filter bar: `StudioFilterBar` is referenced exactly once in
  `Studio.tsx` (line 173, inside `GalleryTab`); `TrashTab` renders no chips, no `Select`, and
  no panels. It is a structural absence, not a runtime conditional.
- Both trash empty-state strings present verbatim (`Studio.tsx:238-240`):
  `Trash is empty` / `Deleted media appears here for 30 days before it's permanently removed.`
- Both panels default collapsed: neither passes `defaultOpen` nor a controlled `open`, and
  Radix `Collapsible` starts closed. Control-tested in `Studio.test.tsx` — the grid is absent
  before the trigger click and present after.
- No deploy performed (per the dispatch's standing constraint), and `.planning/STATE.md` /
  `.planning/ROADMAP.md` were **not** touched by this plan.

## Decisions Made

- **The Style row is resolved by the caller, not the query.** `media.styleId` is an
  `Id<"mediaStyles">` and none of `118-04`'s read paths resolve it to a display name. Adding a
  join server-side would have required a Convex deploy, which this plan is forbidden to do (and
  a deploy ships the whole working tree, not a subset). Instead `Studio.tsx` builds a
  `Map<_id, name>` from the same `api.media.listStyles` subscription the Styles panel already
  renders from — one subscription, one source of truth — and passes `styleName` down. A
  `styleId` pointing at a deleted style resolves to `undefined`, which renders as the D-07
  sentinel; a raw id is never shown as if it were a style name.
- **`aria-describedby` alongside the Radix tooltip.** The UI-SPEC asks for a tooltip on the
  disabled Copy Recipe button. A `disabled` button is not focusable and swallows pointer
  events, so a Radix tooltip on it is unreachable both by keyboard and (without a wrapper) by
  mouse. The tooltip trigger therefore sits on a wrapper `span`, and the same copy is ALSO an
  always-present `sr-only` `aria-describedby` target. This is strictly additive to the spec:
  the visual affordance the spec asked for still exists, and the reason now also reaches
  keyboard and screen-reader users. It is what the test asserts, because it is the mechanism
  that is actually reachable.
- **Comment prose reworded to satisfy two literal-string acceptance greps, never the greps
  weakened.** Same call `118-04` made for its own `.collect()` criterion. `ModelsPanel`'s
  docstring now mirrors `PromptEditorDrawer.tsx:258-259`'s own phrasing — "never raw-HTML
  injection, never a markdown renderer" — which is the precedent the plan told me to mirror
  and which does not name the prop; `MediaDetailSheet`'s says "no manual permanent-deletion
  control anywhere". Both statements are unchanged in meaning and both greps now return clean
  over the Studio surface.
- **The `<pre>`'s XSS assertions were reordered.** Putting `toHaveTextContent` first meant the
  mutation proved only that the rendered text changed. The DOM-level `img` count now fires
  first, so the assertion that actually guards T-118-05 is the one demonstrated to go red.

## Deviations from Plan

**1. [Rule 1 — Bug] Trash dimming reached only the `<img>` branch**
- **Found during:** Task 2
- **Issue:** `118-10` applied `trashVariant && "opacity-60"` to the `<img>` only. A trashed row
  whose thumbnail was broken, missing, or audio rendered at full opacity — so the two states
  the UI-SPEC deliberately keeps distinguishable (dimmed-because-trashed vs
  colourless-because-broken) collapsed in exactly the case the spec's "not grayscale" rule
  exists to protect.
- **Fix:** `ThumbnailFallback` and `AudioPlaceholder` take a `dimmed` prop driven by
  `trashVariant`. The dimming deliberately stays OFF the star overlay, which remains a live
  control on a trashed row.
- **Files modified:** `src/components/studio/MediaCard.tsx`
- **Commit:** `f4c3d53a`

**2. [Scope] `MediaCard.tsx` modified though it is not in the plan's `files_modified`**
- The plan's frontmatter lists five files and `MediaCard.tsx` is not among them, but Task 2's
  own `<action>` says to "add a `trashVariant` mode to the existing card rather than
  duplicating it" and its `<read_first>` names `MediaCard.tsx` as "the card being reused with a
  `trashVariant` prop". The frontmatter is stale relative to `118-10`, which already built that
  prop; the deviation above could not be fixed anywhere else without duplicating the card.

**3. [Scope] `MediaDetailSheet.tsx` and `Studio.tsx` picked up Task 3 changes**
- The `aria-describedby` addition (Task 3's test work) landed in commit `1354a987`, and the two
  panel imports/renders in `Studio.tsx` did too. Both are within Task 3's stated file list.

No architectural changes were needed, so no Rule 4 checkpoint was raised. No authentication
gates were hit.

## Known Stubs

None. Every control this plan ships is wired to a real mutation or a real query; nothing renders
placeholder or mock data.

## Threat Flags

None. Every file this plan created or modified is a read/render surface over the query and
mutation surface `118-04`/`118-05` already shipped — no new network endpoint, no new auth path,
no file access, no schema change. The three public mutations the Sheet calls
(`toggleStar`/`softDelete`/`restore`) were already public by SEED-008's settled decision and
were not touched.

## Issues Encountered

- **The Radix tooltip could not be opened from jsdom.** `fireEvent.focus` on the tooltip
  trigger did not open the `TooltipContent`, so the first version of the Copy Recipe test was
  red. Rather than reach for progressively more exotic synthetic events to coax a portal open,
  the component gained the `aria-describedby` mechanism described under Decisions — which is a
  genuine accessibility improvement, is always present in the DOM, and is the mechanism a
  keyboard user actually gets. The test asserts that, and the pointer affordance is asserted
  by its wrapper's presence.
- Two acceptance-criteria greps were literal-string checks that my own explanatory prose
  tripped; see Decisions. One of them (`grayscale`) is internally contradictory and is reported
  as such rather than papered over.

## User Setup Required

None — no external service configuration, no deploy performed. The Studio backend
(`convex/media.ts`) was deployed by plan `118-05`; nothing in this plan changes `convex/`.

## Next Phase Readiness

- `/studio` is functionally complete per the UI-SPEC: Gallery with filters and panels, the
  detail Sheet, and the full Trash loop.
- Plan `118-15`'s `e2e/studio.spec.ts` has every selector it needs — see the `data-testid`
  inventory above. For D-07's field-level pair, prefer the `data-present="true"|"false"`
  attribute over Tailwind class strings; for D-08's three-state pair, assert
  `studio-detail-trash` → the card's absence from Gallery → `studio-media-purge-caption-*` in
  Trash → `studio-detail-restore`.
- The Styles and Models panels render whatever `mediaStyles`/`mediaModels` hold. Both tables are
  seeded by plans `118-12`–`118-14`; until then both panels correctly show their empty copy
  (`No style presets yet.` / `No model recipes yet.`), which is the honest state, not a stub.
- `src/App.test.tsx`'s lazy-route test timed out once under full-suite load on a clean tree
  before this plan started and passed in isolation and in the post-plan full run. Worth watching
  if it recurs; nothing in Phase 118 touches it.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
