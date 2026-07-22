# Phase 102: Address tech debt — reminders dead code + astridr comment cleanup - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Close v12.0 milestone-audit tech-debt items 1 and 2 (of 4): remove the orphaned `dueSoon`/`overdue` dead code from `convex/reminders.ts` (codepulse), and eliminate the stale "two-backend / local 404s on /calendar-ingest" narrative from astridr-repo — including deleting the now-pointless `CodePulsePoster` class. Cross-repo cleanup phase (codepulse + astridr-repo), no new capabilities. Items 3 (QuickAdd NL date parsing) and 4 (boot-order transient) are explicitly OUT of scope.

</domain>

<decisions>
## Implementation Decisions

### Dead-query fate (audit item 1)
- **D-01:** DELETE `dueSoon`/`overdue` queries, their `dueSoonHandler`/`overdueHandler` functions (`convex/reminders.ts:390-422`), and their unit tests. Do NOT wire the nudge cron to them — the client-side `_is_due()` filter in `reminder_nudge.py` is live-verified (REM-05 passed live cron + dedupe) and the dedicated queries do an unbounded `.collect()` anyway, so they offer no server-side win as written.
- **D-02:** Drop the `reminders` table's `by_dueAt` index from `convex/schema.ts` — verified sole consumers are the two deleted handlers (live queries use `by_profile`). Run `npx convex codegen` after; deploy is an index DROP on the live self-hosted backend (cheap, no build).

### CodePulsePoster / comment cleanup (audit item 2)
- **D-03:** DELETE the `CodePulsePoster` class (`astridr/automation/calendar_cache.py:138+`). The calendar cron passes the shared `ConvexHandler` (`self._telemetry`) to `refresh()` like every other cron. Rationale: cloud deployment tidy-whale-981 is retired (2026-07-15); with `CODEPULSE_CONVEX_URL` unset the poster already resolved to the same URL as `ConvexHandler`, and the local backend DOES serve `/calendar-ingest` (`convex/http.ts:96-101`). `refresh()` stays duck-typed — tests keep injecting fakes.
- **D-04:** FULL astridr-repo sweep of the stale two-backend narrative — grep the entire repo for the "cloud vs local / local backend 404s / tidy-whale / two-backend" claims and fix every instance in one pass (per Larry's standing bug-fix rule: inventory ALL instances before fixing any). Known sites: `astridr/automation/calendar_cache.py:138-150`, `astridr/engine/bootstrap/cron_dispatcher.py:792-799`, and the "full two-backend note" in `astridr/tools/reminders.py` that both point to. Comments must state the current truth: one self-hosted backend, `/calendar-ingest` served locally.

### Phase scope
- **D-05:** Audit items 1–2 ONLY. Item 3 (QuickAdd NL date parsing) stays backlogged — it's real feature work. Item 4 (astridr `persistence.background_error` boot-order transient) stays parked on the `feature/brain-swap` WIP — touching bootstrap ordering from master invites a merge collision.

### Verification bar
- **D-06:** Static proof: both repos' suites green, `npx tsc --noEmit` clean (codepulse), `npx convex codegen` regenerated, and grep proves ZERO remaining references to `dueSoon`/`overdue`/`CodePulsePoster`/the stale two-backend claims.
- **D-07:** PLUS one live calendar-cron tick: deleting `CodePulsePoster` changes the live cron's code path (pushes now go through the shared `ConvexHandler`), so trigger one real `calendar_cache` refresh against the running astridr stack and confirm `pushed>0, failed=0` in the log and events render on `/reminders`. No full mini-UAT — 101-RETEST-UAT passed 7/7 on 2026-07-21.

### Claude's Discretion
- Exact commit sequencing across the two repos (follow Phase 101/98-05 precedent: per-repo commits, `git -C`, sequential).
- Whether `_is_due()` in `reminder_nudge.py` gains a short comment noting client-side filtering is the canonical design (superseding D-11's dedicated-query design).
- Handling of any additional stale-comment sites the D-04 sweep surfaces beyond the three known files.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope source of truth
- `.planning/v12.0-MILESTONE-AUDIT.md` — the 4 tech-debt items with file:line evidence; items 1–2 define this phase's entire scope (frontmatter `tech_debt:` block + §Tech Debt).

### Code under change
- `convex/reminders.ts` (L390-422) — the dead `dueSoonHandler`/`overdueHandler` + `dueSoon`/`overdue` exports to delete.
- `convex/schema.ts` (reminders table, ~L1845-1893) — `by_dueAt` index to drop.
- `astridr-repo: astridr/automation/calendar_cache.py` — `CodePulsePoster` class (L138+) to delete; `refresh()` stays duck-typed.
- `astridr-repo: astridr/engine/bootstrap/cron_dispatcher.py` (L792-799) — `_run_calendar_cache` switches from `CodePulsePoster()` to `self._telemetry`; stale comment block rewritten.
- `astridr-repo: astridr/tools/reminders.py` — the "full two-backend note" both other sites cite; must be corrected in the same sweep.

### Operational constraints
- `CLAUDE.md` §Self-Hosted Convex — Operational Rules — the live backend is single-node self-hosted SQLite; schema deploys are fine, mass data operations are not (this phase does none).
- `.planning/phases/101-reminders-calendar-command-center/101-CONTEXT.md` — D-11 (the dedicated-query design being retired) and the Phase 101 locked decisions this cleanup must not disturb.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reminder_nudge.py`'s `/reminders-read` + `_is_due()` path — the live, verified REM-05 implementation; untouched by this phase, becomes the sole canonical design once the dead queries are gone.
- `refresh()` in `calendar_cache.py` is duck-typed on `send_to` — swapping `CodePulsePoster()` for the shared `ConvexHandler` requires no signature change; existing tests inject fakes and keep passing.

### Established Patterns
- Cross-repo phases (101, 98-05 precedent): worktrees OFF, sequential execution, per-repo commits via `git -C`.
- Convex schema changes: edit `schema.ts` → `npx convex codegen` (offline) → deploy; index removal is a drop, not a build.
- Unit tests live alongside source (`convex/reminders.test.ts` pattern); deleted code's tests are deleted with it, remaining suites must stay green (codepulse full suite was 204 files / 2331 tests green on 2026-07-22).

### Integration Points
- `cron_dispatcher.py:_run_calendar_cache` — the one call site constructing `CodePulsePoster()`; after deletion it passes `self._telemetry` (the shared `ConvexHandler`).
- `convex/http.ts:96-101` — `/calendar-ingest` route, unchanged, serves the local backend (the fact the stale comments deny).

</code_context>

<specifics>
## Specific Ideas

- Comments claiming false facts about the topology are treated as bugs, not style: the sweep must leave zero instances of the retired-cloud narrative anywhere in astridr-repo.
- The live-cron verification (D-07) exists specifically because the poster deletion changes which object the production cron calls — "same URL" is asserted, one real tick proves it (auth headers/env included).

</specifics>

<deferred>
## Deferred Ideas

- **QuickAdd NL date parsing** (audit item 3) — typing "pay rent tomorrow at 9am" parses the date from the title. Real feature work (parser choice, tests, UX spec); stays on the backlog for a future phase.
- **astridr boot-order `persistence.background_error`** (audit item 4) — transient init race, self-heals; deliberately parked on astridr `feature/brain-swap` WIP. Do not touch from master.

</deferred>

---

*Phase: 102-address-tech-debt-reminders-dead-code-astridr-comment-cleanu*
*Context gathered: 2026-07-22*
