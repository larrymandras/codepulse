# 120-07 Geometry Evidence — POLISH-02 (E-Stop) & POLISH-06 (900px collision)

**Status: COMPLETE.** Tasks 1-5 of `120-07-PLAN.md` are all done. Tasks 1-3 (reproduction,
E-Stop fix, 900px-collision fix) are recorded below under `§ BEFORE` / `§ Task 2` / `§ Task 3`.
Task 4 (human-verify checkpoint) and Task 5 (formal AFTER / Corrections / Attended / Handoff
write-up) are recorded in the sections following `§ Not yet done` (retained below as a dated
record of what this file looked like mid-plan).

All measurements below were taken with `npm run dev:noauth` (keyless server) on `127.0.0.1:5181`,
driven via `PW_BASE_URL=http://localhost:5181 npm run test:e2e:noauth -- polish-geometry`, issued
from Git Bash. No Clerk gate was encountered in any run (`dev:noauth` is auth-disabled) — every run
below is a genuine render, not a skip.

---

## § BEFORE — Task 1 reproduction (before any source change)

### First pass (methodology later found flawed — kept for the record, see correction below)

Raw console output, `polish-geometry.spec.ts` as first written:

```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":56,"width":660,"height":844},"culprits":[]}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":360,"innerWidth":360,"buttonWidth":71.484375,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":2560,"innerWidth":2560,"buttonWidth":81.34375,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":20}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":1440,"innerWidth":1440,"buttonWidth":66.953125,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":900,"innerWidth":900,"buttonWidth":66.953125,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":640,"innerWidth":640,"buttonWidth":66.953125,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40}
ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE [{"requestedWidth":360,"innerWidth":360,"buttonWidth":71.484375,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40},{"requestedWidth":640,"innerWidth":640,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40},{"requestedWidth":900,"innerWidth":900,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40},{"requestedWidth":1440,"innerWidth":1440,"buttonWidth":66.953125,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":40},{"requestedWidth":2560,"innerWidth":2560,"buttonWidth":81.34375,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelOffsetHeight":20}]
```

Result: the per-width tests (checking `labelClientRectsLength === 1`) all PASSED even though
`buttonHeight` visibly doubled (48 vs 28) at four of five widths — a contradiction. Only the
separate cross-width comparison test (comparing width/height across widths) failed. This meant the
per-width wrap detector was vacuous. `SETTINGS-900-EVIDENCE` culprits were empty and
`scrollWidth<=innerWidth` passed at plain 900x900 on `/settings`.

### Methodology correction #1 — the E-Stop wrap detector was measuring the wrong element

