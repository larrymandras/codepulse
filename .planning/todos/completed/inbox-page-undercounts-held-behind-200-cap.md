---
id: TODO-inbox-page-undercounts-held-behind-200-cap
status: closed
planted: 2026-08-21
planted_during: Phase 124 — surfaced when the new sidebar badge (46) and the /inbox page's own Held tab (9) rendered contradictory figures on screen simultaneously in the operator's checkpoint screenshot
trigger_when: Next /inbox-touching phase, batched with the other Convex items so they share ONE operator deploy
scope: Small-to-medium (one plan) — decide what /inbox's tab counts should MEAN, then make the read match
source: src/pages/Inbox.tsx:130,317-362; convex/inbox.ts:173,187
resolves_phase: 130
closed: 2026-08-27
closed_by: 128-02
last_reviewed: 2026-08-27
---

# `/inbox` under-counts held items — page says 9, reality is 46

## What was observed (2026-08-21, live)

The operator's screenshot shows both figures at once:

- Sidebar **Inbox badge: 46**
- `/inbox` page tabs: **All 139 · Cards 130 · Held 9**

## Which one is right

**The badge.** It reads `inbox.listHeldUnacked` (`convex/inbox.ts:206-214`) — index-scoped
on `by_itemType`, uncapped, filtered on `ackedAt === undefined`.

The **page** builds its tabs from `inbox.listAll`, which is capped:

```ts
const DEFAULT_LIST_ALL_LIMIT = 200;     // convex/inbox.ts:173
  ...
  .take(limit ?? DEFAULT_LIST_ALL_LIMIT); // :187
```

Only 9 held rows fall inside that most-recent-200 window. Both sides define "unread"
identically — `src/pages/Inbox.tsx:130` maps `read: row.ackedAt != null` — so the 200-row
cap is the **sole** cause of the discrepancy. Ruled out as a contributing factor.

## This is PRE-EXISTING, not caused by Phase 124

`git log --grep="(124-" -- src/pages/Inbox.tsx` returns 0 commits. The page has been
under-reporting held items for as long as the cap has been there. What Phase 124 did was
put the honest figure next to it in the shell, which is how a months-old undercount
became visible in one screenshot.

Planning for D-10 measured the live table at **2,777 inbox rows, 1,827 unacked** (card
1,351 / notification 404 / held 46 / signal 26). So `listAll().length` renders a
permanently frozen 200 against that population — this is not a marginal error.

## The decision this needs

Not a mechanical fix. Someone has to decide what the page's tab counts should mean:

1. **True counts** — back each tab with its own index-scoped counting query (what the
   badge does). Correct, costs N queries.
2. **Honest capped counts** — keep `listAll` but surface the truncation, rendering `200+`
   / `9+` rather than a figure that reads as complete. Cheap, honest, less useful.
3. **Paginate** — the tabs count the full set while the list stays windowed.

Option 2 is the minimum bar: the current UI states a number that is simply false, with
nothing telling the operator it is a floor.

## Related

- `inbox-listheldunacked-unbounded-every-route.md` — the badge's own query is unbounded
  in the opposite direction. Fixing both together is coherent: one gets a bound, the
  other gets an honest count.

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06. Option 1 above ("true counts,
back each tab with its own index-scoped counting query") is what actually shipped, in
Phase 126 (SWEEP-01, SWEEP-03, D-03/D-04):

- `convex/inbox.ts:175,184-190` — `listAll`'s `DEFAULT_LIST_ALL_LIMIT` (200) is unchanged
  and still bounds the item LIST window, but no longer backs the Held tab's total.
- `convex/inbox.ts:247,269-288` — a new query, `countHeldUnacked`, bounded at
  `HELD_COUNT_SCAN_CAP = 2000` (~43x headroom over the ~46 held-unacked rows measured live
  at filing time), scoped on the same `by_itemType` index the badge uses, returning
  `{ count, truncated }`.
- `src/pages/Inbox.tsx:200,384-396` — the page now subscribes to `countHeldUnacked`
  (`heldTotal`) and derives the Held tab's "N of M" denominator from `heldTotal.count`
  whenever `heldTotal.truncated === false` (`heldTotalPrecise`); when truncated, it falls
  back to the honest floor marker (Option 2 above) rather than propagating a false precise
  number — Option 2 and Option 1 both landed, as a precise/fallback pair.
- `src/pages/__tests__/Inbox.test.tsx:330-352` carries the regression test proving it:
  `"Held tab renders the precise 'N of M' when countHeldUnacked has resolved and is
  untruncated"` with fixture `{ count: 46, truncated: false }` — the exact figure this
  todo's own filing cites as the correct (badge) value — paired with a control asserting a
  *truncated* `countHeldUnacked` does NOT render a false precise total.

**Verdict: ALREADY FIXED.** Both the badge and the page's Held-tab total now read from the
same bounded, itemType-scoped count. Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 2.

## Resolution (128-02, 2026-08-27)

Closed on re-derivation, not on new work performed by this plan (128-02 fixes no defects —
D-06/D-07). The fix itself landed in Phase 126; this session found and recorded that it had
already closed the gap this todo described. `resolves_phase` in the frontmatter is left at
130 (its filed value, confirmed correct against `.planning/REQUIREMENTS.md:246`'s
`FIX-03 | Phase 130 | Pending` row) for traceability — Phase 130 should verify this closure
against live data as part of its own re-derivation pass and flip `FIX-03` to Complete, since
REQUIREMENTS.md itself was found stale on this point (see the ledger's D-05 Finding 1).
