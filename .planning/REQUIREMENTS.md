# Requirements: v11.0 Skills Command Center — Full Lifecycle & Launch

**Milestone goal:** Turn the Skills page from a read-only catalog into a real control surface — add, move, archive, restore, delete, and *launch* skills live, executed on the host by the Forge daemon.

**Defined:** 2026-07-17 (via `/gsd-new-milestone`, research skipped — internal surfaces already mapped)

---

## Milestone v11.0 Requirements

### INTAKE — Real Skill Intake (execute today's dry-run)

- [ ] **INTAKE-01**: User can install a skill from an uploaded SKILL.md to a chosen scope (global / project / cold storage) and the file actually lands on the host disk — not the current "validation only, nothing written" dry-run.
- [ ] **INTAKE-02**: User can install a skill from a GitHub URL (with optional `subpath` fan-out) to a chosen scope, with the existing URL-shape and path-traversal guards enforced.
- [ ] **INTAKE-03**: After a successful install the skill appears in the Skills page automatically with correct origin/scope (daemon-driven registry rescan) — no manual refresh.
- [ ] **INTAKE-04**: The intake outcome surfaces the daemon's real execution/validation report; a failed install reports an actionable error and leaves no partial state on disk.

### LIFE — Skill Lifecycle Mutations

- [ ] **LIFE-01**: User can archive an active skill to cold storage from the UI (host moves it to `.claude/skills-available/` / dormant origin); it stays tracked as dormant, removing its context/token load.
- [ ] **LIFE-02**: User can restore a dormant/cold skill back to active (global or project) from the UI.
- [ ] **LIFE-03**: User can move a skill between global and project scope from the UI.
- [ ] **LIFE-04**: User can delete a skill — *archive-first*: the default destructive action archives to cold storage; true file deletion is a separate action requiring an explicit confirmation.
- [ ] **LIFE-05**: Lifecycle actions respect `isShadowing` — activating/restoring a dormant skill shadowed by an active same-name skill is surfaced and guarded (no silent conflicting activation).
- [ ] **LIFE-06**: When the Forge daemon is offline, lifecycle actions degrade gracefully — the command queues, the UI shows it will expire, and no false-success is shown (mirrors the intake expired path).

### LAUNCH — Skill Launch / Dispatch

- [ ] **LAUNCH-01**: User can run a skill directly in Chat — the invocation is sent via `chat.send` and executes (auto-send), not merely prefilled in the composer.
- [ ] **LAUNCH-02**: User can launch a skill as a Forge agent run — choosing agent / workspace / mode, with the skill as the instruction (reuses `enqueueLaunch`).
- [ ] **LAUNCH-03**: User can dispatch a skill to Ástríðr / a chosen persona to execute.
- [ ] **LAUNCH-04**: The Run affordance lets the user pick the target (Chat / Forge agent / Ástríðr) at launch time and records the launch (`useCount` / `lastUsedAt`).

### UX — Control-Surface Interaction

