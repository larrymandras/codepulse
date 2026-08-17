# Phase 114: Workspace Map view - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 114-workspace-map-view
**Areas discussed:** Scale & drill-down, What the rings mean, Lens switcher, Coverage & withheld honesty, Todo folding

---

## Scale & drill-down

### Q1 — What does the map show on first load, and how do you get deeper?

| Option | Description | Selected |
|--------|-------------|----------|
| Roots + 1 level, expand on click | 386 nodes on load (53 roots + 333 depth-1); clicking a root expands children in place | ✓ |
| Roots only, drill into one at a time | 53 nodes; clicking replaces the view with that root's tree, breadcrumb back | |
| All 4,912 at once | Everything rendered, readability by zoom | |

**User's choice:** Roots + 1 level, expand on click.
**Notes:** Node count became 391 once D-05 added the center and four department hubs. Rejected options failed on: two clicks to see anything concrete and loss of the cross-root view (drill-in), and 4,912 canvas nodes where two roots visually swamp the other 51 (render-all).

### Q2 — Client-side expansion off one payload, or server-side per expansion?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch all once, expand client-side | One subscription (1.35 MB); Phase 114 adds zero Convex code | ✓ |
| Add a bounded query, fetch per expansion | ~110 KB first load, round-trip per expand | |
| Fetch all once, but add the bounded query too | Both paths | |

**User's choice:** Fetch all once, expand client-side.
**Notes:** The rejected hybrid was declined partly because the second path would stay unexercised until needed. The bounded query survives as a deferred idea for when the tree outgrows a single fetch.

### Q3 — When you expand a root, how much comes out?

| Option | Description | Selected |
|--------|-------------|----------|
| One level per click | Consistent at every depth; never dumps 1,041 nodes | ✓ |
| Whole subtree on click | Fast for the 19 small roots, brutal on the two large ones | |
| One level, auto-expanding thin chains | Fewer dead clicks, unpredictable node count per click | |

**User's choice:** One level per click.

### Q4 — What should a collapsed node show, given counts are stored as direct-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Rolled-up subtree totals | Computed client-side; a collapsed root reads as its whole subtree | ✓ |
| Direct contents only, as stored | Nothing inferred, but a 1,041-directory root can display 3 files | |
| Both — rolled-up on the node, direct in the panel | Distinction visible where there's room to explain it | |

**User's choice:** Rolled-up subtree totals.
**Notes:** The third option's substance was folded into D-09 anyway — the side panel carries both figures.

**Continue check:** Next area. (Unexplored: the 1,034 zero-file directories, the depth-8 tail, search/filter as an alternative to clicking down — all recorded as deferred or open in CONTEXT.md.)

---

## What the rings mean

### Q1 — What does the radial geometry encode?

| Option | Description | Selected |
|--------|-------------|----------|
| Center → departments → roots → dirs | Four department hubs on ring 1; closest true analog of ARMS | ✓ |
| Center → roots → dirs, department as color | Flatter, closer to the data's real shape, but 53 nodes on one ring | |
| Center → access → roots → dirs | Answers "what can Ástríðr see" first; binary split into two huge hubs | |

**User's choice:** Center → departments → roots → dirs.
**Notes:** The design's own ARMS rings (Skills/Memory/Routines/Applications) have no counterpart in the workspace rows, so the ring axis had to be chosen from what the scanner emits: `rootId`, `dirPath`, `department`, `access`, counts.

### Q2 — What does node colour encode?

| Option | Description | Selected |
|--------|-------------|----------|
| Department fill + access halo | Uses ForceGraphCanvas's existing `communityColorFn` | ✓ |
| Access fill, department by position only | 3,389 of 4,912 dirs would be one flat colour | |
| Department fill, access in the side panel only | Reachability would need a click per node | |

**User's choice:** Department fill + access halo.

### Q3 — What does node size encode?

| Option | Description | Selected |
|--------|-------------|----------|
| File count, rolled up | 229,210 files; wide readable range; excludes withheld by construction | ✓ |
| Total bytes, rolled up | 32.96 GB, dominated by a few large binaries | |
| Uniform size, counts in the label | No distortion, but loses at-a-glance scale | |

**User's choice:** File count, rolled up.

### Q4 — How literally do we take "physics-off, fixed ring slots"?

| Option | Description | Selected |
|--------|-------------|----------|
| Fully deterministic slots, physics off | `cooldownTicks=0` + explicit coords; screenshot-testable | ✓ |
| Radial force constraint, let d3 settle it | Handles crowding automatically; positions shift on every expand | |
| Fixed rings for hubs, forces for leaves | Stable skeleton, organic detail; two layout systems | |

**User's choice:** Fully deterministic slots, physics off.

### Q5 — What does the side panel carry?

| Option | Description | Selected |
|--------|-------------|----------|
| Stored fields + rollup + withheld notice | Explicit line when `withheldCount > 0` (1,092 of 4,912 dirs) | ✓ |
| Stored fields only | Withheld count reads as a bare unexplained number | |
| Add a "reveal in explorer" action | Needs a host-side listener that doesn't exist | |

**User's choice:** Stored fields + rollup + withheld notice.
**Notes:** "Reveal in explorer" hit the same blocker that killed Phase 115's "rescan now" button; recorded as deferred.

**Continue check:** Next area. (Unexplored: link rendering between rings, label density at zoom, hover behaviour, `latestMtime` as a recency treatment — the last recorded as deferred.)

---

## Lens switcher

### Q1 — What happens to the Ástríðr lens in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Switcher present, Ástríðr lens as an honest empty state | Delivers two-lens scope; dependency visible in the product | ✓ |
| Workspace lens only, no switcher | Nothing dead ships; requires amending the ROADMAP goal line | |
| Switcher + fixture-backed Ástríðr lens | Second layout built against a schema A3 hasn't defined | |

