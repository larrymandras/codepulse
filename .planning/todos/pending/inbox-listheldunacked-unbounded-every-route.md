---
id: TODO-inbox-listheldunacked-unbounded-every-route
status: pending
planted: 2026-08-21
planted_during: Phase 124 (Shell & Information Architecture) — found by the phase's own code review (`124-REVIEW.md`, WR-01), confirmed independently by the orchestrator and again by `124-VERIFICATION.md`
trigger_when: The next Convex-touching phase, batched with the other two Convex items below so they share ONE operator deploy. Not a live outage — 46 rows today, contained by its own error boundary.
scope: Small (one plan) — add a bounded query, point the badge at it, leave the shared query alone
source: convex/inbox.ts:206-214; src/layouts/DashboardLayout.tsx:137; convex/inboxIngest.ts:174
resolves_phase: 128
last_reviewed: 2026-08-21
---

# `inbox.listHeldUnacked` is an unbounded `.collect()` on an every-route subscription

## What was observed

`convex/inbox.ts:206-214`:

```ts
export async function listHeldUnackedHandler(ctx) {
  const rows = await ctx.db
    .query("inbox")
    .withIndex("by_itemType", (q) => q.eq("itemType", "held"))
    .collect();                       // unbounded — no .take(), no cap
  return rows.filter((row) => row.ackedAt === undefined);
}
```

Plan 124-06 added the sidebar Inbox count badge, which subscribes to it from
`src/layouts/DashboardLayout.tsx:137`. The shell renders on **every route**, so this
unbounded scan now runs app-wide where its only prior consumer was a single server-side
`ctx.runQuery`.

## Why this matters

This is the **identical risk class that plan 124-03 bounded in the same phase**, for the
sibling badge. `convex/alerts.ts:131` now reads:

```ts
.withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
.order("desc")
.take(ALERT_COUNT_SCAN_CAP)          // 2000
```

D-13's justification was explicitly that the query "was about to run on EVERY route once
the shell subscribes to it." That reasoning applies verbatim here; the phase bounded one
badge's query and left the sibling's unbounded.

CodePulse has already hit this exact failure mode: see
`unbounded-analytics-scans-timeout.md`, and the `graphSnapshots:getProjectGraph` timeout
filed alongside this todo.

## Severity: Warning, not Critical

- Current volume is 46 live held-unacked rows.
- The badge is wrapped in its own `SectionErrorBoundary` with a fallback dot (124-06),
  so a timeout degrades to a dimmed dot rather than blanking the shell.

## The naive fix is WRONG

Do **not** add `.take(N)` to `listHeldUnackedHandler`. `convex/inboxIngest.ts:174` also
calls it via `ctx.runQuery` to feed `focus_digest.py`, which needs the **true unbounded
set** — capping the shared query would silently truncate that consumer with no error.

This is the "one set consumed for two different questions" shape: filtering it for one
caller breaks the other. **Separate the questions**: add a distinct bounded query for the
badge (mirroring `ALERT_COUNT_SCAN_CAP`, with an additive `truncated: boolean` so the
badge can render `{n}+`), and leave `listHeldUnacked` untouched for the digest.

## Verification when fixed

- Grep every consumer of both queries and confirm each reads the one it needs.
- Assert the digest path still receives an uncapped set (a test that crosses the cap
  boundary, not one that passes because the fixture is under it).
- Requires an operator `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`
  — per the Phase 121 record an agent structurally cannot run it.
