# Phase 102: Tech Debt Cleanup (reminders dead code + astridr comment sweep) - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 6 (3 codepulse, 3 astridr-repo) + 1 discovered site
**Analogs found:** 7 / 7 — this phase is subtractive/corrective, not additive. Every "pattern" here is either (a) the exact current code to delete/edit, or (b) an existing sibling implementation to make the edited code match.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/reminders.ts` (codepulse) | service/query module | CRUD (delete two query handlers) | `listByProfile`/`listByProfileHandler` in same file (lines 373-389) — the pattern for a live query the deleted ones should NOT resemble structurally afterward, just proof of the surviving shape | exact (same file, same module) |
| `convex/schema.ts` (codepulse) | config/model (schema def) | CRUD (drop one index) | the `reminders` table's own `by_profile`/`by_status` index chain (same `defineTable` block) | exact |
| `convex/reminders.test.ts` (codepulse) | test | CRUD (delete 2 `it` blocks + 2 imports) | `markNotifiedHandler` describe block (lines 516+) in same file — shows the correct post-deletion test-file shape (describe blocks left intact, no orphaned imports) | exact |
| `astridr/automation/calendar_cache.py` (astridr-repo) | service (cron worker) | event-driven (cron → HTTP push) | `refresh()` in the same file (already duck-typed on `telemetry`) — no code change needed there, only the caller changes | exact (same file) |
| `astridr/engine/bootstrap/cron_dispatcher.py` `_run_calendar_cache_refresh` (astridr-repo) | controller (cron dispatch) | event-driven | `_run_reminder_nudge` (lines 808-829, same file) and the `telemetry=self._telemetry` call sites at lines 393, 588, 727, 906 — the established "pass `self._telemetry` straight through" pattern every other cron in this dispatcher already follows | exact (sibling method, same class) |
| `astridr/tools/reminders.py` (astridr-repo) | utility/config (module-level comment block) | request-response (HTTP tool) | `convex/http.ts:94-101` (codepulse) — ground truth that `/calendar-ingest` is served by the one local backend | exact (cross-repo ground-truth citation) |
| `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (astridr-repo) — **discovered, not in original file list** | test | event-driven | `test_calendar_cache_refresh_calls_module_refresh_with_deps` in the same file — the test itself imports `CodePulsePoster` and asserts on it; it WILL fail to import once the class is deleted | exact (same file, breaks on deletion) |

## Pattern Assignments

### `convex/reminders.ts` (service/query module, CRUD)

**Analog:** itself — `listByProfileHandler`/`listByProfile` (surviving sibling pattern)

**Code to DELETE verbatim** (lines 391-422, the entire tail of the file):
```typescript
/** Open|snoozed rows with dueAt <= now+withinSeconds, never status "done". */
export async function dueSoonHandler(
  ctx: { db: RemindersDb } | any,
  withinSeconds: number,
  now: number
) {
  const cutoff = now + withinSeconds;
  const rows = await ctx.db.query("reminders").withIndex("by_dueAt").collect();
  return rows.filter(
    (r: any) =>
      r.status !== "done" && r.dueAt !== undefined && r.dueAt <= cutoff
  );
}

export const dueSoon = query({
  args: { withinSeconds: v.float64() },
  handler: async (ctx, { withinSeconds }) =>
    dueSoonHandler(ctx, withinSeconds, Date.now() / 1000),
});

/** Open|snoozed rows with dueAt < now, never status "done". */
export async function overdueHandler(ctx: { db: RemindersDb } | any, now: number) {
  const rows = await ctx.db.query("reminders").withIndex("by_dueAt").collect();
  return rows.filter(
    (r: any) => r.status !== "done" && r.dueAt !== undefined && r.dueAt < now
  );
}

export const overdue = query({
  args: {},
  handler: async (ctx) => overdueHandler(ctx, Date.now() / 1000),
});
```
File is exactly 422 lines; this block is the entire remainder after `listByProfile` (ends line 389, blank line 390). Deleting leaves the file ending cleanly at `listByProfile`'s closing `});` (line 389) — no trailing blank-line cleanup needed beyond removing the block plus its leading blank line 390.

