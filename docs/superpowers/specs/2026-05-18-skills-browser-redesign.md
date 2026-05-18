# Skills Browser Redesign — Categorization, Admin UI, and Visual Overhaul

**Date:** 2026-05-18
**Status:** Design approved
**Branch:** `feat/skills-browser` (existing, 42 commits ahead of master)

## Problem

The current skills page derives categories by splitting skill names at the first hyphen — `gsd-plan-phase` becomes category "Gsd" with display name "Plan Phase". No human-readable names, no manual categorization, no admin controls. The presentation is a basic accordion with minimal styling.

## Goals

1. Human-readable display names and descriptions for every skill
2. Curated categories with icons, colors, and descriptions
3. Admin UI to manage categories and skill assignments inline
4. Two view modes (grid + grouped list) with a toggle
5. Auto-categorize new skills from sync, flag them for review
6. Full visual redesign of the skills page

## Architecture: Convex-Only with Auto-Seed

All categorization data lives in Convex. No Ástríðr changes. The sync pipeline stays unchanged — `syncInventory` writes to the `skills` table as before. Two new tables provide a presentation layer on top.

### Why not Ástríðr-side metadata?

CodePulse is the only consumer of display metadata. Putting it in Ástríðr would require cross-repo changes, Docker rebuilds to propagate, and sync pipeline modifications — all for marginal benefit. The presentation layer belongs in the presentation system.

## Data Model

### New Table: `skillCategories`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Kebab-case identifier, e.g. `"project-mgmt"`. Unique. |
| `displayName` | `string` | Human-readable, e.g. `"Project Management"` |
| `description` | `string` | Category subtitle, e.g. `"Planning, execution, tracking, and verification"` |
| `icon` | `string` | Emoji character, e.g. `"📋"` |
| `color` | `string` | Tailwind color key, e.g. `"indigo"`, `"emerald"`, `"amber"` |
| `sortOrder` | `float64` | Manual sort position. Lower = first. |

**Indexes:** `by_name` on `["name"]`

### New Table: `skillOverrides`

| Field | Type | Description |
|-------|------|-------------|
| `skillName` | `string` | Matches `skills.name`. One override per skill. |
| `displayName` | `string` | Auto-generated or manually set, e.g. `"Plan Phase"` |
| `categoryName` | `string` | FK to `skillCategories.name` |
| `description` | `optional(string)` | Override of the synced description. Null = use `skills.description`. |
| `hidden` | `boolean` | If true, skill is hidden from the page. Default false. |
| `isAutoAssigned` | `boolean` | True if auto-seeded from prefix. Set to false on manual edit. |

**Indexes:** `by_skillName` on `["skillName"]` (unique), `by_categoryName` on `["categoryName"]`

### Existing Table: `skills` (unchanged)

No schema changes. The `skills` table remains the source of truth for what skills exist. `skillOverrides` is a separate presentation layer.

## Auto-Seed Logic

Runs inside `syncInventory` when a new skill is inserted:

1. Extract prefix from skill name (everything before first `-`). If the name contains no `-`, the prefix is `"uncategorized"` and the display name is the titleCased full name.
2. Query `skillCategories` for a category with matching `name` equal to the prefix.
3. If no category exists, create one:
   - `name`: the prefix (e.g. `"gsd"`)
   - `displayName`: titleCase of prefix (e.g. `"GSD"`)
   - `description`: empty string
   - `icon`: lookup from a default prefix→emoji map, fallback `"⚡"`
   - `color`: lookup from a default prefix→color map, fallback `"gray"`
   - `sortOrder`: `Date.now()` (append to end)
4. Create `skillOverrides` entry:
   - `skillName`: the skill's name
   - `displayName`: titleCase of the name with prefix stripped (e.g. `"gsd-plan-phase"` → `"Plan Phase"`)
   - `categoryName`: the prefix
   - `description`: null (use synced description)
   - `hidden`: false
   - `isAutoAssigned`: true

### Default Prefix Maps

```typescript
const DEFAULT_ICONS: Record<string, string> = {
  gsd: "📋",
  legal: "⚖️",
  market: "📈",
  sales: "💼",
  geo: "🌐",
  codex: "🖥️",
  superpowers: "⚡",
  // ... extend as needed
};

const DEFAULT_COLORS: Record<string, string> = {
  gsd: "indigo",
  legal: "red",
  market: "purple",
  sales: "amber",
  geo: "cyan",
  codex: "emerald",
  superpowers: "violet",
  // ... extend as needed
};
```

These are starter defaults. The admin UI lets you change everything.

## Skills Page UI

### Layout: Two-Row Header + Dual View

```
Row 1: Full-width search bar
Row 2: Category tabs (scrollable) | View toggle (⊞/☰) | Edit mode gear icon
Strip: Frequently Used pills (top 6 by useCount)
Body: Grid or List view (persisted to localStorage)
```

### Grid View (⊞ active)

- Flat grid of skill cards, 4 columns (responsive: 1→2→3→4).
- Category tab filters which skills show. "All" tab shows everything.
- Each card: category icon background (with category color), display name, short description.
- Card left border or icon background uses the category's color.
- Click launches skill (navigates to `/chat?skill={name}`).

### List View (☰ active)

- Scrollable page with category section headers.
- Each header: category icon + display name + skill count badge + category description.
- 3-column card grid within each section (responsive: 1→2→3).
- Cards: display name + description. Compact form (no large icon).
- "All" tab shows all sections. Selecting a tab filters to that section.

### Search