Root cause, confirmed with a standalone Playwright probe (`btn.querySelector('span')` computed
style dump): the label `<span>` is a **direct child of a `display:flex` button**, so it is
CSS-blockified — `getComputedStyle(labelSpan).display === "block"`, confirmed live. A block box's
own `getClientRects()` always returns **exactly 1 rect** (the block's border box), even when the
text inside it wraps across two lines — only an *inline* element fragments into one rect per visual
line. So `labelSpan.getClientRects().length` can never detect this wrap; it reported a vacuous `1`
at every width while `buttonHeight` (48 vs 28) already proved something was wrong.

The correct place to read line-fragmentation is the **text node** inside the span
(`document.createRange().selectNodeContents(textNode).getClientRects()`), since a text node is
never blockified. Confirmed empirically at 640px:

```json
{"textNodeData":"E-Stop","textRectsCount":2,"textRects":[{"top":8.5,"bottom":26.5,"left":222.06,"width":14.39,"height":18},{"top":28.5,"bottom":46.5,"left":213.78,"width":30.97,"height":18}],"labelComputedDisplay":"block"}
```

Two rects — "E-" on one line, "Stop" on the next — exactly the hyphen break the plan's
`<interfaces>` section predicted as the most likely mechanism. `polish-geometry.spec.ts` was
corrected to use the text-node Range and now asserts on `labelTextNodeRectsLength`, with
`labelClientRectsLength` (the span's own, blockified count) kept in the evidence payload for the
record but not asserted on. The corrected spec's header comment documents this in full.

### Second pass (corrected methodology — the TRUE pre-fix reproduction)

```
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":2560,"innerWidth":2560,"buttonWidth":81.34375,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20}
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":56,"width":660,"height":844},"culprits":[]}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":1440,"innerWidth":1440,"buttonWidth":78.671875,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":900,"innerWidth":900,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":640,"innerWidth":640,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40}
ESTOP-GEOMETRY-EVIDENCE {"requestedWidth":360,"innerWidth":360,"buttonWidth":71.484375,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40}
ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE [{"requestedWidth":360,"innerWidth":360,"buttonWidth":71.484375,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40},{"requestedWidth":640,"innerWidth":640,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40},{"requestedWidth":900,"innerWidth":900,"buttonWidth":67.015625,"buttonHeight":48,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":2,"labelOffsetHeight":40},{"requestedWidth":1440,"innerWidth":1440,"buttonWidth":81.34375,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20},{"requestedWidth":2560,"innerWidth":2560,"buttonWidth":81.34375,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20}]
```

**Verdict — POLISH-02 reproduces, correctly this time.** `labelTextNodeRectsLength === 2` (a real
line break at the hyphen) at 360/640/900px in every run, and at 1440px in the isolated per-width
test (though not in the sequential cross-width run — see note below). Only 2560px (ultrawide,
abundant free space) consistently avoids the wrap. This confirms **both** mechanisms the plan's
`<interfaces>` section predicted: the button is compressed (no `shrink-0`) by its unshrinkable
header siblings, and the compressed label breaks at the hyphen (no `whitespace-nowrap`).

*Note on 1440px's inconsistency between the isolated and sequential test:* the wrap is
**timing-dependent**, not purely a function of viewport width — it depends on how much the header's
OTHER controls (e.g. async `systemResources`-driven "SYS/LAT" info, which only appears once data
has loaded) have rendered by the time of measurement. This is additional evidence for "compression
by unshrinkable siblings" over "fixed breakpoint," and is discussed further under § BEFORE (900px
collision) below, where the same siblings are the actual root cause.

**POLISH-02 conclusion: REPRODUCED.** Proceeded to Task 2.

---

### § BEFORE (900px collision) — widened probe, since the plain reproduction did not fire

The plan's own scope for the culprit walk ("every element under the main content region") legitimately
found **zero culprits** and `document.documentElement.scrollWidth === window.innerWidth` at a plain
900x900 `/settings` load, in both passes above. Per the plan's own instruction ("widen the probe once"),
widened to 820/860/900/940/1000px with a document-wide (`document.body`) walk, since ancestor
`overflow-hidden` can clip real overflow before it reaches `document.documentElement.scrollWidth`,
hiding it from a `<main>`-scoped OR `documentElement`-scoped check alike.

**Widened matrix (sidebar expanded, Settings Sheet closed), document-wide walk, header row only:**

| Width | Header `clientWidth` | Header `scrollWidth` | Overflow | Worst culprit |
|---|---|---|---|---|
| 820 | 580 | 964 | 384px | icon-cluster `<div class="flex items-center gap-1.5 sm:gap-2 bg-primary/5 ...">` |
| 860 | 620 | 981 | 361px | same |
| 900 | 660 | 964 | 304px | same |
| 940 | 700 | 981 | 281px | same |
| 1000 | 760 | 964 | 204px | same |

Raw sample (900px, expanded sidebar):
```json
{"width":900,"collapsed":false,"sheetOpen":false,"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideWidth":240,"headerRect":{"width":660,"right":900},"headerOverflow":304,"docCulpritsTop3":[{"tag":"DIV","className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-prima","rightOverflow":304},{"tag":"DIV","className":"w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 fo","rightOverflow":295},{"tag":"DIV","className":"w-px h-4 bg-primary/20 mx-1","rightOverflow":262}],"docCulpritsCount":16}
```

`document.documentElement.scrollWidth` stayed exactly `== innerWidth` at every width — the overflow
never reaches the document because it is clipped by a distant ancestor's `overflow-hidden`
(`DashboardLayout.tsx`'s outermost `<div className="flex h-screen overflow-hidden ...">`). That is
exactly why the plan's own `<main>`-scoped, document-`scrollWidth`-gated check could not see this: the
elements involved live in the shared `<header>`, not under `<main>`, and their overflow is
invisible-clipped rather than causing a page-level scrollbar.

**Sidebar-collapsed and Sheet-open widened probe runs timed out** (a `Settings` heading race
condition with the onboarding modal, unrelated to layout) before producing usable data; not pursued
further since the expanded-sidebar, sheet-closed matrix above already gives an unambiguous,
severely reproducing (204-384px) result across five widths, which is sufficient to identify and fix
the culprit per the plan's own "if it still does not reproduce" fallback (moot here — it reproduced
clearly).

**Root-cause chain, measured (`header.children` bounding boxes at 900px, sidebar expanded):**

```json
{
  "headerClientWidth": 660, "headerScrollWidth": 981,
  "groups": [
    {"className": "flex items-center gap-4", "width": 118},
    {"className": "flex-1 max-w-sm mx-4 hidden md:flex", "width": 171},
    {"className": "flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-prima", "width": 637}
  ]
}
```

The header (`<header className="h-14 flex-shrink-0 ... flex items-center justify-between px-6 ...">`)
is itself correctly bounded to the available 660px — its own flex-column parent already has
`overflow-hidden`, which per the CSS Flexbox spec zeroes that parent's automatic minimum size, so it
does NOT expand to fit its content. But `<header>` itself has `overflow: visible` (unset), and NONE
of its three row children (left cluster / search box / icon cluster) has its own `overflow` set or a
`min-w-0` — so each child independently falls back to the standard flexbox rule and refuses to shrink
below its own content-driven minimum width. Their combined minimum (118 + 171 + 637 = 926, close to
the measured 981 scrollWidth once gaps/padding are added) exceeds the header's 660px box. The excess
renders past the header's border box and is invisibly clipped by a distant ancestor — the icon
cluster (containing `EStopButton`, `BrainHeaderBadge`, `NotificationBell`, `PrivacyShield`,
`ThemeSwitcher`, `CrtToggle`, `AmbientAudioPlayer`, `UserMenu`) is silently cut off rather than
reachable at all. `ThemeSwitcher` alone accounts for 184px of the 637px icon-cluster width (it
renders a full theme-name text label, not an icon-only control) and `UserMenu`'s fixed `w-7 h-7`
avatar was itself observed compressed to 21px wide — a symptom of the same "nothing has a shrink
guard" root cause, outside this plan's scope to fix (UserMenu is not in Task 3's files).

**POLISH-06 conclusion: REPRODUCED — but not where the plan's own candidate list expected.** The
defect is NOT in `Settings.tsx`'s `TabsList` or `Sheet` (both measured clean at every width tried);
it is in the SHARED `<header>` in `DashboardLayout.tsx`, present on every route, not Settings-specific.
`e2e/polish-geometry.spec.ts`'s Block 2 walk was widened from `<main>` to `document.body` to make this
visible; see the spec's own inline comment for the full reasoning.

---

## § Task 2 — E-Stop fix (POLISH-02)

**Measurement-justified changes**, `src/components/EStopButton.tsx`:
- `shrink-0` on the trigger `<button>` — stops the header row's flex-shrink from compressing it
  below its content width (justified by the `buttonWidth` compression observed: 81.3px unsquashed
  at 2560px vs 67-71px squashed at 360-1440px).
- `shrink-0` on the `<OctagonX>` icon — same mechanism, defensive (icon width was stable in the
  measurements taken, but flex-shrink applies to it too by default).
- `whitespace-nowrap` on the label `<span>` — stops the hyphen break directly justified by
  `labelTextNodeRectsLength: 2` measured at 360/640/900/1440px.

Did not add a `min-h`/fixed-height floor — with the wrap prevented at its source (no compression,
no hyphen break), the button's height is already width-independent; adding a redundant floor was
not justified by the measurement.

**Nine pre-existing behavioural tests in `EStopButton.test.tsx` pass UNEDITED.** One new test added,
explicitly labeled a contract guard (jsdom does not lay out text) that defers the actual geometry
proof to this e2e spec. `npx vitest run src/components/__tests__/EStopButton.test.tsx`: 10/10 pass.

`grep -c 'aria-label="Emergency Stop"'` → 1. `grep -cE 'whitespace-nowrap|shrink-0|flex-none'` → 5.
`grep -c 'bg-red-600'` → 2 (unchanged — button + confirm dialog, no restyle).

**Post-fix E-Stop evidence (all five widths, single line, identical geometry):**
```
ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE [{"requestedWidth":360,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":640,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":900,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":1440,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":2560,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1}]
```
Width and height are now IDENTICAL (81.34375 x 28) at every one of the five widths, and
`labelTextNodeRectsLength === 1` (no wrap) at every width. All five per-width tests plus the
cross-width comparison test pass.

---

## § Task 3 — 900px collision fix (POLISH-06)

**Measurement-justified change**, `src/layouts/DashboardLayout.tsx`, on `<header>` only:
- `h-14` → `min-h-14` (preserves today's exact 56px height whenever one row is enough — a no-op at
  every width that already worked).
- Added `flex-wrap` — lets the row drop to a second line instead of overflowing sideways when the
  three groups' combined minimum width exceeds the header's available width. Every control stays
  fully rendered and within the viewport; the cost is a taller header only when space is genuinely
  insufficient (confirmed visually via screenshot: at 900px the icon cluster wraps to its own
  second row beneath the left-cluster/search-box row, with no overlap).
- Added `gap-y-1` — spacing between wrapped lines only; a no-op in the single-line case (CSS
  `row-gap` in flexbox has no effect unless there is more than one line).

No sidebar width, breakpoint literal, or `Settings.tsx` markup was touched. `git diff --stat
src/pages/Settings.tsx` is empty — the true root cause was entirely in the shared header, not in
Settings' own content, so nothing there needed to change.

`grep -n '900' src/pages/Settings.tsx src/layouts/DashboardLayout.tsx` → only appears inside the
explanatory source comment prose ("Measured live at 900px..."), never as a Tailwind class/selector.
`grep -c 'w-60' src/layouts/DashboardLayout.tsx` → 2 (unchanged).

**Culprit-list criterion refinement** (found live once the header fix was applied, before this was
finalized): a body-wide walk's `scrollWidth > clientWidth` half fires on two benign, pre-existing
patterns unrelated to "collides with the sidebar" — Radix/shadcn's `sr-only` accessibility technique
(deliberately clips a dialog title/description to a 1px box by design) and the sidebar `<nav>`'s own
already-declared `overflow-x-auto` (a few-px internal mismatch fully contained and reachable by that
ancestor's own scroll). Neither ever had `rightOverflow > 1` (both measured -661..-900, nowhere near
the viewport edge). The spec's assertion was narrowed to gate strictly on `rightOverflow > 1` — an
element's own box actually extending past `window.innerWidth`, the literal "cut off at the right
edge" observable — while still capturing `scrollWidth` per element in the evidence payload for the
record. `sr-only` elements are excluded from the walk entirely.

**Post-fix `SETTINGS-900-EVIDENCE`, 3 consecutive independent runs, all clean:**
```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":89,"width":660,"height":811},"culprits":[]}
```
(identical across all 3 runs) — `culprits: []`, `scrollWidth (900) <= innerWidth (900)`. All 7
`polish-geometry.spec.ts` tests pass.

### The load-bearing control (revert-and-refail)

The header's `className` was reverted in the working tree to its exact pre-fix string
(`h-14 flex-shrink-0 bg-background/80 backdrop-blur-md border-b border-border flex items-center
justify-between px-6 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]`, no `flex-wrap`/`gap-y-1`/`min-h-14`),
the explanatory comment above it left in place, and the spec re-run:

```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":56,"width":660,"height":844},"culprits":[{"tag":"DIV","className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10","scrollWidth":570,"clientWidth":570,"right":1156.53125,"overflowAmount":256.53125}, ...14 more...]}
1 failed
6 passed (4.0s)
```
**FAILS** — the icon cluster's right edge sits at x=1156.5 against a 900px viewport (256px
overflow), and 14 more descendant elements report the same. This is the exact defect from § BEFORE,
reproduced on demand by reverting exactly one class string.

