# Phase 79: Forge UI Tab (read-only render) — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 8 (6 create, 2 modify)
**Analogs found:** 8 / 8 (all have matches; ported components have forge source as analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/ForgePage.tsx` | page / layout | request-response (Convex reactive) | `src/pages/BuildProgress.tsx` + `src/pages/Executions.tsx` | role-match |
| `src/components/forge/ForgeStatusBadge.tsx` | component / presentational | transform | `C:\Users\mandr\forge\web\src\components\StatusBadge.tsx` | exact (port + re-skin) |
| `src/components/forge/ForgeJobList.tsx` | component / list | CRUD-read | `C:\Users\mandr\forge\web\src\components\JobList.tsx` | exact (port + strip) |
| `src/components/forge/ForgeJobDetail.tsx` | component / detail | CRUD-read | `C:\Users\mandr\forge\web\src\components\JobDetail.tsx` | exact (port + strip) |
| `src/components/forge/ForgeMetadataPanel.tsx` | component / presentational | transform | `src/components/SectionHeader.tsx` + `src/components/GlassPanel.tsx` | partial |
| `src/hooks/useForge.ts` | hook | CRUD-read (Convex reactive) | `src/hooks/useBuildProgress.ts` | exact |
| `src/App.tsx` | config / routing | — | `src/App.tsx` (self — add one lazy route) | exact |
| `src/layouts/DashboardLayout.tsx` | config / nav | — | `src/layouts/DashboardLayout.tsx` (self — add icon + nav entry) | exact |

---

## Pattern Assignments

### `src/App.tsx` (MODIFY — add one lazy route)

**Analog:** `src/App.tsx` lines 23–53 (lazy import block) and lines 109–113 (representative lazy route)

**Lazy import pattern** (`src/App.tsx` lines 23–53, representative subset):
```tsx
// Lazy-load Phase 79: Forge UI
const ForgePage = lazy(() => import("./pages/ForgePage"));
```
Insert this block after the last existing lazy-load comment block (currently after line 65, Skills block).

**Route registration pattern** (`src/App.tsx` lines 109–113):
```tsx
{/* Phase 73: MCP Inventory + Health (GRAPHS cluster) */}
<Route path="/mcp-inventory" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading MCP Inventory...</div>}><McpInventory /></Suspense>} />
```

**Delta for ForgePage:**
```tsx
{/* Phase 79: Forge job viewer */}
<Route path="/forge" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Forge...</div>}><ForgePage /></Suspense>} />
```
Insert after the `/build` route (line 85) — consistent with CONSOLE group ordering.

---

### `src/layouts/DashboardLayout.tsx` (MODIFY — icon + nav entry)

**Analog:** `src/layouts/DashboardLayout.tsx`

**Icon import pattern** (lines 23–62, lucide import block). `Flame` is NOT currently imported. Add it:
```tsx
import {
  // ... existing imports ...
  Flame,        // ADD — Phase 79 Forge nav icon
} from "lucide-react";
```

**iconComponents registration pattern** (lines 70–106):
```tsx
const iconComponents: Record<string, React.ElementType> = {
  // ... existing entries ...
  hammer: Hammer,     // Build — DO NOT TOUCH
  // ADD after the last entry in this block:
  flame: Flame,       // Phase 79 — Forge
};
```
`Flame` is confirmed present in `lucide-react ^1.8.0` (verified via `node -e`). It does NOT collide with `hammer` (Build).

**Nav entry insertion pattern** (lines 140–147, CONSOLE group):
```tsx
{
  group: "CONSOLE",
  items: [
    { label: "Agent Console", icon: "terminal", group: "CONSOLE", placeholder: true },
    { to: "/live-run", label: "Live Run", icon: "activity", group: "CONSOLE" },
    { to: "/executions", label: "Executions", icon: "list", group: "CONSOLE" },
    { to: "/build", label: "Build", icon: "hammer", group: "CONSOLE" },
    // ADD:
    { to: "/forge", label: "Forge", icon: "flame", group: "CONSOLE" },
  ],
},
```
Insert as the last item in the CONSOLE `items` array (after Build, line 145).

**NavItem interface** (lines 111–117) — no change needed; existing `to / label / icon / group` fields cover the new entry.

---

### `src/hooks/useForge.ts` (CREATE)

**Analog:** `src/hooks/useBuildProgress.ts` (lines 1–15 — the entire file)

**Full analog** (`src/hooks/useBuildProgress.ts` lines 1–15):
```ts
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBuildProgress() {
  return useQuery(api.build.phaseProgress) ?? [];
}