**Surviving sibling shape to match style-wise** (lines 373-389 — untouched, just context for "what correct code here looks like"):
```typescript
export async function listByProfileHandler(
  ctx: { db: RemindersDb } | any,
  profileId: string
) {
  return await ctx.db
    .query("reminders")
    .withIndex("by_profile", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("profileId", profileId)
    )
    .collect();
}

export const listByProfile = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) =>
    listByProfileHandler(ctx, profileId),
});
```

**No import changes needed** — `dueSoon`/`overdue` are defined (not imported) in this file; only `mutation, query` (line 20) and `v` (line 21) are imported and both stay in use by surviving code.

---

### `convex/schema.ts` (config/model, index drop)

**Analog:** the reminders table's own surviving indexes (same `defineTable` chain)

**Current state** (lines 1845-1874, the full `reminders` table definition — only the last `.index()` call changes):
```typescript
  reminders: defineTable({
    profileId: v.string(), // "personal" | "business" | "consulting"
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.float64()),
    priority: v.string(), // "low" | "med" | "high"
    status: v.string(), // "open" | "done" | "snoozed"
    recurrence: v.optional(
      v.object({
        freq: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly")
        ),
        interval: v.float64(),
        byday: v.optional(v.array(v.string())),
        until: v.optional(v.float64()),
      })
    ),
    tags: v.optional(v.array(v.string())),
    source: v.string(), // "dashboard" | "astridr" (D-09 — audit only, never a write gate)
    notifiedAt: v.optional(v.float64()), // set by the Ástríðr nudge cron to dedupe (D-04/D-11)
    snoozedUntil: v.optional(v.float64()),
    completedAt: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_profile", ["profileId", "status"])
    .index("by_status", ["status", "dueAt"])
    .index("by_dueAt", ["dueAt"]),
```

**Edit:** remove the `.index("by_dueAt", ["dueAt"]),` line (1874) and change the preceding `.index("by_status", ["status", "dueAt"])` line's trailing comma to end the chain with `);` — i.e. the table keeps exactly `by_profile` and `by_status`, matching the two indexes `listByProfile` (reminders.ts) and any live `by_status` consumer still use. Post-edit, run `npx convex codegen` (offline codegen regenerates `_generated/dataModel.d.ts`/`api.d.ts`); the actual index DROP deploys via `npx convex deploy --yes` per CLAUDE.md's stated deploy command — cheap, no data migration (schema-only, self-hosted backend rule in CLAUDE.md §Self-Hosted Convex applies to bulk *data* ops, not index drops).

---

### `convex/reminders.test.ts` (test, CRUD)

**Analog:** `markNotifiedHandler` describe block (line 516+) — shows correct shape with no dead imports

**Imports to edit** (lines 9-21 — remove `dueSoonHandler,`/`overdueHandler,`):
```typescript
import { describe, it, expect } from "vitest";
import {
  computeNextDueAt,
  createReminderHandler,
  updateReminderHandler,
  completeReminderHandler,
  snoozeReminderHandler,
  markNotifiedHandler,
  removeReminderHandler,
  listByProfileHandler,
  dueSoonHandler,      // DELETE this line (19)
  overdueHandler,      // DELETE this line (20)
} from "./reminders";
```

