# Phase 108: Per-Profile Engine Telemetry (astridr backend) - Research

**Researched:** 2026-08-07
**Domain:** Cross-repo telemetry plumbing (Python `contextvars` + FastAPI WS commands) and Convex ingest/retention (TypeScript)
**Confidence:** HIGH (every claim below is `file:line`-cited against the live `feature/brain-swap` checkout at commit `645e8f8336bafd25d8b3f61dbb8a6b4b6e1d56ba`, 2026-08-07, and the live `codepulse` checkout; the CONTEXT.md branch pointer of `0d23f06e` has since advanced to `645e8f8` — no line-number drift found on any cited router.py/swap_model.py/swap_voice.py location except SwapSetCommand, noted below)

## Summary

CONTEXT.md's 16 decisions are correct in design intent and are NOT re-litigated here. This research answers the 10 items the discussion deliberately left open, by reading the live code, and it surfaces one **major scope-reducing finding** that changes how D-01 should be implemented: **a `contextvars.ContextVar` carrying the exact tenant/operational profile ID (personal/business/consulting) already exists** — `_current_profile_id` (`astridr/engine/telemetry.py:95`), with a working `set_profile_context()`/`get_profile_context()` pair (`telemetry.py:670-686`), **already set on every message** at `astridr/channels/agent_processor.py:117` (`set_profile_context(profile.id)`), downstream of profile resolution and upstream of the `ModelRouter.chat()` call chain. D-01 does not need to invent a new ContextVar — `providers/router.py` just needs to start **reading** one that already exists. The one real defect in that existing mechanism: **`reset_profile_context()` is never called anywhere in the repo** (a genuine latent leak, unlike the properly try/finally-reset `_current_goal_id`/`_current_trace_id`/`_current_round` siblings) — this phase's plan must add the missing reset, because D-02's "no profile in context → refuse to emit" guarantee depends on it being reliably `None` between unrelated invocations.

A second load-bearing finding: `D-01`'s cited set-point, `astridr/engine/profile_manager.py:105`, is **dead code in production** — `astridr.engine.profile_manager.ProfileManager` is imported only by its own test file (`tests/unit/engine/test_profile_manager.py:10`) and a planning doc; it is never instantiated by `bootstrap/core.py` or any live channel path. The actual live profile-resolution method is a *different* class's *same-named* method, `ChannelRouter.resolve_profile` (`astridr/channels/router.py:1047-1090`), called from `_route_locked` (`astridr/channels/router.py:528-547`). This doesn't invalidate D-01's design — it corrects which file the plan should touch.

Third: D-05's `SwapSetCommand` extension has a wiring gap CONTEXT.md doesn't mention — `ControlVerbContext` (`astridr/engine/control_verbs/registry.py:38-51`) is a frozen dataclass with exactly `session_id`, `channel`, `telemetry` — no profile field, and `_handle_swap_set` (`astridr/api/ws_commands.py:1075-1123`) always constructs it with `session_id=None`. The new scope/`profile_id` must travel through the existing `args: dict[str, str]` parameter (the same shape a spoken utterance already produces), not through `ControlVerbContext` — this is a concrete, minimal-diff answer, not an open question, once you read `_handle_swap_set`'s body.

**Primary recommendation:** Reuse `_current_profile_id`/`get_profile_context()` for the ContextVar half of D-01/D-04 (read-only, at the emit and resolve call sites in `providers/router.py`); add the missing `reset_profile_context()` call at the `agent_processor.py:117` set-point in a try/finally; thread the new `swap.set` scope field through `args["profile_id"]`, not `ControlVerbContext`; store all 6 `control_verb_swap` emit sites in one new Convex table keyed by the existing `verb`/`path`/`reason` fields plus a new `scope`/`profileId` field.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile identity propagation to the LLM routing layer | API/Backend (astridr Python process) | — | `ModelRouter.chat()` has no request object; only `contextvars` reaches across the provider-layer boundary from the message-intake tier |
| Per-profile model override storage | API/Backend (astridr, in-process memory) | — | Mirrors `_global_model_override` (`router.py:118`) — runtime-only, no persistence, no separate service |
| `swap.set` scoped dispatch | API/Backend (astridr WS command layer) | — | Single dispatch path through `VERB_REGISTRY` (D-05); no new endpoint |
| `model_routing` / `control_verb_swap` telemetry transport | API/Backend (astridr) → CDN/Static N/A → Database/Storage (Convex) | — | Existing `/runtime-ingest` HTTP path; no new ingest endpoint |
| `activeEngineSnapshots` / new swap-history table | Database/Storage (Convex, self-hosted) | — | Append-only, retention-bounded, read via bounded `.take()` queries |
| Swap-history readout | Frontend Server/Client (React, `GlobalSwapModal.tsx`) | Database/Storage (Convex `query`) | D-15 hosts it in an existing client component; no new route |
| Live integration proof (ENGINE-05) | Operator tooling (docker CLI + `npx convex run` against self-hosted backend) | — | No CI path exists for this stack (self-hosted, single node) |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions (D-01 through D-16 — not re-litigated; see 108-CONTEXT.md for full text)

- **D-01:** `contextvars.ContextVar` set at the loop boundary (near `resolve_profile`), carries profile to `_emit_model_routing` and `_resolve_model`. Rejected: threading `profile_id` through every `chat()` call; resolving from `session_id` at emit time.
- **D-02:** No profile in context → refuse to emit (no `model_routing` row at all). Cron/subagents/background sweeps stay silent on this axis.
- **D-03:** Boot seeds one `model_routing` event per profile, `mode:"inherited"`, at the existing `bootstrap/core.py:1343-1359` `config.profiles` loop.
- **D-04:** Same ContextVar drives a new per-profile override inserted ABOVE the global override in `_resolve_model`'s precedence chain. No profile in context = byte-identical to today.
- **D-05:** Extend `SwapSetCommand` with an optional profile scope (not a separate `gateway.model.set` command). One dispatch path.
- **D-06:** Per-profile override is runtime-only, no TTL, mirrors the global axis. `mode:"session"`/`expiresAt` deferred, not built.
- **D-07:** A spoken swap stays GLOBAL; only an explicit scope on `swap.set` is per-profile.
- **D-08:** `103-CONTRACT.md` corrected in place (§1 status table, §2 command shape) as a Phase 108 deliverable, same commit as code.
- **D-09:** Emit-on-change (astridr-side, per-profile last-emitted dedup) plus D-03's boot seed. No per-resolution emit, no ingest-side dedup.
- **D-10:** `activeEngineSnapshots` added to `RETENTION_DAYS` this phase.
- **D-11:** astridr renames `selectedModel` → `model`. Required pre-check: grep for other consumers; if found, dual-emit for one release.
- **D-12:** `mode` derived from `selection_path` at the single emit helper: per-profile/global override → `"pinned"`, session override → `"session"`, everything else → `"inherited"`.
- **D-13:** All six `control_verb_swap` emit sites stored, with an outcome/scope field. Refusals stored, not just successes.
- **D-14:** One table for brain AND voice swaps, discriminated by the existing `verb` field. New table gets a `RETENTION_DAYS` entry too.
- **D-15:** Minimal readout is a swap-history section inside the existing `GlobalSwapModal`. No new route.
- **D-16:** Proof is a live scoped swap read back from Convex ROWS (not UI), including an unscoped control.

