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

---

## Re-proof after gap closure (2026-08-07, same day, continuation)

**Repos:** codepulse (`master`) + astridr-repo (branch unchanged since first proof), same
self-hosted Convex instance. Three fixes landed since the first proof (codepulse `d78fb5c1`/
`1521fe2d`, astridr `f632752c`) — see the executor dispatch's `<what_changed_since_the_first_proof>`
for the full description. This section re-runs only the swap-history portion of Task 3, per the
re-dispatch's explicit scope.

### Pre-deploy check — concurrent uncommitted work in the shared checkout

Before deploying, `git status --short` in codepulse showed uncommitted changes to
`convex/aggregates.ts`, `convex/aggregates.test.ts`, `convex/costDerived.ts`, `convex/crons.ts`,
and two new untracked files (`convex/lib/aggregatePeriod.ts`/`.test.ts`) — a concurrent session's
in-progress work, unrelated to this plan and not touched by this executor per the shared-checkout
rules. `npx convex deploy` pushes the **working-tree** state of `convex/`, not just this executor's
own commits, so that WIP would be deployed alongside the two fix commits regardless. Verified
before deploying that this was safe to do: `npx tsc --noEmit` (clean, no output) and
`npx vitest run convex/aggregates.test.ts convex/runtimeIngest.test.ts` (140/140 passed). Disclosed
here rather than silently deployed.

### Step 1 — Deploy + freshness proof

```bash
npx convex deploy --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" --yes
```
Raw output (tail): `✔ Deployed Convex functions to http://127.0.0.1:3210` — same working
invocation as the first proof, no new form needed.

**Freshness proof — the `skipped` field, not just function existence.** POSTed a benign,
well-formed `control_verb_swap` event with every optional field set to an explicit JSON `null`
(the exact shape the pre-fix code rejected) directly to `/runtime-ingest`:
```bash
curl -s -X POST http://127.0.0.1:3211/runtime-ingest -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INGEST_KEY" \
  -d '{"eventType":"control_verb_swap","data":{"verb":"swap_model","path":"108-07-freshness-probe","channel":"codepulse-control-center","session_id":null,"scope":"__108-freshness-probe__","target":null,"resolved":null,"reason":null}}'
```
Raw response: `{"ingested":1,"dropped":0,"skipped":0}` — the `skipped` key is present (the old
response shape was `{"ingested","dropped"}` only, confirmed by re-reading the pre-fix code in the
first proof section above). This is the freshness signal the old build cannot produce.

Read-back, proving the row landed with the nulls actually stripped (not merely accepted and
silently coerced):
```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"__108-freshness-probe__"}'
```
Raw output:
```json
[
  {
    "_creationTime": 1786118344759.274,
    "_id": "ms7q3t64w8pmwqfj4csc05c8cs8c1skg",
    "channel": "codepulse-control-center",
    "path": "108-07-freshness-probe",
    "scope": "__108-freshness-probe__",
    "timestamp": 1786118343.967,
    "verb": "swap_model"
  }
]
```
**Verdict — PASS.** `session_id`, `target`, `resolved`, `reason` are entirely **absent** from the
stored row (not present-as-`null`) — `normalizeOptional()` stripped every explicit `null` before
the mutation call, exactly as `108-07-PLAN.md`'s gap-closure fix intends.

### Step 2 — Rebuild astridr

```bash
COMPOSE_PROFILES=prod,war-room docker compose up --build -d
```
All targeted services rebuilt/recreated; `astridr-agent` reported Healthy in the compose output.

**In-container code proof** (not timestamp inference):
```bash
docker exec astridr-agent python -c "
import astridr.engine.telemetry as m, inspect
for name, obj in inspect.getmembers(m):
    if inspect.isclass(obj) and hasattr(obj, '_post_to_convex'):
        print(name, '_strip_none_values' in inspect.getsource(obj._post_to_convex))
"
```
Raw output: `ConvexHandler True` — `_post_to_convex` calls `_strip_none_values`, confirmed inside
the running container.

**Environment note (disclosed, not silently worked around):** shortly after the rebuild reported
Healthy, `astridr-agent` was observed to restart once more on its own (`docker ps` showed
`Up 2 seconds (health: starting)` immediately after the in-container probe above had already
succeeded once). `docker inspect --format '{{.State.Restarting}} {{.RestartCount}}'` showed
`false 0` both before and after — this was a **clean single recreate**, not a crash-restart loop
(RestartCount never incremented). Root cause not chased further since it did not recur; the
in-container `_strip_none_values` probe was re-run after the container settled to `healthy` and
still reported `True` on the same `StartedAt`, confirming the settled container held the new code
before proceeding.