**Test bodies to DELETE** (lines 457-505 — both `it(...)` blocks, INSIDE the `describe("reminders CRUD handlers", ...)` block that opens at line 196 and closes at line 506; deleting these two blocks leaves the `describe`'s closing `});` at 506 intact, directly after the surviving `"remove deletes the row"` test which ends at line 455):
```typescript
  it("dueSoon excludes status done and rows outside the window", async () => {
    const db = makeFakeDb();
    const now = 1000;
    const openInWindow = await createReminderHandler(
      { db },
      { profileId: "personal", title: "In window", dueAt: 1200, source: "dashboard" },
      now
    );
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "Out of window", dueAt: 5000, source: "dashboard" },
      now
    );
    const doneInWindow = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Done", dueAt: 1200, source: "dashboard" },
      now
    );
    await db.patch(doneInWindow, { status: "done" });

    const rows = await dueSoonHandler({ db }, 500, now); // cutoff = 1500
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(openInWindow);
  });

  it("overdue excludes status done and never returns future rows", async () => {
    const db = makeFakeDb();
    const now = 2000;
    const overdueOpen = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Overdue", dueAt: 1000, source: "dashboard" },
      now
    );
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "Future", dueAt: 3000, source: "dashboard" },
      now
    );
    const overdueDone = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Overdue but done", dueAt: 1000, source: "dashboard" },
      now
    );
    await db.patch(overdueDone, { status: "done" });

    const rows = await overdueHandler({ db }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(overdueOpen);
  });
```
File is 555 lines total; `describe("markNotifiedHandler ...")` at line 516 and everything after is untouched.

---

### `astridr/automation/calendar_cache.py` (service, event-driven cron worker)

**Analog:** `refresh()`'s own `telemetry: Any` parameter (same file, lines 177-213) — already accepts any duck-typed object with `send_to`; no signature change required.

**Class to DELETE verbatim** (lines 138-174):
```python
class CodePulsePoster:
    """Duck-typed ``send_to`` that posts to the CodePulse CLOUD deployment.

    This cron previously received the shared ``ConvexHandler``, whose base URL
    is ``CONVEX_URL`` — the LOCAL self-hosted convex-backend. That backend has
    no ``/calendar-ingest`` route (verified: it 404s); the calendar cache lives
    on the CLOUD deployment the CodePulse dashboard reads. Passing the shared
    handler therefore pushed every profile's calendar into a database nothing
    reads. See astridr/tools/reminders.py for the full two-backend note.

    Deliberately matches ``ConvexHandler.send_to``'s signature so ``refresh()``
    stays duck-typed and its tests keep injecting a simple fake.
    """

    def __init__(self, base_url: str | None = None, ingest_key: str | None = None):
        self._base_url = base_url or _CODEPULSE_URL
        self._ingest_key = ingest_key or _INGEST_KEY

    async def send_to(self, endpoint: str, event_type: str, data: dict[str, Any]) -> None:
        if not self._base_url or not self._ingest_key:
            log.warning(
                "calendar_cache.post_skipped",
                reason="CODEPULSE_CONVEX_URL/CONVEX_URL or ASTRIDR_INGEST_API_KEY unset",
                endpoint=endpoint,
            )
            return
        client = get_pool().get(timeout=10.0)
        resp = await client.post(
            f"{self._base_url.rstrip('/')}/{endpoint.lstrip('/')}",
            json={"type": event_type, **data},
            headers={
                "Authorization": f"Bearer {self._ingest_key}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"{endpoint} returned {resp.status_code}: {resp.text[:200]}")
```

**Also review for deletion/edit as part of the D-04 sweep** — the module-level comment block directly above it (lines 46-52) states the current *correct* topology already and does NOT need rewriting:
```python
# CONVEX TARGET — see astridr/tools/reminders.py. Normally just CONVEX_URL: the
# LOCAL self-hosted backend is the single store for CodePulse and Ástríðr.
# Leave CODEPULSE_CONVEX_URL unset for the normal all-local setup.
_CP_URL = os.environ.get("CODEPULSE_CONVEX_URL", "")  # cg-ok: CG-INP-002 -- optional
_LOCAL_URL = os.environ.get("CONVEX_URL", "")  # cg-ok: CG-INP-002 -- optional
_CODEPULSE_URL = _CP_URL or _LOCAL_URL
```
This block is otherwise now dead too (only `CodePulsePoster.__init__` reads `_CODEPULSE_URL`/`_INGEST_KEY`) — once the class is deleted, `_CP_URL`/`_LOCAL_URL`/`_CODEPULSE_URL`/`_INGEST_KEY` (lines 46-52) become unused module-level constants. Planner should decide whether to delete them too (they'd otherwise be dead code left behind by this same cleanup) — flagging for plan-time judgment, not itself one of the three CONTEXT-listed edits, but falls out of D-03's "DELETE the class" if the constants have no other reader. Confirmed via grep: `_CODEPULSE_URL` and `_INGEST_KEY` in this file are referenced ONLY inside the class being deleted.

`refresh()` itself (lines 177+) needs **no change** — already takes `telemetry: Any` and calls `telemetry.send_to(...)` generically later in the function body (not shown above the read window, but referenced by its docstring "telemetry: A `ConvexHandler` (or compatible) exposing `async def send_to(...)`").

---

### `astridr/engine/bootstrap/cron_dispatcher.py` `_run_calendar_cache_refresh` (controller, event-driven)

**Analog:** `_run_reminder_nudge` (same file, lines 808-829) — the sibling cron method one line below, which already does exactly what this method should do: pass `self._telemetry` straight into the domain `run()`/`refresh()` call with no wrapper class.

**Current state to REPLACE** (lines 776-806):
```python
    async def _run_calendar_cache_refresh(self) -> None:
        """Refresh the read-only Google Calendar cache for all profiles (Phase 101, CAL-01).

        Read-only: only ever calls action="list_events" per profile's own Google
        account (D-02/D-03/D-06) via calendar_cache.refresh(); never create_event.
        Per-profile isolated inside refresh() -- one account's auth failure never
        blocks the others (RELI, T-101-10). Fail-closed here too: never raises
        into the cron loop, mirroring _run_graph_snapshot.
        """
        from astridr.automation.calendar_cache import (
            CodePulsePoster,
        )
        from astridr.automation.calendar_cache import (
            refresh as _refresh_calendar_cache,
        )

        try:
            # NOT self._telemetry: that ConvexHandler targets CONVEX_URL, the
            # LOCAL self-hosted backend, which has no /calendar-ingest route
            # (404). CodePulsePoster targets the CLOUD deployment the dashboard
            # actually reads. See astridr/tools/reminders.py for the full note.
            result = await _refresh_calendar_cache(
                registry=self._registry, telemetry=CodePulsePoster()
            )
            logger.info(
                "calendar_cache.cron_complete",
                pushed=result["pushed"],
                failed=result["failed"],
            )
        except Exception as exc:  # noqa: BLE001 -- defensive; refresh() is already per-profile isolated
            logger.warning("calendar_cache.cron_failed", error=type(exc).__name__)
```

**Target shape** — mirror `_run_reminder_nudge`'s single-import + direct-`self._telemetry`-passthrough pattern (lines 808-829, unchanged, shown for exact style to copy):
```python
    async def _run_reminder_nudge(self) -> None:
        """Scan due/overdue reminders and send proactive nudges (Phase 101, REM-05).

        D-11: nudge scheduling is Ástríðr-side -- ProactiveMessenger, the
        outbound gate, and channel targeting all live here; Convex only
        stores the reminders rows reminder_nudge.run() reads/writes over
        authed HTTP. Per-profile isolated inside run() -- one profile's read
        failure never blocks the others. Fail-closed here too: never raises
        into the cron loop, mirroring _run_calendar_cache_refresh.
        """
        from astridr.automation.reminder_nudge import run as _run_reminder_scan

        try:
            result = await _run_reminder_scan(proactive=self._proactive, config=self._config)
            logger.info(
                "reminder_nudge.cron_complete",
                nudged=result["nudged"],
                rolled=result["failed"],
            )
        except Exception as exc:  # noqa: BLE001 -- defensive; run() is already per-profile isolated
            logger.warning("reminder_nudge.cron_failed", error=type(exc).__name__)
```
(Note the `rolled=result["failed"]` above is a literal transcription artifact in this excerpt — copy the KEY STRUCTURE of the pattern, i.e. single `from ... import X as _y` line, `try/except Exception as exc: # noqa: BLE001` with a one-line `logger.warning(...)` — the actual `_run_reminder_nudge` body's field names are irrelevant to `_run_calendar_cache_refresh`, only its `self._telemetry`-passthrough shape matters.)

Other confirmed `telemetry=self._telemetry` passthrough call sites in this same file proving the pattern is universal in this dispatcher (not copied in full — locations only): lines 393, 588, 727, 906.

**Edit:** drop the `CodePulsePoster` import entirely; keep only `from astridr.automation.calendar_cache import refresh as _refresh_calendar_cache`; change the call to `result = await _refresh_calendar_cache(registry=self._registry, telemetry=self._telemetry)`; replace the stale 4-line inline comment (lines 793-796, the "NOT self._telemetry... 404... See astridr/tools/reminders.py for the full note" block) — delete it outright, since passing `self._telemetry` is now simply the same pattern every other cron uses and needs no special-case justification comment. Docstring's `mirroring _run_graph_snapshot` (line 783) can stay as-is (still true) or be updated to `mirroring _run_reminder_nudge` since that's the more direct sibling now — Claude's Discretion, not a correctness issue.

---

### `astridr/tools/reminders.py` (utility/config, module-level comment)

**Analog (cross-repo ground truth):** `convex/http.ts` (codepulse) lines 94-101 — proves `/calendar-ingest` is a route on the SAME local backend as `/reminders-ingest`/`/reminders-read`, served by one router:
```typescript
// Phase 101: Reminders & Calendar Command Center — Ástríðr sync surface
// (REM-02, CAL-01). All fail-closed via validateIngestAuth (D-07).
http.route({ path: "/reminders-ingest", method: "POST",    handler: remindersIngest });
http.route({ path: "/reminders-ingest", method: "OPTIONS", handler: remindersIngest });
http.route({ path: "/reminders-read",   method: "POST",    handler: remindersRead });
http.route({ path: "/reminders-read",   method: "OPTIONS", handler: remindersRead });
http.route({ path: "/calendar-ingest",  method: "POST",    handler: calendarIngest });
http.route({ path: "/calendar-ingest",  method: "OPTIONS", handler: calendarIngest });
```

**Current state to EDIT** (lines 42-52 — the "full two-backend note" cited by `calendar_cache.py:47` and, until deletion, `cron_dispatcher.py:796`):
```python
# CONVEX TARGET — normally just CONVEX_URL (http://convex-backend:3211), the
# LOCAL self-hosted backend that is the single store for both CodePulse and
# Ástríðr. See C:\Users\mandr\convex-selfhost\docker-compose.yml, whose header
# states it "replaces cloud deployment". CODEPULSE_CONVEX_URL is an escape
# hatch for the transitional case where CodePulse's Convex is somewhere other
# than the telemetry backend — leave it UNSET for the normal all-local setup.
#
# History (2026-07-20): for one day this had to point at the cloud deployment,
# because Phase 101 had been deployed only there while Ástríðr wrote to local
# — the two sides sat on different databases and the round trip 404'd. Both
# are on local now; the fallback is what makes that the correct default.
```
This note's *content* is already factually accurate (states "Both are on local now"), but it is written as an incident retrospective that two other files cite as license for "still might need the cloud escape hatch" reasoning — that's the actual defect D-04 targets, not a factual error in this file itself. Correction should state the current truth plainly and drop the "escape hatch for the transitional case" framing (there's no transitional case anymore — tidy-whale-981 is retired per CONTEXT D-03), e.g. collapse to something like: "CONVEX_URL is the LOCAL self-hosted backend — the single store for both CodePulse and Ástríðr (`/calendar-ingest`, `/reminders-ingest`, `/reminders-read` are all served by it, see `convex/http.ts`). `CODEPULSE_CONVEX_URL` is kept as an override for local dev only; leave unset in the normal setup." Remove the "History (2026-07-20)" paragraph and the "escape hatch for the transitional case" line — both are exactly the load-bearing false narrative the other two files cite.

---

### `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (discovered — not in original CONTEXT.md list, but a mandatory consequence of D-03)

**Why it's in scope:** this test imports `CodePulsePoster` and asserts `isinstance(kwargs["telemetry"], CodePulsePoster)` — it will hard-fail (`ImportError`) the moment `calendar_cache.py`'s class is deleted, before any behavioral assertion even runs. This satisfies D-06's "both repos' suites green" bar only if this test is updated in the same pass.

**Current state to EDIT** (lines 190-217):
```python
    @pytest.mark.asyncio
    async def test_calendar_cache_refresh_calls_module_refresh_with_deps(self) -> None:
        """_run_calendar_cache_refresh delegates to calendar_cache.refresh() and never raises."""
        job_manager = _make_job_manager_mock()
        registry = MagicMock()
        telemetry = MagicMock()
        dispatcher = _make_dispatcher(
            job_manager=job_manager, registry=registry, telemetry=telemetry
        )

        fake_refresh = AsyncMock(return_value={"pushed": ["personal"], "failed": []})
        with patch("astridr.automation.calendar_cache.refresh", new=fake_refresh):
            job = FakeCronJob(name="calendar:cache_refresh", task="Refresh Google Calendar cache")
            await dispatcher.dispatch(job)

        # The poster must NOT be the shared telemetry handler: that ConvexHandler
        # targets CONVEX_URL (the LOCAL self-hosted backend), which has no
        # /calendar-ingest route and 404s. Passing it silently pushed every
        # profile's calendar into a database the dashboard never reads.
        from astridr.automation.calendar_cache import CodePulsePoster

        kwargs = fake_refresh.await_args.kwargs
        assert kwargs["registry"] is registry
        assert isinstance(kwargs["telemetry"], CodePulsePoster)
        assert kwargs["telemetry"] is not telemetry
        # Fail-closed: even if refresh() raised, dispatch must not propagate — covered by
        # the inline jobs-row failed-status path already exercised in TestUniformJobsRow.
        assert job_manager.update_status.await_args_list[-1][0][1] == "completed"
```

**Analog for the corrected assertion shape:** the neighboring `test_reminder_nudge_writes_one_jobs_row` test (line 219+, same file) — the general pattern for asserting a cron passes `self._telemetry`/`self._registry` straight through to its domain function is already exercised elsewhere in this file for other crons; the fix here is to invert the assertion to `assert kwargs["telemetry"] is telemetry` (i.e. now IS the shared instance, no longer "is not"), delete the `CodePulsePoster` import and its docstring/inline-comment narrative, and rename the test to reflect that it now verifies passthrough rather than substitution (e.g. `test_calendar_cache_refresh_passes_shared_telemetry`).

## Shared Patterns

### "Pass `self._telemetry` straight through" — the dispatcher-wide cron convention
**Source:** `astridr/engine/bootstrap/cron_dispatcher.py` — `_run_reminder_nudge` (lines 808-829) plus call sites at lines 393, 588, 727, 906.
**Apply to:** `_run_calendar_cache_refresh`. Every other cron handler in this file passes `self._telemetry` (a `ConvexHandler`) directly to its domain function with zero wrapper/adapter class. `_run_calendar_cache_refresh` was the sole outlier; this phase brings it into line.

### Dead-code deletion leaves no orphaned imports/constants
**Source:** this phase's own `convex/reminders.test.ts` edit (imports lines 9-21) and `calendar_cache.py`'s now-possibly-dead `_CP_URL`/`_LOCAL_URL`/`_CODEPULSE_URL`/`_INGEST_KEY` constants (lines 46-52).
**Apply to:** every file in this phase — grep each edited file post-deletion for now-unused imports/constants before considering the file done (D-06's "zero remaining references" bar covers this).

### Stale-topology-comment correction
**Source:** ground truth is `convex/http.ts:94-101` (codepulse) — one local backend serves `/reminders-ingest`, `/reminders-read`, AND `/calendar-ingest`.
**Apply to:** `calendar_cache.py` (deleted alongside the class, so moot once L138-174 is gone — but the file's OWN surviving comment at lines 46-48 is already correct, no edit needed there beyond what falls out of the dead-constant cleanup), `cron_dispatcher.py` (delete the stale inline comment at lines 793-796), `tools/reminders.py` (rewrite lines 42-52 per above), and `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (delete the stale inline comment at lines 205-208).

## No Analog Found

None — every file in scope either has a direct sibling pattern in the same file/module (reminders.ts, cron_dispatcher.py) or is itself the exact code being deleted (no "new" code is being written in this phase beyond the mechanical `CodePulsePoster()` → `self._telemetry` substitution and comment rewrites).

## Metadata

**Analog search scope:** `convex/reminders.ts`, `convex/reminders.test.ts`, `convex/schema.ts`, `convex/http.ts` (codepulse); `astridr/automation/calendar_cache.py`, `astridr/engine/bootstrap/cron_dispatcher.py`, `astridr/tools/reminders.py`, `tests/unit/engine/bootstrap/test_cron_dispatcher.py`, `tests/tools/test_reminders.py` (astridr-repo); repo-wide grep sweep for `two-backend|tidy-whale|CLOUD deployment|local backend|LOCAL self-hosted|404s|cloud vs local` across astridr-repo (non-`.planning` source hits fully enumerated above; `.planning/` historical docs and `tidy-whale-981` used purely as a fake test URL in `test_reminders.py`/`test_langfuse_eval.py`/`test_web_cors.py` are NOT narrative claims and are out of scope).
**Files scanned:** 9 read directly + 1 repo-wide grep pass (~40 files matched, triaged to 0 additional in-scope sites beyond the one discovered test file).
**Pattern extraction date:** 2026-07-22
