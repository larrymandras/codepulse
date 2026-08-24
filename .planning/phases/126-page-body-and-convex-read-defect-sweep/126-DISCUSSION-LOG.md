# Phase 126 — Discussion Log

**Date:** 2026-08-24
**Mode:** default (interactive), `ADVISOR_MODE=false`, no flags
**Human reference only** — downstream agents read `126-CONTEXT.md`, not this file.

## Areas offered, and selected

All four offered areas were selected: Inbox count semantics · Badge read shape · tool-galaxy
remedy · Handling the un-root-caused items.

## Area 1 — Inbox count semantics

**Q1: What should `/inbox`'s tab counts mean when there are more items than the read returns?**
Options: declare the cap (recommended) · true counts via filtered count queries · raise the 200 cap.
**Chosen: declare the cap.** → D-01

**Q2: How should the truncation be declared, given the held true-count is already available but
others aren't?**
Raised because "Held 9 of 46" needs the 46 — i.e. the count query Q1 had just declined. Grounding
the options in code showed the held count is ALREADY in the client for free, via the shell-level
badge subscription at `DashboardLayout.tsx:137`.
Options: precise where free / generic elsewhere (recommended) · uniform generic marker · one notice.
**Chosen: precise where free, generic elsewhere.** → D-02

## Area 2 — Badge read shape

Q1's answer created a constraint carried into this area: if the page renders "9 of 46" from the
badge's number, capping the badge propagates the cap into the page's "of N". Stated before asking.

**Q1: How should the every-route badge get its held count without capping the shared query
`focus_digest.py` needs?**
Options: count-only query with cap + truncated flag (recommended) · separate bounded row query ·
bound the shared query and paginate the server consumer.
**Chosen: count-only query.** → D-03, and the constraint recorded as D-04.

## Area 3 — tool-galaxy remedy

**Deviation from a pure discussion turn, deliberately.** The todo says "read the query first" and
the ROADMAP flags the item as hypothesis-only, so rather than offer options built on a guess, the
query was read (`convex/graphSnapshots.ts:416` — two unbounded `.collect()`s) and the graph size
measured live via `graphSnapshots:listSnapshots`:

```
nodeCount: 4001   linkCount: 2590   ->  6591 rows against a 4096 read ceiling
```

That converted the item from hypothesis to diagnosis before any option was presented, and it
changed the shape of the options — in particular it exposed that nodes alone sit at 4,001 against
4,096, i.e. **95 rows of headroom**, which is what disqualified the otherwise-cheapest option.

**Q1: Which remedy?**
Options: precomputed blob, one read (recommended) · split into two queries · bound with a cap ·
lower the upstream per-source cap.
**Chosen: precomputed blob.** → D-05 (the diagnosis), D-06 (the remedy, with all three rejections
and their reasons recorded so they are not revisited blindly).

## Area 4 — Handling the un-root-caused items

Opened by correcting the premise: the list is now TWO, not three, because Area 3 root-caused
`/tool-galaxy`.

**Q1: How should `/automation` and the Alert Rules overlap be planned, given neither is
root-caused?**
Options: measure-first task inside each plan (recommended) · separate spike plans in an earlier
wave · defer both out of the phase.
**Chosen: measure-first task inside each plan.** → D-07, D-08

## Notes

- **Scope creep:** none. The other nine pending todos were reviewed and explicitly not folded;
  the ROADMAP fixes this phase at seven items. Recorded under `<deferred>`.
- **A tool whose output was discarded:** `gsd-sdk query todo.match-phase 126` returned all 16
  pending todos at an identical `0.60` with every title "Untitled", matching on boilerplate
  keywords present in every file. A matcher that scores everything identically is not
  discriminating, so its output was not used for scoping; the ROADMAP's explicit seven were.