### Step 3 — Baseline (before-contrast)

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output: fresh D-03 boot seed — `consulting`/`business`/`personal`, all `model:
"anthropic/claude-sonnet-5"`, `mode: "inherited"`, `selectionPath: "boot-seed"`.

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"consulting"}'
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"business"}'
```
Raw output for both: `[]` — the before-reading assertion (c)/(f) are contrasted against.

### Step 4 — Scoped swap (consulting → opus) and unscoped swap (→ haiku)

WS client run inside `astridr-agent` (`ws://localhost:8181/ws/telemetry`, `Authorization: Bearer
$ASTRIDR_WEB_API_KEY` read from `os.environ`, never printed).

**First attempt — genuine transient network loss (disclosed, not swept under the fix).** The
first scoped+unscoped swap attempt (immediately after the container settled healthy) produced
normal acks and a successful turn (`model: "claude-opus-4-8"`, `model:
"claude-haiku-4-5-20251001"`), but `docker logs astridr-agent` showed:
```
16:04:51.148553Z warning telemetry.timeout events=30
16:05:18.159812Z warning telemetry.timeout events=30
```
`_post_to_convex`'s `_flush()` snapshots and clears the buffer BEFORE the POST attempt
(`astridr/engine/telemetry.py:466-467`), so a timed-out batch's events are dropped, not requeued —
`self.events_dropped += len(events)` at `telemetry.py:559`. This is a startup-settling connectivity
race (DNS/network reconfiguration after the compose recreate), unrelated to either fix. Confirmed
resolved: a direct in-container `httpx` POST to `http://convex-backend:3211/runtime-ingest`
immediately afterward returned `401 {"error":"Unauthorized"}` in milliseconds (fast, no timeout —
proves connectivity, since 401 is the expected auth-fail response with no key), and the next three
buffer flushes all logged `telemetry.posted` with no further timeouts. The swap sequence was
**re-run** once connectivity was confirmed stable (three consecutive clean `telemetry.posted` log
lines with no `telemetry.timeout`/`telemetry.retrying` in between).

**Second attempt (the one this proof relies on):**

