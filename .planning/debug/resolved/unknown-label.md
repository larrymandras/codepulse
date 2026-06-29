---
status: resolved
trigger: "Sessions showing 'unknown' instead of muted 'untagged'"
created: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Current Focus

hypothesis: "SessionComparison.tsx line 56 renders literal 'unknown' for null/undefined model via nullish coalescing fallback"
test: "Confirmed by reading source code directly"
expecting: "N/A — root cause confirmed"
next_action: "Return diagnosis"

## Symptoms

expected: Sessions without model show muted "untagged" label instead of "unknown"
actual: Session list shows "unknown" in plain text for sessions without a model/provider
errors: none (cosmetic issue)
reproduction: View session list with sessions that have no model/provider data
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-05-23T00:01:00Z
  checked: Codebase-wide grep for string literal "unknown" in .tsx files
  found: SessionComparison.tsx line 56 uses `{session.model ?? "unknown"}` — renders plain "unknown" text in unstyled <td> when model is null/undefined
  implication: This is the primary source of the "unknown" label in the session list

- timestamp: 2026-05-23T00:01:30Z
  checked: Other session components for contrast
  found: |
    - ActiveSessions.tsx line 56 uses `{session.model ?? "N/A"}` (different fallback, not "unknown")
    - SessionHeader.tsx line 36 uses `{session.model ?? "—"}` (em dash, not "unknown")
    - Neither uses muted/dimmed styling for the fallback either
  implication: Only SessionComparison.tsx produces the "unknown" label. The other components use different fallbacks but also lack muted styling.

- timestamp: 2026-05-23T00:02:00Z
  checked: LlmProviderPanel.tsx line 12 and TokenWaterfall.tsx line 42
  found: Both use `provider ?? "unknown"` but these are for data grouping keys, not user-visible session labels — they affect chart/panel section headers, not the session list model column
  implication: These are separate from the reported issue (session list model column)

- timestamp: 2026-05-23T00:02:30Z
  checked: Styling at SessionComparison.tsx line 55
  found: The "unknown" text is rendered inside `<td className="py-2 px-3 text-gray-300 text-xs">` — same styling as any normal model name, no visual distinction for the fallback value
  implication: The fallback is displayed identically to actual model names, with no muting or visual differentiation

## Resolution

root_cause: |
  SessionComparison.tsx line 56 uses `{session.model ?? "unknown"}` as the fallback for sessions without a model.
  This renders the literal string "unknown" in plain text (text-gray-300) — identical styling to real model names.
  The user expects a muted "untagged" label instead.
  
  Additionally, ActiveSessions.tsx uses "N/A" and SessionHeader.tsx uses "—" as their own fallbacks —
  these are inconsistent with each other and none use muted/dimmed styling.

fix: Replaced `session.model ?? "unknown"` with ternary rendering muted italic "untagged" span (Phase 69-05 gap closure)
verification: SessionComparison.tsx line 68 confirmed — no "unknown" string in file
files_changed: [src/components/SessionComparison.tsx]
