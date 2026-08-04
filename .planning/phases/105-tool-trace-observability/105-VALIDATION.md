---
phase: 105
slug: tool-trace-observability
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-03
executed: 2026-08-04
---

# Phase 105 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `105-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom) + `@testing-library/react` 16.3.2; Playwright 1.61.1 for E2E |
| **Config file** | `vitest.config.ts` (repo root) — `include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs']`, `setupFiles: ['./src/test/setup.ts']` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` (plus `npx tsc --noEmit`) |
| **Estimated runtime** | ~60 seconds full suite |

**Convention constraint:** `convex-test` is NOT installed. Ingest-boundary logic is validated by
**pure-function extraction** (the established pattern — `resolveGatewayTaskCompleted`,
`processTaskQualityEvent`, `isUnresolvedRouting` are exported pure functions unit-tested directly,
with `runMutation`/`ctx.db` calls left thin). Any new parsing logic in the `tool_policy_event` case
MUST follow this convention or it cannot be automatically verified.

**Cross-repo:** astridr-repo (`C:\Users\mandr\astridr-repo`) uses pytest. The exact test path for
`loop.py`'s emit sites was NOT enumerated during research — Wave 0 must confirm it before any
astridr-side task is marked verifiable.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed test file>`
- **After every plan wave:** `npx vitest run` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green **AND** the D-07 live-induction step recorded below
- **Max feedback latency:** 60 seconds

**Project rule (CLAUDE.md / LESSONS):** a green suite is not proof of a live fix. The ingest path
(D-07) is proven only by inducing real events against the running stack and observing the row land —
not by a passing unit test on the parser.

---

## Per-Task Verification Map

> Task IDs are assigned by `gsd-planner`. This table is seeded per-requirement; the executor fills
> `Task ID` / `Plan` / `Wave` / `Status` columns as plans are written and executed.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T3 | 105-03 | 2 | OBS-01 | — | `tool_executed` case writes a `toolExecutions` row tagged `provider: "astridr"` alongside the existing `callGraphEdges` upsert | unit (pure-fn extraction) | `npx vitest run convex/runtimeIngest.test.ts` | ✅ | ✅ green (live: real `provider:"astridr"` rows confirmed, §Task 3) |
| T2 | 105-04 | 3 | OBS-01 | — | Hourly aggregate buckets for tool call/failure/duration, keyed by tool + provider; reads are bounded (`.take(CAP)`), never unfiltered `.collect()` | unit | `npx vitest run convex/aggregates.test.ts` | ✅ | ✅ green (live: `computeHourly` real buckets confirmed non-zero, F6 timing noted) |
| T1 | 105-06 | 4 | OBS-01 | — | Tools page usage panel renders per-tool frequency + success/fail from live query; query failure is contained by `SectionErrorBoundary` (a throwing Convex query unmounts the tree) | component | `npx vitest run src/pages/Tools.test.tsx` | ✅ | ✅ green (live: `/tools` renders real data, source filter switches ranking) |
| T1 | 105-03 | 2 | OBS-02 | T-105-01 | `tool_policy_event` case parses all 4 kinds and inserts into `toolPolicyEvents`; unknown kind is rejected, not silently dropped | unit | `npx vitest run convex/toolPolicyEvents.test.ts` | ✅ | ✅ green (live: all 4 kinds landed as real rows, §Task 2) |
| T1 | 105-04 | 3 | OBS-02 | T-105-01 | Alert fires ONLY for `malformed_policy_boot` / `malformed_policy_reload_rejected`; the other two kinds never alert (isolation control, mirroring `costBudgetEval.test.ts`) | unit | `npx vitest run convex/toolPolicyAlertEval.test.ts` | ✅ | ✅ green (live: exactly 2 alerts, correct severities, §Task 2 step 5) |
| T2 | 105-05 | 3 | OBS-03 | — | `TraceWaterfall` nests tool rows under the correct LLM-call parent when `round` is present | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ✅ green (live: Round 1/2 nesting confirmed on a real 2-round session) |
| T1 | 105-05 | 3 | OBS-03 | — | `groupCacheRatio` denominator matches `shapeCacheAcc` exactly (D-11 "one formula" regression) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ✅ green (live: hand-computed 49.17%→49% matches display exactly) |
| T1 | 105-01 | 1 | OBS-03 | — | Both feeder queries are capped AND the UI states truncation when the cap is hit | unit + component | `npx vitest run convex/llm.test.ts` / `src/components/TraceWaterfall.test.tsx` | ✅ | ⚠ PARTIAL — unit green; live cap-hit not organically exercised (D-12, see below) |
| T2/T3 | 105-01 | 1 | OBS-01 (D-15 corrected) | — | `ToolExecutionPanel` + `PermissionDecisionsChart` still show Claude-Code-only rankings after Ástríðr rows exist in `toolExecutions` — control: seed both providers, assert the panels' output is byte-identical to the single-provider baseline | unit | `npx vitest run convex/toolExecutions.test.ts` | ✅ | ⚠ PARTIAL — unit green; live regression FOUND and FIXED going forward, 2-week historical backlog remains (see D-15 deviation above) |
| T1 | 105-01 | 1 | OBS-01 (D-12 extended) | — | `successRate` and `avgDuration` are capped and report truncation, matching `fetchLlmRowsForWindow`'s `{rows, truncated}` shape | unit | `npx vitest run convex/toolExecutions.test.ts` | ✅ | ✅ green (live: `truncated: true` fired for REAL on the 4000-row/24h window during this session's own heavy tool usage — genuine, non-synthetic cap hit) |
| T1-T3 | 105-02 | 1 | OBS-01/02/03 (cross-repo) | — | astridr payload widening (D-03 / D-08 / D-10) emits the added fields | unit (pytest) | astridr-repo `tests/unit/agent/test_loop_tool_executed_emit.py`, `tests/unit/agent/test_loop.py`, `tests/unit/test_round_context.py`, `tests/unit/providers/test_ollama.py` | ✅ | ✅ green (296+709+11 passed per 105-02-SUMMARY.md; live-confirmed via container grep, §Task 1) |

