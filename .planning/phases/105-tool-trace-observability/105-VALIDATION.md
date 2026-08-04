---
phase: 105
slug: tool-trace-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
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
| TBD | TBD | TBD | OBS-01 | — | `tool_executed` case writes a `toolExecutions` row tagged `provider: "astridr"` alongside the existing `callGraphEdges` upsert | unit (pure-fn extraction) | `npx vitest run convex/runtimeIngest.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 | — | Hourly aggregate buckets for tool call/failure/duration, keyed by tool + provider; reads are bounded (`.take(CAP)`), never unfiltered `.collect()` | unit | `npx vitest run convex/aggregates.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-01 | — | Tools page usage panel renders per-tool frequency + success/fail from live query; query failure is contained by `SectionErrorBoundary` (a throwing Convex query unmounts the tree) | component | `npx vitest run src/pages/Tools.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-02 | T-105-01 | `tool_policy_event` case parses all 4 kinds and inserts into `toolPolicyEvents`; unknown kind is rejected, not silently dropped | unit | `npx vitest run convex/toolPolicyEvents.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-02 | T-105-01 | Alert fires ONLY for `malformed_policy_boot` / `malformed_policy_reload_rejected`; the other two kinds never alert (isolation control, mirroring `costBudgetEval.test.ts`) | unit | `npx vitest run convex/toolPolicyAlertEval.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | `TraceWaterfall` nests tool rows under the correct LLM-call parent when `round` is present | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | `groupCacheRatio` denominator matches `shapeCacheAcc` exactly (D-11 "one formula" regression) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | Both feeder queries are capped AND the UI states truncation when the cap is hit | unit + component | `npx vitest run convex/llm.test.ts` / `src/components/TraceWaterfall.test.tsx` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 (D-15 corrected) | — | `ToolExecutionPanel` + `PermissionDecisionsChart` still show Claude-Code-only rankings after Ástríðr rows exist in `toolExecutions` — control: seed both providers, assert the panels' output is byte-identical to the single-provider baseline | unit | `npx vitest run convex/toolExecutions.test.ts` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 (D-12 extended) | — | `successRate` and `avgDuration` are capped and report truncation, matching `fetchLlmRowsForWindow`'s `{rows, truncated}` shape | unit | `npx vitest run convex/toolExecutions.test.ts` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01/02/03 (cross-repo) | — | astridr payload widening (D-03 / D-08 / D-10) emits the added fields | unit (pytest) | astridr-repo: path TBD in Wave 0 | ⚠ verify in W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> **Corrected 2026-08-03 at plan-phase.** RESEARCH.md listed `convex/runtimeIngest.test.ts` as
> missing and `convex/llm.test.ts` as unconfirmed. Both **exist** (verified on disk). Extend them;
> do not create parallel files.

- [x] ~~`convex/runtimeIngest.test.ts` — does not exist~~ → **exists.** Add cases for the extended `tool_executed` case and the new `tool_policy_event` case alongside the existing `resolveGatewayTaskCompleted` / `processSwarmTaskEvent` pure-function tests.
- [x] ~~Confirm whether `convex/llm.test.ts` exists~~ → **exists.** Extend for the D-12 `sessionCalls` cap.
- [ ] `convex/toolPolicyEvents.test.ts` — new table + mutations, needs its own test file
- [ ] `convex/toolPolicyAlertEval.test.ts` — D-06 alert evaluator, including the negative-kind isolation control
- [ ] `src/pages/Tools.test.tsx` — new page, needs a component test scaffold
- [ ] `convex/toolExecutions.test.ts` — confirm existence; needed for the D-15 provider-filter arg and the D-12-extended caps on `successRate` / `avgDuration`
- [ ] **Confirm** astridr-repo's pytest path for `loop.py`'s `tool_executed` / leak-detector emits — research did not enumerate astridr-repo's test directory.
- [ ] Extend `convex/aggregates.test.ts` (exists, 34 tests) rather than creating a parallel file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **D-07 live induction** — the astridr → CodePulse ingest path actually carries `tool_policy_event` and the widened `tool_executed` payload end-to-end | OBS-01, OBS-02 | No `convex-test`; the `runMutation`/`ctx.db` seam is deliberately un-unit-tested. A passing parser test proves parsing, not delivery. | 1. Bring the self-hosted Convex backend + astridr stack up. 2. Induce a real `tool_policy_event` of each of the 4 kinds and at least one `tool_executed`. 3. Query the live `toolPolicyEvents` / `toolExecutions` tables and show the actual rows (raw output, not a count derived from a flag). 4. Confirm the alert fired for exactly the 2 alerting kinds and NOT for the other 2. Record the raw query output in `105-VERIFICATION.md`. |
| **Trace waterfall visual depth** — nested spans, per-tool timings, cache badges render legibly at real trace sizes | OBS-03 | Rendering legibility at real data volume is not assertable from jsdom; the existing tests cover the pure grouping functions only. | Open the trace waterfall against a real multi-round session, confirm nesting depth, per-tool durations, and cache-hit badges are present and correct against the underlying rows. Confirm the truncation notice appears when the feeder cap is hit (must be exercised on data that actually trips the cap — a fixture that never hits it proves nothing). |

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ / ⚠ references above
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 60s
- [ ] D-07 live induction recorded with raw query output
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
