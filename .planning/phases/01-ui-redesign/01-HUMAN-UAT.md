---
status: testing
phase: 01-ui-redesign
source: [01-VERIFICATION.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

# Phase 01: UI Foundation — Human UAT Testing Guide

**What was built:** Paperclip design system foundation — oklch color tokens, shadcn/ui primitives (New York style), shared UI components (FlexBarChart, EntityRow, SectionHeader, StatusBadge), sidebar redesign with grouped navigation, Recharts and R3F removal.

## Prerequisites

- Terminal open in `C:\Users\mandr\codepulse`
- Run `npm run dev` to start the dev server
- Open http://localhost:5173 in your browser

---

## Current Test

number: 1
name: Sharp Corners Everywhere
expected: |
  Zero rounded corners on cards, nav items, or containers. Only rounded-sm on StatusBadge pills is acceptable.
awaiting: user response

---

## Tests

### 1. Sharp Corners Everywhere

**Steps:**
1. Open http://localhost:5173
2. Navigate through Dashboard, Analytics, Agents, Executions pages
3. Inspect cards, panels, and containers visually
4. Optionally: open DevTools and search for `rounded-xl` or `rounded-lg` classes on any card/container element

**Expected:**
- [ ] No `rounded-xl`, `rounded-lg`, or large radius classes on any card, panel, or container
- [ ] Only `rounded-sm` on StatusBadge pills is acceptable
- [ ] All card/container edges appear sharp (square corners)
- [ ] Consistent across all pages visited

---

### 2. Chart Migration — CSS Flex Bars

**Steps:**
1. Navigate to Analytics or any chart-heavy page (Agents, Executions)
2. Inspect bar charts visually
3. Hover over individual bars
4. Optionally: open DevTools Elements panel and confirm no `<svg>` elements from Recharts

**Expected:**
- [ ] Bar charts render as proportional CSS flex divs (not SVG)
- [ ] Bars use color from `--chart-bar` token
- [ ] Hovering a bar shows a label:value tooltip
- [ ] No Recharts SVG elements visible in DOM inspector
- [ ] No chart component shows an empty state or placeholder where a chart should be

---

### 3. Sidebar Collapse Behavior

**Steps:**
1. Locate the sidebar collapse toggle button
2. Click it to collapse the sidebar
3. Hover over any nav icon in collapsed state
4. Click toggle again to expand

**Expected:**
- [ ] Sidebar collapses to icon-only width (~48px)
- [ ] Icons remain visible in collapsed state
- [ ] Hovering any icon shows a Tooltip with the nav item label
- [ ] No text labels visible when collapsed
- [ ] Expanding restores full 240px sidebar with labels

---

### 4. UI-08 Icon Audit (blocking requirement sign-off)

**Steps:**
1. With sidebar expanded, scan all nav items
2. Collapse sidebar and scan again
3. Verify all 15 expected nav items

**Expected:**
- [ ] Every nav item shows a recognizable Lucide icon at consistent 4x4 size
- [ ] No ASCII characters (`>`, `*`, `-`) used as icons
- [ ] Icons are visually the same size across all items
- [ ] All 15 items present: Dashboard, Analytics, Agents, Executions, Build, Automation, Infrastructure, Security, Self-Healing, Memory, Capabilities, Briefings, Alerts, Profiles, Settings
- [ ] Icons render correctly in both expanded and collapsed states

---

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

(none yet — populated after testing)
