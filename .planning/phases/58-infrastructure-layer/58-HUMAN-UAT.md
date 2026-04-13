---
status: partial
phase: 58-infrastructure-layer
source: [58-VERIFICATION.md]
started: 2026-04-13T13:00:00Z
updated: 2026-04-13T13:00:00Z
---

# Phase 58: Human UAT Testing Guide

**What was built:** A live command catalog section on the CodePulse Capabilities page, powered by Astridhr's WebSocket `commands.catalog` event. Includes a CommandCatalogPanel component with grouped/expandable commands, category filter pills, search integration, and three connection states (loading, ready, error).

## Prerequisites

- Terminal open in `C:\Users\mandr\codepulse`
- Run `npm run dev` to start the dev server
- Open http://localhost:5173 in your browser

---

## Current Test

[awaiting human testing]

---

## Tests

### 1. Page Layout and MetricCards (Astridhr disconnected)

**Steps:**
1. Make sure Astridhr WebSocket is **not running**
2. Navigate to the **Capabilities** page
3. Look at the MetricCard row at the top

**Expected:**
- [ ] MetricCard row shows 6 cards: MCP Servers, Plugins, Skills, Tools, Hooks, **Commands**
- [ ] Commands card is the rightmost card in the row
- [ ] Commands card displays **0** (since WebSocket is disconnected)
- [ ] Grid uses 7-column layout on large screens (`lg:grid-cols-7`)

---

### 2. CommandCatalogPanel — Error State (Astridhr disconnected)

**Steps:**
1. Still with Astridhr disconnected
2. Scroll down below the Discovered Tools section

**Expected:**
- [ ] A "COMMANDS" section heading is visible
- [ ] The panel shows an error message: **"Registry unavailable. Connect to Astridhr to load the command catalog."** (or similar)
- [ ] No stale command data is displayed
- [ ] No spinner is shown (error state, not loading)

---

### 3. Search Input Updates

**Steps:**
1. Look at the search box at the top of the Capabilities page

**Expected:**
- [ ] Placeholder text reads: **"Search tools, skills, commands..."**
- [ ] The search icon is a clean Lucide icon (small magnifying glass), NOT a chunky inline SVG

---

### 4. CommandCatalogPanel — Loading State (connect Astridhr)

**Steps:**
1. Start Astridhr (so the WebSocket connects)
2. Watch the Commands section during connection

**Expected:**
- [ ] A small spinning icon (Loader2) appears briefly while waiting for the first catalog push
- [ ] No error message during loading
- [ ] Commands MetricCard may still show 0 during loading

---

### 5. CommandCatalogPanel — Ready State (commands loaded)

**Steps:**
1. After Astridhr connects and sends the catalog payload
2. Look at the Commands section

**Expected:**
- [ ] Commands MetricCard now shows the **live count** of registered commands (matches the number in the panel)
- [ ] Commands are displayed in the panel, **grouped by category** (e.g., "core", "skills", "mcp")
- [ ] Each category has a header label
- [ ] Category filter pills appear above the command list
- [ ] "All (N)" pill is first and active by default
- [ ] Pills use **square-ish corners** (rounded-sm), NOT pill-shaped (rounded-full)

---

### 6. Accordion Expand/Collapse

**Steps:**
1. Click on any command row in the list
2. Then click on a **different** command row
3. Then click the currently expanded row

**Expected:**
- [ ] First click: row expands showing parameter details, source manifest, and full description
- [ ] Expand/collapse icons are Lucide ChevronDown/ChevronUp (not unicode triangles)
- [ ] Second click on different row: first row collapses, second row expands (**accordion** — only one open at a time)
- [ ] Third click on expanded row: it collapses (nothing expanded)
- [ ] If a command has no parameters: shows "No parameters" text
- [ ] If a command has parameters: shows a table with Name, Type, Required columns

---

### 7. Category Filter Pills

**Steps:**
1. Click a specific category pill (e.g., "core" or "skills")
2. Click the same pill again (or click "All")

**Expected:**
- [ ] Clicking a category shows **only** commands in that category
- [ ] Active pill has primary styling (highlighted)
- [ ] Clicking the same category again resets to showing all commands
- [ ] Clicking "All (N)" also resets the filter
- [ ] Command count updates in the "All" pill

---

### 8. Search Filtering

**Steps:**
1. Type a command name (or partial name) into the search box at the top
2. Clear the search

**Expected:**
- [ ] Commands in the panel filter in real-time as you type
- [ ] Search matches against: command name, description, category, and source
- [ ] Search is case-insensitive
- [ ] If search matches nothing: shows **"No commands match your search"**
- [ ] Clearing search restores all commands

---

### 9. WebSocket Disconnect State Transition

**Steps:**
1. With commands loaded and visible, **stop Astridhr** (kill the process)
2. Watch the Capabilities page

**Expected:**
- [ ] Commands MetricCard immediately shows **0**
- [ ] CommandCatalogPanel switches to **error state** (no stale commands displayed)
- [ ] Error message appears (same as Test 2)

---

### 10. WebSocket Reconnect State Transition

**Steps:**
1. With error state showing, **restart Astridhr**
2. Watch the Capabilities page

**Expected:**
- [ ] Loading spinner appears briefly
- [ ] Commands repopulate once catalog is received
- [ ] MetricCard count updates to live count
- [ ] Panel returns to ready state with grouped commands

---

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

(none yet — populated after testing)
