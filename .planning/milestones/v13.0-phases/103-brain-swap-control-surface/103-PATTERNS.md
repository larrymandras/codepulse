# Phase 103: Brain-Swap Control Surface - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 18 (net-new + modified)
**Analogs found:** 15 / 18 (3 have no close analog — flagged below as genuinely new surfaces)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/brainsApi.ts` (new) | service (adapter seam) | request-response (stub/live dual-impl) | `src/lib/astridrApi.ts` (module-scope env flag idiom) | partial — new-to-codebase pattern (one interface, two impls); no prior two-implementation adapter exists |
| `src/lib/brainsApi.test.ts` (new) | test | contract-conformance | `src/components/control-center/BrainControl.test.tsx` | role-match (test idiom for fetch/dispatch) |
| `src/hooks/useActiveEngine.ts` (new) | hook | CRUD (reactive read) | `src/hooks/useProviderHealth.ts` | exact — `useQuery(...) ?? {}` wrapper idiom |
| `src/components/brains/BrainPicker.tsx` (new) | component | request-response (fetch catalogue, dispatch swap) | `src/components/control-center/BrainControl.tsx` | exact — same popover+catalogue+filter+dispatch shape, extended with scope selector + groups |
| `src/components/brains/BrainPicker.test.tsx` (new) | test | — | `src/components/control-center/BrainControl.test.tsx` | exact |
| `src/components/brains/BrainPickerRow.tsx` (new) | component | transform (render row) | `src/components/ProviderHealthPanel.tsx` (`ProviderCard`) | role-match (dot/name/billing/health/quota row composition) — but must re-tokenize away from its hardcoded `bg-green-500` etc. per UI-SPEC |
| `src/components/brains/GlobalSwapModal.tsx` (new) | component | request-response (batch dispatch + result) | no close analog — **net-new** (see below) | none |
| `src/components/brains/GlobalSwapModal.test.tsx` (new) | test | — | `src/components/control-center/BrainControl.test.tsx` (fetch→act→assert-dispatch idiom only) | partial |
| `src/components/brains/BrainHeaderBadge.tsx` (new) | component | CRUD (reactive read) + request-response (click opens picker) | `src/components/voice/SwapBadge.tsx` | exact — read-only Tooltip-wrapped Badge fed by live state, same "never silently pick one value" honesty rule |
| `src/components/brains/BrainHeaderBadge.test.tsx` (new) | test | — | `src/components/control-center/BrainControl.test.tsx` | role-match |
| `convex/activeEngine.ts` (new) | model/service (Convex mutation+query module) | event-driven ingest + CRUD read | `convex/gatewayQuota.ts` | exact — `deduplicateByProvider`/`latestByProvider` is the literal template for `deduplicateByProfile`/`latestByProfile` |
| `convex/activeEngine.test.ts` (new) | test | — | no existing `gatewayQuota.test.ts` was located; use `convex/profiles.ts`'s exported pure-function pattern (`personaConfigChangeKey`) as the "export helper, test in isolation" idiom | partial |
| `convex/schema.ts` (modify — append new table) | config/model (schema) | — | `convex/schema.ts:1540` `gatewayQuotaSnapshots` table def | exact — same "latest-per-key, indexed by key + timestamp" shape |
| `convex/runtimeIngest.ts` (modify — add `model_routing` case) | controller (event dispatcher) | event-driven | `convex/runtimeIngest.ts` existing cases, e.g. `case "provider_health"` (line ~835) and `case "profile_config"` (line ~512) | exact — same switch-case-per-eventType idiom already in this exact file |
| `src/pages/Chat.tsx` (modify — add composer pill above input row) | component (page, modify) | request-response | Chat.tsx's own existing composer JSX (lines 511-539) + `ControlCenterPanel.tsx`'s BRAIN row hosting `BrainControl` | exact (same file houses both the existing swap-badge wiring pattern at lines 171-248 and the new pill) |
| `src/layouts/DashboardLayout.tsx` (modify — insert badge in status cluster) | component (layout, modify) | CRUD (reactive read) | `DashboardLayout.tsx:576-588` existing status cluster (`EStopButton`, `NotificationBell`, etc., inside `TooltipProvider`) | exact — insertion point and Tooltip pattern both already present |
| `src/pages/Settings.tsx` (modify — replace stale profile rows, lines 630-678) | component (page, modify) | CRUD | Settings.tsx's own existing `Agent Profiles` section (same file, D-06 explicitly replaces in place) | exact |
| `e2e/brain-swap.spec.ts` (new) | test (E2E) | — | `e2e/analytics-cache-tile.spec.ts` | exact — same Clerk-skip guard + structural-assertion idiom |
| `103-CONTRACT.md` (new, doc deliverable) | config (doc, not code) | — | no code analog — deliverable format is free-form Markdown; model message shapes directly on `SwapSetCommand` (see Shared Patterns) | n/a (not code) |

---

## Pattern Assignments

### `src/lib/brainsApi.ts` (service, adapter seam — D-16)

**Analog:** `src/lib/astridrApi.ts` (module-scope env-flag idiom) — **no full two-implementation adapter precedent exists in this codebase.** Treat this as the one genuinely novel infrastructure piece (RESEARCH.md's own conclusion).

**Env-flag-read-once pattern to copy** (`src/lib/astridrApi.ts:1-2`):
```typescript
const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";
```
Follow this exact idiom — read once at module scope, never per-call:
```typescript
// src/lib/brainsApi.ts (recommended shape, from RESEARCH.md)
export interface BrainsAdapter {
  isStub: boolean;
  getCatalogue(): Promise<CatalogueEntry[]>;
  dispatchSwap(cmd: GatewayModelSetCommand): Promise<AckResponse>;
}
const BRAINS_STUB = (import.meta.env.VITE_BRAINS_STUB as string | undefined) === "true";
export const BRAINS_STUB_ACTIVE = BRAINS_STUB; // single source of truth for the STUB chip/banner (D-16)
export const brainsApi: BrainsAdapter = BRAINS_STUB ? stubBrainsAdapter : liveBrainsAdapter;
```

**Auth pattern** — any live-branch REST call inside `liveBrainsAdapter` MUST use `authHeaders()` (`src/lib/astridrApi.ts:117-121`):
```typescript
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
```
Per D-13 the write path is WS (`useCommandDispatch`), not REST — `authHeaders()` is only relevant if the catalogue read (D-17 discretion) ends up REST.

**Error handling pattern** — mirror `apiRequest`'s throw-typed-error shape (`astridrApi.ts:126-136`, `AstridrApiError`) if any REST call is added; otherwise rely on WS ack `status: "error"` (see `useCommandDispatch` below).

---

### `src/hooks/useActiveEngine.ts` (hook, CRUD reactive read)

**Analog:** `src/hooks/useProviderHealth.ts` (full file, verbatim):
```typescript
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useProviderHealth() {
  return useThrottledQuery(api.providerHealth.latest, {}, 5000) ?? {};
}
```
**Copy this exact shape** for `useActiveEngine`, substituting `api.activeEngine.latestByProfile` and returning a per-profile map (never `undefined`, per Pitfall 5 — a throwing/undefined `useQuery` unmounts every page using it since the badge is dashboard-wide):
```typescript
export function useActiveEngine() {
  return useQuery(api.activeEngine.latestByProfile) ?? {};
}
```
Whether to keep `useThrottledQuery`'s 5s throttle or a plain `useQuery` is Claude's discretion — swap state should feel closer to real-time than provider-health polling.

---

### `src/components/brains/BrainPicker.tsx` (component, request-response)

**Analog:** `src/components/control-center/BrainControl.tsx` (full file, 285 lines) — **this is the single most important analog in the phase.** Read the whole file before building; every one of its documented checkpoint-round lessons is a hard requirement, not a suggestion:

1. **Popover shell + trigger button** (lines 189-214) — `Popover`/`PopoverTrigger`/`PopoverContent`, `align="end"`.
2. **Live catalogue fetch on open, never cached** (lines 134-156):
```typescript
const fetchCatalogue = useCallback(async () => {
  setFetchError(false);
  setEntries(null);
  setFilter("");
  try {
    const ack = await sendCommand({ type: "swap.catalogue", target: "brain" });
    if (ack.status === "ok" && Array.isArray(ack.entries)) {
      setEntries(ack.entries as CatalogueEntry[]);
    } else {
      setFetchError(true);
    }
  } catch {
    setFetchError(true);
  }
}, [sendCommand]);

