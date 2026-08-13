# Phase 114: Workspace Map view - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A new `/workspace-map` page in the GRAPHS nav group that renders the **live workspace snapshot
Phase 115 produces** as a radial map, with a lens switcher between Larry's workspace and Ástríðr's
world.

This phase delivers the **consumer only** — the page, its radial renderer, its side panel, its
coverage strip and its lens switcher. It does **not** build the scanner (Phase 115, complete), and it
does **not** build the Ástríðr-side ARMS inventory (astridr A1–A3, queued for v29 and not yet
scheduled).

**The producer is live and populated.** `getWorkspaceMap` (`convex/workspace.ts:303`) returns meta +
**4,912 directory rows** at `activeVersion` 10, measured 2026-08-13. Phase 114 is almost entirely
frontend work; see D-13 for the single backend change.

**Two ROADMAP corrections the planner should make while writing the goal:**

1. `.planning/ROADMAP.md` § "Phase 114" carries `**Goal:** [To be planned]` and
   `**Requirements**: TBD` — a `gsd-phase add` stub. Like Phase 115, this phase is
   **design-doc-driven**: the acceptance-bearing units are the 18 locked decisions below, traced
   instead of REQ-IDs (Phase 116's precedent, followed by 115).
2. That same section reads `**Depends on:** Phase 113`, which is a sequential default from
   `gsd-phase add`, not a real constraint. The real dependency is **Phase 115** — the design's own
   dependency graph says "C2 → enables C1's workspace lens"
   (`agentic-os-second-brain.md:48`). Both 113 and 115 are complete, so nothing is blocked; the line
   is simply wrong and should be corrected the way 115's was.

</domain>

<decisions>
## Implementation Decisions

### Scale and drill-down

- **D-01:** First load renders **roots + one level**: the workspace center, 4 department hubs, 53
  root hubs and their 333 depth-1 children — **391 nodes**. Clicking a hub expands its children in
  place; everything else stays collapsed. Measured justification: the tree is 4,912 directories
  across 53 roots and 8 levels, and the distribution is severely lopsided — two roots hold 1,041 and
  601 directories while 19 roots hold ten or fewer. 391 nodes matches the design's fixed-ring-slot
  scale while keeping the cross-root view that a per-root drill-down would destroy.

- **D-02:** A **single `getWorkspaceMap` subscription** fetches all 4,912 rows (**1.35 MB**,
  measured) and expand/collapse is entirely client-side. Expansion is instant with no round-trip.
  Verified live 2026-08-13 that the query returns all 4,912 rows successfully — the 4,096-read
  ceiling that killed Phase 115's inline prune is a *mutation*-path limit and does not bite this
  query. Note the subscription re-pushes on every `activeVersion` flip, which is once a night.

- **D-03:** Expansion reveals **one level per click, at every depth** — never a whole subtree. The
  tree is 8 deep; whole-subtree expansion on the largest root would drop 1,041 nodes from one
  gesture. The rejected "auto-expand thin chains" variant was dropped because it makes the node count
  per click unpredictable.

- **D-04:** Collapsed nodes display **rolled-up subtree totals**, computed client-side from the full
  payload. This is required, not cosmetic: `convex/schema.ts` records `fileCount`/`totalSize` as
  **direct contents only** ("VISIBLE files directly in this directory only — never withheld files,
  never subdirectories' files"), so without a rollup a collapsed root containing 1,041 directories
  renders as ~3 files and reads as broken. The side panel shows both figures (D-09).

### Visual encoding

- **D-05:** The radial geometry is **center → departments → roots → directories**. Four department
  hubs sit on ring 1 (Personal 2,339 · Consulting 1,324 · Unclassified 695 · Work 554), their roots
  on ring 2, directories outward. This is the closest true analog of the design's ARMS layout —
  category rings around a center — and D-07 of Phase 115 chose departments precisely because "a
  department answers what a thing is FOR, which is the question a map should answer at a glance."
  Rejected: roots directly on ring 1 (53 nodes on one ring, department readable only by color), and
  access on ring 1 (a binary split into two huge hubs that buries the department model).

- **D-06:** **Node fill encodes department; a halo arc marks `astridr-reachable`.** Fill-by-department
  means a directory five rings out still reads its context. The halo costs no new render code —
  `ForceGraphCanvas` already exposes `communityColorFn`, documented as "draws a halo arc around each
  node where this returns non-null." Rejected: access-as-fill (3,389 of 4,912 dirs would be one flat
  color) and access-in-panel-only (answering "what can Ástríðr see" would require clicking every
  node).

- **D-07:** **Node size encodes rolled-up file count.** 229,210 files total gives a wide, readable
  range, counts are what the map already trades in (115's D-13 made files counts rather than nodes),
  and it stays honest because `fileCount` excludes withheld files by construction. Rejected: total
  bytes (32.96 GB, dominated by a few large binaries — one big file would outweigh 400 source files)
  and uniform sizing.

- **D-08:** The layout is **fully deterministic — physics off**. Every visible node's x/y is computed
  from its ring and angular sector, with `cooldownTicks=0` and explicit fixed coordinates. Same data
  always draws the same picture, which is what makes it screenshot-testable and stops nodes drifting
  under the reader on expand. Matches the design's "physics-off radial layout, fixed ring slots" and
  the recorded SkillVault lesson that fixed react-force-graph layouts need `cooldownTicks=0` **plus**
  explicit coordinates. Rejected: `forceRadial` (positions shift on every expand and the layout stops
  being reproducible for tests) and the fixed-hubs/force-leaves hybrid (two layout systems to build
  and tune).

- **D-09:** The **side panel on node click** carries the stored fields (path, department, access,
  `latestMtime`), **both** direct and rolled-up counts, and — when `withheldCount > 0` — an explicit
  line stating that N files were classified sensitive and never left the host. **1,092 of 4,912
  directories have withheld files**; this line is where Phase 115's D-03 ("the snapshot carries a
  withheld count per directory so the omission is visible in the map rather than silent") actually
  becomes visible per-node. A bare number with no explanation does not discharge that.

### Lens switcher

- **D-10:** **The switcher ships, with Ástríðr's world as an honest empty state.** Selecting it shows
  a stated panel — no ARMS inventory yet, produced by astridr A3, queued for v29, nothing ingested —
  rather than a blank canvas. Measured at discussion time: astridr-repo is on `milestone: v28.0`, its
  ROADMAP contains no v29 and no A1–A3 phase, and grep finds no `arms` in it, so `kind:"arms"` rows
  do not exist and are not scheduled. This delivers the ROADMAP's two-lens scope, makes the
  cross-repo dependency visible in the product instead of only in planning docs, and leaves a seam A3
  populates. Rejected: workspace-lens-only (would require amending the ROADMAP goal line) and a
  fixture-backed ARMS renderer (building a second layout against a schema A3 has not defined — an
  unexercised path that goes stale the moment the real shape differs).

- **D-11:** The empty state is driven by a **live probe** for `kind:"arms"` rows, not a hardcoded
  string. The day A3 ingests, the panel changes on its own rather than continuing to claim nothing
  exists. This is a deliberate application of the project's stale-claim rule: a hardcoded assertion
  about *another repo's* state, baked into this one, is exactly the line that goes stale silently and
  is never struck.

- **D-12:** The selected lens lives in a **URL search param** (`/workspace-map?lens=…`).
  Bookmarkable, survives reload, and lets Playwright land directly on either lens without clicking.

- **D-13:** **`graphSnapshots.listSnapshots` gains its `sources` field** — the single backend change
  in this phase, and the reconciliation of D-02's "zero Convex code" with D-11's probe. The probe
  needs to know whether any snapshot source has `kind: "arms"`; `listSnapshots`
  (`convex/graphSnapshots.ts:317-329`) currently returns only `snapshotId, nodeCount, linkCount,
  generatedAt, updatedAt`, and the only alternative — `getProjectGraph` — would pull a 3,904-node
  graph to answer a yes/no. Verified safe: **`listSnapshots` has zero consumers in `src/`**
  (control-paired — `getProjectGraph` returns 6 hits under the same search, so the search works), so
  adding a field to its return breaks nothing. Rejected: a new dedicated arms-presence query, because
  CLAUDE.md's Phase-115 note records that every public Convex function here is callable with no
  credential, so a new public function is not free.

### Coverage, honesty and privacy

- **D-14:** Coverage state lives in an **always-visible header strip** above the canvas — scan time,
  roots covered, withheld count, unclassified count — escalating to a warning treatment when any flag
  degrades. Always-on means the healthy shape is familiar, so a degraded one is legible when it
  appears; a bar that only renders on failure is a bar nobody has ever seen. It is also the only
  option that gives the withheld and unclassified counts a home. Rejected: degraded-only (its absence
  and its being-broken look identical) and a collapsed chip.

- **D-15:** The map **honors `PrivacyContext`** — `usePrivacy()`'s `maskPaths`
  (`src/contexts/PrivacyContext.tsx:5`) redacts root and directory *labels* while structure, counts
  and colors stay intact. Consistent with `FileTree` / `SessionHeader` / `BashLog`, and off by
  default (`level: "off"`) so daily use is unaffected. This exists because the map renders real root
  and directory names, several of which are client engagements — the exact disclosure class that
  produced Phase 115's D-17 blocker. Without it there is no safe way to screenshot this screen.
  Rejected: no masking, and a bespoke Consulting-only rule sitting next to an existing app-wide one.

- **D-16:** The degraded states are proven with **a fixture per flag plus a mutation test**. Every
  honesty flag is green on live data today — `scannedRootsComplete: true`, `coveredRoots: 53/53`,
  `accessDerivationOk: true`, `localConfigStatus: "merged"` — so anything built and eyeballed against
  the real payload will never once be seen in its degraded form. Fixtures must cover incomplete
  roots, failed access derivation, and `absent` / `version-mismatch` local config; the mutation test
  must prove a healthy render **fails** when a flag flips, per this project's standing rule that a
  gate which can skip itself has to be shown to have evaluated something.
  **Fixtures carry synthetic root names only — never real ones (Phase 115 D-17).**

- **D-17:** The strip shows **relative scan time and warns past one missed nightly run** (~36h),
  derived from `generatedAt`. The scan is registered daily at 04:15. Phase 115's **D-05 unattended
  firing is still OPEN** (due 2026-08-14 morning) — a manual trigger proved the action works, not
  that the scheduler fires it — and a staleness indicator is precisely what surfaces a scheduler that
  silently stopped, the failure mode that cost ClaudeConfigPull five weeks of never running.

### Folded Todos

- **D-18:** `111-devtools-issues-panel-entry-unexamined.md` is folded as **observe-and-record only**.
  114's operator checkpoint gains one step: open Chrome's Issues tab on the new `/workspace-map`
  page, and record the entry's category and source **verbatim**. Any fix that falls out is filed
  against the owning phase, not built here.

  *Original problem:* at Phase 111's operator checkpoint (2026-08-11), both captured consoles showed
  a `1 Issue` badge and the Issues tab was never opened. The console said `No errors` with one Clerk
  dev-keys warning, but Chrome's Issues panel is a separate surface aggregating deprecations, CSP/
  CORS/cookie findings and breaking-change notices that never print to the console — so a clean
  console is not evidence about what that issue is. The todo deliberately refuses to call it benign
  or pre-existing, per this project's error-triage rule that the label has to be earned by tracing
  it.

  *Why it fits here:* 114 builds a new page, so devtools will be open on a fresh surface and the
  badge will be sitting there — the cheapest moment this will ever be. Scoping it to observe-and-
  record keeps an open-ended browser investigation out of 114's build scope.

### Claude's Discretion

- Exact ring radii, angular sector allocation, and intra-ring collision handling for D-08's
  deterministic slots.
- Which theme token maps to which department. **Constraint the planner must resolve:**
  `ThemeColors` (`src/hooks/useThemeColors.ts:14-27`) currently exposes only five non-status tokens
  (`primary`, `accent`, `vaultNode`, `chartBar`, `chartBarAccent`), and using `status*` tokens for
  departments would be semantically wrong. CLAUDE.md documents `--chart-*` tokens in CSS; pulling
  them into `ThemeColors` is the likely move. Unclassified should read as muted, not as a fifth
  peer color. All four themes must be checked — never a hardcoded hex.
- Label density and zoom thresholds; link rendering between rings.
- The exact staleness threshold within D-17's "one missed nightly run" intent.
- Component decomposition, file layout, and where the rollup computation lives.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design this phase implements

- `C:\Users\mandr\Mandras\02-projects\agentic-os-second-brain.md` — the approved design.
  **§"CodePulse" bullet C1 (Phase 114)** is this phase's scope statement. **Line 48** is the
  dependency graph ("C2 → enables C1's workspace lens" · "C1 ships with whichever lens has data
  first"), which is the basis for D-10. This note is in the **vault, not the repo**. Re-verify its
  cited `file:line` anchors before relying on them — the note itself instructs this, and it was last
  verified 2026-08-08.
- `.planning/ROADMAP.md` § "Phase 114: Workspace Map view" — currently a stub with an inverted
  dependency line; see § Phase Boundary above for both corrections.

### The producer — this phase's input contract

- `.planning/phases/115-workspace-scanner/115-CONTEXT.md` — the 17 decisions that shaped the data.
  **D-13 (directories are nodes, files are counts) is the load-bearing part of the contract**;
  D-03 (secret paths omitted, withheld count carried) drives D-09 and D-14 here; D-07/D-14/D-15/D-16
  define the department vocabulary and why a large Unclassified group is expected and correct;
  **D-17 is the public-repo disclosure rule that binds this phase's fixtures and screenshots.**
- `convex/workspace.ts` — `getWorkspaceMap` at `:303` is the query this page consumes; its return
  shape *is* the contract. `WORKSPACE_SNAPSHOT_ID` at `:38`.
- `convex/schema.ts:2381-2442` — `workspaceSnapshots` / `workspaceDirs`. Read the header comment
  block: it records the **side-channel rule** (`withheldCount` is deliberately count-only, with no
  byte total, because a byte total is a far higher-resolution side channel onto a withheld file) and
  the fact that `fileCount`/`totalSize` are **direct contents only** — the basis for D-04.
- `.planning/phases/115-workspace-scanner/115-LIVE-EVIDENCE.md` — how the live pipeline was proven,
  including the control-paired probes.

### Rendering substrate and precedents

- `src/components/graph/ForceGraphCanvas.tsx` — the render target. Read its prop contract: `paintNode`,
  `colorFn`, `communityColorFn` (the halo arc D-06 uses), `focusSet`, and the `ForceGraphHandle`
  imperative API (`centerAt`, `zoom`, `zoomToFit`, `d3Force`, `d3ReheatSimulation`).
- `src/components/graph/CodeVaultGraph.tsx` — the model for a domain-specific graph built on that
  canvas (915 lines); the closest existing analog to what this phase builds.
- `src/components/skills/vault/SkillVaultScene.tsx` — the fixed-layout precedent the design names.
- `src/hooks/useThemeColors.ts` — `ThemeColors` at `:14`, `resolveThemeColors` at `:41`. Note its
  Pitfall-2 comment: do **not** cache the `CSSStyleDeclaration`, or theme switches won't be seen.
- `src/contexts/PrivacyContext.tsx` — `maskPaths` at `:5`; `usePrivacy` at `:97`. D-15's mechanism.
- `src/lib/navRegistry.ts:142-151` — the GRAPHS nav group where this page's entry goes. Per CLAUDE.md,
  nav entries go in the registry (`iconComponents` map + the group's `items`), **not** in
  `DashboardLayout.tsx`, which only consumes it.
- `convex/graphSnapshots.ts:317-329` — `listSnapshots`, the query D-13 extends. Zero consumers in
  `src/` (control-paired at discussion time).

### Project rules that bind this phase

- `CLAUDE.md` § "Styling" — token-driven, `useThemeColors()`, **never hardcode hex**; Lucide icons
  only; four themes.
- `CLAUDE.md` § "Design Findings (v15.0 overhaul)" — **the `sketch-findings-codepulse` skill and the
  entire Borealis Console overhaul are HELD for milestone v15.0. Phase 114 is v14.0: do not pull any
  piece of it in, including quick-wins.**
- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — relevant here mainly as the reason D-02
  keeps this phase off the write path entirely, and the note that every public Convex function is
  callable with no credential (the basis for rejecting a new query in D-13).
- `CLAUDE.md` § "Patterns" — `SectionErrorBoundary` around widget groups. An unhandled `useQuery`
  throw unmounts the React tree and blanks the whole page (recorded twice: Phase 110's `/analytics`
  incident and the `heroStats` incident).

### The folded todo

- `.planning/todos/pending/111-devtools-issues-panel-entry-unexamined.md` — D-18's source. Its "How to
  close it" section is the four-step procedure to fold into the operator checkpoint.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`ForceGraphCanvas`** — already owns hover state, click-to-center, the dark glow container and
  the dimming `focusSet`, and delegates all domain encoding to callbacks. `communityColorFn` gives
  D-06's access halo for free. Its `ForceGraphHandle` supplies `zoomToFit` for post-expand framing.
- **`CodeVaultGraph`** — the working example of a domain graph on that canvas, including its
  tooltip treatment (it has dedicated tooltip tests worth reading before writing new hover code).
- **`useThemeColors` + `resolveThemeColors`** — theme resolution with a `MutationObserver` on
  `data-theme` already handled; consume it rather than reading CSS vars directly.
- **`usePrivacy`** — the app-wide masking contract D-15 plugs into; `src/lib/privacy.ts` holds the
  masking helpers.
- **`SectionErrorBoundary`** — wrap the canvas and the coverage strip separately so a render fault in
  one doesn't blank the page.
- **`src/test/projectGraphFixture.ts`** — the existing pattern for fixturing a graph query's return
  shape into the `useQuery` mock. D-16's workspace fixtures should follow it.

### Established Patterns

- **Custom hooks wrap `useQuery`** — `src/hooks/useFoo.ts` returning `useQuery(...) ?? []` to handle
  the loading `undefined`. A `useWorkspaceMap` hook follows `useProjectGraph.ts` directly.
- **Nav entries live in `navRegistry.ts`**, consumed by both `DashboardLayout` and `CommandPalette`.
- **Fixed force-graph layouts need `cooldownTicks=0` plus explicit coordinates** — setting one
  without the other does not pin the layout (recorded SkillVault lesson).
- **An unhandled `useQuery` throw unmounts the React tree**, blanking every page using it — the
  reason error boundaries are non-optional here.
- **Coverage-honest reporting** — `hooks/skillScan.mjs`'s per-sub-source coverage declaration is the
  convention `workspaceSnapshots.coveredRoots` / `scannedRootsComplete` follow; D-14 renders it.

### Integration Points

- New page `src/pages/WorkspaceMap.tsx`, lazy-imported and routed in `src/App.tsx`, with its nav entry
  added to the GRAPHS group in `src/lib/navRegistry.ts`.
- New hook over `api.workspace.getWorkspaceMap`; a second thin read for D-11's arms probe.
- One backend edit: `convex/graphSnapshots.ts` `listSnapshots` return shape (D-13).
- No new Convex tables, no new mutations, no ingest surface. This phase does not write.

</code_context>

<specifics>
## Specific Ideas

**The live snapshot, measured 2026-08-13** (aggregated to counts only — root and directory names
deliberately not recorded here, per Phase 115 D-17). The planner should re-derive these rather than
trust them if the nightly scan has run since:

```
totalDirs 4,912 · totalFiles 229,210 · withheld 5,677 · 32.96 GB · activeVersion 10
53 roots, 53 covered, scannedRootsComplete=true, accessDerivationOk=true, localConfigStatus=merged
depth 0: 53 | 1: 333 | 2: 730 | 3: 1,563 | 4: 904 | 5: 499 | 6: 383 | 7: 216 | 8: 231
dirs per root, desc: 1041, 601, 489, 482, 421, 231, 204, 149, 120, 99, 99, … (19 roots hold ≤10)
Personal 2,339 · Consulting 1,324 · Unclassified 695 · Work 554
local-only 3,389 · astridr-reachable 1,523
1,092 dirs hold withheld files · 1,034 dirs hold zero visible files
getWorkspaceMap payload: 1.35 MB
```

- **The lopsidedness is the design pressure.** Two roots hold a third of the tree while 19 roots hold
  ten or fewer. Any layout that gives every root an equal angular sector will look wrong; any layout
  that sizes sectors by content will crowd the small roots into slivers. This is the concrete problem
  D-08's angular allocation has to solve, and it is left to the planner.

- **1,034 directories hold zero visible files.** Some are pure structure; some may be directories
  whose entire contents were withheld. The map should not silently treat those two as the same thing
  — a directory with `fileCount: 0, withheldCount: 12` is a very different fact from
  `fileCount: 0, withheldCount: 0`. Raised and not resolved; the planner should decide the treatment.

- **23 of 53 roots are Unclassified.** Per Phase 115's D-15/D-16 this is expected and correct, not a
  fault — the vault, `.claude` and `.claude-alt` genuinely mix all three contexts, and every
  ambiguous root was deliberately declared Unclassified rather than guessed into a department. It
  must therefore **not** render as an alarm. It is, however, the cue to re-map real ones in a local
  config edit; whether the strip makes that actionable is deferred below.

- **Verified for the planner, so it is not re-derived:** `getWorkspaceMap` returns all 4,912 rows
  successfully from a live run — the 4,096-read ceiling Phase 115 hit is mutation-path only.
  `listSnapshots` has zero `src/` consumers (control: `getProjectGraph` has 6 under the same search).
  astridr-repo is on `milestone: v28.0` with no v29 and no A1–A3 phase in its ROADMAP.

</specifics>

<deferred>
## Deferred Ideas

- **A bounded/paged `getWorkspaceMap` variant** (rootId + maxDepth args). Considered under D-02 and
  not taken — the single fetch is 1.35 MB and works today. Becomes necessary if the tree outgrows a
  single fetch; the tell would be the query approaching a read or size ceiling.
- **A version/history control for the workspace lens** — `storedVersions` keeps 3 versions, so
  "diff last night against tonight" is latent in the data. Its own capability, its own phase.
- **Making the 23 Unclassified roots actionable** from the coverage strip (a "re-map these" affordance
  pointing at the local config). Raised while discussing D-14; not taken, because the config is a
  gitignored host file this UI cannot write.
- **`latestMtime` as a visual treatment** (recency/staleness per directory — dimming cold subtrees).
  Real signal sitting unused in the payload; not taken to keep the encoding to two dimensions.
- **A "reveal in explorer" action** in the side panel. Considered under D-09 and rejected: needs a
  host-side listener or gateway route that does not exist — the same blocker that killed Phase 115's
  "rescan now" button, which remains deferred.
- **A fixture-backed ARMS renderer** for the Ástríðr lens. Rejected under D-10; belongs with astridr
  A3 in v29, where the real node shape will be known.
- **Per-file detail via the donor's expandable-node model.** Deferred by Phase 115's D-13; revisit
  only if directory-level granularity proves insufficient once the map is in use — which is a
  question 114 is the first phase able to answer.
- **Search / filter as an alternative to clicking down** the tree. Raised as remaining ground on
  scale and not pursued; a real capability of its own.
- **Fixing `sweepGraphSnapshotVersions`' timeout** (`convex/crons.ts:145-151`, disabled since
  2026-07-14). Inherited from Phase 115's deferred list; STATE.md records it now has an identical
  `collect()`-with-a-delete-cap defect to the one 115 found, very likely the same root cause
  misdiagnosed. Still a Phase-83 backend repair, not this phase's scope.

### Reviewed Todos (not folded)

- `llm-analytics-rollup-migration-cr01.md` (score 0.2, matched only on the keyword "phase") — moving
  three `/analytics` queries off raw `llmMetrics` onto the `aggregates` rollups. Excluded by its own
  trigger condition: it fires on "the next Analytics-touching phase" and 114 touches nothing in that
  subsystem. Its frontmatter also scopes it as `Medium (one phase)`, so folding it would roughly
  double this phase with unrelated backend work.

</deferred>

---

*Phase: 114-workspace-map-view*
*Context gathered: 2026-08-13*
