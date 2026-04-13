---
status: testing
phases: [01-ui-redesign, 58-infrastructure-layer]
source: [01-VERIFICATION.md, 58-VERIFICATION.md]
created: 2026-04-13
updated: 2026-04-13
---

# Consolidated Human UAT — CodePulse

All manual verification steps across completed phases. Work through sequentially — the dev server only needs to be started once.

## Prerequisites

- Terminal open in `C:\Users\mandr\codepulse`
- Run `npm run dev` to start the dev server
- Open http://localhost:5173 in your browser
- Astridhr WebSocket **not running** initially (tests start in disconnected state)

---

## Phase 1: UI Foundation

### Test 1.1 — Sharp Corners Everywhere

**Steps:**
1. Open http://localhost:5173
2. Navigate through Dashboard, Analytics, Agents, Executions pages
3. Inspect cards, panels, and containers visually
4. (Optional) DevTools: search for `rounded-xl` or `rounded-lg` on any card/container

**Expected:**
- [ ] No rounded corners on any card, panel, or container
- [ ] Only `rounded-sm` on StatusBadge pills is acceptable
- [ ] All card/container edges appear sharp (square corners)
- [ ] Consistent across all pages

**Result:** ___

---

### Test 1.2 — Chart Migration (CSS Flex Bars)

**Steps:**
1. Navigate to Analytics or any chart-heavy page
2. Inspect bar charts visually
3. Hover over individual bars
4. (Optional) DevTools Elements panel: confirm no `<svg>` from Recharts

**Expected:**
- [ ] Bar charts render as proportional CSS flex divs (not SVG)
- [ ] Bars use color from `--chart-bar` token
- [ ] Hovering a bar shows a label:value tooltip
- [ ] No Recharts SVG elements in DOM
- [ ] No empty states or placeholders where charts should be

**Result:** ___

---

### Test 1.3 — Sidebar Collapse Behavior

**Steps:**
1. Find the sidebar collapse toggle button
2. Click to collapse
3. Hover over any nav icon in collapsed state
4. Click toggle again to expand

**Expected:**
- [ ] Sidebar collapses to icon-only width (~48px)
- [ ] Icons remain visible in collapsed state
- [ ] Hovering any icon shows a Tooltip with the nav item label
- [ ] No text labels visible when collapsed
- [ ] Expanding restores full 240px sidebar with labels

**Result:** ___

---

### Test 1.4 — UI-08 Icon Audit (blocks requirement sign-off)

**Steps:**
1. With sidebar expanded, scan all nav items top to bottom
2. Collapse sidebar and scan again

**Expected:**
- [ ] Every nav item shows a recognizable Lucide icon at consistent size
- [ ] No ASCII characters (`>`, `*`, `-`) used as icons
- [ ] Icons are visually the same size across all items
- [ ] All 15 items present: Dashboard, Analytics, Agents, Executions, Build, Automation, Infrastructure, Security, Self-Healing, Memory, Capabilities, Briefings, Alerts, Profiles, Settings
- [ ] Icons render correctly in both expanded and collapsed states

**Result:** ___

---

## Phase 58: Infrastructure Layer

> Tests 58.1–58.3 start with Astridhr **disconnected**.
> Tests 58.4–58.7 require Astridhr **connected**.
> Tests 58.8–58.9 require **toggling** Astridhr on/off.

### Test 58.1 — Page Layout and MetricCards (disconnected)

**Steps:**
1. Ensure Astridhr WebSocket is **not running**
2. Navigate to the Capabilities page
3. Look at the MetricCard row at the top

**Expected:**
- [ ] MetricCard row shows 6 cards: MCP Servers, Plugins, Skills, Tools, Hooks, Commands
- [ ] Commands card is rightmost
- [ ] Commands card displays 0
- [ ] Grid uses 7-column layout on large screens

**Result:** ___

---

### Test 58.2 — CommandCatalogPanel Error State (disconnected)

**Steps:**
1. Still with Astridhr disconnected
2. Scroll down below the Discovered Tools section