const handleOpenChange = (next: boolean) => {
  setOpen(next);
  if (next) void fetchCatalogue();
};
```
3. **Popover width `w-96` (not `w-64`)** (line 215) — Checkpoint Round 1 lesson: a ~300-entry catalogue needs the wider popover. Do not regress to a narrower default.
4. **Non-truncating wrapping rows** (lines 267-277) — rows are `<button>`, not fixed-height `Button`, with `whitespace-normal break-words`, **never** `truncate`. `BrainControl.test.tsx:209-228` has a regression test asserting exactly this — copy that test verbatim for the new picker's rows.
5. **Type-to-filter `Input`** (lines 230-237, 178-185) — filter over `name`/`vendor`, shown only once entries are loaded and non-empty.
6. **Provider/vendor section headers** (lines 96-122, 262-266) — `groupByVendor` partitions an already-sorted list into contiguous runs; **for Phase 103 the three fixed groups are Subscription/API/Local (D-07)**, not vendor — adapt the partition function's *shape* (contiguous-group builder), not its vendor-specific content. `formatVendorLabel`'s fallback-titleize pattern (lines 87-95) is reusable if any label needs the same "known map + generic fallback" treatment.
7. **Loading skeleton / error / empty / no-match states** (lines 240-261) — copy this exact four-state ladder (loading → fetch error → empty → filtered-to-nothing).
8. **Dispatch-then-close** (lines 158-176):
```typescript
const dispatchSelection = useCallback(
  async (value: string, restore = false) => {
    setPending(true);
    try {
      await sendCommand({ type: "swap.set", target: "brain", value: restore ? undefined : value, restore });
    } catch (err) {
      console.warn("Failed to dispatch manual brain swap:", err);
    } finally {
      setPending(false);
      setOpen(false);
    }
  },
  [sendCommand]
);
```
**Critical divergence from this analog:** `BrainControl` dispatches directly via raw `useAstridrWS().sendCommand` (the global runtime axis). Per the D-08 amendment, `BrainPicker`'s **"This profile" branch must go through `useCommandDispatch()` + `brainsApi` (stub/live D-16 seam)**, while its **"All profiles" branch dispatches the live `swap.set` exactly as `BrainControl` does** (reuse `swap.set`, do not invent a parallel global command). Do not let the two branches share one dispatch function that hides this distinction — D-16's stub indicator must attach only to the profile branch.

**Scope selector (D-08, new — no analog):** `toggle-group.tsx` primitive, "This profile"/"All profiles", 2 segments, reset-on-open. No existing toggle-group usage in this codebase to copy from structurally — compose the shadcn primitive directly per its own docs (already installed, no new package).

**Expensive/unknown-tier inline expansion (UI-SPEC §3, new — no analog):** no existing "row expands into a confirm state in place" component exists in this codebase. Build as local component state (`expandedRowId`) — nearest structural precedent is `ReminderList.tsx`'s `Collapsible`/`CollapsibleTrigger` usage (see below) for the *expand/collapse* mechanic, though semantics differ (confirm ritual, not detail disclosure).

---

### `src/components/brains/BrainPicker.test.tsx` (test)

**Analog:** `src/components/control-center/BrainControl.test.tsx` (full file, 351 lines) — **the template for every new picker test.** Copy its structure wholesale:
- Mock `useAstridrWS`/`useCommandDispatch` at module level with `vi.mock` (lines 6-14).
- `mockSendCommand.mockResolvedValue({...ack shape...})` per test.
- Assert exact dispatched command shape via `toHaveBeenCalledWith` (lines 140-147).
- The "never truncates" regression test (lines 209-228) — copy verbatim, adapt selector.
- The "re-fetches on every open, never caches" test (lines 275-298) — copy for D-16 catalogue-refetch semantics if applicable.
- The provider-grouping order test (lines 302-323) — adapt for Subscription/API/Local group order (D-07) instead of vendor order.

**New tests this file must add that `BrainControl.test.tsx` has no precedent for** (from RESEARCH.md's Validation Architecture):
- Scope selector resets to "This profile" on every open, except the mixed-badge entry exception.
- Pending overlay never optimistically flips the base label (D-15) — assert base label unchanged while `pending`.
- Partial-failure / expensive-tier fixtures — see RESEARCH.md "Fixtures that actually exercise the behavior."
- cmdk duplicate-value regression guard (Pitfall 3) — if `cmdk`'s `Command`/`CommandItem` is used (vs. BrainControl's plain `<button>` rows), assert `value={entry.id}` not `value={entry.name}`.

---

### `src/components/brains/BrainPickerRow.tsx` (component, transform)

**Analog:** `src/components/ProviderHealthPanel.tsx` (`ProviderCard`, lines 1-60) for the dot/name/billing-badge/quota-bar row *composition*, but **do not copy its hardcoded colors** — UI-SPEC explicitly calls this out as legacy:
```typescript
// ProviderHealthPanel.tsx:8-12, 29-35, 45-51 — DO NOT reuse these literals
const stateConfig: Record<string, { dot: string; label: string }> = {
  closed: { dot: "bg-green-500", label: "closed (ok)" },
  half_open: { dot: "bg-yellow-500", label: "half_open" },
  open: { dot: "bg-red-500", label: "open (tripped)" },
};
const dotColor = !data ? "bg-gray-600" : data.state === "open" ? "bg-red-500" : ...
const quotaBarColor = data?.quotaRemaining !== undefined
  ? data.quotaRemaining < 0.05 ? "bg-red-500" : data.quotaRemaining < 0.20 ? "bg-yellow-500" : "bg-emerald-500"
  : null;
