---
phase: 84
slug: graphs-hub-code-vault-render
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom + @testing-library/react |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx src/hooks/useProjectGraph.test.ts src/pages/GraphsHub.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds (quick) / ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command (the three Phase 84 test files)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows are seeded from the research test map and
will be reconciled to actual `{plan}-{task}` IDs during planning/execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | hook | 1 | GH-02 | — / — | N/A (public read query) | unit | `npx vitest run src/hooks/useProjectGraph.test.ts` | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | N/A | unit | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Loading state on `undefined` | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Empty state on `null` (D-12) | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Source filter drops vault nodes + dangling links | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Truncation header "X of Y" from `nodeCount` | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Stale badge when `generatedAt*1000` > 36h ago | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Integrity warning when `storedNodeCount < nodeCount` | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | Detail panel on node click (id/label/type/source/community/neighbors) | unit | same | ❌ W0 | ⬜ pending |
| TBD | graph | 2 | GH-02 | — / — | `colorFn` → `#10b981` code, `#8b5cf6` vault | unit | same | ❌ W0 | ⬜ pending |
| TBD | page | 3 | GH-03 | — / — | Three MetricCard summary tiles render | unit | `npx vitest run src/pages/GraphsHub.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | page | 3 | GH-03 | — / — | Tile click navigates to each route | unit | same | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/useProjectGraph.test.ts` — stubs for GH-02 hook return shape (undefined / null / data)
- [ ] `src/components/graph/CodeVaultGraph.test.tsx` — stubs for GH-02 render, filter, truncation, freshness, integrity, detail panel, colorFn
- [ ] `src/pages/GraphsHub.test.tsx` — stubs for GH-03 tile render and click navigation
- [ ] Mock for `api.graphSnapshots.getProjectGraph` (pattern: `vi.mock("../../convex/_generated/api")`) — shared fixture in test setup

*Existing Vitest + jsdom infrastructure is present; only the three test files + the getProjectGraph mock are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fullscreen toggle visually fills viewport and ESC exits | GH-02 | `fixed inset-0 z-50` layout + canvas resize is visual; jsdom has no real layout/canvas | `npm run dev`, navigate `/graphs`, click expand affordance, confirm graph fills viewport, press ESC to exit |
| Force simulation warmup / zoom-to-fit centers graph | GH-02 | Canvas physics simulation does not run under jsdom | `npm run dev`, load `/graphs` with a real snapshot, confirm nodes settle and graph is centered |
| Nav stub flip — "Graphs Hub" routes to `/graphs` and CommandPalette registers it | GH-03 | Router + CommandPalette integration is observed in-browser | `npm run dev`, click "Graphs Hub" nav entry, confirm `/graphs` loads; open CommandPalette and confirm Graphs Hub is listed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
