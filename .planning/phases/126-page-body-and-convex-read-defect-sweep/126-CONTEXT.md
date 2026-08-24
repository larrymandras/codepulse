# Phase 126: Page Body and Convex Read Defect Sweep - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the seven defects filed at `ec48907e` — six that Phase 124's shell surfaced but did not
cause, plus one evidence defect found while verifying it — so that every page the 124 regroup put
one click away actually works when opened.

Three items are Convex-side and share ONE operator deploy; four are frontend or test-side. The
phase does not add capabilities. It makes existing pages render their real content and makes
existing reads bounded and honest.

</domain>

<decisions>
## Implementation Decisions

### Inbox count semantics (the ROADMAP's flagged "product decision")

- **D-01: `/inbox`'s tab counts DECLARE their cap rather than pretending to be totals.**
  `listAll` stays bounded; the page surfaces that it is truncated. This is the same shape 125-02
  already established — a `truncated` flag returned to the consumer rather than a silently
  swallowed cap — and it satisfies success criterion 2's second branch ("or the capped one
  visibly declares itself capped"). **Rejected:** per-tab filtered count queries (honest numbers
  but adds N reads to the page and grows unbounded with the table); raising
  `DEFAULT_LIST_ALL_LIMIT` (still a silent cap, just a larger one, re-breaks at scale with no
  signal).

- **D-02: The Held tab shows a PRECISE "N of M"; other tabs get a generic truncation marker.**
  Rationale, and this is the load-bearing detail: rendering "Held 9 of 46" normally requires the
  count query D-01 rejected — but for Held *specifically* the true count already exists in the
  client for free. `listHeldUnacked` is subscribed at shell level for the sidebar badge
  (`src/layouts/DashboardLayout.tsx:137`), so the page can reuse that number at ZERO new read
  cost. This kills the exact contradiction the operator saw on screen (sidebar 46 vs page 9)
  rather than merely labelling it. Other tabs have no free count and get a generic marker.
  **Rejected:** a uniform generic marker for every tab (consistent, but leaves the observed
  contradiction visible-but-labelled); a single notice with no per-tab marks (least noise, but a
  glance at the tabs alone still misleads).

### Bounding the every-route badge read

- **D-03: Add a COUNT-ONLY query returning `{count, truncated}`, index-scoped on `by_itemType`
  with a hard `.take()` cap. Do NOT touch `listHeldUnacked`.**
  Satisfies criterion 3 (no unbounded shell subscription), leaves the shared query intact for
  `convex/inboxIngest.ts:174` / `focus_digest.py`, and ships a number to every route instead of
  46 row objects the badge never reads — it only needs `.length`. **Rejected:** a separate
  bounded *row* query (same isolation, but ships payloads nothing consumes); bounding the shared
  query and paginating the server consumer (the ROADMAP explicitly cautions against capping this
  query, and it changes a working server-side consumer to fix a client problem).

- **D-04: The badge's count must remain TRUE, not merely bounded — its `truncated` flag is what
  D-02's display consumes.** This is a constraint D-01/D-02 created: if the page renders "9 of 46"
  from the badge's number, a capped badge propagates its cap into the page's "of N". Pick the cap
  high enough that `truncated` is false in normal operation, and have D-02's display fall back to
  a generic marker when `truncated` is true.

### `/tool-galaxy` — ROOT-CAUSED DURING THIS DISCUSSION, no longer a hypothesis

- **D-05: The failure is a READ-CEILING breach, not a slow query.** Measured live against the
  self-hosted deployment via `graphSnapshots:listSnapshots` on 2026-08-24:
  `nodeCount: 4001`, `linkCount: 2590` — **6,591 rows read in one query against Convex's 4,096
  read ceiling.** `getProjectGraph` (`convex/graphSnapshots.ts:416`) performs two unbounded
  `.collect()`s on `by_snapshot_version`. The todo and ROADMAP both correctly recorded this as
  hypothesis-only; it is now diagnosed, with a number.