export function usePhaseOverview() {
  return useQuery(api.build.phaseOverview) ?? [];
}

export function useBuildActivity(limit?: number) {
  return useQuery(api.build.recentActivity, { limit }) ?? [];
}
```

**Delta — useForge.ts:**
- `listJobs({hostId?})` returns `forgeJobs[]` (already ordered `by_updatedAt DESC`). No `hostId` arg needed for the merged-list view (D-03), so pass `{}`.
- `getJob({hostId, forgeJobId})` requires BOTH args — skip as `"skip"` when either is null (Convex pattern for conditional queries). However, the UI-SPEC resolves this: detail renders from the `listJobs` row already in memory (no `getJob` round-trip). Expose the hook but note it's optional.
- `listWorkspaces({hostId?})` same pattern; needed only if workspace names are shown in the metadata panel (Phase 79 only uses `workspaceId` string — defer this hook until P80 if not needed).
- The hook file also owns the **type adapter** and `ForgeJobRow` extended type (per UI-SPEC adapter contract).

**Convex query signatures** (from `convex/forge.ts`):
```ts
// listJobs — args: { hostId?: string } — returns forgeJobs[] newest-first
export const listJobs = query({ args: { hostId: v.optional(v.string()) }, ... });

// getJob — args: { hostId: string, forgeJobId: string } — returns single row or null
export const getJob = query({ args: { hostId: v.string(), forgeJobId: v.string() }, ... });

// listWorkspaces — args: { hostId?: string } — returns forgeWorkspaces[]
export const listWorkspaces = query({ args: { hostId: v.optional(v.string()) }, ... });
```

**Full pattern for `useForge.ts`:**
```ts
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { JobStatus } from "../../forge-types"; // or inline below

// Extended type: Convex row + extra fields needed by CodePulse components
export interface ForgeJobRow {
  // Forge Job fields (mapped from Convex doc)
  id: string;           // doc.forgeJobId
  agent: string;
  mode: string;
  prompt: string | null;
  workspaceId: string;
  status: JobStatus;
  pid: number | null;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  artifactCount: number;
  capabilities: string;
  model: string | null;
  createdAt: string;
  // Extra — NOT on forge Job type
  hostId: string;
  updatedAt: string;
}

// Adapter: Convex doc → ForgeJobRow
function adaptJob(doc: any): ForgeJobRow {
  return {
    id: doc.forgeJobId,
    agent: doc.agent,
    mode: doc.mode,
    prompt: doc.prompt,
    workspaceId: doc.workspaceId,
    status: doc.status as JobStatus,
    pid: doc.pid,
    exitCode: doc.exitCode,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    artifactCount: doc.artifactCount,
    capabilities: doc.capabilities,
    model: doc.model,
    createdAt: doc.createdAt,
    hostId: doc.hostId,
    updatedAt: doc.updatedAt,
  };
}

export function useForgeJobs(): ForgeJobRow[] {
  const raw = useQuery(api.forge.listJobs, {}) ?? [];
  return raw.map(adaptJob);
}

