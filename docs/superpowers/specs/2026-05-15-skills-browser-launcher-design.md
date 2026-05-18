# Skills Browser & Launcher Page

**Date:** 2026-05-15
**Scope:** New `/skills` page in CodePulse for browsing, searching, and launching Astridr skills by category.

---

## Overview

A dedicated page in CodePulse that displays all Astridr skills organized by category (derived from name prefixes), with expandable accordion sections and one-click launch to chat. Includes an auto-tracked frequently-used section for daily-use skills. Stays in sync via Astridr's existing scan-to-Convex push.

## Architecture: Convex-Native (Approach A)

All skill data flows through Convex. Astridr pushes skill manifests via the existing `/scan` endpoint during boot or rescan. CodePulse reads skills with `useQuery()` for real-time updates. No polling, no direct Astridr API calls from the skills page.

---

## Data Layer

### Schema Changes

Add `useCount` field to the existing `skills` table in `convex/schema.ts`:

```typescript
skills: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  source: v.optional(v.string()),
  lastUsedAt: v.optional(v.float64()),
  discoveredAt: v.float64(),
  origin: v.optional(v.string()),
  useCount: v.optional(v.float64()),  // NEW — defaults to 0
}).index("by_name", ["name"]),
```

`useCount` is `v.optional(v.float64())` for backward compatibility with existing rows.

### New Mutation: `recordSkillLaunch`

Location: `convex/registry.ts`

```
recordSkillLaunch(name: string):
  1. Look up skill by name (index: by_name)
  2. If found, patch: useCount = (existing useCount || 0) + 1, lastUsedAt = Date.now()
  3. If not found, no-op (skill may have been removed between page load and click)
```

### Category Derivation

Categories are derived client-side, not stored in the database:
- Split skill `name` on first `-` to get prefix (e.g., `legal-nda` -> `legal`)
- Skills with no `-` use their full name as the category
- Category display names are title-cased (e.g., `legal` -> `Legal`)

### Sync

No changes to Astridr or the scan pipeline. The existing `syncInventory` in `convex/registry.ts` already upserts skills from `/scan` payloads and detects drift (adds/removes). New fields (`useCount`) are preserved across syncs since `syncInventory` only updates `name`, `description`, `source`, and `discoveredAt`.

---

## Page Layout

### Route

- Path: `/skills`
- Nav group: COMMAND (alongside Chat, Live Run, Inbox, etc.)
- Nav icon: `wand-2` (Wand2 from Lucide, already in icon map)
- Lazy-loaded via `React.lazy()` in `App.tsx`

### Structure (top to bottom)

#### 1. Header
- Title: "Skills" with a badge showing total skill count
- Search input (right-aligned): filters across category names and skill names/descriptions
- Placeholder: "Search skills..."

#### 2. Frequently Used Section
- Horizontal strip of up to 6 skill buttons, sorted by `useCount` descending
- Only shows skills with `useCount >= 1`
- Hidden entirely when no skills have been used yet
- Each button: skill name (full, not truncated) + small use-count badge
- Clicking fires `recordSkillLaunch` then navigates to `/chat?skill={name}`
- Section header: "Frequently Used"

#### 3. Category Accordion
- Each unique prefix becomes a full-width accordion row
- Row styling: glass-panel card matching existing CodePulse patterns (`bg-gray-800/50 border border-gray-700/50`)
- Row content: category name (title-cased), skill count badge, chevron icon (rotates on expand)
- Multiple categories can be open simultaneously
- Default state: all collapsed
- Categories sorted alphabetically

#### 4. Skill Buttons (inside expanded category)
- 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- Each button shows:
  - Skill name (without the category prefix, e.g., "NDA" not "legal-nda")
  - Description (one line, truncated with ellipsis)
  - Play/launch icon (right side)
- Hover: `lift-on-hover` effect matching existing patterns
- Click: fires `recordSkillLaunch`, navigates to `/chat?skill={fullSkillName}`

#### 5. Empty State
- Shown when `listSkills` returns empty array
- Message: "No skills discovered yet. Skills appear here after Astridr scans its skills directory."
- Subtle icon (Wand2, muted)

### Search Behavior
- Filters both category names and individual skill names/descriptions
- Matching skills inside collapsed categories cause those categories to auto-expand
- Categories with zero matching skills hide entirely
- Empty search result: "No skills match your search."
- Debounced at 150ms

---

## Chat Integration

### URL Parameter

Chat page (`/chat`) reads `?skill=` search param via `useSearchParams()`.

When `skill` param is present:
1. Pre-populate the chat input with `/{skillName}` (e.g., `/legal-nda`)
2. Show a dismissible badge/chip above the input: "Skill: legal-nda"
3. Do NOT auto-send — user hits enter when ready, can edit the message first
4. Clear the `skill` param from the URL after pre-fill (via `setSearchParams` with replace) to avoid re-triggering on refresh

### No Auto-Send Rationale
User stays in control. They may want to add context (e.g., `/legal-nda for Acme Corp partnership`) before sending. Astridr already has skill instructions in its system prompt, so the slash-prefixed message is sufficient to activate conversational skill execution.

---

## Component Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/pages/Skills.tsx` | Main page. `useQuery(api.registry.listSkills)`, client-side grouping/filtering, accordion state, search state |
| `src/components/skills/SkillCategoryAccordion.tsx` | Single category row with expand/collapse. Props: category name, skills array, isOpen, onToggle |
| `src/components/skills/SkillButton.tsx` | Individual skill launch button. Props: skill data, onLaunch callback |
| `src/components/skills/FrequentSkills.tsx` | Top strip of most-used skills. Props: full skills list (filters internally) |

### Modified Files

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `useCount` field to `skills` table |
| `convex/registry.ts` | Add `recordSkillLaunch` mutation |
| `src/pages/Chat.tsx` | Add `useSearchParams()` for `?skill=` pre-fill + badge chip |
| `src/layouts/DashboardLayout.tsx` | Add Skills item to COMMAND nav group |
| `src/App.tsx` | Add lazy-loaded `/skills` route |

### No Astridr Changes

The existing scan pipeline pushes skills to Convex. The chat WebSocket handles skill execution via conversational messages. No new Astridr endpoints or modifications needed.

---

## Styling

Follows existing CodePulse dark theme conventions:
- Backgrounds: `bg-gray-800/50`, `bg-gray-900`
- Borders: `border-gray-700/50`
- Text: `text-white` (headings), `text-gray-300` (body), `text-gray-500` (muted)
- Accents: `indigo-600` for active/hover states
- Cards: glass-panel pattern with subtle backdrop blur
- Animations: chevron rotation on accordion toggle, `lift-on-hover` on skill buttons
- Fonts: Cinzel for page title, Geist for body text

---

## Error Handling

- `SectionErrorBoundary` wraps the entire skills page content (matching existing pattern)
- If Convex query fails, error boundary catches and shows retry option
- `recordSkillLaunch` mutation failure: navigate to chat anyway (usage tracking is non-blocking)
- Search input: no API calls, purely client-side filtering

---

## Testing Strategy

- Component tests for `SkillButton`, `SkillCategoryAccordion`, `FrequentSkills`
- Page-level test for `Skills.tsx`: mock Convex query, verify grouping logic, search filtering, navigation on click
- Chat integration test: verify `?skill=` param pre-fills input and shows badge
- Convex mutation test: verify `recordSkillLaunch` increments `useCount` and updates `lastUsedAt`