*Status: ✅ green · ⚠ PARTIAL (reason inline) · ❌ red*

---

## Wave 0 Requirements

> **Corrected 2026-08-03 at plan-phase.** RESEARCH.md listed `convex/runtimeIngest.test.ts` as
> missing and `convex/llm.test.ts` as unconfirmed. Both **exist** (verified on disk). Extend them;
> do not create parallel files.

- [x] ~~`convex/runtimeIngest.test.ts` — does not exist~~ → **exists.** Extended with cases for `tool_executed`, `tool_policy_event`, and (105-09 deviation) `command_execution`'s `resolveCommandExecutionToolRow`.
- [x] ~~Confirm whether `convex/llm.test.ts` exists~~ → **exists.** Extended for the D-12 `sessionCalls` cap.
- [x] `convex/toolPolicyEvents.test.ts` — created, covers all 4 kinds + unknown-kind rejection.
- [x] `convex/toolPolicyAlertEval.test.ts` — created, covers the D-06 isolation control.
- [x] `src/pages/Tools.test.tsx` — created, component scaffold in place.
- [x] `convex/toolExecutions.test.ts` — confirmed existing, extended for D-15 provider-filter and D-12-extended caps.
- [x] **Confirmed** astridr-repo's pytest paths (105-02-SUMMARY.md): `tests/unit/agent/test_loop_tool_executed_emit.py`, `tests/unit/agent/test_loop.py`, `tests/unit/test_round_context.py`, `tests/unit/providers/test_ollama.py`.
- [x] Extended `convex/aggregates.test.ts` (was 34 tests) rather than creating a parallel file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Outcome |
|----------|-------------|------------|---------|
| **D-07 live induction** — the astridr → CodePulse ingest path actually carries `tool_policy_event` and the widened `tool_executed` payload end-to-end | OBS-01, OBS-02 | No `convex-test`; the `runMutation`/`ctx.db` seam is deliberately un-unit-tested. A passing parser test proves parsing, not delivery. | ✅ **PASS.** All 4 `tool_policy_event` kinds landed as real rows (2 real induction, 2 sanctioned synthetic per F5, see Task 2). D-06 isolation control passes exactly 2 alerts. Real `tool_executed` rows confirmed with populated `durationMs`/`traceId`/`round` (Task 3). |
| **Trace waterfall visual depth** — nested spans, per-tool timings, cache badges render legibly at real trace sizes | OBS-03 | Rendering legibility at real data volume is not assertable from jsdom; the existing tests cover the pure grouping functions only. | ✅ **PASS** for nesting/cache ratio (Round 1/2 structure confirmed on a real 2-round session; 49% cache ratio hand-verified against raw `llm:sessionCalls` rows to within display rounding). ⚠ **PARTIAL** for D-12 truncation and unattributed-rows rendering — see below, both genuinely not exercisable live today, not skipped. |
| **D-12 TraceWaterfall per-session truncation** — the banner appears and names which side truncated, on data that actually trips `SESSION_TOOLS_READ_CAP`/`SESSION_CALLS_READ_CAP` (both 1000) | OBS-03 | Per-session caps require 1000+ tool calls or LLM calls inside ONE Ástríðr session — implausible to generate organically without excessive synthetic automation, which the plan explicitly disallows passing as a live pass. | ⚠ **PARTIAL, honestly.** No live session came remotely close to 1000 calls. Not forced synthetically. (Note: the SEPARATE `successRate`/`avgDuration` 4000-row/24h window cap — the "OBS-01 (D-12 extended)" row above — DID trip for real, unplanned, during this session's own heavy tool usage, which is real evidence the truncation mechanism works; the per-session TraceWaterfall cap specifically remains unexercised.) |
| **Unattributed tool rows render under "Untraced tool calls" / not silently attached** | OBS-03 | Legacy rows with no `traceId`/`round` must not be guessed into a parent round. | ⚠ **PARTIAL, honestly.** Investigated thoroughly (§Task 3): every session with real LLM calls post-105-02/03 deploy is fully attributed (has `traceId`); the historical untagged rows (the D-15 backlog) all sit under placeholder sessionIds (`"unknown"`/`"astridr"`) with ZERO `llm` rows, so `TraceWaterfall` takes the "No LLM calls yet" empty-state path before ever reaching the untraced-render branch. The code path itself is unit-tested (`TraceWaterfall.test.tsx`); a live example genuinely does not exist in the current data. |

---

## Live Baseline

> Plan 105-09, Task 1. Executed 2026-08-04. All raw command output below, no derived counts.

### (a) Convex deployment target — proven before any write

`npx convex function-spec` resolved deployment:
```
"url": "https://lmofficenew.tail5bb6b3.ts.net",
```
`docker ps --filter name=convex-backend`:
```
NAMES            PORTS                                                             STATUS
convex-backend   0.0.0.0:3210-3211->3210-3211/tcp, [::]:3210-3211->3210-3211/tcp   Up 4 days (healthy)
```
The tailnet URL is the self-hosted backend's published address (per CLAUDE.md / `convex-topology-all-local` memory), NOT the retired cloud deployment (`tidy-whale-981`). Confirmed self-hosted target before proceeding.

### (b) Schema push

`docker stats convex-backend --no-stream` (before deploy): `39.82GiB / 64GiB` (62.22%)

`npx convex deploy --yes` (raw output):
```
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Deployed Convex functions to http://127.0.0.1:3210
```
`docker stats convex-backend --no-stream` (after deploy): `39.7GiB / 64GiB` (62.03%) — no memory jump from the push.

### (c) astridr container proven on plan 105-02's commit (finding F2)

`docker ps --filter name=astridr` at start of task: `astridr-agent` showed `Up 15 hours` — pre-dated the rebuild, so grepped BEFORE trusting it:
```
docker exec astridr-agent grep -c "set_round_context" astridr/agent/loop.py  →  0
docker exec astridr-agent grep -c "tool_was_offered" astridr/agent/loop.py   →  1
```
Stale — `set_round_context` absent entirely. Confirmed the checkout itself has the commits (`06f01d1a`, `5f90612f`, `c39bb6cc` all ancestors of `feature/brain-swap` HEAD `e11b0eff`), then rebuilt:
```
docker compose --profile prod up -d --build astridr
```
Build completed, `astridr-agent` recreated, reached `health: healthy` after ~35s. Re-grepped inside the freshly-built container:
```
docker exec astridr-agent grep -c "set_round_context" astridr/agent/loop.py  →  5
docker exec astridr-agent grep -c "tool_was_offered" astridr/agent/loop.py   →  2
```
Both non-zero (the `tool_was_offered` count of 2 matches 105-02-SUMMARY.md's own grep acceptance criterion exactly: "logger call + telemetry payload"). Container proven live on 105-02's code, by content, not timestamp.

### (d) Pre-induction baseline

`npx convex run toolPolicyEvents:lastReceivedAt '{}'`:
```json
{ "timestamp": null }
```

`npx convex run toolPolicyEvents:countsByKind '{}'`:
```json
{
  "counts": {
    "execution_denied": 0,
    "malformed_policy_boot": 0,
    "malformed_policy_reload_rejected": 0,
    "tool_call_leaked_as_text": 0
  },
  "truncated": false,
  "windowSeconds": 604800
}
```
`toolPolicyEvents` confirmed genuinely empty (`lastReceivedAt: null`, not `0`) — matches D-07's premise that this table has never held a row.

`npx convex run toolExecutions:recentExecutions '{"limit": 500}'`, filtered to `provider === "astridr"`: **0 rows** (500 total scanned, 0 astridr).

`npx convex run toolExecutions:successRate '{"excludeProvider": "astridr"}'` (D-15 baseline — will be re-run byte-for-byte in Task 3):
```json
{
  "cap": 4000,
  "truncated": false,
  "tools": [
    {"toolName":"Bash","success":1893,"failure":26,"total":1919,"rate":0.986451276706618},
    {"toolName":"Write","success":154,"failure":0,"total":154,"rate":1},
    {"toolName":"Edit","success":510,"failure":1,"total":511,"rate":0.9980430528375733},
    {"toolName":"AskUserQuestion","success":24,"failure":0,"total":24,"rate":1},
    {"toolName":"Skill","success":6,"failure":0,"total":6,"rate":1},
    {"toolName":"Read","success":892,"failure":6,"total":898,"rate":0.9933184855233853},
    {"toolName":"Agent","success":28,"failure":0,"total":28,"rate":1},
    {"toolName":"Grep","success":225,"failure":0,"total":225,"rate":1},
    {"toolName":"SendMessage","success":5,"failure":0,"total":5,"rate":1},
    {"toolName":"PowerShell","success":23,"failure":7,"total":30,"rate":0.7666666666666667},
    {"toolName":"TaskCreate","success":8,"failure":0,"total":8,"rate":1},
    {"toolName":"TaskUpdate","success":7,"failure":0,"total":7,"rate":1},
    {"toolName":"TaskGet","success":1,"failure":0,"total":1,"rate":1},
    {"toolName":"TaskList","success":1,"failure":0,"total":1,"rate":1},
    {"toolName":"conversation_recall","success":2,"failure":0,"total":2,"rate":1},
    {"toolName":"memory_search","success":3,"failure":0,"total":3,"rate":1},
    {"toolName":"obsidian","success":7,"failure":0,"total":7,"rate":1},
    {"toolName":"Glob","success":30,"failure":0,"total":30,"rate":1},
    {"toolName":"gateway:claude-cli","success":0,"failure":7,"total":7,"rate":0},
    {"toolName":"gateway:codex","success":10,"failure":0,"total":10,"rate":1},
    {"toolName":"gateway:antigravity","success":7,"failure":0,"total":7,"rate":1},
    {"toolName":"gateway:claude-sdk","success":0,"failure":4,"total":4,"rate":0},
    {"toolName":"ToolSearch","success":3,"failure":0,"total":3,"rate":1},
    {"toolName":"mcp__claude-in-chrome__tabs_context_mcp","success":2,"failure":0,"total":2,"rate":1},
    {"toolName":"mcp__claude-in-chrome__navigate","success":2,"failure":0,"total":2,"rate":1},
    {"toolName":"mcp__claude-in-chrome__computer","success":2,"failure":0,"total":2,"rate":1},
    {"toolName":"weather","success":2,"failure":0,"total":2,"rate":1},
    {"toolName":"google_personal","success":4,"failure":0,"total":4,"rate":1}
  ]
}
```
Zero `astridr`-provider tools present, as expected pre-induction.

### tsc/vitest gate (Task 1's automated verify)
`npx tsc --noEmit`: clean, zero errors.
`npx vitest run`: `273 passed | 17 skipped (290 files)`, `3393 passed | 193 todo (3586 tests)`, zero failures.

---

## Task 2 — D-07 Live Induction: All Four Policy Kinds + Alert Isolation

> Plan 105-09, Task 2. Executed 2026-08-04 against the running self-hosted stack.

### Induction 1 — `malformed_policy_reload_rejected` (REAL induction)

Edited `astridr-repo/config/tool-access-policy.yaml`, changed `tool_clusters:` from a mapping to
the scalar `"deliberately-malformed-for-105-09-induction"`. Saved; config watcher picked it up
live (no restart) within ~11s. Container log:
```
warning  config.tool_policy_malformed   error='tool_clusters must be a mapping, got str'
error    config_watcher.tool_policy_malformed_rejected error='tool_clusters must be a mapping, got str' field=tool_clusters path=config/tool-access-policy.yaml
```
Restored the file immediately; confirmed byte-identical to backup and `config_watcher.tool_filter_reloaded` fired on the good config within ~7s. Raw `toolPolicyEvents` row:
```json
{"event":"malformed_policy_reload_rejected","field":"tool_clusters","error":"tool_clusters must be a mapping, got str","sessionId":"system:bootstrap","timestamp":1785850154.630218}
```

### Induction 2 — `malformed_policy_boot` (REAL induction)

Reintroduced the same corruption, then `docker restart astridr-agent`. Because the config watcher
was still live at the moment of the file save (before the restart landed), it ALSO produced a
second `malformed_policy_reload_rejected` row (an incidental, real extra induction, not an error).
On boot, the malformed policy degraded to blank-slate-permissive per the documented D-03 behavior
— confirmed from the container's own boot log, not inferred:
```
warning  config.tool_policy_malformed    error='tool_clusters must be a mapping, got str'
warning  bootstrap.tool_policy_malformed error='tool_clusters must be a mapping, got str' field=tool_clusters
...
info     astridr.ready  boot_seconds=38.6 channels=6 providers=7 tools=185
```
Boot did not crash (D-03's "must never fail-closed on a policy typo" confirmed). Raw `toolPolicyEvents` row:
```json
{"event":"malformed_policy_boot","field":"tool_clusters","error":"tool_clusters must be a mapping, got str","sessionId":"system:bootstrap","timestamp":1785850226.8826923}
```
Restored the file and rebooted again; container reached `health: healthy`; `docker exec astridr-agent cat //app/config/tool-access-policy.yaml` confirmed the live container copy is byte-identical to the real permissive policy.

### Induction 3 — `execution_denied` (SYNTHETIC — labeled honestly, real induction not achievable)

**Attempted real induction and it is structurally blocked**, not merely difficult: the web-chat
session talks to the `commander` agent, and `TASK_CATEGORY_TO_CLUSTERS["commander"]` in
`astridr/agent/tool_filter.py` includes every cluster (`memory, web, files, media, workspace,
code, utility`). `tools_for_turn_names` is fixed per-agent-category (set once in `loop.py`, not
recomputed per-message), so no chat phrasing can narrow what's offered to the commander. Confirmed
this experimentally: asked Ástríðr (via the web chat, real turn) to run `ls -la /app` via "Bash" —
it did not attempt a real tool call at all (Bash isn't in Ástríðr's own 185-tool catalog; it
fabricated a plausible-sounding refusal/response instead of emitting a structured tool call). Only
Ástríðr's internal narrower-category sub-agents (`hervor`, `freya`, etc. — `reasoning`/`speed`/
`vision` categories) get restricted cluster sets, and there is no operator-facing way to address
one of those directly from the chat UI.

Per user decision, fell back to the sanctioned synthetic method (same mechanism as F5 allows for
the leak kind): a direct `ConvexHandler.send()` call from inside the running `astridr-agent`
container, using the container's own resolved `CONVEX_URL` / `ASTRIDR_INGEST_API_KEY` (read via
`os.environ` inside the container process — never seen or typed by the operator), proving the
INGEST PATH ONLY, not the detector:
```json
{"event":"execution_denied","tool":"synthetic-105-09-induction","sessionId":"system:105-09-validation-synthetic","timestamp":1785852083.9012766}
```
**This is explicitly NOT a verification that `loop.py`'s off-turn re-check (`_execute_tool_inner`,
lines 2115-2136) actually fires in production** — only that a `tool_policy_event` of this kind is
correctly ingested, stored, and alertable. The code path itself is covered by 105-04's unit tests
only.