// Optional — use only if getJob round-trip is needed (it is NOT for Phase 79
// detail panel, which renders from the listJobs row directly)
export function useForgeJob(hostId: string | null, forgeJobId: string | null) {
  return useQuery(
    api.forge.getJob,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
}
```

**Key Convex pattern for conditional queries:** pass `"skip"` as the second argument to `useQuery` when args are not ready — this is the idiomatic Convex pattern used throughout the codebase (e.g., `src/layouts/DashboardLayout.tsx` line 358: `useQuery(..., avatarStorageId ? {...} : "skip")`).

---

### `src/pages/ForgePage.tsx` (CREATE)

**Analog:** `src/pages/BuildProgress.tsx` (lines 9–49) — page header + `useQuery` inline + `SectionErrorBoundary` wrapping

**Page header pattern** (`src/pages/BuildProgress.tsx` lines 21–24):
```tsx
<h1 className="text-2xl font-bold text-foreground mb-4">Build Progress</h1>
```
ForgePage uses: `<h1 className="text-2xl font-bold text-foreground mb-4">Forge</h1>`

**SectionErrorBoundary wrapping** (`src/pages/Executions.tsx` lines 113–140, adapted):
```tsx
import SectionErrorBoundary from "../components/SectionErrorBoundary";

// Wrap each independent region:
<SectionErrorBoundary name="Forge Job List">
  <ForgeJobList ... />
</SectionErrorBoundary>
<SectionErrorBoundary name="Forge Job Detail">
  <ForgeJobDetail ... />
</SectionErrorBoundary>
```

**SectionErrorBoundary props** (`src/components/SectionErrorBoundary.tsx` lines 1–7):
```tsx
// Props: children: ReactNode, name?: string
// Usage: <SectionErrorBoundary name="Label">...</SectionErrorBoundary>
// On error: shows fallback UI with name + error message + Retry button
```

**Master-detail layout pattern** (D-11, UI-SPEC layout diagram). No existing CodePulse page uses a strict 280px-fixed left panel + flex-1 right panel, but `src/pages/hr/Roster.tsx` lines 1–80 uses selection state + `AgentDetailSheet`. The layout construct for ForgePage is:
```tsx
<div className="flex h-full overflow-hidden">
  {/* List panel — fixed width per D-11 */}
  <div className="w-[280px] shrink-0 border-r border-border overflow-hidden">
    <SectionErrorBoundary name="Forge Job List">
      <ForgeJobList
        jobs={jobs}
        loading={jobs === undefined}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
    </SectionErrorBoundary>
  </div>
  {/* Detail panel — flex-1 */}
  <div className="flex-1 overflow-hidden">
    <SectionErrorBoundary name="Forge Job Detail">
      <ForgeJobDetail job={selectedJob ?? null} />
    </SectionErrorBoundary>
  </div>
</div>
```

**Selection state pattern** (UI-SPEC: keyed on `(hostId, forgeJobId)` pair):
```tsx
const [selectedKey, setSelectedKey] = useState<{ hostId: string; forgeJobId: string } | null>(null);
const selectedJob = selectedKey
  ? jobs.find(j => j.hostId === selectedKey.hostId && j.id === selectedKey.forgeJobId) ?? null
  : null;
```

**GlassPanel usage** in ForgePage — wrap the overall content area (not the list+detail panels individually; they have their own bg). Per UI-SPEC §Layout:
```tsx
import { GlassPanel } from "@/components/GlassPanel";
// Wrap the master-detail body (not the page header)
<GlassPanel className="flex-1 flex overflow-hidden">
  ...
</GlassPanel>
```

**Full ForgePage structure:**
```tsx
export default function ForgePage() {
  const jobs = useForgeJobs();
  const [selectedKey, setSelectedKey] = useState<{...} | null>(null);
  const selectedJob = selectedKey ? jobs.find(...) ?? null : null;
  const isLoading = jobs === undefined; // useForgeJobs returns [] not undefined after ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      <h1 className="text-2xl font-bold text-foreground shrink-0">Forge</h1>
      <GlassPanel className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-[280px] shrink-0 border-r border-border overflow-hidden">
          <SectionErrorBoundary name="Forge Job List">
            <ForgeJobList jobs={jobs} loading={isLoading} selectedKey={selectedKey} onSelect={setSelectedKey} />
          </SectionErrorBoundary>
        </div>
        <div className="flex-1 overflow-hidden">
          <SectionErrorBoundary name="Forge Job Detail">
            <ForgeJobDetail job={selectedJob} />
          </SectionErrorBoundary>
        </div>
      </GlassPanel>
    </div>
  );
}
```

NOTE: `useForgeJobs()` returns `[]` (not `undefined`) due to `?? []` in the hook. A separate `isLoading` check requires reading the raw `useQuery` return before the nullish coalesce — simplest approach: export a second hook `useForgeJobsRaw()` that does NOT apply `?? []`, or check `useQuery(api.forge.listJobs, {}) === undefined` directly in the page.

---

### `src/components/forge/ForgeStatusBadge.tsx` (CREATE — port + re-skin)

**Analog:** `C:\Users\mandr\forge\web\src\components\StatusBadge.tsx` (entire file, 102 lines)

**What to keep** (forge StatusBadge.tsx lines 22–102):
- `StatusConfig` interface (lines 21–26)
- `STATUS_MAP` structure (lines 28–65) — keep the 6-entry record; replace `bg` / `fg` string hex values with Tailwind classes (see table below)
- `StatusBadge` → rename to `ForgeStatusBadge` (lines 71–102)
- `data-status` and `data-color-scheme` attributes (lines 93–94) — MUST preserve for test compatibility
- `colorScheme` mapping (lines 75–86) — unchanged
- `animate-spin` on `Loader2` for running (line 97) — MUST preserve

**Color re-skin** (D-09 — from UI-SPEC status color table, src/index.css .dark block):

| Status | Replace forge `bg` hex | Replace forge `fg` hex | Tailwind equivalent |
|---|---|---|---|
| `queued` | `#252836` | `#94A3B8` | `bg-zinc-800/60 text-zinc-400` |
| `running` | `#1E3A5F` | `#60A5FA` | `bg-blue-900/60 text-[var(--status-info)]` |
| `completed` | `#14532D` | `#4ADE80` | `bg-green-900/60 text-[var(--status-ok)]` |
| `failed` | `#3F1111` | `#F87171` | `bg-red-900/60 text-[var(--status-error)]` |
| `stopped` | `#292524` | `#A8A29E` | `bg-zinc-800/40 text-zinc-500` |
| `auth_failed` | `#3B1F00` | `#F59E0B` | `bg-amber-900/60 text-[var(--status-warn)]` |

