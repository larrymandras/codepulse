---
phase: 114
slug: workspace-map-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 114 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `114-RESEARCH.md` § "Validation Architecture" and `114-CONTEXT.md` D-16.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (`package.json:89`), jsdom environment |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']` (`vitest.config.ts:12-15`) |
| **Quick run command** | `npx vitest run src/lib/workspaceMapLayout.test.ts` |
| **Full suite command** | `npm test` (`package.json:11`) |
| **Estimated runtime** | ~3s quick (pure-function suite, no DOM/canvas) · full suite per existing baseline |

### Canvas mocking — the verified pattern

`src/test/setup.ts` does **NOT** globally mock `react-force-graph-2d`, Recharts, Three.js, or React
Flow. CLAUDE.md § Testing claims it does; that claim is stale and was disproven by a full read of
`setup.ts` (139 lines) during research. **Correcting that CLAUDE.md line is a task this phase must
carry** (project Stale Docs rule: trust the code, say so, fix the doc).

The actual pattern is a **per-test-file mock**, confirmed identically in
`ForceGraphCanvas.test.tsx:9-26`:

```typescript
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock("react-force-graph-2d", () => ({
  default: reactForwardRef((props, ref) => { h.props = props; return null; }),
}));
```

This is the mechanism for asserting `cooldownTicks={0}` and `communityColorFn` are actually passed
through, with no real canvas.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

