---
status: complete
phase: 101-reminders-calendar-command-center
source: [101-REVIEW-FIX.md, 101-UAT.md test 8 (NL half)]
scope: targeted retest — 8 review fixes (2026-07-20) + test-8 NL half never retested via real chat
mode: automated (Playwright headless vs Clerk-free Vite :5199 + real Convex mutations + live astridr cron/chat), operator-authorized
started: 2026-07-21T10:43:16Z
updated: 2026-07-21T11:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Edit popover local-time round-trip (CR-02 + WR-06)
expected: Edit popover pre-fills the reminder's local wall time (no UTC shift); save-without-change leaves dueAt unchanged; a title edit persists with no snap-back/flicker.
result: pass
evidence: Automated Playwright run (headless, UTC-4 runner) — popover pre-filled "2026-07-21T15:00" exactly; no-op save left dueAt unchanged; title edit persisted at 1s and 5s (no snap-back); dueAt unshifted after title edit. 6/6 checks green.

### 2. All-day event day placement (WR-05)
expected: An all-day calendar event sits in the grid cell of its actual calendar date (not one day early), and clicking that day lists it marked "All day".
result: pass
evidence: Synthetic all-day event (start = UTC midnight Jul 23, the exact regression shape) injected via real upsertBatch under isolated calendarAccount "uat-retest". Rendered in the Jul 23 cell, absent from Jul 22; day click showed it under CALENDAR marked "All day". Bonus: with "Showing Thu, Jul 23" active, 2 undated chat-created reminders stayed visible under UPCOMING — re-confirms the 101-07 day-filter exemption.

### 3. Every-2-weeks recurrence jump (WR-03)
expected: Create a reminder recurring "every 2 weeks on Monday" (interval 2 + byday MO). Completing it spawns the next occurrence 2 weeks out on Monday — not next Monday.
result: pass
evidence: FIRST RUN FAILED (+7d, Aug 3) — exposed the stale-deployment gap (see Gaps). After deploying the committed functions to the local backend and resetting: complete of the Jul 27 09:00 reminder via UI spawned exactly one open occurrence at Aug 10 09:00 (+14d). Verified at data layer.

### 4. Double-complete idempotence (WR-01)
expected: Rapidly double-clicking complete on a recurring reminder spawns exactly ONE next occurrence — no duplicate rows.
result: pass
evidence: True same-id race exercised at the mutation layer post-deploy: reminders:complete called twice with the same id → exactly one done row + one spawned occurrence (2 rows total). UI note: rapid double-click in the list re-resolves onto the newly-spawned row's button (same title) and legitimately completes successive occurrences — a clean chain, not a duplication bug.

### 5. Shared-invite profile scoping (WR-04)
expected: A Google event present on two profiles' calendars (shared invite) shows under BOTH profiles, each keeping its own copy; a cron refresh doesn't make it ping-pong or vanish from one profile.
result: pass
evidence: Same googleEventId pushed via real upsertBatch to (personal, uat-a) and (business, uat-b): both rows coexist. Re-push of the personal copy (simulated next cron cycle, title v2) patched personal in place and left the business copy untouched — no steal/ping-pong, no prune leakage (pruned: 0 across all pushes).

