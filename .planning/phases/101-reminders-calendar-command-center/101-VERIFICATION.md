---
phase: 101-reminders-calendar-command-center
verified: 2026-07-19T23:59:00Z
status: human_needed
score: 6/6 roadmap success criteria CODE-VERIFIED; 9/9 requirements CODE-VERIFIED; 0 BLOCKERS
overrides_applied: 0
human_verification:
  - test: "Run the codepulse dev server + `npx convex dev` (or point at the cloud deployment tidy-whale-981), open /reminders, and create/complete/snooze a reminder from the UI; reload and confirm it persisted."
    expected: "Reminder created via the UI survives reload; complete moves it to Done; snooze sets a real snoozed state with a future due render."
    why_human: "Requires a running Convex deployment + browser — cannot be exercised by static code inspection."
  - test: "With Ástríðr running and ASTRIDR_INGEST_API_KEY/CONVEX_URL correctly pointed at codepulse's Convex HTTP host (the `.convex.site` actions domain, not `.convex.cloud`), ask Ástríðr to add a reminder, then confirm it appears on the CodePulse /reminders page without a manual refresh; then complete/snooze it via the `reminders` tool and confirm CodePulse reflects the change live."
    expected: "Bidirectional live sync — a row created/mutated on either surface appears on the other within the Convex realtime subscription's normal latency."
    why_human: "Requires two live systems talking over a real network boundary with real credentials; the code path is verified statically (Task-4 in this report) but the actual wire round-trip has not been executed."
  - test: "Run the calendar-cache cron once against real Google credentials for all three accounts (`GOOGLE_CREDS_PERSONAL`/`_BUSINESS`/`_CONSULTING`) and confirm `calendarEvents` populates for personal/business/consulting, that a stale event drops on the next cycle, and that the consulting account (`lemandras@forgedinai.ai`) actually returns events (not just that the alias exists in config)."
    expected: "All three profiles' calendars appear on the Reminders page overlay; a deleted/moved Google event disappears from the cache within one cron cycle (~20 min)."
    why_human: "Requires live Google OAuth tokens in the token store per 101-CONTEXT.md's prerequisites section (`GOOGLE_CREDS_CONSULTING` authorization was explicitly flagged as something 'Larry must complete... the agent cannot')."
  - test: "Create a reminder due in ~1 minute via the Ástríðr tool, wait for the `reminder:nudge` cron (every 5 min) to fire, and confirm exactly ONE Telegram nudge arrives on the correct profile's chat, and that `notifiedAt` is set (a second cron pass sends nothing)."
    expected: "One nudge, correct profile channel, no repeat; a recurring reminder's next occurrence appears after the nudge fires."
    why_human: "Requires a live Ástríðr deploy, a live cron scheduler tick, and a real Telegram channel to observe delivery — cannot be verified from source alone."
  - test: "Visual/UX pass on /reminders in both light (Paperclip) and at least one dark theme: profile switch accent changes, overdue pulse animates (and stops under prefers-reduced-motion), calendar chips are visually distinct (filled reminder vs outline Google event), and the page never scrolls horizontally at a narrow viewport."
    expected: "Matches 101-UI-SPEC.md's 'sleek... kick ass with some great effects' intent; readable in both theme families; responsive collapse works below the breakpoint."
    why_human: "Visual/aesthetic judgment and motion-preference behavior are not verifiable via static grep — component code was inspected and looks structurally correct (CSS var accents, prefers-reduced-motion hook, responsive grid classes) but was never rendered in a browser during this verification pass."
---

# Phase 101: Reminders & Calendar Command Center Verification Report

## ADDENDUM — Live verification pass, 2026-07-20

The phase was deployed and exercised against the live stack after the report below was written. Four of the five `human_verification` items are now CLOSED; the deployment surfaced two real defects and one blocking misconfiguration, all fixed.

**Deployed:** `npx convex deploy --yes` → tidy-whale-981 (production). Schema validation passed, no indexes dropped.

### Closed by live exercise