**User's choice:** Switcher present, Ástríðr lens as an honest empty state.
**Notes:** Measured before asking — astridr-repo is on `milestone: v28.0`, its ROADMAP has no v29 and no A1–A3 phase, and grep finds no `arms` in it. The design anticipated this ("C1 ships with whichever lens has data first").

### Q2 — How does the Ástríðr lens know it's empty?

| Option | Description | Selected |
|--------|-------------|----------|
| Live probe for arms rows | Self-correcting the day A3 ingests | ✓ |
| Static message naming the dependency | Zero cost; a claim about another repo baked into this one | |

**User's choice:** Live probe.

### Q3 — Is the selected lens in the URL?

| Option | Description | Selected |
|--------|-------------|----------|
| URL search param | Bookmarkable, survives reload, directly testable | ✓ |
| Component state only | Less wiring, no deep link | |

**User's choice:** URL search param.

### Q4 — Reconciling the probe with "zero Convex code"

Raised by Claude, not by the user: D-02 had locked "Phase 114 adds zero Convex code" while D-11 locked a live arms probe. Checked and found the two collide — `listSnapshots` returns no `sources` field, and `getProjectGraph` would pull a 3,904-node graph to answer a yes/no.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `listSnapshots` to return `sources` | Zero consumers to break (control-paired); no new function | ✓ |
| Add a dedicated arms-presence query | New public function on a backend where all public functions are uncredentialed | |
| Drop the probe, use the static message | Keeps D-02 literally true; reverses Q2 | |

**User's choice:** Extend `listSnapshots` to return `sources`.
**Notes:** D-02 is therefore recorded as "one field added to one unused query", not literally zero.

**Continue check:** Next area. (Unexplored: a version/history control for the workspace lens — recorded as deferred; what the switcher does if the workspace snapshot is also missing.)

---

## Coverage & withheld honesty

### Q1 — Where does the coverage/honesty state live?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible header strip | Healthy shape stays familiar, so degraded is legible | ✓ |
| Only appears when degraded | Absence and being-broken look identical | |
| Collapsed status chip with a popover | Compact; puts the numbers one gesture away | |

**User's choice:** Always-visible header strip.

### Q2 — Does the map honour PrivacyContext?

| Option | Description | Selected |
|--------|-------------|----------|
| Honour `maskPaths` on labels | Consistent with FileTree/SessionHeader/BashLog; off by default | ✓ |
| No masking — it's a local dashboard | Nothing to build; no safe way to screenshot the screen | |
| Mask only Consulting-department labels | A second bespoke rule beside an existing app-wide one | |

**User's choice:** Honour `maskPaths` on labels.
**Notes:** Directly motivated by Phase 115's D-17 blocker — the same disclosure class.

### Q3 — How do we prove the degraded states render, when all flags are green?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixtures per flag + mutation test | Proves the assertions measure something | ✓ |
| Fixtures per degraded flag, no mutation test | Real branch coverage, but a vacuous pass reads as a real one | |
| Verify visually against live data | With all six flags green there is no degraded state to look at | |

**User's choice:** Fixtures per flag + mutation test.

### Q4 — Does the map say anything about freshness?

| Option | Description | Selected |
|--------|-------------|----------|
| Relative time + warn past one missed run | ~36h threshold; would surface a silently-stopped scheduler | ✓ |
| Relative time only, no warning | Stale looks identical to fresh unless you do the arithmetic | |
| Timestamp in the panel, nothing on the canvas | Freshness invalidates everything else on screen | |

**User's choice:** Relative time + warn past one missed run.
**Notes:** Phase 115's D-05 unattended firing was still open at discussion time (due 2026-08-14 morning), which is exactly what a staleness indicator would catch.

**Final check:** "I'm ready for context."

---

## Todo folding

Two pending todos keyword-matched phase 114; both had also been reviewed-and-not-folded at Phase 115.

The first version of this question was rejected by the user with a request for more detail. On re-reading both todo files, `llm-analytics-rollup-migration-cr01.md` was withdrawn from the question entirely rather than re-offered — its own frontmatter scopes it as `Medium (one phase)` and triggers on "the next Analytics-touching phase", which 114 is not. Offering it invited a wrong click.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold as observe-and-record only | Operator checkpoint gains one step; fixes filed against the owning phase | ✓ |
| Fold fully — investigate and fix in 114 | Open-ended browser investigation of unknown size | |
| Don't fold — record as reviewed | Keeps 114 strictly about the map | |

**User's choice:** Fold as observe-and-record only (→ D-18).
**Notes:** The badge was seen at Phase 111's checkpoint and the Issues tab was never opened; a clean console is not evidence about it, since Chrome's Issues panel aggregates findings that never print to the console.

---

## Claude's Discretion

- Ring radii, angular sector allocation, intra-ring collision handling.
- Department→theme-token mapping. Flagged constraint: `ThemeColors` exposes only five non-status tokens, so the `--chart-*` tokens likely need pulling in; Unclassified should read muted rather than as a fifth peer colour.
- Label density and zoom thresholds; link rendering between rings.
- The exact staleness threshold within the "one missed nightly run" intent.
- Component decomposition, file layout, and where the rollup computation lives.

## Deferred Ideas

Recorded in full in `114-CONTEXT.md` § Deferred Ideas. Raised during this discussion: a bounded/paged query variant, a version/history control, making the 23 Unclassified roots actionable from the strip, `latestMtime` as a recency treatment, "reveal in explorer", a fixture-backed ARMS renderer, per-file detail, and search/filter as an alternative to clicking down. Carried in from Phase 115: fixing `sweepGraphSnapshotVersions`' timeout, and the "rescan now" button.
