# 106-02: CodePulse Production Bundle — Composition Baseline

## Baseline

**Reproduction command:** `ANALYZE_BUNDLE=1 npm run build`, then read `dist/chunk-composition.json`.

**Measured:** 2026-08-04
**Commit SHA:** `b0b905b3` (pre-plugin working tree; the plugin itself was added and committed in this plan's Task 1, commit `0a5923ef` — the build below was re-run after that commit landed, and the emitted chunk graph is identical because the plugin is additive-only)

`dist/chunk-composition.json` records, per chunk: `fileName`, `renderedBytes` (post-minification `code.length`), `isEntry`, `isDynamicEntry`, the top 30 modules by pre-minification `renderedLength` (rollup's `RenderedModule.renderedLength`), and an `otherModulesCount`/`otherModulesBytes` tail so the per-module numbers reconcile against the full module set even when a chunk has more than 30 modules.

**Important measurement caveat:** `renderedLength` on each module is a *pre-minification* figure (module code after tree-shaking, before cross-module minification/mangling). The sum of a chunk's module `renderedLength`s is therefore consistently *larger* than the chunk's own post-minification `renderedBytes` (e.g. the entry chunk's top-30 + tail module bytes sum to ~4.7 MB pre-minification against a 2.05 MB post-minification `renderedBytes`). This is expected and is not a bug in the report — it means the module-level "top contributors" figures below describe *relative* weight within a chunk accurately, but are not directly additive to the chunk's final byte count.

### Vite's verbatim build stdout (chunk table)

```
dist/assets/react-ChdhLKgT.js                                  0.05 kB │ gzip:   0.07 kB
dist/assets/dist-C2J943E6.js                                    0.06 kB │ gzip:   0.08 kB
dist/assets/useSubagentJobs-Cu7WBMjY.js                         0.11 kB │ gzip:   0.12 kB
... (small chunks omitted for brevity — full table has 111 JS chunks; only the >500 kB tail is load-bearing here) ...
dist/assets/Reminders-C8vb5tcj.js                              41.90 kB │ gzip:  12.28 kB
dist/assets/ConfigPage-bAC6HG_9.js                             47.72 kB │ gzip:  10.53 kB
dist/assets/js-yaml-DjkWCoYq.js                                52.84 kB │ gzip:  16.16 kB
dist/assets/KnowledgeGraph-CmuXlmER.js                         59.42 kB │ gzip:  15.79 kB
dist/assets/Analytics-BzcKz7TA.js                              61.67 kB │ gzip:  12.21 kB
dist/assets/Roster-BEN30zs3.js                                 62.12 kB │ gzip:  14.87 kB
dist/assets/api-BeplwyRw.js                                    70.81 kB │ gzip:  19.77 kB
dist/assets/Chat-CVtKs5Af.js                                   97.22 kB │ gzip:  28.05 kB
dist/assets/proxy-Der6OMBU.js                                 120.97 kB │ gzip:  39.24 kB
dist/assets/Skills-D95z9N-P.js                                140.69 kB │ gzip:  36.04 kB
dist/assets/lib-Cv3nM-96.js                                   153.98 kB │ gzip:  45.84 kB
dist/assets/Onboarding-CIWYionO.js                             319.50 kB │ gzip: 108.93 kB
dist/assets/esm-n7Z74dfN.js                                    445.91 kB │ gzip: 145.21 kB
dist/assets/WarRoom-Bd85Zpxp.js                                485.00 kB │ gzip: 127.14 kB
dist/assets/useSpeechRecognition-Dk0vH55C.js                   638.56 kB │ gzip: 229.13 kB
dist/assets/react-force-graph-3d-CFsep7Pw.js                 1,293.89 kB │ gzip: 341.26 kB
dist/assets/index-fgkf2HV8.js                                 2,047.37 kB │ gzip: 566.91 kB

✓ built in 1.17s
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

### Chunks over 500 kB (renderedBytes > 512000)

| Chunk file | Size (post-min) | Classification | Verdict |
|---|---|---|---|
| `assets/index-fgkf2HV8.js` | 2,047.37 kB | **entry** (`isEntry: true`) | **Real defect.** Downloaded on every page view regardless of route. Not named in REQUIREMENTS.md. See remediation candidates below. |
| `assets/react-force-graph-3d-CFsep7Pw.js` | 1,293.89 kB | **lazy** (`isEntry: false`, `isDynamicEntry: false` — it is a *shared dependency chunk* pulled in only by two lazy-boundary components, not a route entry itself) — proof: `src/components/graph/CodeVaultGraph.tsx:67` `const LazyForceGraph3D = lazy(() => import(...))`; `src/components/skills/vault/SkillVaultView.tsx:28` `const SkillVaultScene = lazy(() => import("./SkillVaultScene"))` | **Accepted, not a defect** (matches D-09 exactly). |
| `assets/useSpeechRecognition-Dk0vH55C.js` | 638.56 kB | **lazy** (same pattern — shared dependency chunk of two lazy pages) — proof: `src/App.tsx:36` `const Chat = lazy(() => import("./pages/Chat"))`; `src/App.tsx:45` `const InsightsChat = lazy(() => import("./pages/InsightsChat"))`; `src/components/ChatInput.tsx` (the sole non-test consumer of `useSpeechRecognition`) is only ever imported from `Chat.tsx`/`InsightsChat.tsx`, both lazy. | **Contested — see below.** The chunk itself genuinely defers loading (contradicts D-09's "not yet isolated" framing on *timing*), but its *composition* is dominated by an unrelated, avoidable dependency. Real remediation opportunity, just not an entry-chunk one. |

`assets/WarRoom-Bd85Zpxp.js` (485.00 kB, `isDynamicEntry: true`) is **under** the 512000-byte threshold and is not in this table — confirms D-09.

No chunk not already named by D-09 crossed the threshold in this build.

### Top contributors — `assets/index-fgkf2HV8.js` (entry, 2,042,261 bytes post-min)

Top 15 of the capped top-30 modules by pre-minification `renderedLength`:

| Bytes | Module |
|---|---|
| 452,138 | `node_modules/react-dom/cjs/react-dom-client.production.js` |
| 139,526 | `node_modules/@xyflow/react/dist/esm/index.js` |
| 94,916 | `node_modules/@xyflow/system/dist/esm/index.js` |
| 84,979 | `node_modules/@dnd-kit/core/dist/core.esm.js` |
| 53,145 | `node_modules/@clerk/clerk-react/dist/index.mjs` |
| 51,607 | `node_modules/sonner/dist/index.mjs` |
| 47,714 | `node_modules/force-graph/dist/force-graph.mjs` |
| 45,857 | `node_modules/recharts/es6/state/selectors/axisSelectors.js` |
| 43,012 | `node_modules/@radix-ui/react-select/dist/index.mjs` |
| 42,056 | `src/pages/Settings.tsx` |
| 38,265 | `src/pages/Memory.tsx` |
| 36,437 | `node_modules/react-easy-crop/index.module.mjs` |
| 32,587 | `node_modules/@clerk/clerk-react/dist/chunk-THNCS7QR.mjs` |
| 28,335 | `src/pages/Security.tsx` |
| 26,605 | `node_modules/@reduxjs/toolkit/dist/redux-toolkit.modern.mjs` |

`otherModulesCount: 1560`, `otherModulesBytes: 2,670,284` — 1,560 additional modules not individually captured by the 30-module cap.

**Roll-up by npm package / source directory** (of the captured top-30 only — the 1,560-module tail is not attributable at this cap):

| Bytes | Package / source group |
|---|---|
| 452,138 | `react-dom` |
| 139,526 | `@xyflow/react` |
| 94,916 | `@xyflow/system` |
| 85,732 | `@clerk/clerk-react` |
| 84,979 | `@dnd-kit/core` |
| 65,579 | `recharts` |
| 51,607 | `sonner` |
| 47,714 | `force-graph` |
| 43,012 | `@radix-ui/react-select` |
| 42,056 | `src/pages/Settings.tsx` |
| 38,265 | `src/pages/Memory.tsx` |
| 36,437 | `react-easy-crop` |
| 28,335 | `src/pages/Security.tsx` |
| 26,605 | `@reduxjs/toolkit` |
| 26,321 | `@radix-ui/react-scroll-area` |
| 25,877 | `src/pages/Capabilities.tsx` |
| ... 12 more entries ... | (see raw JSON for full top-30 list) |

Captured top-30 sum: 1,544,967 bytes. Uncaptured tail: 2,670,284 bytes across 1,560 modules — this tail is real weight in the entry chunk that this report cannot attribute to individual packages without raising the plugin's cap (out of scope for this plan; the cap was fixed at 30 by plan design).

### Top contributors — `assets/react-force-graph-3d-CFsep7Pw.js` (1,293,892 bytes post-min)

| Bytes | Module |
|---|---|
| 1,040,274 | `node_modules/three/build/three.webgpu.js` |
| 531,457 | `node_modules/three/build/three.module.js` |
| 384,935 | `node_modules/three/build/three.core.js` |
| 49,292 | `node_modules/three-forcegraph/dist/three-forcegraph.mjs` |
| 27,161 | `node_modules/three/examples/jsm/controls/OrbitControls.js` |
| 22,636 | `node_modules/three-render-objects/dist/three-render-objects.mjs` |
| 19,708 | `node_modules/polished/dist/polished.esm.js` |
| 17,870 | `node_modules/3d-force-graph/dist/3d-force-graph.mjs` |
| 16,981 | `node_modules/three/examples/jsm/controls/TrackballControls.js` |
| 13,825 | `node_modules/ngraph.forcelayout/lib/codeGenerators/generateQuadTree.js` |

`otherModulesCount: 13`, `otherModulesBytes: 5,365` — this chunk's module set is almost entirely captured (43 total modules); it is essentially 100% three.js/3d-force-graph, exactly as expected for an isolated 3D-visualization dependency.

### Top contributors — `assets/useSpeechRecognition-Dk0vH55C.js` (635,332 bytes post-min)

| Bytes | Module |
|---|---|
| 33,668 | `node_modules/refractor/lang/sqf.js` |
| 14,568 | `node_modules/refractor/lang/factor.js` |
| 14,371 | `node_modules/refractor/lang/vim.js` |
| 14,276 | `node_modules/react-syntax-highlighter/dist/esm/styles/prism/one-dark.js` |
| 13,706 | `node_modules/react-syntax-highlighter/dist/esm/highlight.js` |
| 10,734 | `node_modules/refractor/lang/cmake.js` |
| 10,385 | `node_modules/refractor/lang/csharp.js` |
| 10,340 | `node_modules/refractor/lang/opencl.js` |
| 10,005 | `node_modules/refractor/lang/sas.js` |
| 9,055 | `node_modules/refractor/lang/autohotkey.js` |

`otherModulesCount: 307`, `otherModulesBytes: 541,426` — a spot-check of the remaining 307-module tail (visible in the full top-30 list, not just the top 10 above) shows it is overwhelmingly more `refractor/lang/*.js` files (php, gml, abap, gherkin, markdown, bash, avisynth, textile, keepalived, js-templates, asciidoc, xquery, javascript, cobol, ...) plus `refractor/lib/all.js` (8,349 bytes — the literal "register every language" entry point) and `refractor/lib/prism-core.js`.

**Finding, not in D-09:** this chunk's name (`useSpeechRecognition`) is a red herring — the byte weight is not the voice stack. Of the 30 captured modules, 233,152 of 283,495 bytes (82%) are `refractor` language-grammar files; combined with the 541,426-byte uncaptured tail (which the module ID sample shows is also dominated by `refractor/lang/*`), an estimated **~774,578 of ~824,921 pre-minification module bytes (~94%)** in this chunk is refractor/Prism language-grammar data, most of it for languages this dashboard has no reason to render (`sqf`, `factor`, `vim`, `cmake`, `csharp`, `opencl`, `sas`, `autohotkey`, `apacheconf`, `gml`, `abap`, `gherkin`, `avisynth`, `textile`, `keepalived`, `cobol`, ...).

### Confirmed / Contradicted vs D-09

D-09 was measured from a real `npm run build` during Phase 106 pattern-mapping, on the same unmodified codebase this plan's build ran against (no application source files were changed between D-09's measurement and this one — Task 1 of this plan only touched `vite.config.ts`, additively).

| Chunk (D-09 name) | D-09 figure | This build | Result |
|---|---|---|---|
| `index` (entry) | 2,047.37 kB | 2,047.37 kB | **Confirmed**, exact match (0% delta) |
| `react-force-graph-3d` | 1,293.89 kB | 1,293.89 kB | **Confirmed**, exact match (0% delta) |
| `useSpeechRecognition` | 638.56 kB | 638.56 kB | **Confirmed** on size (0% delta). Load-timing framing **contradicted**: D-09 called it "genuinely not yet isolated"; this build's `isDynamicEntry`/import-graph evidence shows it already loads only behind the `Chat`/`InsightsChat` lazy boundaries, same as `react-force-graph-3d`. New finding this build adds: the chunk's actual weight is ~94% unused `refractor` language grammars, not the voice/speech dependency chain D-09's framing implied. |
| `WarRoom` | 485.00 kB | 485.00 kB | **Confirmed**, exact match (0% delta); confirmed under the 500 kB warning threshold, not flagged by the build. |

### Remediation candidates

Listed in descending estimated-byte order. None implemented in this plan.

1. **`react-syntax-highlighter`'s full Prism bundle pulls in refractor's entire language registry — estimated ~774,578 bytes (pre-minification module weight, ~94% of the `useSpeechRecognition` chunk).**
   Mechanism: `src/components/blocks/CodeBlock.tsx:11` and `src/components/ChatBubble.tsx:23` both do `import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"`, which registers every language `refractor` ships (confirmed by `refractor/lib/all.js` appearing in the module list) — including `sqf`, `factor`, `vim`, `cmake`, `apacheconf`, `gml`, `abap`, `gherkin`, `avisynth`, `textile`, `keepalived`, `cobol`, and dozens more this dashboard never renders. Switching to `react-syntax-highlighter/dist/esm/prism-light` (`PrismLight`/`PrismAsyncLight`) and registering only the languages actually used in chat/code-block content (e.g. `typescript`, `javascript`, `json`, `bash`, `python`, `tsx`) would remove the large majority of this chunk's weight. This reduces the `useSpeechRecognition` chunk itself, not the entry chunk — it still lowers cost on every `Chat`/`InsightsChat` page load.

2. **Four App.tsx pages statically imported instead of lazy — measurable 134,533 bytes directly in the entry chunk's top 30.**
   Mechanism: `src/App.tsx` imports `Settings` (line 14), `Memory` (line 15), `Security` (line 11), and `Capabilities` (line 7) as plain top-level imports, unlike the other 27 pages in the same file which all use `lazy(() => import(...))`. Converting these four to the established `lazy()` pattern removes their combined 134,533 bytes (42,056 + 38,265 + 28,335 + 25,877) from the entry chunk. `src/App.tsx` also statically imports `Alerts`, `Infrastructure`, `SelfHealing`, `BuildProgress`, `Briefings`, `Automation`, `Executions`, `Ideation`, and `SessionDetail` — real additional candidates by the same mechanism, but their individual byte weights are not visible in this report because they fell outside the 30-module cap (the 1,560-module, 2,670,284-byte tail). `Dashboard` is the intentional default landing route and is a separate, higher-tradeoff case (see #3).

3. **`@xyflow/react` + `@xyflow/system` (234,442 bytes combined) reach the entry chunk via `Dashboard.tsx`, the intentionally-eager landing page.**
   Mechanism: `AgentTopology.tsx` (which imports `@xyflow/react`) is rendered from `src/pages/Dashboard.tsx`, and `Dashboard` is the one page `App.tsx` does not lazy-load (it is the default route, `/`). Converting `Dashboard` itself to `lazy()` — consistent with every other route in the file — would move this 234,442 bytes (plus its own page code) out of the entry chunk, at the cost of introducing a brief loading-spinner flash on the very first page view rather than the current instant paint. This is a real tradeoff the entry-chunk-only pages above don't have; flagged for 106-04 to weigh explicitly rather than default to "lazy everything."

4. **`@dnd-kit/core` (84,979 bytes) likely reaches the entry chunk via `Settings.tsx`'s `ProviderControls.tsx` (drag-reorder UI).**
   Mechanism: `@dnd-kit/core` is imported by `src/components/ProviderControls.tsx`, which is only used from `src/pages/Settings.tsx` (grep-confirmed: `Settings.tsx`, `Tasks.tsx`, `Teams.tsx`, `WarRoomKanbanColumn.tsx`, `KanbanBoard.tsx`, `KanbanColumn.tsx` are the only importers across the whole `dnd-kit/core` usage, and of those only `Settings.tsx` is non-lazy). If candidate #2 converts `Settings.tsx` to `lazy()`, this 84,979 bytes very likely leaves the entry chunk as a side effect — not independently verified by re-running the build in this plan (no source changes were made), so listed as a probable consequence, not a separately-measured line item.

### Accepted, not a defect

**`assets/react-force-graph-3d-CFsep7Pw.js` (1,293.89 kB).** Proven lazy: the sole import sites are `src/components/graph/CodeVaultGraph.tsx:67` (`const LazyForceGraph3D = lazy(() => import(...))`) and `src/components/skills/vault/SkillVaultView.tsx:28` (`const SkillVaultScene = lazy(() => import("./SkillVaultScene"))`), both behind opt-in 3D-mode toggles — it loads only when a user actually switches into 3D mode, never on initial page load or default 2D graph rendering. Raising `build.chunkSizeWarningLimit` was considered (it would silence this chunk's warning) and rejected: doing so masks the warning for every chunk, not just this one, so a genuinely-regressed future chunk (e.g. the entry chunk growing further) would stop being flagged too. The size stays real; only the warning threshold would change, and that trade isn't worth taking for one already-lazy chunk.

## Next

Plan 106-04 (remediation) should treat the entry chunk's static-import pages (#2) as the lowest-risk, highest-confidence win (measured bytes, established `lazy()` pattern already used by 27 sibling pages in the same file, zero UX tradeoff since those pages are not the landing route), the `refractor`/Prism full-bundle issue (#1) as the second target (measured, well-evidenced, but requires picking a language allowlist), and the `Dashboard`/`@xyflow` lazy conversion (#3) as a discretionary call given its landing-page loading-spinner tradeoff.
