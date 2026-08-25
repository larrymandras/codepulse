---
id: TODO-automation-page-placeholder-cards-and-invalid-expression
status: pending
planted: 2026-08-21
planted_during: Phase 124 — operator hit it during the 124-11 checkpoint while visiting /automation, one of the five routes that moved domain in the regroup
trigger_when: Next Automation- or Convex-transport-touching phase. No longer cosmetically severe (the parse half is fixed); the remaining half is a real ~9-10s perceived load latency on first page visit.
scope: NARROWED 2026-08-24 (126-03, D-07 Task 2) — the "Invalid expression" half is FIXED (see below). Only the stat-card half remains, and it is now measured, not merely observed.
source: src/pages/Automation.tsx; convex/automation.ts:135-157 (cronSummary); measured live against the self-hosted deployment
resolves_phase: 126 (parse half only)
last_reviewed: 2026-08-24
---

# `/automation` stat cards resolve after a ~9-10s COLD SUBSCRIPTION delay, not never — mechanism unconfirmed

## RESOLVED 2026-08-24 (Phase 126-03, D-09/D-10): the "Invalid expression" half

`CRON_SCHEDULES[].interval` is a human-readable label by design ("Every 5 min", "Daily
03:00 UTC"); `Automation.tsx` was assigning it into a field literally named `expression`,
which `CronJobList.tsx` then ran through a 5-field cron parser that rejected all twelve.
Fixed by gating the parser (and the row's now-also-dead edit affordance, D-10) behind
`isValidCron()`. See `126-03-SUMMARY.md`. **Do not re-open this half.**

## STILL OPEN: the three stat cards ("Runs (1h)", "Failed (1h)", "Avg Duration")

### What was observed originally (2026-08-21, live, operator screenshot)

Four tiles across the top. The first renders correctly — `CONFIGURED SCHEDULES / 12`
(a static constant, not a query). The other three render as **purple skeleton
placeholder bars** that appeared, to a glance, to never resolve.

### Measured 2026-08-24 (126-03 Task 2, D-07) — they DO resolve, after a fixed delay

**(a) The query itself is fast and healthy, read-only, live self-hosted deployment:**
```
npx convex run automation:cronSummary '{}' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
{ "avgDurationMs": 1433.8125, "failed": 0, "succeeded": 16, "totalJobs": 12, "totalRuns": 16 }
```
Returned in well under a second from the CLI. **This rules out a read-ceiling breach or a
slow/throwing query** — the candidate `.collect()` mechanism named in 126-PATTERNS.md was
not confirmed; do not re-propose bounding `cronSummary` without new evidence.

**(b) Browser instrumentation (Playwright, WS-frame-level, correlated by queryId) shows a
precise, reproducible pattern across 3 independent page loads (2 dev, 1 production build
with StrictMode's double-invoke ruled out):**

- A query already subscribed elsewhere in the same session (`automation:recentCrons` with
  `{}` args — pre-warmed by the shell-level `useNavCounts`/`useCommandPaletteSearch` hooks,
  see `src/hooks/useNavCounts.ts:22`, `src/hooks/useCommandPaletteSearch.ts:30`) delivers
  its first value in **25-43ms**.
- The four queries genuinely new to the session — `automation:cronSummary`,
  `automation:recentCrons {limit:200}`, `automation:recentHeartbeats {limit:30}`,
  `automation:recentJobs {limit:100}` — deliver their first value **simultaneously**
  (within 4ms of each other, despite querying four different tables at different
  complexities) after a delay that measured **9028ms, 9117ms, and 8752-8775ms** across
  three separate page loads.
- **Decisive control:** navigating away from `/automation` and back within the *same*
  WebSocket session made the identical four queries resolve in **4ms** (queryId
  re-subscribed at t+13051ms, updated at t+13055ms) — i.e. once warm, instant. Cold vs.
  warm is the discriminator, not query cost, not StrictMode (production build reproduces
  the ~9s delay identically with no double-subscribe churn), not table size.

### What this measurement does NOT establish

**The mechanism behind the ~9s cold-subscription delay is unconfirmed.** It is not a
per-query computation cost (all four resolve together regardless of complexity), not a
dev-mode artifact (reproduces in a production build), and not explained by anything in
`convex/automation.ts`. Candidates not yet tested: a fixed poll/sync interval in the
self-hosted backend's reactivity engine for brand-new subscriptions vs. push-on-write for
already-watched queries; a per-connection subscription-registration cost; something
specific to this self-hosted instance vs. Convex Cloud. **Do not guess between these
without a new measurement** — see next probe.

### Next probe

- Instrument the self-hosted backend's own logs/source (`convex-backend` container) around
  a fresh `ModifyQuerySet` Add for a genuinely new udfPath+args pair, to see what it is
  waiting on for ~9s before the first push.
- Test the identical WS-level probe (Playwright + queryId correlation, method already
  built and reusable — see 126-03-SUMMARY.md for the script) against a **different**
  self-hosted deployment or a Convex Cloud deployment, to isolate whether this is
  self-hosted-specific.
- Once the mechanism is known, decide whether a fix belongs in the app (e.g. pre-warming
  `automation:cronSummary` at shell level the way `recentCrons {}` already is) or is a
  backend/deployment-level characteristic to accept and document.

### Severity re-assessment

Not a correctness bug and not unbounded-read risk. It is a real ~9-10 second wait before
an operator sees the three summary tiles populate on first visit to `/automation` in a
session — long enough that a glance-and-leave visit (exactly what produced the original
2026-08-21 screenshot) reads as "broken" when it is actually "slow to arrive."