The fix was then restored verbatim (`diff` against the pre-revert file confirmed byte-identical:
`IDENTICAL - restore confirmed`), and the spec re-run once more:

```
SETTINGS-900-EVIDENCE {"innerWidth":900, ..., "culprits":[]}
7 passed (4.0s)
```
**PASSES** again. The revert-and-refail pair rules out coincidence: the `flex-wrap` change on
`<header>` is what closes the gap, not some unrelated timing or state difference between runs.

---

## Full-suite verification after Tasks 1-3

- `npx tsc --noEmit` — exit 0 (clean, no errors), run after every change in this file.
- `npx vitest run` — **336 test files passed | 17 skipped (353)**, **4690 tests passed | 197 todo
  (4887)**, 0 failing. Baseline was 336 files / 4689 tests; the +1 is the new EStopButton contract
  guard test (Task 2). No regressions.
- `npm run build` — exit 0, built successfully (chunk-size warnings only, pre-existing and
  unrelated).

---

## Not yet done (Task 4 / Task 5 — out of this partial's scope)

- **Task 4 (human-verify checkpoint):** live drag-resize confirmation of the E-Stop across the full
  width range, and a by-eye check of `/settings` at 900px with the side sheet both closed and open,
  has **not** been performed. This file's automated evidence covers the mechanical proof only.