### 6. Ástríðr NL chat round-trip + future-day persistence (test-8 NL half + 101-07)
expected: Via real Ástríðr chat — "remind me to X tomorrow at 3pm" appears on the Reminders page in realtime with its origin marker; asking Ástríðr to list reminders includes it; completing via chat updates the page. Then clicking a future day in the calendar keeps undated/other-day reminders visible under Upcoming (the 101-07 fix, now exercised with chat-created rows).
result: pass (after in-session astridr-repo fixes — see Gaps #2 resolution)
reported: "Initial run 2026-07-21 ~07:01 FAILED: 'remind me to check the UAT retest result tomorrow at 4pm' → Ástríðr replied 'I couldn't set that reminder… issue connecting to your Google Calendar.' No reminder created. After the three fixes + container hot-patch: create via NL works (tool chip 'reminders', row realtime with Ástríðr marker, source=astridr), and one-shot NL complete works (model chains list → complete with the real Convex id; row done in Convex, verified). Dated-row day-filtering conforms to spec (dated rows filter on other days; only undated rows are exempt per 101-07)."
severity: major (resolved in session)
root_cause: |
  Two astridr-repo defects, mechanism verified in live logs + source:
  (a) RemindersTool (tool_id "reminders", category "productivity") is in NO cluster in
      TOOL_CLUSTERS and not in ALWAYS_ON (astridr/agent/tool_filter.py:17-58), so the
      tool filter silently removes it from every LLM turn (logged active_clusters
      ['memory','utility','web','workspace','files']; 181→30 tools). This is the
      documented "delegate_goal trap" (see file's own comment at L36-41) recurring for
      Phase 101's new tool. The model, blind to `reminders`, routed to google_personal.
  (b) google_personal create_event sent a naive datetime ('2026-07-22T16:00:00', no
      timeZone) → Google HttpError 400 "Missing time zone definition for start time",
      so even the calendar fallback failed.
  CodePulse-side path (reminders-ingest → Convex → realtime UI) was NOT reached; no
  CodePulse defect involved. Cross-repo fix: astridr-repo (add "reminders" to a cluster
  reachable from default/commander categories + fix create_event tz handling).
resolution: |
  FIXED during session (operator-directed) — three astridr-repo commits, all TDD'd,
  hot-patched into the running astridr-agent container and re-verified live:
  - feature/brain-swap dcc0f8d2 (cherry-pick of main d5d948e6): reminders added to the
    utility tool cluster → tool now survives filtering.
  - feature/brain-swap 0c3ae57c: list output now includes each reminder's Convex _id
    (model had NO id source, guessed index '4', v.id validator 400'd).
  - feature/brain-swap abcbd57b: id-required errors for complete/update/snooze now
    instruct the model to call action='list' first (bare error made gemini-flash give
    up instead of chaining).
  RE-RUN RESULT: full round-trip green — NL create via chat → tool chip "reminders" →
  row realtime on page with Ástríðr origin marker (source: astridr); one-shot NL
  complete → model chained list → complete with real id → reminders.completed, row
  done in Convex; dated-row day-filter behavior conforms to 101-07 spec. Result
  upgraded to pass; see test 6.
  STILL OPEN (astridr-repo, minor): (a) NL "4pm" parsed as 16:00 UTC not local (tool
  replied honestly "4 PM UTC"); (b) google create_event still 400s on naive datetimes
  (now moot for reminders, still broken for genuine NL calendar-event creation).

### 7. Snooze re-nudges (CR-01)
expected: Snooze a reminder that has already fired its nudge to a few minutes out. When the snoozed time arrives, exactly one NEW nudge arrives (pre-fix: snooze permanently killed all future nudges for that row).
result: pass
evidence: End-to-end live: reminder due 07:00 → cron nudged 07:00:34 (Telegram, notifiedAt stamped). Snoozed via UI SnoozeMenu custom time to 07:08 → data layer confirmed status=snoozed, snoozedUntil=07:08, notifiedAt CLEARED (the CR-01 mechanism). Next cron tick 07:10:33 sent exactly one second nudge for the same id (scan nudged=1, no storm). Full pre-fix failure mode (permanent nudge suppression) disproven live.

## Summary

total: 7
passed: 7
issues: 0 (1 found during session, root-caused to astridr-repo, fixed + re-verified live in session)
pending: 0
skipped: 0

Session notes:
- All test data cleaned up (9 RETEST reminder rows deleted by verified id; 3 synthetic
  calendar events pruned via empty scoped batches; verified clean on both profiles).
- Stale-deployment gap (Gaps #1) RESOLVED during session: convex deploy to the local
  self-hosted backend; WR-02 rejection re-probed live before re-testing.
- Test 6 gap (Gaps #2) is astridr-repo scope — needs routing there, not a CodePulse plan.
- Pre-existing astridr errors observed in logs, out of scope but flagged: dep_scanner
  cron JSONDecodeError crash-looping; supabase heartbeat "unhealthy" critical_event.

## Gaps

- truth: "Backend review fixes (CR-01, WR-01, WR-02, WR-03, WR-04) are live on the self-hosted Convex backend"
  status: failed
  reason: "Live probe: reminders:create accepted recurrence.interval=0 (WR-02 validation absent) and complete() of an every-2-weeks byday reminder spawned +7d not +14d (pre-WR-03 behavior). The 2026-07-20 fix commits were unit-tested but never deployed to convex-backend."
  severity: major
  test: 3
  artifacts: [convex/reminders.ts (correct in repo), self-hosted convex-backend deployment (stale)]
  missing: [convex deploy to http://127.0.0.1:3210 after the fix commits]
  resolution: "Deployed during this UAT session; backend re-probed and tests re-run — see test results."

- truth: "NL 'remind me…' via web chat creates a reminder through RemindersTool (REM-02 NL path)"
  status: failed
  reason: "Tool filter excludes RemindersTool from every LLM turn ('reminders' in no TOOL_CLUSTERS cluster, not ALWAYS_ON); agent fell back to google_personal create_event which 400s on naive datetimes (no timeZone)."
  severity: major
  test: 6
  artifacts: [astridr-repo astridr/agent/tool_filter.py:17-58, astridr-agent log 2026-07-21T11:01:08-11Z]
  missing: [astridr-repo fix — add 'reminders' to cluster map reachable from default/commander categories; create_event timeZone handling]
  cross_repo: astridr-repo (out of CodePulse scope — route as astridr phase/quick task)

## Notes

- WR-02 (recurrence.interval validation) deliberately excluded: only observable via API error responses, covered by 6 new unit tests in convex/reminders.test.ts.
- Prior full UAT (101-UAT.md, status complete) is untouched — this is a post-review-fix regression session.
