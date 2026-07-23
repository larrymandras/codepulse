# Phase 101: Reminders & Calendar Command Center — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning (authored directly from the approved brainstorming spec)
**Source design:** `docs/superpowers/specs/2026-07-19-reminders-calendar-command-center-design.md`

<domain>
## Phase Boundary

Add a **Reminders** command-center page where Larry tracks reminders across his three profiles (**personal / business / consulting**), plus a **read-only Google Calendar overlay** per profile and **proactive due-nudges**. Reminders are **bidirectional**: creatable/editable both in the CodePulse UI and conversationally through Ástríðr, always in sync. Reminders **recur**.

**In scope:** REM-01..05 (reminders store, Ástríðr sync endpoints, Ástríðr tool, recurrence, proactive nudges), CAL-01/02 (read-only calendar cache + overlay), UI-01/02 (profile-segmented page, quick actions + effects).

**Not in scope (deferred, YAGNI):** write-back to Google Calendar; drag-to-reschedule; shared/delegated reminders; sub-tasks/checklists; attachments; natural-language date parsing *inside* the CodePulse quick-add (Ástríðr already parses NL on her side).

Cross-repo: **codepulse** (plans 01/02/06 — page + Convex source of truth) and **astridr-repo** (plans 03/04/05 — tool + crons). Build worktrees-OFF, sequential, commit per-repo via `git -C` (same pattern as Phase 97's forge-repo plans). Codepulse Convex is the **cloud** deployment `tidy-whale-981` — `npx convex` from codepulse targets cloud, not the local self-hosted backend.

Profile-name note: Larry says "personal / work / consulting"; the codebase profile IDs are `personal` / `business` / `consulting` (**work = business**).
</domain>

<decisions>
## Implementation Decisions

### Source of truth & sync
- **D-01:** **Convex is the source of truth** for reminders — a `reminders` table CodePulse writes directly (Convex mutations, realtime), and Ástríðr reads/writes over authed HTTP. **Rejected:** Ástríðr file-memory as truth mirrored to Convex (every CodePulse edit would round-trip through the WS command path — slower, more failure modes, no optimistic UI). Justified departure from Ástríðr's "markdown-is-truth" memory principle: reminders are structured, shared, realtime *dashboard* state, not episodic memory — and every other CodePulse feature (profiles, tasks, alerts) already lives in Convex. [REM-01]
- **D-07:** Ástríðr **writes** via authed `POST /reminders-ingest` reusing `ConvexHandler.send_to(endpoint, ...)` + `ASTRIDR_INGEST_API_KEY` (the existing `validateIngestAuth` fail-closed pattern), and **reads** via a dedicated authed `POST /reminders-read` endpoint (never expose reminders to anonymous reads). No new transport — reuses the `/xxx-ingest` httpAction family in `convex/http.ts`. [REM-02, REM-03]
- **D-09:** Every reminder row carries a **`source`** field (`"dashboard"` | `"astridr"`) recording its origin. Both surfaces write freely; `source` is for audit/telemetry, never a write gate. [REM-01, REM-03]

### Calendar
- **D-02:** The calendar is a **read-only overlay** — reminders are NEVER written back to Google Calendar. The grid displays existing Google events beside/under due-dated reminders. [CAL-01, CAL-02]
- **D-03:** **Ástríðr fetches** Google Calendar (the browser has no Google credentials and the strict Convex runtime cannot hold them); a cron normalizes events and pushes them to a Convex **cache** table. The browser only ever reads the cache. [CAL-01]
- **D-06:** Profiles map to real Google accounts via the existing `google_workspace.yaml` aliases: `personal` → `mandrasle@gmail.com`, `business` → `lmandras@myprotectall.com`, `consulting` → `lemandras@forgedinai.ai`. The `consulting` alias **already exists** in config (`GOOGLE_CREDS_CONSULTING`). [CAL-01]
- **D-10:** `calendarEvents` is a **cache**: each cron cycle upserts by `googleEventId` and prunes stale rows. Fetch horizon is a bounded forward window (default configurable, ~next 60 days) so the cache stays small. [CAL-01]

### Nudges & recurrence
- **D-04:** Proactive nudges fire from **Ástríðr's `ProactiveMessenger.send_alert`** to the reminder's profile channel (Telegram/voice), deduped by writing `notifiedAt` back to the reminder. In-app: CodePulse renders due-soon / overdue state from the same rows. [REM-05]
- **D-05:** **Recurrence = rrule-lite** `{ freq: "daily"|"weekly"|"monthly", interval: number, byday?: string[], until?: number }`. Completing or passing a recurring occurrence spawns the **next open occurrence** (new row, next `dueAt`, `status:"open"`, `notifiedAt` cleared); a completed **one-off** never respawns. [REM-04]
- **D-11:** Nudge scheduling is an **Ástríðr-side cron** (`cron.py`/`jobs.py`), NOT a Convex cron — the outbound channel, `ProactiveMessenger`, and its outbound-gate all live in Ástríðr. Convex only exposes `dueSoon`/`overdue` queries the cron scans. [REM-05]

### UI
- **D-08:** The Reminders page is a **lazy-loaded route** `/reminders` registered in `src/lib/navRegistry.ts` under the **COMMAND** cluster (near Tasks/Inbox), following the exact lazy-import + Suspense pattern every other page uses in `App.tsx`. [UI-01]
- **D-12:** Reminders **and** calendar ship together in this one phase (Larry's explicit choice), not phased. [scope]
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase
- `.planning/ROADMAP.md` §"### Phase 101: Reminders & Calendar Command Center" — goal + 6 success criteria + requirement list.
- `docs/superpowers/specs/2026-07-19-reminders-calendar-command-center-design.md` — the approved design (architecture, data model, flows, visual direction, prerequisites).
- `.planning/phases/101-reminders-calendar-command-center/101-UI-SPEC.md` — the UI design contract for plan 06.

### CodePulse — Convex store & ingest (extend, don't rebuild)
- `convex/schema.ts` — `defineTable` + `.index(...)` idiom; add `reminders` and `calendarEvents` here.
- `convex/profiles.ts` — mutation/query idiom (upsert-by-index, `Date.now()/1000` epoch-seconds convention, seeded profile IDs `personal`/`business`/`consulting`).
- `convex/ingestAuth.ts` — `validateIngestAuth` (fail-closed, `ASTRIDR_INGEST_API_KEY`), `getCorsHeaders`, `unauthorizedResponse`. Every new endpoint MUST call these.
- `convex/v6Ingest.ts` — canonical httpAction ingest handler shape (OPTIONS→204, auth check, field validation→400, `ctx.runMutation`, `{ok:true}` 200, catch→400). Mirror for `/reminders-ingest`, `/reminders-read`, `/calendar-ingest`.
- `convex/http.ts` — route registration (`http.route({ path, method, handler })` + matching `OPTIONS`).
- `convex/tasks.ts`, `convex/alerts.ts` — closest existing CRUD analogs (status lifecycle, indexes).

### CodePulse — frontend (mirror conventions)
- `src/App.tsx` — lazy route registration + Suspense fallback pattern.
- `src/lib/navRegistry.ts` — `navGroups` (COMMAND cluster), `iconComponents` map (reuse `clock`/`bell` or add an icon), `NavItem` shape.
- `src/layouts/DashboardLayout.tsx` — nav render, active-state oklch glow / drop-shadow idiom the effects should match.
- A recent lazy page (e.g. `src/pages/Tasks.tsx`, `src/pages/Alerts.tsx`) — Convex `useQuery`/`useMutation` wiring, page header, profile handling.

### Ástríðr (astridr-repo) — tool & crons
- `astridr/tools/base.py` — `BaseTool` ABC (`ToolResult`, `CredentialRequirement`, `execute`), `input_schema`/parameters + `name` conventions. **tool_id/manifest name must equal `.name`** (past gotcha silently de-registers a tool).
- `astridr/tools/google_workspace.py` — `_handle_calendar` / `_calendar_list` (`list_events`), per-account alias resolution, `account_alias` enum (⚠ its schema docstring only lists personal/business/astridr — **confirm/extend the enum to accept `consulting`**).
- `astridr/engine/telemetry.py` — `ConvexHandler.send_to(endpoint, event_type, data)` (posts to `<base>/<endpoint>` reusing configured base URL + auth) — the write seam (D-07).
- `astridr/automation/proactive.py` — `ProactiveMessenger.send_alert(...)` (outbound to channel, already has an outbound gate) — the nudge seam (D-04).
- `astridr/automation/cron.py`, `astridr/automation/jobs.py` — scheduler registration for the calendar-cache and nudge crons.
- `config/google-workspace.yaml` — the `consulting` alias (`lemandras@forgedinai.ai`, `GOOGLE_CREDS_CONSULTING`, `list_events` allowed).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (no new infrastructure)
- **Convex-as-store**: `defineTable`/index + mutation/query is the same pattern behind ~20 features. `reminders` and `calendarEvents` are ordinary tables.
- **`ingestAuth` family**: `validateIngestAuth` + `getCorsHeaders` + `unauthorizedResponse` already secure ~15 ingest routes fail-closed. New endpoints slot straight in.
- **`ConvexHandler.send_to`**: posts to an arbitrary endpoint (`/reminders-ingest`, `/calendar-ingest`) reusing the configured base URL + `ASTRIDR_INGEST_API_KEY` — the write seam, no bespoke HTTP client.
- **`google_workspace` calendar**: `list_events` per account is already implemented and permission-gated; the calendar cron is a thin per-profile loop over it.
- **`ProactiveMessenger`**: outbound-to-channel with an existing outbound gate — the nudge cron just calls `send_alert`.
- **Lazy page + `navRegistry`**: every page is registered identically; Reminders is one more entry.

### Established patterns
- **Epoch-seconds timestamps** (`Date.now()/1000`) across Convex tables (see `profiles.ts`) — match it for `dueAt`/`createdAt`/etc.
- **Fail-closed ingest auth** (`validateIngestAuth`) — a missing key does NOT open the endpoint; `/reminders-read` must be authed too.
- **Realtime `useQuery`** — Skills/Tasks pages auto-update on Convex reactivity; the Reminders page gets live cross-surface sync for free once mutations land.

### Integration points
- CodePulse mutation ↔ Ástríðr `POST /reminders-ingest` — same `reminders` table, both write directions (D-01/D-07).
- Calendar cron `list_events` per profile → `POST /calendar-ingest` → `calendarEvents` → browser overlay (D-03/D-10).
- Nudge cron `dueSoon`/`overdue` query → `ProactiveMessenger.send_alert` → `notifiedAt` write-back (D-04/D-11).
</code_context>

<specifics>
## Specific Ideas
- Larry wants it "sleek, streamlined, well organized but at the same time kick ass with some great effects" and "organized by profile" — the UI must match CodePulse's command-center aesthetic (mono type, oklch primary-glow, CRT vibe, the nav's drop-shadow hover), NOT a generic todo app. Detail in 101-UI-SPEC.md.
- Single source of truth for install/sync semantics is a recurring Larry preference — hence Convex-as-truth + Ástríðr syncing the same rows, rather than two divergent stores (D-01).
</specifics>

<deferred>
## Deferred Ideas
- Write-back to Google Calendar (reminder → real Google event) — D-02 keeps calendar read-only this phase.
- Drag-to-reschedule on the calendar grid; shared/delegated reminders; sub-tasks/checklists; attachments.
- NL date parsing inside the CodePulse quick-add (Ástríðr already handles NL conversationally).
None were scope-creep during brainstorming — all were explicitly bounded out.
</deferred>

<prerequisites>
## Prerequisites & risks (verify at execution — not blockers)
- **`GOOGLE_CREDS_CONSULTING`** OAuth token for `lemandras@forgedinai.ai` must be authorized in the token store (alias already in `config/google-workspace.yaml`). Env-guarded — **Larry** must complete OAuth if not already done; the agent cannot.
- **`account_alias` enum** in `google_workspace.py` — confirm it accepts `consulting`; extend if the enum/docstring omits it, else the calendar cron's consulting fetch is rejected (manifest/enum-mismatch class of bug).
- **`ASTRIDR_INGEST_API_KEY`** present in both the Ástríðr runtime env and the codepulse Convex deployment env (it already gates the existing ingest family).
- **Shared-checkout git**: re-check branch + staged files immediately before each per-repo commit (concurrent-session gotcha); codepulse currently sits on `master` with unrelated uncommitted work — do not stage it.
- **Nudge channel resolution**: confirm each profile resolves to the intended outbound channel in `ProactiveMessenger` before enabling sends.
</prerequisites>

---

*Phase: 101-reminders-calendar-command-center*
*Context gathered: 2026-07-19*
