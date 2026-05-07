# Phase 1: Design Studio — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/DesignStudio.tsx` | page | request-response | `src/pages/Operations.tsx` | exact |
| `src/App.tsx` | config | request-response | `src/App.tsx` (self) | exact |
| `src/layouts/DashboardLayout.tsx` | config | request-response | `src/layouts/DashboardLayout.tsx` (self) | exact |
| `src/lib/openDesignApi.ts` | utility | request-response | `src/lib/astridrApi.ts` | exact |
| `src/hooks/useDesignProjects.ts` | hook | CRUD | `src/hooks/useDailyRhythm.ts` | exact |
| `src/hooks/useDesignTemplates.ts` | hook | CRUD | `src/hooks/useDailyRhythm.ts` | exact |
| `src/components/design-studio/IframeEmbed.tsx` | component | request-response | `src/components/SectionErrorBoundary.tsx` + inline pattern | partial |
| `src/components/design-studio/NativeWorkflow.tsx` | component | request-response | `src/components/hr/WizardShell.tsx` | exact |
| `src/components/design-studio/SkillPicker.tsx` | component | request-response | `src/components/hr/CatalogBrowser.tsx` | exact |
| `src/components/design-studio/DesignSystemPicker.tsx` | component | request-response | `src/components/hr/CatalogBrowser.tsx` | exact |
| `src/components/design-studio/DiscoveryForm.tsx` | component | request-response | `src/components/hr/WizardShell.tsx` (step slot) | role-match |
| `src/components/design-studio/DirectionPicker.tsx` | component | request-response | `src/components/hr/CatalogCard.tsx` | role-match |
| `src/components/design-studio/StreamingPreview.tsx` | component | streaming | no exact analog | none |
| `src/components/design-studio/ExportPanel.tsx` | component | request-response | `src/components/hr/YamlImportDialog.tsx` | role-match |
| `src/components/design-studio/ProjectGallery.tsx` | component | CRUD | `src/components/EntityRow.tsx` | role-match |
| `src/components/design-studio/DaemonStatusBadge.tsx` | component | request-response | `src/hooks/useDockerHealth.ts` (polling pattern) | role-match |
| `convex/schema.ts` | model | CRUD | `convex/schema.ts` (self) | exact |
| `convex/designProjects.ts` | service | CRUD | `convex/docker.ts` + `convex/webhookDelivery.ts` | exact |
| `convex/designTemplates.ts` | service | CRUD | `convex/docker.ts` | exact |
| `docker-compose.yml` | config | — | no analog | none |

---

## Pattern Assignments

### `src/pages/DesignStudio.tsx` (page, request-response)

**Analog:** `src/pages/Operations.tsx`

**Imports pattern** (lines 1-12):
```typescript
import { useMemo } from "react";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
// ... domain-specific component imports
import { useRecentAgentStatus } from "../hooks/useAgentStatus";
import { useDailyRhythm } from "../hooks/useDailyRhythm";
```

**Core page pattern** (lines 13-77):
```typescript
export default function Operations() {
  // 1. Call custom hooks for all data needs
  const statusEvents = useRecentAgentStatus();
  const rhythmEntries = useDailyRhythm();

  // 2. Derive local computed state with useMemo
  const activeCount = useMemo(() => { /* ... */ }, [statusEvents]);

  // 3. Return JSX with space-y-6, h1 with Cinzel font, sections wrapped in SectionErrorBoundary
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-[Cinzel]">Operations</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Agents" value={activeCount} />
      </div>
      <SectionErrorBoundary name="Agent Status">
        <StatusHeartbeatGrid />
      </SectionErrorBoundary>
    </div>
  );
}
```

**Design Studio adaptation:** Replace hooks with `useDesignProjects`, `useDesignTemplates`. Replace section components with `IframeEmbed`, `NativeWorkflow`, `ProjectGallery` — each wrapped in `SectionErrorBoundary`. Add mode tabs (iframe / native) at top.

---

### `src/App.tsx` — Route addition

**Analog:** `src/App.tsx` (self)

**Lazy-load import pattern** (lines 51-52):
```typescript
// Phase 59: Operations page
const Operations = lazy(() => import("./pages/Operations"));
```

**Route registration pattern** (lines 106-108):
```typescript
{/* Phase 59: Operations page */}
<Route path="/operations" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Operations...</div>}><Operations /></Suspense>} />
```