```
**New rows must re-tokenize this exact threshold logic** (≥20% ok / 5–20% warn / <5% error is correct and should be kept) using `bg-(--status-ok)`/`bg-(--status-warn)`/`bg-(--status-error)` per UI-SPEC §3. Compose the shadcn `Progress` primitive (`progress.tsx`) for the bar itself — do not hand-roll a div bar as `ProviderHealthPanel`/`GatewayQuotaPanel` do (UI-SPEC + RESEARCH "Don't Hand-Roll" both flag this).

**Data source:** `useProviderHealth()` (`src/hooks/useProviderHealth.ts`, full file above) for the health dot; `PROVIDER_COLORS`/`PROVIDER_BILLING`/`PROVIDER_DISPLAY_NAMES` (`src/lib/providers.ts`, full file above) for the identity dot color and billing chip — this is the one documented hex exception (`providers.ts:38-46`), reuse the const, do not invent a second color source.

---

### `src/components/brains/GlobalSwapModal.tsx` (component, request-response) — **NO ANALOG, net-new**

No existing component in this codebase does "confirm modal → transitions in place into a per-row result state" (D-09/D-11/D-12). Nearest structural precedents, composed together:
- **Dialog shell:** any existing `dialog.tsx` consumer in `src/components/` — grep for `<Dialog` usage for the confirm/cancel footer pattern (none surfaced as a strong match during this pass; use the shadcn `dialog.tsx` primitive directly per its own API).
- **Per-row list with `current → new`:** no analog; build fresh per UI-SPEC §4.
- **Toast on dismiss with an action button:** `useCommandDispatch`'s toast wiring (below) plus `sonner`'s native `action: { label, onClick }` toast option (already a `sonner` capability, no new package) for the "Revert" action (D-10).

**Client-side fan-out for the global swap** (RESEARCH.md's Q5 recommendation, no existing precedent — new pattern):
```typescript
// Recommended shape — N single-profile commands, not a new server-side batch command
const results = await Promise.allSettled(
  profiles.map((p) => dispatch({ type: "gateway.model.set", profileId: p.profileId, model: targetModel }))
);
```
This satisfies D-12 (per-row honesty) for free — a `Promise.allSettled` result is naturally one outcome per profile.

---

### `src/components/brains/BrainHeaderBadge.tsx` (component, CRUD reactive read)

**Analog:** `src/components/voice/SwapBadge.tsx` (full file, 97 lines) — the honesty-of-state rules this component must inherit:
```typescript
// SwapBadge.tsx:46-63 — Badge + Tooltip pattern, read-only, no click-to-toggle
export function SwapBadge({ modelOverride, voiceOverride, lastModel }: SwapBadgeProps) {
  const brainLabel = modelOverride ?? lastModel ?? "Auto";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={modelOverride ? "gap-1 border-primary/30 bg-primary/10 text-primary font-mono text-[10px] tracking-wide" : "gap-1 border-border bg-muted/30 text-muted-foreground font-mono text-[10px] tracking-wide"}>
          <Brain className="h-3 w-3" aria-hidden="true" />
          Brain: {brainLabel}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{/* honest, state-dependent copy */}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```
**Adapt, don't copy the icon:** RESEARCH.md flags a vocabulary/icon collision — `SwapBadge` already uses the `Brain` Lucide icon on the Chat page for the *global runtime* axis. UI-SPEC 103 deliberately uses **color dots, not the `Brain` icon**, for this *per-profile* badge — preserve that differentiation, do not reuse `Brain` here.

**Host insertion point:** `src/layouts/DashboardLayout.tsx:576-588` — the existing status cluster, already wrapped in `TooltipProvider` (line 576):
```tsx
<TooltipProvider delayDuration={300}>
<div className="flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10">
  <EStopButton />
  <div className="w-px h-4 bg-primary/20 mx-1" />
  {/* NEW: BrainHeaderBadge goes here, leftmost after EStopButton per UI-SPEC §2 */}
  <NotificationBell />
  <PrivacyShield />
  <ThemeSwitcher />
  <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
  <AmbientAudioPlayer />
  <div className="w-px h-4 bg-primary/20 mx-1" />
  <UserMenu />
</div>
</TooltipProvider>
```
No new hotkey — `Ctrl+K` is owned by this same file's keydown handler (lines 439-473, specifically line 447), `Ctrl+Shift+K` by `SkillCommandPalette.tsx:53`. Confirmed no collision risk since the badge opens by click only (D-05/UI-SPEC).

**Mixed-state honesty rule** (structurally identical to `SwapBadge`'s "never guess" pattern, applied to N profiles instead of 1) — never silently pick one profile's value; render "Mixed brains" + stacked dots per UI-SPEC §2.

---

### `convex/activeEngine.ts` (model/service, event-driven ingest + CRUD read)

**Analog:** `convex/gatewayQuota.ts` (full file, 135 lines) — copy this file's shape near-verbatim, per RESEARCH.md's explicit recommendation ("a straight rename of this exact pattern"):

**Dedup-latest-by-key helper** (`gatewayQuota.ts:15-25`, verbatim — rename `provider`→`profileId`):
```typescript
export function deduplicateByProvider<T extends { provider: string; timestamp: number }>(
  rows: T[]
): T[] {
  const byProvider = new Map<string, T>();
  for (const row of rows) {
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, row);
  }
  return Array.from(byProvider.values());
}
```

**Latest-by-key query** (`gatewayQuota.ts:123-134`):
```typescript
export const latestByProvider = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("gatewayQuotaSnapshots").withIndex("by_timestamp").order("desc").take(100);
    return deduplicateByProvider(rows);
  },
});
```

**Ingest-write mutation shape** — mirror `insertSnapshot` (`gatewayQuota.ts:103-117`):
```typescript
export const insertSnapshot = internalMutation({
  args: { /* ...typed args mirroring the emitted event... */ },
  handler: async (ctx, args) => {
    await ctx.db.insert("gatewayQuotaSnapshots", { ...args });
  },
});
```
Whether the new table's write mutation is `internalMutation` (write only via ingest, matching `gatewayQuota.insertSnapshot`) or a public `mutation` (matching `profiles.upsertConfig`, called both from ingest AND potentially from a swap ack-reconciliation path) is Claude's discretion — but per D-14, the UI must never call a write mutation directly to assert the active engine; only the ingest path writes it.

**Config audit trail freebie** — if the per-profile pinned-default write ever lands in `profileConfigs.modelPreferences` (as opposed to the separate active-engine telemetry table), it gets `configChanges` auditing for free via the existing `upsertConfig` logic (`convex/profiles.ts:109-127`, exact excerpt below in Shared Patterns). Do NOT duplicate this audit-write logic in `activeEngine.ts` — the two tables have different jobs (D-03: persisted default vs. D-14: live resolved engine) and only the *persisted default* write path (in `profiles.ts`, not `activeEngine.ts`) should carry the audit row.

---

### `convex/schema.ts` (append-only migration — new `activeEngine`-style table)

**Analog:** `convex/schema.ts:1540-1551` `gatewayQuotaSnapshots` table definition (verbatim shape to follow):
```typescript
gatewayQuotaSnapshots: defineTable({
  provider: v.string(),
  billingType: v.string(),
  usedToday: v.float64(),
  dailyLimit: v.optional(v.float64()),
  spendUsd: v.float64(),
  spendCapUsd: v.optional(v.float64()),
  remainingPct: v.float64(),
  timestamp: v.float64(),
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```
New table needs the equivalent `by_profileId` + `by_timestamp` compound/simple indexes (matching this table's `["provider", "timestamp"]` compound-index idiom, substituting `profileId`). **Safe under the self-hosted Convex rule** — this is a pure additive schema change (CLAUDE.md "Self-Hosted Convex — Operational Rules"), not a bulk mutation on existing rows.

Also reference `convex/schema.ts:508-517` `profileConfigs` (the D-06 real source table — confirm `by_profileId` index already exists there for `listConfigs`/row-lookup reuse) and `convex/schema.ts:85-97` `agentProfiles` (confirmed empty per `profiles.ts:113` comment — do not add a foreign key or join expecting rows here beyond optional `displayName`/`avatarId` enrichment).

---

### `convex/runtimeIngest.ts` (controller, event-driven — add `model_routing` case)

**Analog:** the file's own existing case pattern — e.g. `case "provider_health"` (~line 835) and `case "profile_config"` (~line 512), both in the same file:
```typescript
// convex/runtimeIngest.ts:835-847 — same dual snake/camel-case coalescing idiom
case "provider_health": {
  const d = data as any;
  await ctx.runMutation(api.providerHealth.upsert, {
    providerName: d.providerName ?? d.provider_name ?? d.name ?? "unknown",
    state: d.state ?? "unknown",
    latencyEmaMs: d.latencyEmaMs ?? d.latency_ema_ms ?? 0,
    successRate: d.successRate ?? d.success_rate ?? 0,
    consecutiveFailures: d.consecutiveFailures ?? d.consecutive_failures ?? 0,
    lastSuccessAt: d.lastSuccessAt ?? d.last_success_at ?? 0,
    timestamp,
  });
  break;
}
```
```typescript
// convex/runtimeIngest.ts:512-524 — profile_config case, closest to the new table's shape
// (also demonstrates the changedBy: "astridr-sync" convention — WR-07)
case "profile_config": {
  const d = data as any;
  await ctx.runMutation(api.profiles.upsertConfig, {
    profileId: d.profileId ?? d.profile_id ?? "unknown",
    channels: d.channels,
    budget: d.budget,
    modelPreferences: d.modelPreferences ?? d.model_preferences,
    changedBy: "astridr-sync",
  });
  break;
}
```
**New case** (name TBD by `103-CONTRACT.md`, RESEARCH.md's assumption is `model_routing`) must follow the identical dual-coalescing (`d.profileId ?? d.profile_id ?? "unknown"`) defensive-boundary convention this whole switch statement uses — confirmed live and load-bearing per the WR-06/168-06 lesson embedded in this file's own comments (lines 128-141: a single unhandled `null` poisoned an 8-event batch in production). Route to `api.activeEngine.recordRouting` (or equivalent) as a new `case` inside this exact switch, alongside the ~40 existing cases — **do not create a second ingest endpoint.**

**Confirmed absent today** (per RESEARCH.md and CONTEXT.md): no `case "model_routing"` exists anywhere in this file currently — this is a pure addition, no existing case to remove/replace.

---

### `src/pages/Chat.tsx` (modify — composer pill, D-05 CORRECTED host)

**Analog:** the file's own existing composer JSX (lines 511-539) — insert a **new row above** this block, not inside it:
```tsx
{/* Input */}
<div className="border-t border-border/60 p-3">
  <div className="flex items-end gap-2">
    <textarea rows={1} value={draft} onChange={...} onKeyDown={onKeyDown} disabled={disconnected}
      placeholder={disconnected ? "Reconnecting…" : "Type or speak to Ástríðr…"}
      className="flex-1 resize-none max-h-32 rounded-xl bg-background border border-border px-3.5 py-3 text-sm ..." />
    <button type="button" onClick={submit} disabled={!draft.trim() || isStreaming || disconnected}
      className="w-11 h-11 shrink-0 rounded-xl grid place-items-center bg-primary/15 border border-primary/40 ...">
      <Send className="w-4 h-4" />
    </button>
  </div>
  <p className="mt-2 font-mono text-[10px] ...">{/* status caption */}</p>
</div>
```
**UI-SPEC note:** the spec's §1 text still says "mirrors the skill-chip-row precedent in `Chat.tsx`" and cites `ChatInput.tsx`/line 494 — per the CONTEXT.md 2026-07-28 correction, **that citation is stale**; there is no skill-chip row at Chat.tsx:494 and no `ChatInput.tsx` import in this file. Build the pill as a new `<div>` row directly above the existing `{/* Input */}` block shown above, inside the same `border-t border-border/60 p-3` container or immediately preceding it — do not attempt to locate a nonexistent precedent row.

**Existing swap-state wiring in this same file** (lines 171-248) is the reactive pattern this new pill's *global*-scope branch should reuse (seeded via `swap.get_state`, kept live via `swap.state` subscription) — see `SwapBadge` analog above for the display half; this section is the *data-fetch* half, already proven in this exact file.

---

### `src/pages/Settings.tsx` (modify — replace stale rows in place, D-06)

**Analog:** the file's own existing "Agent Profiles" section (lines 630-678) — this is the exact block D-06 replaces in place:
```tsx
{profiles.map((p) => (
  <div key={p._id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2">
    <AgentAvatar avatar={getAvatar(p.avatarId)} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-base text-foreground truncate">{p.displayName || p.name}</p>
      <p className="text-sm text-muted-foreground truncate">
        {p.profileId} {p.model ? `/ ${p.model}` : ""}   {/* ← STALE READ, line 663 */}
      </p>
    </div>
    <button onClick={() => setEditingProfile(p)} className="...">Edit</button>
  </div>
))}
```
**Re-source `p.model`** (from `agentProfiles`, confirmed empty) with a live lookup keyed by `p.profileId` into `useActiveEngine()`'s per-profile map (from `profileConfigs` via `api.profiles.listConfigs`, confirmed populated — `convex/profiles.ts:188-197`). Add the swap affordance as a new button beside "Edit" (kept separate — UI-SPEC §9: "swapping the brain is not profile editing"). Existing `SectionErrorBoundary name="Agent Profiles"` wrap (this file, line 632) already covers this section — no new boundary needed, but confirm the new `useActiveEngine()` call sits inside it, not above it.

---

### `e2e/brain-swap.spec.ts` (new, E2E)

**Analog:** `e2e/analytics-cache-tile.spec.ts` (full file, 34 lines) — copy this structure:
```typescript
import { test, expect } from '@playwright/test';

test.describe('...', () => {
  test('...', async ({ page }) => {
    await page.goto('/...');
    if (await page.getByText('Sign in to access the telemetry dashboard').count()) {
      test.skip(true, 'Clerk auth gate present — run e2e without VITE_CLERK_PUBLISHABLE_KEY');
    }
    await expect(page.getByText('...')).toBeVisible();
    // ... structural assertions, not exact live-data values
  });
});
```
Assert structure against the **stub adapter's fixture data** (per RESEARCH's Wave 0 gap and honesty boundary) — never assert a specific live engine name, since `VITE_BRAINS_STUB=true` is the only mode this phase can test end-to-end.

---

## Shared Patterns

### Command Dispatch (WS, with toast)
**Source:** `src/hooks/useCommandDispatch.ts` (full file, 33 lines, verbatim):
```typescript
export function useCommandDispatch() {
  const { sendCommand, status } = useAstridrWS();
  const dispatch = useCallback(
    async (cmd: Record<string, unknown>, successMsg?: string): Promise<AckResponse> => {
      const result = await sendCommand(cmd);
      if (result.status === "ok" && successMsg) toast.success(successMsg);
      if (result.status === "error") toast.error(result.error ?? "Command failed");
      return result;
    },
    [sendCommand]
  );
  return { dispatch, isConnected: status === "connected" };
}
```
**Apply to:** `BrainPicker` (per-profile branch), `GlobalSwapModal` (fan-out branch), `Settings.tsx`'s new swap button.
**Do NOT pass `successMsg`** to `dispatch()` for `gateway.model.set` — `"ok"` means "accepted," not "engine switched" (D-14). Fire the real success toast from a separate effect diffing the reactive `useActiveEngine()` query before/after.

### Real WS command shape to model the new per-profile command after
**Source:** `astridr-repo/astridr/api/ws_commands.py:224-240` (`SwapSetCommand` — real, shipped; **do not model on the dead `gateway.provider.set_enabled`**, `src/components/ProviderControls.tsx:188`, which has zero server-side handlers):
```python
class SwapSetCommand(BaseModel):
    type: Literal["swap.set"] = "swap.set"
    request_id: str = ""
    target: Literal["brain", "voice"]
    value: str | None = None
    restore: bool = False
```
`103-CONTRACT.md`'s `gateway.model.set` should follow this exact idiom (discriminated `type` Literal + `request_id` + small enum/bool discriminator), per D-13's correction.

### Config Audit Trail (free side-effect)
**Source:** `convex/profiles.ts:109-127` (verbatim) — fires automatically whenever a swap lands in `profileConfigs.modelPreferences`:
```typescript
if (
  args.modelPreferences !== undefined &&
  JSON.stringify(args.modelPreferences) !== JSON.stringify(existing?.modelPreferences)
) {
  await ctx.db.insert("configChanges", {
    configKey: personaConfigChangeKey(args.profileId), // `profile.${profileId}.modelPreferences`
    oldValue: existing?.modelPreferences,
    newValue: args.modelPreferences,
    changedBy: args.changedBy ?? "dashboard",
    changedAt: now,
  });
}
```
**Apply to:** nothing new needs to be written — this fires for free if/when the per-profile *persisted default* write path reuses `profiles.upsertConfig`. Do not duplicate this logic in `activeEngine.ts` (that table holds the separate live-telemetry axis, D-14).

### Error Isolation
**Source:** `src/pages/Settings.tsx` (5 existing `<SectionErrorBoundary name="...">` wraps, e.g. line 632 `"Agent Profiles"`).
**Apply to:** the Settings per-profile section (already wrapped — verify the new live-engine query stays inside it), and any new dashboard-wide surface (the header badge is rendered on every page via `DashboardLayout` — wrap it explicitly even though `DashboardLayout` itself has no existing `SectionErrorBoundary` around its status cluster; add one, since Pitfall 5 says a throwing `useQuery` here blanks every page).

### Popover Idiom
**Source:** `src/components/reminders/ReminderList.tsx:1-36` imports (`Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`) — the same idiom `BrainControl.tsx` itself is documented as following (its own docstring cites this file). Also note `ReminderList.tsx`'s `Collapsible`/`CollapsibleTrigger` import as the nearest *expand-in-place* mechanic precedent for the picker row's expensive-tier inline expansion (UI-SPEC §3), though no existing component combines Popover-row + inline-expand — this composition is new.

### Provider Identity / Health / Billing
**Source:** `src/lib/providers.ts` (full file, verbatim) — `PROVIDER_COLORS` (line 38, the one documented hex exception), `PROVIDER_BILLING`, `PROVIDER_DISPLAY_NAMES`, `GATEWAY_PROVIDERS`/`LEGACY_PROVIDERS` (the Subscription/API split D-07's grouping is inferred from).
**Apply to:** `BrainPickerRow.tsx`'s dot color and billing chip.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/brains/GlobalSwapModal.tsx` | component | request-response (batch + result-state transition) | No existing component in this codebase does "confirm modal that mutates in place into a per-row result state." Build fresh per UI-SPEC §4/§5/§6, composing `dialog.tsx` + the client-side `Promise.allSettled` fan-out pattern (RESEARCH.md Q5) — no server-side batch command exists or should be built. |
| `src/lib/brainsApi.ts` (the two-implementation adapter shape itself) | service | — | RESEARCH.md explicitly flags this as new-to-this-codebase: Clerk's env-gated skip is a single-branch conditional, not a full interface-with-two-implementations. Treat with correspondingly more test care (contract-conformance test is not optional). |
| Picker's scope-selector `toggle-group.tsx` usage | component | — | No existing `toggle-group.tsx` consumer was found in this codebase to copy structural usage from — compose the shadcn primitive directly against its own API (already installed, no new package; not a missing-dependency risk, just no in-repo precedent to lift code from). |

---

## Metadata

**Analog search scope:** `src/components/control-center/`, `src/components/voice/`, `src/components/reminders/`, `src/hooks/`, `src/lib/`, `src/pages/`, `src/layouts/`, `convex/` (schema.ts, runtimeIngest.ts, profiles.ts, gatewayQuota.ts, providerConfig.ts), `e2e/`
**Files scanned (read in full or targeted ranges):** `BrainControl.tsx`, `BrainControl.test.tsx`, `SwapBadge.tsx`, `VoiceControl.tsx`, `useCommandDispatch.ts`, `gatewayQuota.ts`, `runtimeIngest.ts` (full switch), `profiles.ts` (full file), `useProviderHealth.ts`, `Settings.tsx` (600-690), `DashboardLayout.tsx` (430-620), `astridrApi.ts` (full file), `providers.ts` (full file), `Chat.tsx` (160-260, 470-540), `ControlCenterPanel.tsx` (1-70), `ProviderControls.tsx` (160-210), `ReminderList.tsx` (1-60), `ProviderHealthPanel.tsx` (1-60), `schema.ts` (agentProfiles, profileConfigs, gatewayQuotaSnapshots), `analytics-cache-tile.spec.ts` (full file)
**Pattern extraction date:** 2026-07-28