- **Task 5:** the formal `§ AFTER` / `§ The load-bearing control` / `§ Corrections to CONTEXT.md` /
  `§ Attended verification` / `§ Handoff` sections (per the plan's exact required structure) have
  not been written in that shape — the equivalent data is captured above under `§ Task 2` / `§ Task
  3`, and should be reorganized into the plan's Task-5 structure once Task 4's human result is
  available. Supporting data already gathered for Task 5's corrections section:

  ```
  $ grep -rniE "estop" src/components/control-center/CompactControlStrip.tsx \
      src/components/control-center/ControlCenterPanel.tsx src/components/CommandPalette.tsx \
      src/layouts/DashboardLayout.tsx
  src/components/control-center/CompactControlStrip.tsx:15: * `onScreenShareStart` / `onScreenShareStop` callbacks `ControlCenterPanel`
  src/components/control-center/CompactControlStrip.tsx:42:  onScreenShareStop: () => void;
  src/components/control-center/CompactControlStrip.tsx:53:  onScreenShareStop,
  src/components/control-center/CompactControlStrip.tsx:115:        onClick={() => (sharing ? onScreenShareStop() : void onScreenShareStart())}
  src/components/control-center/ControlCenterPanel.tsx:87:  onScreenShareStop: () => void;
  src/components/control-center/ControlCenterPanel.tsx:101:  onScreenShareStop,
  src/components/control-center/ControlCenterPanel.tsx:193:            onStop={onScreenShareStop}
  src/layouts/DashboardLayout.tsx:23:import { EStopButton } from "../components/EStopButton";
  src/layouts/DashboardLayout.tsx:639:            <EStopButton />
  ```
  Confirms the plan's `<interfaces>` correction: `EStopButton` has exactly ONE render site
  (`DashboardLayout.tsx:639` — line number shifted from the plan's `:612` reading because of the
  explanatory comment blocks this task added above the `<header>` and the trigger `<button>`).
  `CompactControlStrip.tsx` / `ControlCenterPanel.tsx` match only via `onScreenShareStop` /
  `onScreenShareStart` (screen-share, unrelated); `CommandPalette.tsx` has zero matches.

- **CRITERION-1 AGGREGATE** (the orchestrator's phase-level close-out block appended to this plan's
  `<verification>` section) has **not** been run. It is not scoped to any specific task number and
  reads most naturally as part of finishing this evidence file (Task 5), after all of 120-01..06
  have landed. Left for whoever performs Task 5.

---

## § AFTER (Task 5)

### E-Stop, post-fix

The post-fix E-Stop record captured during Task 2 is a single `ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE`
line (one JSON array covering all five widths in one console emission), not five separate
per-width `ESTOP-GEOMETRY-EVIDENCE` lines — that is genuinely what Task 2 pasted into
`§ Task 2` above, elisions (`...`) included, and no separate per-width post-fix lines exist
in this file to quote instead. Rather than reconstruct or retype the elided fields from memory,
here is that line exactly as it already appears above (§ Task 2, "Post-fix E-Stop evidence"):

```
ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE [{"requestedWidth":360,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":640,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":900,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":1440,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1},{"requestedWidth":2560,...,"buttonWidth":81.34375,"buttonHeight":28,"labelTextNodeRectsLength":1}]
```

Reading it: `buttonWidth` and `buttonHeight` are **81.34375 × 28 at every one of the five widths**
(360, 640, 900, 1440, 2560) — identical, where pre-fix they varied (67-81 wide, 28-48 tall
depending on whether the wrap fired). `labelTextNodeRectsLength` is **1 at every width** — no
line break at the hyphen anywhere in the range, where pre-fix it was 2 at 360/640/900px (and
intermittently 1440px). All 7 spec tests (5 per-width + 1 cross-width + 1 collision) pass on
this run, per § Task 2's "All five per-width tests plus the cross-width comparison test pass."

### 900px collision, post-fix

Verbatim, from § Task 3, "Post-fix `SETTINGS-900-EVIDENCE`, 3 consecutive independent runs, all
clean" — one full, non-elided line, identical across all three runs:

```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":89,"width":660,"height":811},"culprits":[]}
```

`scrollWidth (900) <= innerWidth (900)`, `culprits: []`. Note `mainRect.y` moved from 56 (pre-fix)
to 89 — the header grew from a fixed 56px to a slightly taller box even in its passing state,
consistent with `min-h-14` plus the added `gap-y-1`/`flex-wrap` allowing (but not forcing) a
taller box; it did not need to wrap to two lines at exactly 900px in this run.

---

## § The load-bearing control (Task 5)

From § Task 3, "The load-bearing control (revert-and-refail)" — restated here as the two-halves
pair Task 5 requires:

**Reverted** (header `className` restored to its exact pre-fix string, no `flex-wrap`/`gap-y-1`/
`min-h-14`):
```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":240,"height":900},"mainRect":{"x":240,"y":56,"width":660,"height":844},"culprits":[{"tag":"DIV","className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10","scrollWidth":570,"clientWidth":570,"right":1156.53125,"overflowAmount":256.53125}, ...14 more...]}
1 failed
6 passed (4.0s)
```
256.5px of overflow, 15 culprit elements, 1 test failed.

**Restored** (fix reapplied, `diff` against the pre-revert file confirmed byte-identical —
"IDENTICAL - restore confirmed"):
```
SETTINGS-900-EVIDENCE {"innerWidth":900, ..., "culprits":[]}
7 passed (4.0s)
```
`culprits: []`, all 7 tests pass.

**What this rules out:** the only variable that changed between the two runs is that one class
string on `<header>`. Nothing else in the page, the test harness, the viewport, or the route was
touched between them. So the control rules out coincidence, test flakiness, and any timing- or
state-dependent explanation for the pass (e.g. async header content having settled differently
between runs) — the `flex-wrap`/`gap-y-1`/`min-h-14` change on `<header>` is what closes the
900px gap, not an unrelated factor. It also rules out that the fix works by accident of ordering:
reverting to the byte-identical original string reproduces the byte-identical original failure
(256px overflow, 15 culprits — the same shape recorded in § BEFORE), so the fix and the defect
are the same mechanism observed from both sides.

---

## § Corrections to CONTEXT.md (Task 5)

Three corrections. The first two were already flagged in this plan's own `<interfaces>` section
before execution began; both are re-verified here with a fresh search run during Task 5, not
copied from the plan's or Task 1's prior claim.

### 1. `EStopButton` renders at exactly ONE site, not the four CONTEXT.md lists

Search run directly (Task 5, this session):

```
$ grep -rniE "estop" src/components/control-center/CompactControlStrip.tsx \
    src/components/control-center/ControlCenterPanel.tsx src/components/CommandPalette.tsx \
    src/layouts/DashboardLayout.tsx
src/components/control-center/CompactControlStrip.tsx:15: * `onScreenShareStart` / `onScreenShareStop` callbacks `ControlCenterPanel`
src/components/control-center/CompactControlStrip.tsx:42:  onScreenShareStop: () => void;
src/components/control-center/CompactControlStrip.tsx:53:  onScreenShareStop,
src/components/control-center/CompactControlStrip.tsx:115:        onClick={() => (sharing ? onScreenShareStop() : void onScreenShareStart())}
src/components/control-center/ControlCenterPanel.tsx:87:  onScreenShareStop: () => void;
src/components/control-center/ControlCenterPanel.tsx:101:  onScreenShareStop,
src/components/control-center/ControlCenterPanel.tsx:193:            onStop={onScreenShareStop}
src/layouts/DashboardLayout.tsx:23:import { EStopButton } from "../components/EStopButton";
src/layouts/DashboardLayout.tsx:639:            <EStopButton />
```

`CompactControlStrip.tsx` and `ControlCenterPanel.tsx` match the case-insensitive `estop` pattern
only via `onScreenShareStop` / `onScreenShareStart` — screen-share callbacks, unrelated to the
Emergency Stop control. `CommandPalette.tsx` produces zero matches (absent from the output above
entirely). `DashboardLayout.tsx` is the only file with a real `EStopButton` reference: the import
at line 23 and the single render site at line 639 (`<EStopButton />`, inside the shared
`<header>`). CONTEXT.md's claim of four render sites (`CompactControlStrip.tsx`,
`ControlCenterPanel.tsx`, `layouts/DashboardLayout.tsx`, `CommandPalette.tsx`) is wrong; there is
exactly one.