- **D-06: Remedy is a PRECOMPUTED BLOB read in a single row.** The writer (already an
  `internalMutation` doing the assembly) serializes the graph into one document or Convex file
  storage; `getProjectGraph` reads one row. Chosen because it is the only option without a cliff.
  **Rejected, with the reason recorded so it is not revisited blindly:** splitting into two
  queries works TODAY (4,001 and 2,590 each fit under 4,096, no data dropped) but leaves **95 rows
  of headroom on nodes** — one more source, or graphify emitting slightly more, and the page
  breaks again with the identical symptom. Also rejected: a `.take()` cap (never breaks, but
  renders a force-graph missing arbitrary nodes, which is misleading rather than merely
  incomplete); lowering the upstream 1,500-per-source emit cap (degrades every consumer of the
  snapshot to fix one page).

- **Note for the planner:** the stored snapshot is ALREADY truncated upstream — graphify emitted
  71,016 nodes for `astridr-repo` and 1,500 were stored (`truncated: true` per source). Whatever
  the remedy, the graph on screen is a sample, and that should not be presented as complete.

### Handling the items that are NOT root-caused

- **D-07: `/automation` and the Alert Rules row-overlap get a MEASURE-FIRST task inside their own
  plan.** Each plan opens with a task whose acceptance criteria are *the measurement itself*, not
  a fix; the fix task is then written against what it found. This honours the ROADMAP's caution
  that "planning must not convert a hypothesis into a task description that reads as a diagnosis."
  Precedent from this very discussion: one live query turned `/tool-galaxy` from a guess into
  "6,591 vs 4,096" in minutes (D-05). **Rejected:** separate spike plans in an earlier wave
  (cleanest separation, but the second half cannot be planned until the first half runs);
  deferring both out of the phase (`/automation` reads as fully broken — 3 of 4 stat cards never
  resolve and all 12 schedules say "Invalid expression" — so it stays visibly broken longer).

- **D-08: The un-diagnosed list is TWO, not three.** `/tool-galaxy` was root-caused during this
  discussion (D-05). Remaining hypotheses: `/automation` placeholder cards + invalid expressions,
  and Alert Rules rows overlapping.

### Claude's Discretion

- Exact wording and placement of the truncation markers (D-01/D-02) — a label, a suffix, or a
  notice line — is a presentation detail, not a decision that was made here.
- The specific cap value for D-03's count query, and the blob's storage mechanism under D-06
  (document field vs Convex file storage), are for research/planning to determine against the
  real row sizes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase scope itself — the seven todos
- `.planning/todos/pending/inbox-listheldunacked-unbounded-every-route.md` — Convex; root-caused; the ONE item of Phase 124's own making
- `.planning/todos/pending/tool-galaxy-getprojectgraph-timeout.md` — Convex; now root-caused by D-05, the file predates that
- `.planning/todos/pending/inbox-page-undercounts-held-behind-200-cap.md` — Convex; the product decision resolved by D-01/D-02
- `.planning/todos/pending/alert-rules-engine-rows-overlap.md` — Frontend; NOT root-caused, needs live DOM measurement
- `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` — Frontend; NOT root-caused
- `.planning/todos/pending/sidebar-4px-horizontal-overflow-separator.md` — Frontend; measured, one class, but do NOT just hide it with `overflow-x-hidden`
- `.planning/todos/pending/polish-geometry-spec-measures-cold-page.md` — Test/evidence; fix BEFORE that spec is used as a measurement source again

### Prior-phase decisions that constrain this one
- `.planning/phases/125-signature-layers/125-CONTEXT.md` — D-05 (the bounded-read shape: fixed module-constant window, hard `.take()`, `args: {}`, returned `truncated` flag), D-19-REVISED, D-20
- `.planning/phases/125-signature-layers/125-02-SUMMARY.md` — the reference implementation of that bounded read, including its separately-proven bounds
- `.planning/phases/124-shell-information-architecture/124-VERIFICATION.md` — where six of these seven defects were surfaced
- `CLAUDE.md` §"Convex & Frontend Lessons" — the 4,096-read ceiling (NOT the 16,000 figure in the docs), the no-silent-caps rule, and why an index cannot speed an unfiltered count

