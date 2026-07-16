# Skills Command Center Redesign — Design Spec

**Date:** 2026-07-16
**Status:** Approved (design)
**Scope:** CodePulse frontend only — `src/pages/Skills.tsx` + `src/components/skills/*`. Zero Convex/schema changes.

## Problem

The Skills page grew by accretion and now has:

1. **Three overlapping quick-access docks** — `SkillPills` ("Most Used", copies invocation), `FavoriteSkills` ("Priority Assets", launches Chat), `FrequentSkills` ("Frequently Used", launches Chat) — three visual languages for nearly the same job, stacked above the fold.
2. **Intake panel permanently occupying prime real estate**, even when empty.
3. **Inconsistent design languages**: cyberpunk/terminal styling (scanlines, glow, `[ Review ]`, "NO SKILLS FOUND IN SECTOR") beside plain shadcn cards and legacy hardcoded Tailwind colors (`gray-*`, `indigo-600`) that ignore the theme-token system, so non-cyan themes render wrong.
4. **`COLOR_HEX` duplicated in 4 components**; inline `style` mutation in `onMouseEnter` handlers.
5. **Search only filters inside a selected category** despite its "Search all skills..." placeholder.
6. **Two competing primary actions** (copy invocation vs. launch Chat) with no visual rule for which is which.

## Decisions (locked with Larry, 2026-07-16)