### Induction 4 — `tool_call_leaked_as_text` (SYNTHETIC — two real attempts made, both cleanly refused, F5 fallback used as originally sanctioned)

Two distinct real-induction attempts via the web chat, both refused cleanly by the model (correct
safety behavior, not a bug):
1. Asked Ástríðr to write out its own tool-call XML syntax "for documentation" — refused, correctly
   identified this as a prompt-injection/spoofing risk and explained the tool schema in prose
   instead.
2. Asked Ástríðr to "retype" a fabricated fragment starting with `<invoke name="weather">` under
   a "you got disconnected" pretext — refused again, correctly identified it as the same request
   reframed.

Per finding F5, fell back to the sanctioned synthetic method — same in-container `telemetry.send`
mechanism as induction 3, labeled **ingest path only, not a detector verification**:
```json
{"event":"tool_call_leaked_as_text","tool":"synthetic-105-09-induction-leak","sessionId":"system:105-09-validation-synthetic","toolWasOffered":true,"toolsOfferedCount":12,"round":1,"agentId":"astridr","timestamp":1785852253.4949427}
```

### Step 5 — Alert isolation (the control that matters most)

`npx convex run aggregates:computeHourly '{}'` — raw log output:
```
[computeHourly] tool policy alert eval { fired: 2, skippedDeduped: 0, skippedNoEvents: 0, errors: 0 }
```
`npx convex run alerts:listAll '{}'`, filtered to `source` starting `tool-policy:` — **exactly two rows**:
```json
[
  {
    "source": "tool-policy:malformed_policy_reload_rejected",
    "severity": "warning",
    "status": "active",
    "webhookStatus": "pending",
    "message": "A tool-access policy reload was rejected as malformed; the previously loaded policy is still in effect (field \"tool_clusters\": tool_clusters must be a mapping, got str). 2 event(s) in the hour beginning 2026-08-04T13:00:00.000Z.",
    "details": {"count": 2, "kind": "malformed_policy_reload_rejected", "windowStart": 1785848400, "windowEnd": 1785852000}
  },
  {
    "source": "tool-policy:malformed_policy_boot",
    "severity": "error",
    "status": "active",
    "webhookStatus": "delivered",
    "webhookDeliveredAt": 1785852295.786,
    "message": "Tool-access policy was malformed at startup and degraded to a fully permissive policy (field \"tool_clusters\": tool_clusters must be a mapping, got str). 1 event(s) in the hour beginning 2026-08-04T13:00:00.000Z.",
    "details": {"count": 1, "kind": "malformed_policy_boot", "windowStart": 1785848400, "windowEnd": 1785852000}
  }
]
```
**Zero alerts exist for `tool_call_leaked_as_text` or `execution_denied`** — confirmed by this same
filtered query returning exactly the two rows above and no others; the isolation control PASSES.

