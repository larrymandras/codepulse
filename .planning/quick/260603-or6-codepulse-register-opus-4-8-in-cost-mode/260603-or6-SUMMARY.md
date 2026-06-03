---
phase: 260603-or6
plan: 01
subsystem: cost-accounting / agent-profiles
tags: [pricing, opus-4-8, bugfix, ui-dropdown]
requires: []
provides:
  - "Corrected Opus 4.x pricing ($5/$25 per MTok) in modelPricing.ts"
  - "claude-opus-4-7 and claude-opus-4-8 registered in PRICING table"
  - "Opus 4.8/4.7 selectable in agent profile model dropdown"
affects:
  - "Dashboard Opus spend reporting (was 3x inflated, now correct)"
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - src/lib/modelPricing.ts
    - src/components/AgentProfileEditor.tsx
decisions:
  - "Opus 4.x real pricing is $5 input / $25 output per MTok; the prior $15/$75 was Opus 3 pricing (latent 3x over-pricing bug)"
  - "No test asserted old Opus pricing, so no test changes were required — the bug was never test-covered"
metrics:
  duration: "~6 min"
  completed: 2026-06-03
  tasks: 2
  files: 2
---

# Phase 260603-or6 Plan 01: Register Opus 4.8 in Cost Model Summary

Corrected a latent 3x Opus over-pricing bug ($15/$75 → $5/$25 per MTok) and registered claude-opus-4-7 / claude-opus-4-8 in both the cost-accounting PRICING table and the agent-profile model dropdown.

## What Changed

### Task 1 — Fix Opus 4.x pricing + register 4.7/4.8 (`src/lib/modelPricing.ts`)
- `claude-opus-4-5` and `claude-opus-4-6` corrected from `$15/$75` (Opus 3 rates) to `$5/$25` per MTok — fixes a latent bug that inflated all Opus dashboard spend reporting by 3x.
- Added `claude-opus-4-7` and `claude-opus-4-8`, both at the correct `$5/$25` Opus 4.x rates, in the Opus group.
- All Sonnet, Haiku, GPT, Gemini, and `default` rows left exactly as-is. `estimateCost()` untouched.
- Commit: `92c04e3`

### Task 2 — Add Opus 4.8/4.7 to dropdown (`src/components/AgentProfileEditor.tsx`)
- `MODELS` array now leads with `claude-opus-4-8`, then `claude-opus-4-7`, then retains `claude-opus-4-6` and the rest.
- Default model state (`profile?.model ?? "claude-sonnet-4-6"`) left unchanged — Sonnet remains the default.
- Commit: `78f25d1`

## Verification

- **`npx tsc --noEmit`** — PASSED (exit 0, no type errors).
- **Pricing repro** (via `npx tsx`, importing `estimateCost`): all four Opus models return `input/MTok=5`, `output/MTok=25` — `OK` for opus-4-8, 4-7, 4-6, and 4-5. The 3x over-pricing is gone. Throwaway check was inline (no file left behind).
- **`npm test`** (full vitest suite) — PASSED: **77 test files passed, 582 tests passed, 0 failures** (18 files / 150 todo skipped, pre-existing).
  - A `useAction` mock console error appears in the log from `App.test.tsx` rendering `OperatorScoreCard`. It is caught by `SectionErrorBoundary`, fails NO test, and is entirely unrelated to this change (concerns `useOperatorScore.ts`, not pricing or the profile editor). Pre-existing test-harness noise.
- **`graphify update .`** — ran successfully (AST-only, no API cost): 24929 nodes / 48226 edges rebuilt. The `sst_font` extraction warning is a pre-existing unrelated node-field issue, not from these edits.

## Test Discipline Note

Per the constraint to update any test encoding the old wrong pricing: I grepped all `*.test.*` files for Opus / `15.00` / `75.00` / `estimateCost`. No test asserted the old `$15/$75` Opus pricing:
- `src/lib/modelPricing.test.ts` covers only GPT-4o, Gemini, billing-skip, and the unknown-model fallback (its `$3/$15` reference is the unchanged `default` Sonnet rate, not Opus).
- `convex/llm.test.ts` uses the string `"claude-opus-4"` only as an arg-shape literal and never calls `estimateCost`.

No test changes were required — the bug was never test-covered.

## Deviations from Plan

None — plan executed exactly as written.

## Out of Scope (untouched, per constraints)

`seedTeams.ts`, `seedGateway.ts`, `profiles.ts` seed data, the raw-fetch call sites (`memoryQuality.ts`, `briefings.ts`), `estimateCost()`, and all non-Anthropic pricing rows were not modified.

## Self-Check: PASSED

- `src/lib/modelPricing.ts` — FOUND, contains `claude-opus-4-8` at `$5/$25`.
- `src/components/AgentProfileEditor.tsx` — FOUND, MODELS includes `claude-opus-4-8` and `claude-opus-4-7`.
- Commit `92c04e3` — FOUND (Task 1).
- Commit `78f25d1` — FOUND (Task 2).
