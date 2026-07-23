---
phase: 101-reminders-calendar-command-center
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - convex/schema.ts
  - convex/reminders.ts
  - convex/reminders.test.ts
  - convex/remindersIngest.ts
  - convex/remindersIngest.test.ts
  - convex/calendarEvents.ts
  - convex/http.ts
  - src/App.tsx
  - src/lib/navRegistry.ts
  - src/pages/Reminders.tsx
  - src/pages/Reminders.test.tsx
  - src/components/reminders/ReminderList.tsx
  - src/components/reminders/CalendarOverlay.tsx
  - src/components/reminders/QuickAdd.tsx
  - ../astridr-repo/astridr/tools/reminders.py
  - ../astridr-repo/tests/tools/test_reminders.py
  - ../astridr-repo/astridr/automation/calendar_cache.py
  - ../astridr-repo/tests/automation/test_calendar_cache.py
  - ../astridr-repo/astridr/automation/reminder_nudge.py
  - ../astridr-repo/tests/automation/test_reminder_nudge.py
  - ../astridr-repo/astridr/engine/bootstrap/cron_builders.py
  - ../astridr-repo/astridr/engine/bootstrap/cron_dispatcher.py
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 101: Code Review Report — Reminders & Calendar Command Center

**Reviewed:** 2026-07-20
**Depth:** standard (cross-repo traces on the nudge/snooze and calendar-ingest paths)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The auth surface is solid: both new httpActions and `/calendar-ingest` are fail-closed behind `validateIngestAuth` (verified against `ingestAuth.ts`), `source` is server-hardcoded on ingest (D-09), the calendar path is verifiably read-only (no Google write action exists in `calendar_cache.py`), and the UI renders all cached strings as React text nodes (T-101-03 tests confirm). No injection, secret, or auth-bypass issues found.

The defects are in cross-repo *semantics*: the snooze feature and the nudge-dedupe feature cancel each other out (CR-01), the edit popover corrupts `dueAt` by the timezone offset on every save (CR-02), and several recurrence/idempotency edges produce wrong or duplicated rows. Each finding below carries file:line evidence and a confidence level; anything I could not substantiate was dropped (see the last line).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A snoozed reminder that was already nudged is never nudged again — snooze silently defeats REM-05 dedupe

**Files:** `convex/reminders.ts:281-285` + `C:\Users\mandr\astridr-repo\astridr\automation\reminder_nudge.py:133-139`
**Confidence:** High — full mechanism traced across both repos; no code path clears `notifiedAt` on the same row (grep-verified: only `markNotifiedHandler` writes it; only the *spawned* row in `completeReminderHandler` gets it cleared).

**Issue:** `snoozeReminderHandler` patches only status/snooze fields:

```ts
await ctx.db.patch(id, {
    status: "snoozed",
    snoozedUntil: until,
    updatedAt: now,
});
```

and the nudge cron checks `notifiedAt` **before** the snooze branch:

```python
if reminder.get("notifiedAt") is not None:
    return False
if reminder.get("status") == "snoozed":
    snoozed_until = reminder.get("snoozedUntil")
    return snoozed_until is not None and snoozed_until <= now
```

Trace of the dominant flow: reminder comes due → cron nudges → `markNotified` stamps `notifiedAt` → Larry snoozes it (dashboard SnoozeMenu or the Ástríðr `snooze` action — neither clears `notifiedAt`) → `snoozedUntil` passes → `_is_due` returns `False` forever. The one thing a snooze means — "remind me again at X" — never happens for any reminder that was nudged first. `tests/automation/test_reminder_nudge.py:205-207` only covers a snoozed row *without* `notifiedAt`, so the suite never exercises this path.

**Fix:** Clear the dedupe stamp when snoozing — the snoozed wake-up is a new occurrence:

```ts
export async function snoozeReminderHandler(ctx, id, until, now) {
  await ctx.db.patch(id, {
    status: "snoozed",
    snoozedUntil: until,
    notifiedAt: undefined, // Convex removes the field → re-eligible for one nudge at wake-up
    updatedAt: now,
  });
}
```

### CR-02: Edit popover shifts `dueAt` by the UTC offset on every save (and displays UTC wall time)

**File:** `src/components/reminders/ReminderList.tsx:221-224` and `:258`
**Confidence:** High — deterministic; reproducible from the two quoted lines.

**Issue:** The `datetime-local` input is seeded with the **UTC** wall time:

```ts
const [dueAt, setDueAt] = useState(
  reminder.dueAt !== undefined
    ? new Date(reminder.dueAt * 1000).toISOString().slice(0, 16)
    : ""
);
```

but on Save the same string is parsed as **local** time:

```ts
dueAt: dueAt ? Math.round(new Date(dueAt).getTime() / 1000) : undefined,
```

`toISOString()` renders UTC; `new Date("YYYY-MM-DDTHH:mm")` parses local. Two consequences: (1) the popover displays the wrong time (UTC, 5–6h off for US Central/Eastern); (2) saving **without touching the date** silently moves `dueAt` forward by the offset — every edit-save (even a title-only edit, since `onSave` always sends `dueAt`) corrupts the stored due time and can flip a reminder across Today/Upcoming/Overdue groups and calendar days. `QuickAdd.tsx:82` and `SnoozeMenu` are consistent (local→local) — only this seed line is wrong.

**Fix:** Seed with local wall time (`format` from date-fns is already imported in this file):

```ts
reminder.dueAt !== undefined
  ? format(new Date(reminder.dueAt * 1000), "yyyy-MM-dd'T'HH:mm")
  : ""
```

## Warnings

### WR-01: `completeReminderHandler` is not idempotent — completing an already-done recurring reminder spawns a duplicate next occurrence

**File:** `convex/reminders.ts:239-266`
**Confidence:** High on mechanism; the trigger is a narrow but real cross-actor race.

**Issue:** After `const existing = await ctx.db.get(id); if (!existing) return;` there is no status guard — a second `complete` on a row already `"done"` re-patches it and, because `existing.recurrence && existing.dueAt !== undefined` still holds, **inserts another** next-occurrence row. Real path: the nudge cron auto-rolls recurring reminders on nudge (`reminder_nudge.py:202-204` calls `op:"complete"`), racing Larry clicking complete on the dashboard for the same nudge. Convex serializes the two mutations, but the second still spawns because status is never checked → two open copies of the next occurrence.

**Fix:**

```ts
const existing = await ctx.db.get(id);
if (!existing || existing.status === "done") return;
```

### WR-02: `recurrence.interval` is never validated — `interval: 0` creates a self-perpetuating nudge loop and unbounded row growth

**Files:** `convex/reminders.ts:98-100, 123-128` + `C:\Users\mandr\astridr-repo\astridr\automation\reminder_nudge.py:202-204`
**Confidence:** High — arithmetic and loop verified end-to-end.

**Issue:** The validator is `interval: v.float64()` with no bounds, and `computeNextDueAt` does `next.setUTCDate(next.getUTCDate() + interval)`. With `interval: 0` (daily), `nextEpoch === dueAt`, which is not `> until`, so `complete` spawns an identical-due open row with `notifiedAt` cleared. The nudge cron then re-nudges and re-rolls it **every 5-minute scan, forever**: one Telegram nudge + one new done row + one new open row per scan. Negative intervals walk the series backward. The Ástríðr tool schema (`reminders.py:216-217`) advertises `interval: number` with no minimum, so a single LLM-produced `{freq:"daily", interval:0}` triggers this.

**Fix:** Reject at the handler (covers UI, HTTP ingest, and tool paths at once):

```ts
if (args.recurrence && (!Number.isInteger(args.recurrence.interval) || args.recurrence.interval < 1)) {
  throw new Error("recurrence.interval must be an integer >= 1");
}
```
in `createReminderHandler` and `updateReminderHandler`.

