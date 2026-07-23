---
phase: 102-address-tech-debt-reminders-dead-code-astridr-comment-cleanu
reviewed: 2026-07-23T12:14:31Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - convex/reminders.ts
  - convex/reminders.test.ts
  - convex/remindersIngest.ts
  - convex/schema.ts
  - C:/Users/mandr/astridr-wt-183/astridr/automation/calendar_cache.py
  - C:/Users/mandr/astridr-wt-183/astridr/engine/bootstrap/cron_dispatcher.py
  - C:/Users/mandr/astridr-wt-183/astridr/tools/reminders.py
  - C:/Users/mandr/astridr-wt-183/tests/unit/engine/bootstrap/test_cron_dispatcher.py
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-07-23T12:14:31Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Deletion/cleanup phase reviewed across both repos (codepulse Convex reminders surface + astridr calendar/reminder cron paths). The three review focus items were verified against live code, not comments:

**(a) Deleted symbols — no live references remain.**
- `dueSoon` / `overdue` / `by_dueAt`: repo-wide grep of codepulse (excluding node_modules/graphify-out/.planning) finds hits only in the dated design spec `docs/superpowers/specs/2026-07-19-reminders-calendar-command-center-design.md:36,50,74` (a historical point-in-time artifact, not code) and in `src/components/reminders/ReminderList.tsx`, whose "Overdue" grouping is computed client-side from `listByProfile` results (`ReminderList.tsx:491-503`) — it never called the deleted Convex queries. `convex/_generated` is clean.
- `CodePulsePoster`: zero matches anywhere in `C:/Users/mandr/astridr-wt-183`. `reminder_nudge.py` posts directly via its own `_post_json` (`reminder_nudge.py:81-99`) — clean removal.

**(b) Telemetry passthrough is contract-correct.** `cron_dispatcher.py:790-792` passes `telemetry=self._telemetry`; production wiring is `ConvexHandler` (`core.py:404` → `_setup_cron_system` → `CronDispatcher(telemetry=telemetry)` at `cron_jobs.py:502`), and `ConvexHandler.send_to(endpoint, event_type, data)` exists at `telemetry.py:309` matching `refresh()`'s duck-typed contract exactly. `refresh()` guards `telemetry is None` (`calendar_cache.py:165-167`). The posted payload `{"type": event_type, **data}` (`telemetry.py:326`) satisfies `/calendar-ingest`, which picks explicit fields and ignores extras (`calendarEvents.ts:202-207`). One accounting defect in this path is reported as WR-02 below.

**(c) Surviving reminders code paths** are largely sound — `computeNextDueAt` (UTC-only, clamped month math, byday interval rollover) checks out against its tests, `completeReminderHandler` has a correct done-idempotency guard, and both HTTP surfaces fail closed on auth. Four substantiated defects follow.

## Narrative Findings (AI reviewer)

### Warnings

### WR-01: Orphaned `by_status` index left on `reminders` after the dead-query deletion

**File:** `convex/schema.ts:1873`
**Issue:** The phase removed `dueSoon`/`overdue` and the unused `by_dueAt` index, but the `reminders` table still declares:
```ts
.index("by_status", ["status", "dueAt"]),
```
The only surviving query against the table is `listByProfile` via `by_profile` (`convex/reminders.ts:377-382`); repo-wide grep confirms `.query("reminders")` appears nowhere else, and no `withIndex("by_status"` call in the codebase targets the reminders table. The deleted due-scan queries were this index's only plausible consumers (its `["status", "dueAt"]` shape exists precisely for due/overdue scans). This is the identical defect class the phase was opened to remove: an index with zero readers that costs a write on every reminders mutation. Confidence: high.
**Fix:**
```ts
  })
    .index("by_profile", ["profileId", "status"]),
```
(delete line 1873)

### WR-02: `calendar_cache.refresh()` reports a profile as "pushed" even when the push failed

**File:** `C:/Users/mandr/astridr-wt-183/astridr/automation/calendar_cache.py:202-212` (with `C:/Users/mandr/astridr-wt-183/astridr/engine/telemetry.py:315-341`)
**Issue:** `refresh()` awaits the push and unconditionally records success:
```python
await telemetry.send_to(
    "/calendar-ingest",
    ...
)
pushed.append(profile_id)
```
But `ConvexHandler.send_to` can never signal failure to its caller: it silently returns when URL/client is unset (`telemetry.py:315-317`), logs-and-returns on any `status_code >= 400` (`telemetry.py:331-337`), and catches every exception (`telemetry.py:340-341`). So the per-profile `try/except` in `refresh()` can only ever catch **fetch** errors — a 401 from `/calendar-ingest` (which requires `Bearer ${ASTRIDR_INGEST_API_KEY}`, `convex/ingestAuth.ts:76-85`, while `_build_headers()` sends the deploy key, `telemetry.py:421-426`), a 400, or a network failure still yields `calendar_cache.pushed` + `cron_complete pushed=[...]`. This directly contradicts the module's own isolation claim at `calendar_cache.py:143-145` ("an auth/permission/HTTP error fetching **or pushing** one account is logged and skipped") — the `failed` list is unreachable for push errors. A misconfigured key makes the calendar cron look green forever while the Convex cache goes stale. Confidence: high (mechanism traced end-to-end).
**Fix:** Make the outcome observable — e.g. have `send_to` return `bool` (True on 2xx) and branch:
```python
ok = await telemetry.send_to("/calendar-ingest", "calendar_batch", {...})
if ok:
    pushed.append(profile_id)
else:
    failed.append(profile_id)
```
(`send_to` returning a value is backward-compatible with existing callers that ignore it.)

