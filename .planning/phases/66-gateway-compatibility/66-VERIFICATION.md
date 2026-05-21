---
phase: 66-gateway-compatibility
verified: 2026-05-21T23:00:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Gateway task events route to toolExecutions and gatewayTasks (not generic events table)"
    addressed_in: "Phase 68"
    evidence: "Phase 68 scope explicitly defines new gatewayTasks table. 66-RESEARCH.md line 15: 'This phase does NOT introduce a gatewayTasks table — that belongs to Phase 68 (Gateway Observability).'"
human_verification:
  - test: "Verify ProviderHealthPanel renders all 7 provider cards in browser"
    expected: "7 provider cards visible — Anthropic Direct, OpenRouter, Ollama, Claude CLI, Codex CLI, Antigravity CLI, Claude SDK. Legacy providers with data show sparkline/latency/success. Gateway providers show 'No data yet'. Grid is 1-col mobile, 2-col sm, 4-col lg."
    why_human: "React component rendering and responsive grid layout require a browser. TypeScript compiles but visual correctness cannot be verified programmatically."
---

# Phase 66: Gateway Compatibility Verification Report

**Phase Goal:** CodePulse correctly ingests, routes, and attributes telemetry events from the multi-provider CLI Gateway without data loss or misattribution
**Verified:** 2026-05-21T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Provider registry exports ALL_PROVIDERS containing all 7 provider names | VERIFIED | `convex/lib/providers.ts` line 20: `ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS]` — 3 legacy + 4 gateway = 7 total |
| 2 | sessions table schema includes optional provider field with by_provider index | VERIFIED | `convex/schema.ts` lines 46, 51: `provider: v.optional(v.string())` + `.index("by_provider", ["provider"])` |
| 3 | toolExecutions table schema includes optional provider field with by_provider index | VERIFIED | `convex/schema.ts` lines 551, 556: `provider: v.optional(v.string())` + `.index("by_provider", ["provider"])` |
| 4 | providerHealth table schema includes authenticated, billingType, quotaRemaining optional fields | VERIFIED | `convex/schema.ts` lines 771-773: all three optional fields present |
| 5 | OTel api_request events without provider default to 'unknown' not 'anthropic' | VERIFIED | `convex/otelLogs.ts` line 182: `getAttr(attrs, "provider") ?? "unknown"` — zero instances of `?? "anthropic"` in file |
| 6 | OTel cost.usage and token.usage events without provider default to 'unknown' | VERIFIED | `convex/otelMetrics.ts` lines 170, 191: both cases use `?? "unknown"` — zero instances of `?? "anthropic"` in file |
| 7 | console.warn fires when provider attribute is missing from OTel events | VERIFIED | `convex/otelLogs.ts` line 184 and `convex/otelMetrics.ts` lines 172, 193: three warn calls confirmed |
| 8 | gateway.task_completed events route to toolExecutions with provider field set | VERIFIED | `convex/otelLogs.ts` lines 236-250, `convex/runtimeIngest.ts` lines 777-793: both paths route to `api.toolExecutions.insert` with `provider` field |
| 9 | gateway.task_failed events route to toolExecutions with success=false | VERIFIED | `convex/otelLogs.ts` lines 253-263, `convex/runtimeIngest.ts` lines 795-807: `success: false` confirmed in both paths |
| 10 | gateway.routing_decision events route to events.ingest | VERIFIED | `convex/otelLogs.ts` lines 278-287, `convex/runtimeIngest.ts` lines 822-832: routes to `api.events.ingest` with `eventType: "gateway.routing_decision"` |
| 11 | Existing tool_result and api_request routing works unchanged | VERIFIED | `convex/otelLogs.ts` lines 164-178: tool_result case has no provider field (backward compat preserved); switch cases unchanged |
| 12 | ProviderHealthPanel renders cards for all 7 providers from registry | VERIFIED (code) | `src/components/ProviderHealthPanel.tsx` line 142: `ALL_PROVIDERS.map((p) => <ProviderCard key={p}.../>)` — no hardcoded array |
| 13 | CLIGatewayTool emits gateway.task_completed/failed telemetry | VERIFIED | `astridr-repo/astridr/tools/cli_gateway.py` lines 172-213: both branches confirmed with fire-and-forget guard |
| 14 | ProviderHealthPanel renders correct visual UI with 7 cards | UNCERTAIN | Code is correct; visual rendering requires human browser check (Plan 03 Task 2 was a blocking human-verify checkpoint) |