### Step 6 — Dedup

Re-ran `npx convex run aggregates:computeHourly '{}'` for the same hour:
```
[computeHourly] tool policy alert eval { fired: 0, skippedDeduped: 2, skippedNoEvents: 0, errors: 0 }
```
`alerts:listAll` filtered to `tool-policy:*` re-queried: still exactly 2 rows. Dedup confirmed.

### Step 7 — Alert copy

Both messages (quoted in full above) name the offending `field` and a truncated `error`. Scanned
for enforcement wording (`disable`, `block`, `revoke`, `enforce`, `prevent`, `stop`) — **zero
matches in either message**. This phase observes and never enforces, as designed.

### Step 8 — Delivery

Both alerts routed through the real `webhookDelivery` layer (not a bare table insert):
`malformed_policy_boot` (severity `error`) → `webhookStatus: "delivered"`, `webhookDeliveredAt` set.
`malformed_policy_reload_rejected` (severity `warning`) → `webhookStatus: "pending"`. **This is
correct, not stuck** — `npx convex run webhookDelivery:getNotificationPreferences '{}'` returns
`{"critical":"always","error":"always","info":"dashboard_only","warning":"digest"}`; `webhookDelivery.ts`
line 438-441 returns early (no delivery attempt, `webhookStatus` stays `pending`) whenever the
configured mode for that severity is `digest` — `warning` alerts wait for the next digest batch by
design. Investigated to root cause per CLAUDE.md Error Triage rather than assumed broken.

