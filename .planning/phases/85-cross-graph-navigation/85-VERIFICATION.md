---
phase: 85-cross-graph-navigation
verified: 2026-06-22T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Tool node with backing code/vault agent shows 'Owning agent' link"
    expected: "Selecting a tool node whose owning agent matches a code/vault snapshot label renders 'Owning agent: {label} →' in the RELATED ACROSS GRAPHS section. A tool with no match shows nothing."
    why_human: "Requires live Convex data (graph_snapshot + callGraphEdges) and a tool that actually has a backing agent node in the snapshot."
  - test: "Tool→agent navigation preserves Tool Galaxy state in ?from"
    expected: "Clicking the 'Owning agent' link navigates to /graphs?focus=<nodeId>&from=%2Ftool-galaxy%3Ffocus%3D<tool-id>. The return chip 'Back to Tool Galaxy' renders on the /graphs surface and returns to the Tool Galaxy with the tool still selected."
    why_human: "End-to-end multi-surface round-trip requires a browser with live data."
  - test: "Agent node with KG relationships shows 'N KG entities' link"
    expected: "Selecting a code/vault graph node that has KG relationships (agentId-scoped useKnowledgeGraph returns ≥1 entity) shows 'N KG entities →' in the RELATED ACROSS GRAPHS section. A node with zero KG entities shows nothing."
    why_human: "Requires live KG API (Ástríðr running) and at least one node with a known KG relationship."
  - test: "Agent→KG navigation and KG return chip"
    expected: "Clicking 'N KG entities →' navigates to /knowledge-graph?focus=<entityName>&lens=entity&hops=1&from=%2Fgraphs%3Ffocus%3D<nodeId>. KG switches to entity lens, fetches the entity, selects+centers it. 'Back to Code/Vault Graph' chip renders and returns to /graphs."
    why_human: "Requires live KG API, force-layout x/y assignment, and multi-surface round-trip verification."
  - test: "KG inbound focus: idb saved-state does not clobber the inbound override"
    expected: "Arriving at /knowledge-graph?focus=<entity>&lens=entity&hops=1 from a fresh session AND from a session that has prior saved idb state both result in the entity lens being active with the focused entity — saved-state restore never wins over the inbound override."
    why_human: "Requires testing with a browser that has pre-existing idb KG state from prior navigation."
  - test: "WR-02 deferred gap: focus centering may fire before force layout assigns x/y"
    expected: "On first arrival via ?focus, the node is selected (panel opens) even when centering doesn't fire because x/y are not yet set. The panel opens correctly regardless."
    why_human: "Race condition between useFocusParam one-shot apply and force-layout x/y assignment. The x != null guard degrades to selection-only. Needs visual confirmation that the panel opens even when centering is skipped."
  - test: "WR-04 deferred gap: KG inbound-focus effect ordering"
    expected: "The entity-lens override effect and useFocusParam center-on-resolve effect interact correctly — setLens/setFilter fires before useFocusParam tries to match node names, so the right entity is in the graph when matching occurs."
    why_human: "Effect ordering depends on React render cycle timing. Needs live testing to confirm the entity appears in kg.graph.nodes before useFocusParam fires onFocus."
  - test: "SC#3 zero-false-positive: no broken nav appears anywhere"
    expected: "Navigating to any graph surface with a ?focus value that does not match any node shows no error, no broken link, no dead button — just the default surface view."
    why_human: "Needs live testing of intentional mismatches: /tool-galaxy?focus=tool:NonExistent, /graphs?focus=graphify:codepulse:NonExistent, /knowledge-graph?focus=NonExistent&lens=entity&hops=1."
---

# Phase 85: Cross-Graph Navigation Verification Report

