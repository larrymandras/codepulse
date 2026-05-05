# Profile-Based Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user sets a model on an agent profile in CodePulse, Ástríðr uses that model as the agent's default via a shared Supabase table.

**Architecture:** CodePulse writes model defaults to a new Supabase `agent_model_defaults` table. Ástríðr reads and caches them in memory (polled every 60s). ModelRouter gets a new resolution layer between session override and complexity-based routing. Complexity assessment only upgrades (never downgrades) the agent's CodePulse default.

**Tech Stack:** Supabase (PostgreSQL), Convex (TypeScript actions), Python 3.11+ (asyncio, httpx, structlog)

**Spec:** `docs/superpowers/specs/2026-05-05-profile-model-routing-design.md`

---

## File Structure

### Supabase (astridr-repo)
- **Create:** `supabase/migrations/20260505120000_agent_model_defaults.sql` — new table

### CodePulse (codepulse)
- **Modify:** `convex/agentProfiles.ts` — add `syncModelToSupabase` action
- **Modify:** `src/components/AgentProfileEditor.tsx` — call sync after save
- **Modify:** `src/hooks/useAgentProfiles.ts` — export new action hook

### Ástríðr (astridr-repo)
- **Create:** `astridr/engine/model_defaults.py` — `AgentModelDefaultsCache` class
- **Modify:** `astridr/engine/bootstrap/providers.py` — create cache, pass to router
- **Modify:** `astridr/providers/router.py` — add `agent_id` to `_resolve_model()`, add cache layer
- **Modify:** `astridr/agent/loop.py` — change complexity override to upgrade-only

---

### Task 1: Supabase Migration

**Files:**
- Create: `C:\Users\mandr\astridr-repo\supabase\migrations\20260505120000_agent_model_defaults.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Profile-based model routing: shared config store between CodePulse and Ástríðr
CREATE TABLE IF NOT EXISTS agent_model_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL UNIQUE,
  model_default TEXT NOT NULL,
  model_fallback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'codepulse'
);

CREATE INDEX idx_agent_model_defaults_agent_id ON agent_model_defaults(agent_id);

-- Grant service role access (matches pattern from 20260407150000_grant_service_role_permissions.sql)
GRANT ALL ON agent_model_defaults TO service_role;
```

- [ ] **Step 2: Apply the migration**

Run: `cd C:\Users\mandr\astridr-repo && npx supabase db push`

Expected: Migration applied successfully. Table `agent_model_defaults` created.

- [ ] **Step 3: Verify table exists**

Run: `npx supabase db query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_model_defaults' ORDER BY ordinal_position;"`

Expected: 6 columns listed (id, agent_id, model_default, model_fallback, updated_at, source).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260505120000_agent_model_defaults.sql
git commit -m "feat(supabase): add agent_model_defaults table for CodePulse→Ástríðr model sync"
```

---

### Task 2: CodePulse — Convex Sync Action

**Files:**
- Modify: `C:\Users\mandr\codepulse\convex\agentProfiles.ts`

- [ ] **Step 1: Add the syncModelToSupabase action**

Add these imports at the top of `convex/agentProfiles.ts`:

```typescript
import { action } from "./_generated/server";
```

Then add this action after the existing `remove` mutation:

```typescript
export const syncModelToSupabase = action({
  args: {
    agentId: v.string(),
    modelDefault: v.string(),
    modelFallback: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("syncModelToSupabase: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return;
    }

    const body: Record<string, string> = {
      agent_id: args.agentId,
      model_default: args.modelDefault,
      updated_at: new Date().toISOString(),
      source: "codepulse",
    };
    if (args.modelFallback) {
      body.model_fallback = args.modelFallback;
    }

    const resp = await fetch(`${supabaseUrl}/rest/v1/agent_model_defaults`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`syncModelToSupabase failed: ${resp.status} ${text}`);
    }
  },
});
```

- [ ] **Step 2: Run type check**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/agentProfiles.ts
git commit -m "feat(codepulse): add syncModelToSupabase action for model routing"
```

---

### Task 3: CodePulse — Wire Editor to Sync Action

**Files:**
- Modify: `C:\Users\mandr\codepulse\src\hooks\useAgentProfiles.ts`
- Modify: `C:\Users\mandr\codepulse\src\components\AgentProfileEditor.tsx`

- [ ] **Step 1: Export the action hook from useAgentProfiles.ts**

Replace the entire file `src/hooks/useAgentProfiles.ts` with:

```typescript
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAgentProfiles() {
  return useQuery(api.agentProfiles.list) ?? [];
}

export function useAgentProfileMutations() {
  const create = useMutation(api.agentProfiles.create);
  const update = useMutation(api.agentProfiles.update);
  const remove = useMutation(api.agentProfiles.remove);
  const syncModel = useAction(api.agentProfiles.syncModelToSupabase);
  return { create, update, remove, syncModel };
}
```

- [ ] **Step 2: Update AgentProfileEditor to call syncModel after save**

In `src/components/AgentProfileEditor.tsx`, change the destructuring on line 93 from:

```typescript
  const { create, update, remove } = useAgentProfileMutations();
```

to:

```typescript
  const { create, update, remove, syncModel } = useAgentProfileMutations();
```

Then add the sync call in `handleSave()`. Replace the `onSave();` call (line 180) with:

```typescript
      const effectiveProfileId = isNew
        ? profileId || name.toLowerCase().replace(/\s+/g, "-")
        : profile.profileId;
      try {
        await syncModel({ agentId: effectiveProfileId, modelDefault: model });
      } catch (err) {
        console.error("Failed to sync model to Ástríðr:", err);
      }
      onSave();
```

- [ ] **Step 3: Run type check**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Run dev server and test manually**

Run: `cd C:\Users\mandr\codepulse && npm run dev`

Test: Open Settings → Agent Profiles → Edit any agent → change model → Save. Check browser console for errors. Check Supabase table has a row.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAgentProfiles.ts src/components/AgentProfileEditor.tsx
git commit -m "feat(codepulse): wire agent profile editor to sync model to Supabase"
```

---

### Task 4: Ástríðr — AgentModelDefaultsCache

**Files:**
- Create: `C:\Users\mandr\astridr-repo\astridr\engine\model_defaults.py`

- [ ] **Step 1: Create the cache module**

```python
"""In-memory cache for agent model defaults from Supabase.

Reads the agent_model_defaults table at startup and polls every 60s.
Provides synchronous dict lookup for ModelRouter._resolve_model().
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from astridr.core.supabase_client import SupabaseHttpClient

logger = structlog.get_logger()

MODEL_CAPABILITY: dict[str, int] = {
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
    "gpt-4.1-nano": 40,
    "gemini-2.0-flash": 55,
    "gemini-2.0-flash-lite": 40,
    "grok-3-fast": 80,
}

DEFAULT_CAPABILITY = 50


def get_capability(model: str) -> int:
    """Return capability score for a model string. Unknown models get 50."""
    return MODEL_CAPABILITY.get(model, DEFAULT_CAPABILITY)


def should_upgrade(agent_default: str, complexity_model: str) -> bool:
    """Return True if complexity_model is more capable than agent_default."""
    return get_capability(complexity_model) > get_capability(agent_default)


class AgentModelDefaultsCache:
    """Polls agent_model_defaults from Supabase into an in-memory dict."""

    def __init__(self, sb_client: SupabaseHttpClient, poll_interval: float = 60.0) -> None:
        self._sb = sb_client
        self._poll_interval = poll_interval
        self._cache: dict[str, str] = {}
        self._poll_task: asyncio.Task[None] | None = None

    def get_model(self, agent_id: str) -> str | None:
        """Synchronous lookup. Returns model_default or None."""
        return self._cache.get(agent_id)

    async def load(self) -> None:
        """Initial load from Supabase. Called once at startup."""
        try:
            client = await self._sb._ensure_client()
            resp = await client.get(
                f"{self._sb._rest_base}/agent_model_defaults",
                params={"select": "agent_id,model_default"},
            )
            if resp.status_code == 200:
                rows = resp.json()
                self._cache = {r["agent_id"]: r["model_default"] for r in rows}
                logger.info("model_defaults.loaded", count=len(self._cache))
            else:
                logger.warning("model_defaults.load_failed", status=resp.status_code)
        except Exception:
            logger.warning("model_defaults.load_error", exc_info=True)

    async def _poll_loop(self) -> None:
        """Background polling loop."""
        while True:
            await asyncio.sleep(self._poll_interval)
            try:
                client = await self._sb._ensure_client()
                resp = await client.get(
                    f"{self._sb._rest_base}/agent_model_defaults",
                    params={"select": "agent_id,model_default"},
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    new_cache = {r["agent_id"]: r["model_default"] for r in rows}
                    if new_cache != self._cache:
                        self._cache = new_cache
                        logger.info("model_defaults.refreshed", count=len(self._cache))
            except Exception:
                logger.debug("model_defaults.poll_error", exc_info=True)

    def start_polling(self) -> None:
        """Start the background polling task."""
        if self._poll_task is None:
            self._poll_task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Cancel polling task."""
        if self._poll_task:
            self._poll_task.cancel()
            self._poll_task = None
