# Phase 109 — Live Evidence Gate (Plan 109-09)

Durable record for the live gate that decides whether **ENGINE-03**, **ENGINE-04** and **TELE-02**
may be marked satisfied. Every verdict in this file sits directly beneath the raw output that
produced it. No verdict is written from a green unit suite alone.

- **Gate opened:** 2026-08-10
- **Operator:** Larry Mandras
- **Driver:** Claude Code (inline, attended — plan is `autonomous: false`)
- **Stack:** self-hosted Convex at `127.0.0.1:3210`; astridr on `feature/brain-swap`

---

## Section 1 — Convex backend deployed to the SELF-HOSTED instance

Target was confirmed with `--dry-run` **before** the real deploy, so the push could not silently
reach the retired cloud deployment.

```
$ npx convex deploy --dry-run
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210... [dry run]

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Downloading current deployment state...
Diffing local code and deployment state...
✔ Remote config would be overwritten with the following changes:
  Change the server's version for Node.js actions:

Finalizing push...
✔ Would have deployed Convex functions to http://127.0.0.1:3210
```

```
$ npx convex deploy --yes
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

**VERDICT: PASS.** Deployed to `http://127.0.0.1:3210`, the self-hosted instance. `No indexes are
deleted by this push` — no destructive index change. No `import --replace-all` was used anywhere in
this gate (T-109-22).

### 1a — Pre-deploy state, recorded because it is the control for this section

Before the deploy, the self-hosted instance did **not** have `listGlobal`, while two sibling
functions from the same module **were** present. That contrast is what proves the deployment was
stale rather than the probe being broken:

```
$ npx convex run controlVerbSwaps:listGlobal --url http://127.0.0.1:3210 --admin-key "..."
✖ Failed to run function "controlVerbSwaps:listGlobal":
Error: [Request ID: d92854540b2c62c4] Server Error
Could not find function for 'controlVerbSwaps:listGlobal'. Did you forget to run `npx convex dev`?
  ...
• controlVerbSwaps:record
• controlVerbSwaps:listByScope
```

All three exist in local source — `convex/controlVerbSwaps.ts:46` (`record`), `:76` (`listByScope`),
`:111` (`listGlobal`) — so the absence was a deploy gap, not a missing implementation.

Post-deploy, the same command resolves and returns real rows (full output in **Probe G**).

---

## Section 2 — astridr rebuilt on `feature/brain-swap`

Command run from `C:\Users\mandr\astridr-repo`, with the `war-room` profile included so the five
war-room containers rebuild their own images from the same context rather than staying on the old
one:

```
$ COMPOSE_PROFILES=prod,war-room docker compose up --build -d
...
 Container astridr-war-room-astridr Started
 Container astridr-war-room-freya Started
 Container astridr-war-room-hervor Started
 Container astridr-war-room-ragnhildr Started
 Container astridr-war-room-gondul Started
 Container astridr-agent Started
 Container astridr-agent Waiting
 Container astridr-supabase-kong Healthy
 Container astridr-supabase-meta Healthy
 Container astridr-agent Healthy
 Container astridr-whatsapp-bridge Starting
 Container astridr-whatsapp-bridge Started
EXIT=0
```

**VERDICT: PASS.** Exit 0, `astridr-agent Healthy`, war-room containers and the WhatsApp bridge all
restarted. `docker compose restart` was **not** used — it would have re-run the stale baked image.

**Scope of this rebuild.** Only 8 commits sat above the previous image build
(`2026-08-08T23:06:56Z`) on `feature/brain-swap`, four of them Phase 109-01 itself:

```
6166d88e docs(188.5): add research + validation strategy, pin D-12 delivery path
8c4842f1 feat(109-01): report default_profile_id on the swap.catalogue brain ack
411e0253 test(109-01): add failing tests for default_profile_id on swap.catalogue ack
effb7a48 feat(109-01): add ModelRouter override enumerators and profile_overrides on swap.state
10503e4f test(109-01): add failing tests for profile override enumerators and swap.state map
fb6e604f docs(state): record phase 188.4 context session
0f5f1f3f docs(188.4): capture phase context
020d0e57 test(188.3): close UAT item 7 with live evidence — reply-language pin holds
```

The remaining four are docs/test-only. The Dependabot dependency bump and the cli-gateway auth
fixes were already baked into the previous image.

---

## Section 3 — Freshness proof: in-container, by symbol

Per CLAUDE.md, freshness is **not** argued from an image timestamp and **not** from comparing image
SHAs across services (war-room images legitimately differ from `astridr-agent` even on a correct
rebuild). Each probe greps the live module source inside the running container.

### 3a — Before the rebuild (the control that proves these probes can return False)

```
$ docker exec astridr-agent python -c "import astridr.providers.router as m, inspect; print('get_all_profile_overrides' in inspect.getsource(m))"
router.get_all_profile_overrides: False

$ docker exec astridr-agent python -c "import astridr.engine.control_verbs.dispatch as m, inspect; print('profile_overrides' in inspect.getsource(m))"
dispatch.profile_overrides: False

