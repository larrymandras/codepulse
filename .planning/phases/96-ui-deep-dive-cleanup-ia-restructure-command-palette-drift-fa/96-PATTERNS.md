# Phase 96: UI Deep-Dive Cleanup — Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 26 explicitly named + 1 grouped bucket (~24 remaining pages for F7 `<PageHeader>` migration)
**Analogs found:** 26 / 26 (all have an in-repo analog; this is a pure cleanup phase, nothing needs an external pattern)

This phase touches 35 pages, but most of that surface (F7's `<PageHeader>` migration) is the **same
transform applied identically to every page** — one pattern, many application sites. Rather than
listing all ~31 non-compliant pages individually, this map gives the shared `<PageHeader>` pattern
once (Shared Patterns) plus the two "gold standard" analogs already in the tree, and enumerates every
other file that has distinct, non-repeated logic (F1–F6, F8, F9, F10) individually.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/PageHeader.tsx` (NEW, F7) | component | transform (presentational) | `src/components/SectionHeader.tsx` (sibling shape) + `BuildProgress.tsx:24`/`Analytics.tsx:86` (compliant inline usage) | role-match |
| `src/components/FactsTable.tsx` (NEW, D-09) | component | CRUD (read + filter over live Convex query) | `src/pages/Memory.tsx:705-780` "Durable Facts" tab / `src/pages/Dreaming.tsx:163-235` "Facts" tab (near-identical duplicate — extraction source) | exact (self-extraction) |
| Shared approval logic (NEW, D-11 — hook or `ApprovalActions.tsx`) | hook/utility | event-driven (WS command + ack) | `src/pages/Inbox.tsx:185-229` (correct, ack-checked pattern) | exact |
| `src/layouts/DashboardLayout.tsx` (F1 navGroups, F2 icon export, F3 telemetry) | provider/layout component | transform (config array) + request-response (telemetry query) | itself — modify in place; existing `navGroups`/`navItems`/`iconComponents` pattern | exact |
| `src/components/CommandPalette.tsx` (F2) | component | event-driven (⌘K → navigate/dispatch) | `src/layouts/DashboardLayout.tsx:79-119,212-226` (`iconComponents` + `navItems` — the source of truth to import) | exact |
| `src/components/HeroStatsBar.tsx` (F2, line 54) | component | request-response | `src/App.tsx:99-100` redirect targets (`/hr/roster` is the correct link) | exact |
| `src/pages/Tasks.tsx` (D-01/D-02/D-10 merge target) | page | CRUD (Convex tasks table + drag-drop mutation) | `src/pages/MissionControl.tsx` (per-agent view logic to fold in) + `src/pages/Security.tsx:155-159` (Tabs-based view-toggle pattern) | exact (sibling merge) |
| `src/pages/MissionControl.tsx` (DELETED, D-02) | page | CRUD | n/a — deletion target; logic migrates into Tasks.tsx | exact |
| `src/pages/Chat.tsx` (F6 sender fix) | page | event-driven (WS command) | `src/pages/Inbox.tsx:185-229` (correct payload shape + ack handling) | exact |
| `src/pages/Inbox.tsx` (F6, consumes shared component after extraction) | page | event-driven | itself (already correct — becomes the extraction source) | exact |
| `src/pages/Security.tsx` (F4: D-05 badge removal, D-07 allowlist removal) | page | request-response | itself — `:446-479` Network Access Log is the "keep, real data" pattern to preserve | exact |
| `src/pages/Automation.tsx` (F4: D-06 honest cron count) | page | request-response | `src/pages/BuildProgress.tsx:16-18` (computed derived metric instead of hardcoded fallback) | role-match |
| `src/pages/Infrastructure.tsx` (D-07 placeholder removal) | page | request-response | `src/pages/Security.tsx:446-479` Network Access Log (what a real, non-placeholder Convex-backed panel looks like, for contrast) | role-match |
| `src/pages/Profiles.tsx` (DELETED, D-08) | page | CRUD | n/a — deletion target | n/a |
| `src/pages/Agents.tsx` (DELETED, D-08) | page | CRUD | n/a — deletion target | n/a |
| `src/pages/Memory.tsx` (D-09, consumes FactsTable) | page | CRUD | `src/pages/Dreaming.tsx` (sibling — near-identical facts tab being merged) | exact |
| `src/pages/Dreaming.tsx` (D-09 FactsTable + F9 dead-code removal) | page | CRUD | `src/pages/Memory.tsx` (sibling) | exact |
| `src/pages/MeetingBot.tsx` (D-10 live roster) | page | request-response | `src/pages/WarRoom.tsx:34,53` (`useRosterAgents()` already wired into a `Select`-adjacent flow) | exact |
| `src/pages/Skills.tsx` (D-10 no-op removal) | page | CRUD | `src/components/skills/CategoryEditPopover.tsx:40-144` (the component whose `onDelete`/`canDelete` contract needs a guard) | exact |
| `src/pages/ForgePage.tsx` (F8 mobile collapse) | page | event-driven (job launch/stop) | `src/layouts/DashboardLayout.tsx:648-685` (existing off-canvas toggleable-master pattern) | role-match |
| `src/pages/WarRoom.tsx` (F8 mobile collapse) | page | event-driven | `src/layouts/DashboardLayout.tsx:648-685` (same) | role-match |
| `src/App.tsx` (F5 orphan-import removal, D-02 redirect) | route config | routing | itself `:99-100` (`/profiles`, `/agents` → `/hr/roster` — exact redirect pattern to replicate for `/mission-control`) | exact |
| `src/pages/Analytics.tsx` (F9 dead UI) | page | request-response | itself — isolated deletions, no cross-file analog needed | n/a (self-contained) |
| `src/pages/DocComments.tsx` (F10 tokens + h1) | page | request-response | any token-compliant page, e.g. `src/pages/Security.tsx` (`text-muted-foreground`, `bg-card`, `border-border`) | role-match |
| `src/components/ThemeSwitcher.tsx` (F10 aria-label) | component | event-driven | any other `SelectTrigger` in the codebase with an `aria-label` (standard Radix a11y prop, no in-repo analog needed — this is a one-line addition) | n/a (trivial) |
| `src/pages/KnowledgeGraph.tsx`, `src/pages/ToolGalaxy.tsx` (F10 `bg-[#09090b]`) | page (canvas host) | render | `src/index.css` token blocks (`--card`/`--background`) | role-match |
| **~24 remaining pages** (F7 `<PageHeader>` migration only) | page | request-response | `src/pages/BuildProgress.tsx:24` + `src/pages/Analytics.tsx:86` (the 2 already-compliant, non-dead pages) | exact (shared pattern, see below) |

## Pattern Assignments

### `src/components/PageHeader.tsx` (NEW component, F7)

**Analog:** `src/components/SectionHeader.tsx` (sibling shape — same `title`/`action` prop contract at a smaller scale) + the two compliant pages for the exact target typography.

**Sibling component shape** (`src/components/SectionHeader.tsx:1-18`, full file):
```typescript
import { Separator } from "@/components/ui/separator";

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      <Separator />
    </div>
  );
}
```
`PageHeader` is the page-level (h1) counterpart of this exact pattern — same `title`/`action`-slot shape, promoted to `text-2xl font-bold text-foreground`.

**Target typography — compliant page 1** (`src/pages/BuildProgress.tsx:23-24`):
```typescript
<div>
  <h1 className="text-2xl font-bold text-foreground mb-4">Build Progress</h1>
```

**Target typography — compliant page 2** (`src/pages/Analytics.tsx:86`, confirmed via FINDINGS.md F7 evidence): same `text-2xl font-bold text-foreground` class string.

**Non-compliant pages to migrate, by variant** (from FINDINGS.md F7 — use as the exhaustive punch list, do not re-grep):
- `text-2xl` without color: 16 pages
- `font-semibold`: `Executions.tsx:108`, `Ideation.tsx:119`
- `text-xl`: `Dreaming.tsx:76`, `MeetingBot.tsx:132`, `MissionControl.tsx:161` (deleted, skip), `WhatsApp.tsx:290`, `WarRoom.tsx:252`, `LiveRun.tsx:206`, `Inbox.tsx:363`, `hr/*` uppercase-mono variants
- `text-lg`: `ConfigPage.tsx:259`, `Tasks.tsx:101` (superseded by the F1 merge rewrite — header will already be replaced)
- `text-base`: `Chat.tsx:330`, `InsightsChat.tsx:76`
- terminal-style micro-headers: `HivePage.tsx:49`, `GraphsHub.tsx:150`, `Skills.tsx:167`
- no h1 at all: `DocComments.tsx` (also gets F10 token fixes in the same pass)

**Related fix, same files:** Chat/LiveRun/Inbox/Tasks share an anomalous `max-h-[500px]` wrapper (visible in `Tasks.tsx:98`: `<div className="flex flex-col h-full max-h-[500px]">`) — remove the cap in the same edit as the header swap on those 4 files.

---

### `src/components/FactsTable.tsx` (NEW component, D-09)

**Analog:** `src/pages/Memory.tsx:705-780` and `src/pages/Dreaming.tsx:163-235` — near-identical duplicate blocks, both querying `api.dreaming.recentFacts`. Extract the shared shape verbatim; the only difference between the two call sites is the wrapping `SectionErrorBoundary name` string and the empty-state copy already being identical.

**Duplicated core pattern** (`src/pages/Dreaming.tsx:163-235`, representative — `Memory.tsx:705-780` is functionally the same):
```typescript
<SectionErrorBoundary name="Dreaming Facts">
  <div className="space-y-4 mt-4">
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Search facts..."
        value={factSearch}
        onChange={(e) => setFactSearch(e.target.value)}
        className="flex-1 min-w-[200px]"
      />
      {allCategories.length > 0 && (
        <select
          value={factCategory}
          onChange={(e) => setFactCategory(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Categories</option>
          {allCategories.map((cat) => (
            <option key={cat as string} value={cat as string}>{cat as string}</option>
          ))}
        </select>
      )}
    </div>

    {!facts || facts.length === 0 ? (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-base text-muted-foreground">
          No durable facts extracted yet. Run a dreaming cycle to extract long-term facts from your conversation history.
        </p>
      </div>
    ) : filteredFacts.length === 0 ? (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-base text-muted-foreground">No facts match your search.</p>
      </div>
    ) : (
      <GlassPanel className="rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fact</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFacts.map((fact: any) => (
              <TableRow key={fact._id}>
                <TableCell className="text-base text-foreground max-w-md">{fact.factText}</TableCell>
                <TableCell>
                  {fact.category && <StatusBadge status="idle" label={fact.category.toUpperCase()} />}
                </TableCell>
                <TableCell className="text-right tabular-nums text-base">
                  {fact.confidence != null ? `${(fact.confidence * 100).toFixed(0)}%` : "—"}
                </TableCell>
                {/* timestamp cell continues */}
```

**Extraction shape:** props should be `{ facts: Fact[] | undefined; search: string; onSearchChange: (v: string) => void; category: string; onCategoryChange: (v: string) => void; categories: string[]; sectionName: string /* for SectionErrorBoundary */ }`. Both `Memory.tsx` and `Dreaming.tsx` already compute `filteredFacts`/`filteredDurableFacts`, `allCategories`/`allDurableCategories` locally via `useQuery(api.dreaming.recentFacts, { limit: 100 })` — keep that query + filter logic in each page (it's cheap and page-scoped), pass only the computed list + filter state into `<FactsTable>`.

---

### Shared approval logic (NEW — hook or `ApprovalActions.tsx`, D-11/F6)

**Analog:** `src/pages/Inbox.tsx:185-229` (the CORRECT, already-working pattern — copy this shape verbatim into Chat.tsx, then extract).

**Correct payload + ack-checked pattern** (`src/pages/Inbox.tsx:185-206`):
```typescript
const handleApprove = useCallback(
  async (requestId: string) => {
    // CRITICAL: request_id_target is the HITL UUID — NOT the WS correlation id.
    // sendCommand auto-generates its own request_id for the WS ack tracking.
    const ack = await sendCommand({
      type: "approval.respond",
      request_id_target: requestId,
      decision: "approve",
    });
    if (ack.status !== "ok") {
      toast.error(ack.error ?? "Approval failed");
      return;
    }
    toast.success("Approval sent.");
    setApprovalItems((prev) =>
      prev.map((item) => (item.requestId === requestId ? { ...item, read: true } : item))
    );
  },
  [sendCommand]
);
```

**WRONG pattern currently in Chat.tsx — replace, do not preserve** (`src/pages/Chat.tsx:303-311`):
```typescript
const handleApprove = useCallback((requestId: string) => {
  void sendCommand({ type: "approval.respond", requestId, approved: true }); // wrong keys, fire-and-forget
  toast.success("Approved — sent to Ástríðr"); // lies about success — server rejects this payload
}, [sendCommand]);
```

**Consumer contract to preserve** — both `BlockRenderer.tsx:33-34` (`onApprove?: (requestId: string) => void`) and `InboxCard.tsx:48-49` (`onApprove?: (requestId: string) => Promise<void>`) already expect slightly different signatures (sync vs async). When extracting the shared piece, standardize on the `Promise<void>`-returning async shape (Inbox's, since it's correct) and update `BlockRenderer`/`ChatBubble`'s prop types to match — Chat.tsx's `handleApprove` becomes `async`, consistent with Inbox.

**Post-fix Chat.tsx signature target:**
```typescript
const ack = await sendCommand({
  type: "approval.respond",
  request_id_target: requestId,
  decision: "approve", // or "reject", with optional `comment` on reject
});
if (ack.status !== "ok") {
  toast.error(ack.error ?? "Approval failed");
  return;
}
toast.success("Approval sent.");
```

---

### `src/layouts/DashboardLayout.tsx` (F1 navGroups, F2 icon export, F3 telemetry)

**Analog:** itself — the existing `navGroups`/`navItems`/`iconComponents` scaffolding already anticipates this exact edit shape.

**Config array to edit** (`src/layouts/DashboardLayout.tsx:140-210`, full `navGroups`): move `{ to: "/forge", ... }` from the `CONSOLE` group (`:159`) into `COMMAND` (`:143-151`); delete the duplicate `/live-run` CONSOLE entry (`:156`); move `/executions` and `/build` (`:157-158`) into `OBSERVE` (`:182-196`); delete the entire `CONSOLE` group object (`:153-161`) once empty.

**Icon resolution — currently NOT exported, F2 needs it** (`src/layouts/DashboardLayout.tsx:79-119`):
```typescript
const iconComponents: Record<string, React.ElementType> = {
  grid: LayoutDashboard,
  cpu: Cpu,
  // ...40 more entries
};
```
Add `export { iconComponents };` alongside the existing `export { navItems };` at `:795`.

**Header telemetry — fabricated literals to fix** (`src/layouts/DashboardLayout.tsx:709-718`):
```typescript
<div className="hidden lg:flex items-center gap-4 text-xs font-mono text-primary/60 pl-2 border-l border-primary/20">
  <span className="flex items-center gap-1.5">
    <Cpu className="w-3 h-3 text-primary/80" />
    SYS: <span className="text-primary font-bold">14%</span>
  </span>
  <span className="flex items-center gap-1.5">
    <Server className="w-3 h-3 text-primary/80" />
    LAT: <span className="text-primary font-bold">12ms</span>
  </span>
</div>
```
Replace `14%` with `useQuery(api.systemResources.current)?.cpu`, hidden when `null`/absent (see Shared Patterns → Honesty-first telemetry below). `LAT:` has no matching field in `systemResources.current` — RESEARCH.md recommends lifting the WS-ping pattern from `ConnectionPopover.tsx:90-119` (below) to header scope.

**WS-ping latency source** (`src/components/ConnectionPopover.tsx:90-113`):
```typescript
useEffect(() => {
  if (status !== "connected") return;
  const measureLatency = async () => {
    if (status !== "connected") return;
    try {
      const start = performance.now();
      await sendCommand({ type: "ping" }).catch(() => { /* error ack still gives RTT */ });
      const rtt = Math.round(performance.now() - start);
      setLatencyMs(rtt);
    } catch {
      // Ignore — latency stays at last known value
    }
  };
  void measureLatency();
  pingTimerRef.current = setInterval(() => { void measureLatency(); }, PING_INTERVAL_MS);
  return () => { if (pingTimerRef.current) clearInterval(pingTimerRef.current); };
}, [status]);
```

---

### `src/components/CommandPalette.tsx` (F2)

**Analog:** `src/layouts/DashboardLayout.tsx`'s own `navItems`/`iconComponents` (import target, not a separate file to read elsewhere).

**Current drift — hardcoded, manually-synced list to delete** (`src/components/CommandPalette.tsx:53-80`):
```typescript
// Nav items shared with DashboardLayout — kept in sync manually
const NAV_PAGES = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  // ...25 more, missing ~15 real routes, includes stale /agents, /profiles
];
```

**Render site to update** (`:126-134`):
```typescript
<CommandGroup heading="Pages">
  {NAV_PAGES.map(({ to, label, Icon }) => (
    <CommandItem key={to} onSelect={() => select(() => navigate(to))}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </CommandItem>
  ))}
</CommandGroup>
```
Target: `import { navItems, iconComponents } from "../layouts/DashboardLayout"`, then `iconComponents[item.icon] ?? LayoutDashboard` per Pitfall 1 in RESEARCH.md (string-keyed icon lookup, not a component reference).

**Stale deep links to fix** (`:140` inside "Agents" group `onSelect={() => select(() => navigate("/agents"))}`): change to `/hr/roster`.

---

### `src/components/HeroStatsBar.tsx` (F2, line 54)

**Analog:** `src/App.tsx:99-100` (the canonical redirect target).

**Stale link** (`src/components/HeroStatsBar.tsx:54`):
```typescript
onClick: () => navigate("/agents"),
```
Change to `navigate("/hr/roster")` — matches `App.tsx:100`'s `<Route path="/agents" element={<Navigate to="/hr/roster" replace />} />`.

---

### `src/pages/Tasks.tsx` (D-01/D-02/D-10 merge target)

**Analog 1 (view-toggle shape):** `src/pages/Security.tsx:155-159` (Tabs primitive already used for exactly this kind of "pick a view" affordance):
```typescript
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="browser-guard">Browser Guard</TabsTrigger>
    <TabsTrigger value="network-policy">Network Policy</TabsTrigger>
  </TabsList>
```
Per RESEARCH.md's "Don't Hand-Roll" table, UI-SPEC calls for a quieter segmented control than full Tabs chrome — compose `Tabs` (value-controlled, synced to `?view=` query param) or a `Button`-group with `aria-pressed`; either way, this Tabs usage is the closest in-repo precedent for state-driven view switching.

**Analog 2 (Convex read pattern to fold in, typed):** `src/pages/MissionControl.tsx:38-43`:
```typescript
const serverTasks = useQuery(api.missionControl.listTasksByAgent);
const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
const avatars = useAvatars();
const { agents: rosterAgents } = useRosterAgents();
const reassignTaskMutation = useMutation(api.missionControl.reassignTask);
```

**Current Tasks.tsx untyped access to fix in the same pass** (`src/pages/Tasks.tsx:8-9,24-26`):
```typescript
import { anyApi } from "convex/server";
// ...
const rawTasks = useQuery(anyApi.tasks.listByColumn) ?? [];
const moveColumn = useMutation(anyApi.tasks.moveColumn);
const createTask = useMutation(anyApi.tasks.create);
```
Swap `anyApi.tasks.*` → `api.tasks.*` (typed) while merging — same file touched anyway, per D-10/F10.

**Anomalous height cap to remove** (`src/pages/Tasks.tsx:98`):
```typescript
<div className="flex flex-col h-full max-h-[500px]">
```

---

### `src/pages/Chat.tsx` (F6 sender fix)

**Analog:** `src/pages/Inbox.tsx:185-229` (see "Shared approval logic" section above — this is the direct copy-and-adapt target).

**Current WRONG code to remove** (`src/pages/Chat.tsx:303-311`, already quoted above).

---

### `src/pages/Security.tsx` (F4: D-05, D-07)

**Analog:** itself — `:446-479` "Network Access Log" is the reference for what stays (real Convex data, honest empty-state copy).

**D-05 — badge to remove** (`src/pages/Security.tsx:215-230`):
```typescript
<div className="bg-background border border-border rounded-lg p-3">
  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
    Audit Chain
  </p>
  <div className="space-y-1 text-sm">
    <div className="flex justify-between">
      <span className="text-muted-foreground">Chain integrity</span>
      <span className="text-green-400">Valid</span>
    </div>
    <div className="flex justify-between">
      <span className="text-muted-foreground">Entry count</span>
      <span className="text-muted-foreground">{mergedEvents.length}</span>
    </div>
  </div>
</div>
```
Remove the "Chain integrity: Valid" row entirely; relabel "Entry count" → e.g. "Loaded events" (honest proxy label, per D-05).

**D-07 — placeholder to remove, KEEP the sibling block** (`src/pages/Security.tsx:422-481`, the whole `network-policy` TabsContent):
```typescript
<TabsContent value="network-policy" className="space-y-6 mt-4">
  <SectionErrorBoundary name="Network Policy">
    {/* Allowlist placeholder — REMOVE this whole div (:425-444) */}
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 ...>Provider Allowlist ...</h2>
      {/* empty-state copy, no real data source */}
    </div>

    {/* Network access log — KEEP, this is live Convex data */}
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 ...>Network Access Log</h2>
      {networkPolicyEvents.length === 0 ? ( /* honest empty state */ ) : ( /* real table */ )}
    </div>
  </SectionErrorBoundary>
</TabsContent>
```
**Do not delete the whole tab** — only the first `<div>` (the Provider Allowlist placeholder). See RESEARCH.md Anti-Pattern 3.

---

### `src/pages/Automation.tsx` (F4: D-06)

**Analog:** `src/pages/BuildProgress.tsx:16-18` (computed derived value, no magic-number fallback):
```typescript
const totalComponents = components.length;
const completedCount = components.filter((c: any) => c.status === "completed").length;
const completedPct = totalComponents > 0 ? Math.round((completedCount / totalComponents) * 100) : 0;
```

**Current fallback to remove** (`src/pages/Automation.tsx:89`):
```typescript
<MetricCard label="Cron Jobs" value={summary?.totalJobs ?? 12} />
```
Target (RESEARCH.md Code Examples, verified):
```typescript
<MetricCard label="Configured Schedules" value={CRON_SCHEDULES.length} />
```
`CRON_SCHEDULES` is already imported (`src/pages/Automation.tsx:15`). Also relabel the `enabled: true` hardcode inside `schedulesToCronJobs()` (`:34-40`) per D-06 — present as "configured", not "live enabled".

---

### `src/pages/Infrastructure.tsx` (D-07 placeholder removal)

**Analog:** `src/pages/Security.tsx:446-479` Network Access Log (contrast reference — what a *kept*, real panel looks like).

**Placeholder to remove entirely** (`src/pages/Infrastructure.tsx:255-266`):
```typescript
{/* Network Policy per Provider (CPUX-12) */}
<div className="md:col-span-12">
<SectionErrorBoundary name="Network Policy">
  <SectionHeader title="Network Policy" />
  <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
    <p className="text-base text-muted-foreground">
      Per-provider network policy rules will appear here once policy configuration is ingested.
    </p>
  </GlassPanel>
</SectionErrorBoundary>
</div>
```
Unlike Security.tsx's version, Infrastructure.tsx's block has no live sibling to preserve — remove the whole `<div className="md:col-span-12">...</div>`.

---

### `src/pages/MeetingBot.tsx` (D-10 live roster)

**Analog:** `src/pages/WarRoom.tsx:34,53` (`useRosterAgents()` already consumed by a sibling page):
```typescript
import { useRosterAgents } from "@/hooks/useRosterAgents";
// ...
const { agents } = useRosterAgents();
```

**Current hardcoded list to replace** (`src/pages/MeetingBot.tsx:156-163`):
```typescript
<Select value={agentId} onValueChange={setAgentId} disabled={sending}>
  <SelectTrigger id="agent-select"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="freya">Freya</SelectItem>
    <SelectItem value="astrid">Ástríðr</SelectItem>
    <SelectItem value="hervor">Hervor</SelectItem>
    <SelectItem value="hildr">Hildr</SelectItem>
    <SelectItem value="gondul">Gondul</SelectItem>
    <SelectItem value="ragnhildr">Ragnhildr</SelectItem>
  </SelectContent>
</Select>
```
Replace the 6 hardcoded `<SelectItem>`s with `agents.map(...)` from `useRosterAgents()`, matching `WarRoom.tsx`'s import/consumption shape. `RosterAgent` (`src/hooks/useRosterAgents.ts:18-24`) extends `AgentListItem` — check its exported `name`/id field for the `value`/label mapping.

---

### `src/pages/Skills.tsx` (D-10 no-op removal)

**Analog:** `src/components/skills/CategoryEditPopover.tsx:40-144` (the component owning the affordance).

**Current no-op call site** (`src/pages/Skills.tsx:376-389`):
```typescript
{creatingCategory && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <CategoryEditPopover
      displayName="" description="" icon="⚡" color="gray"
      onSave={handleCreateCategory}
      onCancel={() => setCreatingCategory(false)}
      onDelete={() => {}}
      canDelete={false}
      isNew
    />
  </div>
)}
```
**Component's current button** (`src/components/skills/CategoryEditPopover.tsx:136-144`):
```typescript
<button
  onClick={onDelete}
  disabled={!canDelete}
  className={`w-full text-sm py-1.5 rounded-lg transition-colors ${
    canDelete ? "text-red-400 hover:bg-red-900/30" : "text-gray-600 cursor-not-allowed"
  }`}
>
```
Per RESEARCH.md Open Question 3 (resolved): `canDelete={false}` already disables it — "drop the affordance" (D-10) means don't render the button at all when `isNew`/`!canDelete`, rather than leaving a permanently-disabled control. Gate the whole `<button>` render on `canDelete`, or add an `isNew` prop to `CategoryEditPopoverProps` and conditionally return `null` for the delete button.

---

### `src/pages/ForgePage.tsx` and `src/pages/WarRoom.tsx` (F8 mobile collapse)

**Analog:** `src/layouts/DashboardLayout.tsx:648-685` — the app's own existing off-canvas toggleable-master pattern (desktop fixed sidebar + mobile overlay + slide-in panel + close button), already proven at the layout level.

**Reference pattern** (`src/layouts/DashboardLayout.tsx:648-685`):
```typescript
{/* Desktop: fixed-width, always visible */}
<aside className={`hidden md:flex ${sidebarCollapsed ? "w-[48px]" : "w-60"} flex-shrink-0 ...`}>
  <SidebarContent collapsed={sidebarCollapsed} onToggleCollapse={...} />
</aside>

{/* Mobile: overlay + slide-in panel, toggled by sidebarOpen state */}
{sidebarOpen && (
  <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
)}
<aside
  className={`fixed inset-y-0 left-0 z-50 w-60 ... transform transition-transform duration-200 md:hidden ${
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
  <div className="absolute top-3 right-3">
    <button onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
      <X className="h-4 w-4" />
    </button>
  </div>
  <SidebarContent onNavClick={() => setSidebarOpen(false)} />
</aside>
```

**Panes to fix:**
- `src/pages/ForgePage.tsx:150`: `<div className="w-[280px] shrink-0 border-r border-border overflow-hidden">` — no responsive collapse.
- `src/pages/WarRoom.tsx:270`: `<GlassPanel className="w-64 flex-shrink-0 rounded-xl overflow-hidden flex flex-col ...">` — same issue.

Per CONTEXT.md F8 discretion, "stacked vs toggleable master" is a per-page call — the DashboardLayout pattern above is the toggleable-master option (recommended for master-detail where the detail pane is the primary focus, matching Forge/WarRoom's UX); a simpler `flex-col md:flex-row` stack is the alternative if the list pane needs to be visible by default on mobile.

---

### `src/App.tsx` (F5 orphan-import removal, D-02 redirect)

**Analog:** itself — the existing `/profiles`/`/agents` redirects are the exact pattern to replicate.

**Existing redirect pattern** (`src/App.tsx:99-100`):
```typescript
<Route path="/profiles" element={<Navigate to="/hr/roster" replace />} />
<Route path="/agents" element={<Navigate to="/hr/roster" replace />} />
```
**Target addition:** `<Route path="/mission-control" element={<Navigate to="/tasks?view=agent" replace />} />` (D-02) — note `Navigate to` supports a query string directly in the `to` prop.

**Imports to remove** (`src/App.tsx:11` `import Profiles from "./pages/Profiles";`, `:24` `const Agents = lazy(() => import("./pages/Agents"));`) plus their route entries (`:99-100` change from redirect-that-shadows-a-dead-import to just the redirect, and remove the `<Route path="/mission-control" element={<Suspense ...><MissionControl /></Suspense>} />` at `:132` in favor of the new redirect). Also remove `MissionControl` lazy import at `:50`.

**Pitfall reminder (RESEARCH.md Pitfall 4):** re-run `grep -rn "pages/Profiles\|pages/Agents[\"']" src/` immediately before deleting — this research confirmed exactly one import site each (both in `App.tsx`) as of this session, but re-verify at execution time.

---

### `src/pages/Analytics.tsx` (F9 dead UI)

**Analog:** none needed — self-contained deletions, no cross-file pattern to copy.

**Dead code to remove:**
- `:31,88` — `<TokenSavingsIndicator savedTokens={0} totalTokens={0} />` (hardcoded zeros, remove the import and the render).
- `:64,80-81` — `const errorTrend = useQuery(...)` fetched then `void errorTrend;` discarded. Either wire it into `ErrorRateTrend`'s prop (if genuinely useful) or remove the query entirely — do not leave a fetched-but-unused query.
- `:384` — duplicate `<LlmProviderPanel />` render (already rendered once earlier per FINDINGS.md F9) — remove the second instance.

---

### `src/pages/DocComments.tsx` (F10 tokens + h1)

**Analog:** `src/pages/Security.tsx` (or any token-compliant page) for the `zinc-*`/`emerald-*` → CSS-var replacement; `src/pages/BuildProgress.tsx:24` for the missing `<h1>`.

**Raw colors to replace** (`src/pages/DocComments.tsx:67,73-74,90`):
```typescript
<aside className="overflow-y-auto border-r border-zinc-800 p-2">
...
active?.path === d.path && active?.repo === d.repo ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-300 hover:bg-zinc-900"
<span className="text-zinc-500">{d.repo}/</span>
...
<aside className="overflow-y-auto border-l border-zinc-800">
```
Replace with token classes: `border-border`, `bg-primary/15 text-primary` (or a `--status-*` var if this represents a state, not just selection), `text-muted-foreground`, per repo's CLAUDE.md rule ("never hardcode hex; use `--primary`/`--status-*`").

**Hardcoded values also on this page** (`:48-49`):
```typescript
doc_ref: { repo: active.repo, path: active.path, doc_type: "gsd_spec", doc_hash: doc.doc_hash },
anchor: pending.anchor, comment: text, author: "larry", profile_id: profileId,
```
`author: "larry"` and `doc_type: "gsd_spec"` are hardcoded literals — F10 flags these; check whether a real user/profile identity is available in scope (`profileId` is already destructured) to replace `"larry"`, and whether `doc_type` should be derived from the loaded doc rather than a constant.

**Missing h1** — add a `<PageHeader title="Doc Review" />` (once the new component exists) or, if migrated standalone, `<h1 className="text-2xl font-bold text-foreground">Doc Review</h1>` matching `BuildProgress.tsx:24`.

---

### `src/components/ThemeSwitcher.tsx` (F10 aria-label)

**Fix, one line** (`src/components/ThemeSwitcher.tsx:43-45`):
```typescript
<SelectTrigger className="w-[160px] h-8 bg-card/50 border-border/50 text-sm">
  ...
</SelectTrigger>
```
Add `aria-label="Select theme"` (or similar) to the `SelectTrigger` — Radix's `SelectTrigger` accepts standard ARIA props directly, no wrapper pattern needed.

---

### `src/pages/KnowledgeGraph.tsx`, `src/pages/ToolGalaxy.tsx` (F10 `bg-[#09090b]`, optional per FINDINGS)

**Current hardcoded hex** (`src/pages/KnowledgeGraph.tsx:915`, `src/pages/ToolGalaxy.tsx:321`):
```typescript
className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-[#09090b]"
```
These are DOM elements (not canvas `ctx.fillStyle`, which is explicitly out of scope per FINDINGS.md), so they CAN read Tailwind/CSS-var classes. Replace `bg-[#09090b]` with the closest token — `bg-background` or `bg-card` (check `src/index.css`'s `[data-theme]` blocks for which token currently resolves to `#09090b` under the default `cyan` theme; the CLAUDE.md-documented zinc neutral `#09090b` maps to `--background` in the dark themes).

## Shared Patterns

### Honesty-first telemetry (F3/F4, applies to DashboardLayout + Security + Automation)
**Source:** RESEARCH.md Pattern 2, verified against `convex/systemResources.ts`
```typescript
// Correct: check the FIELD, not just the object
const resources = useQuery(api.systemResources.current);
const showSys = resources?.cpu != null;
{showSys && (
  <span className="flex items-center gap-1.5">
    <Cpu className="w-3 h-3 text-primary/80" />
    SYS: <span className="text-primary font-bold">{Math.round(resources.cpu)}%</span>
  </span>
)}
```
Never `resources ? ... : "—"` (guards only the whole-object null case) and never `resources?.cpu ?? 0` (fabricates a zero). Apply this exact null-per-field check anywhere a previously-fake or partially-live number is being made honest (D-04, D-05, D-06).

### Redirect pattern (F5/D-02, App.tsx)
**Source:** `src/App.tsx:99-100`
```typescript
<Route path="/profiles" element={<Navigate to="/hr/roster" replace />} />
<Route path="/agents" element={<Navigate to="/hr/roster" replace />} />
```
Apply identically for `/mission-control` → `/tasks?view=agent`.

### Config-array nav pattern (F1/F2, DashboardLayout.tsx)
**Source:** `src/layouts/DashboardLayout.tsx:140-226`
Any nav change is an edit to the single `navGroups` array; `navItems` (deduped flat list) and `iconComponents` (string→component map) are derived/exported for external consumers. CommandPalette must consume both, not just `navItems` (icons are string keys, not component references — Pitfall 1).

### Ack-checked WS command pattern (F6, applies to any user-facing WS command)
**Source:** `src/pages/Inbox.tsx:185-229` (contrast: `src/pages/Chat.tsx:303-311` is the anti-pattern being fixed)
```typescript
const ack = await sendCommand({ type: "...", /* correct server-matching shape */ });
if (ack.status !== "ok") {
  toast.error(ack.error ?? "<Action> failed");
  return;
}
toast.success("<Action> sent.");
```
Never `void sendCommand(...)` followed by an unconditional success toast for a user-visible state change.

### Token-driven styling (F10, applies to DocComments.tsx, KnowledgeGraph.tsx, ToolGalaxy.tsx)
**Source:** repo `CLAUDE.md` (binding project rule) + any compliant page (e.g. `src/pages/Security.tsx`'s consistent `bg-card border-border text-muted-foreground` usage throughout)
Never hardcode hex or Tailwind's raw `zinc-*`/`emerald-*` palette classes — use `bg-card`/`bg-background`/`border-border`/`text-muted-foreground`/`text-primary` and the `--status-*`/`--glow-*`/`--chart-*` CSS vars defined in `src/index.css`.

## No Analog Found

None — every file in this phase has at least a role-match analog already in the tree (expected for a pure cleanup/consistency phase with no new capabilities, per RESEARCH.md's Standard Stack section: "No new packages are needed for this phase").

## Metadata

**Analog search scope:** `src/layouts/`, `src/components/` (incl. `src/components/ui/`, `src/components/skills/`), `src/pages/`, `src/hooks/`, `convex/` (read-only, for query shape verification), plus cross-repo read of `astridr-repo/astridr/api/ws_commands.py` (already verified in RESEARCH.md — not re-read here).
**Files scanned:** ~30 (all files named in CONTEXT.md/RESEARCH.md's file lists, plus `SectionHeader.tsx`, `CategoryEditPopover.tsx`, `useRosterAgents.ts`, `ConnectionPopover.tsx`, `BuildProgress.tsx`, `Security.tsx` as candidate analogs)
**Pattern extraction date:** 2026-07-13