This phase is **design-doc-driven — there are no REQ-IDs.** The acceptance-bearing units are the 18
locked decisions D-01..D-18 (Phase 116's precedent, followed by 115). Task IDs are filled in by the
planner; the decision→test binding below is the contract the plans must satisfy.

| Decision | Behavior | Threat Ref | Test Type | Automated Command | File Exists |
|----------|----------|------------|-----------|-------------------|-------------|
| D-01 | First load renders exactly 391 nodes (center + 4 depts + 53 roots + 333 depth-1) | — | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "391 nodes"` | ❌ W0 |
| D-02 / D-03 | Expansion adds exactly one level's children per click, never a whole subtree | — | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "one level per click"` | ❌ W0 |
| D-04 | Collapsed node's rolled-up total equals the sum of its full subtree's direct counts | — | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "rollup"` | ❌ W0 |
| D-06 | `communityColorFn` returns non-null **only** for `access === "astridr-reachable"` | — | unit (component, mocked canvas) | `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "halo"` | ❌ W0 |
| D-08 | Same input `dirs` (any array order) → byte-identical `fx`/`fy`/`x`/`y`, twice in a row | — | unit (pure, determinism) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "determinism"` | ❌ W0 |
| D-09 | Withheld-files notice renders **iff** `withheldCount > 0`; both direct and rolled-up counts shown and labeled | T-114-01 | unit (component) | `npx vitest run src/components/workspace/WorkspaceMapPanel.test.tsx` | ❌ W0 |
| D-10 / D-11 | Ástríðr lens shows the empty state driven **live** by the arms probe, not a hardcoded string | — | unit (component, mocked `listSnapshots`) | `npx vitest run src/components/workspace/AstridrLensEmptyState.test.tsx` | ❌ W0 |
| D-12 | Lens survives via `?lens=` URL param; defaults to `workspace` for absent **or unrecognized** values | T-114-03 | unit (component, `MemoryRouter`) | `npx vitest run src/pages/WorkspaceMap.test.tsx -t "lens param"` | ❌ W0 |
| D-13 | `listSnapshots` returns the new `sources` field; existing fields unchanged | — | unit (convex) | `npx vitest run convex/graphSnapshots.test.ts` | ❌ W0 |
| D-14 / D-16 | Coverage strip: healthy fixture renders **zero** warn treatment; each of 4 degraded flags independently flips it to warn | — | unit (component, fixture-per-flag + **mutation**) | `npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx` | ❌ W0 |
| D-15 | `maskPaths` on → root/directory labels redacted, structure + counts + colors intact. Off (default) → unmasked | T-114-01 | unit (component, `PrivacyContext` wrapper) | `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "privacy"` | ❌ W0 |
| D-17 | Warn styling appears **only** when `now - generatedAt > 36h`; boundary-tested at exactly 36h and 36h+1s | — | unit | `npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx -t "staleness"` | ❌ W0 |
| D-18 | Chrome Issues-tab entry observed and recorded verbatim | — | **manual** | see Manual-Only Verifications | n/a |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/workspaceMapFixture.ts` — the workspace equivalent of `src/test/projectGraphFixture.ts`
      (CONTEXT.md names this pattern explicitly). Must expose:
  - `makeWorkspaceMapFixture(overrides?)` matching `getWorkspaceMap`'s exact return shape
    (`convex/workspace.ts:320-345`), with **all four honesty flags green by default**
    (`scannedRootsComplete: true`, `accessDerivationOk: true`, `localConfigStatus: "merged"`, empty
    `unclassifiedRootIds`) — so a bare `makeWorkspaceMapFixture()` **is** the healthy-render control.
  - Four degraded override presets: `scannedRootsComplete: false`, `accessDerivationOk: false`,
    `localConfigStatus: "absent"`, `localConfigStatus: "version-mismatch"`.
  - `mockGetWorkspaceMap(value)` / `mockArmsProbe(value)`, mirroring `mockGetProjectGraph`
    (`src/test/projectGraphFixture.ts:180-186`).
  - **⚠ SYNTHETIC ROOT AND DIRECTORY NAMES ONLY — never a real name from the live tree.** Phase 115
    D-17 is a public-repo disclosure rule, carried forward by 114's D-16. This binds the fixture
    file, every test asserting against it, and every screenshot taken during manual QA.
- [ ] `src/lib/workspaceMapLayout.test.ts` — pure-function suite covering D-01, D-02, D-03, D-04,
      D-08. No mocks needed; follows `src/lib/skillVault.test.ts`'s structure directly. This is the
      cheapest high-value validation surface in the phase — the layout math is testable as a pure
      function entirely independent of the canvas.
- [ ] **Mutation test for D-16** — concretely: render `WorkspaceCoverageStrip` with the healthy
      fixture and assert **zero** elements carry the warn styling / `AlertTriangle` icon. Then
      **prove that assertion can fail**: temporarily flip exactly one flag in the fixture and watch
      the healthy assertion go RED *before* writing the degraded-state test as the fix. Only then
      write the four degraded-state assertions. Same shape as `115-03-PLAN.md`'s dry-run gate proof
      (RED 7/17 → GREEN 24/24). **Record the RED output in the plan's evidence** — a green that was
      never shown able to fail does not discharge D-16.
- [ ] **Determinism test for D-08** — call `layoutNodes(tree, rollups, expandedSet)` twice on
      identical inputs and `toEqual` the full `{nodes, links}` including `fx`/`fy`/`x`/`y`. Then feed
      `dirs` forward-order and `dirs.slice().reverse()` through `buildTree`/`computeRollups` and
      assert the same output — proving the layout is a function of the DATA, not of iteration order.
- [ ] Framework install: **none.** Vitest is already configured and used identically by
      `skillVault.test.ts`, `ForceGraphCanvas.test.tsx`, and `CodeVaultGraph.test.tsx`.

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| All four themes render department colors legibly, no hardcoded hex | Discretion (theme tokens) | Visual/perceptual across `cyan`, `emerald`, `readable`, `aubergine` + light `:root`; no automated color-contrast harness in this repo | Load `/workspace-map`, cycle the ThemeSwitcher through all four dark themes and light, confirm the four department fills and the muted Unclassified remain distinguishable |
| Chrome DevTools Issues-tab entry observed and recorded **verbatim** | D-18 | Chrome's Issues panel is a browser surface with no programmatic hook; a clean console is not evidence about it | At the operator checkpoint, open `/workspace-map`, open DevTools → Issues tab, record the entry's **category and source verbatim**. Observe-and-record ONLY — any fix falls to the owning phase, not built here |
| Live-data smoke: real 4,912-row payload renders at 391 nodes without jank | D-01, D-02 | Fixtures are synthetic by disclosure rule; only live data exercises the real 1.35 MB payload | Load the page against the live self-hosted backend, confirm first paint is 391 nodes and expansion is instant (no round-trip). **Do not screenshot with masking off** (D-15 / Phase 115 D-17) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 30s
- [ ] D-16 mutation test's RED output recorded as evidence
- [ ] No real root/directory name appears in any fixture, test, or committed screenshot
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