Scoped swap ack:
```json
{"type": "ack", "request_id": "108r-scoped", "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Opus 4 8.", "target": "brain"}
```
Live `control_verb_swap` fan-out (same WS connection, `telemetry.send()`'s subscriber push):
```json
{"event_type": "control_verb_swap", "data": {"verb": "swap_model", "target": "opus", "resolved": "claude-opus-4-8", "provider_affinity": ["anthropic_advisor", "anthropic_direct", "gemini", "grok", "gemini_openrouter", "openrouter"], "path": "claude-native", "reason": null, "session_id": null, "channel": "codepulse-control-center", "scope": "consulting"}, "timestamp": 1786118811.5297928}
```
Turn (`chat.send`, profile `consulting`) completion: `{"session_id": "5247b71a-...", "rounds": 1,
"tokens": 140, "cost": 0.00078, "final_text": "OK", "model": "claude-opus-4-8"}` — turn ran on the
swapped model, not vacuous.

Unscoped swap ack:
```json
{"type": "ack", "request_id": "108r-global", "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Haiku 4 5 20251001.", "target": "brain"}
```
Live fan-out: `{"event_type": "control_verb_swap", "data": {..., "resolved": "claude-haiku-4-5-20251001", "provider_affinity": [...], "path": "claude-native", "session_id": null, "scope": null}, ...}`
Turn (`chat.send`, profile `business`) completion: `model: "claude-haiku-4-5-20251001"`.

Waited past the 5s `telemetry_batch_interval` and confirmed clean flushes in the logs
(`telemetry.posted events=7`/`8`/`1`, no `telemetry.timeout`) before reading back.

### Step 5 — Assertion (c)/(f): read the rows — STILL FAIL, different root cause than the first proof

```bash
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"consulting"}'
npx convex run controlVerbSwaps:listByScope --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId":"business"}'
```
Raw output (both): `[]`

```bash
npx convex data controlVerbSwaps --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output at this point in the sequence:
```
_id                                | _creationTime     | channel                    | path                     | scope                     | timestamp      | verb
"ms7q3t64w8pmwqfj4csc05c8cs8c1skg" | 1786118344759.274 | "codepulse-control-center" | "108-07-freshness-probe" | "__108-freshness-probe__" | 1786118343.967 | "swap_model"
```
**Verdict — FAIL, with a full root-cause trace, not a repeat of the first proof's finding.** The
session_id-null defect IS closed (Step 1's freshness probe proves the guard/normalizer work; the
restore-path rows below independently prove it too). The rows still do not land because of a
**second, previously-undiscovered defect on the same resolver**, hit only once the first defect
stopped masking it:

1. `astridr/engine/control_verbs/swap_model.py:126` types `ResolveOutcome.provider_affinity` as
   `list[str] | None`. On the success path (`swap_model.py:394-395,409` for the openrouter branch;
   the equivalent claude-native branch is the one exercised live above), `provider_affinity` is set
   to a real Python **list**, e.g. `["anthropic_advisor", "anthropic_direct", "gemini", "grok",
   "gemini_openrouter", "openrouter"]` — confirmed directly in the live WS fan-out payload pasted
   above, not inferred.
2. `swap_model.py:486` forwards it verbatim into the telemetry dict: `"provider_affinity":
   outcome.provider_affinity`. Serialized to JSON, a Python list becomes a JSON **array**.
3. `convex/runtimeIngest.ts:363` coalesces it: `const providerAffinity = d.providerAffinity ??
   d.provider_affinity;` — resolves to the array (astridr sends snake_case).
4. `convex/runtimeIngest.ts:372` (`resolveControlVerbSwapEvent`) checks it with
   `isOptionalString(providerAffinity)` (defined at `runtimeIngest.ts:225-227`:
   `value === undefined || value === null || typeof value === "string"`). A JSON array's
   `typeof` is `"object"`, not `"string"` — the guard returns **`false`** for every non-null
   `provider_affinity`, so the whole event resolves to `null` and is skipped
   (`runtimeIngest.ts:1017-1028`, `skippedCount++`).
5. **Directly reproduced**, not just traced: POSTing a payload byte-shaped like the real event
   (array `provider_affinity`, everything else identical to the passing freshness-probe payload)
   to `/runtime-ingest`:
   ```bash
   curl -s -X POST http://127.0.0.1:3211/runtime-ingest -H "Content-Type: application/json" \
     -H "Authorization: Bearer $INGEST_KEY" \
     -d '{"eventType":"control_verb_swap","data":{"verb":"swap_model","path":"108-07-array-repro","channel":"codepulse-control-center","session_id":null,"scope":"__108-array-repro__","target":"opus","resolved":"claude-opus-4-8","provider_affinity":["anthropic_advisor","anthropic_direct"],"reason":null}}'
   ```
   Raw response: **`{"ingested":1,"dropped":0,"skipped":1}`** — `skipped:1`, definitively
   confirming the mechanism. (Note: an earlier working hypothesis in this session's own scratch
   reasoning — that a `content-length: 38` response header from the real astridr POST proved
   `skipped:0` for that batch — was WRONG and is explicitly retracted here: `{"ingested":8,
   "dropped":0,"skipped":2}` is also 38 bytes, since every field stayed single-digit. The response
   body was never actually read for the real batch; this reproduction with an identical payload
   shape, whose body WAS read, is the evidence this verdict rests on, not the content-length
   inference.)

**Positive control confirming the defect's exact boundary — the restore-path rows DO land:**
`swap_model.py:460` sets `"provider_affinity": None` (not a list) on the restore path only
(`swap_model.py:443-465`). Step 6 below drove both a scoped and an unscoped restore, and:
```bash
npx convex data controlVerbSwaps --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output (after Step 6's restores):
```
_id                                | _creationTime      | channel                    | path                     | scope                     | timestamp          | verb
"ms7s05100m6754xzh5c73dg0q58c0qvj" | 1786119091365.7546 | "codepulse-control-center" | "restore"                | "consulting"              | 1786119087.9178562 | "swap_model"
"ms7g61xw5krdkev8mb1m98vnrx8c0tt6" | 1786119091340.4302 | "codepulse-control-center" | "restore"                |                           | 1786119087.9159899 | "swap_model"
"ms7q3t64w8pmwqfj4csc05c8cs8c1skg" | 1786118344759.274  | "codepulse-control-center" | "108-07-freshness-probe" | "__108-freshness-probe__" | 1786118343.967     | "swap_model"
```
Both restore rows (`path: "restore"`, one scoped to `consulting`, one unscoped/global) **landed
successfully** — same `session_id: null` payload shape as the failed success-path swaps, but
`provider_affinity: null` instead of an array. This is the exact contrast that pins the defect to
`provider_affinity`'s type, not to anything else varying between a restore and a live swap.

**Scope of the defect:** every `swap_model` event whose swap actually **resolved to a model**
(the `claude-native`/`openrouter` success paths — i.e., the one case a swap-history UI most needs
to show) is silently skipped. Only `restore` and any path where `ResolveOutcome` leaves
`provider_affinity` at its dataclass default of `None` (refused/unresolved) would land. **This is
worse than the first proof's finding in one respect: even after the operator fixes the session_id
defect (done, deployed, verified), the actual "swap succeeded" row — the primary thing D-13/D-15's
swap-history feature exists to show — still never lands.** Not fixed in this session, per the same
"this plan authors no code" scope as the first proof; documented as a second named gap.

### Step 6 — Core axis regression check

```bash
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
```
Raw output:
```json
[
  {"_id": "m97vh7z4628bah7zehrsfvst8n8c1qm5", "mode": "pinned", "model": "claude-haiku-4-5-20251001", "profileId": "business", "selectionPath": "global-swap-override", "timestamp": 1786118707.7396743},
  {"_id": "m97t4p4yjxz65r95wjr2remnz18c1795", "mode": "pinned", "model": "claude-opus-4-8", "profileId": "consulting", "selectionPath": "profile-swap-override", "timestamp": 1786118705.447997},
  {"_id": "m97ymqe4pmnbd5r0sv6vgfgjgd8c0qgh", "mode": "inherited", "model": "anthropic/claude-sonnet-5", "profileId": "personal", "selectionPath": "boot-seed", "timestamp": 1786118667.797974}
]
```
**Verdict — PASS, no regression.** Identical pattern to the first proof: `consulting` pinned to
the scoped-swap model with `selectionPath: "profile-swap-override"`, `business` pinned to the
global-swap model with `selectionPath: "global-swap-override"`, `personal` untouched at its
boot-seed default. The ENGINE-01/ENGINE-02 axis this plan already proved PASS is unaffected by
either fix.

### Step 7 — Restore

Unscoped restore ack: `{"type": "ack", "request_id": "108r-restore-global", "status": "ok", "handled": true, "spoken_reply": "Back to my usual brain.", "target": "brain"}`

Scoped restore (`consulting`) ack: `{"type": "ack", "request_id": "108r-restore-scoped", "status": "ok", "handled": true, "spoken_reply": "Back to my usual brain.", "target": "brain"}`
(Live fan-out for this one pasted in Step 5's positive-control paragraph above — `provider_affinity: null`, and it landed.)

Fresh confirming turns (not the ack alone):
```json
{"event_type": "run.completed", "data": {"session_id": "4da1c71b-...", "final_text": "OK", "model": "claude-sonnet-5"}, ...}
{"event_type": "run.completed", "data": {"session_id": "dc7a1e30-...", "final_text": "OK", "model": "claude-sonnet-5"}, ...}
```
`consulting` and `business` both ran their confirming turn on `claude-sonnet-5` — the pre-test
default, not the swapped-to opus/haiku models.

`swap.get_state` ack: `{"type": "ack", "status": "ok", "model_override": null, "model_source": null, "voice_override_id": null, "voice_override_name": null}` — global override confirmed cleared.

**Verdict — PASS. Stack fully restored**, proven by actual model used on live turns for both
affected profiles, not by acks alone. Larry's assistant is not left pinned to a test model.

### Summary of this re-proof

| Assertion | First proof | This re-proof |
|---|---|---|
| Freshness (new `skipped` field live) | n/a | **PASS** |
| `_strip_none_values` present in running container | n/a | **PASS** |
| (c) scoped swap → real `controlVerbSwaps` row | FAIL (session_id null) | **FAIL** (provider_affinity array — new, different root cause) |
| (f) unscoped swap → real `controlVerbSwaps` row, scope absent | FAIL (session_id null) | **FAIL** (same new root cause) |
| Core engine axis (activeEngine) regression | PASS | **PASS**, unchanged |
| `skipped` counter live and non-zero on the reproduced defect shape | n/a (field didn't exist) | **PASS** (`skipped:1` reproduced directly) |
| Stack restored | PASS | **PASS**, proven via live turns |

**Both fixes deployed in this session did exactly what they claimed** — the session_id-null
defect is closed, proven three independent ways (freshness probe, restore-path rows landing,
`skipped` field literally present in the response). **The swap-history axis (assertions c/f) is
still not satisfied end-to-end**, for a reason outside either fix's scope: `provider_affinity`'s
type (array vs. the schema's `v.optional(v.string())`) was never exercised by the first proof's
own root-cause trace, because the session_id rejection fired first and masked it on every attempt.
This is a genuine second gap, not a re-discovery of the first one.

