# ENGINE-05 Live Integration Gate — Evidence

**Plan:** 108-07
**Date:** 2026-08-07
**Repos:** codepulse (`master`, Convex self-hosted deploy) + astridr-repo (`feature/brain-swap`, stack rebuild + WS commands)

This file is a verbatim command transcript. Every `npx convex` invocation carries
`--url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"`. Neither the Convex admin key nor the
astridr service key appears anywhere below.

---

## Task 1 — Pre-flight consent

**Status:** Satisfied by prior operator approval, not re-asked in this run.

Provenance: the orchestrator presented the operator (Larry) with the two operations this plan
performs — the Convex self-hosted deploy, and the `COMPOSE_PROFILES=prod,war-room docker compose
up --build -d` rebuild that restarts `astridr-agent` plus the 5 war-room agents — and the fact
that Task 3 issues real `swap.set` commands against the live process. On 2026-08-07 the operator
replied "Approved — proceed." This executor did not re-present the consent gate; it proceeded
directly to Task 2 per the dispatch instructions.

---

## Task 2 — Deploy, rebuild, prove freshness

### (a) Working self-hosted deploy invocation (verified live, recorded verbatim)

Admin key captured (never echoed):
```bash
ADMIN_KEY=$(MSYS_NO_PATHCONV=1 docker exec convex-backend /convex/generate_admin_key.sh | tail -1)
```
`MSYS_NO_PATHCONV=1` is mandatory in Git Bash for the leading-slash argument, and `| tail -1`
strips the `Admin key:` header line the script prints before the key itself.

**The first attempted form worked — no fallback needed:**
```bash
npx convex deploy --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" --yes
```

Raw output:
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

**This is the exact working self-hosted deploy invocation for this CLI version** — record for
future phases: `npx convex deploy --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" --yes`.
`docs/DEPLOY.md`'s bare `npm run deploy` invocation (cloud-targeted) was NOT used.

### (b) Verify the deploy landed — `controlVerbSwaps:listByScope`

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"__nonexistent__"}'
```

Raw output:
```
[]
```

`[]` — not a "function not found" error. The function AND the table exist on the self-hosted
instance. This is the absence-control: `[]` for a nonexistent profile is only meaningful because
the same query returns real rows for a real profile in Task 3.

### (c) Rebuild astridr

```bash
COMPOSE_PROFILES=prod,war-room docker compose up --build -d
```

Raw output (tail):
```
 Image astridr-repo-cli-gateway Built
 Image astridr-repo-war-room-gondul Built
 Image astridr-repo-astridr Built
 Image astridr-repo-war-room-hervor Built
 Image astridr-repo-notebooklm-mcp Built
 Image astridr-repo-war-room-freya Built
 Image astridr-repo-war-room-ragnhildr Built
 Container astridr-cli-gateway Recreate
 Container astridr-war-room-hervor Recreate
 Container astridr-agent Recreate
 Container astridr-war-room-astridr Recreate
 Container astridr-war-room-freya Recreate
 Container astridr-war-room-ragnhildr Recreate
 Container astridr-war-room-gondul Recreate
 Container astridr-notebooklm-mcp Recreate
 ... (all Recreated / Started) ...
 Container astridr-agent Healthy
```
All targeted services (`astridr-agent` + 5 `war-room-*` + `notebooklm-mcp` + `cli-gateway`) were
rebuilt and recreated. `astridr-agent` reports Healthy.

### (d) Prove the running container holds the new code — in-container symbol probes

```bash
docker exec astridr-agent python -c "import astridr.providers.router as m, inspect; print('profile-swap-override' in inspect.getsource(m))"
```
Raw output: `True`

```bash
docker exec astridr-agent python -c "import astridr.providers.router as m, inspect; print('set_profile_override' in inspect.getsource(m))"
```
Raw output: `True`

```bash
docker exec astridr-agent python -c "from astridr.api.ws_commands import SwapSetCommand; print('profile_id' in SwapSetCommand.model_fields)"
```
Raw output: `True`

```bash
docker exec astridr-agent python -c "import astridr.engine.control_verbs.swap_model as m, inspect; print('profile_id' in inspect.getsource(m))"
```
Raw output: `True`

**All four probes report True/present.** The running `astridr-agent` container holds this
phase's code: `providers/router.py`'s per-profile override machinery (108-04), the
`SwapSetCommand.profile_id` field (108-04), and the scope-aware `swap_model` branching (108-05).
Per the operational rule, war-room container freshness was not separately probed since Task 3
only exercises `astridr-agent`.

### (e) D-03 boot-seed result — captured immediately after rebuild

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```