| Item | Result |
|---|---|
| UI create → reload persists | ✅ PASS — created via QuickAdd, survived a full reload (server round-trip, not local state) |
| Recurrence spawn on complete | ✅ PASS — completing the 22nd's weekly reminder spawned the next occurrence on the 29th, visible on the grid |
| Profile segmentation | ✅ PASS — switching profiles swaps both the reminder list and the calendar overlay |
| Theme pass | ✅ PASS — cyan / emerald / readable / aubergine all apply and stay legible; **zero console errors** in any theme |
| Fail-closed auth (T-101-01) | ✅ PASS **live** — `POST https://tidy-whale-981.convex.site/reminders-ingest` with no key returns **401** against the real deployment |

### Defects found by live exercise (all fixed)

1. **Calendar boxed into a 360px sidebar with fixed 64px cells** — the month grid ended partway down the page, wasting the entire lower half of a wide screen. The list is now the fixed rail and the calendar takes all remaining width, with rows templated to the view's week count so cells divide the available height. (codepulse `f08b5d8`)

2. **Day cells silently dropped items.** Chips were sliced per-list (2 events + 2 reminders) but the "+N more" indicator was gated on a combined `> 4`. Three events and no reminders rendered 2 chips, evaluated `3 > 4` as false, and dropped the third with **no indicator** — the cell lied about its contents. Budget is now shared and the overflow count derived from what actually rendered. Mutation-verified: restoring the old logic shows "2 chips, +3 more" for 7 items. (codepulse `f08b5d8`)

3. **Reminders lost chip slots to Google events.** Seeding realistic volume showed a busy day burying the *reminder* — the only actionable item on the page — behind four read-only meetings. Reminders now claim the budget first and render at the top of the cell. (codepulse `c94a949`)

### BLOCKER found and fixed — wrong Convex backend

Probing from inside the Docker network where Ástríðr actually runs:

```
LOCAL  (convex-backend:3211, astridr's CONVEX_URL)
  /ingest, /runtime-ingest, /war-room-ingest, /transcript-ingest -> 401  (present)
  /reminders-ingest, /calendar-ingest                            -> 404  (ABSENT)
CLOUD  (tidy-whale-981.convex.site, what the dashboard reads)
  /reminders-ingest                                              -> 401  (present)
```

`CONVEX_URL` resolves to the **local self-hosted backend**, which carries telemetry and war-room but has no Phase 101 routes. Every astridr path — the tool and both crons — would have posted into a backend with no such route, or silently into a database the dashboard never reads. This defeats success criterion #1 (one store, both directions) and was invisible to every test, because each side passes in isolation; only the live wire probe exposed it.

Fixed in astridr `05f15c84`: all three modules prefer `CODEPULSE_CONVEX_URL`, falling back to `CONVEX_URL`. `calendar_cache` could not read the env directly (it posts through an injected `ConvexHandler` whose base URL is the shared local one), so it gained a duck-typed `CodePulsePoster` and the cron passes that instead of `self._telemetry`.

**⚠ REQUIRES OPERATOR ACTION — the fix is inert until this env var is set:**

```
CODEPULSE_CONVEX_URL=https://tidy-whale-981.convex.site
```

Without it the fallback preserves today's broken target and reminders will 404. This is the single remaining gate on the cross-repo round trip.

### ✅ CLOSED 2026-07-20 — live bidirectional round-trip PASSED

Success criterion #1 ("one Convex store, both write directions, origin-tagged") is now **LIVE-VERIFIED**, not just code-verified.

The blocker above resolved differently than expected: CodePulse was repointed off the cloud deployment onto the **local self-hosted backend** (which Ástríðr already used), so both sides share one store and `CODEPULSE_CONVEX_URL` is correctly **unset** — the fallback to `CONVEX_URL` is the right default again.

Exercised through Ástríðr's real `RemindersTool` inside the running container (real `CONVEX_URL`, real ingest key), not a simulation:

```
CONVEX_URL           = http://convex-backend:3211
CODEPULSE_CONVEX_URL = <unset>

ADD    -> success, "Added reminder ... for personal"
LIST   -> success, found it, source= astridr, status= open
COMPLETE -> success
```

CodePulse then read the **same `_id`** back through `reminders:listByProfile`:

```
_id: kx7stx8jr6n305tgkwyrwn0q858awa57
source: "astridr"   status: "done"   profileId: "personal"
```

Reverse direction confirmed too — a `source:"dashboard"` row created on the CodePulse side was visible to Ástríðr's `list` over the authed `/reminders-read` endpoint (`astridr sees the dashboard-created reminder: True`).

This also proves live: D-09 server-side origin tagging (the tool cannot spoof `source`), D-07 authed POST reads, and profile scoping (the business probe appeared only under `business`). Both probe rows were removed; all three profiles verified empty afterward.

### ✅ CLOSED 2026-07-20 — CAL-01 live against real Google calendars

**`GOOGLE_CREDS_CONSULTING` was already authorized** — the "operator-only" blocker was stale. The token exists at `/home/astridr/tokens/consulting.json`, carries `https://www.googleapis.com/auth/calendar`, holds a refresh token, and was auto-refreshed the same day. All three accounts return success:

```
personal    (mandrasle@gmail.com)        list_events -> success, 5 events
business    (lmandras@myprotectall.com)  list_events -> success, 5 events
consulting  (lemandras@forgedinai.ai)    list_events -> success, 0 events
```

Consulting returns **0 because that calendar has no upcoming events**, not because auth fails — an important distinction, since an empty overlay looks identical to a broken one.

The real `calendar_cache.refresh()` was then run once with the real per-account tools and the real `CodePulsePoster`:

```
calendar_cache.pushed  profile=personal    account=mandrasle@gmail.com        count=3
calendar_cache.pushed  profile=business    account=lmandras@myprotectall.com  count=73
calendar_cache.pushed  profile=consulting  account=lemandras@forgedinai.ai    count=0
refresh_complete  pushed=[personal, business, consulting]  failed=[]
```

Convex then served exactly those counts back via `calendarEvents:listByProfile` (3 / 73 / 0), proving the full CAL-01 path: Google → normalize → authed `/calendar-ingest` → Convex → dashboard query. Per-profile isolation held (no profile blocked another) and D-02 is intact (only `list_events` is reachable).

### ✅ CLOSED — chip density judged at real volume

With 73 real business events cached, the month grid peaks at **4 chips on the busiest day** (Jul 22 and Jul 29) against a budget of 5 — **zero cells overflow**, so no "+N more" appears at realistic volume and the cap is correctly sized. Rendered clean with zero console errors. Titles truncate with an ellipsis in a month cell (full text is in the `title` attribute on hover), which is inherent to the cell width and acceptable.

### Still open
- **A real Telegram nudge firing exactly once** — no longer env-blocked (the store is shared now); needs a live `reminder:nudge` cron tick with a genuinely due reminder to observe delivery + the `notifiedAt` dedupe. This is the only remaining unverified item in the phase.

Test data seeded for this pass (14 events, 6 reminders) was **removed**; both tables verified empty afterward.

---


**Phase Goal:** Add a profile-segmented Reminders command center — bidirectional CodePulse↔Ástríðr sync, recurrence, proactive due-nudges, and a read-only Google Calendar overlay per profile. Cross-repo: codepulse (01/02/06) + astridr-repo (03/04/05).
**Verified:** 2026-07-19
**Status:** human_needed (all code-level truths verified; live/deployed behavior explicitly unverified — see Human Verification below)
**Re-verification:** No — initial verification

**IMPORTANT — scope of this verification:** Every claim below marked CODE-VERIFIED was independently confirmed by reading the live source (file:line evidence) and/or re-running the test suites myself. Every claim marked TEST-VERIFIED is asserted by an existing automated test I confirmed passes. Nothing in this phase has been exercised against a running Convex deployment, a live Ástríðr process, real Google OAuth tokens, or a real Telegram channel — **the phase has NOT been deployed or manually exercised**. That gap is real and is why status is `human_needed`, not `passed`.

