# Profile-Based Model Routing

**Date:** 2026-05-05
**Status:** Approved
**Scope:** Cross-system (Supabase, CodePulse, Ástríðr)

## Problem

CodePulse's agent profile editor has a model selector dropdown, but the selected model is purely a label — it doesn't affect which LLM the agent actually uses. When a user sets Hervor to `gpt-4o` in CodePulse, Ástríðr ignores it entirely and routes through its own complexity/category/default chain.

The user's expectation: if I set a model on an agent's profile, the agent should use that model.

## Solution

Use Supabase as a shared config store. CodePulse writes model defaults to a new Supabase table. Ástríðr reads from it (cached in memory, polled every 60s) and applies it as a new layer in the model routing chain.

## Architecture

```
CodePulse Dashboard                    Supabase                         Ástríðr Runtime
┌─────────────────┐                 ┌─────────────────┐              ┌──────────────────┐
│ AgentProfile     │   upsert via   │ agent_model_     │  poll every  │ AgentModelDefaults│
│ Editor           │ ─────────────→ │ defaults table   │ ←─────────── │ Cache (in-memory) │
│ (model dropdown) │  Supabase REST │ (~10 rows)       │   60s query  │                  │
└─────────────────┘                 └─────────────────┘              └────────┬─────────┘
                                                                              │
                                                                              ▼
                                                                     ModelRouter
                                                                     ._resolve_model()
                                                                     (new layer #4)
```

## Join Key

The `agent_id` is the natural join key shared across all three systems:

| System | Field | Example Values |
|--------|-------|----------------|
| CodePulse | `agentProfiles.profileId` | `hervor`, `skuld`, `freya` |
| Ástríðr | `agent_types[].id` | `hervor`, `skuld`, `freya` |
| Supabase | `agent_model_defaults.agent_id` | `hervor`, `skuld`, `freya` |

All 10 agent IDs are identical across systems. No mapping layer needed.

## Component 1: Supabase Migration

New table `agent_model_defaults`:

```sql
CREATE TABLE IF NOT EXISTS agent_model_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL UNIQUE,
  model_default TEXT NOT NULL,
  model_fallback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'codepulse'
);

CREATE INDEX idx_agent_model_defaults_agent_id ON agent_model_defaults(agent_id);
```

- `agent_id` — unique constraint, one row per agent, upsert-friendly
- `model_default` — the model string (e.g., `claude-opus-4-6`, `gpt-4o`, `llama3.1`)
- `model_fallback` — optional fallback model
- `source` — provenance tracking (`codepulse`, `yaml`, `api`)
- Tiny table (~10 rows). Polling is trivially cheap.

## Component 2: CodePulse — Write to Supabase

### New Convex Action

`convex/agentProfiles.ts` gets a new action `syncModelToSupabase`:

- Type: Convex `action` (not mutation — actions can make external HTTP calls)
- Args: `{ agentId: string, modelDefault: string, modelFallback?: string }`
- Calls Supabase REST API: `POST /rest/v1/agent_model_defaults`
- Uses `Prefer: resolution=merge-duplicates` header for upsert on `agent_id`
- Auth: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (already available to Convex)

### Modified AgentProfileEditor

In `handleSave()`, after the existing `create()` or `update()` mutation succeeds:

```typescript
await syncModelToSupabase({ agentId: profileId, modelDefault: model });
```

### Error Handling

If the Supabase write fails, the Convex save still succeeded — the profile is correct in CodePulse. Log the error. The user can retry by re-saving. No data loss scenario.

## Component 3: Ástríðr — Read and Route

### 3a. New Module: `astridr/engine/model_defaults.py`

`AgentModelDefaultsCache` class:

- `_cache: dict[str, str]` — maps `agent_id → model_default` (in-memory)
- `async load()` — reads all rows from `agent_model_defaults`, populates cache. Called once at startup.
- `async poll()` — same query, runs every 60s in background `asyncio` task. Only updates cache if data changed.
- `get_model(agent_id: str) -> str | None` — synchronous dict lookup. Returns model string or `None`.
- Uses existing `SupabasePersistence` client (already initialized in bootstrap).