**Phase Goal:** Selecting a node in one graph surface can navigate to the corresponding entity in another surface where the data supports the link.
**Verified:** 2026-06-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting a tool node in Tool Galaxy navigates to (or highlights) its owning agent in the code/vault graph where a matching node exists | ✓ VERIFIED (code) / ? UAT required | `focusKeysMatch(owningAgentName, cv.label)` at ToolGalaxy.tsx:144; `buildFocusUrl({ surface: "graphs", nodeId: ownerMatch.id }, fromGalaxyUrl)` at L439-444; `ownerMatch &&` gate at L423 ensures link only appears on confirmed match |
| 2 | Selecting an agent node navigates to related KG entities where a `{agent}` relationship exists in the KG | ✓ VERIFIED (code) / ? UAT required | `useKnowledgeGraph()` called in GraphContent; `kg.setFilter("agentId", normalizeFocusKey(node.label))` at CodeVaultGraph.tsx:166; `firstKgEntity && kgCount > 0` gate at L612 ensures no link without confirmed entities; `buildFocusUrl({ surface: "knowledge-graph", entityName: firstKgEntity.name, hops: 1 }, ...)` at L624-630 |
| 3 | Cross-graph links that have no data backing are silently absent — no broken nav or dead links | ✓ VERIFIED (code) / ? UAT required | Three independent SC#3 gates confirmed: (a) `ownerMatch &&` in ToolGalaxy; (b) `firstKgEntity && kgCount > 0` in CodeVaultGraph; (c) `useFocusParam` silent no-op when `nodes.find(...)` returns undefined |
| 4 | Navigation preserves the originating graph's state so the operator can return to their prior context | ✓ VERIFIED (code) / ? UAT required | All three surfaces: (a) ToolGalaxy builds `fromGalaxyUrl = "/tool-galaxy?focus=" + encodeURIComponent(selectedNode.id)` before navigating; (b) CodeVaultGraph passes `/graphs?focus=${encodeURIComponent(selectedNodeId)}` as fromUrl; (c) KnowledgeGraph passes `fromParam` through `KGDetailsPanel` as `returnTo` prop; `decodeFromParam` same-origin guard (T-85-01) confirmed in focus-url.ts:89-112 |