Raw output:
```json
[
  {
    "_creationTime": 1786114494014.3733,
    "_id": "m97vdkjyf7pr8e63k9mnfz6nvn8c1m11",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "consulting",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496288
  },
  {
    "_creationTime": 1786114493580.216,
    "_id": "m97kd7ez3xgp900kjsxnqgva258c1n5q",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "business",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496264
  },
  {
    "_creationTime": 1786114492435.7876,
    "_id": "m97rhv8hrrvk16cy9a1zx691bn8c1kfz",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "personal",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496245
  }
]
```

**3 rows, one per configured profile** (`consulting`, `business`, `personal`) — every row carries
a real `profileId`, a real `model` (`anthropic/claude-sonnet-5`), and `mode: "inherited"`. No row
has `profileId`/`model` equal to `"unknown"`, `""`, or `"default"`. This is Task 2's success
criterion, met, and it also yields the real profile ids Task 3 needs: **P_target = `consulting`**,
**P_other = `business`** (both distinct from `personal`, which is left untouched as an additional
control profile).

**Contrast with pre-deploy baseline:** `activeEngineSnapshots` read `[]` on 2026-08-07 before this
plan ran (per `108-RESEARCH.md` Item 9 and the plan's own `<operational_facts>`) — this table has
never carried a valid row until this boot seed. That absence-to-presence contrast is the control
the 2026-08-05 evidence-discipline lesson requires.

---

## Task 3 — The live proof: scoped swap, profiled turn, unscoped control, row readback

**WS client environment:** `websockets` 16.0 confirmed available inside `astridr-agent`
(`docker exec astridr-agent python -c "import websockets; print(websockets.__version__)"` →
`16.0`) — no install needed. The service key is read via `os.environ["ASTRIDR_WEB_API_KEY"]`
inside the container and is never printed. `docker exec -i astridr-agent python - <<'PY' ... PY`
(the `-i` flag is required for stdin heredoc piping to reach the container process; a bare
`docker exec` without `-i` silently produced zero output in an initial attempt).

**Chosen profile ids** (from Task 2(e)'s boot seed): **P_target = `consulting`**,
**P_other = `business`** (both distinct from `personal`, an untouched third control profile).
**Chosen models** (fuzzy-resolved by `swap_model.py`'s `_CLAUDE_TIER_MAP`, distinct from the
current `claude-sonnet-5`): scoped swap value `"opus"` → resolves to `claude-opus-4-8`; unscoped
swap value `"haiku"` → resolves to `claude-haiku-4-5-20251001`.

### Step 1 — BEFORE baseline

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output: (identical to Task 2(e)'s pasted output above — captured immediately after boot,
before any Task 3 swap) — `consulting`/`business`/`personal` all `model: "anthropic/claude-sonnet-5"`,
`mode: "inherited"`, `selectionPath: "boot-seed"`.

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"consulting"}'
```
Raw output: `[]`

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"business"}'
```
Raw output: `[]`

**Verdict:** before any Task 3 action, both profiles report the boot-seed model with no
swap-history rows. This is the before-reading the after-readings will be contrasted against.

### Step 2 — Scoped `swap.set` for P_target (`consulting`)

WS client (run inside `astridr-agent`):
```python
cmd = {"type": "swap.set", "request_id": "108-uat-scoped", "target": "brain", "value": "opus", "profile_id": "consulting"}
```

Raw ack:
```json
{"type": "ack", "request_id": "108-uat-scoped", "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Opus 4 8.", "target": "brain"}
```

**Verdict:** `status: "ok"`, `handled: true` — the scoped swap was accepted and dispatched.

### Step 3 — Profiled turn for P_target (`consulting`)

```python
cmd2 = {"type": "chat.send", "request_id": "108-uat-turn-1", "message": "Reply with the single word OK.", "profile": "consulting"}
```

Raw ack:
```json
{"type": "ack", "request_id": "108-uat-turn-1", "status": "ok", "session_id": "f91872fc-8d73-48f5-85d7-d1b5edf1ad64"}
```

Raw `chat.response` push:
```json
{"event_type": "chat.response", "data": {"request_id": "108-uat-turn-1", "session_id": "f91872fc-8d73-48f5-85d7-d1b5edf1ad64", "status": "started"}, "timestamp": 1786114656.962897}
```

Raw `run.completed` push:
```json
{"event_type": "run.completed", "data": {"session_id": "f91872fc-8d73-48f5-85d7-d1b5edf1ad64", "rounds": 1, "tokens": 140, "cost": 0.00078, "final_text": "OK", "model": "claude-opus-4-8"}, "timestamp": 1786114658.6335988}
```

**Verdict:** the turn completed successfully (`final_text: "OK"`) and ran on `"model":
"claude-opus-4-8"` — the model the scoped swap set, not the pre-swap `claude-sonnet-5`. No error;
proceeding to read rows is not vacuous.

### Step 4 — Read the rows

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```

Raw output:
```json
[
  {
    "_creationTime": 1786114663112.245,
    "_id": "m97rp0fmjf4wjpry043wfn123h8c000z",
    "mode": "pinned",
    "model": "claude-opus-4-8",
    "profileId": "consulting",
    "selectionPath": "profile-swap-override",
    "timestamp": 1786114658.6097822
  },
  {
    "_creationTime": 1786114493580.216,
    "_id": "m97kd7ez3xgp900kjsxnqgva258c1n5q",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "business",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496264
  },
  {
    "_creationTime": 1786114492435.7876,
    "_id": "m97rhv8hrrvk16cy9a1zx691bn8c1kfz",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "personal",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496245
  }
]
```

**(a) VERDICT — PASS.** P_target's (`consulting`) newest row: `profileId: "consulting"`,
`model: "claude-opus-4-8"` (the swapped-to model), `mode: "pinned"`,
`selectionPath: "profile-swap-override"`. No sentinel.

**(b) VERDICT — PASS, by equality against the Step 1 baseline.** P_other's (`business`) row is
byte-identical to the Step 1/Task 2(e) baseline: same `_id`
(`m97kd7ez3xgp900kjsxnqgva258c1n5q`), same `model: "anthropic/claude-sonnet-5"`, same
`timestamp: 1786114467.7496264`. The scoped swap for `consulting` did not touch `business`.
`personal` (the untouched third control) is likewise unchanged (`_id`
`m97rhv8hrrvk16cy9a1zx691bn8c1kfz`, same timestamp).

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"consulting"}'
```

Raw output (immediately, and again after an explicit 8s wait past the 5s telemetry
`batch_interval`):
```
[]
```

**(c) VERDICT — FAIL, with root cause traced to file:line, not a test artifact.** No
`controlVerbSwaps` row exists for this swap. This is a real, live-discovered defect, not a mistake
in this proof's methodology. Root cause, each link independently verified against the live
container/log/code, not inferred:

1. `astridr-agent` log (structlog, this session, 14:57:36.96Z) confirms the emit fired with
   `session_id=None`:
   ```
   control_verb.swap_model channel=codepulse-control-center path=claude-native
   provider_affinity=[...] reason=None resolved=claude-opus-4-8 scope=consulting
   session_id=None target=opus verb=swap_model
   ```
2. `astridr/api/ws_commands.py:1149` (`_handle_swap_set`) constructs
   `ControlVerbContext(session_id=None, channel="codepulse-control-center", telemetry=self._telemetry)`
   — **unconditionally** `None` for every command-channel (WS `swap.set`) dispatch, scoped or
   unscoped, confirmed by direct read.
3. `astridr/engine/control_verbs/swap_model.py`'s telemetry dict literal includes
   `"session_id": ctx.session_id` verbatim (all four emit sites) — so the JSON payload carries an
   **explicit `"session_id": null`**, not an omitted key.
4. `astridr/engine/telemetry.py:461-489` (`_post_to_convex`, the buffered/non-critical send path
   `control_verb_swap` actually uses) does **not** strip `None`-valued keys before serializing —
   unlike the sibling `send_to()` method, whose own docstring explicitly documents why omission is
   required: *"Convex `v.optional()` accepts undefined/missing but rejects an explicit null."*
   `_post_to_convex` was never given that same guard.
5. `convex/runtimeIngest.ts:212-214` — `isOptionalString(value) { return value === undefined ||
   typeof value === "string"; }` — returns **`false`** for `null`.
6. `convex/runtimeIngest.ts:334` (`resolveControlVerbSwapEvent`) computes
   `sessionId = d.sessionId ?? d.session_id`. Since `d.sessionId` is `undefined`, `??` falls
   through to `d.session_id`, which is the literal `null` sent — so `sessionId` resolves to
   `null`, fails `isOptionalString(sessionId)`, and the function returns `null` for the **whole
   event**.
7. `convex/runtimeIngest.ts:956-958` (`if (!resolved) { break; }`) silently skips the insert. No
   exception is thrown, so this is invisible to the per-event try/catch's `droppedCount` — the
   ingest response (`{"ingested":5,"dropped":0}`, confirmed live in `convex-backend`'s access log
   at 14:57:43.14Z, content-length 26 bytes matching that exact JSON shape) reports **zero drops**
   even though this event was never written.
8. Confirmed empty at the storage layer directly (bypassing all application-level query logic):
   ```bash
   npx convex data controlVerbSwaps --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
   ```
   Raw output: `There are no documents in this table.`

**Scope of the defect:** every `control_verb_swap` telemetry row emitted from the WS
`swap.set`/`_handle_swap_set` command path (`ws_commands.py:1149`) is silently dropped, for
**every** target/scope combination — scoped and unscoped, brain and voice, on all four emit sites
(restore/unresolved/affinity-refused/success) — because `session_id` is unconditionally `None` on
that path. A **spoken** swap (`chat.send`'s regex fast-path, `ws_commands.py:676`, which threads a
real `session_id`) would not hit this bug — this proof exercises only the WS `swap.set` command
path, which is the one ENGINE-02/D-05's docstring and Task 3 both specifically target.

**This was not fixed in this plan.** `108-07-PLAN.md`'s objective states "This plan authors no
code" and Task 1's consent covered only deploying/rebuilding already-written code, not authoring
and deploying a new fix. Per the plan's own Task 4 protocol, this is recorded here as a named gap
for the operator's decision, not silently patched.

### Step 5 — THE UNSCOPED CONTROL

WS client (run inside `astridr-agent`, same process pattern as Step 2/3):
```python
cmd = {"type": "swap.set", "request_id": "108-uat-global", "target": "brain", "value": "haiku"}
# no profile_id — unscoped
```

Raw ack:
```json
{"type": "ack", "request_id": "108-uat-global", "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Haiku 4 5 20251001.", "target": "brain"}
```

Profiled turn for P_other (`business`):
```python
cmd2 = {"type": "chat.send", "request_id": "108-uat-turn-2", "message": "Reply with the single word OK.", "profile": "business"}
```

Raw ack + completion:
```json
{"type": "ack", "request_id": "108-uat-turn-2", "status": "ok", "session_id": "8143a2f3-8b95-4e81-9482-6f5f1b24ea28"}
{"event_type": "run.completed", "data": {"session_id": "8143a2f3-8b95-4e81-9482-6f5f1b24ea28", "rounds": 1, "tokens": 373, "cost": 0.001167, "final_text": "OK", "model": "claude-haiku-4-5-20251001"}, "timestamp": 1786114980.0038857}
```

**Verdict:** the turn completed on `"model": "claude-haiku-4-5-20251001"` — the globally-swapped
model, not `claude-sonnet-5` or `consulting`'s pinned `claude-opus-4-8`.

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```

Raw output:
```json
[
  {
    "_creationTime": 1786114982115.8586,
    "_id": "m97s0ttby2s168zm1fh3f4cfrd8c06pq",
    "mode": "pinned",
    "model": "claude-haiku-4-5-20251001",
    "profileId": "business",
    "selectionPath": "global-swap-override",
    "timestamp": 1786114978.9914522
  },
  {
    "_creationTime": 1786114663112.245,
    "_id": "m97rp0fmjf4wjpry043wfn123h8c000z",
    "mode": "pinned",
    "model": "claude-opus-4-8",
    "profileId": "consulting",
    "selectionPath": "profile-swap-override",
    "timestamp": 1786114658.6097822
  },
  {
    "_creationTime": 1786114492435.7876,
    "_id": "m97rhv8hrrvk16cy9a1zx691bn8c1kfz",
    "mode": "inherited",
    "model": "anthropic/claude-sonnet-5",
    "profileId": "personal",
    "selectionPath": "boot-seed",
    "timestamp": 1786114467.7496245
  }
]
```

**(d) VERDICT — PASS.** `business` now reports the GLOBAL model: `model:
"claude-haiku-4-5-20251001"`, `selectionPath: "global-swap-override"`, `mode: "pinned"` — the
global path behaves exactly as it did before this phase's per-profile changes.

**(e) VERDICT — PASS, by equality against Step 4's reading.** `consulting`'s row is
byte-identical to Step 4: same `_id` (`m97rp0fmjf4wjpry043wfn123h8c000z`), still
`model: "claude-opus-4-8"`, still `selectionPath: "profile-swap-override"`, same `timestamp`
(`1786114658.6097822`). The unscoped global swap did **not** clobber the per-profile pin — D-04's
precedence holds. `personal` is likewise unchanged.

```bash
npx convex data controlVerbSwaps --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```

Raw output:
```
There are no documents in this table.
```

**(f) VERDICT — FAIL, same root cause as (c).** No row for the global swap either — the
`session_id=None` defect traced under Step 4/(c) applies unconditionally to every
`_handle_swap_set` dispatch, scoped or unscoped.

### Step 6 — Restore

Unscoped restore:
```python
cmd = {"type": "swap.set", "request_id": "108-uat-restore-global", "target": "brain", "restore": True}
```
Raw ack:
```json
{"type": "ack", "request_id": "108-uat-restore-global", "status": "ok", "handled": true, "spoken_reply": "Back to my usual brain.", "target": "brain"}
```

Scoped restore for `consulting`:
```python
cmd2 = {"type": "swap.set", "request_id": "108-uat-restore-scoped", "target": "brain", "restore": True, "profile_id": "consulting"}
```
Raw ack:
```json
{"type": "ack", "request_id": "108-uat-restore-scoped", "status": "ok", "handled": true, "spoken_reply": "Back to my usual brain.", "target": "brain"}
```

Raw live WS fan-out of the underlying `control_verb_swap` telemetry payload for the scoped
restore (received directly over the same WS connection via `telemetry.send()`'s subscriber
fan-out — **direct confirmation of the Step 4/(c) root cause**, not inferred: `session_id` is
literally `null` in the payload the router itself constructs):
```json
{"event_type": "control_verb_swap", "data": {"verb": "swap_model", "target": null, "resolved": null, "provider_affinity": null, "path": "restore", "session_id": null, "channel": "codepulse-control-center", "scope": "consulting"}, "timestamp": 1786115021.2625413}
```

State check via `swap.get_state`:
```python
cmd3 = {"type": "swap.get_state", "request_id": "108-uat-state-check"}
```
Raw ack:
```json
{"type": "ack", "request_id": "108-uat-state-check", "status": "ok", "model_override": null, "model_source": null, "voice_override_id": null, "voice_override_name": null}
```

`swap.get_state` reports only the GLOBAL override (`model_override: null` confirms it is
cleared); it has no per-profile field. To prove the per-profile override was genuinely cleared
(not merely that the ack claimed success), a fresh turn was driven for each profile:

```python
# consulting
{"type": "chat.send", "request_id": "108-uat-turn-restore-check", "message": "Reply with the single word OK.", "profile": "consulting"}
```
Raw completion: `{"event_type": "run.completed", "data": {..., "final_text": "OK", "model": "claude-sonnet-5"}, ...}`

```python
# business
{"type": "chat.send", "request_id": "108-uat-turn-business-restore-check", "message": "Reply with the single word OK.", "profile": "business"}
```
Raw completion: `{"event_type": "run.completed", "data": {..., "final_text": "OK", "model": "claude-sonnet-5"}, ...}`

**Verdict — both overrides cleared, proven by actual model used, not by the ack alone.** Both
profiles, which were pinned to `claude-opus-4-8` (consulting) and `claude-haiku-4-5-20251001`
(business/global) immediately before this step, now run turns on `claude-sonnet-5` — the
pre-test/pre-phase default. The stack is restored to its pre-test state.

**Noted, not a defect — `activeEngineSnapshots` does not gain a fresh row on restore, by
design.** Re-querying `activeEngine:latestByProfile` (including after an explicit 8s wait past
the telemetry `batch_interval`) still shows `consulting`/`business`'s STALE pinned rows from
Steps 4/5. `docker logs astridr-agent` for both restore-confirming turns shows:
```
router.model_routing_skipped reason=unresolved_model selection_path=default
```
Traced to `astridr/providers/router.py:471-479`: after both overrides are cleared, resolution
falls through every named rung to the bare `"default"` fallback, which `_resolve_model` returns
as `(None, "default")` — `_emit_model_routing` then refuses to emit (D-02's guard, with an
explicit code comment: *"Accepted cost: a profile resolving purely to the FailoverProvider
fallback rung... reports nothing at runtime here — covered instead by plan 108-05's boot
seed."*). This is documented, intentional behavior, not a live defect — but it does mean the
plan's "read back and assert both overrides are gone" cannot be proven from
`activeEngineSnapshots` alone after a restore to the bare default rung; the `swap.get_state`
ack (global) plus the actual `model` used on a live confirming turn (both axes) are the evidence
that actually proves it here, and are what this evidence file relies on.

### Step 7 — Negative control (fail-closed rejection)

BEFORE state:
```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output:
```json
[
  {"_id": "m97s0ttby2s168zm1fh3f4cfrd8c06pq", "mode": "pinned", "model": "claude-haiku-4-5-20251001", "profileId": "business", "selectionPath": "global-swap-override", "timestamp": 1786114978.9914522},
  {"_id": "m97rp0fmjf4wjpry043wfn123h8c000z", "mode": "pinned", "model": "claude-opus-4-8", "profileId": "consulting", "selectionPath": "profile-swap-override", "timestamp": 1786114658.6097822},
  {"_id": "m97rhv8hrrvk16cy9a1zx691bn8c1kfz", "mode": "inherited", "model": "anthropic/claude-sonnet-5", "profileId": "personal", "selectionPath": "boot-seed", "timestamp": 1786114467.7496245}
]
```
(These are the stale-since-restore rows discussed in Step 6 — expected, and the baseline this
step's "no change" claim is measured against.)

Negative control command:
```python
cmd = {"type": "swap.set", "request_id": "108-uat-negctrl", "target": "brain", "value": "opus", "profile_id": "__definitely-not-a-profile__"}
```

Raw error ack:
```json
{"type": "ack", "request_id": "108-uat-negctrl", "status": "error", "error": "unknown profile_id: '__definitely-not-a-profile__'"}
```

AFTER state:
```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output:
```json
[
  {"_id": "m97s0ttby2s168zm1fh3f4cfrd8c06pq", "mode": "pinned", "model": "claude-haiku-4-5-20251001", "profileId": "business", "selectionPath": "global-swap-override", "timestamp": 1786114978.9914522},
  {"_id": "m97rp0fmjf4wjpry043wfn123h8c000z", "mode": "pinned", "model": "claude-opus-4-8", "profileId": "consulting", "selectionPath": "profile-swap-override", "timestamp": 1786114658.6097822},
  {"_id": "m97rhv8hrrvk16cy9a1zx691bn8c1kfz", "mode": "inherited", "model": "anthropic/claude-sonnet-5", "profileId": "personal", "selectionPath": "boot-seed", "timestamp": 1786114467.7496245}
]
```

**Verdict — PASS, by equality.** An unknown `profile_id` produced `status: "error"` naming the
rejected value, AND the row read before and after is byte-identical (same three `_id`s, same
three `timestamp`s) — the rejected command did not silently apply globally or to any profile.
This is 103-CONTRACT.md §7's named worst case, and it did not occur: the fail-closed validation
at `astridr/api/ws_commands.py:1137` (`if cmd.profile_id not in known_ids: raise ValueError(...)`)
rejects BEFORE any dispatch to `swap_model.ControlVerb.execute`, so no override write and no
telemetry emit for the rejected attempt was even attempted.