### WR-03: Weekly recurrence silently ignores `interval` when `byday` is present

**File:** `convex/reminders.ts:101-104`
**Confidence:** High — the branch provably never reads `interval`.

**Issue:**

```ts
next =
  byday && byday.length > 0
    ? nextBydayOccurrence(date, byday)
    : ...
```

`nextBydayOccurrence` advances to the next matching weekday within 14 days — `interval` is never consulted. "Every 2 weeks on Monday" (a shape the tool schema at `reminders.py:210-219` explicitly advertises) recurs **weekly**. Tests only cover `interval: 1` with `byday` (`reminders.test.ts:60-69`), so this is untested territory presented as supported.

**Fix:** Either implement it (after the byday match, if the match wrapped into a new week, add `(interval - 1) * 7` days) or reject `interval > 1` + `byday` combinations with a clear error and note the limitation in the tool schema description.

### WR-04: Calendar upsert matches by `googleEventId` alone — a shared/invited event flip-flops between profiles, overwriting `profileId`/`calendarAccount`

**File:** `convex/calendarEvents.ts:91-107`
**Confidence:** High on mechanism (unscoped lookup + ownership-overwriting patch are certain); medium-high on real-world trigger — Google Calendar assigns the *same* event `id` to each attendee's copy of an invite, and Larry's three accounts routinely invite each other.

**Issue:** The lookup is unscoped:

```ts
.withIndex("by_googleEventId", (q) => q.eq("googleEventId", ev.googleEventId))
.first();
if (existing) {
  await ctx.db.patch(existing._id, { profileId, calendarAccount, ... });
```

When the same `googleEventId` exists on two of Larry's accounts, each account's 20-minute push steals the single cached row (patching `profileId`/`calendarAccount` to itself), so the event ping-pongs between profiles and is always missing from one profile's overlay. The "scoped prune" (D-10) can't compensate — after the steal the row is no longer under the other profile's `by_profile` index.

**Fix:** Scope the match to the push's authority:

```ts
const existing = (await ctx.db
  .query("calendarEvents")
  .withIndex("by_googleEventId", (q) => q.eq("googleEventId", ev.googleEventId))
  .collect()
).find((r) => r.profileId === profileId && r.calendarAccount === calendarAccount);
```
(and drop `profileId`/`calendarAccount` from the patch — each account keeps its own copy).

### WR-05: All-day events render one day early — cached as UTC midnight, bucketed by local midnight

**Files:** `C:\Users\mandr\astridr-repo\astridr\automation\calendar_cache.py:91-93` + `src/components/reminders/CalendarOverlay.tsx:59-63,100` (and the day filter at `src/pages/Reminders.tsx:118-121`)
**Confidence:** High — deterministic for any negative UTC offset (all US timezones).

**Issue:** Normalization parses date-only events as UTC midnight:

```python
dt = datetime.strptime(date_only, "%Y-%m-%d").replace(tzinfo=UTC)
return dt.timestamp(), True
```

while the overlay buckets by **local** midnight (`d.setHours(0, 0, 0, 0)`). For US Central/Eastern, UTC midnight of July 21 is 18:00–19:00 local on July 20 — every all-day event (birthdays, holidays, PTO) lands on the previous day's cell, and clicking its real day shows nothing.

**Fix:** Branch on `allDay` in the UI's day-keying: bucket all-day events by their **UTC** calendar date (e.g. use `getUTCFullYear/Month/Date` to build the local-day key) in `CalendarOverlay.eventsByDay` and `Reminders.selectedDayEvents`.

### WR-06: Edit's optimistic override is never reconciled and never rolled back on failure

**File:** `src/components/reminders/ReminderList.tsx:450-464` and `:530-540`
**Confidence:** High — both conditions are explicit in the quoted code.

**Issue:** The reconcile effect only drops overrides that carry a `status`:

```ts
if (row && override.status !== undefined && row.status === override.status) {
```

Edit overrides (`{title?, dueAt?, priority?}` — no `status`) are therefore **never** removed, and the `handleEdit` catch shows a toast but — unlike `handleComplete`/`handleSnooze` — does not delete the override:

```ts
} catch {
  toast.error("Failed to save reminder.");
}
```

Consequences: a failed edit leaves the UI permanently showing values that were never saved (the toast contradicts what's on screen), and even a successful edit's override masks any later remote change to those fields (e.g. Ástríðr updating the title) for the rest of the session.

**Fix:** Delete the override in both branches of `handleEdit` (on success the realtime row already carries the new values; on failure the rollback restores truth), mirroring `handleComplete`'s catch block.

## Info

### IN-01: `dueSoon`/`overdue` queries have no consumer, and their doc comments overstate the filter

**File:** `convex/reminders.ts:348-379`
**Confidence:** High — repo-wide grep shows no caller (the nudge cron reads `listByProfile` and filters in Python; the UI groups client-side).

**Issue:** Both queries are dead public API. Their comments claim `/** Open|snoozed rows ... never status "done" */` but the implementation filters only `r.status !== "done"` — a future-snoozed row with a past `dueAt` would be returned as "due", a trap for the first future consumer.

**Fix:** Either delete them or make them honor `snoozedUntil` and wire the nudge cron to them as the spec (design doc §50) originally intended.

### IN-02: Stale, self-contradicting cloud-vs-local comments on the calendar push path

**Files:** `C:\Users\mandr\astridr-repo\astridr\automation\calendar_cache.py:138-150` vs `:46-51`; `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_dispatcher.py:793-796`
**Confidence:** High that the comments contradict the code; the code itself is correct for the current all-local topology.

**Issue:** `CodePulsePoster`'s docstring says it "posts to the CodePulse CLOUD deployment" and that the local backend "has no `/calendar-ingest` route (verified: it 404s)"; the dispatcher repeats the claim. But the class defaults to `_CODEPULSE_URL = CODEPULSE_CONVEX_URL or CONVEX_URL` — i.e. the **local** backend when the escape hatch is unset — which the module-header comment (`:46-51`) correctly describes as the normal setup (cloud retired 2026-07-15). The next person debugging a calendar 404 will be sent to a retired deployment.

**Fix:** Rewrite both docstrings to describe the transitional history as history and the local default as current behavior.

### IN-03: The due date cannot be cleared once set — from the edit popover or the Ástríðr tool

**Files:** `src/components/reminders/ReminderList.tsx:258` + `convex/reminders.ts:206-209` (+ `reminders.py:109` on the tool side)
**Confidence:** High — the undefined-skip patch pattern provably makes "clear" indistinguishable from "unchanged".

**Issue:** Emptying the date field sends `dueAt: undefined`, and `updateReminderHandler` skips undefined fields (`if (value !== undefined) patch[key] = value;`) — Save silently keeps the old date. Same on the Python side, where `None` values are stripped before POST.

**Fix:** Add an explicit clear signal (e.g. a `clearDueAt: v.optional(v.boolean())` arg that patches `dueAt: undefined`), or accept `null` as "clear" on the update op.

---

**What I dropped and why:** unfiltered `.collect()` scans in `dueSoon`/`overdue`/prune (performance — out of v1 scope), real Telegram chat IDs in `test_reminder_nudge.py` fixtures (deliberate per its own comment; non-credential), the `time.time()` fallback for malformed Google timestamps (defensive-by-design, cosmetic impact), multi-day events rendering only on their start day (windowing design choice), free-form `profileId` accepted by the HTTP ingest (server-side enum adds little — the tool and UI both constrain it, and the key-holder is trusted), and unmarked `async def` tests in `test_reminders.py` (verified `asyncio_mode = "auto"` in pyproject.toml:143 — they do run).

_Reviewed: 2026-07-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