### 3b. Bootstrap Integration

During Ástríðr startup (`astridr/engine/bootstrap/`):

1. Create `AgentModelDefaultsCache` instance
2. Call `await cache.load()` to populate
3. Start 60s polling background task
4. Pass cache to `ModelRouter` (new constructor parameter)

### 3c. Modified Model Routing Chain

`ModelRouter._resolve_model()` gets a new `agent_id: str | None` parameter. Updated resolution order:

| Priority | Source | Selection Path | Behavior |
|----------|--------|----------------|----------|
| 1 | `AgentTypeConfig.model_override` | `"override"` | Absolute — YAML specialist agents |
| 2 | Session override | `"session-override"` | `/model` command, per-session |
| 3 | Complexity escalation | `"complexity-upgrade"` | Only if tier model is MORE capable than agent default |
| 4 | **CodePulse agent default** | `"codepulse-default"` | **NEW — from Supabase cache** |
| 5 | Task category routing | `"category-rule"` | Routing rules by task type |
| 6 | Provider default | `"default"` | FailoverProvider fallback |

### Complexity Upgrade Logic

The key behavioral change: complexity assessment no longer always sets a session override. Instead, it compares its tier-mapped model against the agent's CodePulse default using a capability ranking:

```python
MODEL_CAPABILITY = {
    "claude-opus-4-6": 100,
    "gpt-4.1": 95,
    "grok-3": 90,
    "gemini-2.5-pro": 90,
    "claude-sonnet-4-6": 70,
    "gpt-4o": 70,
    "gpt-4.1-mini": 60,
    "gemini-2.5-flash": 60,
    "grok-3-mini": 55,
    "claude-haiku-4-5": 50,
    "gpt-4o-mini": 45,
}
```

- If complexity model capability > agent default capability → upgrade (use complexity model)
- If complexity model capability <= agent default capability → skip (agent default wins)
- Unknown models default to capability 50 (mid-tier)

### Agent ID Flow

`agent_id` is already available in the call chain:

```
AgentLoop.process()
  self._active_profile = "hervor"  (already set)
    → provider.chat_with_trace(agent_id=self._active_profile, ...)
      → ModelRouter.chat(agent_id=..., ...)  (forward existing param)
        → _resolve_model(agent_id=..., ...)  (new param, cache lookup)
```

## Performance

- **Zero impact on hot path.** `_resolve_model()` adds one `dict.get()` call (nanoseconds).
- **Startup:** One `SELECT` query on a ~10-row table (~50ms).
- **Background poll:** One lightweight query every 60s. Negligible.
- **CodePulse write:** One Supabase REST upsert on profile save. Happens a few times per month.

## Files Changed

### Supabase
- New migration: `supabase/migrations/YYYYMMDDHHMMSS_agent_model_defaults.sql`

### CodePulse (`C:\Users\mandr\codepulse`)
- `convex/agentProfiles.ts` — add `syncModelToSupabase` action
- `src/components/AgentProfileEditor.tsx` — call sync action in `handleSave()`

### Ástríðr (`C:\Users\mandr\astridr-repo`)
- `astridr/engine/model_defaults.py` — new `AgentModelDefaultsCache` class
- `astridr/engine/bootstrap/providers.py` — create cache, start polling, pass to router
- `astridr/providers/router.py` — add `agent_id` param to `_resolve_model()`, add cache lookup layer
- `astridr/agent/loop.py` — modify complexity override logic (upgrade-only behavior)

## Not In Scope

- Syncing other agent config fields (tools, budget, system prompt) from CodePulse → Ástríðr. This design establishes the Supabase bridge pattern; other fields can follow the same pattern later.
- Supabase Realtime subscription. Polling every 60s is sufficient for config changes made a few times per month. Can upgrade to Realtime later if needed.
- UI feedback showing sync status in CodePulse. A toast on failure is sufficient for now.
