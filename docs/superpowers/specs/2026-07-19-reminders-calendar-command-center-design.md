# Reminders + Calendar Command Center — Design

**Date:** 2026-07-19
**Status:** Approved (brainstorming) — ready for implementation plan
**Repos:** `codepulse` (page + Convex source-of-truth) and `astridr-repo` (tool + crons). Cross-repo: build worktrees-OFF, sequential, commit per-repo (`git -C`).

## 1. Summary

A new **Reminders** page in the CodePulse command center where Larry tracks reminders across his three profiles (**personal / business / consulting**), with a read-only Google Calendar overlay per profile and proactive nudges. Reminders are fully bidirectional: creatable/editable both in the CodePulse UI and conversationally through Ástríðr, always in sync. Reminders recur. Ástríðr proactively nudges via the profile's channel (Telegram/voice) when items come due.

Profile mapping note: the user says "personal / work / consulting"; the codebase profile IDs are `personal` / `business` / `consulting` (work = business).

## 2. Requirements (from brainstorming)

- **Interaction:** fully bidirectional — first-class create/edit in BOTH CodePulse and Ástríðr, always synced.
- **Calendar:** Google Calendar events + due-dated reminders overlaid on one calendar per profile. **Read-only** — reminders are never written back to Google.
- **Nudges:** proactive — Ástríðr pings the profile's channel when a reminder is due/overdue, plus in-app badges/highlights.
- **Recurrence:** reminders can repeat (daily / weekly / monthly / "every 1st", etc.). Completing or passing a recurring reminder spawns the next occurrence.
- **Scope:** reminders + calendar built together as one feature.
- **Aesthetic:** match CodePulse's command-center look (mono type, oklch primary-glow, CRT vibe, drop-shadow hover), organized by profile, with tasteful effects — not a generic todo app.

## 3. Chosen architecture: Convex is the source of truth (Approach A)

Both surfaces read and write reminders. Convex is the shared store:

- **CodePulse** writes directly via Convex mutations → instant realtime UI, optimistic updates.
- **Ástríðr** reads/writes the same Convex tables over a new authed HTTP endpoint (reusing the `ingestAuth` pattern shared by ~20 existing ingest routes).

Rejected alternatives: (B) Ástríðr file-memory as truth mirrored to Convex — every CodePulse edit would round-trip through the WS command path to the agent, slower and more failure modes; (C) split store per profile — two code paths for one feature. Approach A matches how every other CodePulse feature already works (profiles, tasks, alerts all live in Convex) and is the least code.

**Principle tradeoff, made explicit:** this departs from Ástríðr's "markdown files are truth" memory principle. Justified: reminders are structured, shared, realtime dashboard state — not episodic memory. Convex-as-truth is correct for this class of data and consistent with the rest of CodePulse.

## 4. Components (five well-bounded units)

### 4.1 `codepulse/convex/reminders.ts` — the store
Table + mutations (`create`, `update`, `complete`, `snooze`, `remove`) and queries (`listByProfile`, `dueSoon`, `overdue`). CodePulse calls these directly; realtime by default. `complete`/scheduler handle recurrence spawn (see §6).

### 4.2 `codepulse/convex/http.ts` — authed ingest endpoints
- `POST /reminders-ingest` — Ástríðr creates/updates/completes reminders (authed via existing `ingestAuth`).
- `POST /calendar-ingest` — Ástríðr pushes the normalized read-only calendar event cache.
Both mirror the existing `/xxx-ingest` route + `OPTIONS` CORS pattern.

### 4.3 `astridr-repo/astridr/tools/reminders.py` — the Ástríðr tool
New tool with a `reminder` verb: `add` / `list` / `update` / `complete` / `snooze`. Reads via a Convex query (or a read endpoint), writes via `/reminders-ingest`. This is what makes "tell Ástríðr to remind me…" work on any channel. Registered like other tools; `tool_id` must equal the tool `.name` (past gotcha: manifest/name mismatch silently de-registers).

### 4.4 Calendar bridge — Ástríðr cron
A job in `astridr-repo/astridr/automation/cron.py` (+ `jobs.py`) that, on an interval, calls `google_workspace list_events` for each profile's account (`personal` / `business` / `consulting`), normalizes events, and pushes them to `/calendar-ingest`. Upsert by `googleEventId`; prune stale rows. Browser never touches Google directly (no client-side creds).

### 4.5 Nudge scheduler — Ástríðr cron
A job that scans Convex `dueSoon` / `overdue`, fires `ProactiveMessenger.send_alert` (`astridr/automation/proactive.py`) to the profile's channel, and marks `notifiedAt` in Convex to dedupe. Recurrence spawn handled here for passed recurring items.