### Step 9 — Restore (mandatory, blocks checkpoint approval)

- Host file: `diff astridr-repo/config/tool-access-policy.yaml <backup>` → byte-identical.
- Container file: `docker exec astridr-agent cat //app/config/tool-access-policy.yaml` → byte-identical to the real permissive policy (verified via Git-Bash `//`-escaped path per the leading-slash argv-rewrite trap).
- Container health: `docker inspect --format='{{.State.Health.Status}}' astridr-agent` → `healthy`.
- Confirmed via log: `config_watcher.tool_filter_reloaded path=config/tool-access-policy.yaml` fired after the final restore+reboot — astridr is running the real policy, not the degraded permissive one.

**Task 2 summary: all four kinds proven live (2 real, 2 synthetic-and-labeled per F5's sanctioned
fallback, extended by user decision to `execution_denied` after confirming that kind is
structurally unreachable from the commander chat session); D-06 isolation control passes with
exactly two alerts and correct severities; dedup confirmed; delivery investigated and explained,
not assumed; policy file and container confirmed restored to the real policy.**

### Deviation — fixed a real pre-existing UI bug found live (out of plan's declared file scope)

While reviewing the two live alerts with the operator, found `WebhookStatusBadge.tsx` (built Phase
06-05, before "digest" delivery-mode preferences existed) rendered the `warning`-severity
`malformed_policy_reload_rejected` alert as **"Retrying (0/3)"** — implying an active, failing
delivery retry loop. Root cause: `convex/schema.ts`'s `webhookStatus` only had 3 values
(`pending`/`delivered`/`failed`); `webhookDelivery.ts`'s digest/dashboard_only/disabled/muted
early-returns left the row on `pending` forever with zero attempts, and the badge treated any
`pending` as "actively retrying." Per CLAUDE.md's Error Triage rule (fix, don't dismiss as
pre-existing, when discovered live during a phase), fixed rather than deferred:

- `convex/webhookDelivery.ts` — the mute early-return and the `dashboard_only`/`disabled` early-return
  now write `webhookStatus: "skipped"`; the `digest` early-return now writes `webhookStatus: "digest"`
  (distinct from `"skipped"` because a digest-mode alert genuinely WILL be delivered later, unlike the
  other three).
- `convex/schema.ts` — comment updated to `"pending" | "delivered" | "failed" | "digest" | "skipped"`
  (no structural schema change; the field was already `v.optional(v.string())`).
- `src/components/WebhookStatusBadge.tsx` — two new terminal-status branches with non-alarming,
  accurate copy ("Queued for digest" / "Not sent (muted or dashboard-only)"), never "Retrying".
- `src/components/WebhookStatusBadge.test.tsx` — 2 new tests asserting the digest/skipped labels
  render and that neither ever renders "Retrying".

Verified: `npx tsc --noEmit` clean, full suite `npx vitest run` → 273 files / 3395 tests passed (up
from 3393 pre-fix), `npx convex deploy --yes` → `No indexes are deleted by this push`. Re-triggered
`webhookDelivery:sendAlertWebhook` for the live `malformed_policy_reload_rejected` alert
(`jn74bks1r903y7dtw16zkw5q018bt2qw`) to prove the fix against the actual row that exposed the bug:
`webhookStatus` flipped from `pending` to `digest` live, confirmed by re-querying `alerts:listAll`.