**Score:** 4/4 truths verified at code level. All require human UAT on live data to confirm behavioral correctness.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/focus-url.ts` | FocusTarget, buildFocusUrl, normalizeFocusKey, focusKeysMatch, encodeFromParam, decodeFromParam | ✓ VERIFIED | All 6 exports present; no React import; no fetch(); 112 lines; T-85-01 guard at L89-112 with backslash check (WR-01) |
| `src/lib/focus-url.test.ts` | Unit coverage of URL building, normalization, match, and from-param same-origin guard | ✓ VERIFIED | Exists per 85-01-SUMMARY (25 tests, verified passing) |
| `src/hooks/useFocusParam.ts` | Generic on-mount focus-param hook | ✓ VERIFIED | Exists; imports decodeFromParam from ../lib/focus-url at L15; useRef(false) one-shot guard at L52; nodes === undefined early return at L60 |
| `src/hooks/useFocusParam.test.ts` | Hook coverage: loading tolerance, single apply, silent no-op on absent | ✓ VERIFIED | Exists per 85-01-SUMMARY (9 tests, verified passing) |
| `src/pages/ToolGalaxy.tsx` | Tool→agent outbound link, inbound focus, return chip | ✓ VERIFIED | RELATED ACROSS GRAPHS at L430; Owning agent: at L449; focusKeysMatch( at L144; buildFocusUrl({ surface: "graphs" at L441; aria-label="Related across graphs navigation links" at L427; useFocusParam( at L150; fromParam && at L278; ChevronLeft import at L11; navigate(fromParam) at L282 |
| `src/components/graph/CodeVaultGraph.tsx` | Agent→KG outbound link, inbound focus, return chip | ✓ VERIFIED | RELATED ACROSS GRAPHS at L617; KG entit at L637; useKnowledgeGraph( at L157; buildFocusUrl({ surface: "knowledge-graph" at L624; aria-label="Related across graphs navigation links" at L615; useFocusParam( at L143; fromParam && returnLabel at L496; ChevronLeft import at L29; navigate(fromParam) at L500 |
| `src/pages/KnowledgeGraph.tsx` | Inbound entity-lens focus handling + return chip | ✓ VERIFIED | searchParams.get("focus") at L73; setLens("entity") at L102; setFilter("entityName" at L103; appliedFocusRef at L82; hydratedRef at L80; useFocusParam( at L113; kg.selectNode( at L117; fgRef.current?.centerAt( at L120; NO "RELATED ACROSS GRAPHS" string (KG is destination-only) |
| `src/components/kg/KGDetailsPanel.tsx` | Return chip in all panel states | ✓ VERIFIED | returnTo prop at L15; returnLabel prop at L17; onReturnNav prop at L19; PanelShell renders chip at L145-156; no-selection branch renders chip when returnTo && onReturnNav at L201-221; ChevronLeft at L4; "Back to" at L153; border-l-2 border-primary/40 at L151; aria-label="Return to {label}" at L148; SectionErrorBoundary wrap at L146 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ToolGalaxy.tsx | focus-url.ts | focusKeysMatch / buildFocusUrl | ✓ WIRED | Import at L32; usage at L144 (focusKeysMatch) and L441 (buildFocusUrl) |
| ToolGalaxy.tsx | useFocusParam.ts | useFocusParam({ nodes, getId, onFocus }) | ✓ WIRED | Import at L34; call at L150 with centerAt+zoom in onFocus |
| ToolGalaxy.tsx | useProjectGraph.ts | codeVaultNodes for owning-agent eager match | ✓ WIRED | Import at L33; useProjectGraph() at L123; codeVaultNodes at L124 |
| CodeVaultGraph.tsx | focus-url.ts | buildFocusUrl / normalizeFocusKey | ✓ WIRED | Import at L42; buildFocusUrl at L624; normalizeFocusKey at L166 |
| CodeVaultGraph.tsx | useFocusParam.ts | useFocusParam one-shot focus | ✓ WIRED | Import at L41; call at L143 with setSelectedNodeId+centerAt+zoom in onFocus |
| CodeVaultGraph.tsx | useKnowledgeGraph.ts | agentId-scoped overview for eager KG match | ✓ WIRED | Import at L40; useKnowledgeGraph() at L157; setFilter("agentId",...) at L166 |
| KnowledgeGraph.tsx | useKnowledgeGraph.ts | setLens/setFilter for entity-lens override | ✓ WIRED | kg.setLens("entity") at L102; kg.setFilter("entityName",...) at L103 |
| KnowledgeGraph.tsx | useFocusParam.ts | center-on-resolve + fromParam | ✓ WIRED | Import at L14; useFocusParam call at L113 with kg.selectNode+centerAt+zoom |
| KGDetailsPanel.tsx | KnowledgeGraph.tsx | returnTo/returnLabel/onReturnNav props | ✓ WIRED | Props passed at KnowledgeGraph.tsx:340-342; PanelShell uses returnTo+onReturnNav at L145,149 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| ToolGalaxy.tsx RELATED ACROSS GRAPHS | ownerMatch | codeVaultNodes from useProjectGraph() → Convex query | Yes — useProjectGraph returns live Convex snapshot nodes | ✓ FLOWING (when snapshot has data) |
| CodeVaultGraph.tsx RELATED ACROSS GRAPHS | kgEntities / firstKgEntity | kg.graph.nodes from useKnowledgeGraph() → Ástríðr /api/kg | Yes — agentId-scoped overview fetch; returns [] only on error/loading | ✓ FLOWING (when KG API online) |
| KnowledgeGraph.tsx entity-lens | kg.graph.nodes | useKnowledgeGraph() → setFilter("entityName") → /api/kg/entity | Yes — name-driven entity fetch is triggered by setFilter post-hydration | ✓ FLOWING (when KG API online) |
| KGDetailsPanel.tsx return chip | returnTo | fromParam from useFocusParam → decodeFromParam → searchParams | Yes — real URL param, same-origin guarded | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cross-graph navigation is UI-driven and requires a running app + live Convex + live KG API. No meaningful CLI checks exist for this feature. All behavioral verification routes to human UAT (Step 8).

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes exist or were declared for this phase. The phase's own verification gates are tsc clean + Vitest suite + human UAT.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GH-04 | 85-01, 85-02, 85-03, 85-04 | Cross-graph navigation — selecting a tool → its owning agent → a related KG entity deep-links across the graph surfaces where the data supports it | ✓ SATISFIED (code) / ? live UAT required | All three surface-to-surface links implemented and wired. SC#3 zero-false-positive gate confirmed in code. buildFocusUrl + useFocusParam + decodeFromParam form the complete deep-link infrastructure. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX debt markers found in any modified file | — | — |
| ToolGalaxy.tsx | 88 | `fgRef = useRef<any>(null)` — untyped ref (pre-existing) | Info | Not a phase artifact; ref is typed as `any` as a workaround for react-force-graph-2d's missing TypeScript types. Does not affect behavior. |

### Human Verification Required

The following items require human testing on a live app with real Convex data and Ástríðr KG API accessible.

#### 1. Tool→Agent Forward Link (SC#1)

**Test:** Open /tool-galaxy, click a tool node whose owning agent appears in the code/vault snapshot.
**Expected:** A "RELATED ACROSS GRAPHS" section appears with "Owning agent: {label} →". Clicking it navigates to /graphs?focus=<codeVaultNodeId>&from=<encoded Galaxy URL>.
**Why human:** Requires Convex callGraphEdges data + graph_snapshot with agent nodes.

#### 2. SC#3 Tool Galaxy — no false positive

**Test:** Click a tool node that has no owning agent in the code/vault snapshot (or one with no agent link at all).
**Expected:** No RELATED ACROSS GRAPHS section appears. No error.
**Why human:** Needs data that intentionally lacks a backing agent node.

#### 3. Inbound ?focus on Tool Galaxy

**Test:** Navigate directly to /tool-galaxy?focus=tool:Read (substituting a real tool id).
**Expected:** The Read tool node is selected and centered. If ?from is also present, the return chip renders.
**Why human:** Force-layout x/y assignment timing (WR-02 deferred gap).

#### 4. Agent→KG Forward Link (SC#2)

**Test:** Open /graphs, select a code/vault node that has KG relationships.
**Expected:** "N KG entities →" appears in RELATED ACROSS GRAPHS. Clicking navigates to /knowledge-graph?focus=<firstEntityName>&lens=entity&hops=1&from=<encoded /graphs URL>.
**Why human:** Requires live KG API + a node with confirmed KG relationships.

#### 5. SC#3 CodeVaultGraph — no false positive when KG offline

**Test:** Disconnect Ástríðr (or set VITE_ASTRIDR_API_URL to an unreachable URL), open /graphs, select any node.
**Expected:** No RELATED ACROSS GRAPHS section appears. No error banner from the KG link section.
**Why human:** Requires intentionally making the KG API unavailable.

#### 6. KG inbound entity-lens focus (SC#2 destination side)

**Test:** Navigate to /knowledge-graph?focus=<realEntityName>&lens=entity&hops=1.
**Expected:** KG switches to entity lens, fetches that entity's neighborhood, entity node is selected and centered.
**Why human:** Requires live KG API + known entity name.

#### 7. Post-hydration ordering — saved idb state does not clobber inbound override

**Test:** In a browser that has prior idb KG state (from previous session), navigate to /knowledge-graph?focus=<entity>&lens=entity&hops=1.
**Expected:** Entity lens is active with the focused entity, not the prior saved lens/filters.
**Why human:** Requires a browser with existing idb KG state.

#### 8. Return chip round-trip (SC#4)

**Test:** Follow the full chain: Tool Galaxy → /graphs (via Owning agent link) → "Back to Tool Galaxy" chip → Tool Galaxy returns to correct ?focus state. Separately: /graphs → /knowledge-graph (via KG entities link) → "Back to Code/Vault Graph" chip.
**Expected:** Round-trip completes; originating surface re-opens with the prior selection encoded in ?focus (as the return URL was built with the selected node in the from param).
**Why human:** Multi-surface round-trip requiring live data and browser navigation.

#### 9. WR-02 deferred: force-layout x/y race condition

**Test:** Navigate to /graphs?focus=<nodeId> or /tool-galaxy?focus=<nodeId> immediately on page load (before force simulation stabilizes).
**Expected:** Node is at minimum selected (panel opens) even if centering is skipped due to x/y being null at the time of focus application.
**Why human:** Timing-dependent race condition between useFocusParam one-shot and force-layout.

#### 10. WR-04 deferred: KG inbound-focus effect ordering

**Test:** Navigate to /knowledge-graph?focus=<entity>&lens=entity&hops=1 and watch the sequence: entity-lens override fires, entity fetch completes, useFocusParam matches and centers.
**Expected:** Entity node appears in the graph and is selected+centered without the panel showing a stale/wrong entity.
**Why human:** React effect ordering; needs live timing observation.

### Gaps Summary

No code-level gaps found. All four success criteria are implemented and wired in the codebase:

- SC#1 (tool→agent): ToolGalaxy RELATED ACROSS GRAPHS section with focusKeysMatch eager gate and buildFocusUrl navigation — WIRED.
- SC#2 (agent→KG): CodeVaultGraph agentId-scoped useKnowledgeGraph + firstKgEntity gate and buildFocusUrl navigation — WIRED. KnowledgeGraph post-hydration setLens/setFilter override — WIRED.
- SC#3 (zero false positives): Three independent gates confirmed in code: ownerMatch &&, firstKgEntity && kgCount > 0, useFocusParam silent no-op. decodeFromParam T-85-01 guard with backslash defense (WR-01) — WIRED.
- SC#4 (state preservation): All three surfaces encode their selection into the from param before navigating; all three surfaces render the return chip on fromParam; KGDetailsPanel chip visible in all panel states including not-found arrival — WIRED.

Two UX-robustness items from the code review (WR-02, WR-04) are deferred by design — noted above as human verification items, not blockers. Selection still works in both cases; centering degrades gracefully.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier)_
