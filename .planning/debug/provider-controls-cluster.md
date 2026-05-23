---
status: diagnosed
trigger: "Gaps 6/7/8: drag-to-reorder, enable/disable toggle, seed gateway defaults — all non-functional in ProviderControls"
created: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:01:00Z
---

## Current Focus

hypothesis: seedGateway.runSeed never inserts providerConfig rows — it only seeds agentProfiles and alertRuleCustom. Since ProviderControls gates all UI (cards, drag, toggle) on configs.length > 0, and no providerConfig rows ever exist, all three features are dead code.
test: searched entire convex/ directory for any mutation that inserts into providerConfig during seeding — found none
expecting: confirmed — zero providerConfig inserts in seed path
next_action: return diagnosis

## Symptoms

expected: |
  Gap 6: Drag provider card to new position, order persists on refresh
  Gap 7: Toggle provider off/on with visual feedback and toast confirmation
  Gap 8: Seed button disappears and provider cards appear after seeding
actual: |
  Gap 6: Drag doesn't work
  Gap 7: Toggle doesn't work
  Gap 8: Seed mutation fires (toast confirms), but UI doesn't update to show provider cards
errors: No specific error messages reported — features silently fail
reproduction: Open Settings page, attempt seed/drag/toggle
started: First UAT of these features

## Eliminated

- hypothesis: useProviderConfig hook subscribes to wrong query
  evidence: hook correctly queries api.providerConfig.list which queries the providerConfig table via by_priority index — this is correct
  timestamp: 2026-05-23T00:00:30Z

- hypothesis: Convex reactivity not working for providerConfig table
  evidence: The query is standard useQuery(api.providerConfig.list) — Convex reactivity is fine, the problem is the table is never populated
  timestamp: 2026-05-23T00:00:30Z

- hypothesis: ProviderControls component not mounted on Settings page
  evidence: Settings.tsx line 708 mounts <ProviderControls /> inside SectionErrorBoundary — component is correctly mounted
  timestamp: 2026-05-23T00:00:30Z

## Evidence

- timestamp: 2026-05-23T00:00:20Z
  checked: convex/seedGateway.ts — what tables does runSeed write to?
  found: runSeed schedules two internal mutations — seedSDKSpendAlert (writes alertRuleCustom) and seedGatewayProfiles (writes agentProfiles). Neither writes to providerConfig.
  implication: After seeding, providerConfig table has zero rows

- timestamp: 2026-05-23T00:00:25Z
  checked: src/components/ProviderControls.tsx line 231 — conditional rendering
  found: Component renders seed button when configs.length === 0, and DnD provider cards when configs.length > 0. Since providerConfig is never populated, UI is permanently stuck showing the seed button.
  implication: All three features (drag, toggle, cards) are gated on providerConfig rows existing — classic chicken-and-egg bug

- timestamp: 2026-05-23T00:00:28Z
  checked: convex/providerConfig.ts — all insert paths
  found: setEnabled and setPriority both upsert (create if missing), but these mutations are only callable from the provider card UI which only renders when configs already exist
  implication: No code path exists to bootstrap providerConfig rows — the only way to create them is through UI that requires them to already exist

- timestamp: 2026-05-23T00:00:35Z
  checked: grep for "providerConfig" across entire convex/ directory and full codebase
  found: No seed function, migration, or other code path creates initial providerConfig rows. The only inserts are in providerConfig.ts:setEnabled (line 26) and providerConfig.ts:setPriority (line 49), both unreachable from UI when table is empty.
  implication: Confirmed — this is a missing seed step, not a reactivity or rendering bug

- timestamp: 2026-05-23T00:00:38Z
  checked: src/lib/providers.ts — GATEWAY_PROVIDERS constant
  found: GATEWAY_PROVIDERS = ["claude-cli", "codex", "antigravity", "claude-sdk"]. These match the profiles in seedGateway.ts GATEWAY_PROFILES, confirming the intended 1:1 mapping between agent profiles and provider configs.
  implication: seedGateway should seed a providerConfig row for each GATEWAY_PROVIDER alongside the agentProfile

## Resolution

root_cause: |
  seedGateway.runSeed only seeds agentProfiles and alertRuleCustom tables — it never creates
  providerConfig rows. ProviderControls.tsx conditionally renders based on configs.length > 0
  (from useProviderConfig hook querying providerConfig table). Since the table is always empty
  after seeding, the UI permanently shows the seed button instead of provider cards. This is
  a single root cause that blocks all three gaps:
  - Gap 8: Seed succeeds but UI doesn't transition because providerConfig stays empty
  - Gap 6: Drag cards never render (gated on configs.length > 0)
  - Gap 7: Toggle buttons never render (gated on configs.length > 0)
fix:
verification:
files_changed: []