**Design Studio adaptation:** Add after the Operations block:
```typescript
// Phase 01: Design Studio
const DesignStudio = lazy(() => import("./pages/DesignStudio"));
// ...
<Route path="/design-studio" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Design Studio...</div>}><DesignStudio /></Suspense>} />
```

---

### `src/layouts/DashboardLayout.tsx` — Nav entry + icon

**Analog:** `src/layouts/DashboardLayout.tsx` (self)

**Icon registration pattern** (lines 64-96):
```typescript
import {
  // ... existing imports
  Palette,  // ADD THIS — import from lucide-react
} from "lucide-react";

const iconComponents: Record<string, React.ElementType> = {
  // ... existing entries
  "palette": Palette,   // ADD THIS
};
```

**Nav item pattern** (lines 115-138):
```typescript
const overviewNavItems = [
  // ... existing items
  { to: "/design-studio", label: "Design Studio", icon: "palette", group: "OVERVIEW" },
];
```

Position: Insert after `"/operations"` entry (line 129) for logical grouping in the OVERVIEW group.

---

### `src/lib/openDesignApi.ts` (utility, request-response)

**Analog:** `src/lib/astridrApi.ts`

**Base URL + key pattern** (lines 1-2):
```typescript
const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";
```

**Custom error class pattern** (lines 107-115):
```typescript
export class AstridrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AstridrApiError";
    this.status = status;
  }
}
```