```

- [ ] **Step 2: Verify syntax**

Run: `cd C:\Users\mandr\astridr-repo && python -c "import ast; ast.parse(open('astridr/engine/model_defaults.py').read()); print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add astridr/engine/model_defaults.py
git commit -m "feat(astridr): add AgentModelDefaultsCache for Supabase model defaults"
```

---

### Task 5: Ástríðr — Bootstrap Integration

**Files:**
- Modify: `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\providers.py`

- [ ] **Step 1: Modify _create_failover_provider to accept and wire the cache**

At the end of `_create_failover_provider()`, change the `ModelRouter` creation block (lines 82-90) from:

```python
    from astridr.providers.router import ModelRouter
    router = ModelRouter(
        failover=failover,
        routing_config=config.routing,
        telemetry=telemetry,
        advisor_provider=advisor_provider,
    )
    logger.info("router.created", provider_count=len(providers), has_advisor=advisor_provider is not None)
    return router
```

to:

```python
    from astridr.engine.model_defaults import AgentModelDefaultsCache
    from astridr.providers.router import ModelRouter

    model_defaults_cache: AgentModelDefaultsCache | None = None
    sb_client = getattr(config, '_sb_client', None)
    if sb_client is not None:
        model_defaults_cache = AgentModelDefaultsCache(sb_client)
        try:
            await model_defaults_cache.load()
            model_defaults_cache.start_polling()
        except Exception:
            logger.warning("bootstrap.model_defaults_cache_failed", exc_info=True)
            model_defaults_cache = None

    router = ModelRouter(
        failover=failover,
        routing_config=config.routing,
        telemetry=telemetry,
        advisor_provider=advisor_provider,
        model_defaults_cache=model_defaults_cache,
    )
    logger.info(
        "router.created",
        provider_count=len(providers),
        has_advisor=advisor_provider is not None,
        has_model_defaults=model_defaults_cache is not None,
    )
    return router
```

Note: `config._sb_client` is the `SupabaseHttpClient` instance. If the bootstrap wires it differently, the cache creation should be placed wherever the Supabase client is available. Check how `SupabasePersistence` gets its client in the main bootstrap sequence and use the same `SupabaseHttpClient` instance.

- [ ] **Step 2: Verify syntax**

Run: `cd C:\Users\mandr\astridr-repo && python -c "import ast; ast.parse(open('astridr/engine/bootstrap/providers.py').read()); print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add astridr/engine/bootstrap/providers.py
git commit -m "feat(astridr): wire AgentModelDefaultsCache into bootstrap and ModelRouter"
```

---

### Task 6: Ástríðr — ModelRouter _resolve_model() Update

**Files:**
- Modify: `C:\Users\mandr\astridr-repo\astridr\providers\router.py`

- [ ] **Step 1: Add model_defaults_cache to ModelRouter.__init__**

In `router.py`, add the import at the top (after existing imports):

```python
from astridr.engine.model_defaults import AgentModelDefaultsCache
```

Add `model_defaults_cache` parameter to `__init__` (after `advisor_circuit_breaker_cooldown`):

```python
        model_defaults_cache: AgentModelDefaultsCache | None = None,
```

Store it at the end of `__init__`:

```python
        self._model_defaults_cache = model_defaults_cache
```

- [ ] **Step 2: Add agent_id parameter to _resolve_model and add cache layer**

Replace the `_resolve_model` method (lines 317-340) with:

```python
    def _resolve_model(
        self,
        explicit_model: str | None,
        task_category: TaskCategory | None,
        session_id: str | None,
        messages: list[Message],
        agent_id: str | None = None,
    ) -> tuple[str | None, str]:
        # 1. Explicit model wins (D-06)
        if explicit_model:
            return explicit_model, "override"

        # 2. Session override (D-08)
        if session_id and session_id in self._session_overrides:
            return self._session_overrides[session_id], "session-override"

        # 3. CodePulse agent default (from Supabase cache)
        if agent_id and self._model_defaults_cache:
            codepulse_model = self._model_defaults_cache.get_model(agent_id)
            if codepulse_model:
                return codepulse_model, "codepulse-default"

        # 4. Task category routing (skip inference if no routing rules configured)
        if self._has_routing_rules:
            category = task_category or self._infer_category(messages)
            route_entry = getattr(self._routing, category.value, None)
            if route_entry and route_entry.models:
                return route_entry.models[0], "category-rule"

        # 5. Fallback — let FailoverProvider use its default
        return None, "default"