$ docker exec astridr-agent python -c "import astridr.engine.control_verbs.dispatch as m, inspect; print('default_profile_id' in inspect.getsource(m))"
dispatch.default_profile_id: False
```

### 3b — After the rebuild

```
=== FRESHNESS PROBES (post-rebuild) ===
router.get_all_profile_overrides: True
dispatch.profile_overrides: True
ws_commands.default_profile_id: True
=== NEGATIVE CONTROL (symbol that should NOT exist) ===
control_bogus_symbol_9x7q2: False
```

**VERDICT: PASS.** All three phase-109 symbols are present in the running container, and the
negative control returns `False` — so the probe discriminates rather than returning `True`
indiscriminately. Both facts come from the same measurement.

**Deviation from the plan's suggested probe, recorded rather than silently corrected.** The plan
proposed probing `astridr.engine.control_verbs.dispatch` for `default_profile_id`. In the actual
source that symbol lands in `astridr/api/ws_commands.py:1258`, on the `swap.catalogue` ack:

```
astridr/api/ws_commands.py:1258:  return {"target": "brain", "entries": entries, "default_profile_id": self._default_profile_id}
astridr/providers/router.py:847:  def get_all_profile_overrides(self) -> dict[str, str]:
```

The probe was pointed at the module that actually defines it. `profile_overrides` was probed in
`dispatch` exactly as the plan specified, and passed there.

---

## Section 4 — Reachability

```
astridr_health=200
convex_version=200
```

`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8181/health` and the same against
`http://127.0.0.1:3210/version`. No escalation was needed — neither `docker restart` nor
`up -d --force-recreate` was required.

**VERDICT: PASS.** Both 200.

---

## Section 5 — Container health at gate start

```
astridr-agent	Up 2 minutes (healthy)
convex-backend	Up 8 hours (healthy)
```

**VERDICT: PASS.** Both healthy. `astridr-agent`'s 2-minute uptime is the rebuild in Section 2.

---

## Section 6 — Real profile ids (subject and control pool)

Two independent sources agree, so the ids are not inferred from one place:

```
--- profiles from astridr config ---
/app/config/profiles.yaml -> ['personal', 'business', 'consulting']
```

```
$ npx convex run profiles:listConfigs --url http://127.0.0.1:3210 --admin-key "..."
    "profileId": "consulting",
    "profileId": "business",
    "profileId": "personal",
```

**VERDICT: PASS.** Three real profiles — more than the two the absence proofs require.

Assignment for the probes below:

| Role | Profile |
|---|---|
| SUBJECT | `business` |
| CONTROL (stays pinned through Probe C) | `consulting` |
| UNPINNED control (Probe E) / absent-state candidate (Probe F) | `personal` |

---

## Section 7 — Codepulse-side suite state at gate time

```
$ npx tsc --noEmit
TSC_EXIT=0
```

```
$ npx vitest run
 Test Files  284 passed | 17 skipped (301)
      Tests  3736 passed | 193 todo (3929)
   Duration  71.35s
```

**VERDICT: PASS.** Recorded as a precondition only. Per this plan's own premise, a green suite is
explicitly **not** sufficient to satisfy ENGINE-03 / ENGINE-04 / TELE-02 — that is what the live
probes below exist to decide.

---

# Task 1 gate: PASS

The stack is provably running this phase's code on both sides:

- Convex self-hosted has `listGlobal` (was absent pre-deploy, with two sibling functions present as
  the control).
- `astridr-agent` contains all three phase-109 symbols (all three were absent pre-rebuild, and a
  bogus-symbol control returns False).
- Both services reachable at 200 and healthy.
- Three real profile ids available for subject/control roles.

No image-SHA comparison was used anywhere as a freshness argument.

---

## Probes A–D (Task 2)

**How these were dispatched.** The app's dispatch rides a module-scope singleton WebSocket
(`AstridrWSContext.tsx:140,230`) authenticated with a bearer subprotocol built from
`VITE_ASTRIDR_API_KEY`. Rather than open a second socket (which would mean handling the API key in
the transcript), every probe below reuses the page's OWN live socket, obtained by walking the React
fiber tree on the CodePulse tab to the context value — the literal "browser devtools console on the
CodePulse tab, which already holds a live socket" the plan calls for.

```
FOUND ctx keys=status,sendCommand,subscribe,subscribeEvent,reconnect status=connected fibersScanned=37
```

### Baseline, captured BEFORE any mutation

```
$ sendCommand({type:"swap.get_state"})
{
  "status": "ok",
  "model_override": null,
  "model_source": null,
  "voice_override_id": null,
  "voice_override_name": null,
  "profile_overrides": {}
}
```

A clean slate: no global override, no per-profile pins. Recorded so the gate's own mutations are
distinguishable from pre-existing state.

---

### Probe A — D-03, `default_profile_id` on the live `swap.catalogue` ack

