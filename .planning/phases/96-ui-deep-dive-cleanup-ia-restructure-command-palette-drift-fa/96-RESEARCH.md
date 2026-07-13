# Phase 96: UI deep-dive cleanup — IA restructure, command palette drift, fake telemetry, and consistency fixes - Research

**Researched:** 2026-07-13
**Domain:** Frontend cleanup/consistency over an existing React 19 + Convex + shadcn/ui SPA (no new capabilities)
**Confidence:** HIGH — every finding below was independently re-verified against live source in this session (not just re-stated from FINDINGS.md), including the one item CONTEXT.md flagged as needing cross-repo verification (F6).

## Summary

This is a pure cleanup/consistency phase over 35 existing pages — no new libraries, no new architecture, no new Convex tables. The work is: (1) an IA restructure that's a config-array edit (`navGroups` in `DashboardLayout.tsx`), (2) fixing a manually-duplicated nav list that drifted (`CommandPalette.tsx`), (3) replacing three fabricated/hardcoded UI values with real Convex data or honest removal (header telemetry, Security audit badge, Automation cron fallback), (4) deleting ~900 lines of dead orphaned page code, (5) closing a genuinely broken cross-repo WS contract bug in one of two divergent approval senders, and (6) standardizing page headers/mobile panes/token usage across the page set.

The highest-risk item is **F6 (approval unification)** — this research independently re-verified the Ástríðr WS handler contract (`astridr-repo/astridr/api/ws_commands.py`) and confirms **Chat.tsx's approval sender is broken today**: its payload shape does not match the Pydantic `ApprovalRespondCommand` model the server validates against, and because Chat calls `sendCommand` without awaiting/checking the ack, the UI shows a false "Approved" success toast even when the server rejects the command. This is not a hypothesis — it is confirmed by reading the live model definition. Inbox.tsx's shape is correct. This means D-11's "fix whichever sender is wrong" resolves unambiguously to: **make Chat.tsx match Inbox.tsx's shape**, no further cross-repo work needed before extraction.

The second-highest-risk item is **F3 (header telemetry)**: the CONTEXT.md decision (D-04) says wire `SYS:`/`LAT:` to `systemResources` via Convex, but the actual `api.systemResources.current` query returns `{cpu, ram, disk}` — **there is no latency field**. `SYS:` maps cleanly to `cpu`; `LAT:` has no server-side source in that query and needs either the already-proven WS ping pattern from `ConnectionPopover.tsx` (client-side round-trip, zero new backend code) or a new aggregate over `providerHealth.latencyEmaMs` (different semantic meaning — LLM provider latency, not system latency). This must be resolved as a discretion call during planning, not assumed.

The Mission Control/Tasks merge (F1/D-01/D-02) is lower-risk than it first appears: `convex/missionControl.ts`'s `listTasksByAgent`/`reassignTask` already query and mutate the **same `tasks` Convex table** as `Tasks.tsx` (filtered/grouped differently) — there is no schema divergence and no data migration required, only a UI-view merge.

**Primary recommendation:** Sequence the phase in the order CONTEXT.md's "Ordering ... Claude's Discretion" leaves open, but put **F6's cross-repo verification first** (it's already done by this research — see Code Examples) so the shared approval component isn't built on top of ambiguity, then do F2 (CommandPalette, small blast radius, unblocks nothing else) and F5 (delete orphans, zero risk) early, then F1/F3/F4 (config + data wiring), and F7/F8/F9/F10 (the 35-page sweep) last since `<PageHeader>` migration touches every page and should land after the higher-risk structural changes are stable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nav IA (navGroups, CONSOLE dissolve) | Frontend Client (React SPA) | — | Pure client-side config array in `DashboardLayout.tsx`; no backend involvement |
| CommandPalette nav sync | Frontend Client | — | Import-swap of an existing client-side export (`navItems`); icon-map sharing needed (see Pitfalls) |
| Header telemetry (SYS/LAT) | Frontend Client (render) | API/Backend (Convex query) | Convex owns the data (`systemResources.current`, or WS ping RTT computed client-side); React owns show/hide logic |
| Security "Valid" badge removal | Frontend Client | — | Pure UI copy/removal; no backend change (the underlying `mergedEvents` query is unaffected, only its label) |
| Automation cron catalog honesty | Frontend Client | API/Backend (Convex query, unchanged) | `api.automation.cronSummary` stays as-is; only the static `CRON_SCHEDULES` presentation layer and fallback literal change |
| Orphan page deletion (Profiles/Agents) | Frontend Client | — | Dead route components + their `App.tsx` imports; already redirected, zero backend touch |
| Approval flow (Chat/Inbox → Ástríðr) | Frontend Client (sender) | API/Backend (Ástríðr WS handler, cross-repo, contract-only — no code change expected there) | The contract is owned by `astridr-repo`'s `ApprovalRespondCommand`; CodePulse is the client that must conform, not the other way around |
| PageHeader / FactsTable / mobile panes / tokens | Frontend Client | — | All presentation-layer; shadcn/ui primitives, Tailwind classes, CSS custom properties |

