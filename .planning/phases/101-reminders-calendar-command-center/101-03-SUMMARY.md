---
phase: 101-reminders-calendar-command-center
plan: 03
subsystem: tools
tags: [astridr, tools, convex, reminders, activation-manager, manifest]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 02)
    provides: "authed POST /reminders-ingest (create/update/complete) and POST /reminders-read (D-07) httpActions on the shared Convex reminders table"
provides:
  - "astridr-repo RemindersTool (tool_id/name 'reminders') — add/list/update/complete/snooze reminders conversationally, writing the same Convex store CodePulse's Reminders page uses, tagged source:'astridr' (D-01/D-07/D-09/REM-03)"
  - "astridr/tools/manifests/reminders.manifest.toml — manifest-driven registration, auto-discovered by ActivationManager, tool_id pinned equal to RemindersTool.name"
affects: ["101-04 (astridr calendar cron — separate tool/module, no shared code with this plan)", "future plan: wiring op:\"snooze\" onto /reminders-ingest so snooze can set status:\"snoozed\" server-side (contract gap documented below)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level env-read + monkeypatch-in-tests HTTP pattern (astridr.core.http_pool.get_pool(), module constants _CONVEX_URL/_INGEST_KEY) mirrored from astridr/channels/war_room/dispatcher.py and astridr/integrations/langfuse_eval.py — used instead of ConvexHandler.send_to because send_to's envelope ({type, ...data}) does not fit /reminders-ingest's {op, ...} contract."
    - "Manifest-driven tool registration (astridr/tools/manifests/*.manifest.toml, auto-discovered by ActivationManager) is the tool_id==name gotcha surface, not config/tools.yaml's builtin/optional lists (confirmed unused by any config loader — grepped for tools.builtin/tools.optional/ToolsConfig consumers, zero hits outside a coincidental log-key match). config/tools.yaml still got a documentation-only entry per the plan's literal file list."

key-files:
  created:
    - C:\Users\mandr\astridr-repo\astridr\tools\reminders.py
    - C:\Users\mandr\astridr-repo\astridr\tools\manifests\reminders.manifest.toml
    - C:\Users\mandr\astridr-repo\tests\tools\test_reminders.py
  modified:
    - C:\Users\mandr\astridr-repo\config\tools.yaml

key-decisions:
  - "Snooze implemented as an op:\"update\" dueAt shift, NOT a status:\"snoozed\" transition — the shipped /reminders-ingest httpAction (101-02) has no op:\"snooze\" and does not forward status/snoozedUntil on op:\"update\" at all, even though the underlying api.reminders.snooze Convex mutation already exists. Documented in reminders.py's module docstring and flagged as a follow-up (contract gap between the plan's <behavior> spec and what 101-02 actually shipped)."
  - "HTTP transport is a thin authed POST helper (mirroring war_room/dispatcher.py + langfuse_eval.py), not ConvexHandler.send_to — send_to's envelope ({type: event_type, ...data}) is built for /runtime-ingest-family batch telemetry and does not match /reminders-ingest's {op, profileId, title, ...} direct-dispatch shape. No second API key introduced (T-101-05) — reuses ASTRIDR_INGEST_API_KEY via os.environ, same as the war_room precedent."
  - "Registration lives in the manifest TOML system (astridr/tools/manifests/reminders.manifest.toml), not config/tools.yaml's builtin/optional lists — confirmed via grep that no config loader consumes that YAML section (AstridrConfig has no matching 'tools' field). Added a documentation-only entry to config/tools.yaml anyway to match the plan's literal file list, with an inline comment pointing at the real manifest."

requirements-completed: [REM-03]

# Metrics
duration: 14min
completed: 2026-07-19
---

# Phase 101 Plan 03: Ástríðr Reminders Tool Summary

**RemindersTool (astridr-repo, manifest-registered as `reminders`) — add/list/update/complete/snooze against CodePulse's authed `/reminders-ingest` + `/reminders-read` endpoints, source `"astridr"`, zero Google Calendar surface.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-19T21:52:31Z (STATE.md handoff)
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 4 (2 created astridr code, 1 created manifest, 1 created test, 1 modified config)

## Accomplishments
- `RemindersTool` (`astridr/tools/reminders.py`) implements all 5 actions (add/list/update/complete/snooze) against the authed Convex endpoints built in 101-02
- `add` posts `op:"create"` with `source:"astridr"` to `/reminders-ingest`; `update`/`complete` post `op:"update"`/`op:"complete"` with matching id/fields
- `list` reads via authed `POST /reminders-read` with a `Bearer` header — never an anonymous GET (D-07), verified by a dedicated test that asserts no `.get()` call ever happens
- `dueAt`/`snoozeUntil` accept either epoch seconds or an ISO 8601 string (Ástríðr resolves NL time before calling the tool) and are normalized before the wire call
- Non-2xx responses from either endpoint (401, 500, etc.) become a `ToolResult(success=False, error=...)`, never an unhandled exception
- Zero Google Calendar surface: no `calendar` action in the parameters enum, no `google`/`googleapiclient` import anywhere in the file, `required_credentials` contains only `ASTRIDR_INGEST_API_KEY` (D-02, T-101-07 "eliminate" disposition satisfied structurally)
- Registered via `astridr/tools/manifests/reminders.manifest.toml` with `tool_id = "reminders"` matching `RemindersTool.name` exactly, auto-discovered by `ActivationManager`
- 23/23 new tests green: action dispatch + wire-body assertions for all 5 actions, dueAt normalization (ISO and epoch), error-path (401/500/missing-config), no-Google checks, and 3 registration tests (manifest tool_id==name, manifest loads through the real pydantic `ToolManifest`, `discover_manifests()` picks it up)

## Task Commits

Each task was committed atomically on `feature/brain-swap` (astridr-repo):

1. **Task 1: RemindersTool with 5 actions** - `baf039ae` (feat)
2. **Task 2: Register the tool (tool_id == name)** - `c9b8ce5a` (feat)

**Plan metadata:** pending (this commit, codepulse)

## Files Created/Modified
- `astridr/tools/reminders.py` (astridr-repo) - `RemindersTool(BaseTool)`, `_post_ingest`/`_post_read`/`_post_json` authed HTTP helpers, `_normalize_due_at` (epoch-or-ISO), dispatch for add/list/update/complete/snooze
- `astridr/tools/manifests/reminders.manifest.toml` (astridr-repo) - manifest registration, `tool_id="reminders"`, category `productivity`, single `ASTRIDR_INGEST_API_KEY` required secret
- `tests/tools/test_reminders.py` (astridr-repo) - 23 tests covering wire-body correctness per action, dueAt normalization, error handling, no-Google-surface assertions, registration invariants
- `config/tools.yaml` (astridr-repo) - documentation-only entry for `reminders` under `optional`, with an inline comment pointing at the real manifest-driven registration

## Decisions Made
- **Snooze contract gap (see key-decisions above)** — implemented as a `dueAt` shift via `op:"update"` rather than a `status:"snoozed"` transition, because the shipped `/reminders-ingest` httpAction has no `op:"snooze"` and silently ignores `status`/`snoozedUntil` fields on `op:"update"`. The reminder's `dueAt` moves forward but `status` stays `"open"`. A future plan should add `op:"snooze"` to `convex/remindersIngest.ts` dispatching onto the already-existing `api.reminders.snooze` mutation (built in 101-01) — this is a codepulse-side change, out of scope for this astridr-repo-only plan.
- **Thin authed POST helper instead of `ConvexHandler.send_to`** — `send_to`'s envelope (`{type: event_type, ...data}`) is shaped for the `/runtime-ingest`-family batch telemetry surface and does not match `/reminders-ingest`'s `{op, profileId, title, ...}` direct-dispatch contract. Built a minimal helper mirroring the already-established `war_room/dispatcher.py` / `langfuse_eval.py` pattern (module-level `os.environ` reads for `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY`, `astridr.core.http_pool.get_pool()` for connection reuse, Bearer auth header) — no second API key introduced (T-101-05).
- **Manifest TOML is the real registration surface, not `config/tools.yaml`** — grepped the codebase for any consumer of `tools.builtin`/`tools.optional`/a `ToolsConfig` field on `AstridrConfig` and found none; that YAML section is not wired into any loader. The actual tool_id/name-pinning mechanism the CONTEXT.md "past gotcha" refers to is `ActivationManager`'s manifest system (`astridr/tools/manifests/*.manifest.toml`, `discover_manifests()`, pydantic `ToolManifest`). Registered there as the source of truth; added a `config/tools.yaml` entry anyway to satisfy the plan's literal `<files>` list, documented as decorative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] Snooze does not claim a `status:"snoozed"` transition it cannot actually perform**
- **Found during:** Task 1 (RemindersTool implementation)
- **Issue:** The plan's `<behavior>` spec says "snooze -> op:update with status snoozed + snoozedUntil." Reading the actual 101-02-shipped `convex/remindersIngest.ts` (per the prior-wave instruction to read it before writing the tool) shows `op:"update"` only forwards `title`/`notes`/`dueAt`/`priority`/`recurrence`/`tags` — it never reads `status` or `snoozedUntil` off the request body, and there is no `op:"snooze"` at all. Sending those fields as specified would be silently dropped by the server, making the tool's snooze action a no-op that lies about what it did.
- **Fix:** Implemented snooze as the closest functionally-equivalent operation achievable through the real contract — `op:"update"` with `dueAt` shifted to the requested snooze time. Documented the gap prominently in the module docstring, in an inline code comment at the call site, and in this summary, with an explicit test (`test_snooze_shifts_due_at_via_update_op_per_contract_gap`) asserting the tool never sends `status`/`snoozedUntil` (since they'd be no-ops).
- **Files modified:** `astridr/tools/reminders.py`, `tests/tools/test_reminders.py`
- **Verification:** Test suite green (23/23); wire-body assertions confirm no dead fields are sent.
- **Committed in:** `baf039ae` (Task 1 commit)

**2. [Rule 1 - Bug avoidance] Registration target corrected from `config/tools.yaml` to the manifest TOML system**
- **Found during:** Task 2 (tool registration)
- **Issue:** The plan named `config/tools.yaml` as the file to modify for registration and the "tool_id == name" gotcha. Grepping the codebase found `config/tools.yaml`'s `tools: builtin/optional` section has zero consumers — no `AstridrConfig` field maps to it, and it is not read by any loader. The actual tool_id-pinning mechanism the CONTEXT.md canonical-refs section describes ("tool_id/manifest name must equal `.name` — past gotcha silently de-registers a tool") is `ActivationManager`'s manifest system (`astridr/tools/manifests/*.manifest.toml`), confirmed by reading `activation_manager.py`'s `_load_and_register` (which explicitly pins `tool.name = manifest.tool_id` on mismatch) and precedent manifests like `imagegen.manifest.toml` (which has an identical "tool_id MUST equal X.name" warning comment).
- **Fix:** Registered `RemindersTool` via `astridr/tools/manifests/reminders.manifest.toml` (the mechanism that is actually load-bearing), with a registration test loading it through the real pydantic `ToolManifest` model and `discover_manifests()`. Also added the plan-specified `config/tools.yaml` entry for documentation consistency with the plan's literal file list, with an inline comment pointing readers at the real manifest.
- **Files modified:** `astridr/tools/manifests/reminders.manifest.toml` (new), `config/tools.yaml`
- **Verification:** `test_manifest_tool_id_equals_tool_name`, `test_manifest_loads_via_activation_manager_tool_manifest` (loads through real `ToolManifest.from_path` + asserts `discover_manifests()` picks it up) — both green.
- **Committed in:** `c9b8ce5a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — avoiding shipping code that claims behavior it cannot actually perform over the real wire contract or through the real registration mechanism)
**Impact on plan:** Both auto-fixes keep the tool honest about what it does and registers it through the mechanism that actually gates activation. No scope creep — no codepulse code was touched (astridr-repo-only plan, per the cross-repo commit protocol); the snooze contract gap is flagged as a follow-up rather than fixed in-place, since fixing it requires a codepulse-side `convex/remindersIngest.ts` change out of this plan's repo scope.

## Issues Encountered

- **Cross-plan contract mismatch (snooze)** — see Deviation #1 above. Not a blocker for this plan (astridr-repo-only), but a genuine gap between what 101-02 shipped and what 101-03's plan assumed. Recommend a follow-up quick-task or 101-0X addendum to add `op:"snooze"` to `convex/remindersIngest.ts` dispatching onto the existing `api.reminders.snooze` mutation, after which `reminders.py`'s `_snooze` can be updated to send `op:"snooze"` instead of the current `dueAt`-shift workaround.

## User Setup Required

None — no new environment variables. `ASTRIDR_INGEST_API_KEY` is the existing shared ingest key (already required by ~15+ other astridr-repo integrations, including the closely-mirrored `war_room/dispatcher.py`).

## Next Phase Readiness

- `RemindersTool` is registered and functional against the live `/reminders-ingest`/`/reminders-read` contract for add/list/update/complete, and functional-but-flagged for snooze (dueAt-shift, not a true status transition) — ready for Ástríðr to use conversationally.
- 101-04 (calendar cron) and 101-05 are independent of this plan's files (separate tool/module, no shared code) and can proceed.
- **Follow-up recommended (not blocking):** wire `op:"snooze"` into `convex/remindersIngest.ts` (codepulse) onto the existing `api.reminders.snooze` Convex mutation, then update `reminders.py::_snooze` to use it — see Deviation #1 / Issues Encountered above.
- No blockers. `python -m pytest tests/tools/test_reminders.py -v` — 23/23 passing. Plan `<verification>` block confirmed manually: `grep -n "reminders-ingest\|reminders-read" astridr/tools/reminders.py` shows both endpoints referenced; no `google`/`googleapiclient` import anywhere in the file.

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: C:\Users\mandr\astridr-repo\astridr\tools\reminders.py
- FOUND: C:\Users\mandr\astridr-repo\astridr\tools\manifests\reminders.manifest.toml
- FOUND: C:\Users\mandr\astridr-repo\tests\tools\test_reminders.py
- FOUND: C:\Users\mandr\astridr-repo\config\tools.yaml (modified)
- FOUND commit (astridr-repo, feature/brain-swap): baf039ae (feat — RemindersTool + tests)
- FOUND commit (astridr-repo, feature/brain-swap): c9b8ce5a (feat — manifest registration)