```

- [ ] **Step 3: Forward agent_id in chat() to _resolve_model**

In the `chat()` method (line 195), change:

```python
        resolved_model, selection_path = self._resolve_model(model, task_category, session_id, messages)
```

to:

```python
        agent_id = kwargs.get("agent_id")
        resolved_model, selection_path = self._resolve_model(model, task_category, session_id, messages, agent_id=agent_id)
```

Note: `agent_id` arrives via `**kwargs` from `chat_with_trace()` which passes `kwargs["session_id"]` but `agent_id` comes through the `**kwargs` passthrough as well. Check `base.py:chat_with_trace` — it calls `self.chat(messages, tools, model, temperature, **kwargs)` and the original caller passes `agent_id` as a keyword arg. However, `chat_with_trace` captures `agent_id` as an explicit parameter and does NOT forward it in `**kwargs`. So we need to also forward it.

In `base.py`, line 141, change:

```python
        kwargs["session_id"] = session_id
```

to:

```python
        kwargs["session_id"] = session_id
        kwargs["agent_id"] = agent_id
```

- [ ] **Step 4: Verify syntax**

Run: `cd C:\Users\mandr\astridr-repo && python -c "import ast; ast.parse(open('astridr/providers/router.py').read()); print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add astridr/providers/router.py astridr/providers/base.py
git commit -m "feat(astridr): add codepulse-default layer to ModelRouter._resolve_model"
```

---

### Task 7: Ástríðr — Complexity Upgrade-Only Logic

**Files:**
- Modify: `C:\Users\mandr\astridr-repo\astridr\agent\loop.py`

- [ ] **Step 1: Change complexity override to upgrade-only**

In `loop.py`, replace the complexity session override block (lines 455-457):

```python
            if hasattr(self.provider, 'set_session_override'):
                self.provider.set_session_override(session.id, _complexity.model)
```

with:

```python
            if hasattr(self.provider, 'set_session_override'):
                from astridr.engine.model_defaults import should_upgrade
                model_defaults_cache = getattr(self.provider, '_model_defaults_cache', None)
                agent_default = model_defaults_cache.get_model(self._active_profile) if model_defaults_cache else None
                if agent_default is None or should_upgrade(agent_default, _complexity.model):
                    self.provider.set_session_override(session.id, _complexity.model)
```

This means:
- If no CodePulse default is set → complexity behaves as before (always sets override)
- If CodePulse default is set → complexity only overrides when its model is MORE capable (e.g., Opus > Sonnet)
- If complexity model is equal or less capable → skip, let CodePulse default win at layer 3

- [ ] **Step 2: Verify syntax**

Run: `cd C:\Users\mandr\astridr-repo && python -c "import ast; ast.parse(open('astridr/agent/loop.py').read()); print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add astridr/agent/loop.py
git commit -m "feat(astridr): complexity assessment only upgrades past CodePulse agent default"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Insert a test row into Supabase**

Run via Supabase SQL editor or CLI:

```sql
INSERT INTO agent_model_defaults (agent_id, model_default, source)
VALUES ('hervor', 'gpt-4o', 'codepulse')
ON CONFLICT (agent_id) DO UPDATE SET model_default = 'gpt-4o', updated_at = now();
```

- [ ] **Step 2: Restart Ástríðr and verify cache loads**

Run: `cd C:\Users\mandr\astridr-repo && docker compose up --build -d`

Check logs for: `model_defaults.loaded count=1`

- [ ] **Step 3: Send a message routed to Hervor and verify model used**

Send a message to Hervor via Telegram or web. Check logs for `router.resolved model=gpt-4o` with selection path `codepulse-default`.

- [ ] **Step 4: Test complexity upgrade**

Send a complex message (e.g., involving architecture/security/deployment keywords). Verify logs show `complexity-upgrade` to `claude-opus-4-6` (capability 100 > gpt-4o capability 70).

- [ ] **Step 5: Test complexity non-downgrade**

Send a trivial message (e.g., "hi"). Verify logs show `codepulse-default` with `gpt-4o` — NOT downgraded to `claude-sonnet-4-6` by complexity.

- [ ] **Step 6: Test CodePulse editor sync**

In CodePulse dashboard, edit Hervor's profile → change model to `claude-opus-4-6` → Save. Verify Supabase row updated. Wait 60s (or restart Ástríðr). Verify next Hervor message uses `claude-opus-4-6`.

- [ ] **Step 7: Final commit (if any fixups needed)**

```bash
git add -A && git commit -m "fix: e2e verification fixups for profile model routing"
```