## Standard Stack

**No new packages are needed for this phase.** This is a cleanup phase over an existing, fully-provisioned stack (React 19.2, Vite 8, TypeScript 6, Convex 1.42, Tailwind CSS 4, shadcn/ui New York, `@dnd-kit/*` 6/10/3, `sonner` 2, `react-router-dom` 7) — confirmed current in `package.json` at research time. Every component this phase needs (shared `<PageHeader>`, `<FactsTable>`, shared approval component, Tasks view toggle) is buildable from existing `src/components/ui/` shadcn primitives (`Tabs`/`Select`/segmented-control-via-`Button` group, `Table`, `AlertDialog`) already used elsewhere in the app.

**Package Legitimacy Audit: N/A — no packages are installed by this phase.** Skip the audit gate; nothing to verify.

## Architecture Patterns

### System Architecture Diagram (approval flow — the F6 fix)

```
Chat.tsx / Inbox.tsx (approve/reject click)
        │
        ▼
  useAstridrWS().sendCommand(cmd)          ← client wrapper (AstridrWSContext.tsx:392-410)
        │  auto-injects: { ...cmd, request_id: crypto.randomUUID() }   ← WS correlation id, NOT the HITL request id
        ▼
  WebSocket → Ástríðr backend (astridr-repo)
        │
        ▼
  ws_commands.py: dispatch() → TypeAdapter.validate_python(raw)   ← Pydantic validation gate
        │
        ├─ FAILS validation → ack {status:"error", error: <ValidationError text>}   ← Chat.tsx never checks this (fire-and-forget)
        │
        └─ PASSES → _handle_approval_respond(cmd: ApprovalRespondCommand)
                       cmd.request_id_target  (the HITL UUID)
                       cmd.decision            ("approve" | "reject")
                       → gate.respond(request_id_target, approved=(decision=="approve"))
                       → future.set_result(approved)   ← unblocks the awaiting agent tool call
```

`ApprovalRespondCommand` (server-side Pydantic model, `astridr-repo/astridr/api/ws_commands.py:95-100`) requires exactly `type`, `request_id`, `request_id_target`, `decision` (`"approve"|"reject"`), optional `comment`. **Chat.tsx sends `requestId` (camelCase, wrong key — silently ignored) and `approved: boolean` (wrong shape — server has no such field) instead of `request_id_target`/`decision`.** Every Chat.tsx approval fails Pydantic validation server-side and returns an ack error — which Chat.tsx never reads because it calls `void sendCommand(...)` and shows `toast.success(...)` unconditionally.

### Recommended Project Structure (files this phase touches, not a folder change)

```
src/
├── layouts/DashboardLayout.tsx   # navGroups (F1), navItems export (F2 source), header telemetry (F3)
├── components/
│   ├── CommandPalette.tsx        # NAV_PAGES → navItems import (F2)
│   ├── HeroStatsBar.tsx          # stale /agents deep link (F2, line 54)
│   ├── PageHeader.tsx            # NEW — F7 shared component
│   ├── FactsTable.tsx            # NEW — D-09 shared component
│   └── ApprovalActions.tsx       # NEW (name TBD) — D-11 shared component, built AFTER F6 sender fix
├── pages/
│   ├── Tasks.tsx                 # merge target (D-01), gains "By Status"/"By Agent" toggle
│   ├── MissionControl.tsx        # DELETED after merge (D-02); /mission-control → redirect
│   ├── Chat.tsx / Inbox.tsx      # F6 sender fix + shared component consumption
│   ├── Security.tsx              # F4 — remove "Valid" badge, relabel entry count, remove Provider Allowlist sub-block only
│   ├── Automation.tsx            # F4 — drop `?? 12` fallback, relabel cron section
│   ├── Infrastructure.tsx        # F4 — remove entire Network Policy placeholder section
│   ├── Profiles.tsx, Agents.tsx  # DELETED (F5/D-08)
│   ├── Memory.tsx, Dreaming.tsx  # consume new <FactsTable> (D-09)
│   ├── MeetingBot.tsx            # useRosterAgents() replaces hardcoded 6 names (D-10)
│   ├── Skills.tsx                # remove no-op onDelete (D-10)
│   ├── ForgePage.tsx, WarRoom.tsx # mobile collapse (F8)
│   └── ...31 more pages          # <PageHeader> migration (F7)
└── App.tsx                       # remove Profiles/Agents imports (F5), /mission-control redirect (D-02)
```