**Core `apiRequest` wrapper pattern** (lines 123-133):
```typescript
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASTRIDR_API_BASE}${path}`, {
    headers: authHeaders(),
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new AstridrApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```

**File upload (FormData) pattern** (lines 199-228 — use for ZIP import):
```typescript
export async function importAgentYaml(file: File): Promise<ImportAgentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  // Use raw fetch — FormData needs multipart/form-data, not application/json
  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents/import`, {
    method: "POST",
    headers,
    body: formData,
  });
  // ...
}
```

**Open Design adaptation:** No auth header needed (daemon has no auth). Replace `VITE_ASTRIDR_API_URL` with `VITE_OPEN_DESIGN_URL`. Replace `AstridrApiError` with `OpenDesignApiError`. Add SSE streaming function (see RESEARCH.md Pattern 1) alongside the standard `odRequest` wrapper.

---

### `src/hooks/useDesignProjects.ts` (hook, CRUD)

**Analog:** `src/hooks/useDailyRhythm.ts`

**Full file pattern** (lines 1-6):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDailyRhythm() {
  return useQuery(api.dailyRhythm.list) ?? [];
}
```

**Design Studio adaptation:**
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDesignProjects() {
  return useQuery(api.designProjects.list) ?? [];
}
```

---

### `src/hooks/useDesignTemplates.ts` (hook, CRUD)

**Analog:** `src/hooks/useDailyRhythm.ts` — identical pattern, swap domain name.

---

### `src/components/design-studio/IframeEmbed.tsx` (component, request-response)

No exact analog for a health-aware full-bleed iframe component. Use composition of:

**Health polling pattern** from RESEARCH.md "DaemonStatusBadge — Polling Pattern":
```typescript
function useDaemonHealth(url: string) {
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await fetch(`${url}/api/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (mounted) setStatus('online');
      } catch {
        if (mounted) setStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [url]);
  return { status };
}
```

**Overlay-on-loading pattern** from `src/components/hr/WizardShell.tsx` (lines 57-64):
```typescript
{deploying && (
  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-xl">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Deploying agent...</span>
    </div>
  </div>
)}
```

---

### `src/components/design-studio/NativeWorkflow.tsx` (component, request-response)

**Analog:** `src/components/hr/WizardShell.tsx`

**Full file pattern** (lines 1-111) — direct analog for a multi-step wizard shell. Key patterns:

**Step navigation state + footer** (lines 11-111):
```typescript
export default function WizardShell({ children, wizard }: WizardShellProps) {
  const { currentStep, goNext, goBack, goToStep, totalSteps, stepLabels } = wizard;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <GlassPanel className="m-6 rounded-xl flex flex-col">
      {/* Header with stepper */}
      <div className="px-6 pt-5 pb-3 border-b border-border/30">
        <WizardStepper currentStep={currentStep} totalSteps={totalSteps}
          labels={stepLabels} onStepClick={goToStep} />
      </div>
      {/* Step content slot */}
      <div className="flex-1 overflow-auto px-6 py-5 relative">
        {children}
      </div>
      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-border/30 flex items-center gap-3">
        <button onClick={goBack} disabled={isFirstStep} className="...">Back</button>
        <button onClick={goNext} className="ml-auto ...">
          {isLastStep ? "Generate" : "Next"}
        </button>
      </div>
    </GlassPanel>
  );
}
```

**Design Studio adaptation:** Steps are: SkillPicker → DesignSystemPicker → DiscoveryForm → DirectionPicker → StreamingPreview → ExportPanel. The `WizardStepper` component is reused directly.

---

### `src/components/design-studio/SkillPicker.tsx` (component, request-response)

**Analog:** `src/components/hr/CatalogBrowser.tsx`

**Search + filter + grid pattern** (lines 33-152):
```typescript
export default function CatalogBrowser({ onSelectEntry, embedded }: CatalogBrowserProps) {
  const { query, setQuery, tier, setTier, results, loading, error } = useCatalogSearch();

  return (
    <div className={embedded ? "" : "space-y-4"}>
      <CatalogFilters query={query} onQueryChange={setQuery} tier={tier} onTierChange={setTier} />
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : results.map((entry) => <CatalogCard key={entry.id} entry={entry} onSelect={onSelectEntry} />)}
      </div>
      {!loading && !error && results.length === 0 && query && (
        <p className="text-center text-sm text-muted-foreground py-8">No results found.</p>
      )}
    </div>
  );
}
```

**Card UI pattern** from `src/components/hr/CatalogCard.tsx` (lines 26-58):
```typescript
export function CatalogCard({ entry, onSelect, onPreview }: CatalogCardProps) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 flex flex-col gap-3 hover:border-primary/40 transition-all group">
      <div className="flex items-start gap-3">
        {/* icon/emoji */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">{entry.name}</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {entry.category}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{entry.description}</p>
      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
        <button onClick={() => onSelect(entry)} className="ml-auto text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors">
          Select
        </button>
      </div>
    </div>
  );
}
```

**Design Studio adaptation:** `SkillPicker` fetches from `openDesignApi.fetchSkills()` on mount (not debounced search — full list is small). Replace `useCatalogSearch` with a local `useState` for filter string over the API-fetched array.

---

### `src/components/design-studio/DesignSystemPicker.tsx` (component, request-response)

**Analog:** `src/components/hr/CatalogBrowser.tsx` — identical pattern to SkillPicker. Fetches from `openDesignApi.fetchDesignSystems()`.

---

### `src/components/design-studio/DiscoveryForm.tsx` (component, request-response)

**Analog:** Step-slot content within `src/components/hr/WizardShell.tsx` (no dedicated analog file).

Use standard shadcn/ui `Textarea` + `Label` inside a `space-y-4` form div. Error display pattern from `CatalogBrowser.tsx` (lines 55-68).

---

### `src/components/design-studio/DirectionPicker.tsx` (component, request-response)

**Analog:** `src/components/hr/CatalogCard.tsx`

**Card selection pattern** (lines 26-58) — adapt to a 3-up horizontal card layout where one card is "selected" with a highlighted border:
```typescript
// Selected state pattern:
<div className={cn(
  "bg-card/60 backdrop-blur-sm border rounded-xl p-4 flex flex-col gap-3 transition-all cursor-pointer",
  selected ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/40"
)}>
```

The `cn()` utility is imported from `@/lib/utils` (already used throughout).

---

### `src/components/design-studio/StreamingPreview.tsx` (component, streaming)

**No close analog in the codebase.** Use RESEARCH.md patterns directly:

- **Pattern 1 (SSE Run Consumption):** `fetch` + `ReadableStream`, parse SSE buffer, call `onToken` callback.
- **Pattern 2 (srcdoc iframe Progressive Update):** `extractArtifact()` regex, `useState` for `iframeContent`, `<iframe srcDoc={...} sandbox="allow-scripts" />`.

Import guidance: Use `Loader2` from `lucide-react` for streaming spinner (matches WizardShell pattern). Wrap in `<div className="relative flex-1">` for the overlay pattern from WizardShell.

---

### `src/components/design-studio/ExportPanel.tsx` (component, request-response)

**Analog:** `src/components/hr/YamlImportDialog.tsx`

**File operation + loading + error pattern** (lines 48-70):
```typescript
const handleImport = async () => {
  if (!file) return;
  setImporting(true);
  setErrors([]);
  try {
    const result = await importAgentYaml(file);
    toast.success(`Agent "${result.id}" imported`);
    onOpenChange(false);
  } catch (err) {
    if (err instanceof AstridrApiError && (err as any).validationErrors) {
      setErrors((err as any).validationErrors as string[]);
    } else {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    }
  } finally {
    setImporting(false);
  }
};
```

**Toast pattern:** `import { toast } from "sonner"` — `toast.success()` / `toast.error()`.

**Design Studio adaptation:** ExportPanel has format radio buttons (HTML/PDF/PPTX/ZIP/MD) and a download trigger button. No Dialog wrapper — inline panel within the wizard step slot. Replace file upload with a `<select>` or button group for format. On click: `fetch` the export URL from `openDesignApi`, use `URL.createObjectURL(blob)` for download trigger.

---

### `src/components/design-studio/ProjectGallery.tsx` (component, CRUD)

**Analog:** `src/components/EntityRow.tsx`

**Full EntityRow pattern** (lines 1-28):
```typescript
export function EntityRow({ icon, primary, secondary, trailing, onClick }: EntityRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
    >
      <div className="w-4 h-4 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0 text-xs text-muted-foreground">{trailing}</div>}
    </div>
  );
}
```

**Container pattern:** Wrap list in `<div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">`. Each project row uses `EntityRow` with `FolderOpen` icon (from lucide-react), project name as `primary`, skill/design system as `secondary`, status badge as `trailing`.

