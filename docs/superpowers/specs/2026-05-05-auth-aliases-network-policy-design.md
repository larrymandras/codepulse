# Auth Aliases & Network Policy — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Scope:** Wire up Auth Aliases (bootstrap inventory + runtime usage tracking) and Network Policy (config display + periodic egress summary) across Ástríðr and CodePulse.

## Context

Two panels on the CodePulse Infrastructure/Security pages are empty:

- **Auth Aliases** — Table exists, Convex backend is complete, but Ástríðr never emits `auth_alias` events. The event type is registered in telemetry but no code calls it.
- **Network Policy** — The `EgressControlLayer` in Ástríðr works and emits blocks via the security pipeline, but the Infrastructure.tsx "Provider Allowlist" is a placeholder, and the Security.tsx Network Policy tab only shows blocks (which are rare, so it appears empty).

Additionally, a dev/prod Convex deployment split was causing all integration health to show Disconnected. This has been resolved by consolidating to the single prod deployment (`tidy-whale-981`).

## Design Decisions

- **Auth Aliases: Bootstrap inventory + runtime usage tracking.** On startup, emit every resolved `SecretRef`/`AliasSecretRef` to populate the table. At runtime, update `lastUsedAt` each time an alias is resolved for an LLM call or tool auth.
- **Network Policy: Static config display + periodic egress summary (Option C).** Emit the full allowlist on bootstrap. Every 60s, the health emitter drains access counters from the egress layer and emits a summary of hosts accessed + hit counts. Individual "allowed" events are NOT logged — too noisy, and the summary covers the dashboard use case. Blocks continue to be logged individually via the existing security pipeline.
- **Single Convex deployment.** All references to `ideal-sandpiper-297` (dev) have been replaced with `tidy-whale-981` (prod). Ástríðr, CodePulse frontend, and all hook scripts now target the same database.

---

## Auth Aliases

### Data Flow

```
Ástríðr Bootstrap
  └─ resolve_all_and_swap() succeeds
     └─ For each resolved alias:
        telemetry.send("auth_alias", {
          alias: "ANTHROPIC_API_KEY",
          provider: "env",
          userId: "ANTHROPIC_API_KEY",  // env var name or file path
          createdAt: now
        })

Ástríðr Runtime (per LLM call / tool auth)
  └─ SecretResolver.resolve_with_aliases() succeeds
     └─ telemetry.send("auth_alias", {
          alias: ref.name,
          provider: target_ref.provider,  // env/file/exec/alias
          userId: str(target_ref),
          lastUsedAt: now
        })
```

### Ástríðr Changes

**`astridr/engine/bootstrap/core.py`** — After all secrets are resolved during bootstrap (both plain SecretRefs via `resolve_all_and_swap()` and alias refs), iterate over the full resolved set and emit:

```python
for key, ref in all_refs.items():
    await telemetry.send("auth_alias", {
        "alias": key,
        "provider": ref.provider if hasattr(ref, "provider") else "env",
        "userId": str(ref),
        "createdAt": time.time(),
    })
```

Note: This covers all credential types (env, file, exec, alias). The `auth_alias` event name is reused for both alias and non-alias refs since the dashboard shows a unified "configured credentials" inventory.

**`astridr/core/secrets.py`** — In `SecretResolver.resolve_with_aliases()`, after successful resolution (before return), emit a usage event. Requires threading a `telemetry` reference into `SecretResolver` (add optional `telemetry` param to constructor, store as `self._telemetry`):

```python
if self._telemetry and isinstance(ref, AliasSecretRef):
    await self._telemetry.send("auth_alias", {
        "alias": ref.name,
        "provider": target.provider if hasattr(target, "provider") else "unknown",
        "userId": str(target),
        "lastUsedAt": time.time(),
    })
```

### CodePulse Changes

**`convex/schema.ts`** — Add `lastUsedAt` to `authAliases` table:

```typescript
authAliases: defineTable({
  alias: v.string(),
  provider: v.string(),
  userId: v.string(),
  createdAt: v.float64(),
  lastUsedAt: v.optional(v.float64()),  // NEW
})
```

**`convex/runtimeIngest.ts`** — Update `auth_alias` case to pass `lastUsedAt`:

```typescript
case "auth_alias": {
  const d = data as any;
  await ctx.runMutation(api.v6Mutations.upsertAuthAlias, {
    alias: d.alias ?? "unknown",
    provider: d.provider ?? "unknown",
    userId: d.userId ?? d.user_id ?? "unknown",
    createdAt: d.createdAt ?? d.created_at ?? timestamp,
    lastUsedAt: d.lastUsedAt ?? d.last_used_at,
  });
  break;
}
```

**`convex/v6Mutations.ts`** — Update `upsertAuthAlias` mutation to handle `lastUsedAt`:

```typescript
// In the patch (existing alias):
await ctx.db.patch(existing._id, {
  provider: args.provider,
  userId: args.userId,
  ...(args.lastUsedAt ? { lastUsedAt: args.lastUsedAt } : {}),
});
```

**`src/pages/Infrastructure.tsx`** — Add "Last Used" column to Auth Aliases table, showing relative time (e.g., "2m ago") or "Never" if null.

---

## Network Policy

### Data Flow

```
Ástríðr Bootstrap (one-shot, first health emitter cycle)
  └─ _emit_network_policy_config()
     └─ For each allowlist entry:
        telemetry.send("network_policy_config", {
          host: entry.host,
          cidr: entry.cidr,
          port: entry.port,
          provider: entry.provider,
          source: "config" | "default"
        })

Ástríðr Runtime (every 60s via health emitter)
  └─ _emit_egress_summary()
     └─ egress_layer.drain_counts()  // returns {host: count} and resets
     └─ telemetry.send("network_egress_summary", {
          hosts: {
            "api.anthropic.com:443": 12,
            "localhost:11434": 8,
            ...
          },
          blockedCount: 0,
          timestamp: now
        })

Ástríðr Runtime (on block, existing behavior)
  └─ SecurityPipeline emits security_event
     └─ eventType: "network_policy_block"
     └─ Already works, no changes needed
```

### Ástríðr Changes

**`astridr/security/egress_control.py`** — Add access counters:

```python
class EgressControlLayer(SecurityLayer):
    def __init__(self, network_policy=None):
        ...
        self._access_counts: dict[str, int] = {}
        self._block_count: int = 0

    async def is_allowed(self, url: str) -> bool:
        ...
        # At the end, after all checks pass:
        host_key = f"{hostname}:{port or 443}"
        self._access_counts[host_key] = self._access_counts.get(host_key, 0) + 1
        return True

    def drain_counts(self) -> tuple[dict[str, int], int]:
        """Return access counts and block count, then reset."""
        counts = dict(self._access_counts)
        blocks = self._block_count
        self._access_counts.clear()
        self._block_count = 0
        return counts, blocks
```

Also increment `self._block_count` in `process_outbound()` when a block occurs.

**`astridr/engine/health_emitter.py`** — Add egress layer reference and two new methods:

```python
class HealthEmitter:
    def __init__(self, telemetry, router, failover, egress_layer=None, interval=60):
        ...
        self._egress = egress_layer
        self._config_emitted = False

    async def _loop(self):
        await asyncio.sleep(5)
        while self._running:
            try:
                await self._emit_channels()
                await self._emit_providers()
                if self._egress:
                    if not self._config_emitted:
                        await self._emit_network_policy_config()
                        self._config_emitted = True
                    await self._emit_egress_summary()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning("health_emitter.cycle_failed", exc_info=True)
            await asyncio.sleep(self._interval)

    async def _emit_network_policy_config(self):
        now = time.time()
        for entry in self._egress.allowlist:
            await self._telemetry.send("network_policy_config", {
                "host": getattr(entry, "host", None),
                "cidr": getattr(entry, "cidr", None),
                "port": entry.port,
                "provider": getattr(entry, "provider", None),
                "source": "default" if entry in DEFAULT_ALLOWLIST else "config",
                "timestamp": now,
            })

    async def _emit_egress_summary(self):
        counts, blocks = self._egress.drain_counts()
        if not counts and blocks == 0:
            return  # Nothing to report
        await self._telemetry.send("network_egress_summary", {
            "hosts": counts,
            "blockedCount": blocks,
            "timestamp": time.time(),
        })
```