### Pattern 1: Config-array nav restructure (F1)

**What:** `navGroups` (`DashboardLayout.tsx:140-210`) is a flat TS array of `{group, items: [{to, label, icon, group}]}`. `navItems` (`:214-226`) is derived automatically by flattening + dedup-by-`to`, already exported (`:795`) specifically for CommandPalette.
**When to use:** Any nav change is an edit to this one array — no separate "route registry" to keep in sync for the sidebar itself.
**Gotcha:** `navItems`'s `icon` field is a **string key** (`"flame"`, `"kanban"`), not a component reference — it's resolved via `iconComponents` (`:79-119`), a `Record<string, React.ElementType>` that is **not exported**. Any consumer of `navItems` outside `DashboardLayout.tsx` (i.e., CommandPalette after the F2 fix) needs its own icon resolution — either `iconComponents` gets exported too, or CommandPalette keeps a parallel (but now string-key-driven, so trivially diffable) icon map.

```typescript
// Source: src/layouts/DashboardLayout.tsx:212-226 (already shipped)
const navItems = (() => {
  const seen = new Set<string>();
  const flat: NavItem[] = [];
  for (const grp of navGroups) {
    for (const item of grp.items) {
      if (item.placeholder || !item.to) continue;
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      flat.push(item);
    }
  }
  return flat;
})();
export { navItems };
```

### Pattern 2: Convex query returns `null`/partial-null for "no data yet" — honesty pattern already established (F3/F4)

**What:** `systemResources.current` (`convex/systemResources.ts`) returns `null` for the whole object when zero data sources have anything, but can also return a non-null object with individual fields (`cpu`, `ram`, `disk`) still `null` when only some sources are populated.
**When to use:** Any "hide when absent" telemetry fix (D-04) must check the field, not just the object:
```typescript
// Correct pattern (mirrors the query's own null-per-field contract)
const resources = useQuery(api.systemResources.current);
const showSys = resources?.cpu != null;
```
Never render `resources ? ... : "—"` — that only guards the whole-object case and would still render a fabricated dash-as-zero for a partially-null response, or worse, `0%` if a naive `resources?.cpu ?? 0` slips in.
**Note:** This query has **no latency field**. See Open Questions.

### Pattern 3: Shared Convex table, divergent view components — safe to merge (F1/D-01)