---

### `src/components/design-studio/DaemonStatusBadge.tsx` (component, request-response)

**Analog (closest):** `src/hooks/useDockerHealth.ts` for polling pattern; badge display from nav badge pattern in `DashboardLayout.tsx` (lines 202-207).

**Polling interval pattern** from `useDockerHealth` concept — expand to inline `useEffect` with `setInterval(check, 10_000)` (see RESEARCH.md DaemonStatusBadge code example for full implementation).

**Status dot display** from `DashboardLayout.tsx` (lines 238-242):
```typescript
const dotColor = isConnected ? "bg-green-500" : "bg-yellow-500";
<span className={`w-2 h-2 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
<span className="text-xs text-muted-foreground">{statusLabel}</span>
```

---

### `convex/schema.ts` — New table additions

**Analog:** `convex/schema.ts` (self — existing table definitions)

**Table definition pattern** (lines 39-49):
```typescript
sessions: defineTable({
  sessionId: v.string(),
  startedAt: v.float64(),
  lastEventAt: v.float64(),
  status: v.string(), // "active" | "completed" | "errored"
  cwd: v.optional(v.string()),
  model: v.optional(v.string()),
  eventCount: v.float64(),
})
  .index("by_sessionId", ["sessionId"])
  .index("by_status", ["status", "lastEventAt"]),
```

**Design Studio additions** (place after the last existing table, before closing `}`):
```typescript
designProjects: defineTable({
  odProjectId: v.string(),
  name: v.string(),
  skillId: v.optional(v.string()),
  designSystemId: v.optional(v.string()),
  status: v.string(),             // "active" | "completed" | "failed"
  thumbnailUrl: v.optional(v.string()),
  odCreatedAt: v.float64(),
  odUpdatedAt: v.float64(),
  syncedAt: v.float64(),
})
  .index("by_odProjectId", ["odProjectId"])
  .index("by_updatedAt", ["odUpdatedAt"]),

designTemplates: defineTable({
  odTemplateId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  sourceProjectId: v.optional(v.string()),
  skillId: v.optional(v.string()),
  designSystemId: v.optional(v.string()),
  odCreatedAt: v.float64(),
  syncedAt: v.float64(),
})
  .index("by_odTemplateId", ["odTemplateId"])
  .index("by_createdAt", ["odCreatedAt"]),
