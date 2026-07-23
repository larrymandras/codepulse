# Phase 102: Address tech debt — reminders dead code + astridr comment cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 102-address-tech-debt-reminders-dead-code-astridr-comment-cleanu
**Areas discussed:** Dead-query fate, Comment cleanup depth (2 questions), Phase scope, Verification bar

---

## Dead-query fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete them (Recommended) | Nudge cron's client-side filter is live-verified (REM-05); dedicated queries do unbounded `.collect()` anyway — no server-side win. Delete queries + handlers + tests + orphaned `by_dueAt` index. | ✓ |
| Wire the cron to them | Honor original D-11 design: extend `/reminders-read` so `reminder_nudge.py` calls `dueSoon`/`overdue` server-side, range-bound the collect. Touches live-verified hot paths. | |
| You decide | Claude picks at plan time. | |

**User's choice:** Delete them
**Notes:** Grep verified `by_dueAt` has zero consumers outside the two dead handlers (live queries use `by_profile`).

---

## Comment cleanup depth — CodePulsePoster class

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the class (Recommended) | Pass shared `ConvexHandler` to `refresh()` like every other cron. One backend now — duck-typed duplicate poster resolving to the same URL is pure indirection. | ✓ |
| Keep as env-override escape hatch | Audit's suggestion: keep class, rewrite docstring as a `CODEPULSE_CONVEX_URL` redirect hatch. Zero behavior risk, keeps ~40 unused lines. | |
| You decide | Claude picks after checking test coupling. | |

**User's choice:** Delete the class

---

## Comment cleanup depth — Sweep width

| Option | Description | Selected |
|--------|-------------|----------|
| Full repo sweep (Recommended) | Grep all of astridr-repo for the two-backend/cloud-vs-local narrative, fix every instance in one pass (standing bug-fix rule). | ✓ |
| Only the audit's cited sites | `calendar_cache.py` + `cron_dispatcher.py` only; leaves the stale claim alive in `reminders.py`'s "full two-backend note". | |
| You decide | Claude scopes during research. | |

**User's choice:** Full repo sweep

---

## Phase scope

| Option | Description | Selected |
|--------|-------------|----------|
| Items 1-2 only (Recommended) | Dead queries + comment cleanup, as the phase is named. Items 3/4 stay deferred. | ✓ |
| Fold in QuickAdd NL dates | Add audit item 3 as a third plan — grows cleanup into feature work. | |
| Fold in boot-order fix too | Also chase item 4 — risky, bootstrap ordering is active WIP on `feature/brain-swap`. | |

**User's choice:** Items 1-2 only

---

## Verification bar

| Option | Description | Selected |
|--------|-------------|----------|
| Tests + one live cron tick (Recommended) | Suites green + tsc + codegen, PLUS one real `calendar_cache` refresh confirming `pushed>0, failed=0` and events on `/reminders` — catches auth/env differences between poster paths. | ✓ |
| Static verification only | Suites/tsc/grep only; trusts `ConvexHandler.send_to` contract-identical to deleted poster. | |
| Full mini-UAT | Adds live nudge tick + NL round-trip; heavier than warranted (101-RETEST-UAT passed 7/7 on 2026-07-21). | |

**User's choice:** Tests + one live cron tick

---

## Claude's Discretion

- Cross-repo commit sequencing (follow 101/98-05 precedent: per-repo commits, `git -C`, sequential).
- Optional comment on `_is_due()` noting client-side filtering is now the canonical design.
- Handling of any extra stale-comment sites the full sweep surfaces.

## Deferred Ideas

- QuickAdd NL date parsing (audit item 3) — future feature phase.
- astridr boot-order `persistence.background_error` (audit item 4) — parked on `feature/brain-swap`.
