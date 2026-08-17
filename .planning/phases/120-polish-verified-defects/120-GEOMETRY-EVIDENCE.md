# 120-07 Geometry Evidence — POLISH-02 (E-Stop) & POLISH-06 (900px collision)

**Status: PARTIAL.** This file covers Tasks 1-3 of `120-07-PLAN.md` (reproduction, E-Stop fix,
900px-collision fix). Task 4 (human-verify checkpoint) and Task 5 (formal AFTER / Corrections /
Attended / Handoff write-up) have **not** run yet — Task 5 should extend this file rather than
replace it, incorporating the Task 4 human result once available.

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