```

---

### `convex/designProjects.ts` (service, CRUD)

**Analog:** `convex/docker.ts` (upsert-on-conflict + query + delete pattern)

**Upsert pattern** (lines 4-46):
```typescript
export const recordStatus = mutation({
  args: { containerId: v.string(), name: v.string(), /* ... */ },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) => q.eq("containerId", args.containerId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { /* updated fields */ });
    } else {
      await ctx.db.insert("dockerContainers", { /* all fields */ });
    }
  },
});
```

**Delete pattern** (lines 48-57):
```typescript
export const removeByContainerId = mutation({
  args: { containerId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) => q.eq("containerId", args.containerId))
      .first();
    if (doc) await ctx.db.delete(doc._id);
  },
});
```

**Query pattern** (lines 59-67):
```typescript
export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dockerContainers").order("desc").take(20);
  },
});
```

**Action import pattern** from `convex/webhookDelivery.ts` (line 1):
```typescript
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
```

**Design Studio `syncFromDaemon` action** — use RESEARCH.md Pattern 3 (Convex Mirror) directly. Note: as flagged in RESEARCH.md Assumption A7, browser-triggered sync is safer than Convex-scheduled action when Convex is cloud-deployed. Implement as both a public `action` (browser-callable) and keep the cron option as a comment for self-hosted deployments.

---

### `convex/designTemplates.ts` (service, CRUD)

**Analog:** `convex/docker.ts` — identical upsert/delete/list structure, applied to `designTemplates` table. Add `syncFromDaemon` action to fetch from `/api/templates` endpoint.

---

### `docker-compose.yml` (config)

**No analog in codebase.** Use RESEARCH.md Pattern 5 directly. Critical note: Open Design has no published Docker image and no existing Dockerfile — authoring a `Dockerfile` at `./open-design/Dockerfile` is a prerequisite Wave 0 task. The Dockerfile must use `node:24-alpine` base (Open Design `engines.node: "~24"`).

---

## Shared Patterns

### Error Boundaries (all Design Studio components)

**Source:** `src/components/SectionErrorBoundary.tsx`
**Apply to:** `IframeEmbed`, `NativeWorkflow`, `ProjectGallery` in `DesignStudio.tsx`

```typescript
<SectionErrorBoundary name="iframe Embed">
  <IframeEmbed />
</SectionErrorBoundary>
<SectionErrorBoundary name="Native Workflow">
  <NativeWorkflow />
</SectionErrorBoundary>
<SectionErrorBoundary name="Project Gallery">
  <ProjectGallery />
</SectionErrorBoundary>
```

### Toast Notifications (all interactive components)

**Source:** `src/components/hr/YamlImportDialog.tsx` (lines 12, 56-57)
**Apply to:** `ExportPanel`, `IframeEmbed` (daemon offline notice), `NativeWorkflow` (generation errors)

```typescript
import { toast } from "sonner";
// success:
toast.success("Export downloaded");
// error:
toast.error(err instanceof Error ? err.message : "Export failed");
```

### Path Alias

**Source:** `CLAUDE.md`
**Apply to:** All new files

```typescript
// Use @/ not relative paths:
import { openDesignApi } from "@/lib/openDesignApi";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { useDesignProjects } from "@/hooks/useDesignProjects";
```

### Loading Skeleton

**Source:** `src/components/hr/CatalogBrowser.tsx` (lines 14-31)
**Apply to:** `SkillPicker`, `DesignSystemPicker`, `ProjectGallery`

```typescript
function SkeletonCard() {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded bg-muted/50" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted/50" />
          <div className="h-3 w-1/3 rounded bg-muted/50" />
        </div>
      </div>
    </div>
  );
}
```

### Dark Theme Card

**Source:** `src/components/hr/CatalogCard.tsx` (line 28), `src/components/hr/CatalogBrowser.tsx` (line 16)
**Apply to:** All new card/panel components

```
bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4
```

For container panels (no rounding per `--radius: 0` Paperclip rule — but existing code uses `rounded-xl` consistently; follow existing code):
```
bg-card/60 border border-border/40 rounded-xl overflow-hidden
```

### Convex Query Consumption

**Source:** `src/hooks/useDailyRhythm.ts`, `src/hooks/useDockerHealth.ts`
**Apply to:** `useDesignProjects`, `useDesignTemplates`

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useXxx() {
  return useQuery(api.domain.list) ?? [];
}
```

The `?? []` guard handles `undefined` during the initial loading state so consumers always get an array.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/design-studio/StreamingPreview.tsx` | component | streaming | No SSE streaming components exist in codebase. Use RESEARCH.md Patterns 1 and 2 directly. |
| `docker-compose.yml` | config | — | No Docker Compose config exists in repo. Use RESEARCH.md Pattern 5. Requires authoring Open Design Dockerfile first. |

---

## Metadata

**Analog search scope:** `src/pages/`, `src/layouts/`, `src/lib/`, `src/hooks/`, `src/components/`, `src/components/hr/`, `convex/`
**Files scanned:** 20 source files read; ~60 additional files located via Glob/Grep
**Pattern extraction date:** 2026-05-07