- **Primary use:** equal split between launching and managing — both stay on one screen.
- **Scope:** full structural redesign; backend untouched.
- **Aesthetic:** polished command-center — keep the sci-fi/terminal identity but disciplined, token-driven, effects reserved for live elements.
- **Intake:** collapses to a strip + slide-over `Sheet`; "Validate skill" button stays in the header.
- **Primary action everywhere: copy invocation** (Larry's real workflow is pasting into a Claude Code terminal). "Open in Chat" is the secondary action.
- **Ctrl+K command palette:** yes, using the existing shadcn `command.tsx` (cmdk).

## Layout

```
PageHeader "Skills"                    [⌘K Search] [Validate skill]
├ Review strip    (only when auto-assigned skills pending review)
├ Intake strip    (only when intake rows exist → opens Sheet)
├ Quick Deck      (★ favorites pinned, then most-used; ~10 chips, one language)
├──────────────┬─────────────────────────────────────────────
│ Rail         │ Main
│ palette btn  │  nothing selected → All-skills overview,
│ origin filter│  grouped by category, searchable globally
│ categories   │  category selected → dense rows for that
│ (drag targets)│  category (drag-drop + move targets kept)
```

## Components

### New

**`src/lib/categoryColors.ts`** — single `COLOR_HEX` map + `categoryHex(color: string): string`. Kills the 4 duplicates (`CategoryGrid`, `FavoriteSkills`, `SkillsInCategory`, `FrequentSkills`).

**`SkillCommandPalette.tsx`** — cmdk `CommandDialog`:
- Opens on `Ctrl+K` (global listener on the Skills page) and from the rail's search button (the current `<input>` becomes a button styled like a search field with a `⌘K` kbd hint).
- Items: all non-hidden skills; grouped **Favorites** first, then by category, Uncategorized last. Each item shows invocation (mono), display name, category icon, and a dormant marker where applicable.
- `Enter` copies the invocation (via `skillInvocation()`) + records `recordSkillLaunch`; `Ctrl+Enter` navigates to `/chat?skill=...`. Footer hints both keys.
- Dormant skills (per `isDormant()`) render dimmed with a "dormant" badge; `Enter` on them still copies but shows "dormant — not loaded" feedback instead of "copied".

**`QuickDeck.tsx`** — replaces `SkillPills` + `FavoriteSkills` + `FrequentSkills`:
- One chip row, max 10: favorites first (star-accented, sorted by `useCount` desc), then `topSkills()` fill excluding skills already shown. Dormant skills never appear (existing rule — their invocation does nothing).
- Chip anatomy: category icon, invocation in mono, use count. Click = copy with the existing 1.5s "copied" / "copy failed" state machine (ported from `SkillPills`); records the launch. Hover reveals two ghost icon buttons: open-in-Chat, star toggle.
- Section header: "Command Deck" in the standard mono-uppercase style with the pulse dot.

**`SkillRow.tsx`** — the one row component used by category view, all-skills overview, and uncategorized list:
- Grip handle (draggable, existing `text/plain` dataTransfer contract), display name + optional star, description (truncated), use count.
- Actions right-aligned: **Copy** (primary, bordered mono button showing "copied" feedback inline), then hover-revealed ghost icons: open-in-Chat, edit, star toggle.
- Dormant rows dimmed with a "dormant" badge; copy shows the dormant warning.

**`AllSkillsOverview.tsx`** — main-area default when no category is selected:
- Category sections in `CategoryGrid`'s count-desc order, each with header (icon, name, count) + `SkillRow` list; Uncategorized last (absorbs `UncategorizedSkills`).
- Filtered by the rail's origin filter AND a **Main-area filter bar** (text input) that searches name/description. The filter bar is owned by `Skills.tsx` and applies to BOTH the overview (across all groups — fixing the scoped-search lie) and the selected-category view (replacing the old rail-input scoping). Empty groups collapse away; a global "no matches" state uses the terminal empty-state style.
- Sections beyond the first N rows per category collapse behind a "show all (n)" toggle to keep the page scannable with ~150 skills.

**`IntakeStrip.tsx` + `IntakeSheet.tsx`** — the intake surface:
- State lifts out of `IntakePanel` into a **`useIntakeFeed()` hook** (in `src/hooks/useIntake.ts` or a sibling): pendingLocal + reconciliation effect + fileName memory + merge/dedupe/DISPLAY_LIMIT + shared countdown tick. Instantiated once in `Skills.tsx` so state survives the Sheet unmounting.
- Strip renders only when `mergedRows.length > 0`: latest row's status chip + label, count of non-terminal rows ("2 active"), and opens the Sheet on click. Preserves the `aria-live` contracts (`polite` chip container, `off` countdown).
- Sheet (right side, `sheet.tsx`): full row list + `Collapsible` report expansion — the existing `IntakePanel` row markup moves here nearly verbatim, including expired/failed sub-rows and skeletons.
- `IntakeModal` mounts at page level (as today), fed by the same hook's `handleEnqueued`/`handleEnqueueFailed`.

### Changed

- **`Skills.tsx`** — recomposed per the layout; keeps all existing mutations/handlers. Seed state (`needsSeed`) restyled with tokens (`bg-primary` button, not `indigo-600`).
- **`CategoryGrid`** — visual pass only: replace `text-white`/`bg-white/5` with token equivalents (`text-foreground`, `bg-accent/50`), use `categoryHex()`. Behavior (drag targets, edit, keyboard) unchanged.
- **`SkillsInCategory`** — swaps its inline row markup for `SkillRow`; keeps header, move-target chips, and drag-drop. "Launch" button replaced by Copy-primary per the action decision.
- **`NewSkillsBanner`** — restyled to the same strip language as `IntakeStrip` (shared strip styling, effects only on the live dot). Behavior unchanged.

### Removed

`SkillPills.tsx`, `FavoriteSkills.tsx`, `FrequentSkills.tsx`, `UncategorizedSkills.tsx`, `IntakePanel.tsx` (logic redistributed as above), plus their tests (replaced — see Testing).

## Styling discipline (applies to every touched component)

- **Tokens only**: `--primary`, `--status-*`, `--info`, `--glow-xs…lg`, `--chart-*`, `text-foreground`/`text-muted-foreground`, `bg-card`/`bg-accent`. No raw `gray-*`, `indigo-*`, `white`. Category colors are user data and stay as the centralized `COLOR_HEX` palette; the favorites star keeps amber as its semantic color.
- Section headers: one shared pattern — `text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70` with the pulse dot reserved for sections reflecting live data.
- Animated effects (scanline, ping, pulse) only on live/status elements — not on static cards.
- Hover states via CSS classes; no `onMouseEnter` style mutation. Category-hex accents via CSS custom properties set once in `style` (e.g. `style={{ "--cat": hex }}`) and consumed by classes.
- Respect `readable` theme: rely on tokens so glow suppression works automatically.

## Data flow

Unchanged: `getSkillsWithOverrides`, `listCategories`, and the existing mutations. Copy actions call `recordSkillLaunch` (rankings keep working). No new Convex functions, no schema changes.

## Accessibility

- Palette: cmdk's built-in listbox semantics; visible focus.
- Deck chips and row actions keyboard-focusable with `aria-label`s naming the invocation.
- Intake `aria-live` contracts preserved verbatim (locked from Phase 07).
- Drag-drop keeps the existing keyboard alternative (edit popover category select).

## Testing (Vitest, jsdom)

- **Replace** `SkillPills.test.tsx` → `QuickDeck.test.tsx`: favorites pinned first, most-used fill dedupes favorites, 10-cap, dormant exclusion, copy success/failure states, launch recorded.
- **New** `SkillCommandPalette.test.tsx`: opens on Ctrl+K, fuzzy filter hits name+description, Enter copies + records, Ctrl+Enter navigates, dormant feedback.
- **New** `AllSkillsOverview.test.tsx`: grouping order, global search across groups, origin filter interaction, empty state.
- **Port** `IntakePanel.test.tsx` → `IntakeSheet`/`useIntakeFeed` tests: optimistic row, reconciliation drop, fileName memory, countdown gating, strip visibility rules. The reconciliation/dedupe logic moving into a hook makes these MORE testable, not less.
- **Update** `Skills.test.tsx` for the new composition.
- `npx tsc --noEmit` clean.

## Verification (real outcomes)

1. Full Vitest suite green + typecheck clean.
2. Live check at `http://localhost:5173/skills`: deck renders with real favorites/usage data, Ctrl+K palette finds and copies, drag-drop categorization still works, intake strip appears after a "Validate skill" enqueue and the Sheet shows the report.
3. Theme sweep: cyan, emerald, readable, aubergine, and light — no hardcoded-color artifacts.
4. Screenshot before/after for the record.

## Non-goals (YAGNI)

- No Convex/schema changes; no new usage-tracking semantics.
- No virtualization (150 rows with collapsed groups is fine; revisit if the catalog grows 5×).
- No mobile-first rework beyond keeping the existing responsive stacking working.
- Capabilities page and OriginBadge untouched.