- [ ] **UX-01**: Every skill row exposes an overflow menu (⋯) with the applicable lifecycle + run actions (Move, Restore, Archive, Delete, Run), each gated by the skill's current scope.
- [ ] **UX-02**: The Skills page presents Global / Project / Cold Storage as drag targets; dragging a skill across scopes fires the corresponding move / archive / restore command (extends today's drag-to-category).
- [ ] **UX-03**: Mutating actions paint an optimistic/pending state and reconcile against the server command row (reuses the intake optimistic-row pattern), with clear success / failure / expiry feedback.
- [ ] **UX-04**: The Cold Storage view offers in-app restore — the "run `/manage-skills` in a terminal" dead-end is removed.

### DAEMON — Host Executor & Registry Rescan (cross-repo)

- [ ] **DAEMON-01**: The Forge daemon executes `intake` commands — validates then writes SKILL.md to the destination scope (global / project / cold) on the host filesystem.
- [ ] **DAEMON-02**: The Forge daemon executes lifecycle commands — archive (→ cold), restore, move-scope, and delete — atomically on the host, archive-first for delete.
- [ ] **DAEMON-03**: After any successful mutation the daemon rescans and re-syncs the skills registry (`syncInventory`) so CodePulse origins/scope reflect host truth.
- [ ] **DAEMON-04**: The daemon advertises its new supported command types so older daemons never receive commands they cannot run (extends `supportedTypes` / `resolveClaimTypes`).

---

## Future Requirements (deferred)

- Skill **versioning / update** (pull a newer SKILL.md over an installed one, diff before overwrite) — intake covers first-install; in-place update is a later concern.
- **Bulk multi-select** lifecycle actions (checkbox-select many skills, act at once) — considered as a UI option, deferred in favor of per-row ⋯ + drag for this milestone.
- Skill **authoring / editing of SKILL.md body** in-app — this milestone manages placement and invocation, not content editing (metadata overrides already exist).
- **`importSkills` catalog bulk-import** UI entry point — the mutation exists but wiring a catalog browser is out of this milestone's scope.

## Out of Scope

- **Editing skill file *contents*** from the browser — the browser/Convex app cannot touch the filesystem; even via the daemon, body-editing is a separate authoring concern, not lifecycle/launch.
- **A skill marketplace / registry service** — intake is upload-or-GitHub-URL; no hosted discovery catalog.
- **Non-Forge execution transports** — launch rides existing channels (`chat.send`, `enqueueLaunch`, Ástríðr); no new transport protocol.
- **Retroactive migration of legacy skill origins** — already handled by the one-time `normalizeLegacySkillOrigins` backfill; not re-litigated here.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| INTAKE-01 | Phase 97 | Pending |
| INTAKE-02 | Phase 97 | Pending |
| INTAKE-03 | Phase 97 | Pending |
| INTAKE-04 | Phase 97 | Pending |
| DAEMON-01 | Phase 97 | Pending |
| DAEMON-03 | Phase 97 | Pending |
| DAEMON-04 | Phase 97 | Pending |
| LIFE-01 | Phase 98 | Pending |
| LIFE-02 | Phase 98 | Pending |
| LIFE-03 | Phase 98 | Pending |
| LIFE-04 | Phase 98 | Pending |
| LIFE-05 | Phase 98 | Pending |
| LIFE-06 | Phase 98 | Pending |
| DAEMON-02 | Phase 98 | Pending |
| LAUNCH-01 | Phase 99 | Pending |
| LAUNCH-02 | Phase 99 | Pending |
| LAUNCH-03 | Phase 99 | Pending |
| LAUNCH-04 | Phase 99 | Pending |
| UX-01 | Phase 100 | Pending |
| UX-02 | Phase 100 | Pending |
| UX-03 | Phase 100 | Pending |
| UX-04 | Phase 100 | Pending |

**Coverage:** 22/22 v1 requirements mapped — no orphans, no duplicates.

---

## Milestone v12.0 Requirements — Personal Productivity: Reminders & Calendar

**Defined:** 2026-07-19 (roadmapped with Phase 101; back-filled into this file 2026-07-19 during Phase 101 execution — the v12.0 roadmapping pass wrote the IDs into ROADMAP.md and the plan frontmatter but never added them here, so `requirements.mark-complete REM-01` returned `not_found`).

**Milestone goal:** A sleek, profile-organized Reminders command center — personal / business / consulting reminders creatable and editable from both CodePulse and an Ástríðr conversation, always in sync, with recurrence, proactive due-nudges, and a read-only Google Calendar overlay per profile.

### REM — Reminders Store & Sync

- [x] **REM-01**: Reminders live in one Convex-backed store that is the single source of truth; CodePulse creates/updates/completes/snoozes/removes them and the UI updates in realtime via `useQuery`, with every row tagged by origin (`dashboard` / `astridr`).
- [x] **REM-02**: Ástríðr syncs reminders over authed CodePulse endpoints (`/reminders-ingest` write, `/reminders-read` read) that fail CLOSED — a missing `ASTRIDR_INGEST_API_KEY` never opens anonymous read or write access.
- [x] **REM-03**: Larry can add / list / update / complete / snooze reminders conversationally through an Ástríðr `reminders` tool that writes the same store the dashboard writes.
- [x] **REM-04**: A due-dated reminder can recur (daily / weekly / monthly / "every 1st"); completing or passing an occurrence spawns the next open one with nudge state cleared, a bounded recurrence terminates at `until`, and a completed one-off never respawns.
- [x] **REM-05**: When a reminder comes due or overdue, Ástríðr proactively nudges Larry on that reminder's profile channel exactly once (deduped via `notifiedAt`); a business reminder never nudges the personal channel.

### CAL — Google Calendar Overlay (read-only)

- [x] **CAL-01**: Each profile's real Google Calendar is cached read-only into CodePulse on a bounded forward window via a per-profile cron (`personal`→mandrasle, `business`→lmandras@myprotectall, `consulting`→lemandras@forgedinai), upserted by `googleEventId` with stale rows pruned; one account's auth failure never blanks another profile's cache.
- [x] **CAL-02**: Google events and due-dated reminders render together on one month/week grid per profile, visually distinct — and nothing is ever written back to Google (no Google write path exists).

### UI — Reminders Command Center

- [x] **UI-01**: A lazy `/reminders` route registered in `navRegistry` (COMMAND cluster) presents reminders profile-segmented (personal / business / consulting), each with its own accent, grouped Overdue / Today / Upcoming / Done.
- [x] **UI-02**: Complete / snooze / quick-add work inline from the page, applied optimistically and reconciled on server confirm, with all motion respecting `prefers-reduced-motion`.

### v12.0 Traceability

| Requirement | Phase | Plan(s) | Status |
|-------------|-------|---------|--------|
| REM-01 | Phase 101 | 101-01 | Complete |
| REM-02 | Phase 101 | 101-02 | Complete |
| REM-03 | Phase 101 | 101-03 | Complete |
| REM-04 | Phase 101 | 101-01, 101-05 | Complete |
| REM-05 | Phase 101 | 101-05 | Complete |
| CAL-01 | Phase 101 | 101-02, 101-04 | Complete |
| CAL-02 | Phase 101 | 101-06, 101-07 | Complete |
| UI-01 | Phase 101 | 101-06 | Complete |
| UI-02 | Phase 101 | 101-06, 101-07 | Complete |

**Coverage:** 9/9 v12.0 requirements mapped to Phase 101 — matches the `phase_req_ids` the SDK reports for the phase; no orphans, no duplicates.