### Claude's Discretion (this research's primary agenda — see body below for resolutions)

- Restore semantics when both overrides are live (derived from D-04's precedence — resolved in Item 7 below).
- Exact ContextVar set-point, subagent inheritance, task/thread boundary behavior (resolved in Item 1 below — **and the set-point itself has moved from CONTEXT.md's citation, see ⚠ Decision Conflicts**).
- Retention windows for `activeEngineSnapshots` and the new swap-history table (resolved in Item 4 below).
- New table name and exact schema/indexes for `control_verb_swap` (resolved in Item 3 below).
- Whether `status="failed"` emit should write a snapshot row (resolved in Item 6 below).
- Bounding/pagination of the swap-history readout query (resolved in Item 3 below — `.take()`-bounded, matching `latestByProfile`'s 200-row precedent).
- Auth tier for the new `swap.set` scope field (resolved in Item 8 below — no change, stays service-key tier).

### Deferred Ideas (OUT OF SCOPE — do not build)

- Session-mode swaps with a TTL (`mode:"session"`, `activeEngineSnapshots.expiresAt`).
- `gateway.model.set` as a distinct command.
- Voice swap history as a surfaced UI feature (rows captured, not shown — D-15 filters to brain).
- `brain.fallback` telemetry (103-CONTRACT.md §5).
- Auto-scoping a spoken swap by channel profile.
- Rendering the global/per-profile disagreement (103-CONTRACT.md §9) — Phase 109+.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | Per-profile active-engine telemetry, real `profileId`+model, refuse-to-emit on unresolved | Items 1, 2, 5, 6 — reuse `_current_profile_id`, fix missing reset, rename `selectedModel`→`model`, exclude `status="failed"` from snapshot writes |
| ENGINE-02 | `swap.set` accepts profile scope; unscoped stays byte-identical | Items 1, 3, 7, 8 — scope travels via `args["profile_id"]`, not `ControlVerbContext`; restore semantics derived; auth tier unchanged |
| ENGINE-05 | Live integration gate, before Phase 109 UI depends on it | Item 9 — full verified command sequence, including the unscoped control |
| TELE-02 | `control_verb_swap` routed to a domain table + minimal readout | Items 3, 4 — table schema from the 6 verified emit sites + `docs/astridr-contract.md:1192-1214`'s existing field contract; retention window |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

### codepulse CLAUDE.md
- Self-hosted Convex: **never** `npx convex import --replace-all`; **never** bulk-delete/bulk-patch a large table on the live instance — retention-style deletes stay batch-capped (`convex/retention.ts`'s `BATCH_SIZE=200`/`MAX_BATCHES_PER_NIGHT=600` pattern, matched by `activeEngine.ts`'s `pruneUnresolved`). The new swap-history table's retention entry must follow the same batch-capped cursor-seeked prune, not a new bespoke sweep.
- All `fetch()` calls to the Ástríðr backend require `Authorization: Bearer` via `authHeaders()` — not directly relevant to this phase's astridr-side work, but the D-16 live-proof WS client must carry the equivalent bearer/service-key auth (see Item 9).
- graphify: prefer `graphify query`/`graphify explain` over raw grep for codepulse architecture questions. (Used where practical; targeted `Read`/`grep` against exact `file:line` citations was used for verification-grade precision per the evidence-discipline constraint — a graph traversal cannot substitute for an exact line citation.)

### astridr-repo CLAUDE.md
- Rebuild command is mandatory-profiles: `COMPOSE_PROFILES=prod,war-room docker compose up --build -d`. Confirmed live (`docker-compose.yml:315-339`): the `astridr` service (`container_name: astridr-agent`) carries **no** `profiles:` key — it is one of the 12 unprofiled services and is always rebuilt by this command regardless of the profile flags, but the flags are still required for the 5 war-room agents + `notebooklm-mcp` this exact command family also rebuilds.
- `structlog` for all logging; all file writes through `engine/atomic_io.py`; `async/await` everywhere, no blocking I/O — not directly implicated by this phase's changes (no new file writes, no new sync I/O).
- Telemetry: "All events follow shapes defined in `docs/astridr-contract.md`... Use `ConvexHandler.send(event_type, data)` — never direct HTTP." `docs/astridr-contract.md:1192-1214` already documents `control_verb_swap`'s exact field contract (see Item 3) — this phase's schema should match it field-for-field, and `model_routing` (not yet documented in that file — confirmed absent, see Item 2/D-11 grep below) should gain an entry as part of this phase's astridr-side deliverable (not explicitly required by ENGINE-01/TELE-02's wording, but consistent with the "contract must match reality" principle D-08 already applies to `103-CONTRACT.md`).

## ⚠ Decision Conflicts Found

None of D-01 through D-16 are impossible as written. Two citations drift from the live line numbers / files, and one existing mechanism supersedes part of D-01's stated precedent — flagged here per the loud-disclosure rule, not silently substituted:

1. **D-01's set-point citation is dead code.** `astridr/engine/profile_manager.py:105` (`resolve_profile`) is real code at that exact line, but `astridr.engine.profile_manager.ProfileManager` is instantiated **only** in `tests/unit/engine/test_profile_manager.py:10` and referenced in one planning doc (`188.3-PATTERNS.md`) — zero production imports (`grep -rn "from astridr\.engine\.profile_manager import" astridr/ tests/` → 1 hit, the test file). The live profile-resolution path is `astridr.channels.router.ChannelRouter.resolve_profile` (`astridr/channels/router.py:1047-1090`), called from `_route_locked` (`astridr/channels/router.py:528-547`), backed by `astridr.agent.profiles.ProfileManager` (a *different, unrelated* class — persona/system-prompt overlays, not tenant routing) instantiated at `astridr/engine/bootstrap/core.py:906`. **Effect on the plan:** no design change — just point the "set-point neighbourhood" language at `channels/router.py`/`channels/agent_processor.py` instead.
2. **A ContextVar already exists that does exactly what D-01 asks for.** `_current_profile_id` (`astridr/engine/telemetry.py:95`), `set_profile_context()`/`get_profile_context()`/`reset_profile_context()` (`telemetry.py:670-686`), added Phase 171 (ROUTE-01) specifically to carry "the active OPERATIONAL profile id (personal/business/consulting)" to globally-registered tools. It is set on **every message** at `astridr/channels/agent_processor.py:117` (`set_profile_context(profile.id)`), which runs downstream of `_route_locked`'s profile resolution (line 532) and upstream of `self._agent_loop.process(...)` (line 120), which is upstream of `ModelRouter.chat()`. **Effect on the plan:** D-01 should read this existing ContextVar (`get_profile_context()`) from `providers/router.py`'s `_resolve_model`/`_emit_model_routing` rather than create a second, parallel ContextVar. This is not a conflict with D-01's DESIGN (still "a ContextVar set at the loop boundary") — it changes the plan's task list from "add a new ContextVar" to "read an existing one and fix its missing reset" (see Item 1).
3. **D-05's citation `ws_commands.py:235-247` is the field body, not the class.** `SwapSetCommand` the class starts at `ws_commands.py:224`; its three fields (`target`, `value`, `restore`) sit at `:237-239`; the class block runs `:224-240`. Minor — same location, off-by-a-few on the exact line range. No design impact.

## Item 1 — ContextVar Set-Point, Propagation, and Subagent Inheritance (D-01, D-04)

**Set-point (concrete, verified):** `astridr/channels/agent_processor.py:117`, inside `AgentProcessor.process()`. Order within one message turn:

1. `_route_locked` (`astridr/channels/router.py:528-547`) resolves the profile via `self.resolve_profile(...)` → `ChannelRouter.resolve_profile` (`channels/router.py:1047-1090`, 4-tier resolution: explicit `raw.profile_id` → `channel_mappings` → `default_for` → `channels` list).
2. `_route_locked` calls `self._process_and_reply(...)`, which at `channels/router.py:1412` calls `self._agent_processor.process(text, message, session, profile)`.
3. `AgentProcessor.process` sets `agent_session.active_profile = profile.id` then **`set_profile_context(profile.id)`** at `agent_processor.py:116-117` — this is the existing, live, correctly-ordered set-point.
4. `AgentProcessor.process` then calls `await self._agent_loop.process(user_msg, agent_session)` (`agent_processor.py:120`), which eventually reaches `ModelRouter.chat()`.

**`get_profile_context()` reads `None` by default** — `_current_profile_id = contextvars.ContextVar("telemetry_profile_id", default=None)` (`telemetry.py:95`, confirmed by the identical pattern on the four sibling ContextVars at `:79-93`).

**Recommendation:** `providers/router.py`'s `_resolve_model` and `_emit_model_routing` should `from astridr.engine.telemetry import get_profile_context` and call it directly — no new ContextVar, no new set-point. This is the single largest scope reduction this research found.

**`asyncio.create_task` children:** confirmed by direct code read (not just "language semantics"). `spawn_supervised_task` (`astridr/engine/task_supervisor.py:45-61`) is a thin wrapper over `asyncio.create_task(coro, name=name)` — no thread hop. `SubAgentManager.spawn` (`astridr/automation/subagents.py:166-233`) internally does `await asyncio.wait_for(self._execute(config), timeout=...)` (`subagents.py:246`), which creates an `asyncio.Task` via `ensure_future` but stays in-process, no thread. Both inherit whatever `contextvars.Context` was active at the moment of task creation (Python's documented `asyncio.Task`/`ensure_future` behavior: `contextvars.copy_context()` at construction).

**Thread boundaries — verified, none exist in the `chat()` hot path.** Grepped `astridr/` for `asyncio.to_thread`/`run_in_executor`/`ThreadPoolExecutor`: all ~50 hits are in unrelated subsystems (`memory/*.py` embedding encode, `media/*.py` file I/O, `tools/google_workspace.py`, `security/audit_logger.py`, `automation/dep_scanner.py`, `channels/voice.py`) — **zero** in `providers/router.py`, `providers/base.py`, or the `_resolve_model`/`_emit_model_routing`/`chat()` call chain itself. No thread hop exists between the `set_profile_context` set-point and the emit/resolve read sites — the profile ContextVar propagates cleanly.

**Subagent spawn — resolved without special-casing.** Grepped all 5 `.spawn(` call sites (`automation/queen.py:531`, `automation/wakeup_runner.py:221`, `automation/teams.py:427`, `tools/delegate_task.py:456` — all direct `await self._manager.spawn(config)`, same task/context as caller; `automation/agent_factory/lifecycle.py:100` — `loop.create_task(self._sub_agent_mgr.spawn(config))`, still context-copying, no thread). Two behaviors, both correct without new code:
- **`delegate_task` tool called mid-turn** (during an active, profiled `_route_locked` call): the subagent's task is created while `_current_profile_id` is set to the user's actual profile — it correctly inherits that profile. This is desirable, not a violation of D-02 (a delegated subtask working on behalf of profile X's live request should attribute to X).
- **`WakeupRunner`/`Queen` background/cron paths**: `WakeupRunner._fire_one` (`automation/wakeup_runner.py:117-130`) and `QueenOrchestrator.run_goal`/`decompose_goal` (`automation/queen.py:235,419,728`) already carry `profile_id` as an **explicit parameter** (row data / caller-supplied), NOT from the ContextVar — and neither calls `set_profile_context()` anywhere (confirmed: only one call site in the whole repo, `agent_processor.py:117`). Any `chat()` call nested inside these paths runs with `get_profile_context() is None` (assuming the missing-reset bug is fixed — see below), so D-02's refuse-to-emit fires automatically. No special-case code needed.

**The one real defect to fix as part of this phase:** `grep -rn "reset_profile_context(" astridr/ tests/` returns **zero** call sites (vs. `reset_goal_context`/`reset_trace_context`/`reset_round_context`, all called in `finally:` blocks at their respective set-points, e.g. `channels/router.py:508-525`'s `_goal_token = set_goal_context(...)` / `finally: reset_goal_context(_goal_token)`). Today this is likely low-impact only because each inbound message is processed in its own freshly-created `asyncio.Task` (e.g. `whatsapp.py:226`, `telegram_webhook.py:79` both `asyncio.create_task` per message) — each such task gets its own copied `Context`, so setting `_current_profile_id` inside message A's task cannot leak into message B's *separate* task. But **once `providers/router.py` starts reading this ContextVar for telemetry/resolution (this phase's whole point), the missing reset becomes load-bearing**: any code path that reuses the SAME task/coroutine across more than one profiled and unprofiled unit of work (long-running consumer loops, retried calls, or a future change to task-per-message granularity) would silently misattribute. **Recommendation: add `_profile_token = set_profile_context(profile.id)` / `finally: reset_profile_context(_profile_token)` around the scope of `agent_processor.py`'s `process()` method**, matching the `set_goal_context`/`reset_goal_context` idiom exactly. This is a small, necessary addition to D-01/D-02's correctness, not scope creep — call it out explicitly in the plan.

## Item 2 — `selectedModel` → `model` Rename Grep (D-11, mandatory)

**Commands run and full hit lists (both empty of blocking consumers):**

```
$ grep -rn "selectedModel" --include="*.py" --include="*.ts" --include="*.md" . | grep -v ".git/"     # from astridr-repo root
./.planning/phases/185-voice-control-verbs-brain-hot-swap-wardrobe/185-PATTERNS.md:127   (planning doc, historical)
./.planning/phases/185-voice-control-verbs-brain-hot-swap-wardrobe/185-RESEARCH.md:70    (planning doc, historical)
./astridr/providers/router.py:413                                                        (the producer itself)
./docs/astridr-contract.md:1175                                                          (astridr's OWN contract doc — see below)
./tests/unit/providers/test_router.py:664,686,703,719                                    (4 test assertions on payload["selectedModel"])
```

```
$ grep -rn "selectedModel" --include="*.ts" --include="*.tsx" --include="*.md" .    # from codepulse root, excluding node_modules/.git
./.planning/phases/108-per-profile-engine-telemetry-astridr-backend/*.md    (this phase's own planning docs, discussing the gap)
./.planning/STATE.md                                                        (progress narrative, discussing the gap)
./src/hooks/useResolvedBrain.ts:208                                         (a CODE COMMENT documenting the known gap, not a live consumer)
```

**No dashboard, log parser, other telemetry consumer, or war-room agent reads `selectedModel`.** The rename can proceed directly — D-11's dual-emit fallback is not needed.

**One consumer CONTEXT.md's grep search missed: `docs/astridr-contract.md:1175`** documents `selectedModel` as the CURRENT/correct field name in astridr's own telemetry contract doc (a `model_routing`-adjacent table — the file does not yet have a dedicated `### model_routing` section; `grep -n "model_routing" docs/astridr-contract.md` returns only this one table-row hit at :1175, confirming `model_routing` itself is undocumented in this file today, consistent with `185-RESEARCH.md:70`'s earlier finding). **This doc line must be corrected in the same commit as the rename** (same principle as D-08's `103-CONTRACT.md` fix — an astridr-native contract doc describing a field name the code no longer sends is the identical defect class).

**Also needs updating (not blocking, but required for a green test suite post-rename):** `tests/unit/providers/test_router.py:664,686,703,719` — 4 assertions on `payload["selectedModel"]`.

## Item 3 — `control_verb_swap` Domain Table (D-13, D-14)

**All 6 emit sites read directly, exact payload per site:**

| Site | File:line | `verb` | Fields present | Fields absent |
|------|-----------|--------|-----------------|----------------|
| restore | `swap_model.py:444` | `"swap_model"` | `target:null, resolved:null, provider_affinity:null, path:"restore", session_id, channel` | `reason` |
| unresolved | `swap_model.py:472` | `"swap_model"` | `target, resolved:null, provider_affinity, path:outcome.path, reason:outcome.reason, session_id, channel` | — |
| affinity-refused | `swap_model.py:483` | `"swap_model"` | `target, resolved (non-null), provider_affinity:null, path:"refused", reason:"affinity_guard", session_id, channel` | — |
| success | `swap_model.py:495` | `"swap_model"` | `target, resolved, provider_affinity, path:outcome.path, reason:outcome.reason, session_id, channel` | — |
| restore | `swap_voice.py:211` | `"swap_voice"` | `target:null, resolved:null, voice_id:null, path:"restore", session_id, channel` | `provider_affinity`, `reason` |
| success/unresolved (single site, before the handled check) | `swap_voice.py:232` | `"swap_voice"` | `target, resolved:outcome.name, voice_id:outcome.voice_id, path:outcome.path, session_id, channel` | `provider_affinity`, `reason` |

This matches `docs/astridr-contract.md:1192-1214`'s existing documented contract for this event **exactly** (that doc's own field table already lists `verb`/`target`/`resolved`/`provider_affinity`/`voice_id`/`path`/`reason`/`session_id`/`channel` with the correct swap_model-only vs swap_voice-only annotations) — this phase's Convex schema should mirror it field-for-field, adding only the new scope column.

**Recommended Convex table** (name: `controlVerbSwaps`, modeled on `activeEngineSnapshots` (`schema.ts:2062-2072`) and `toolPolicyEvents`'s comment style):

```typescript
// convex/schema.ts — new table, TELE-02/D-13/D-14
// Per-profile swap-history audit trail: astridr/engine/control_verbs/swap_model.py and
// swap_voice.py emit one row per swap attempt (restore/unresolved/refused/success) —
// this table stores every one, discriminated by `verb`, so a refusal is queryable, not
// just a spoken/toast-only notice (D-13). One table for brain+voice (D-14) — the readout
// filters to verb:"swap_model" for the D-15 GlobalSwapModal history section; voice rows
// are captured but not yet surfaced (deferred).
controlVerbSwaps: defineTable({
  verb: v.string(),                    // "swap_model" | "swap_voice"
  target: v.optional(v.string()),      // raw utterance/tag target; absent on restore
  resolved: v.optional(v.string()),    // resolved model id (swap_model) or voice display name (swap_voice)
  providerAffinity: v.optional(v.string()),  // swap_model only
  voiceId: v.optional(v.string()),     // swap_voice only
  path: v.string(),                    // "claude-native" | "openrouter" | "refused" | "restore" | "swap"
  reason: v.optional(v.string()),      // swap_model refusal discriminator only
  scope: v.optional(v.string()),       // NEW this phase: explicit profileId when D-05's scope was set, absent/null when global
  sessionId: v.optional(v.string()),
  channel: v.string(),
  timestamp: v.float64(),
})
  .index("by_scope", ["scope", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```

`scope` is the field D-13 asks for ("the explicit `profile_id` when scoped, null when global") — sourced from the same `args.get("profile_id")` D-05 threads through `SwapSetCommand`/`ControlVerbContext` (see Item 8). **A spoken swap (D-07) never carries a scope — its `control_verb_swap` rows will always have `scope: undefined`,** which is correct (spoken swaps stay global per D-07).

**Ingest case:** add `case "control_verb_swap":` to the same switch in `runtimeIngest.ts` alongside `case "model_routing"` (`:717-748`) — same file, same dual snake/camelCase coalescing idiom, same "must `break`, never throw" rule the file's own header comments already state (WR-06/168-06 lesson).

**Readout query, bounded (Claude's Discretion item resolved):** mirror `latestByProfile`'s `.take(200)` pattern (`activeEngine.ts:46-57`) — for the D-15 modal section, a per-profile-scoped query `.withIndex("by_scope", q => q.eq("scope", profileId)).order("desc").take(20)` is sufficient (a modal history section, not a full audit page); state the 20-row truncation on screen per the Phase 105 D-11/D-12 precedent CONTEXT.md cites.

## Item 4 — Retention Windows (D-10, D-14)

**Re-verified live** (not inherited from CONTEXT.md): `grep -c "activeEngineSnapshots" convex/retention.ts` → **0** (run 2026-08-07, this session). `RETENTION_DAYS` (`convex/retention.ts:28-66`) currently has three bands: 14 days (6 runtime-firehose tables, `:29-38`), 30 days (`gatewayQuotaSnapshots`, `:39-48`), 90 days (`events`/`environmentSnapshots`/.../`toolPolicyEvents`, `:49-65`).

**Comment style precedent** (`gatewayQuotaSnapshots:39-48`, `toolPolicyEvents:58-65`): both explain (a) why the table is being bounded BEFORE it grows, referencing the specific mass-delete/tombstone-storm risk this module exists to avoid, and (b) that "only the latest row ... is ever read, so N days is pure headroom."

**Recommendation:**
- `activeEngineSnapshots`: **30 days**, matching `gatewayQuotaSnapshots`'s tier exactly — same shape (append-only, one row per resolution-change, only the latest-per-profile ever read via `latestByProfile`'s `.take(200)`). 14 is unnecessarily aggressive for a "what was this profile's engine yesterday" debugging need; 90 is unwarranted headroom for a table whose only consumer is a latest-row-per-key query.
- `controlVerbSwaps` (new table): **30 days** also — it's a swap-*history* readout (D-15 explicitly wants to show "what did I last switch this to"), so slightly more retention than the pure-current-state `activeEngineSnapshots` has some value, but it's still an append-only audit log with no aggregate/trend consumer, so 90 days (the `events`/`toolPolicyEvents` tier, reserved for build-lifecycle and low-volume policy tables with longer-horizon value) is not clearly warranted either. 30 days keeps both new tables in the same tier, simplifying the mental model, and both are genuinely low-volume (D-09's emit-on-change dedup for the first, and swaps are a manual/rare operator action for the second).

## Item 5 — `_resolve_model` Precedence and `mode` Derivation (D-04, D-12)

**Exact current precedence chain, `providers/router.py:429-472`:**

```
1. explicit_model (arg)                                          → "override"          (:438-439)
1b. [D-04 INSERTS HERE: per-profile override, ABOVE global]
2. self._global_model_override                                    → "global-swap-override" (:446-447)
3. session_id in self._session_overrides (TTL-checked)             → "session-override"  (:450-453)
4. agent_id + self._model_defaults_cache.get_model(agent_id)       → "codepulse-default"  (:459-462)
5. task_category routing rule (self._has_routing_rules)            → "category-rule"      (:465-469)
6. fallback — FailoverProvider default                             → "default"            (:471-472)
```

D-04's insertion point is confirmed exactly where CONTEXT.md says: a new step between `explicit_model` (rung 1) and `self._global_model_override` (rung 2, line 446), reading `get_profile_context()` then a new per-profile override dict (see Item 1/7).

**`selection_path` vocabulary — CONTEXT.md's list is incomplete.** D-12 states the vocabulary as `"override" | "global-swap-override" | "session-override" | "category-rule" | "default"` (5 values) — **missing two values that exist in the live code**:
- `"codepulse-default"` (`router.py:462`) — present in the OLD `103-CONTRACT.md §4`'s own vocabulary list too, so this is a straightforward omission, not new.
- `"advisor"` — a 7th value, emitted **not** from `_resolve_model`'s return but as a **hardcoded literal** passed directly to `_emit_model_routing` from within `chat()` itself, at the ADV-02 advisor-dispatch success path (`router.py:302-304`: `await self._emit_model_routing(resolved_model, "advisor", task_category, complexity_result)`). This value never flows through `_resolve_model` at all — it's a parallel discriminator injected at a second call site inside `chat()`.

**This does not break D-12's mapping** because D-12's rule already has a catch-all ("everything else → `\"inherited\"`"), so `"codepulse-default"`, `"category-rule"`, `"default"`, and `"advisor"` all correctly fall through to `"inherited"` under the stated rule. But the plan/implementation MUST write the mapping as an explicit `if/elif ... else: "inherited"` (or equivalent catch-all), never an exhaustive `match` with no default arm — a `match` with only the 5 CONTEXT.md-listed cases and no fallback would silently produce `None`/a `KeyError` for `"codepulse-default"` and `"advisor"` rows, both of which are live, reachable values today.

**Full D-12 mapping table (7 values, none unmapped):**

| `selection_path` | `mode` |
|---|---|
| `"override"` | `"inherited"` (explicit per-call override isn't a profile pin) |
| **[new] per-profile override** | `"pinned"` |
| `"global-swap-override"` | `"pinned"` |
| `"session-override"` | `"session"` |
| `"codepulse-default"` | `"inherited"` |
| `"category-rule"` | `"inherited"` |
| `"default"` | `"inherited"` |
| `"advisor"` | `"inherited"` |

(Note: `"override"` — an explicit `model=` kwarg passed directly to `chat()` — arguably isn't a "swap" in any user-facing sense; D-12's stated rule groups it under the "everything else → inherited" catch-all, which is correct per the contract's own vocabulary but worth flagging: this is a caller-forced value, not a profile-level pin, and the mapping correctly treats it as such.)

## Item 6 — `status="failed"` Emit (Claude's Discretion)

`router.py:389-397`: on any exception during `self._failover.chat(...)`, `_emit_model_routing(resolved_model, selection_path, task_category, complexity_result, status="failed", error=str(exc))` fires and the exception re-raises.

**Recommendation: do NOT write an `activeEngineSnapshots` row for `status="failed"`.** Reasoning, grounded in how the row is actually consumed: `latestByProfile` (`activeEngine.ts:46-57`) returns the single newest row per `profileId` with no status filter — if a failed resolution attempt writes a row, `latestByProfile` (and therefore any UI built on it, per D-14's "read the active engine ONLY from telemetry" rule) would report a model that **never actually served a response** as the profile's current engine. That is the identical class of fabricated-reading failure D-14 exists to prevent (the `{profileId:"unknown"}` sentinel problem, just with a plausible-looking model name instead of a sentinel string). A resolution that failed did not change what's actively running.

**Implementation site: CodePulse ingest-side, not astridr-side.** `_emit_model_routing` is a single shared helper used by 4 call sites including both success and failure paths (`router.py:302,375,393`); conditionally suppressing the astridr-side `telemetry.send()` call for `status="failed"` would require branching that helper, adding complexity to a function four call sites share. Cleaner: extend `runtimeIngest.ts`'s `case "model_routing"` (`:717-748`) with one more skip condition alongside the existing `isUnresolvedRouting` guard — `if (d.status === "failed") break;` (or fold `status` into a check inside `isUnresolvedRouting`/a sibling helper in `activeEngineFilters.ts`, keeping the "dependency-free shared guard" pattern that file's own header comment establishes). This matches the file's existing "must `break`, never throw" idiom and keeps astridr's emit unconditional/simple, consistent with D-09's existing structure.

## Item 7 — Restore Semantics (Claude's Discretion)

`swap_model.py:422-500`'s `_execute` restore branch (`:431-453`) currently calls only `_router.clear_global_override()` — unconditionally, with no scope awareness at all today. `router.py:614-621`'s accessor trio (`set_global_override`/`clear_global_override`/`get_global_override`) operates on the single `_global_model_override` scalar slot (`:118-119`).

**Derived rule (CONTEXT.md's own proposal, confirmed implementable):**
- **Scoped `restore=true`** (i.e. `args.get("profile_id")` is present): clear only that profile's entry in the new per-profile override store (a dict, parallel to `_global_model_override`, keyed by profile_id — see Item 1's D-04 insertion point). Do **not** call `clear_global_override()`.
- **Unscoped `restore=true`** (today's only path, `args.get("profile_id")` absent): call `_router.clear_global_override()` exactly as today — byte-identical. Per-profile pins in the new store are untouched.

**Nothing in the existing restore path breaks this** — `clear_global_override()` only ever touches `_global_model_override`/`_global_override_source` (`:614-617`); a new sibling method (e.g. `clear_profile_override(profile_id)`) operating on a separate dict cannot collide with it. The `_execute` restore branch (`swap_model.py:431-453`) needs a straightforward `if profile_id := args.get("profile_id"): _router.clear_profile_override(profile_id) else: _router.clear_global_override()` branch, and its telemetry payload (currently hardcoded `"target": None, "resolved": None, "provider_affinity": None`) should also carry the new `scope`/profile_id field so a scoped restore is distinguishable from a global one in the `control_verb_swap` history (Item 3).

## Item 8 — `SwapSetCommand` Scope Field + Auth Tier (D-05)

**Existing validation/auth pattern:** `CommandAuth.check` (`astridr/security/command_auth.py:30-50`) — two tiers, `ADMIN_COMMANDS = frozenset({"estop.activate", "estop.deactivate"})` (`:15`, confirmed unchanged from 103-CONTRACT.md §6's citation). `swap.set` today requires the **service key** (standard-command tier; admin key also accepted since admin implies standard per `:46-49`). Pydantic field validation happens automatically via the `SwapSetCommand` model's typed fields (`Literal["brain","voice"]`, `str | None`, `bool`) — no separate validation step.

**Recommendation: no change to auth tier.** Do **not** add `swap.set` (scoped or not) to `ADMIN_COMMANDS`. This matches 103-CONTRACT.md §6's explicit statement for the (superseded) `gateway.model.set` design — "regular, non-admin commands, matching the existing tier of `swap.set`" — and ASVS V4 access-control correctness here means *not* over-gating a routine operator action behind the estop-only admin tier, which would make the picker unusable for a normal session (the exact over-gating failure mode 103-CONTRACT.md §6 calls out).

**Concrete wiring (mechanism, not principle):** add `profile_id: str | None = None` to `SwapSetCommand` (`ws_commands.py:235-239`) — Pydantic validates it's a string or absent automatically, consistent with §7's "unknown or absent `profile_id` is an error ack, never a silent global apply" requirement (implement by checking `profile_id` against the known profile ID set in `_handle_swap_set` before dispatch — if invalid, return an error ack rather than proceeding). In `_handle_swap_set` (`ws_commands.py:1075-1123`), thread it into `args`:

```python
if cmd.restore:
    args = {"restore": "true"}
else:
    if not cmd.value:
        raise ValueError("value is required unless restore=true")
    args = {"target": cmd.value}
if cmd.profile_id:
    args["profile_id"] = cmd.profile_id   # NEW — flows into swap_model._execute unchanged for swap_voice
```

**Open structural question this creates (not resolved by D-05/D-07's text):** `SwapSetCommand` covers **both** `target: "brain"` and `target: "voice"` — the same command class dispatches to `swap_model` or `swap_voice` depending on `cmd.target` (`ws_commands.py:1095`). D-05/D-07 only discuss the brain/`swap_model` axis. If `profile_id` is added to the shared `SwapSetCommand` model, it will also be present in `args` when `target=="voice"`, reaching `swap_voice.py:_execute`, which has no per-profile override concept at all (voice overrides are a single `set_voice_override`/`clear_voice_override` global pair — confirmed no per-profile voice store exists). **Recommendation:** `swap_voice.py:_execute` should ignore `args.get("profile_id")` entirely this phase (ENGINE-02 is about the "engine," i.e. brain, only) — but the `control_verb_swap` telemetry row for a voice swap dispatched with a `profile_id` present (e.g. from a future UI that doesn't know the field is brain-only) would then show a `scope` that had no actual effect, which is misleading. Flag this explicitly for the plan: either (a) validate `profile_id` is only accepted when `target=="brain"` (reject/ignore it for voice, matching ENGINE-02's actual scope), or (b) document plainly that `scope` on a `control_verb_swap` row with `verb:"swap_voice"` is currently inert. Recommend (a) — cheap, and avoids a misleading telemetry row from day one.

## Item 9 — D-16 Live-Proof Mechanics (ENGINE-05)

**1. Rebuild command — verified against the live `docker-compose.yml`:**
```bash
COMPOSE_PROFILES=prod,war-room docker compose up --build -d
```
Confirmed (`docker-compose.yml:315-339`): the `astridr` service (`container_name: astridr-agent`, ports `8181:8181`) has **no** `profiles:` key — it is always included in `up --build -d` regardless of the `COMPOSE_PROFILES` value. The flags remain required for the 5 `war-room-*` services and `notebooklm-mcp` (`:596`, `profiles: [prod]`) which this exact command family also touches, per the astridr CLAUDE.md checklist.

**2. Issue a real scoped `swap.set`.** The command channel is the same bidirectional WebSocket the telemetry push uses: `/ws/telemetry` (`astridr/engine/ws_telemetry.py:116`), on the `astridr-agent` container's port 8181. Auth: `Authorization: Bearer <SERVICE_KEY>` header (server-to-server clients) or `Sec-WebSocket-Protocol: bearer.<base64url-key>` (browser clients) — confirmed at `ws_telemetry.py:118-154`, constant-time `hmac.compare_digest` against either the service key or the admin key. Invocation shape (once D-05/Item 8 ships):

```json
{"type": "swap.set", "request_id": "108-uat-1", "target": "brain", "value": "<catalogue-model-id>", "profile_id": "<one-real-profile-id>"}
```
sent as a JSON text frame over that WS connection after the auth handshake succeeds. A minimal Python `websockets` or `wscat`-style client works; the service key lives in the astridr `.env` (never printed to a transcript per this repo's secrets rule).

**3. Read the rows out of the LOCAL self-hosted Convex backend — verified working command, tested live this session (admin key value not reproduced in this document):**
```bash
# container + ports confirmed live: docker ps → "convex-backend  0.0.0.0:3210-3211->3210-3211/tcp"
ADMIN_KEY=$(docker exec convex-backend /convex/generate_admin_key.sh)   # absolute path confirmed; relative "./generate_admin_key.sh" is CWD-dependent, unverified
npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
npx convex run controlVerbSwaps:listByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" '{"profileId": "<one-real-profile-id>"}'   # once the new query exists
```
**Verified this session:** `docker exec convex-backend /convex/generate_admin_key.sh` succeeds (script confirmed executable via `test -x`, 84-char single-line output in the `<instance-name>|<key>` shape), and `npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"` returns `[]` today (table currently empty — consistent with v13.0 already having pruned the 93 sentinel rows and no new valid rows having been written since). **Windows/Git-Bash trap confirmed live:** `docker exec convex-backend ...` with a leading-`/`-prefixed argument requires `MSYS_NO_PATHCONV=1` prefixed to the command, or Git Bash silently rewrites `/convex/...` into a bogus `C:/Program Files/Git/...` path and the exec fails with a misleading "No such file or directory" (hit and fixed live this session). **`npx convex` targets the CLOUD deployment (tidy-whale-981) by default** — always pass `--url http://127.0.0.1:3210 --admin-key ...` explicitly, never bare `npx convex run`.

**4. Unscoped control (D-04/D-07 proof, not vacuous):** before or after the scoped swap, issue an **unscoped** `swap.set` (`{"type":"swap.set","target":"brain","value":"<model-id>"}`, no `profile_id`) and confirm via `swap.get_state`/`swap.catalogue` or the existing `activeEngine.latestByProfile` readback that (a) the global override still applies process-wide exactly as before this phase's changes, and (b) the per-profile store touched in step 2 is untouched by the unscoped call. This is the paired-measurement control the 2026-08-05 lesson requires — proving "the global path still works" needs a BEFORE/AFTER contrast (or at minimum a same-session unscoped call whose behavior matches the pre-phase baseline), not just "the scoped call worked."

## Validation Architecture

*(Research agenda Item 10.)*

### Test Framework

| Property | Value |
|----------|-------|
| Framework (astridr) | pytest, `asyncio_mode = "auto"` (`pyproject.toml:161`) |
| Framework (codepulse) | Vitest (jsdom) |
| Config file (astridr) | `pyproject.toml:160-162` `[tool.pytest.ini_options]`, `testpaths = ["tests"]` |
| Config file (codepulse) | `vitest.config.ts` (existing, per project CLAUDE.md) |
| Quick run (astridr) | `pytest tests/unit/providers/test_router.py tests/unit/engine/test_swap_model.py tests/unit/engine/test_swap_voice.py tests/unit/engine/test_ws_commands.py -x` |
| Quick run (codepulse) | `npx vitest run convex/activeEngine.test.ts convex/activeEngineFilters.test.ts convex/retention.test.ts` |
| Full suite (astridr) | `pytest tests/` |
| Full suite (codepulse) | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | `_resolve_model`/`_emit_model_routing` read `get_profile_context()`, include `profileId`+`model` in payload | unit | `pytest tests/unit/providers/test_router.py -x` | ✅ existing file, extend |
| ENGINE-01 | No profile in context → no `model_routing` send (D-02) | unit | `pytest tests/unit/providers/test_router.py -k refuse_to_emit -x` | ❌ Wave 0 — new test case |
| ENGINE-01 | Boot seed, one event per profile, `mode:"inherited"` | unit/integration | existing bootstrap test suite (`tests/e2e/test_live_boot.py` or a targeted bootstrap unit test) | ⚠ check existing bootstrap test coverage in Wave 0 |
| ENGINE-01 | `selectedModel`→`model` rename propagates through ingest | unit (codepulse) | `npx vitest run convex/runtimeIngest.test.ts` (if exists) or an activeEngine ingest test | ⚠ verify a `runtimeIngest.test.ts` exists in Wave 0 — not confirmed by this research |
| ENGINE-02 | Scoped `swap.set` applies only to the named profile; unscoped stays byte-identical | unit | `pytest tests/unit/engine/test_swap_model.py tests/unit/engine/test_ws_commands.py -x` | ✅ existing files, extend |
| ENGINE-02 | Restore semantics: scoped clears only that profile, unscoped clears global only | unit | `pytest tests/unit/engine/test_swap_model.py -k restore -x` | ✅ extend existing restore tests |
| ENGINE-05 | Live integration proof, scoped + unscoped control | **manual-only** | D-16's exact command sequence (Item 9 above) | N/A — no automated path exists |
| TELE-02 | All 6 `control_verb_swap` sites write the new table with correct `scope` | unit | `pytest tests/unit/engine/test_swap_model.py tests/unit/engine/test_swap_voice.py -x` (astridr payload shape) + `npx vitest run convex/controlVerbSwaps.test.ts` (codepulse ingest) | ❌ Wave 0 — new Convex test file |
| TELE-02 | Retention entries for both new tables | unit | `npx vitest run convex/retention.test.ts` | ✅ existing file — `retention.test.ts:25`'s own comment says it "asserts every key here is a REAL schema table," extend for the 2 new keys |

### Sampling Rate
- **Per task commit:** the relevant quick-run command above (astridr or codepulse side, whichever was touched).
- **Per wave merge:** full suite on both repos (`pytest tests/` and `npm test`).
- **Phase gate:** full suite green on both repos, PLUS D-16's live manual proof (Item 9) — the ENGINE-05 requirement is explicitly "closed during execution, not claimed after," and per D-16 it is intrinsically a live/manual gate, not something the automated suite can substitute for.

### Wave 0 Gaps
- [ ] `tests/unit/providers/test_router.py` — add cases: profile-scoped `_resolve_model` precedence (new rung between `override` and `global-swap-override`), `get_profile_context()`-driven `profileId` in `_emit_model_routing`'s payload, refuse-to-emit when `get_profile_context()` is `None`, `status="failed"` payload shape (for the ingest-side skip test on the codepulse side).
- [ ] `tests/unit/engine/test_swap_model.py` / `test_swap_voice.py` — add cases for the new `profile_id`/`scope` field in the 6 emit-site payloads, and the scoped-vs-unscoped restore branch.
- [ ] `tests/unit/engine/test_ws_commands.py` — add cases for `SwapSetCommand.profile_id` validation (unknown profile_id → error ack, per §7) and voice-target rejection of `profile_id` (Item 8's open question, if resolution (a) is chosen).
- [ ] `convex/controlVerbSwaps.test.ts` — new file, mirrors `activeEngine.test.ts`'s structure, covers the new ingest case + the bounded readout query.
- [ ] Verify (not confirmed by this research) whether a `runtimeIngest.test.ts` exists covering the `model_routing` case's dual-coalescing behavior — if absent, add one exercising the rename (`d.model` only, no `selectedModel` fallback per D-11's rejected-alternative) and the new `status==="failed"` skip.

## Package Legitimacy Audit

Not applicable — this phase introduces no new external package dependencies on either repo side. All work is internal (Python `contextvars` stdlib, existing Pydantic models, existing Convex schema/query patterns).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker / docker compose | ENGINE-05 rebuild | ✓ (confirmed live, `astridr-agent` + `convex-backend` running) | — | — |
| `convex-backend` self-hosted container | D-16 row readback | ✓ (confirmed live, ports 3210/3211 published) | — | — |
| `npx convex` CLI | D-16 row readback | ✓ (confirmed live, successful query run this session) | — | — |
| A WS client capable of custom headers (`Authorization: Bearer`) | D-16 scoped-swap dispatch | ⚠ not tested this session — no off-the-shelf CLI tool confirmed; recommend a short Python `websockets` script in the plan's D-16 task, or reuse an existing test helper if one exists in `tests/unit/engine/test_ws_commands.py` | — | A minimal inline Python script using stdlib-adjacent `websockets` package (already a transitive dep of the FastAPI/uvicorn stack — verify at plan time) |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** the D-16 WS test client — verify at plan time whether an existing test harness (e.g. `tests/unit/engine/test_ws_commands.py`'s fixtures, or a `scripts/` helper) already provides one; if not, a short throwaway script is a Wave 0/D-16-task-scoped addition, not a new dependency.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 5 `.spawn(` call sites found are exhaustive (no dynamic/reflective spawn call this grep missed) | Item 1 | Low — a missed call site would still be governed by the same ContextVar-copy-at-task-creation semantics; the conclusion (no special-casing needed) would still hold unless the missed site crosses a genuine thread boundary, which the broader `asyncio.to_thread`/`run_in_executor` grep (Item 1) did not find anywhere near `chat()` |
| A2 | `AgentModelDefaultsCache`/`"codepulse-default"` rung's semantics are unaffected by this phase (not investigated in depth — out of scope) | Item 5 | Low — this rung sits below the new per-profile override in precedence either way |
| A3 | No existing `runtimeIngest.test.ts` file covers the `model_routing` ingest case's coalescing behavior (stated as unverified in Wave 0 Gaps, not confirmed absent by an exhaustive search) | Item 10 | Low — worst case, the planner discovers the file exists during Wave 0 and the gap entry is a no-op |
| A4 | A `websockets`-capable Python package is available in the astridr environment for D-16's live WS client (inferred from FastAPI/uvicorn's typical dependency tree, not directly confirmed via `pip index`/`uv.lock` grep this session) | Item 9, Environment Availability | Low — if absent, `websockets` is a well-known, easily-added stdlib-adjacent package; would need a Package Legitimacy Audit entry at plan time if actually added as a new dependency |

## Open Questions (RESOLVED)

*Both questions were resolved during planning (2026-08-07). Resolutions recorded inline below.*

1. **Does the `profile_id` field on `SwapSetCommand` apply to `target: "voice"` at all?**
   - **RESOLVED — option (a), reject.** `108-04-PLAN.md` Task 2(c)(1) rejects `profile_id` at the
     command layer when `target == "voice"`. Consequence followed through: `swap_voice.py` therefore
     needs no code change, since a voice row can never carry a scope — `108-05-PLAN.md` Task 2(c)
     records that disposition as a comment plus a regression test rather than leaving it as silence.
   - What we know: `SwapSetCommand` is one Pydantic model shared by both targets (`ws_commands.py:224-240`); `swap_voice.py` has no per-profile override concept today (confirmed — only a single global `set_voice_override`/`clear_voice_override` pair).
   - What's unclear: whether the plan should reject/ignore `profile_id` when `target=="voice"`, or silently accept-and-no-op it.
   - Recommendation: reject/ignore explicitly (Item 8's option (a)) — cheap, and prevents a misleading `scope`-populated `control_verb_swap` row for an event that had no actual scoped effect.

2. **Should `docs/astridr-contract.md` gain a `### model_routing` section as part of this phase?**
   - **RESOLVED — single-field correction only, no new section.** `108-01-PLAN.md` Task 2 corrects
     `docs/astridr-contract.md:1175` (`selectedModel` → `model`) in the same commit as the rename;
     `108-05-PLAN.md` Task 2 adds the new `scope` field row. The planner exercised the stated
     discretion NOT to author a full `### model_routing` section in this phase's budget.
   - What we know: the file has zero dedicated section for this event today (confirmed by grep); it's astridr's own telemetry contract doc, and D-08 already sets the precedent of correcting an out-of-date contract doc in the same commit as the code that makes it accurate.
   - What's unclear: ENGINE-01/TELE-02 don't explicitly require this file to be touched (only `103-CONTRACT.md`, which lives in codepulse's `.planning/`, is named by D-08).
   - Recommendation: in scope for `docs/astridr-contract.md:1175`'s single-field-name correction (required, since it currently documents `selectedModel` as correct); a full new `### model_routing` section is a nice-to-have, not a requirement — leave to planner discretion on whether it fits this phase's budget.

## Sources

### Primary (HIGH confidence — direct file reads/greps against the live checkout, this session)
- `astridr/providers/router.py` (full `ModelRouter` class, lines 1-630) — `_resolve_model`, `_emit_model_routing`, `chat()`, global override accessors
- `astridr/engine/telemetry.py` (lines 78-95, 590-686) — all 5 ContextVar trios including the pre-existing `_current_profile_id`
- `astridr/channels/router.py` (lines 500-553, 1040-1130) — `_route_locked`, `ChannelRouter.resolve_profile`
- `astridr/channels/agent_processor.py` (lines 90-150) — the live `set_profile_context` call site
- `astridr/engine/profile_manager.py`, `astridr/agent/profiles.py`, `astridr/engine/bootstrap/core.py:906` — the dead-code-vs-live ProfileManager distinction
- `astridr/api/ws_commands.py` (lines 220-421, 1075-1140) — `SwapSetCommand`, `_handle_swap_set`, handler map
- `astridr/engine/control_verbs/registry.py` (lines 38-58) — `ControlVerbContext`
- `astridr/engine/control_verbs/swap_model.py` (lines 400-504), `swap_voice.py` (lines 170-250) — all 6 emit sites
- `astridr/security/command_auth.py` (full file) — `ADMIN_COMMANDS`, `CommandAuth.check`
- `astridr/automation/subagents.py` (lines 100-310), plus 5 `.spawn(` call sites across `queen.py`, `wakeup_runner.py`, `teams.py`, `delegate_task.py`, `agent_factory/lifecycle.py`
- `astridr/engine/task_supervisor.py` (lines 45-70) — `spawn_supervised_task`
- `astridr/engine/bootstrap/core.py` (lines 1330-1365) — D-03's boot-seed loop
- `docs/astridr-contract.md` (lines 1175, 1188-1215) — existing `control_verb_swap` field contract, `selectedModel` doc reference
- `docker-compose.yml` (astridr-repo, lines 315-340) — `astridr` service profile gating, verified against `astridr` CLAUDE.md's claim
- `convex/retention.ts`, `convex/schema.ts:2040-2073`, `convex/activeEngine.ts`, `convex/activeEngineFilters.ts`, `convex/runtimeIngest.ts:690-765` (codepulse) — full reads
- `convex-selfhost/docker-compose.yml` (grep for container_name/ports) + live `docker ps` — confirmed `convex-backend` container name and 3210/3211 ports
- Live command execution this session: `docker exec convex-backend /convex/generate_admin_key.sh` (confirmed working, absolute path, `MSYS_NO_PATHCONV=1` required in Git Bash) and `npx convex run activeEngine:latestByProfile --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"` (confirmed working, returned `[]`)
- `pyproject.toml:160-162` (astridr) — pytest config
- Existing test file inventory (both repos) via targeted `find`/`grep`

### Secondary (MEDIUM confidence)
- None — all findings in this document were verified directly against live code or live command execution.

### Tertiary (LOW confidence)
- A4 (Environment Availability): `websockets` package availability for a D-16 WS test client — inferred, not directly confirmed via `uv.lock`/`pip index`.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new external packages this phase
- Architecture: HIGH — every claim in Items 1-9 is `file:line`-cited against a live read or live command execution this session
- Pitfalls: HIGH — the missing `reset_profile_context()` call, the dead-code `ProfileManager`, and the `ControlVerbContext`/`args` wiring gap were all found by direct code read, not inference

**Research date:** 2026-08-07
**Valid until:** 7 days (astridr's `feature/brain-swap` branch moves actively — CONTEXT.md's own commit pointer already drifted from `0d23f06e` to `645e8f8336b` between context-gathering and this research session, both on 2026-08-07)