**Score:** 13/14 truths verified (1 deferred to Phase 68 for gatewayTasks table, 1 requiring human visual check)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Gateway task events route to gatewayTasks table | Phase 68 | Phase 68 scope: "New `gatewayTasks` table (`taskId`, `sessionId`, `provider`, `billingType`, `status`, `durationSeconds`, `error`, `timestamp`)". 66-RESEARCH.md explicitly scopes this out: "This phase does NOT introduce a `gatewayTasks` table — that belongs to Phase 68." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/lib/providers.ts` | Central provider registry | VERIFIED | Exports GATEWAY_PROVIDERS (4), LEGACY_PROVIDERS (3), ALL_PROVIDERS (7), type aliases |
| `src/lib/providers.ts` | Frontend mirror of provider registry | VERIFIED | Mirrors backend registry + adds PROVIDER_DISPLAY_NAMES mapping |
| `convex/__tests__/providerRegistry.test.ts` | Test stubs for provider registry | VERIFIED | 4 active passing tests + 4 todo stubs |
| `convex/__tests__/otelLogs.test.ts` | Tests for OTel default fix and gateway routing | VERIFIED | 10 passing tests covering GW-01, GW-02, GW-04 (no it.todo remaining) |
| `convex/otelLogs.ts` | OTel default fix + gateway.* routing cases | VERIFIED | All 4 gateway event types handled, `?? "anthropic"` eliminated |
| `convex/otelMetrics.ts` | OTel default fix for cost and token metrics | VERIFIED | Two `?? "unknown"` replacements with console.warn confirmed |
| `convex/runtimeIngest.ts` | Gateway event routing via runtime-ingest | VERIFIED | All 4 gateway event types handled (lines 777-832) |
| `src/components/ProviderHealthPanel.tsx` | Dynamic provider health panel with all 7 providers | VERIFIED (code) | Uses ALL_PROVIDERS.map, PROVIDER_DISPLAY_NAMES, conditional auth/billing/quota fields |
| `astridr-repo/astridr/tools/cli_gateway.py` | Telemetry emission after task completion/failure | VERIFIED | gateway.task_completed and gateway.task_failed with fire-and-forget guard, get_session_context(), duration_ms unit conversion |
| `hooks/README.md` | Documentation of hook system vs gateway event path | VERIFIED | Gateway Events section present, documents codepulse-hook.mjs vs runtime-ingest paths |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/providerHealth.ts` | `convex/lib/providers.ts` | `import ALL_PROVIDERS` | WIRED | Line 3: `import { ALL_PROVIDERS } from "./lib/providers"` — line 64: used in `const providers = ALL_PROVIDERS` |
| `convex/toolExecutions.ts` | `convex/schema.ts` | provider field in schema matches mutation arg | WIRED | Schema line 551 + mutation line 13 both declare `provider: v.optional(v.string())` |
| `convex/otelLogs.ts` | `convex/toolExecutions.ts` | `api.toolExecutions.insert` with provider arg | WIRED | Lines 238-245: insert call includes `provider` field in gateway cases |
| `convex/runtimeIngest.ts` | `convex/toolExecutions.ts` | `api.toolExecutions.insert` with provider arg | WIRED | Lines 781-788: insert call includes `provider` field |
| `src/components/ProviderHealthPanel.tsx` | `src/lib/providers.ts` | `import ALL_PROVIDERS, PROVIDER_DISPLAY_NAMES` | WIRED | Line 6: import confirmed, both used in component body |
| `src/components/ProviderHealthPanel.tsx` | `convex/providerHealth.ts` | `useProviderHealth` hook → `api.providerHealth.latest` | WIRED | Line 2 import + line 134 usage confirmed |
| `astridr-repo/astridr/tools/cli_gateway.py` | `convex/runtimeIngest.ts` | `t.send()` → POST /runtime-ingest → gateway.task_completed case | WIRED | cli_gateway.py lines 178-186 emit event; runtimeIngest.ts line 777 handles it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/components/ProviderHealthPanel.tsx` | `healthData` via `useProviderHealth()` | `api.providerHealth.latest` Convex query | Yes — queries DB for all 7 providers from ALL_PROVIDERS registry | FLOWING |
| `convex/otelLogs.ts` gateway cases | `provider` from OTel attrs | `getAttr(attrs, "provider")` from inbound event | Yes — reads live OTel event data, defaults to "unknown" only when genuinely absent | FLOWING |
| `convex/runtimeIngest.ts` gateway cases | `provider` from `data as any` | JSON body from `t.send()` in CLIGatewayTool | Yes — passes through provider from gateway's TaskResponse | FLOWING |

### Behavioral Spot-Checks

Step 7b: Cannot run app servers during verification. Checking what is statically verifiable.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| ALL_PROVIDERS has 7 members | Registry definition: 3 LEGACY + 4 GATEWAY | Confirmed by static read | PASS |
| otelLogs.ts contains no `?? "anthropic"` | Grep for "anthropic" in otelLogs.ts | 0 matches | PASS |
| otelMetrics.ts contains no `?? "anthropic"` | Grep for "anthropic" in otelMetrics.ts | 0 matches | PASS |
| runtimeIngest.ts handles all 4 gateway event types | Grep for each case | Lines 777, 795, 809, 822 confirmed | PASS |
| cli_gateway.py has fire-and-forget guard | `except Exception: pass` present | Lines 187, 210 confirmed | PASS |
| ProviderHealthPanel uses dynamic registry | `ALL_PROVIDERS.map` present | Line 142 confirmed | PASS |
| Visual rendering of 7 cards | Browser required | N/A | SKIP — human needed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| GW-01 | 66-01, 66-02, 66-04 | OTel provider default fix — `?? "anthropic"` → `?? "unknown"` with warn | SATISFIED | otelLogs.ts line 182, otelMetrics.ts lines 170/191 all use `?? "unknown"`; console.warn fires on all 3 |
| GW-02 | 66-02, 66-04 | Gateway event routing to toolExecutions | SATISFIED | All 4 gateway event types handled in both otelLogs.ts and runtimeIngest.ts; CLIGatewayTool emits events |
| GW-03 | 66-01, 66-03 | Central provider registry + dynamic ProviderHealthPanel | SATISFIED | convex/lib/providers.ts and src/lib/providers.ts exist; ProviderHealthPanel uses ALL_PROVIDERS.map |
| GW-04 | 66-01, 66-02 | Backward compatibility — existing telemetry unchanged | SATISFIED | tool_result case in otelLogs.ts (line 164-178) has no provider field; passes without it per optional schema |

**Requirement ID gap:** GW-01 through GW-04 are referenced in PLAN frontmatter and ROADMAP.md but have NO entries in `.planning/REQUIREMENTS.md`. The traceability table in REQUIREMENTS.md ends at Phase 65. This is a documentation gap — the requirements exist functionally in ROADMAP Phase 66 success criteria but are not catalogued in the canonical requirements file.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `convex/__tests__/providerRegistry.test.ts` | 35-42 | 4 `it.todo` stubs remain | Info | These are intentional Wave 0 stubs for mutation/DB tests that require a Convex test environment; they do not indicate missing logic |
| `astridr-repo/astridr/tools/cli_gateway.py` | 187, 210 | `except Exception: pass` | Info | Intentional fire-and-forget design — telemetry failure must not block task execution (T-66-08) |

No blockers. All `return null`, empty array, or stub patterns identified are either:
- Intentional test scaffolds (`.todo` stubs in test files)
- Intentional safety patterns (`except Exception: pass` in telemetry)

### Human Verification Required

#### 1. ProviderHealthPanel Visual Rendering

**Test:** Start the dev server (`npm run dev` at Vite port 5173) and Convex backend (`npm run dev:backend`). Navigate to the page containing the Provider Health panel.

**Expected:**
- 7 provider cards are visible: Anthropic Direct, OpenRouter, Ollama, Claude CLI, Codex CLI, Antigravity CLI, Claude SDK
- Legacy providers with existing data show success rate, latency EMA, and sparkline
- Gateway providers (Claude CLI, Codex CLI, Antigravity CLI, Claude SDK) show "No data yet" in muted gray
- All cards show gray status dot when no data present
- Grid layout responds: 1 column on narrow, 2 columns on sm, 4 columns on lg
- Provider names display as human-readable labels (not raw keys like "claude-cli")
- Cards with `authenticated: false` show yellow dot; cards with `authenticated: true` show green dot

**Why human:** This is the blocking checkpoint from Plan 03 Task 2. React component rendering, Tailwind responsive grid, and conditional field display require a browser. TypeScript compiles clean but visual correctness — correct card count, display name resolution, grid column behavior — cannot be verified programmatically.

### Gaps Summary

No functional gaps found. The `gatewayTasks` table mentioned in ROADMAP Success Criterion 2 is explicitly deferred to Phase 68 per the Phase 66 RESEARCH.md scoping document — this is a known, intentional deferral, not an oversight.

The one outstanding item is the human visual verification of ProviderHealthPanel, which was the blocking checkpoint in Plan 03 Task 2 and was not completed before phase close.

**Requirements documentation gap (WARNING):** GW-01 through GW-04 are not catalogued in `.planning/REQUIREMENTS.md`. They exist in ROADMAP Phase 66 success criteria but the traceability table in REQUIREMENTS.md ends at Phase 65. Recommend adding GW-01..04 entries to REQUIREMENTS.md and updating the traceability table.

---

_Verified: 2026-05-21T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
