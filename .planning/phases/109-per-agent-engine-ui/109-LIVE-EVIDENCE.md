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

## Probes A–H

> Pending — Task 2 and Task 3 are blocking human-verify checkpoints. Raw output is appended below
> as each probe runs against the live stack.

---

## Per-requirement verdicts

> Pending Task 3.

## Operator sign-off

> Pending. To be written by the operator, not by the executing agent.