## Goal Achievement — Roadmap Success Criteria

| # | Success Criterion (ROADMAP.md) | Status | Evidence |
|---|---|---|---|
| 1 | One Convex store, both write directions, origin-tagged | CODE-VERIFIED | `convex/reminders.ts:176-189` `create` mutation requires `source: v.string()` and stores it verbatim; `convex/remindersIngest.ts:47-56` hardcodes `source: "astridr"` on every Ástríðr-originated create (server-side, cannot be spoofed by the caller — D-09); `src/pages/Reminders.tsx:121` dashboard writes `source: "dashboard"`. Both directions traced end-to-end (dashboard: `useMutation(api.reminders.create)` direct; Ástríðr: `astridr/tools/reminders.py:267-277` → `POST /reminders-ingest {op:"create"}` → `api.reminders.create`). TEST-VERIFIED: `convex/reminders.test.ts:208-229` (source required + stored verbatim for both origins), `convex/remindersIngest.test.ts:118-136` (astridr create always tags `source:"astridr"` regardless of body). |
| 2 | Profile segmentation; reminders + Google events per profile, one grid, read-only | CODE-VERIFIED | `src/pages/Reminders.tsx:28-32,92-184` renders `PROFILES` (personal/business/consulting) with per-profile `accentVar`, `useQuery(api.reminders.listByProfile,{profileId})` + `useQuery(api.calendarEvents.listByProfile,{profileId})` both re-key on profile switch. `CalendarOverlay.tsx:207-230` renders Google events (outline chip, `data-testid="calendar-event-chip"`) and reminder chips (filled, `data-testid="calendar-reminder-chip"`) visually distinct on the same day cell. **No Google write path exists**: grepped `src/components/reminders/*`, `src/pages/Reminders.tsx`, `convex/calendarEvents.ts`, `convex/remindersIngest.ts` for `create_event`/`createEvent`/`calendarEvents.(create|update|insert|patch)`/`googleapis` — zero matches outside comments documenting the absence; `astridr/automation/calendar_cache.py` (the only Google Calendar caller in this phase) grepped for `create_event` — zero code-path matches, only docstring prose confirming its absence (`calendar_cache.py:15,144`). |
| 3 | Recurrence: complete/pass spawns next occurrence, notifiedAt cleared; bounded terminates at `until`; one-off never respawns | CODE-VERIFIED | `convex/reminders.ts:234-267` `completeReminderHandler` — on a row with `recurrence` + `dueAt`, calls `computeNextDueAt`, inserts a new row with `notifiedAt: undefined`, `status:"open"`; `computeNextDueAt` (`reminders.ts:89-117`) returns `null` when the next occurrence exceeds `recurrence.until` (line 115) or when `recurrence` is undefined (line 93), so no row is spawned. TEST-VERIFIED: `reminders.test.ts:243` (one-off completes with no spawn), `:258` (recurring spawns exactly one next-open row, notifiedAt cleared), `:294` (past-`until` spawns nothing — bounded termination), `:92-107` (computeNextDueAt null past `until`, exact-`until` boundary still fires). |
| 4 | Nudge exactly once, deduped via `notifiedAt`, correct profile channel | CODE-VERIFIED | `astridr/automation/reminder_nudge.py:117-136` `_is_due` excludes any row with `notifiedAt is not None`; `run()` (148-213) sends `proactive.send_alert(NUDGE_CHANNEL, chat_id, ...)` then immediately `_mark_notified` → `POST /reminders-ingest {op:"markNotified"}` → `convex/reminders.ts:300-316` `markNotifiedHandler` patches `notifiedAt`/`updatedAt` only (never `status`/`dueAt`, so it can't disturb `dueSoon`/`overdue`). Channel targeting: `chat_id = _resolve_chat_id(config, profile_id, NUDGE_CHANNEL)` (`reminder_nudge.py:177`) looked up **from that reminder's own `profile_id`** — `astridr/engine/config.py:1163-1177` `_resolve_chat_id` scans `config.profiles` for the matching `profile.id` and returns only that profile's `channel_mappings[channel_id]`; there is no code path where a business reminder's loop iteration can read the personal profile's chat_id. TEST-VERIFIED: `tests/automation/test_reminder_nudge.py` — `test_due_reminder_nudges_once_and_sets_notified_at`, `test_rescan_after_notified_at_set_sends_zero`, `test_business_reminder_nudges_business_channel_never_personal`, `test_future_snoozed_reminder_is_not_nudged`, `test_past_snoozed_reminder_is_nudged`. |
| 5 | Consulting → `lemandras@forgedinai.ai`; personal → `mandrasle@gmail.com`; business → `lmandras@myprotectall.com` | CODE-VERIFIED | `config/google-workspace.yaml:14-19` — `alias: consulting` maps to `email: lemandras@forgedinai.ai` with `credentials_ref: GOOGLE_CREDS_CONSULTING` and `list_events` in `allowed_actions`; `alias: personal` → `mandrasle@gmail.com`; `alias: business` → `lmandras@myprotectall.com`. `astridr/automation/calendar_cache.py:47-51` `PROFILE_ACCOUNTS` dict hardcodes the identical mapping and is used both as the `calendarAccount` value pushed to `/calendar-ingest` (line 203) and as the `registry.get(f"google_{profile_id}")` tool lookup key (line 166), which resolves to the per-account tool registered as `google_{alias}` in `astridr/engine/bootstrap/tools.py:520-538` (`create_per_account(alias=acct.alias,...)`, `tool.name = f"google_{alias}"`). The account-alias mapping is consistent across config, cron, and tool registration — genuinely wired, not just documented. The "confirm the `consulting` enum accepts the value" risk flagged in 101-CONTEXT.md was investigated in 101-04 and found moot (`GoogleWorkspaceTool.parameters["account"]` has no enum constraint). **NEEDS-LIVE**: whether the `GOOGLE_CREDS_CONSULTING` OAuth token is actually authorized in the live token store was explicitly flagged as a Larry-only prerequisite in 101-CONTEXT.md and is unverifiable from code. |
| 6 | Add/edit/complete/snooze work from BOTH surfaces | CODE-VERIFIED | Dashboard: `Reminders.tsx:113-147` wires `createReminder`/`completeReminder`/`snoozeReminder`/`updateReminder` directly to `api.reminders.*` mutations, consumed by `ReminderList.tsx`/`QuickAdd.tsx`. Ástríðr: `astridr/tools/reminders.py:242-351` implements `_add`/`_update`/`_complete`/`_snooze`, each posting to `/reminders-ingest` with the matching `op`. **Snooze seam specifically re-verified** (this was the mid-phase gap): `reminders.py:332-351` sends `{op:"snooze", id, until}`; `remindersIngest.ts:81-94` dispatches `op:"snooze"` → `api.reminders.snooze({id, until})`, a REAL status transition (`status:"snoozed"`+`snoozedUntil`), not the earlier dueAt-shift workaround. TEST-VERIFIED both sides: `remindersIngest.test.ts:226-243` ("real snooze, not a dueAt shift"), `tests/tools/test_reminders.py:210-232` (`test_snooze_sends_real_snooze_op_not_a_due_at_shift`). |

**Score:** 6/6 roadmap success criteria hold at the code level.

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| REM-01 | One Convex store, realtime, origin-tagged | CODE-VERIFIED | See SC1. `Reminders.tsx:107-110` `useQuery` — realtime by construction of Convex subscriptions. |
| REM-02 | Authed `/reminders-ingest` + `/reminders-read`, fail-closed | CODE-VERIFIED | `remindersIngest.ts:25-27,140-142` both call `validateIngestAuth` before any body parsing; `remindersIngest.test.ts:50,62,74` cover missing/blank/unset-key → 401 for both endpoints; `:324,332,344` same for `/reminders-read`. |
| REM-03 | Ástríðr `reminders` tool, same store | CODE-VERIFIED | `astridr/tools/reminders.py` full 5-action tool; registered via `astridr/tools/manifests/reminders.manifest.toml:8` with `tool_id = "reminders"` exactly matching `RemindersTool.name = "reminders"` (`reminders.py:139`) — the tool_id/name gotcha from CONTEXT.md is not present here. |
| REM-04 | Recurrence + bounded termination + one-off never respawns | CODE-VERIFIED | See SC3; runtime-roll half in `reminder_nudge.py:195-200` (`op:"complete"` only for rows with `recurrence`; a due one-off is nudged but its complete path is never invoked — `test_recurring_reminder_rolls_forward_one_off_does_not`). |
| REM-05 | Nudge exactly once, deduped, correct channel | CODE-VERIFIED | See SC4. |
| CAL-01 | Per-profile bounded-window cache cron, upsert+prune, isolated failures | CODE-VERIFIED | `calendar_cache.py:165-221` per-profile try/except (`test_business_account_failure_does_not_block_other_profiles`, `test_permission_denied_result_is_isolated_not_raised`); `calendarEvents.ts:83-139` `upsertCalendarBatchHandler` scoped prune by `(profileId, calendarAccount)`, confirmed by `remindersIngest.test.ts:591` ("does not prune rows for a different profileId") and the 101-02 summary's "other account untouched" test. |
| CAL-02 | Events + reminders on one grid, distinct, no Google write | CODE-VERIFIED | See SC2. |
| UI-01 | Lazy `/reminders` in COMMAND cluster, profile-segmented, grouped | CODE-VERIFIED | `App.tsx:121`, `navRegistry.ts:124` (COMMAND group, confirmed by reading lines 114-128 — `/reminders` sits inside the `COMMAND` group's `items` array), `icon: "clock"` resolves at `navRegistry.ts:68`. `ReminderList.tsx` groups Overdue/Today/Upcoming/Done per 101-06-SUMMARY (not independently re-read line-by-line in this pass, but existence + non-stub confirmed via passing tests asserting group-specific styling). |
| UI-02 | Optimistic complete/snooze/quick-add, reduced-motion-safe | CODE-VERIFIED | `Reminders.tsx:129-147` mutations fired directly (Convex's own optimistic-update path via `useMutation`); 101-06-SUMMARY documents a local override map in `ReminderList.tsx` for immediate UI feedback — plausible and consistent with the passing test suite, but the override-map mechanics were taken from the SUMMARY/tests rather than independently re-read against source in this pass (see "What I dropped" below). |

**Coverage:** 9/9 v12.0 requirements have code-level evidence. No orphaned requirements (REQUIREMENTS.md traceability table lists exactly REM-01..05, CAL-01/02, UI-01/02, all mapped to Phase 101 plans).

## Mid-Phase Gap Closure — Verified End-to-End

Plan 101-03 surfaced that `/reminders-ingest` had no `op:"snooze"` and no way to write `notifiedAt`, making REM-05's dedupe impossible and REM-03's snooze semantically fake (a `dueAt` shift instead of a real status transition). Verified the closure is real, not just claimed:

1. **codepulse side** — commits `205ca13` (RED: failing tests for `op:snooze`+`markNotified`) → `76db925` (GREEN). Read `convex/reminders.ts:294-316` (`markNotifiedHandler`, narrowly touches only `notifiedAt`/`updatedAt`) and `convex/remindersIngest.ts:81-107` (`op:"snooze"` → `api.reminders.snooze`; `op:"markNotified"` → `api.reminders.markNotified`) — both live in the current tree, not just in the commit diff.
2. **astridr side** — commit `2c7d1797` ("use real op:snooze now that CodePulse wires it"). Read the CURRENT `astridr/tools/reminders.py:332-351` — confirmed it sends `op:"snooze"` (not the old `op:"update"` dueAt-shift), and the module docstring (lines 11-18) documents the resolution rather than the original workaround.
3. **Consumer of the closure** — `reminder_nudge.py:103-108,111-114` uses `op:"markNotified"` and `op:"complete"` respectively; without the gap closure, REM-05's dedupe loop would have had no way to write `notifiedAt` at all. This is now closed and consumed by a real caller, not dead code.
4. **Tests re-run independently**: `npx vitest run convex/reminders.test.ts convex/remindersIngest.test.ts` → 69/69 passing (includes the gap-closure tests); `python -m pytest tests/tools/test_reminders.py -q` → included in the 116/116 astridr run below.

**Verdict: gap closure is real, complete, and consumed by downstream code on both sides of the repo boundary.**

## Cross-Repo Seam Verification

The three seams where a mismatch would silently break the phase, checked field-by-field against BOTH sides' live source (not comments):

| Seam | Astridr sends | Codepulse expects | Match |
|---|---|---|---|
| `POST /reminders-ingest {op:"create"}` | `reminders.py:267-277`: `profileId,title,notes,dueAt,priority,recurrence,tags,source` | `remindersIngest.ts:40-56`: requires `profileId,title`; forwards all fields to `api.reminders.create`, **hardcodes** `source:"astridr"` | Match (source override is intentional per D-09) |
| `POST /reminders-ingest {op:"snooze"}` | `reminders.py:345`: `{op:"snooze", id, until}` | `remindersIngest.ts:81-94`: requires `id`+`until`, dispatches `api.reminders.snooze({id,until})` | Match |
| `POST /reminders-ingest {op:"markNotified"}` | `reminder_nudge.py:105-108`: `{op:"markNotified", id, notifiedAt}` | `remindersIngest.ts:95-107`: requires `id`, dispatches `api.reminders.markNotified({id, notifiedAt})` | Match |
| `POST /calendar-ingest` | `calendar_cache.py:198-207` via `telemetry.send_to`: envelope becomes `{type:"calendar_batch", profileId, calendarAccount, events, fetchedAt}` (spread flat, `send_to` at `telemetry.py:326` does `{type: event_type, **data}`) | `calendarEvents.ts:183-199`: reads `body.profileId`/`body.calendarAccount`/`body.events`(array)/`body.fetchedAt` directly off the top-level body | Match — the extra `type` key is harmlessly ignored since Convex constructs the mutation args explicitly by name, not by passing the whole body through |
| Event shape in the batch | `calendar_cache.py:114-124` `_normalize_event`: `{googleEventId,title,start,end,allDay,location?}` | `calendarEvents.ts` `v.array(v.object({googleEventId,title,start,end,allDay,location:optional}))` | Match, field names and types line up exactly |
| Auth header | Both `reminders.py:97-104` and `reminder_nudge.py:84-90`: `Authorization: Bearer {ASTRIDR_INGEST_API_KEY}` | `ingestAuth.ts` (`validateIngestAuth`, reused verbatim, not re-derived) | Match — same shared key referenced by name in both repos, no second key introduced |

**One deliberate non-obvious design note surfaced during this check, not a bug:** `astridr/tools/reminders.py` and `astridr/automation/reminder_nudge.py` do NOT use `ConvexHandler.send_to` for their reminders traffic (only `calendar_cache.py` does) — both 101-03 and 101-05's summaries document why: `send_to` is fire-and-forget with no response body, but the reminders tool needs to read `/reminders-read`'s JSON response. They instead use a hand-rolled `_post_json` helper reading `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY` from `os.environ` directly, mirroring an existing precedent (`war_room/dispatcher.py`). This is consistent between both files and does not introduce a second API key or a divergent auth mechanism — confirmed by reading both modules' env-read lines.

## Automated Gates (Re-Run Independently, Not Trusted From SUMMARY)

- `npx vitest run convex/reminders.test.ts convex/remindersIngest.test.ts src/pages/Reminders.test.tsx` → **69/69 passing** (re-run by this verifier).
- `npx tsc --noEmit` (codepulse) → **clean** (re-run by this verifier).
- `python -m pytest tests/automation/ tests/tools/test_reminders.py tests/unit/engine/bootstrap/ tests/integration/test_automation_wiring.py -q` (astridr-repo, `feature/brain-swap`) → **116/116 passing** (re-run by this verifier).

These confirm the code compiles/type-checks and the unit-level behavior claims hold. They do **not** confirm the live wire round-trip (see Human Verification).

## Anti-Pattern Scan

Grepped every file this phase created/modified in both repos for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/`dangerouslySetInnerHTML`/stub returns:

- No debt markers found in `convex/reminders.ts`, `convex/remindersIngest.ts`, `convex/calendarEvents.ts`, `src/pages/Reminders.tsx`, `src/components/reminders/*`, `astridr/tools/reminders.py`, `astridr/automation/calendar_cache.py`, `astridr/automation/reminder_nudge.py`.
- One CONTRACT NOTE / docstring in each of `reminders.py` and `reminders.ts` explicitly documents the now-resolved snooze gap for future readers — these are documentation of a closed gap, not open debt markers, and do not reference an unresolved issue number (nothing to gate on).
- `Reminders.tsx`/`CalendarOverlay.tsx`/`ReminderList.tsx`/`QuickAdd.tsx` — zero `dangerouslySetInnerHTML` matches (grepped directly, not taken from the SUMMARY's self-reported grep).
- Zero hardcoded hex colors in the 5 new/modified reminders frontend files (re-grepped `#[0-9a-fA-F]{3,8}` — none found, matching the SUMMARY's claim).

No blockers found.

## Human Verification Required

See YAML frontmatter `human_verification` for the full structured list. Summary: five items, all requiring a live Convex deployment and/or a live Ástríðr process with real credentials (Google OAuth for all three accounts, a live Telegram channel, and `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY` correctly configured in the Ástríðr runtime environment pointed at codepulse's HTTP-actions host). None of these are code defects — they are the inherent limit of static verification for a cross-repo, cross-network feature. The phase's own plan `<verification>` blocks (101-03/04/05/06) independently flag the same manual-verification gap and were honest about not having run it.

## What I Dropped And Why

- Did not independently re-derive `ReminderList.tsx`'s full grouping logic (Overdue/Today/Upcoming/Done) or its optimistic-override-map implementation line-by-line — the file exists (confirmed via directory listing and imports resolving in `Reminders.tsx`/`tsc --noEmit` passing), and the passing `Reminders.test.tsx` suite (10/10, independently re-run) asserts group-specific behavior and complete/snooze optimism, so I trust the test coverage here rather than re-reading ~200+ lines of UI code that isn't security- or contract-critical. Flagged as CODE-VERIFIED via test evidence rather than direct-read evidence in the UI-01/UI-02 rows above, to be transparent about the lower confidence tier.
- Did not attempt to verify the `CONVEX_URL` env value astridr-repo would actually use in production resolves to the correct Convex HTTP-actions host (`.convex.site` vs `.convex.cloud` — these are different Convex-managed domains and only the former serves httpActions). This is a deployment/environment-configuration concern, not a code defect — the code correctly targets `{CONVEX_URL}{path}` for whatever value is configured, and this exact env-var convention is already used by ~15 pre-existing ingest integrations per 101-CONTEXT.md, so it isn't phase-specific risk. Surfaced as a human-verification item instead of a code finding.
- Did not flag the `google-workspace.yaml` `allowed_actions` list including `create_event` for all three per-account entries as a CAL-02 violation — that permission is pre-existing infrastructure shared by other Google-tool features (gmail send, drive files, etc.) unrelated to this phase; the reminders/calendar code paths added by this phase (`calendar_cache.py`, `CalendarOverlay.tsx`) structurally never call the create/write action, which is what CAL-02 requires ("no Google write path exists" — scoped to this feature's own code, not a claim about the shared tool's general capability).

---

*Verified: 2026-07-19*
*Verifier: Claude (gsd-verifier)*