### 4.6 CodePulse frontend — `Reminders.tsx`
New `/reminders` route (lazy-loaded, `App.tsx`) + registration in `src/lib/navRegistry.ts` under the **COMMAND** cluster (near Tasks/Inbox), icon e.g. `bell`/`clock` alias.

## 5. Data model

### `reminders` (Convex — source of truth)
| field | type | notes |
|---|---|---|
| `profileId` | string | `"personal" \| "business" \| "consulting"` |
| `title` | string | |
| `notes` | string? | |
| `dueAt` | number? | epoch seconds |
| `priority` | string | `"low" \| "med" \| "high"` |
| `status` | string | `"open" \| "done" \| "snoozed"` |
| `recurrence` | object? | rrule-lite: `{ freq: "daily"\|"weekly"\|"monthly", interval: number, byday?: string[], until?: number }` |
| `tags` | string[]? | |
| `source` | string | `"dashboard" \| "astridr"` |
| `notifiedAt` | number? | dedupe nudges |
| `snoozedUntil` | number? | |
| `completedAt` | number? | |
| `createdAt` / `updatedAt` | number | |

Indexes: `by_profile`, `by_status`, `by_dueAt`.

### `calendarEvents` (Convex — read-only cache)
`profileId`, `googleEventId`, `calendarAccount`, `title`, `start`, `end`, `allDay`, `location?`, `fetchedAt`. Upserted each cron cycle by `googleEventId`; stale rows pruned. Index `by_profile`, `by_googleEventId`.

## 6. Flows

- **Add via Ástríðr:** channel message → `reminders.py` tool → `POST /reminders-ingest` (`source:"astridr"`) → Convex insert → CodePulse updates live.
- **Add/edit via CodePulse:** page → Convex mutation (`source:"dashboard"`) → realtime everywhere; Ástríðr sees it on next read.
- **Complete:** either surface sets `status:"done"`, `completedAt`. If `recurrence` present, spawn next occurrence (new row with next `dueAt`, `status:"open"`, `notifiedAt` cleared).
- **Calendar overlay:** cron fetch per account → `/calendar-ingest` → `calendarEvents` → CodePulse renders events + due-dated reminders on one grid.
- **Nudge:** scheduler finds due/overdue with null `notifiedAt` → `ProactiveMessenger.send_alert` to profile channel → set `notifiedAt`.

## 7. UI / visual direction

- **Profile-segmented layout.** Three lanes (personal / business / consulting), each an accent color; segmented control to focus one, or parallel columns to see all. This is "organized by profile."
- **Split per profile:** reminders list grouped **Overdue / Today / Upcoming / Done** beside a month/week **calendar overlay** — due-dated reminders render as chips on the grid next to read-only Google events.
- **Quick actions:** inline complete (check animation), snooze, quick-add bar (⌘K), drag-to-reschedule deferred to a later pass.
- **Effects:** animated due-soon glow/pulse on overdue, count-up badges, smooth status transitions, subtle profile-accent gradients. Match existing nav drop-shadow/oklch glow idiom. Lean on `frontend-design` guidance during build.

## 8. Build sequence

1. Convex `reminders` table + CRUD/queries + tests.
2. `/reminders-ingest` + `/calendar-ingest` authed endpoints (+ CORS OPTIONS).
3. `astridr/tools/reminders.py` tool (+ registration + tests).
4. Calendar-cache cron (per-account `list_events` → `/calendar-ingest`).
5. Nudge cron + recurrence spawn.
6. `Reminders.tsx` page + nav registration + profile/calendar/effects UI.

## 9. Prerequisites & risks (verify at build, not blockers)

- **`GOOGLE_CREDS_CONSULTING` OAuth token** for `lemandras@forgedinai.ai` must be authorized in the token store (alias already exists in `config/google-workspace.yaml`). Larry must complete OAuth if not already done (env-guarded — cannot be done by the agent).
- **Google tool `account_alias` enum** — its schema docstring only lists personal/business/astridr; confirm the enum accepts `consulting` and extend if not (else the tool rejects the consulting account).
- **Cross-repo hygiene:** worktrees OFF, sequential, per-repo commits. Codepulse Convex is the **cloud** deployment (tidy-whale-981) — `npx convex` from codepulse targets cloud, not the local self-hosted backend.
- **Shared-checkout git:** re-check branch + staged files immediately before each commit (concurrent-session gotcha).
- **Nudge channel resolution:** confirm each profile resolves to the intended outbound channel in `ProactiveMessenger` before enabling sends.

## 10. Out of scope (YAGNI, later)

Write-back to Google Calendar; drag-to-reschedule; shared/delegated reminders; sub-tasks/checklists; attachments; natural-language date parsing in the CodePulse quick-add (Ástríðr already handles NL on her side).