```
$ sendCommand({type:"swap.catalogue", target:"brain"})
{
  "ack_top_level_keys": ["type","request_id","status","target","entries","default_profile_id"],
  "status": "ok",
  "default_profile_id": "personal",
  "default_profile_id_type": "string",
  "entries_count": 361,
  "first_two_entries": [
    { "id": "claude-opus-4-8",  "name": "Claude Opus 4.8", "vendor": "anthropic" },
    { "id": "claude-sonnet-5",  "name": "Claude Sonnet 5", "vendor": "anthropic" }
  ]
}
```

**VERDICT: PASS.** `default_profile_id` is present on the ack as a top-level field, is a non-empty
string, and its value `personal` is one of the three real profile ids independently enumerated in
Section 6. Not `undefined`, not `null`, not empty, not absent. Read off the wire — not inferred from
source.

---

### Probe B — D-05, the set leg

SUBJECT = `business` → `claude-opus-4-8` (modelA). CONTROL = `consulting` → `claude-sonnet-5` (modelB).

```
$ sendCommand({type:"swap.set", target:"brain", value:"claude-opus-4-8", restore:false, profile_id:"business"})
{ "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Opus 4 8.", "target": "brain" }

$ sendCommand({type:"swap.set", target:"brain", value:"claude-sonnet-5", restore:false, profile_id:"consulting"})
{ "status": "ok", "handled": true, "spoken_reply": "Switching to Claude Sonnet 5.", "target": "brain" }

$ sendCommand({type:"swap.get_state"}).profile_overrides
{
  "business":   { "model": "claude-opus-4-8", "source": "codepulse-scoped-swap" },
  "consulting": { "model": "claude-sonnet-5", "source": "codepulse-scoped-swap" }
}
```

**VERDICT: PASS.** Both profiles present, each with its own correct and DIFFERENT model. Global
`model_override` remained `null` throughout, so these are genuinely per-profile writes.