`Tasks.tsx` reads `anyApi.tasks.listByColumn`; `MissionControl.tsx` reads `api.missionControl.listTasksByAgent`, which is:
```typescript
// Source: convex/missionControl.ts (verified, unchanged this phase)
export const listTasksByAgent = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tasks").withIndex("by_column").collect();
    return all.filter((t) => t.agentId !== undefined);
  },
});
```
Both functions query the **same `tasks` table** — `missionControl.ts` is a thin filter/view over it, not a parallel data model. The merge (D-01/D-02) is a pure UI-composition problem: the "By Agent" view toggle can literally reuse `listTasksByAgent`/`reassignTask` as-is (or fold their logic into `tasks.ts` while typing them properly, closing the F10 `anyApi`/`as any` cleanup in the same pass since D-10's "type it while merging" note already anticipates this). **No data migration, no schema change.**

### Anti-Patterns to Avoid

- **Fire-and-forget `sendCommand` for user-facing state changes:** `Chat.tsx`'s `void sendCommand(...)` + unconditional `toast.success(...)` is exactly how the broken approval path went undetected — the UI lied about success. Any WS command whose failure the user needs to know about must `await` the `AckResponse` and branch on `ack.status`, matching `Inbox.tsx`'s existing pattern (`ack.status !== "ok" → toast.error(ack.error ?? ...)`).
- **Trusting a hardcoded number that happens to currently match reality:** `Automation.tsx:89`'s `totalJobs ?? 12` fallback is not a stale bug by accident — `CRON_SCHEDULES.length` is *also* 12 today (`src/lib/cronSchedules.ts`, 12 entries), meaning the original author snapshotted the list length as a fallback constant. It will silently go wrong the next time a schedule is added/removed. The honest replacement is the **computed** `CRON_SCHEDULES.length`, not a re-hardcoded number.
- **Deleting a whole tab/section because part of it is a placeholder:** Security.tsx's "Network Policy" tab (`:422-482`) contains TWO sub-sections — the empty "Provider Allowlist" placeholder (`:425-444`, in scope for D-07 removal) and a **live, Convex-backed** "Network Access Log" (`:446-479`, driven by real `networkPolicyEvents`, already following the established empty-state copy pattern). D-07 removes only the allowlist placeholder; the access log stays. Removing the whole tab would delete working functionality.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WS round-trip latency measurement | A new ping mechanism for the header LAT: readout | The existing pattern in `src/components/ConnectionPopover.tsx:90-107` (`performance.now()` before ping, `setLatencyMs` on response, 30s interval) | Already implemented, tested-in-production pattern for exactly this metric; reusing it means zero new Convex code for LAT: |
| Segmented view toggle (Tasks "By Status"/"By Agent") | A custom two-button component from scratch | Compose existing shadcn `Tabs` (used elsewhere for exactly this shape, e.g. Security.tsx's tab pattern) or a `Button`-group with `aria-pressed`, per UI-SPEC's "quiet control, accent only on active segment" | Consistency with the rest of the app's tab/toggle affordances; UI-SPEC already specifies the visual treatment, not the primitive — use what's already in `src/components/ui/` |
| Approval request/response typing | Loosely-typed `Record<string, unknown>` command objects (current state in both Chat and Inbox) | A shared TS type for `ApprovalRespondCommand` mirroring the Pydantic model 1:1 (`request_id_target: string; decision: "approve" \| "reject"; comment?: string`) | Prevents the exact class of bug this research found — a silent shape mismatch between client and server with no compile-time signal |

**Key insight:** Every "don't hand-roll" here is really "don't re-diverge from a pattern that already exists once in this codebase" — the whole phase is about collapsing accidental duplication (two nav lists, two approval senders, two facts tables, 31 divergent page headers), not introducing new abstractions.

## Common Pitfalls

### Pitfall 1: CommandPalette's icon system is incompatible with `navItems`' string-keyed icons
**What goes wrong:** A naive `import { navItems } from "../layouts/DashboardLayout"` swap in `CommandPalette.tsx` compiles but renders nothing for the icon, because `navItems[i].icon` is `"flame"` (a string) and `CommandPalette`'s current rendering expects a component reference (`Icon` from its own local `NAV_PAGES` shape).
**Why it happens:** The two files evolved the same nav data independently with different type shapes.
**How to avoid:** Export `iconComponents` (or a resolver function) from `DashboardLayout.tsx` alongside `navItems`, and have `CommandPalette` look up `iconComponents[item.icon] ?? LayoutDashboard` — mirroring the exact fallback DashboardLayout itself uses (`:252`).
**Warning signs:** TypeScript won't catch this (both are valid strings/components in their own contexts) — only a visual check (missing icons in ⌘K) or a snapshot test would catch it.

### Pitfall 2: `systemResources.current` has no latency field — D-04's stated data source is incomplete
**What goes wrong:** Planning "wire LAT: to `systemResources`" as a single task will stall or produce a fabricated number, because the query genuinely has nothing to return for latency.
**Why it happens:** CONTEXT.md's D-04 was written assuming both SYS and LAT come from the same query; they don't.
**How to avoid:** Split into two data-source decisions: SYS: from `systemResources.current.cpu` (real, already exists); LAT: from either (a) the `ConnectionPopover.tsx` WS-ping pattern lifted to header scope (recommended — zero new backend code, matches "Astridr Runtime Telemetry" framing since it measures the actual live connection), or (b) a new Convex query aggregating `providerHealth.latencyEmaMs` (measures LLM provider latency, a different and arguably less honest label for "LAT" under a runtime-telemetry banner).
**Warning signs:** If a plan task says "wire SYS/LAT to systemResources" as one unit without naming two separate data sources, it will hit this wall mid-implementation.

### Pitfall 3: Fire-and-forget WS commands hide server-side validation failures
**What goes wrong:** Exactly the bug this research found in Chat.tsx — `void sendCommand(...)` plus an unconditional success toast means a broken payload shape ships to production undetected, because no error is ever surfaced to a human or a test.
**Why it happens:** `sendCommand` returns a `Promise<AckResponse>`; not awaiting it is syntactically valid and "looks done."
**How to avoid:** Any WS command that represents a user-visible state change (approve/reject, not fire-and-forget telemetry commands like `alerts.mute_all`) must await the ack and branch on `status`, per the `Inbox.tsx` pattern already in the codebase.
**Warning signs:** A `toast.success(...)` that appears immediately after `sendCommand(...)` with no `await`/`.then()` in between is the tell.

### Pitfall 4: Deleting orphaned pages without grepping the whole src tree first
**What goes wrong:** `Profiles.tsx`/`Agents.tsx` deletion is confirmed safe in this research (grep found exactly one import site each, both in `App.tsx`), but this is a live fact about the current tree, not a guarantee — any new import added between research and execution (unlikely in a short cleanup phase, but the check is cheap) would break the build.
**How to avoid:** Re-run `grep -rn "pages/Profiles\|pages/Agents[\"']" src/` immediately before deleting, as the actual delete task's verification step, not just once during research.

### Pitfall 5: `anyApi` untyped Convex access masks shape mismatches at compile time
**What goes wrong:** `Tasks.tsx` uses `anyApi.tasks.listByColumn`/`anyApi.tasks.moveColumn`/`anyApi.tasks.create` — none of these calls get TypeScript's normal Convex codegen type-checking. Merging in Mission Control's typed `api.missionControl.*` calls into the same page creates a file with two different type-safety regimes.
**How to avoid:** Per D-10's own note ("type it while merging"), swap `anyApi` → `api` for the Tasks-table calls in the same wave as the merge, not as a follow-up — the merge touches this exact file anyway, so it's a low-marginal-cost fix with no separate blast radius.

## Code Examples

### Verified: the correct `approval.respond` payload shape (F6 fix target for Chat.tsx)

```typescript
// Source: astridr-repo/astridr/api/ws_commands.py:95-100 (Pydantic model, server-side ground truth)
// class ApprovalRespondCommand(BaseModel):
//     type: Literal["approval.respond"]
//     request_id: str            # WS correlation id — auto-injected by sendCommand(), do not set manually
//     request_id_target: str     # the HITL request UUID
//     decision: Literal["approve", "reject"]
//     comment: str | None = None

// Correct client shape — already used in Inbox.tsx:189-193, 211-216:
const ack = await sendCommand({
  type: "approval.respond",
  request_id_target: requestId,
  decision: "approve", // or "reject"
  // comment: note,     // only when rejecting with a reason
});
if (ack.status !== "ok") {
  toast.error(ack.error ?? "Approval failed");
  return;
}
toast.success("Approval sent.");
```

```typescript
// WRONG — current Chat.tsx:303-311 shape (server rejects this payload's validation)
const handleApprove = useCallback((requestId: string) => {
  void sendCommand({ type: "approval.respond", requestId, approved: true }); // requestId + approved are not
  toast.success("Approved — sent to Ástríðr");                              // fields on ApprovalRespondCommand
}, [sendCommand]);
```

### Verified: honest empty-state hiding for header telemetry (F3)

```typescript
// Pattern to follow for SYS: (LAT: needs its own source — see Pitfall 2)
const resources = useQuery(api.systemResources.current);
{resources?.cpu != null && (
  <span className="flex items-center gap-1.5">
    <Cpu className="w-3 h-3 text-primary/80" />
    SYS: <span className="text-primary font-bold">{Math.round(resources.cpu)}%</span>
  </span>
)}
```

### Verified: the CRON_SCHEDULES honest count (F4/D-06)

```typescript
// src/lib/cronSchedules.ts exports CRON_SCHEDULES (12 entries today, verified this session)
// Replace: <MetricCard label="Cron Jobs" value={summary?.totalJobs ?? 12} />
// With:
<MetricCard label="Configured Schedules" value={CRON_SCHEDULES.length} />
// summary?.totalJobs (from the live api.automation.cronSummary query) remains available
// for a genuinely LIVE metric elsewhere if wanted — it is real data, just not what
// "Cron Jobs" was labeled as, and D-06 explicitly wants the static catalog honestly labeled.
```

## State of the Art

Not applicable in the usual "library X deprecated, use Y" sense — this phase touches no external library API surface. The relevant "old → current" axis is internal:

| Old Approach | Current/Target Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Two independently-maintained nav lists (`navGroups` + `CommandPalette`'s `NAV_PAGES`) | Single source (`navGroups` → `navItems` export), CommandPalette imports it | This phase (F2) | ~15 pages become ⌘K-reachable |
| Static literals styled as live telemetry (`SYS: 14%`, `LAT: 12ms`) | Real Convex-backed values or hidden readout | This phase (F3) | Header no longer lies about system state |
| Two divergent approval WS payload shapes | One verified-correct shape, shared component | This phase (F6) | Chat.tsx approvals start actually working server-side |
| 31/35 pages with bespoke header typography | One `<PageHeader>` component, `text-2xl font-bold text-foreground` | This phase (F7) | Visual consistency; UI-SPEC is the binding contract |

## Runtime State Inventory

Not applicable — this phase is not a rename/refactor/migration of stored identifiers. It deletes dead React components (no stored data references them), merges two UI views over one unchanged Convex table (no schema change, no data migration), and fixes a client-side WS payload shape (the server-side contract and its stored data are unaffected — Ástríðr's `HITLGateLayer`/`_pending_futures` and `intents` records use the same `request_id_target`/UUID regardless of which CodePulse page sends it). No databases, live service configs, OS-registered state, secrets, or build artifacts carry a name/identifier that this phase changes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reusing the `ConnectionPopover.tsx` WS-ping pattern for header LAT: is the right choice over a new `providerHealth`-based query | Pitfall 2 / Code Examples | Low — this is a recommendation, not a locked decision; CONTEXT.md leaves data-source specifics to discretion. If the planner picks the `providerHealth` route instead, it's a valid alternative, just a different (LLM-latency, not system-latency) semantic |
| A2 | No other file besides `App.tsx` imports `Profiles.tsx`/`Agents.tsx` at execution time | Pitfall 4 | Low — verified via grep this session; re-verify immediately before the delete task since time may have passed |
| A3 | The `Network Access Log` sub-section in `Security.tsx`'s Network Policy tab is genuinely live (Convex-backed) and out of D-07's removal scope | Anti-Patterns / F4 | Medium if wrong — would mean a planned "keep" task actually needs no separate handling, or (less likely, contradicted by the code read) needs removal too. Verified by reading `networkPolicyEvents` render logic (`e._id`, `e.timestamp`, `StatusBadge`) — this is not a placeholder pattern anywhere else in the app |

**All other claims in this research were verified directly against live source in this session** (DashboardLayout.tsx, CommandPalette.tsx, App.tsx, Tasks.tsx, MissionControl.tsx, HeroStatsBar.tsx, Security.tsx, Automation.tsx, systemResources.ts, missionControl.ts, useRosterAgents.ts, ThemeSwitcher.tsx, DocComments.tsx, Skills.tsx, cronSchedules.ts, useAutomation.ts, Infrastructure.tsx, Chat.tsx, Inbox.tsx, AstridrWSContext.tsx, and cross-repo `astridr-repo/astridr/api/ws_commands.py` + two resolved debug session logs covering this exact approval contract) — none are `[ASSUMED]`.

## Open Questions (all RESOLVED during planning)

1. **What is the real data source for header LAT:? — (RESOLVED: WS-ping round-trip latency, per 96-02.)**
   - What we know: `systemResources.current` has no latency field (verified). `ConnectionPopover.tsx` already computes real WS round-trip latency client-side. `providerHealth.latencyEmaMs` exists per-provider but has no aggregate query yet.
   - What's unclear: Which semantic CONTEXT.md's author intended — "connection health" (WS ping) vs "AI provider responsiveness" (providerHealth).
   - Recommendation: Default to the WS-ping approach (zero new backend code, directly matches "Astridr Runtime Telemetry" framing) unless the planner/user has a stated preference for LLM-provider latency instead.

2. **Should the merged Tasks board's "By Agent" view keep `missionControl.ts` as a separate Convex module, or fold it into `tasks.ts`? — (RESOLVED: keep `missionControl.ts` separate and reuse it unchanged, per 96-04 — only the MissionControl page is deleted; deferring the module fold avoids Convex codegen churn this phase.)**
   - What we know: Both already query the same `tasks` table; no schema reason to keep them separate.
   - What's unclear: Whether keeping `missionControl.ts` as a named, semantically-scoped module aids readability vs. consolidating into `tasks.ts` reduces file count/import surface.
   - Recommendation: Claude's Discretion per CONTEXT.md — either is low-risk; lean toward folding into `tasks.ts` since D-02 deletes the `MissionControl.tsx` *page*, and an orphaned-but-still-used Convex module named after a deleted page is a minor but real naming-drift risk for the next audit.

3. **Skills.tsx `onDelete={() => {}}` — confirmed truly dead, not partially wired. (RESOLVED: drop the delete affordance when `isNew`/`!canDelete`; no new handler needed, per 96-08.)**
   - What we know: This no-op is on the **create-category** modal path (`isNew` / `canDelete={false}`), where a delete affordance would be logically meaningless (nothing exists yet to delete). The sibling **edit-category** modal (`:367-372`) has a real `handleDeleteCategory` handler.
   - What's unclear: Nothing — this resolves D-10's "drop the affordance" branch cleanly; the no-op simply shouldn't render a delete button at all when `isNew`, which `canDelete={false}` already ensures. Likely a near-zero-effort task (verify the prop is honored, no new handler needed).

## Environment Availability

Skipped — this phase has no new external dependencies. The existing dev stack (`npm run dev`, `npm run dev:backend` / Convex, `npm test`) is unchanged; no new CLI tools, services, or runtimes are introduced. The one cross-repo touchpoint (`astridr-repo`) is read-only for this phase (contract verification, not a code change there) and was already accessed successfully in this research session via the local working directory `C:\Users\mandr\astridr-repo`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + `@testing-library/react` 16.3.2, jsdom 29.1.1 |
| Config file | `vite.config.ts` (Vitest config colocated with Vite config — no separate `vitest.config.ts` found) |
| Quick run command | `npx vitest run src/<path>/<File>.test.tsx` |
| Full suite command | `npm test` (Vitest) — Playwright (`npm run test:e2e`) is separate and heavier; not required per-task |

### Existing coverage on touched files (verified this session)

| File this phase touches | Test file exists? |
|---|---|
| `src/components/CommandPalette.tsx` (F2) | ✅ `src/components/__tests__/CommandPalette.test.tsx` |
| `src/layouts/DashboardLayout.tsx` (F1/F3) | ✅ `src/layouts/__tests__/DashboardLayout.test.tsx` |
| `src/pages/Inbox.tsx` (F6) | ✅ `src/pages/__tests__/Inbox.test.tsx` |
| `src/pages/Memory.tsx`, `src/pages/Dreaming.tsx` (F9/D-09) | ✅ both have tests (`Memory.test.tsx` ×2 locations, `Dreaming.test.tsx`) |
| `src/pages/Skills.tsx` (F9/D-10) | ✅ `src/pages/__tests__/Skills.test.tsx` |
| `src/pages/Chat.tsx` (F6) | ❌ no test file found |
| `src/pages/Tasks.tsx`, `src/pages/MissionControl.tsx` (F1/D-01/D-02) | ❌ no test files found |
| `src/pages/Security.tsx`, `src/pages/Automation.tsx` (F4) | ❌ no test files found |
| `src/pages/MeetingBot.tsx` (F9/D-10) | ❌ no test file found |
| Remaining ~24 pages touched only by F7 (`<PageHeader>` migration) | Mixed — most have no dedicated test file; header text is not currently asserted anywhere found |

### Phase Requirements → Test Map

| Finding | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| F2 | CommandPalette lists all real routes, no stale `/agents`/`/profiles` links | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` | ✅ (extend existing) |
| F3 | Header hides SYS/LAT when data absent; shows real values when present | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ (extend existing) |
| F6 | Chat approve/reject sends `{request_id_target, decision}`; ack error surfaces a toast | unit | new: `npx vitest run src/pages/__tests__/Chat.test.tsx` | ❌ Wave 0 |
| F6 | Shared approval component behaves identically from both Chat and Inbox call sites | unit/integration | new test alongside the shared component | ❌ Wave 0 |
| F1/D-01/D-02 | Merged Tasks board renders both view modes; `?view=agent` deep-link works; `/mission-control` redirects | unit | new: `npx vitest run src/pages/__tests__/Tasks.test.tsx` | ❌ Wave 0 |
| F4 | Security page shows no "Valid" badge; Automation shows computed `CRON_SCHEDULES.length`, not `?? 12` | unit | new: `Security.test.tsx`, `Automation.test.tsx` | ❌ Wave 0 |
| F5 | `/profiles`, `/agents`, `/mission-control` redirect correctly; app builds with orphan imports removed | unit/build | `npx tsc --noEmit` + existing router tests | ✅ (build check) |
| F9/D-10 | MeetingBot dropdown reflects live roster, not hardcoded 6 names | unit | new: `MeetingBot.test.tsx` | ❌ Wave 0 |
| F7 | `<PageHeader>` renders `text-2xl font-bold text-foreground`; no page keeps a bespoke header after migration | unit | new: `PageHeader.test.tsx` (component-level, not per-page) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the file(s) touched
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean (this phase explicitly touches `anyApi`/`as any` typing, so a clean type-check is a meaningful gate) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/pages/__tests__/Chat.test.tsx` — covers F6 payload-shape fix + ack-error handling (currently zero coverage on this page, and it's the file with the confirmed live bug)
- [ ] `src/pages/__tests__/Tasks.test.tsx` — covers merged board (F1/D-01/D-02), the single highest-complexity UI change this phase makes
- [ ] `src/pages/__tests__/Security.test.tsx`, `src/pages/__tests__/Automation.test.tsx` — covers F4 honesty fixes (regression-guard against the fabricated values coming back)
- [ ] `src/pages/__tests__/MeetingBot.test.tsx` — covers F9/D-10 live-roster wiring
- [ ] `src/components/__tests__/PageHeader.test.tsx` — covers the new shared component's typography contract (F7), which is the thing 31 pages will depend on being correct
- [ ] Framework install: none — Vitest/RTL/jsdom already present and configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase does not touch auth (Clerk gating on Forge is pre-existing, unchanged) |
| V3 Session Management | No | Unaffected |
| V4 Access Control | **Yes** | The approval/HITL flow (F6) is an access-control gate — an agent tool call is blocked until a human approves. This phase's fix makes the gate actually *reachable* from Chat.tsx (currently silently fails closed via 300s timeout per the astridr debug logs — a fail-closed/deny-by-timeout outcome, not a security *hole*, but a broken UX for a security control) |
| V5 Input Validation | Indirectly | The server-side Pydantic `ApprovalRespondCommand` model is the input-validation boundary this phase's client fix must conform to — do not loosen it from the client side; fix the client to match, never relax the server contract |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends malformed/incomplete approval command, server silently no-ops, human believes action was taken | Repudiation (false confirmation) | Server already fails closed (Pydantic validation rejects, `ApprovalRespondCommand` is strict) — this phase's job is only to make the **client** honestly report that rejection (await ack, branch on status), not to change server validation |
| Untyped Convex access (`anyApi`, `as any`) around task/approval data | Tampering (reduced compile-time guarantee that a payload matches the schema) | Type the Tasks-board Convex calls properly during the F1 merge (per D-10), consistent with the rest of the app's typed `api.*` usage |

## Sources

### Primary (HIGH confidence — read directly this session)
- `C:\Users\mandr\codepulse\src\layouts\DashboardLayout.tsx` — navGroups, navItems export, header telemetry literals
- `C:\Users\mandr\codepulse\src\components\CommandPalette.tsx` — NAV_PAGES hardcode, entity-group stale links
- `C:\Users\mandr\codepulse\src\App.tsx` — route table, orphan imports, redirect pattern
- `C:\Users\mandr\codepulse\src\pages\Tasks.tsx`, `MissionControl.tsx` — merge-target code, `anyApi` usage, `max-h-[500px]` cap
- `C:\Users\mandr\codepulse\src\components\HeroStatsBar.tsx` — stale `/agents` deep link
- `C:\Users\mandr\codepulse\src\pages\Security.tsx`, `Automation.tsx`, `Infrastructure.tsx` — F4 hardcoded trust signals, Network Policy/Access Log distinction
- `C:\Users\mandr\codepulse\convex\systemResources.ts` — real query shape (no latency field)
- `C:\Users\mandr\codepulse\convex\missionControl.ts` — confirms same `tasks` table as Tasks.tsx
- `C:\Users\mandr\codepulse\convex\providerHealth.ts`, `src\components\ConnectionPopover.tsx` — candidate LAT: data sources
- `C:\Users\mandr\codepulse\src\hooks\useRosterAgents.ts` — live roster shape for MeetingBot fix
- `C:\Users\mandr\codepulse\src\components\ThemeSwitcher.tsx`, `src\pages\DocComments.tsx` — F10 a11y/token minors
- `C:\Users\mandr\codepulse\src\pages\Memory.tsx`, `Dreaming.tsx` — F9/D-09 duplicated Facts table code
- `C:\Users\mandr\codepulse\src\pages\Skills.tsx` — F9/D-10 no-op onDelete context
- `C:\Users\mandr\codepulse\src\pages\ForgePage.tsx`, `WarRoom.tsx` — F8 fixed-width panes
- `C:\Users\mandr\codepulse\src\pages\Chat.tsx`, `Inbox.tsx`, `src\contexts\AstridrWSContext.tsx` — F6 approval sender shapes + `sendCommand` request_id auto-injection
- `C:\Users\mandr\astridr-repo\astridr\api\ws_commands.py` — **ground truth** `ApprovalRespondCommand` Pydantic model and dispatch/validation-error handling
- `C:\Users\mandr\astridr-repo\.planning\debug\resolved\codepulse-hitl-card-missing.md`, `hitl-delegated-gate-mismatch.md` — resolved cross-repo debug sessions confirming the approval pipeline's current healthy/broken state per-path
- `C:\Users\mandr\codepulse\package.json` — verified current dependency versions
- `C:\Users\mandr\codepulse\src\index.css` — token names (`--status-*`, `--chart-*`, `--glow-*`, `--info`)
- Test file inventory via direct filesystem check (`src/**/*.test.tsx`, `src/**/__tests__/*`)

### Secondary / Tertiary
None used — all findings this phase needed were resolvable via direct source inspection (Context7/WebSearch were not needed; this is an internal-codebase cleanup phase with no external library questions).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions read directly from `package.json`
- Architecture: HIGH — every pattern (nav config, telemetry query, task-table sharing, WS command flow) verified against live source in both repos
- Pitfalls: HIGH — all five pitfalls are grounded in specific file:line evidence, not speculation; Pitfall 3 (F6) is a confirmed live bug, not a theoretical risk
- Security: MEDIUM — ASVS mapping is straightforward for this phase's small surface, but the broader HITL/approval security model in `astridr-repo` was only reviewed as far as this phase's contract touches it, not audited end-to-end

**Research date:** 2026-07-13
**Valid until:** ~14 days (short window — this research includes live cross-repo contract verification against `astridr-repo`, which is under active development; re-verify `ApprovalRespondCommand`'s shape immediately before building the shared approval component if execution starts more than ~2 weeks after this research)