Out of plan 105-09's declared `files_modified` (which only lists `105-VALIDATION.md` and
`REQUIREMENTS.md`) — recorded here as an in-session deviation per GSD convention, not silently
folded in.

---

## Task 3 — Live UI Pass: D-15 Regression (Found a Real, Long-Standing Regression, Fixed Going Forward)

> Plan 105-09, Task 3 §2 (D-15 regression control). Executed 2026-08-04.

### The defect

Re-ran the exact `toolExecutions:successRate` query with `excludeProvider: "astridr"` from Task 1's
baseline and diffed. It was NOT byte-identical: `weather` went from `{success: 2, total: 2}` to
`{success: 3, total: 3}` after one real Ástríðr weather induction — a genuine D-15 leak, live.

Root cause: `astridr/engine/execution_tracker.py` wraps **every** tool call `loop.py` makes
(`origin="user_request"` included — confirmed by reading the call site at `loop.py:2265`, not
automation-only) and independently emits a `command_execution` telemetry event, distinct from
Phase 105's `tool_executed` event for the SAME call. `runtimeIngest.ts`'s `command_execution` case
(pre-dates Phase 105) inserts its own `toolExecutions` row using `sessionId: profileId ?? "unknown"`
and set **no `provider` field at all**. D-15's `excludeProvider: "astridr"` filter
(`convex/toolExecutions.ts`'s `excludeByProvider`) only matches rows with `provider === "astridr"`
set — so this second, untagged row for every Ástríðr tool call sailed straight through into
`ToolExecutionPanel` and `PermissionDecisionsChart`.

**This is not new.** Querying `toolExecutions:listBySession` for the literal fallback sessionIds
`"astridr"` and `"unknown"` surfaced untagged rows dating back to **2026-07-22** (`timestamp
1784630733`), spanning nearly the whole Ástríðr tool catalog (`weather`, `web_search`,
`generate_image`, `home_assistant`, `obsidian`, `see_screen`, `reminders`, `google_personal`,
`delegate_task`, and more) — this ingest-path gap predates Phase 105 entirely and has been silently
polluting both legacy panels for at least two weeks.

### The fix

- `convex/runtimeIngest.ts` — extracted a new pure function `resolveCommandExecutionToolRow(d,
  execStatus, timestamp)` (mirroring the existing `resolveToolExecutionRow` pattern exactly) that
  unconditionally tags `provider: ASTRIDR_TOOL_PROVIDER`, since `command_execution` is sent
  exclusively by `execution_tracker.py` (confirmed: `grep -rln '"command_execution"'` across
  astridr-repo returns only that one sender). The `command_execution` case now calls it instead of
  an inline untagged object literal.
- `convex/runtimeIngest.test.ts` — 6 new tests (`resolveCommandExecutionToolRow` behavior +
  a static source-check regression guard mirroring the existing `tool_executed` one).
- Verified: `npx tsc --noEmit` clean; full suite `npx vitest run` → 273 files / 3401 tests (up from
  3395 after the Task-2 alert-badge fix); `npx convex deploy --yes` → `No indexes are deleted by this
  push`.
- **Live-verified the fix, not just the unit tests**: drove a second real Ástríðr turn ("What's the
  weather in Portland right now?") after deploying. The new `command_execution`-sourced row now
  carries `provider: "astridr"` (raw row: `{"sessionId":"astridr","toolName":"weather","provider":
  "astridr","success":true,...}`, no `traceId`/`round` since it's the `command_execution` path, not
  `tool_executed` — expected and correct, they're different events for the same call).

### What the fix does NOT do — historical backlog is explicitly out of scope today

The fix stops **new** Ástríðr tool calls from leaking, verified above. It does **not** retroactively
correct the pre-existing untagged rows found dating back to 2026-07-22. Per CLAUDE.md's Self-Hosted
Convex operational rules ("Never bulk-delete or bulk-patch a large table on the live instance"),
retagging dozens of historical rows spanning two weeks is exactly the kind of bulk write this project
forbids improvising inline on the live single-node backend. Per explicit user decision, this is
recorded honestly rather than attempted: **the live dashboard will keep showing this historical
contamination in `ToolExecutionPanel`/`PermissionDecisionsChart` until those rows age out of the
500/4000-row read windows naturally, or until a dedicated, deliberately batch-capped cleanup phase
addresses the backlog.** Flagged here as a follow-up candidate for a future phase, not fixed today.

### D-15 verdict

**PARTIAL, not a clean PASS.** The regression that let Ástríðr tools leak into the Claude-Code-only
panels is fixed for all NEW tool calls, live-verified. The pre-existing historical leak (2+ weeks of
untagged rows, discovered as a byproduct of this investigation, entirely predating Phase 105) is
explicitly NOT remediated today and is called out here rather than silently left contaminating the
"before/after byte-identical" claim the plan's acceptance criteria originally asked for — that claim
cannot honestly be made while the historical rows remain. Both legacy panels will show a mix of
genuine Claude-Code activity and residual pre-existing Ástríðr rows (NOT new ones) until the backlog
is separately cleaned up.

### Theme sweep (finding F3 — four reachable themes, not six)

Cycled `cyan` (default), `emerald`, `readable`, `aubergine` via the header theme switcher on both
`/tools` and a real session's Trace tab. Confirmed live: the switcher itself exposes exactly these
four options (screenshot-verified dropdown), matching F3 exactly. All four legible on both pages —
badges, the per-tool chart, and policy-feed chips all recolor correctly, with the STATUS colors
(error/warn/info on policy chips) correctly LOCKED across themes (unaffected by accent switching, as
designed) and the chart's own `--chart-*` categorical token correctly independent of the primary
accent (not a bug — separate token family per this project's charting convention). `amber` and the
light `:root` are unreachable because `index.html`'s pre-paint script and `ThemeSwitcher` both
hard-whitelist only the four shown; this is pre-existing since Phase 89, not a Phase 105 defect.
Reset to Electric Cyan (default) after the sweep.

### Console

Kept the browser console open throughout Task 3 (Tools page, Session Detail Overview/Trace tabs, 4
theme switches, source-filter toggles). Only message observed: a Clerk "development keys" warning —
pre-existing, expected in local dev, unrelated to Phase 105. Zero errors, zero Phase-105-relevant
warnings.

---

## Requirement Markers (`.planning/REQUIREMENTS.md`)

- **OBS-02** — ✓ **SATISFIED.** All 4 `tool_policy_event` kinds proven live, D-06 isolation control
  passes exactly 2 alerts with correct severities, dedup confirmed, zero enforcement wording,
  delivery mechanism investigated to root cause and correct. Policy feed UI matches spec exactly:
  correct locked colors, exactly 2 Bell markers, sensible relative time, expand-row renders real
  values.
- **OBS-01** — ⚠ **PARTIAL.** The core mechanism (per-tool frequency/success-fail over time, source
  filter, hourly buckets with real data) is fully live-verified and correct. NOT satisfied: the
  D-15 correction embedded in this requirement's own scope found and fixed a real regression
  (Ástríðr tools leaking into Claude-Code-only panels) that is fixed going-forward only — a
  pre-existing ~2-week historical backlog of untagged rows remains in `toolExecutions` and will keep
  appearing in `ToolExecutionPanel`/`PermissionDecisionsChart` until a dedicated, batch-capped
  cleanup phase addresses it (explicitly out of scope for today per CLAUDE.md's self-hosted Convex
  bulk-write prohibition).
- **OBS-03** — ⚠ **PARTIAL.** Trace nesting, per-tool timing bars, and the per-turn cache ratio are
  all live-verified and correct (hand cross-checked 49.17%→49% against raw row data). NOT satisfied:
  the per-session truncation banner (D-12) could not be organically exercised (no live session
  remotely approached the 1000-call cap) and the "unattributed tool rows" render path could not be
  demonstrated live (every attributable session is fully traced; the historical untagged rows all
  sit under sessions with zero LLM calls, so the component never reaches that branch). Both are
  investigated findings, not skipped checks.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ / ⚠ references above (all Wave 0 test files created/extended, confirmed)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`) — confirmed throughout
- [x] Feedback latency < 60s — full suite ~50-60s throughout
- [x] D-07 live induction recorded with raw query output — §Task 2, all 4 kinds
- [ ] `nyquist_compliant: true` set in frontmatter — **NOT set.** Three genuine PARTIAL findings
      (D-15 historical backlog, D-12 per-session truncation, unattributed-rows render path) mean not
      every Manual-Only row passed cleanly. Per this plan's own rule ("flip `nyquist_compliant: true`
      only if every Manual-Only row genuinely passed"), this stays `false` — an honest PARTIAL, not a
      failure: the phase's core deliverables (D-01 real tool rows, D-06 alert isolation, D-07 ingest
      path, D-11 cache ratio, trace nesting) are all live-verified correct, and the two Task-2/Task-3
      bugs found live were fixed going forward and recorded rather than hidden.

**Approval:** Task 1 ✓, Task 2 ✓ (approved 2026-08-04), Task 3 — pending final operator approval.