### Code the decisions touch
- `convex/inbox.ts:173,182-193` — `listAll` + `DEFAULT_LIST_ALL_LIMIT = 200`
- `convex/inbox.ts:206-214` — `listHeldUnackedHandler`, the unbounded `.collect()`
- `convex/inboxIngest.ts:174` — the server-side consumer that needs the UNBOUNDED set; must not be capped
- `src/layouts/DashboardLayout.tsx:137` — the every-route badge subscription
- `src/pages/Inbox.tsx:130,317-345` — tab counts derived client-side from the single 200-row `listAll` array
- `convex/graphSnapshots.ts:416` — `getProjectGraph`, the two unbounded `.collect()`s
- `convex/graphSnapshots.ts:503` — `listSnapshots`, the meta-only query used to take D-05's measurement

### Operational
- `CLAUDE.md` §"Deploying the Convex backend" — `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; `--env-file` is not optional, and `convex deploy` ships the WORKING TREE, not HEAD
- `.claude/skills/sketch-findings-codepulse/SKILL.md` — relevant only to the Alert Rules visual item

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The 125-02 bounded-read pattern** (`convex/events.ts`, `listRecentRuntimeWindow`): module-constant
  window, hard `.take(MAX_ROWS)`, `args: {}` so no caller can widen it, and a returned `truncated`
  flag. D-03's count query should copy this shape rather than invent one.
- **`convex/alerts.ts:131`** — the sibling badge already bounded in Phase 124 via
  `by_acknowledged`. The identical risk class, already solved once in this codebase.
- **`graphSnapshots.ts:252-278`** — the sweep mutation already demonstrates the house
  bounded-read idiom (`take(CAP + 1)` so "more remain" is visible) inside this very file.

### Established Patterns
- **No silent caps** — a cap must be declared to its consumer. Both D-01 and D-03 are applications
  of this rule rather than new policy.
- **Assert on the rendered result, not the absence of an error** — success criterion 1 says this
  explicitly, and Phase 125-13 is the cautionary case: every automated assertion passed against a
  signal a human could not see.
- **Convex read ceiling is 4,096 reads**, not the 16,000-writes figure the docs and some comments
  in this repo point at. D-05 is a direct consequence.

### Integration Points
- The sidebar badge and `/inbox` page must agree, or the capped one must say so — they are two
  consumers of what the operator reads as one number.
- `focus_digest.py` consumes `listHeldUnacked` server-side through `inboxIngest.ts:174`; any change
  to that query is a cross-repo change, which is why D-03 avoids touching it.
- Three Convex items share ONE operator deploy — the deploy is a scheduling constraint on plan
  ordering, not a per-plan step.

</code_context>

<specifics>
## Specific Ideas

- The observed contradiction that motivates D-01/D-02 is concrete and should be the acceptance
  criterion's target: the operator's screenshot showed **sidebar badge 46** and **page tabs
  "All 139 · Cards 130 · Held 9"** simultaneously. A fix that does not make those two readings
  reconcilable — either by agreeing or by one declaring itself capped — has not fixed it.
- D-05's measurement is reproducible and cheap:
  `npx convex run graphSnapshots:listSnapshots '{}' --env-file <envfile>` returns `nodeCount` and
  `linkCount` from the meta row without touching the failing path. Use it as the before/after
  control for D-06 rather than timing the page.

</specifics>

<deferred>
## Deferred Ideas

- **The other nine pending todos were reviewed and NOT folded.** Phase 126's scope is fixed by
  ROADMAP at exactly seven. Several are thematically adjacent — `unbounded-analytics-scans-timeout`
  is the same risk class as D-03, and `test-isolation-full-suite-only-failures` overlaps nothing
  here but is live — and folding them would be scope creep on a phase whose boundary is already
  explicit.
- **A tooling note, not a phase item:** `gsd-sdk query todo.match-phase 126` returned ALL 16
  pending todos at an identical score of `0.60` with every title rendered "Untitled", matching on
  boilerplate keywords (`todo`, `pending`, `phase`) present in every file. Its output carried no
  signal and was not used; the ROADMAP's explicit seven were used instead. Worth knowing before
  anyone trusts that verb for scoping.
- **`/tool-galaxy`'s graph is a SAMPLE, not the graph.** The upstream per-source emit cap of 1,500
  nodes (against 71,016 available for `astridr-repo`) is out of scope here, but whether a sampled
  graph is worth rendering at all is a real product question for a later phase.

</deferred>

---

*Phase: 126-page-body-and-convex-read-defect-sweep*
*Context gathered: 2026-08-24*