**`astridr/engine/bootstrap/core.py`** — Pass `egress_layer` to `HealthEmitter` constructor (the `EgressControlLayer` is already instantiated at bootstrap as `browser_egress` in `tools.py`).

### CodePulse Changes

**`convex/schema.ts`** — Add two new tables:

```typescript
networkPolicyRules: defineTable({
  host: v.optional(v.string()),
  cidr: v.optional(v.string()),
  port: v.optional(v.float64()),
  provider: v.optional(v.string()),
  source: v.string(),  // "default" | "config"
  timestamp: v.float64(),
}).index("by_host", ["host"]),

networkEgressSummary: defineTable({
  hosts: v.any(),  // { "host:port": count }
  blockedCount: v.float64(),
  timestamp: v.float64(),
}).index("by_timestamp", ["timestamp"]),
```

**`convex/runtimeIngest.ts`** — Add two new routing cases:

```typescript
case "network_policy_config": {
  const d = data as any;
  await ctx.runMutation(api.networkPolicy.upsertRule, {
    host: d.host, cidr: d.cidr, port: d.port,
    provider: d.provider, source: d.source ?? "config",
    timestamp,
  });
  break;
}
case "network_egress_summary": {
  const d = data as any;
  await ctx.runMutation(api.networkPolicy.recordEgressSummary, {
    hosts: d.hosts ?? {},
    blockedCount: d.blockedCount ?? d.blocked_count ?? 0,
    timestamp,
  });
  break;
}
```

**`convex/networkPolicy.ts`** — New file with mutations and queries:

- `upsertRule` — upsert by host (update if exists, insert if new)
- `recordEgressSummary` — insert new summary row
- `listRules` — return all rules ordered by host
- `recentSummaries` — return last 30 summaries by timestamp desc

**`src/pages/Infrastructure.tsx`** — Replace Network Policy placeholder:

- Query `api.networkPolicy.listRules`
- Render table: Host/CIDR, Port, Provider, Source (default/config)

**`src/pages/Security.tsx`** — Network Policy tab additions:

- Query `api.networkPolicy.recentSummaries`
- "Active Hosts" panel above block log: table of hosts from most recent summary, with request counts
- Existing block log stays as-is

---

## Telemetry Event Registration

Add to `_SYSTEM_SESSION_MAP` in `astridr/engine/telemetry.py`:

```python
"network_policy_config": "system:bootstrap",
"network_egress_summary": "system:health-check",
```

`auth_alias` is already registered as `"system:bootstrap"`.

---

## Files Changed

### Ástríðr (5 files)

| File | Type |
|---|---|
| `astridr/engine/bootstrap/core.py` | Edit — emit auth_alias on bootstrap, pass egress_layer to HealthEmitter |
| `astridr/core/secrets.py` | Edit — add telemetry param to SecretResolver, emit on alias resolution |
| `astridr/security/egress_control.py` | Edit — add access counters + drain_counts() |
| `astridr/engine/health_emitter.py` | Edit — add egress_layer param, _emit_network_policy_config(), _emit_egress_summary() |
| `astridr/engine/telemetry.py` | Edit — register two new event types in _SYSTEM_SESSION_MAP |

### CodePulse (6 files)

| File | Type |
|---|---|
| `convex/schema.ts` | Edit — add networkPolicyRules, networkEgressSummary tables; add lastUsedAt to authAliases |
| `convex/runtimeIngest.ts` | Edit — add network_policy_config, network_egress_summary cases; update auth_alias case |
| `convex/v6Mutations.ts` | Edit — update upsertAuthAlias for lastUsedAt |
| `convex/networkPolicy.ts` | New — mutations and queries for rules + summaries |
| `src/pages/Infrastructure.tsx` | Edit — replace placeholder, add lastUsedAt column |
| `src/pages/Security.tsx` | Edit — add Active Hosts summary panel |

---

## Not In Scope

- No changes to orbital status rings (already fixed)
- No new egress blocking logic (already works)
- No auth/permissions changes
- No UI redesign beyond filling empty panels
- No individual "allowed" event logging (summary only)