**What changes vs forge analog:**
- Remove `style={{ backgroundColor: bg, color: fg }}` (inline hex) → replace with Tailwind class strings on each STATUS_MAP entry
- Change the badge `span` from `status-${colorScheme}` class to Tailwind classes directly
- Import `JobStatus` from a local type definition (not `@/types` — that path belongs to forge's aliasing)
- Rename export from `StatusBadge` to `ForgeStatusBadge`

**Resulting badge span** (forge StatusBadge.tsx line 88–101 adapted):
```tsx
<span
  aria-label={status}
  data-status={status}
  data-color-scheme={colorScheme}
  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
>
  <config.Icon className={`h-3 w-3${status === 'running' ? ' animate-spin' : ''}`} />
  {config.label}
</span>
```
Where `config.className` is the merged Tailwind bg + text class string from the table above.

---

### `src/components/forge/ForgeJobList.tsx` (CREATE — port + strip)

**Analog:** `C:\Users\mandr\forge\web\src\components\JobList.tsx` (entire file, 234 lines)

**What to keep** (forge JobList.tsx):
- `AgentIcon` function (lines 44–55) — unchanged; uses Lucide Bot/Code/Zap (all present in CodePulse)
- Loading skeleton render (lines 113–125) — port exactly; `Skeleton` component is identical in CodePulse (`src/components/ui/skeleton.tsx`)
- Empty state render (lines 127–136) — port structure; UPDATE copy per D-04: replace "Launch your first job..." with "Jobs will appear here once the Forge daemon starts syncing."
- Card structure and selection state (lines 163–229) — port; update `job.id === selectedId` comparison to use `(hostId, forgeJobId)` pair (see below)
- `ScrollArea` usage (lines 156–231) — import from `@/components/ui/scroll-area` (same in CodePulse)

**What to strip** (D-01):
- `deleting` and `clearing` state (lines 75–77)
- `handleDelete` function (lines 81–97)
- `handleClearFailed` function (lines 99–111)
- Delete-X button markup (lines 211–228)
- "Clear failed" toolbar button (lines 140–154)
- `apiFetch` import (line 29)
- `onChanged` prop from `JobListProps` (line 40)
- `TERMINAL` set (line 32) — no longer needed

**Prop interface changes:**
```tsx
// Forge original:
interface JobListProps {
  jobs: Job[];
  loading: boolean;
  selectedId?: string | null;
  onSelect?: (jobId: string) => void;
  onChanged?: () => void;    // STRIP
}

// CodePulse port:
interface ForgeJobListProps {
  jobs: ForgeJobRow[];
  loading: boolean;
  selectedKey: { hostId: string; forgeJobId: string } | null;
  onSelect: (key: { hostId: string; forgeJobId: string }) => void;
}
```

**Selection check change** (forge JobList.tsx line 159):
```tsx
// Forge: const isSelected = job.id === selectedId;
// CodePulse port:
const isSelected = selectedKey?.hostId === job.hostId && selectedKey?.forgeJobId === job.id;
```

**onSelect call change** (forge JobList.tsx line 177):
```tsx
// Forge: onClick={() => onSelect?.(job.id)}
// CodePulse port:
onClick={() => onSelect({ hostId: job.hostId, forgeJobId: job.id })}
```

**Host badge addition** (D-03 — new, after StatusBadge in the card's flex row):
```tsx
// Add ForgeHostBadge after <ForgeStatusBadge status={job.status} /> in the badge row:
import { ForgeHostBadge } from "./ForgeHostBadge";
<div className="flex items-center gap-2 flex-wrap">
  <ForgeStatusBadge status={job.status} />
  <ForgeHostBadge hostId={job.hostId} />
  <span className="text-xs text-muted-foreground capitalize">{job.agent}</span>
</div>
```

**relativeTime usage** — replace forge's local `relativeTime(isoString)` (JobList.tsx lines 58–71, takes ISO string) with CodePulse's `relativeTime(epochSeconds)` from `src/lib/formatters.ts`:
```tsx
import { relativeTime } from "@/lib/formatters";
// In card: relativeTime(new Date(job.createdAt).getTime() / 1000)
```
CodePulse `relativeTime` takes epoch seconds (confirmed: `src/lib/formatters.ts` line 20: `const diff = Date.now() / 1000 - epochSeconds`). Forge's version takes ISO string. Convert: `new Date(isoString).getTime() / 1000`.

**Selected card active bar** (UI-SPEC interaction contract — add per D-10):
```tsx
// Forge uses bg-accent only. CodePulse adds an emerald left border for active state:
className={`... ${isSelected ? 'bg-accent border-l-2 border-primary' : ''}`}
```

**Imports for CodePulse port:**
```tsx
import { Bot, Code, Zap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeHostBadge } from "./ForgeHostBadge";
import { relativeTime } from "@/lib/formatters";
import type { ForgeJobRow } from "@/hooks/useForge";
```

---

### `src/components/forge/ForgeJobDetail.tsx` (CREATE — port + strip)

**Analog:** `C:\Users\mandr\forge\web\src\components\JobDetail.tsx` (entire file, 289 lines)

**What to keep** (forge JobDetail.tsx):
- Empty state render (lines 193–207) — port exactly; keep copy "Select a job to view details"
- Job header structure (lines 215–255) — port; replace `InlineStatusBadge` with `ForgeStatusBadge`; replace inline `style={}` with Tailwind classes

**What to strip** (D-01/D-02):
- `isStopping` state (line 176)
- `handleStop` function (lines 178–191)
- Stop Job `<Button>` (lines 245–254)
- All of `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (lines 258–286)
- `LogsPanel` inner component (lines 75–86)
- `FilesPanel` inner component (lines 92–163)
- `useJobLog` import + usage
- `useWorkspaceFiles` import + usage
- `useWorkspaces` import + usage
- `apiFetch` import + usage
- `InlineStatusBadge` (lines 39–69) — replaced by `ForgeStatusBadge`
- `onStopped` prop from `JobDetailProps`

**Header re-skin** (forge JobDetail.tsx lines 215–244, adapted to Tailwind):
```tsx
// Forge uses inline style={}; CodePulse uses Tailwind:
<div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
  <span className="text-sm font-semibold text-foreground">{job.agent}</span>
  <ForgeStatusBadge status={job.status} />
  {job.prompt && (
    <span className="flex-1 text-xs text-muted-foreground truncate">{job.prompt}</span>
  )}
</div>
```

**What replaces the tabs** (D-02):
```tsx
// After the header, render ForgeMetadataPanel directly (no tabs wrapper):
<div className="flex-1 overflow-y-auto">
  <ForgeMetadataPanel job={job} />
</div>
```

**Prop interface:**
```tsx
// Forge: interface JobDetailProps { job: Job | null; onStopped?: (job: Job) => void; }
// CodePulse port:
interface ForgeJobDetailProps { job: ForgeJobRow | null; }
```

**Imports for CodePulse port:**
```tsx
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeMetadataPanel } from "./ForgeMetadataPanel";
import type { ForgeJobRow } from "@/hooks/useForge";
```

---

### `src/components/forge/ForgeMetadataPanel.tsx` (CREATE — new component)

**Analog:** `src/components/SectionHeader.tsx` (lines 1–18) for the group divider pattern; `src/components/GlassPanel.tsx` (lines 1–28) for the container.

**SectionHeader pattern** (`src/components/SectionHeader.tsx` lines 8–17):
```tsx
// Group label style used in SectionHeader:
<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
// ForgeMetadataPanel uses a lighter variant per UI-SPEC:
<div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pt-3 pb-1">{groupLabel}</div>
<div className="border-t border-border" />
```

**Field key typography** (UI-SPEC §ForgeMetadataPanel, from `DashboardLayout.tsx` line 249 operational chrome style):
```tsx
<dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">MODEL</dt>
```

**Field value typography** (UI-SPEC):
```tsx
<dd className="text-xs text-foreground">...</dd>
// For capabilities block:
<dd className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">...</dd>
```

**Layout — two-column CSS grid** (UI-SPEC §ForgeMetadataPanel):
```tsx
<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3">
  <dt>...</dt><dd>...</dd>
  ...
</dl>
```

**Groups and fields** (UI-SPEC ordering: identity → execution → resources → configuration → audit):

Identity group: `agent`, `mode`, `status`
Execution group: `pid`, `exitCode`, `startedAt`, `finishedAt`
Resources group: `workspaceId`, `artifactCount`
Configuration group: `model`, `capabilities`
Audit group: `createdAt`, `updatedAt`

**Formatting helpers:**
- `startedAt/finishedAt/createdAt/updatedAt`: `new Date(isoString).toLocaleString()` for full datetime; null → "—"
- `pid/exitCode`: numeric or "—" if null
- `workspaceId`: `value.length > 12 ? value.slice(0, 12) + '…' : value`
- `model`: `value ?? "default"`
- `capabilities`: `JSON.parse(value)` then format as `key: value\n` lines; wrap in `font-mono` block; use `try/catch` and fall back to raw string on parse error
- `status`: render `<ForgeStatusBadge status={job.status} />` inline as the `dd` value

**Imports:**
```tsx
import { GlassPanel } from "@/components/GlassPanel";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import type { ForgeJobRow } from "@/hooks/useForge";
```

---

### `src/components/forge/ForgeHostBadge.tsx` (CREATE — new small component)

**Analog:** `src/components/ui/badge.tsx` (lines 29–46 — Badge component with `variant="outline"`)

**Badge outline variant** (`src/components/ui/badge.tsx` lines 17–19):
```tsx
outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
```
Base badge class (line 8): `inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`

**ForgeHostBadge pattern** (UI-SPEC §ForgeHostBadge — Badge variant="outline" with mono style override):
```tsx
import { Badge } from "@/components/ui/badge";

interface ForgeHostBadgeProps { hostId: string; }

export function ForgeHostBadge({ hostId }: ForgeHostBadgeProps) {
  const label = hostId.length > 10 ? hostId.slice(0, 8) + "…" : hostId;
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-mono uppercase tracking-wider px-2 py-0"
    >
      {label}
    </Badge>
  );
}
```
`py-0` override is intentional per UI-SPEC (smaller footprint than status badge; host is secondary info).

---

## Shared Patterns

### SectionErrorBoundary
**Source:** `src/components/SectionErrorBoundary.tsx`
**Import:** `import SectionErrorBoundary from "../components/SectionErrorBoundary";` (default export, no named export)
**Props:** `{ children: ReactNode; name?: string }`
**Apply to:** ForgePage wrapping both list region and detail region independently
```tsx
<SectionErrorBoundary name="Forge Job List">
  <ForgeJobList ... />