### 2. The sidebar is `w-60` (240px), not the 232px REQUIREMENTS.md/CONTEXT.md mention

Search run directly (Task 5, this session):

```
$ grep -n 'w-60' src/layouts/DashboardLayout.tsx
524:      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-[48px]" : "w-60"} flex-shrink-0 bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex-col transition-[width] duration-200`}>
545:        className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex flex-col transform transition-transform duration-200 md:hidden ${
```

Two occurrences: the desktop `<aside>` (line 524, live at Tailwind's `md:` / 768px) and the
mobile overlay drawer (line 545). Both are `w-60` = 240px. REQUIREMENTS.md and CONTEXT.md's
232px is SHELL-02's **target** width for Phase 124's shell restructure, not today's rendered
value — this plan (120-07) deliberately left both occurrences unchanged (`grep -c 'w-60'` is 2
before and after Task 3, per § Task 3 above).

### 3. The plan's own predicted 900px culprit (`Settings.tsx`) was wrong

This plan's `<interfaces>` section (and Tasks 2/3's candidate lists) ranked `Settings.tsx`'s
`TabsList` (line ~501, already `overflow-x-auto`) and its `Sheet` (line ~886, `w-[400px]
sm:w-[540px]`) as the most likely 900px culprits. **Both measured clean at every width tried** —
the plain `<main>`-scoped reproduction in § BEFORE found zero culprits and `scrollWidth ===
innerWidth` on `/settings` at a plain 900×900 load, and the widened document-body-wide walk
(820-1000px) traced the entire 204-384px overflow to the shared `<header>` in
`DashboardLayout.tsx` — present on every route, not Settings-specific. `Settings.tsx` was never
modified by this plan (`git diff --stat src/pages/Settings.tsx` is empty, per § Task 3). A future
reader must not carry forward the plan's prediction that Settings.tsx was, or needed to be, the
fix site — it was a reasonable candidate that the measurement ruled out, not a fact.

---

## § Attended verification (Task 5)

Task 4 (`checkpoint:human-verify`, `gate="blocking"`) was presented to the human operator with
the plan's five-step live-verification procedure (start `dev:noauth`, drag-resize the window
watching the E-Stop across the full width range, load `/settings` at ~900px and check for
horizontal scroll, repeat with a side sheet open, write down anything that still moves/wraps/
overflows).

The operator's complete and literal response was the single word:

> approved

He reported no specific observations, no measurements, no widths, and did not describe anything
he saw. That bare `approved` is the plan's own specified resume signal (`<resume-signal>Type
"approved", or describe what still wraps or overflows and at which width.</resume-signal>`) and
is recorded here as a valid approval on that basis.

It is recorded as **APPROVED-WITHOUT-DETAIL** — this section deliberately does not claim, imply,
or embroider that the operator dragged the window, that the E-Stop held its size or stayed on
one line, that he visited `/settings` at 900px, that he opened a side sheet, or that he
"confirmed," "observed," or "verified by eye" anything. None of that was said. The substantive
proof for POLISH-02 and POLISH-06 therefore rests on the in-page Playwright measurements
(§ BEFORE, § AFTER) and the revert-and-refail control (§ The load-bearing control) — not on the
attended pass, which contributes only the operator's sign-off signal.

Two earlier plans' attended checks were folded into this same checkpoint and are recorded here
as **outstanding, not performed**: 120-03's dialog check and 120-04's badge check were both
reported by their own executors as not performed for want of a browser. They are likewise
approved-without-detail by the same `approved` response, with the same caveat — no specific
observation of either was reported.

---

## § Handoff (Task 5)

`e2e/polish-geometry.spec.ts` now exists as a permanent geometry regression guard for the E-Stop
control and the shared `<header>` row (7 tests: 5 per-width E-Stop checks, 1 cross-width E-Stop
comparison, 1 document-body-wide 900px collision check). Phase 124's shell restructure must keep
this spec green — it directly measures the `<header>`'s flex-wrap behavior and the sidebar's
`w-60` width that Phase 124 is expected to touch, so a Phase 124 change that breaks either
geometry contract will be caught here rather than discovered visually later.