### WR-03: Malformed all-day `date` crashes the whole profile batch despite the "never raises" contract

**File:** `C:/Users/mandr/astridr-wt-183/astridr/automation/calendar_cache.py:85`
**Issue:** `_epoch_from_google_time` guards the timed path — `datetime.fromisoformat(text)` is wrapped in `try/except ValueError` (`calendar_cache.py:94-97`) — but the all-day path is not:
```python
dt = datetime.strptime(date_only, "%Y-%m-%d").replace(tzinfo=UTC)
```
A malformed `{"date": ...}` value raises `ValueError` straight out of `_normalize_event`, whose docstring promises "skipped, never raises (a single malformed event must not drop the whole batch)" (`calendar_cache.py:104-107`). The exception is only caught by the per-profile handler at `calendar_cache.py:219`, so one bad event marks the entire profile `failed` and drops all of its events for that cycle — exactly what the contract says must not happen. Asymmetric guarding is the tell that this branch was missed, not chosen. Confidence: high.
**Fix:**
```python
if date_only:
    try:
        dt = datetime.strptime(date_only, "%Y-%m-%d").replace(tzinfo=UTC)
    except ValueError:
        return time.time(), False
    return dt.timestamp(), True
```

### WR-04: `snooze` on a done recurring reminder erases the complete-idempotency stamp and duplicates the series

**File:** `convex/reminders.ts:312-329` (chain: `convex/reminders.ts:277`, `C:/Users/mandr/astridr-wt-183/astridr/automation/reminder_nudge.py:133-141,202-203`)
**Issue:** `completeReminderHandler` guards against double-spawn with `if (!existing || existing.status === "done") return;` (`reminders.ts:277`), but `snoozeReminderHandler` patches unconditionally:
```ts
await ctx.db.patch(id, {
  status: "snoozed",
  snoozedUntil: until,
  notifiedAt: undefined,
  updatedAt: now,
});
```
No existence/status check. Snoozing a **done** recurring row (whose completion already spawned occurrence N+1) flips its status to `"snoozed"` and clears `notifiedAt`. Once `snoozedUntil` passes, `_is_due` selects it (`reminder_nudge.py:137-139` — the `"done"` short-circuit at line 133 no longer applies), the nudge cron re-alerts and rolls it via `op:"complete"` (`reminder_nudge.py:202-203`); the done-guard now sees `"snoozed"`, so `computeNextDueAt(existing.dueAt, ...)` — dueAt unchanged by snooze — spawns a **second** N+1 row identical to the first. The trigger is reachable: `RemindersTool._list` exposes every row's `_id` including done rows (`reminders.py:311-319`), and the LLM-driven `_snooze` accepts any id (`reminders.py:353-366`) — "snooze that one" against an already-completed reminder is a plausible NL request. Confidence: high on mechanism; the trigger requires tool misuse rather than normal dashboard flow, hence Warning not Critical.
**Fix:** Mirror the complete-handler guard:
```ts
export async function snoozeReminderHandler(ctx, id, until, now) {
  const existing = await ctx.db.get(id);
  if (!existing || existing.status === "done") return;
  await ctx.db.patch(id, { ... });
}
```

### Info

### IN-01: No surviving path can clear an optional reminder field (recurrence/dueAt/notes/tags)

**File:** `convex/reminders.ts:239-243` (also `C:/Users/mandr/astridr-wt-183/astridr/tools/reminders.py:110`)
**Issue:** `updateReminderHandler` copies only defined fields:
```ts
for (const [key, value] of Object.entries(fields)) {
  if (value !== undefined) patch[key] = value;
}
```
and both Ástríðr write paths strip `None` before posting (`reminders.py:110` `clean_body = {k: v for k, v in body.items() if v is not None}`). Convex's `v.optional()` validators reject explicit `null`, so with `dueSoon`/`overdue` gone there is provably no path to make a recurring reminder one-off again (or drop a due date) except delete + recreate. Pre-existing Phase 101 design, surfaced here because this phase finalized the surviving surface.
**Fix:** If clearing is wanted, accept a sentinel (e.g. `clearRecurrence: v.optional(v.boolean())`) on `update` and map it to a `patch[key] = undefined` (Convex removes fields patched to `undefined`, per the pattern already used at `reminders.ts:326`). Otherwise document the limitation on the tool schema so the LLM offers delete+recreate.

---

**Verified-clean notes:** cron_dispatcher's `calendar:cache_refresh` / `reminder:nudge` arms are correctly wrapped by `_run_tracked_inline` (one jobs-row, no double-write), and `test_cron_dispatcher.py:201,244` patches the module attributes that the handlers late-import at call time, so those tests exercise the real seam.

**What I dropped and why:** an apparent `"\reminders-ingest"` carriage-return URL in `reminder_nudge.py:119` (byte-level `cat -A` proves it is `/reminders-ingest` — a search-tool display artifact, would have been a false-positive BLOCKER); missing existence checks on `update`/`markNotified` patches (Convex `db.patch` throws on a missing id and the httpAction surfaces it as a 400 — intended behavior); `error=type(exc).__name__`-only cron logging (consistent house pattern shared with `_run_graph_snapshot`); no future-check on snooze `until` and Google all-day exclusive-end semantics (behavioral choices, not provable defects); deploy-key-vs-ingest-key equality (the identical header path already authenticates the production `/runtime-ingest` flow, so a mismatch is disproven by the working system — its silent-failure mode is covered by WR-02).

_Reviewed: 2026-07-23T12:14:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