**Shape note (recorded because the plan's wording implies a bare string).** The map's values are
objects `{model, source}`, not bare model strings. `useProfileSwap.ts:164` reads `entry?.model`
accordingly, so client and server agree — but any future consumer written against "the map holds a
model string" would be wrong.

---

### Probe C — D-05, the restore leg (absence proof + same-payload control)

```
$ sendCommand({type:"swap.set", target:"brain", restore:true, profile_id:"business"})
{ "status": "ok", "handled": true, "spoken_reply": "Back to my usual brain.", "target": "brain" }

$ sendCommand({type:"swap.get_state"}).profile_overrides     <-- THE ONE PAYLOAD
{
  "consulting": { "model": "claude-sonnet-5", "source": "codepulse-scoped-swap" }
}

assertions read from THAT SAME payload:
  SUBJECT business: key present at all?  false        <- hasOwnProperty, not a truthiness test
  SUBJECT business value                 undefined    <- absent, NOT present-with-null
  CONTROL consulting: key present?       true
  CONTROL consulting value               {"model":"claude-sonnet-5","source":"codepulse-scoped-swap"}
  map is empty (would mean broken probe) false
  all keys                               ["consulting"]
```

**VERDICT: PASS.** SUBJECT is absent from the map — not present with `null`, not present with an
empty string — and the CONTROL is still present with modelB **in the same payload**, which is what
makes the absence meaningful. An empty map would have indicated a broken probe; the map was not
empty.

---

### Probe D — ENGINE-04's central claim, observed in the UI

#### D-negative-control — a scoped swap for a profile id that does not exist

```
$ sendCommand({type:"swap.set", target:"brain", value:"claude-opus-4-8", restore:false,
               profile_id:"definitely-not-a-real-profile-9x7q2"})
REJECTED
error_message_from_server: "unknown profile_id: 'definitely-not-a-real-profile-9x7q2'"

$ sendCommand({type:"swap.get_state"}).profile_overrides
{ "consulting": { "model": "claude-sonnet-5", "source": "codepulse-scoped-swap" } }
bogus profile leaked into map? false
```

**VERDICT: PASS.** The server refused with its own specific reason, nothing was written, and the
CONTROL survived. An honest error, not a silent success.

#### D-positive — "the label must NOT update before confirmation"

Driven through the REAL picker control on Settings' `business` row, never by raw dispatch —
dispatching through the context directly would bypass the component's pending state and produce a
false negative on the suffix. Timings merge two independent instruments: a `MutationObserver` on the
profile row, and a `WebSocket` wrapper capturing every frame. Both stamp from one `performance.now()`
origin.

```
t=34075  SEND  swap.set  profile_id=business  value=claude-sonnet-5
t=34838  DOM   "business | claude-opus-4-8 | · switching to Claude Sonnet 5…"   <- suffix up, label STILL OLD
t=34889  RECV  ack status=ok
t=34891  RECV  control_verb_swap
t=34891  RECV  swap.state
t=35161  DOM   "business | claude-sonnet-5 | · switching to Claude Sonnet 5…"   <- label flips, 272ms AFTER the ack
```

Reproduced on a second swap:

```
t=129988 SEND  swap.set  profile_id=business  value=claude-haiku-4-5-20251001
t=130528 DOM   "business | claude-sonnet-5 | · switching to Claude Haiku 4.5…"  <- suffix up, label STILL OLD
t=130584 RECV  ack status=ok + control_verb_swap + swap.state
t=130948 DOM   "business | claude-haiku-4-5-20251001 | · switching to Claude Haiku 4.5…"  <- 364ms AFTER the ack
```

**VERDICT on the no-optimistic-flip claim: PASS.** In both runs the base label held its OLD value
through the entire in-flight window and changed only after the server ack and `swap.state` arrived.
There is no optimistic flip. This is ENGINE-04's central claim and it holds.

#### D-FAILED — the suffix never clears, and no toast ever fires (dev server only)

```
39,388 ms after the label flip, on the dev server (:5173):

  consulting  "consulting | claude-sonnet-5 | pinned default"                    suffix: false   <- CONTROL
  business    "business | claude-sonnet-5 | · switching to Claude Sonnet 5…"     suffix: TRUE
  personal    "personal | anthropic/claude-sonnet-5"                             suffix: false   <- CONTROL

  visible_toasts: []
```

The two unswapped profiles carry no suffix in the same measurement, so this is specific to the
swapped profile — not a global rendering artifact. The stuck suffix also SURVIVED a full socket
reconnect and a fresh `swap.get_state` re-seed.

After a third swap, waiting 7s (the confirm timeout is 4s):

```
  TOASTS: []      <- neither the success toast NOR the 4s "accepted, unconfirmed" warning
```

That is the discriminator: the outcome machine reached NEITHER `confirmed` NOR `accepted`. It never
left `pending`, so `startConfirmTimeout()` was never called and no toast could fire.

**ROOT CAUSE — CONFIRMED by mutation test, not inferred.**

`useProfileSwap.ts:143-149` sets `unmountedRef.current = true` in its unmount cleanup but never
resets it to `false` on (re)mount:

```ts
useEffect(() => {
  return () => {
    unmountedRef.current = true;
    clearConfirmTimeout();
  };
}, []);
```

React `StrictMode` is enabled (`src/main.tsx:42,50`) and in development double-invokes effects
mount→cleanup→remount, latching the ref `true` permanently. Both dispatch continuations then
dead-end at their guard — `useProfileSwap.ts:259` and `:294`:

```ts
if (unmountedRef.current || epochRef.current !== myEpoch) return;   // never reaches setOutcome("confirming")
```

**Control 1 — production build, same code, StrictMode double-invoke absent** (`npm run build` +
`vite preview` on :5199):

```
run 1: t=34369 suffix up (label old) -> t=34603 label flips -> t=38558 toast "business switched to
       Claude Opus 4.8." (success) -> t=38597 SUFFIX CLEARS
run 2: t=113043 suffix up (label old) -> t=113283 label flips -> t=113437 toast "business switched
       to Claude Sonnet 5." (success) -> t=113441 SUFFIX CLEARS  (158 ms after the flip)
```

Run 1's clear landed ~3994 ms after the flip, close enough to the 4000 ms
`PROFILE_SWAP_CONFIRM_TIMEOUT_MS` to suspect the timeout path; run 2 settled in 158 ms, so the fast
readback path is what normally confirms. Run 1's delay was observed once and did NOT reproduce —
recorded as an open observation, not a claim.

**Control 2 — mutation test on the SAME dev server (:5173), StrictMode still on.** One line added,
`unmountedRef.current = false` at the top of the mount effect:

```
t=28709  DOM  "business | claude-sonnet-5 | · switching to Claude Opus 4.8…"   <- suffix up, label old
t=29127  DOM  "business | claude-opus-4-8 | · switching to Claude Opus 4.8…"   <- label flips
t=29623  TOAST success "business switched to Claude Opus 4.8."
t=29627  DOM  "business | claude-opus-4-8 | pinned default"                     <- SUFFIX CLEARS
```

The mutation was reverted immediately after the measurement; `git diff --stat src/hooks/useProfileSwap.ts`
is empty and a grep for the marker comment returns nothing. **No fix is committed by this plan** —
this gate's output is evidence, and the fix belongs in a gap-closure plan.

**VERDICT: FAILED (dev-mode only, mechanism confirmed).**

- What holds: the server-confirmed ordering (no optimistic flip), on every run, in both modes.
- What fails: on the dev server, the swap outcome machine never leaves `pending`, so the
  "· switching to …" suffix never clears and NEITHER the success toast NOR the honest
  "accepted, unconfirmed" warning ever fires. The operator is left with a surface that permanently
  claims a swap is still in flight after it has completed.
- Scope: development builds only. The production bundle is unaffected (Control 1). This still
  matters in practice: CodePulse runs from the Vite dev server on :5173 via the `CodePulseUI`
  autostart task, which is the daily-driver surface.
- Defect class check: `grep -rn "unmountedRef" src/` returns matches in `useProfileSwap.ts` ONLY —
  no sibling instance of this pattern elsewhere in the codebase.

---

## Probes E–H (Task 3)

**Surface used.** Probes E–H were run against the PRODUCTION build served by `vite preview` on
:5199 (`Environment: production` visible in Settings → Connection Status). The dev-mode defect
recorded under Probe D leaves a permanent pending suffix that would contaminate every label reading
here; the production surface is the honest place to measure whether the FEATURE resolves correctly.
The two-override state below was created once and every probe reads from it.

```
$ swap.set value="claude-opus-4-8" restore:false profile_id:"business"       -> ok
$ swap.set value="claude-haiku-4-5-20251001" restore:false                   -> ok   (UNSCOPED = global)

$ swap.get_state
{
  "model_override": "claude-haiku-4-5-20251001",       <- modelC, the GLOBAL
  "model_source": "voice-swap",
  "profile_overrides": {
    "consulting": { "model": "claude-sonnet-5",  "source": "codepulse-scoped-swap" },
    "business":   { "model": "claude-opus-4-8",  "source": "codepulse-scoped-swap" }   <- modelA, the PIN
  }
}
```

SUBJECT = `business`, pinned to modelA `claude-opus-4-8`.
CONTROL = `personal`, UNPINNED (absent from `profile_overrides`), so it must resolve to modelC.

---

### Probe E — D-06, the precedence inversion, with a control on each surface

| # | Surface | SUBJECT `business` (pinned) | CONTROL `personal` (unpinned) |
|---|---|---|---|
| 1 | Header badge | — (bound to the active profile; see note) | **`Claude Haiku 4.5` + `GLOBAL` qualifier** = modelC |
| 2 | Picker, "This profile" scope | **`Claude Opus 4.8`** = modelA | — (scope control below) |
| 3 | Pre-swap confirm modal, current-engine column | **`Claude Opus 4.8`** = modelA | **`Claude Haiku 4.5`** = modelC |
| 4 | Settings row engine label | **`claude-opus-4-8`** = modelA | **`claude-haiku-4-5-20251001`** = modelC |

**Surface 4 + its control, one screenshot, same state:**

```
consulting   claude-sonnet-5             pinned default
business     claude-opus-4-8             pinned default     <- SUBJECT: modelA (the pin), NOT modelC
personal     claude-haiku-4-5-20251001                      <- CONTROL: modelC (the global)
header       Claude Haiku 4.5  GLOBAL
```

**Surface 2, and the control that makes it mean something.** The picker's true current-engine marker
is `isCurrent` → `bg-primary/10` (`BrainPickerRow.tsx:192`), NOT cmdk's `aria-selected`, which
merely tracks the keyboard cursor and sat on the first row. Read from the DOM, exactly one picker
row carried the real marker in each scope:

```
scope = "This profile"  (data-state on)   -> isCurrent marker on: "Claude Opus 4.8"   (modelA, the PIN)
scope = "All profiles"  (data-state on)   -> isCurrent marker on: "Claude Haiku 4.5"  (modelC, the GLOBAL)
```

The marker MOVES with scope in one unchanged two-override state. That is the control: it proves the
marker tracks the resolved value rather than sitting on a fixed row, and it proves the global rung is
not broken — so "the profile shows modelA" cannot be explained by the global rung being dead.

**Surface 3, raw modal text (subject and control in the same payload):**

```
Swap all profiles to Claude Sonnet 5?
3 profiles have a pinned default (Claude Sonnet 5) that will be shadowed while this global override is in force.
  consulting   Claude Sonnet 5    ->  Claude Sonnet 5
  business     Claude Opus 4.8    ->  Claude Sonnet 5      <- SUBJECT: modelA
  personal     Claude Haiku 4.5   ->  Claude Sonnet 5      <- CONTROL: modelC
```

The modal was CANCELLED, not confirmed — no global swap was dispatched from it.

**Note on surface 1.** The header badge renders the ACTIVE profile, so it cannot show SUBJECT and
CONTROL at once. In the two-override state it read `Claude Haiku 4.5` with an explicit `GLOBAL`
qualifier — the correct CONTROL reading for an unpinned active profile, and correctly QUALIFIED
rather than silently presenting a global value as the profile's own.

**A suspected defect investigated and DROPPED.** The modal's warning says "3 profiles have a pinned
default (Claude Sonnet 5)" while only TWO profiles held swap overrides, which looked wrong. It is
correct: `pinnedCount`/`shadowedDefaultNames` derive from each profile's CONFIGURED default
(`GlobalSwapModal.tsx:389-398`, reading `configuredDefault`), not from the swap override, and the
live config confirms all three share one:

```
$ npx convex run profiles:listConfigs --url http://127.0.0.1:3210 --admin-key "..."
  consulting -> modelPreferences.primary = "anthropic/claude-sonnet-5"
  business   -> modelPreferences.primary = "anthropic/claude-sonnet-5"
  personal   -> modelPreferences.primary = "anthropic/claude-sonnet-5"
```

`pinnedCount = 3` and the deduped name `(Claude Sonnet 5)` are both accurate. Recorded rather than
silently dropped, per the zero-false-positive rule.

**VERDICT: PASS.** Every surface that can show the SUBJECT shows modelA (the pin); every control
shows modelC (the global). The pin outranks the global, and the global rung is independently proven
alive in the same measurement.

---

### Probe F — the honest absent state

**VERDICT: PARTIAL — could not be constructed on this stack; NOT rounded up to a pass.**

The probe needs a profile with no telemetry AND no override. After teardown returned the server to
`model_override: null` / `profile_overrides: {}`, all three real profiles carry live telemetry and
therefore render a real value:

```
SERVER: { "model_override": null, "profile_overrides": {} }
consulting   anthropic/claude-sonnet-5
business     anthropic/claude-sonnet-5
personal     anthropic/claude-sonnet-5
```

What CAN be recorded:

- The forbidden fallbacks are absent from the profiles card in this state: `"Auto"` false,
  `"No brain reported"` false. No profile displays another profile's model — each row's value
  matches its own telemetry.
- The exact string `Not reported` WAS observed live on the header badge at gate start, before any
  swap had been dispatched (clean `{}`/`null` state, dashboard screenshot at gate open) — the absent
  state rendering correctly on one surface.

What is NOT proven: the full four-surface reading of `Not reported` for a genuinely telemetry-less
profile. Constructing it requires creating a throwaway profile in the live Ástríðr config, outside
what this session was authorized to mutate. Carried to the gap-closure plan.

---

### Probe G — D-11, `listGlobal` against the live self-hosted instance

**SUBJECT** — after dispatching the real UNSCOPED swap above:

```
$ npx convex run controlVerbSwaps:listGlobal --url http://127.0.0.1:3210 --admin-key "..."
[
  {
    "_creationTime": 1786370644587.1873,
    "_id": "ms7tfm2x8cjw41d88n8fmqxrfn8c7nqx",
    "channel": "codepulse-control-center",
    "path": "claude-native",
    "providerAffinity": ["anthropic_advisor","anthropic_direct","gemini","grok","gemini_openrouter","openrouter"],
    "resolved": "claude-haiku-4-5-20251001",
    "target": "claude-haiku-4-5-20251001",
    "timestamp": 1786370641.10451,
    "verb": "swap_model"
  },
  ... (further rows, none carrying a `scope` field)
]
```

Non-empty, and the top row IS the swap just dispatched (modelC). No row carries a `scope` field —
these are the unscoped rows the query is meant to match.

**CONTROL — mandatory, same session, same instance:**

```
$ npx convex run controlVerbSwaps:listByScope '{"profileId":"business"}' --url http://127.0.0.1:3210 --admin-key "..."
[
  {
    "_creationTime": 1786370644574.2788,
    "_id": "ms7n6ngxwbxp3y8hz0a4pc6wm98c66se",
    "resolved": "claude-opus-4-8",
    "scope": "business",                          <- carries scope; listGlobal's rows do not
    "target": "claude-opus-4-8",
    "timestamp": 1786370641.1027298,
    "verb": "swap_model"
  },
  ...
]
```

**Unit sanity, so no recency claim passes vacuously:**

```
_creationTime 1786370644587 as ms       -> 2026-08-10T14:04:04.587Z
timestamp     1786370641.10 as seconds  -> 2026-08-10T14:04:01.104Z
today is                                   2026-08-10T14:08:14.112Z
```

Both land ~4 minutes before the read — these are this session's own dispatches. `_creationTime` is
epoch MILLIseconds, `timestamp` is epoch SECONDS.

**VERDICT: PASS.** The phase's highest-risk item, and the control did real work: the two queries
return disjoint, correctly-shaped row sets (`scope` absent vs `scope: "business"`) from the same
explicitly-targeted `127.0.0.1:3210` instance with the same admin key. A wrong `null`/`undefined`
choice, a wrong backend, or a bad key would each have produced `[]`, and the known-present control
makes that indistinguishable-empty outcome impossible to misread as "no global swaps yet".

---

### Probe H — D-10/D-12, the combined history on screen

Settings → `business` → "Swap history" expanded (`aria-expanded: true` asserted, not assumed).

**With the pin in force:**

```
Swap history (17)
This profile is pinned — global swaps below did not change its engine.
10:04 AM | GLOBAL | claude-haiku-4-5-20251001 → claude-haiku-4-5-20251001 | Switched   <- Probe G's global row, MARKED
10:04 AM |          claude-opus-4-8 → claude-opus-4-8                     | Switched   <- business's own scoped row, UNMARKED
09:59 AM |          claude-opus-4-8 → claude-opus-4-8                     | Switched
09:48 AM |          — → —                                                | Restored
02:11 PM | GLOBAL | — → —                                                | Restored
...
Showing 17 swaps (per-profile + global).

count badge: 17     rendered rows: 17     marked GLOBAL: 8     unmarked scoped: 9   (8 + 9 = 17)
```

**The pinned-note contrast — this probe's absence proof.** Clearing ONLY the pin, disclosure left open:

```
BEFORE  badge 17 | 17 rows | 8 GLOBAL | pinned note PRESENT | engine label claude-opus-4-8
AFTER   badge 18 | 18 rows | 8 GLOBAL | pinned note ABSENT  | engine label claude-haiku-4-5-20251001
        new top row: 10:09 AM | — → — | Restored
        caption: "Showing 18 swaps (per-profile + global)."
SERVER after: profile_overrides = { "consulting": {...} }   (business gone), model_override unchanged
```

The note DISAPPEARED while the rows REMAINED and in fact grew by the restore's own row. That
contrast proves the note is derived live from the override state rather than reconstructed from the
history rows — had it been reconstructed, rows that still exist would have kept it on screen. As a
bonus, the engine label fell through from the pin to the GLOBAL override the moment the pin cleared,
which is Probe E's precedence chain observed from the other direction.

**Count accuracy:** the badge equals the rendered row count exactly (17→17, 18→18), and the caption
states the composition (`per-profile + global`) rather than letting a truncated list look complete.

**VERDICT: PASS.**

**Measurement error caught and corrected, recorded for honesty.** A first attempt at this contrast
selected the FIRST `Swap history (…)` button on the page — `consulting`'s, which was collapsed — and
reported `rows: 0, pinned_note: false` for both readings. That "before" contradicted the 17-row
reading taken moments earlier, which is what exposed it. The measurement was redone with a selector
scoped strictly to the `business` block. The invalid numbers are used nowhere above.

---

## Teardown — live routing state returned to baseline

```
$ swap.set restore:true                          (global)      -> ok
$ swap.set restore:true profile_id:"consulting"                -> ok
$ swap.set restore:true profile_id:"business"                  -> ok  (during Probe H)

$ swap.get_state
{ "model_override": null, "profile_overrides": {} }
```

Identical to the baseline captured before any probe ran. Every swap this gate dispatched has been
reverted; nothing was left pinned.

---

## Per-requirement verdicts

| Requirement | Verdict | Supported by |
|---|---|---|
| **ENGINE-03** | **SATISFIED** | Probe A (D-03 `default_profile_id` on the live ack); Probe E (D-06 precedence proven on every available surface, each against a control showing the opposite); Probe B (per-profile override map present and correct on the wire) |
| **ENGINE-04** | **SATISFIED WITH ONE DEFECT OUTSTANDING** | Central claim PASSES: Probe D shows the label held its old value and changed only 272 ms / 364 ms AFTER the ack, on two instrumented runs — server-confirmed, never optimistic. Probes B/C prove the confirm and restore reads on the wire, the restore's absence carrying a same-payload control. Probe D's negative control shows an honest server-named error with nothing written. OUTSTANDING: on dev builds the outcome machine never leaves `pending`, so the pending suffix never clears and neither toast fires (root cause confirmed by mutation test; production unaffected). |
| **TELE-02** | **SATISFIED** | Probe G (`listGlobal` returns real unscoped rows from the self-hosted instance, proven against a known-present scoped control); Probe H (combined history renders with correct `GLOBAL` marking, a true count badge, and a live-derived pinned note proven by its present-then-absent contrast) |

**Probe scoreboard:** A PASS · B PASS · C PASS · D PASS on the central claim, FAILED on the clear
leg · E PASS · F PARTIAL (not constructible on this stack, not rounded up) · G PASS · H PASS.

**What must not be read into this.** ENGINE-04's requirement text is about server-confirmed rather
than optimistic updates, and that specific property is proven. The outstanding defect is in the
pending-state teardown surrounding it, and it is dev-only — but dev is the daily-driver surface
here, so it is real work, not a footnote.

## Gap-closure items for a follow-up plan

1. **`useProfileSwap` never resets `unmountedRef` on remount** (`useProfileSwap.ts:143-149`) — the
   confirmed root cause of Probe D's failure. Fix is one line plus a regression test that fails
   without it; the test must span the StrictMode mount→cleanup→remount boundary, since a
   single-mount test passes either way.
2. **Probe F left PARTIAL** — needs a telemetry-less profile to prove the `Not reported` absent
   state across all four surfaces.

## Operator sign-off

**ENGINE-03 — SATISFIED.** Supported by Probe A (`default_profile_id` read off the live ack), Probe
E (D-06 precedence proven on every surface that can show the subject, each against a control that
showed the opposite in the same state), and Probe B (the per-profile override map correct on the
wire).

**TELE-02 — SATISFIED.** Supported by Probe G (`listGlobal` returning real unscoped rows from the
self-hosted instance against a known-present scoped control) and Probe H (combined history with
correct `GLOBAL` marking, a badge equal to the true rendered row count, and a pinned note proven
live-derived by its present-then-absent contrast).

**ENGINE-04 — HELD PENDING.** Its central claim — server-confirmed rather than optimistic — is
proven twice over by Probe D, and Probes B/C/D-negative all pass. It is NOT marked satisfied because
Probe D's clear leg is a recorded FAILURE with a confirmed root cause. Nothing is marked satisfied
while a probe for it is failing. ENGINE-04 is unblocked by plan 109-10 (gap closure), after which it
should be re-verified against Probe D and signed separately.

`Operator sign-off: Larry Mandras, 2026-08-10` — recorded by the executing agent under the
operator's explicit authorization given in-session on 2026-08-10, per this plan's own
"the operator does, or explicitly authorizes it". The authorization covered signing ENGINE-03 and
TELE-02 while holding ENGINE-04 pending, exactly as written above.

---

# 109-10 re-verification

Run 2026-08-10 after the `unmountedRef` fix (`fix(109-10)`, commit `a3a1e681`).

## Probe D re-run — on the DEV server (`:5173`), where it originally failed

A production-build pass would prove nothing here: 109-09 established production was never affected.
Settings → Connection Status read `Environment: development` for this run.

Same instrumentation recipe as 109-09: a patched `WebSocket` capturing every frame plus a DOM
observer on the profile row, both stamped from ONE `performance.now()` origin. The instrument was
proven live before use, rather than assumed:

```
LIVENESS PROBE for the instrument itself (a read that MUST appear in the log):
  frames_before: 0
  frames_after:  2
  instrument_is_live: true
  sample: [ {t:95468, dir:"SEND", type:"swap.get_state"},
            {t:95471, dir:"RECV", type:"ack", status:"ok"} ]
```

Swap driven through the real Settings picker (`business` → Claude Sonnet 5), never a raw dispatch:

```
t=108063  DOM    business | claude-opus-4-8 | · switching to Claude Sonnet 5…   <- suffix up, label STILL OLD
t=108117  WS RECV ack status=ok
t=108383  WS RECV control_verb_swap
t=108383  WS RECV swap.state
t=108743  DOM    business | claude-sonnet-5 | · switching to Claude Sonnet 5…   <- label flips, 626 ms AFTER the ack
t=109458  DOM    business | claude-sonnet-5 | pinned default                    <- SUFFIX CLEARS
t=109463  TOAST  success: "business switched to Claude Sonnet 5."
```

| Leg | Before the fix (109-09) | After the fix |
|---|---|---|
| suffix appears, base label holds its OLD value | PASS | **PASS** |
| base label updates only AFTER the ack | PASS (272/364 ms) | **PASS (626 ms)** |
| suffix CLEARS | **FAILED — never cleared** | **PASS (t=109458)** |
| success toast fires | **FAILED — no toast ever** | **PASS (t=109463)** |

An earlier attempt in the same session produced the same four legs but with an empty frame log — the
socket was already open before the patch was installed, so that run carried no ack timestamp and
could not support the "only AFTER the ack" claim. It was discarded and re-run with a forced
reconnect rather than reported with a gap.

**VERDICT: PASS.** The defect that failed Probe D at the 109-09 gate is fixed and verified live on
the exact surface where it failed.

## Probe F — BLOCKED, not attempted-and-passed

Probe F could not be run. Clicking into the Agent Profiles area to create a throwaway
telemetry-less profile left the page's JS thread unresponsive: every `computer`/`javascript_tool`
call returned `Script injection timed out after 5000ms`, persisting past a 12 s wait, while the tab
itself remained present at the correct URL.

Server side was healthy throughout, so the condition is confined to the page:

```
vite 5173: 200    astridr 8181: 200    convex 3210: 200
astridr-agent  Up 53 minutes (healthy)
convex-backend Up 9 hours (healthy)
```

**A wrong diagnosis of my own, recorded rather than quietly dropped.** On the first occurrence I
attributed the freeze to my own instrumentation — a `MutationObserver` on `document.body` whose
callback re-ran a whole-document `querySelectorAll` plus `innerText` (which forces layout) on every
mutation. That was a plausible mechanism and it was WRONG: after a reload removed the observer
entirely, the freeze reproduced. The cause is not yet established, and no claim is made here about
whether it is a CodePulse defect, a dev-server/HMR condition, or something in the Radix Sheet the
"New Profile" control opens. It needs its own investigation with the operator present.

**Probe F therefore remains PARTIAL, exactly as 109-09 left it. It is not rounded up.**

## Requirement status after this run

**ENGINE-04 — still NOT signed.** Its Probe D leg now passes live, which was the blocking failure,
but 109-10's Task 2 acceptance also requires Probe F. Signing now would repeat precisely the pattern
this gate exists to prevent: marking a requirement satisfied while one of its probes has not been
run. The signature belongs in a follow-up once Probe F is unblocked.

## Outstanding at the end of this run

- Live routing is NOT at baseline: `business` is pinned to `claude-sonnet-5` from the Probe D
  re-run. `consulting` and `personal` are clear. This needs a scoped restore once the page is
  usable again.
- The page freeze above needs diagnosis before Probe F can be attempted.
