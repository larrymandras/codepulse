# Phase 128 Plan 01: Todo Closure Adjudication Ledger

Re-derivation date: 2026-08-27.

## Method

The five claims below were re-derived from the live code in this worktree, per D-04 of
`128-CONTEXT.md`: **re-verify independently; do not inherit.** The claims being re-checked are
the scoping sweep's own hypotheses, filed in commits `89def342` and `02e6557e` and restated in
`128-CONTEXT.md`'s "Folded Todos" section and in `.planning/REQUIREMENTS.md`'s RECON-01 bullet.
No commit message was accepted as evidence for any verdict (per `CLAUDE.md`, a commit message is
a claim, not evidence) — every verdict below cites a `file:line` opened and read in this session,
plus, where relevant, the consuming call site that proves the fix is actually wired in (not just
present in the file).

## Verdicts

| Todo | Claim as filed | `file:line` read | What that code actually does | Verdict |
|---|---|---|---|---|
| `tool-galaxy-getprojectgraph-timeout.md` | Fixed by a chunked blob read in `convex/graphSnapshots.ts` with a chunk read cap (`GRAPH_CHUNK_READ_CAP = 16` per `128-CONTEXT.md`'s D-09 note) | `convex/graphSnapshots.ts:693-699`; consumer `src/hooks/useProjectGraph.ts:25` | `getProjectGraph` reads `graphSnapshotBlobChunks` via `.withIndex("by_snapshot_version_seq", (q) => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)).order("asc").take(GRAPH_BLOB_MAX_CHUNKS + 1)` — the bound is INSIDE the index range/take, not a post-read `.filter()`. `GRAPH_BLOB_MAX_CHUNKS = 16` (`:101`). No unbounded `.collect()` survives on this path (the old `graphSnapshotNodes`/`graphSnapshotLinks` two-collect() path is retired, `:293-306`). `src/hooks/useProjectGraph.ts:25` confirms `/tool-galaxy` actually calls `api.graphSnapshots.getProjectGraph`, not a different function. | **CONFIRMED FIXED — close** |
| `automation-page-placeholder-cards-and-invalid-expression.md` | Fixed by making `cronSummary` index-bounded (`convex/automation.ts:147` per `128-CONTEXT.md`) | `convex/automation.ts:148` | `cronSummary` reads `.withIndex("by_timestamp", (q) => q.gte("timestamp", oneHourAgo)).collect()` — the bound IS inside the index range callback, not a post-read `.filter()`. This specific fear (unbounded scan) is real and confirmed closed. **But** the todo's own body (last re-derived 2026-08-24, inside this same live corpus, not the scoping sweep) already found the query itself resolves in well under a second from the CLI and the actual user-facing symptom — the three stat cards render as skeleton placeholders for ~9-10s on first visit — persists via a *different, unconfirmed* mechanism (a cold-WebSocket-subscription delay, reproduced across dev and production builds, not explained by anything in `convex/automation.ts`). The todo's own frontmatter still reads `status: pending` and its own section header is literally "STILL OPEN". Closing this todo on the index-bound claim alone would be exactly the "I looked and it seemed fine" shortcut D-06 forbids — the bound closes one specific fear, not the todo's headline symptom. | **PARTIALLY FIXED — keep, scope narrowed** (see Findings) |
| `inbox-listheldunacked-unbounded-every-route.md` | Fixed by a bounded badge count with a scan cap (`HELD_COUNT_SCAN_CAP = 2000` at `convex/inbox.ts:278`) | `convex/inbox.ts:247,269-298`; consumer `src/layouts/DashboardLayout.tsx:146` | `countHeldUnacked` (new sibling query, `:269-298`) reads `.withIndex("by_itemType", (q) => q.eq("itemType", "held")).order("desc").take(HELD_COUNT_SCAN_CAP + 1)` at `:278` — bound is at the read, index-scoped, `HELD_COUNT_SCAN_CAP = 2000` (`:247`). `src/layouts/DashboardLayout.tsx:146` reads `useQuery(api.inbox.countHeldUnacked)`, confirming the sidebar badge (the every-route consumer named in the todo) was actually swapped onto the bounded query, not left on the old one — the todo's own explicit warning ("a bounded query that nothing calls fixes nothing") is satisfied. The original `listHeldUnackedHandler` (`:208-216`) is UNCHANGED and still unbounded, exactly as the todo prescribed ("the naive fix is wrong... leave `listHeldUnacked` untouched"), and `convex/inboxIngest.ts:174` confirms the digest consumer (`focus_digest.py`'s feed) still calls the unbounded `listHeldUnacked`, not the capped one — the "one set consumed for two different questions" split the todo demanded is in place on both sides. | **CONFIRMED FIXED — close** |
| `forge-loading-div-aria-prohibited-attr.md` | Fixed by a permitting role on the loading container in `ForgeJobList.tsx` (`role="status" aria-busy` at `:172-175` per `128-CONTEXT.md`) | `src/components/forge/ForgeJobList.tsx:171-176` | The loading container is `<div className="flex flex-col gap-2 p-3" role="status" aria-busy="true" aria-label="Loading jobs">` — `role="status"` (`:173`), `aria-busy="true"` (`:174`) and `aria-label="Loading jobs"` (`:175`) are all attributes of the SAME `div` opened at `:171-172`, and it is the loading-state element the todo names (guarded by `if (loading)` just above, `:167`). `role="status"` is a permitting role for `aria-label`, closing the `aria-prohibited-attr` violation. | **CONFIRMED FIXED — close** |
| `unbounded-analytics-scans-timeout.md` | Listed by RECON-01 among the eight already-fixed items; the todo's own scope line says "per-query triage keyed on table row count, NOT a mechanical sweep" | `convex/analytics.ts:17-33,35-55,57-86,88-109`; `convex/metrics.ts:16-34` | Three of the four queries the todo names ARE fixed: `activityHeatmap` (`:17-33`), `toolFlowSankey` (`:35-55`) and `tokenSunburst` (`:57-86`) now read the `aggregates` rollup table via `.withIndex("by_type_period_bucket", (q) => q.eq("metric_type", ...).eq("period", "hourly").gte("bucket_start", cutoff)).collect()` — bounded by a 90-day (or 30-day) index range, not a post-filter. `errorRateTrend` (`:88-109`, the todo's "observed-adjacent, not verified failing" fifth query) is bounded the same way. But the fourth named query, `metrics:dashboardSummary`, is **still fully unbounded**: `convex/metrics.ts:19` reads `const events = await ctx.db.query("events").collect();` with NO `.withIndex()` range and NO `.take()` — a bare full-table scan — and `:24` does the identical thing to `discoveredTools` (`const tools = await ctx.db.query("discoveredTools").collect();`). This is a live, unfixed defect matching `.planning/REQUIREMENTS.md`'s FIX-01 verbatim. | **PARTIALLY FIXED — keep, scope narrowed** (see Findings) |

