---
phase: 58-infrastructure-layer
reviewed: 2026-04-13T18:30:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/CommandCatalogPanel.tsx
  - src/components/__tests__/CommandCatalogPanel.test.tsx
  - src/hooks/useCommandCatalog.ts
  - src/pages/Capabilities.tsx
  - src/types/commands.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering the CommandCatalog feature: type definitions, WebSocket hook, UI component, page integration, and unit tests. The implementation is solid overall -- the WebSocket hook validates incoming payloads with a proper type guard, the component handles all three connection states cleanly, and tests cover the key interaction paths. No critical or security issues found. One warning for an unguarded property access that can throw at runtime. Four info items covering a layout mismatch, dead test code, a loose test assertion, and missing keyboard accessibility on interactive elements.

Prior review findings (WR-01 unsafe cast, WR-02 null deref on `h.command`, WR-03 unstable `subscribeEvent`) have all been addressed in the current code.

## Warnings

### WR-01: Unguarded `h.hookType.toLowerCase()` can crash on missing field

**File:** `src/pages/Capabilities.tsx:144`

**Issue:** The `HooksPanel` filter guards `h.command` and `h.matcher` with `?? ""` fallbacks, but `h.hookType` on line 144 is accessed directly without a guard. Since `hooks` is typed `any[]`, if any hook record is missing the `hookType` field (partial ingest, schema migration, or test fixture), this line throws `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`.

**Fix:**
```typescript
// Current:
h.hookType.toLowerCase().includes(filter)

// Fix — add the same guard used for command and matcher:
(h.hookType ?? "").toLowerCase().includes(filter)
```

## Info

### IN-01: Grid declares 7 columns but only has 6 children

**File:** `src/pages/Capabilities.tsx:260`

**Issue:** The summary cards grid uses `lg:grid-cols-7` but contains only 6 `MetricCard` children (MCP Servers, Plugins, Skills, Tools, Hooks, Commands). On large screens this leaves one empty column slot on the right, creating a visual gap.

**Fix:** Change to `lg:grid-cols-6` to match the actual child count, or add a 7th metric card if one is planned.

```tsx
// Current:
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">

// Fix:
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
```

### IN-02: Dead code -- `runRow` variable computed but never used in test

**File:** `src/components/__tests__/CommandCatalogPanel.test.tsx:61-63`

**Issue:** The variable `runRow` is assigned via a three-branch fallback selector chain but is never referenced after assignment. The `fireEvent.click` on line 69 targets `screen.getByText("/run")` directly. This dead code may confuse future maintainers into thinking the click target is the row container.

**Fix:** Remove lines 61-63 entirely.

### IN-03: Loose accordion test assertion passes even when no detail panel opens

**File:** `src/components/__tests__/CommandCatalogPanel.test.tsx:91-92`

**Issue:** The assertion `expect(parameterSections.length).toBeLessThanOrEqual(1)` passes if zero "Parameters" headings are found, which would mean the `/pause` detail panel never opened at all. The test intends to verify accordion behavior (exactly one open), not that zero-or-one are open.

**Fix:**
```typescript
// Current (too loose):
expect(parameterSections.length).toBeLessThanOrEqual(1);

// Fix — verify exactly one panel is open:
expect(screen.getByText("No parameters")).toBeInTheDocument();
```

### IN-04: Interactive `<div>` elements lack keyboard accessibility

**File:** `src/components/CommandCatalogPanel.tsx:179-181`
**File:** `src/pages/Capabilities.tsx:70, 169`

**Issue:** Command, skill, and hook row divs use `onClick` handlers without `role="button"`, `tabIndex={0}`, or `onKeyDown`. Keyboard-only users cannot focus or activate these rows.

**Fix:** Add accessibility attributes to each interactive div, or replace with `<button>` elements:
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={() => handleRowClick(cmd.name)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleRowClick(cmd.name); }}
  className="..."
>
```

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