- Filters by display name and description across both views.
- In list view, hides categories with no matches.
- Debounced (200ms).

### Frequently Used Strip

- Always visible below the tab row in both views.
- Top 6 skills with `useCount >= 1`, sorted by useCount desc.
- Pill buttons with category color as background gradient.
- Click launches skill.

### New Skills Badge

- Dot indicator on the "Skills" nav item in sidebar when `isAutoAssigned` count > 0.
- Dismissible banner at top of page: "X new skills auto-categorized. [Review]"
- "Review" button activates edit mode and filters to auto-assigned skills.

### View Toggle

- Two-button toggle group (grid icon / list icon).
- Persisted to `localStorage` key `codepulse-skills-view`.
- Default: grid view.

## Inline Edit Mode

### Activation

Gear icon button in the page header, right of the view toggle. Toggles edit mode on/off. Visual indicator: gear icon highlighted in indigo when active, page gets a subtle top border or "Edit Mode" badge.

### Skill Card Editing

In edit mode, each skill card shows a pencil icon overlay. Clicking opens an inline popover (positioned relative to the card, not a modal) with:

- **Display Name** — text input, pre-filled
- **Description** — text input, pre-filled (placeholder shows synced description if no override)
- **Category** — dropdown of existing categories (shows displayName + icon)
- **Hidden** — toggle switch
- **Save / Cancel** buttons

Saving calls an `updateSkillOverride` mutation and sets `isAutoAssigned = false`.

### Category Tab Editing

In edit mode, each category tab shows a small edit icon. Clicking opens a popover with:

- **Display Name** — text input
- **Description** — text input
- **Icon** — text input for emoji
- **Color** — row of color swatches (indigo, emerald, amber, red, purple, cyan, pink, orange, gray, violet)
- **Sort Order** — up/down arrow buttons

A **[+]** button at the end of the tab row creates a new category. A **delete** option on empty categories (must have 0 skills assigned, otherwise disabled with tooltip).

### New Skills Review

- Auto-assigned skills get a dashed border highlight in edit mode.
- "Review New (X)" button in the banner filters to `isAutoAssigned === true` skills only.
- "Accept All" button clears `isAutoAssigned` on all shown skills.
- Individual edits also clear the flag.

### Edit Mode Does NOT Change

- Search behavior
- Frequent skills strip
- View toggle
- Launch functionality is disabled — clicking a card in edit mode opens the edit popover, not chat

## Convex Mutations and Queries

### New Queries

- `listSkillCategories()` — returns all categories sorted by `sortOrder`
- `listSkillOverrides()` — returns all overrides
- `countAutoAssigned()` — returns count of `isAutoAssigned === true` overrides
- `getSkillsWithOverrides()` — joins `skills` + `skillOverrides` + `skillCategories`, returns enriched skill objects for the UI

### New Mutations

- `createCategory({ name, displayName, description, icon, color, sortOrder })`
- `updateCategory(id, { displayName?, description?, icon?, color?, sortOrder? })`
- `deleteCategory(id)` — fails if any overrides reference it
- `updateSkillOverride(skillName, { displayName?, categoryName?, description?, hidden? })` — also sets `isAutoAssigned = false`
- `bulkAcceptAutoAssigned()` — sets `isAutoAssigned = false` on all auto-assigned overrides
- `autoSeedSkill(skillName)` — called from `syncInventory` for new skills

## Component Structure

### New Components

- `src/components/skills/SkillGrid.tsx` — grid view card layout
- `src/components/skills/SkillList.tsx` — list view with category sections
- `src/components/skills/CategoryTabs.tsx` — scrollable tab bar with edit support
- `src/components/skills/ViewToggle.tsx` — grid/list toggle
- `src/components/skills/SkillEditPopover.tsx` — inline skill editor
- `src/components/skills/CategoryEditPopover.tsx` — inline category editor
- `src/components/skills/NewSkillsBanner.tsx` — auto-assigned notification + review CTA
- `src/components/skills/EditModeToggle.tsx` — gear icon toggle

### Modified Components

- `src/pages/Skills.tsx` — full rewrite with new layout, dual views, edit mode state
- `src/components/skills/FrequentSkills.tsx` — restyle as pill strip with category colors
- `src/components/skills/SkillButton.tsx` — redesign as proper card with icon, color, description

### Removed Components

- `src/components/skills/SkillCategoryAccordion.tsx` — replaced by `CategoryTabs` + `SkillList`
- `src/lib/skillCategories.ts` — prefix-based logic moves to Convex auto-seed mutation

## Testing Strategy

- **Unit tests** for auto-seed logic (prefix extraction, titleCase, default maps)
- **Unit tests** for each new component (render, edit mode toggle, popover interactions)
- **Convex function tests** for mutations (create/update/delete category, update override, bulk accept)
- **Integration test** for the sync → auto-seed flow (new skill appears → override + category created)

## Migration Path

On first load after deploy, existing skills will have no overrides or categories. Two options:

**Option: Seed migration mutation.** A one-time `seedExistingSkills` mutation that iterates all skills in the `skills` table and runs auto-seed logic for each. Called manually from the Convex dashboard or triggered by a "Set up categories" CTA on the empty skills page.

This is the cleanest approach — the skills page shows a setup prompt on first visit, you click it, and all existing skills get auto-categorized. Then you refine in edit mode.

## Out of Scope

- Drag-and-drop reordering of skills within categories
- Skill aliases or shortcut keys
- Category nesting / sub-categories
- Export/import of category configuration
- Ástríðr-side metadata changes
- Multi-user permissions / role-based edit access