## Findings (D-05)

**1. RECON-01 vs FIX-01 — the code supports FIX-01, not RECON-01's blanket claim.**
`.planning/REQUIREMENTS.md:33-36` (RECON-01) lists "unbounded analytics scans" among eight
items it calls already-fixed. `.planning/REQUIREMENTS.md:49-53` (FIX-01) simultaneously records
a LIVE unbounded read at `convex/metrics.ts:19` and assigns its fix to Phase 129; the todo file
itself (`unbounded-analytics-scans-timeout.md`) is tagged `resolves_phase: 129`, not 128. Both
statements cannot be true of the SAME defect population. Having read the code directly: the
truth is a split verdict RECON-01's single bullet does not have room for. Three of the four
originally-failing queries (`analytics:activityHeatmap`, `analytics:toolFlowSankey`,
`analytics:tokenSunburst`) genuinely were fixed — by Phase 121 (see `STATE.md`'s Phase 121 entry
and AR-01..03 in `.planning/REQUIREMENTS.md`), moved onto bounded `aggregates` rollup reads
before this phase ever started. The fourth, `metrics:dashboardSummary`
(`convex/metrics.ts:16-34`), was NEVER fixed and is a fully unbounded `.collect()` over the
entire `events` table — the exact shape FIX-01 describes, apparently found fresh during the
2026-08-27 scoping sweep (FIX-01's own text: "Found 2026-08-27"). **Verdict: FIX-01 is the
statement the code supports.** RECON-01's inclusion of "unbounded analytics scans" as a
blanket already-fixed item is WRONG as written — it should have said "three of four fixed by
Phase 121; the fourth (`convex/metrics.ts:19`) is FIX-01, assigned to Phase 129." The todo itself
already had this right (`resolves_phase: 129`), so no todo frontmatter needed correcting; the
drift is in RECON-01's prose, which this finding records rather than silently patches (RECON-01
is not a `files_modified` target of this plan — 128-02, or a future plan, owns any edit to
REQUIREMENTS.md's prose).

**2. `/automation` stat cards — the scoping sweep's "already fixed" framing outran the todo's
own evidence.** `128-CONTEXT.md`'s Folded Todos section states this todo is "ALREADY FIXED and
what remains is closing them with evidence," citing the `cronSummary` index-bound. The bound is
real (`convex/automation.ts:148`) and closes the specific read-cost fear the sweep named. But the
todo's own body — last re-derived 2026-08-24 by Phase 126, inside the live corpus the sweep was
supposed to be checking against — already shows the actual observed symptom (skeleton
placeholders visible for ~9-10 seconds on first page load) persists through an unconfirmed
different mechanism, and the todo's own frontmatter is still `status: pending`. The scoping
sweep's one-line "already fixed" tag did not account for a re-derivation the corpus already
contained. Recorded here per D-05, not silently corrected in `128-CONTEXT.md` or REQUIREMENTS.md
(neither is a `files_modified` target of this plan).

**3. Two `file:line` citations in `128-CONTEXT.md` drift slightly from what the code contains.**
Neither changes a verdict, but D-06's "cite the line you actually read, not the line the todo
named" applies:
- `128-CONTEXT.md`'s Folded Todos entry for `tool-galaxy-getprojectgraph-timeout.md` names the
  constant `GRAPH_CHUNK_READ_CAP = 16`. The actual constant in `convex/graphSnapshots.ts:101` is
  named `GRAPH_BLOB_MAX_CHUNKS`, value 16. Same value, different identifier — likely a
  paraphrase written during scoping rather than a copy-paste from source.
- `128-CONTEXT.md`'s entry for the automation todo cites `convex/automation.ts:147` as where
  `cronSummary` is index-bounded. The actual `withIndex(...)` call is on `:148`; `:147` is the
  last line of the explanatory comment immediately above it.

**No other disagreements found.** The `inbox.listHeldUnacked` and Forge ARIA claims were checked
against both the code AND their consumers (not just presence-in-file) and matched the sweep's
framing exactly, including the specific warnings each todo raised about naive fixes (the
"one set consumed for two questions" split for inbox, and the same-element role/attribute
requirement for Forge) — both hold.

## Not done here

No defect described by any of the five todos was fixed by this plan — including
`convex/metrics.ts:19`'s live unbounded scan, which stays open for Phase 129 (FIX-01/FIX-02) exactly as
already tagged, and the `/automation` cold-subscription delay, which stays open with its scope
narrowed to the delay mechanism alone.