</SectionErrorBoundary>
<SectionErrorBoundary name="Forge Job Detail">
  <ForgeJobDetail ... />
</SectionErrorBoundary>
```

### GlassPanel
**Source:** `src/components/GlassPanel.tsx`
**Import:** `import { GlassPanel } from "@/components/GlassPanel";` (named export)
**Props:** `{ children: ReactNode; className?: string; animate?: boolean }`
**Entry animation:** `opacity 0→1, y 8→0, duration 0.2 easeOut` — this is the existing default behavior; pass `animate={false}` to opt out
**Apply to:** ForgePage master-detail container (wraps the list+detail row)
**CONFIRMED EXISTS** at `src/components/GlassPanel.tsx`

### SectionHeader
**Source:** `src/components/SectionHeader.tsx`
**Import:** `import { SectionHeader } from "@/components/SectionHeader";` (named export)
**Props:** `{ title: string; action?: React.ReactNode }`
**Apply to:** ForgeMetadataPanel group dividers use a LIGHTER variant (no `<Separator />` import needed; use `border-t border-border` + mono label directly rather than the full `SectionHeader` component, which is heavier-weight)
**Note:** The UI-SPEC references `SectionHeader` by name but for ForgeMetadataPanel's group dividers, the lighter inline pattern is appropriate. `SectionHeader` itself is available if needed for the page-level header area.

### relativeTime formatter
**Source:** `src/lib/formatters.ts` line 20
**Signature:** `relativeTime(epochSeconds: number): string`
**Input:** epoch seconds (NOT ISO string — convert with `new Date(isoString).getTime() / 1000`)
**Output:** "just now" | "Nm ago" | "Nh ago" | "Nd ago"
**Apply to:** ForgeJobList card timestamp (createdAt field)
**CONFIRMED EXISTS** — takes epoch seconds, NOT ISO string. This is a delta from forge's local `relativeTime(isoString)`.

### Convex conditional query ("skip") pattern
**Source:** `src/layouts/DashboardLayout.tsx` line 358
```tsx
const avatarUrl = useQuery(
  api.avatars.getImageUrl,
  avatarStorageId ? { storageId: avatarStorageId as Id<"_storage"> } : "skip"
);
```
**Apply to:** `useForge.ts` `useForgeJob()` hook when hostId/forgeJobId args are null

### Page header
**Source:** `src/pages/BuildProgress.tsx` line 24
```tsx
<h1 className="text-2xl font-bold text-foreground mb-4">Build Progress</h1>
```
**Apply to:** ForgePage: `<h1 className="text-2xl font-bold text-foreground mb-4">Forge</h1>`

### Tailwind status colors (src/index.css .dark block)
**Source:** `src/index.css` lines ~160–163 (.dark block `--status-*` tokens)
```css
--status-ok:    #22c55e;   /* green-500 */
--status-warn:  #eab308;   /* yellow-500 */
--status-error: #ef4444;   /* red-500 */
--status-info:  #3b82f6;   /* blue-500 */
```
**Apply to:** ForgeStatusBadge Tailwind color classes — use `text-[var(--status-ok)]` etc. for semantic tokens, or the equivalent Tailwind color class (`text-green-500`, `text-yellow-500`, etc.)

---

## Type Adapter — Full Field Map

Convex `forgeJobs` document → forge `Job` type → CodePulse `ForgeJobRow`

| Convex doc field | Forge `Job` field | ForgeJobRow | Notes |
|---|---|---|---|
| `doc.forgeJobId` | `id` | `id` | string |
| `doc.hostId` | n/a | `hostId` | NOT on forge Job; added to ForgeJobRow |
| `doc.agent` | `agent` | `agent` | string |
| `doc.mode` | `mode` | `mode` | `'chat' \| 'goal'` (stored as string in Convex) |
| `doc.prompt` | `prompt` | `prompt` | `string \| null` |
| `doc.workspaceId` | `workspaceId` | `workspaceId` | string |
| `doc.status` | `status` | `status` | cast to `JobStatus` |
| `doc.pid` | `pid` | `pid` | `number \| null` |
| `doc.exitCode` | `exitCode` | `exitCode` | `number \| null` |
| `doc.startedAt` | `startedAt` | `startedAt` | `string \| null` (ISO) |
| `doc.finishedAt` | `finishedAt` | `finishedAt` | `string \| null` (ISO) |
| `doc.artifactCount` | `artifactCount` | `artifactCount` | number |
| `doc.capabilities` | `capabilities` | `capabilities` | JSON string |
| `doc.model` | `model` | `model` | `string \| null` |
| `doc.createdAt` | `createdAt` | `createdAt` | ISO string |
| `doc.updatedAt` | (not on forge Job) | `updatedAt` | Added to ForgeJobRow for metadata panel |
| n/a | `logFile` | (omitted) | NOT mapped — stripped with Logs tab (D-02) |
| `doc._id` | n/a | (omitted) | Convex internal — not needed by components |
| `doc._creationTime` | n/a | (omitted) | Convex internal — use `createdAt` ISO string instead |

**Flag:** Forge `Workspace.id` maps to Convex `doc.workspaceId` — the workspace `rootPath` is stored in `forgeWorkspaces` table but is NOT needed in Phase 79 (stripped with Files tab). No workspace lookup is required for P79 metadata panel.

---

## Primitive Verification Results

| Primitive | Import Path | Props / Signature | Status |
|---|---|---|---|
| `SectionErrorBoundary` | `@/components/SectionErrorBoundary` (default) | `{ children, name? }` | CONFIRMED at `src/components/SectionErrorBoundary.tsx` |
| `GlassPanel` | `@/components/GlassPanel` (named) | `{ children, className?, animate? }` | CONFIRMED at `src/components/GlassPanel.tsx` |
| `SectionHeader` | `@/components/SectionHeader` (named) | `{ title, action? }` | CONFIRMED at `src/components/SectionHeader.tsx` — lighter inline variant preferred for metadata group dividers |
| `Badge` | `@/components/ui/badge` (named) | `variant="outline"` + className override | CONFIRMED at `src/components/ui/badge.tsx` |
| `ScrollArea` | `@/components/ui/scroll-area` (named) | standard Radix | CONFIRMED at `src/components/ui/scroll-area.tsx` |
| `Skeleton` | `@/components/ui/skeleton` (named) | `className` | CONFIRMED — `animate-pulse rounded-md bg-accent` base |
| `relativeTime` | `@/lib/formatters` (named) | `(epochSeconds: number): string` | CONFIRMED — takes EPOCH SECONDS not ISO string; output: "just now" / "Nm ago" / "Nh ago" / "Nd ago" |
| `Flame` icon | `lucide-react` | `Flame` | CONFIRMED present in `lucide-react ^1.8.0` (verified via node); NOT yet imported in DashboardLayout.tsx |
| `formatTimestamp` | `@/lib/formatters` | `(epochSeconds: number): string` | Available but wrong format for metadata panel (time only, not full date+time) — use `new Date(isoString).toLocaleString()` directly instead |

**FLAG — `GlassPanel` animate prop:** The UI-SPEC says "GlassPanel motion for the detail panel: standard opacity 0→1, y 8→0, duration 0.2 easeOut via GlassPanel's existing `animate` prop." Confirmed: `GlassPanel` `animate` prop defaults to `true` and produces exactly this motion (`src/components/GlassPanel.tsx` lines 11–17). No additional motion library setup needed.

**FLAG — no `formatters.relativeTime` for ISO strings:** The CodePulse `relativeTime` function (`formatters.ts` line 20) takes epoch **seconds** (not milliseconds, not ISO). Forge's version (`JobList.tsx` lines 58–71) takes an ISO string. The adapter in `ForgeJobList.tsx` MUST convert: `relativeTime(new Date(job.createdAt).getTime() / 1000)`.

---

## No Analog Found

All 8 files have analogs or forge source components as their direct pattern source. No file is without a match.

The only genuinely new component with no close analog is `ForgeMetadataPanel` — there is no existing CodePulse page with a two-column key/value metadata grid of this exact form. The closest primitives are `SectionHeader` (for group dividers) and `GlassPanel` (for the container), plus the `text-[10px] font-mono uppercase tracking-widest` operational chrome typography visible in `DashboardLayout.tsx` line 249 and in `SectionHeader.tsx`. The planner should compose these primitives rather than looking for an existing metadata panel component.

---

## Metadata

**Analog search scope:** `src/pages/`, `src/hooks/`, `src/components/`, `src/layouts/`, `src/lib/`, `convex/forge.ts`, `C:\Users\mandr\forge\web\src\components\`, `C:\Users\mandr\forge\web\src\types.ts`
**Files scanned:** 18 files read
**Pattern extraction date:** 2026-06-15
