---
phase: 112-telemetry-coverage-closure
plan: 07
status: complete
completed: 2026-08-13
requirements: [TELE-01, TELE-03]
autonomous: false
---

# 112-07 — Deploy and live proof

Executed **inline in the orchestrator session**, not via a subagent. The plan requires operator
authorization for a production deploy and an operator observation that cannot be self-approved;
relaying either through a subagent would have re-broadcast consent the operator gave to this
session. Authorization was obtained in-session, before the command ran.

Full command transcripts, outputs, controls and measurements: `112-LIVE-EVIDENCE.md`.

## What happened

| Task | Outcome |
|---|---|
| 1 — Deploy to self-hosted Convex | **PASS** |
| 2 — Live probes (D-04, D-14, D-13) | **PASS**, except D-13 recorded **OPEN** by design |
| 3 — Operator UI confirmation | **PASS** — approved 2026-08-13 |

### Task 1

`npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile`, exit 0.
Deployment target line `http://127.0.0.1:3210` — the self-hosted instance. `tidy-whale-981`
appears nowhere in the output. No `--push`, no `--prod`, not `npm run deploy`.

Pre-deploy the surface was confirmed to be this phase's work only: `git diff eb084397..HEAD --stat
-- convex/` was empty, and the concurrent Phase 115 session had touched no `convex/` file (its
changes are confined to `hooks/`, which `convex deploy` does not ship).

Both new function surfaces were then proven reachable, each paired with a bogus-name control that
returned `Could not find function`. `messageRoutes:listRecent` returning `[]` is a **deployed and
empty** surface; the control is what distinguishes that from a missing one.

### Task 2

**D-14 proven in production.** Over a ~19.75 h window: 50 domain rows, 50 generic `events` rows,
shortfall **0**, and the **timestamp multisets are identical** — a one-to-one correspondence, not
merely equal counts. Zero rows store `heldReason === null`; the explicit JSON null becomes an
absent field, which is precisely the mechanism whose absence made Phase 108's `control_verb_swap`
land zero rows while reporting `dropped: 0`.

**D-13 recorded OPEN, not passed.** `messageRoutes` is deployed and reachable but holds 0 rows.
That zero is explained by a paired measurement — `message_routed` runs at ~0.7–1.2 rows/day — not
asserted away. Stated as "route deployed, end-to-end delivery unproven".

### Task 3

Operator approved after reviewing the running Settings → notifications tab. All seven observation
bullets are evidenced in `112-LIVE-EVIDENCE.md`. One reported discrepancy — rows not visible at
the quoted timestamps — was investigated and resolved as a scroll position, proven by the
operator's screenshot sharing an identical bottom edge with the live query, which a stale page
could not have.

## Deviations

**Two measurement errors made and corrected before anything was written as fact.** Both are
recorded because the corrected method is the reusable part:

1. Comparing `74 generic since T0` against `50 domain rows` would have manufactured a false
   shortfall of 24. `listRecent` is `.take(50)`-bounded, so the domain read is truncated by the
   CAP, not by data loss. The comparison must be confined to the window the capped read covers.
2. Joining the two tables on `_creationTime` produced a shortfall of **−1**. The generic row and
   the domain row are separate inserts milliseconds apart, so domain-derived window bounds clip
   the boundary rows. The correct join key is the event's own `timestamp`, identical in both.

A `-1` was not dismissed as noise; the comparison was rebuilt until it was exact.

## Unresolved — carried forward

**An unattributed deploy preceded this session's.** Domain rows exist from `16:00:53Z`, 9 m 26 s
before T0. `governor_decision` arrives as an hourly burst; the `15:00:52Z` burst is present in
generic `events` but **absent** from the domain table, while `16:00:53Z` is in both. That bounds a
deploy of this phase's code to **between 15:00:52Z and 16:00:53Z**, from a source this session
cannot identify. No `npx convex dev` process is running (checked all `node.exe` command lines, with
vite/forge/next visible as a control proving the probe works). Candidates, neither confirmed: one
of this phase's executor agents — each was explicitly forbidden to deploy and each asserted it ran
none — or the concurrent Phase 115 session in the same checkout.

This does not affect the verdicts: this session's deploy re-pushed the same committed HEAD, exited
0, and reported `Schema validation complete`. It is recorded because an unattributed production
deploy is worth knowing about, and because T0 is therefore not the moment the route went live.

## Self-Check: PASSED

- Deploy used `--env-file`, exited 0, target line quoted verbatim, no `tidy-whale-981`.
- Every probe paired with a discriminating control; every absence claim carries a control that
  could have shown presence.
- Unit sanity checked: `_creationTime` is epoch ms, event `timestamp` is epoch seconds; formatted
  newest row matches wall-clock date.
- D-13's zero is explained by measurement, never claimed as proof the route works.
- Operator checkpoint was not self-approved.