**Expected:**
- [ ] A "COMMANDS" section heading is visible
- [ ] Panel shows error message: "Registry unavailable. Connect to Astridhr to load the command catalog." (or similar)
- [ ] No stale command data displayed
- [ ] No spinner (error state, not loading)

**Result:** ___

---

### Test 58.3 — Search Input Updates

**Steps:**
1. Look at the search box at the top of the Capabilities page

**Expected:**
- [ ] Placeholder text reads: "Search tools, skills, commands..."
- [ ] Search icon is a clean Lucide icon (small magnifying glass), not a chunky inline SVG

**Result:** ___

---

### Test 58.4 — Loading State (connect Astridhr)

**Steps:**
1. Start Astridhr so the WebSocket connects
2. Watch the Commands section during connection

**Expected:**
- [ ] A spinning icon (Loader2) appears briefly while waiting for first catalog push
- [ ] No error message during loading

**Result:** ___

---

### Test 58.5 — Ready State (commands loaded)

**Steps:**
1. After Astridhr connects and sends the catalog
2. Look at the Commands section

**Expected:**
- [ ] Commands MetricCard shows live count matching panel count
- [ ] Commands grouped by category (e.g., "core", "skills", "mcp")
- [ ] Each category has a header label
- [ ] Category filter pills appear above the command list
- [ ] "All (N)" pill is first and active by default
- [ ] Pills use square-ish corners (`rounded-sm`), not pill-shaped (`rounded-full`)

**Result:** ___

---

### Test 58.6 — Accordion Expand/Collapse

**Steps:**
1. Click any command row
2. Click a different command row
3. Click the currently expanded row

**Expected:**
- [ ] First click: row expands showing parameter details, source, full description
- [ ] Expand/collapse icons are Lucide ChevronDown/ChevronUp
- [ ] Second click on different row: first collapses, second expands (accordion)
- [ ] Third click on expanded row: it collapses (nothing expanded)
- [ ] Commands with no parameters show "No parameters"
- [ ] Commands with parameters show Name/Type/Required table

**Result:** ___

---

### Test 58.7 — Category Filter Pills

**Steps:**
1. Click a specific category pill (e.g., "core" or "skills")
2. Click the same pill again (or click "All")

**Expected:**
- [ ] Clicking a category shows only commands in that category
- [ ] Active pill has primary styling (highlighted)
- [ ] Clicking same category again resets to all
- [ ] "All (N)" also resets the filter

**Result:** ___

---

### Test 58.8 — Search Filtering

**Steps:**
1. Type a command name (or partial name) into the search box
2. Clear the search

**Expected:**
- [ ] Commands filter in real-time as you type
- [ ] Search matches name, description, category, and source
- [ ] Search is case-insensitive
- [ ] No matches shows "No commands match your search"
- [ ] Clearing search restores all commands

**Result:** ___

---

### Test 58.9 — WebSocket Disconnect Transition

**Steps:**
1. With commands loaded, stop Astridhr (kill the process)
2. Watch the Capabilities page

**Expected:**
- [ ] Commands MetricCard immediately shows 0
- [ ] CommandCatalogPanel switches to error state (no stale commands)
- [ ] Error message appears (same as Test 58.2)

**Result:** ___

---

### Test 58.10 — WebSocket Reconnect Transition

**Steps:**
1. With error state showing, restart Astridhr
2. Watch the Capabilities page

**Expected:**
- [ ] Loading spinner appears briefly
- [ ] Commands repopulate once catalog received
- [ ] MetricCard count updates to live count
- [ ] Panel returns to ready state with grouped commands

**Result:** ___

---

## Summary

| Phase | Tests | Passed | Issues | Pending |
|-------|-------|--------|--------|---------|
| 01 — UI Foundation | 4 | 0 | 0 | 4 |
| 58 — Infrastructure Layer | 10 | 0 | 0 | 10 |
| **Total** | **14** | **0** | **0** | **14** |

## Gaps

(none yet — populated after testing)

---

## After Testing

- Update results above (pass / issue per test)
- For any issues: describe what you saw in the Result field
- Then run: `/gsd-verify-work 1` and `/gsd-verify-work 58` to close phases
- Update REQUIREMENTS.md to close UI-08 if Test 1.4 passes
