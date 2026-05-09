# Phase 2: Email Template Manager - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 17 (9 new components, 4 new hooks, 1 new page, 1 lib append, 1 utility lib, 1 layout modify, 1 router modify)
**Analogs found:** 16 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/EmailTemplates.tsx` | page | request-response | `src/pages/DesignStudio.tsx` | exact (tabbed page + Tabs + SectionErrorBoundary) |
| `src/App.tsx` | config | — | `src/App.tsx` (self) | exact |
| `src/layouts/DashboardLayout.tsx` | config | — | `src/layouts/DashboardLayout.tsx` (self) | exact |
| `src/lib/astridrApi.ts` | utility | request-response | `src/lib/astridrApi.ts` (self) | exact |
| `src/lib/emailTemplateUtils.ts` | utility | transform | `src/lib/astridrApi.ts` (type shape) | partial |
| `src/hooks/useEmailLayouts.ts` | hook | CRUD | `src/hooks/useCatalog.ts` | exact |
| `src/hooks/useEmailTemplates.ts` | hook | CRUD | `src/hooks/useCatalog.ts` | exact |
| `src/hooks/useAgentDefaults.ts` | hook | CRUD | `src/hooks/useCatalog.ts` | role-match |
| `src/hooks/useEmailAssets.ts` | hook | file-I/O | `src/hooks/useCatalog.ts` | role-match |
| `src/components/email/LayoutSheet.tsx` | component | CRUD | `src/components/hr/AgentDetailSheet.tsx` | exact (Sheet + Tabs + apiRequest + toast) |
| `src/components/email/TemplateSheet.tsx` | component | CRUD + streaming | `src/components/hr/AgentDetailSheet.tsx` | role-match (adds split layout + iframe preview) |
| `src/components/email/AgentDefaultSheet.tsx` | component | CRUD | `src/components/CronSheet.tsx` | role-match |
| `src/components/email/VariableSchemaTable.tsx` | component | transform | `src/components/CronBuilder.tsx` (table row pattern) | partial |
| `src/components/email/VariableChipsToolbar.tsx` | component | event-driven | no analog | none |
| `src/components/email/EmailPreviewPane.tsx` | component | request-response | `src/components/hr/AgentDetailSheet.tsx` (loading state) | partial |
| `src/components/email/AssetDropzone.tsx` | component | file-I/O | `src/components/AvatarUploader.tsx` | exact |
| `src/components/email/AssetPicker.tsx` | component | file-I/O | `src/components/AvatarGallery.tsx` | exact |
| `src/components/email/AssetGallery.tsx` | component | file-I/O | `src/components/AvatarGallery.tsx` | exact |

---

## Pattern Assignments

### `src/pages/EmailTemplates.tsx` (page, request-response)

**Analog:** `src/pages/DesignStudio.tsx`

**Imports pattern** (DesignStudio.tsx lines 1-13):
```typescript
import { useState, useEffect, useCallback } from "react";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import MetricCard from "@/components/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
```

**Page shell pattern** (DesignStudio.tsx lines 37-80):
```typescript
export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState("layouts");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Email Templates</h1>
        <button className="...">+ New Layout</button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="agent-defaults">Agent Defaults</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="layouts">
          <SectionErrorBoundary name="Layouts">
            {/* list + sheet trigger */}
          </SectionErrorBoundary>
        </TabsContent>
        {/* ... repeat for other tabs */}
      </Tabs>
    </div>
  );
}
```

---

### `src/App.tsx` (route registration)

**Analog:** `src/App.tsx` (self — lines 52-58 for lazy import, lines 113-116 for route entry)

**Lazy import pattern** (App.tsx lines 52-58):
```typescript
// Phase 01: Design Studio
const DesignStudio = lazy(() => import("./pages/DesignStudio"));

// Phase 02: Email Template Manager  <- add here
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
```

**Route entry pattern** (App.tsx lines 113-116):
```typescript
{/* Phase 01: Design Studio */}
<Route path="/design-studio" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Design Studio...</div>}><DesignStudio /></Suspense>} />
{/* Phase 02: Email Template Manager */}
<Route path="/email-templates" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Email Templates...</div>}><EmailTemplates /></Suspense>} />
```

---

### `src/layouts/DashboardLayout.tsx` (nav entry)

**Analog:** `src/layouts/DashboardLayout.tsx` (self)

**Icon import pattern** (DashboardLayout.tsx lines 19-57 — add `Mail` to the existing lucide import block):
```typescript
import {
  // ... existing icons ...
  Palette,
  Mail,          // <- add here
} from "lucide-react";
```

**iconComponents map entry** (DashboardLayout.tsx lines 65-98 — append one line):
```typescript
const iconComponents: Record<string, React.ElementType> = {
  // ... existing entries ...
  "palette": Palette,
  "mail": Mail,    // <- add here
};
```

**overviewNavItems entry** (DashboardLayout.tsx lines 118-142 — append before Settings):
```typescript
const overviewNavItems = [
  // ... existing items ...
  { to: "/design-studio", label: "Design Studio", icon: "palette", group: "OVERVIEW" },
  { to: "/email-templates", label: "Email Templates", icon: "mail", group: "OVERVIEW" },  // <- add here
  { to: "/executions", label: "Executions", icon: "list", group: "OVERVIEW" },
  // ...
];
```

---

### `src/lib/astridrApi.ts` (append email API functions)

**Analog:** `src/lib/astridrApi.ts` (self — lines 107-133 for `apiRequest<T>` + `authHeaders`, lines 198-228 for multipart pattern)

**`apiRequest<T>` wrapper** (astridrApi.ts lines 123-133):
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

**Multipart upload pattern** (astridrApi.ts lines 198-228):
```typescript
export async function importAgentYaml(file: File): Promise<ImportAgentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  // Use raw fetch -- FormData needs multipart/form-data, not application/json
  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;

  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents/import`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new AstridrApiError(
      res.status,
      typeof body.detail === "string" ? body.detail : res.statusText,
    );
  }
  return res.json();
}
```

**New email API functions follow `apiRequest<T>` exactly:**
```typescript
// Append after line 307 in astridrApi.ts
// ---------------------------------------------------------------------------
// Phase 02: Email Template Manager
// ---------------------------------------------------------------------------

export const fetchLayouts = () =>
  apiRequest<EmailLayout[]>("/api/email-layouts?is_active=eq.true");

export const createLayout = (body: LayoutCreate) =>
  apiRequest<{ slug: string }>("/api/email-layouts", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateLayout = (slug: string, body: Partial<LayoutCreate>) =>
  apiRequest<{ slug: string }>(`/api/email-layouts/${slug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteLayout = (slug: string) =>
  apiRequest<{ slug: string; status: string }>(`/api/email-layouts/${slug}`, {
    method: "DELETE",
  });

// Templates, agent defaults, assets — same pattern
export const previewTemplate = (
  slug: string,
  body: { variables: Record<string, string>; agent_id?: string; channel?: "smtp" | "gmail" },
) =>
  apiRequest<PreviewResponse>(`/api/email-templates/${slug}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// File upload — use importAgentYaml multipart pattern, NOT apiRequest
export async function uploadEmailAsset(
  file: File,
  folder: "avatars" | "logos",
): Promise<{ storage_path: string; public_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  const url = new URL(`${ASTRIDR_API_BASE}/api/email-assets/upload`);
  url.searchParams.set("folder", folder);
  const res = await fetch(url.toString(), { method: "POST", headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new AstridrApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}
```

---

### `src/lib/emailTemplateUtils.ts` (utility, transform)

**No direct analog** — pure transform functions with no codebase equivalent. Implement fresh:

```typescript
// Variable schema converters (needed for VariableSchemaTable <-> API JSONB)
type VariableRow = { name: string } & VariableDefinition;

export function variableSchemaToRows(schema: Record<string, VariableDefinition>): VariableRow[] {
  return Object.entries(schema).map(([name, def]) => ({ name, ...def }));
}

export function rowsToVariableSchema(rows: VariableRow[]): Record<string, VariableDefinition> {
  const schema: Record<string, VariableDefinition> = {};
  for (const { name, ...def } of rows) {
    if (name.trim()) schema[name.trim()] = def;
  }
  return schema;
}

export function buildSampleVariables(schema: Record<string, VariableDefinition>): Record<string, string> {
  const sample: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema)) {
    sample[name] = def.example || `[${name}]`;
  }
  return sample;
}
```

---

### `src/hooks/useEmailLayouts.ts` (hook, CRUD)

**Analog:** `src/hooks/useCatalog.ts`

**Full hook pattern** (useCatalog.ts lines 1-42):
```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalog, getCatalogEntry } from "@/lib/astridrApi";

export function useCatalogSearch(debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string, t?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchCatalog({ q: q || undefined, tier: t, limit: 50 });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query, tier), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [query, tier, debounceMs, doSearch]);

  return { query, setQuery, tier, setTier, results, loading, error };
}
```

**Adapted pattern for useEmailLayouts:**
```typescript
import { useState, useEffect, useCallback } from "react";
import { fetchLayouts, createLayout, updateLayout, deleteLayout } from "@/lib/astridrApi";
import type { EmailLayout, LayoutCreate } from "@/lib/astridrApi";

export function useEmailLayouts() {
  const [layouts, setLayouts] = useState<EmailLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLayouts();
      setLayouts(data.filter(l => l.is_active !== false)); // client-side soft-delete guard
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { layouts, loading, error, reload: load };
}
```

**useEmailTemplates, useAgentDefaults, useEmailAssets** follow the identical pattern — substitute the fetch function and type.

---

### `src/components/email/LayoutSheet.tsx` (component, CRUD)

**Analog:** `src/components/hr/AgentDetailSheet.tsx`

**Sheet + state + effect pattern** (AgentDetailSheet.tsx lines 1-78):
```typescript
import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function LayoutSheet({ layoutSlug, mode, open, onOpenChange, onSaved }) {
  const [data, setData] = useState<EmailLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || mode === "create") { setData(null); return; }
    setLoading(true);
    fetchLayout(layoutSlug)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, layoutSlug, mode]);
```

**Save action with toast pattern** (AgentDetailSheet.tsx lines 85-112):
```typescript
  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "create") {
        await createLayout(formState);
        toast.success("Layout created");
      } else {
        await updateLayout(layoutSlug, formState);
        toast.success("Layout saved");
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setSaving(false);
    }
  };
```

**Sheet width for LayoutSheet** (per UI-SPEC Sheet Width Contract: 640px):
```typescript
<SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
```
For TemplateSheet (split editor + preview), use `w-[1100px] sm:max-w-[1100px]`.

**Loading skeleton pattern** (AgentDetailSheet.tsx lines 140-152):
```typescript
{loading && (
  <div className="space-y-4 pt-4">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-[320px] w-full" />
  </div>
)}

{error && (
  <div className="flex flex-col items-center gap-4 py-12 text-center">
    <p className="text-sm text-destructive">{error}</p>
    <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
  </div>
)}
```

**Sub-tabs within Sheet** (AgentDetailSheet.tsx lines 1-16 for the combined Sheet+Tabs import; DesignStudio.tsx lines 63-80 for Tabs usage):
```typescript
// LayoutSheet uses sub-tabs for Header | Footer | CSS | Settings
<Tabs defaultValue="header">
  <TabsList>
    <TabsTrigger value="header">Header</TabsTrigger>
    <TabsTrigger value="footer">Footer</TabsTrigger>
    <TabsTrigger value="css">CSS</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="header">
    <div className="h-80">{/* Monaco Editor here - explicit height required */}</div>
  </TabsContent>
</Tabs>
```

---

### `src/components/email/TemplateSheet.tsx` (component, CRUD + streaming)

**Analog:** `src/components/hr/AgentDetailSheet.tsx` (structure) + `src/hooks/useCatalog.ts` (debounce pattern)

**Debounced preview pattern** (useCatalog.ts lines 35-39 — timerRef pattern):
```typescript
import { useRef, useEffect } from "react";

const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

useEffect(() => {
  clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    setPreviewLoading(true);
    try {
      const result = await previewTemplate(slug, { variables: sampleVars, channel });
      setPreviewHtml(result.html);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, 500);
  return () => clearTimeout(timerRef.current);
}, [html, subject, channel, sampleVars]);
```

**iframe preview (srcdoc, not src — security requirement):**
```typescript
// MUST use srcdoc, NEVER dangerouslySetInnerHTML
// sandbox WITHOUT allow-scripts (defense in depth)
<iframe
  srcDoc={previewHtml}
  sandbox="allow-same-origin"
  className="w-full h-full border-0"
  title="Email preview"
/>
```

**Split layout for TemplateSheet (per UI-SPEC Sheet Width Contract: 1100px):**
```typescript
<SheetContent side="right" className="w-[1100px] sm:max-w-[1100px] overflow-y-auto">
  <div className="flex gap-4 h-[calc(100vh-80px)]">
    <div className="flex-1 overflow-y-auto space-y-4">{/* editor left */}</div>
    <div className="w-[400px] shrink-0 flex flex-col">{/* preview right */}</div>
  </div>
</SheetContent>
```

**Create-mode preview disabled (Pitfall 3):**
```typescript
{mode === "create" ? (
  <div className="flex items-center justify-center h-full text-sm text-muted-foreground bg-muted/20 rounded">
    Save the template first to enable preview.
  </div>
) : (
  <EmailPreviewPane slug={slug} html={html} variables={variables} />
)}
```

---

### `src/components/email/AgentDefaultSheet.tsx` (component, CRUD)

**Analog:** `src/components/CronSheet.tsx`

**Simple Sheet wrapper pattern** (CronSheet.tsx lines 1-42):
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface AgentDefaultSheetProps {
  agentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function AgentDefaultSheet({ agentId, open, onOpenChange, onSaved }: AgentDefaultSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Agent Email Defaults</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {/* form fields: signature_name, signature_title, AssetDropzone for avatar, layout selector */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### `src/components/email/AssetDropzone.tsx` (component, file-I/O)

**Analog:** `src/components/AvatarUploader.tsx`

**Drag-drop + hidden input pattern** (AvatarUploader.tsx lines 59-120):
```typescript
// Native drag-drop without react-dropzone (per RESEARCH.md)
const onDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  // handle file
}, []);

// Dropzone UI
<div
  onDrop={onDrop}
  onDragOver={(e) => e.preventDefault()}
  className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-border transition-colors cursor-pointer h-20"
  onClick={() => document.getElementById("asset-file-input")?.click()}
>
  <p className="text-sm text-muted-foreground">Drop an image here or click to browse</p>
  <p className="text-xs text-muted-foreground/60">PNG, JPG, WebP — max 5MB</p>
  <input
    id="asset-file-input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={onFileChange}
    className="hidden"
  />
</div>
```

**File size validation (client-side, ASVS V5):**
```typescript
// Add before upload — AvatarUploader has no size check; AssetDropzone must add it
const MAX_BYTES = 5 * 1024 * 1024;
if (file.size > MAX_BYTES) {
  toast.error("File too large — maximum 5MB");
  return;
}
if (!file.type.startsWith("image/")) {
  toast.error("Only image files are accepted");
  return;
}
```

**Upload call** — use `uploadEmailAsset` from astridrApi.ts (multipart pattern, NOT `authHeaders()`).

---

### `src/components/email/AssetGallery.tsx` (component, file-I/O)

**Analog:** `src/components/AvatarGallery.tsx`

**Thumbnail grid + upload toggle pattern** (AvatarGallery.tsx lines 18-74):
```typescript
export default function AssetGallery({ selectedPath, onSelect, onUpload }) {
  const { assets, loading } = useEmailAssets();
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {assets.map((asset) => (
          <button
            key={asset.storage_path}
            onClick={() => onSelect(asset)}
            className={`p-1 rounded transition-all ${
              selectedPath === asset.storage_path
                ? "ring-2 ring-primary bg-primary/10"
                : "hover:bg-accent/30"
            }`}
          >
            <img src={asset.public_url} alt={asset.name} className="w-full h-16 object-cover rounded" />
          </button>
        ))}
        <button
          onClick={() => setShowUploader(true)}
          className="w-full h-16 border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:border-border transition-colors rounded"
        >
          +
        </button>
      </div>

      {showUploader && (
        <AssetDropzone
          folder="logos"
          onUploaded={(asset) => { setShowUploader(false); onSelect(asset); }}
          onCancel={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}
```

---

### `src/components/email/AssetPicker.tsx` (component, file-I/O)

**Analog:** `src/components/AvatarGallery.tsx` (gallery select) + shadcn `Dialog`

**Dialog wrapping gallery pattern:**
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AssetPicker({ open, onOpenChange, folder, onSelect }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Asset</DialogTitle>
        </DialogHeader>
        <AssetGallery
          onSelect={(asset) => { onSelect(asset); onOpenChange(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}
```

---

### `src/components/email/VariableChipsToolbar.tsx` (component, event-driven)

**No close analog in codebase.** Implement fresh using RESEARCH.md Pattern 3.

**Monaco insert-at-cursor pattern** (RESEARCH.md lines 241-278):
```typescript
import type { OnMount } from "@monaco-editor/react";

// In TemplateSheet — ref is passed down to VariableChipsToolbar
const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

const insertAtCursor = (text: string) => {
  const editor = editorRef.current;
  if (!editor) return;
  const selection = editor.getSelection();
  editor.executeEdits("variable-insert", [{
    range: selection ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
    text,
    forceMoveMarkers: true,
  }]);
  editor.focus();
};

// VariableChipsToolbar renders chips and calls insertAtCursor
export function VariableChipsToolbar({ variables, onInsert }) {
  return (
    <div className="flex flex-wrap gap-1 p-2 bg-muted/20 border border-border rounded-t-md">
      {variables.map((v) => (
        <button
          key={v.name}
          onClick={() => onInsert(`{{${v.name}}}`)}
          className="text-xs px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded transition-colors font-mono"
        >
          {"{{"}{ v.name }{"}}"}
        </button>
      ))}
    </div>
  );
}
```

---

### `src/components/email/EmailPreviewPane.tsx` (component, request-response)

**Analog:** `src/components/hr/AgentDetailSheet.tsx` (loading/error states pattern)

**Loading + error + iframe pattern:**
```typescript
export function EmailPreviewPane({ slug, html, variables, channel }) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await previewTemplate(slug, { variables, channel });
        setPreviewHtml(result.html);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [slug, html, variables, channel]);

  return (
    <div className="flex flex-col h-full border border-border rounded-md overflow-hidden">
      {/* channel toggle + loading indicator in header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 text-xs">
        <span className="text-muted-foreground">Preview</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {error ? (
        <div className="flex items-center justify-center flex-1 text-sm text-destructive">Preview failed</div>
      ) : (
        // MUST use srcdoc, NOT dangerouslySetInnerHTML. sandbox without allow-scripts.
        <iframe
          srcDoc={previewHtml ?? ""}
          sandbox="allow-same-origin"
          className="flex-1 w-full border-0"
          title="Email preview"
        />
      )}
    </div>
  );
}
```

---

### `src/components/email/VariableSchemaTable.tsx` (component, transform)

**No exact analog.** Closest is `src/components/CronBuilder.tsx` for controlled form rows. Implement as controlled table.

**Row-based interactive table pattern:**
```typescript
// Each variable row is an object in a useState array
const [rows, setRows] = useState<VariableRow[]>([]);

const addRow = () => setRows(prev => [...prev, { name: "", type: "string", required: false, description: "", example: "" }]);
const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
const updateRow = (i: number, field: keyof VariableRow, value: unknown) =>
  setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

// Table renders rows with: name input, type <select>, required <Switch>, description input, example input, remove button
// onChange(rowsToVariableSchema(rows)) propagates to parent
```

---

## Shared Patterns

### Auth Headers for Astríðr API Calls
**Source:** `src/lib/astridrApi.ts` lines 117-121 (`authHeaders`) and lines 123-133 (`apiRequest<T>`)
**Apply to:** All hooks (`useEmailLayouts`, `useEmailTemplates`, `useAgentDefaults`, `useEmailAssets`) — these call through `apiRequest<T>` so auth is automatic.
```typescript
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
```

### Multipart Auth (no Content-Type)
**Source:** `src/lib/astridrApi.ts` lines 204-206
**Apply to:** `AssetDropzone.tsx` (calls `uploadEmailAsset`) — the function in astridrApi.ts already handles this, so components just call the function.
```typescript
// Use raw fetch -- FormData needs multipart/form-data, not application/json
const headers: Record<string, string> = {};
if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
// DO NOT set Content-Type
```

### Toast Notifications
**Source:** `src/components/hr/AgentDetailSheet.tsx` lines 91 and 105
**Apply to:** All Sheet save/delete handlers, asset upload completion
```typescript
import { toast } from "sonner";
// Success
toast.success("Layout saved");
// Error — use generic copy, never expose raw API error details (ASVS V7)
toast.error("Failed to save layout");
```

### Error Handling in Hooks
**Source:** `src/hooks/useCatalog.ts` lines 26-30
**Apply to:** All 4 email hooks
```typescript
} catch (err) {
  setError(err instanceof Error ? err.message : "Failed to load");
  setResults([]);
} finally {
  setLoading(false);
}
```

### SectionErrorBoundary Wrapping
**Source:** `src/components/SectionErrorBoundary.tsx` — `<SectionErrorBoundary name="Label">` wraps any tab content that can fail independently.
**Apply to:** Each of the 4 tab content areas in `EmailTemplates.tsx`
```typescript
<TabsContent value="layouts">
  <SectionErrorBoundary name="Layouts">
    {/* list + sheet trigger */}
  </SectionErrorBoundary>
</TabsContent>
```

### Styling Tokens
**Source:** `src/components/ProfileCard.tsx` lines 85, 132 and `src/layouts/DashboardLayout.tsx`
**Apply to:** All new components
- Cards: `bg-card/60 border border-border/40 rounded-xl p-4`  (CatalogBrowser SkeletonCard) or `bg-gray-800/50 border border-gray-700/50 rounded-xl p-4` (ProfileCard)
- Body text: `text-muted-foreground`, active text: `text-foreground`
- Primary accent: `bg-primary` / `text-primary` — NOT hardcoded `indigo-600` (deprecated per RESEARCH.md)
- Font for headings: `font-[Cinzel]`
- Borders: `border-border`

### Delete Confirmation (AlertDialog, not window.confirm)
**Source:** `src/components/hr/AgentDetailSheet.tsx` lines 60 (`showDeregister` state), shadcn `AlertDialog` component
**Apply to:** Delete button in LayoutSheet, TemplateSheet
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
// Show AlertDialog when delete clicked, call deleteLayout/deleteTemplate on confirm
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/email/VariableChipsToolbar.tsx` | component | event-driven | No Monaco Editor integration exists in codebase. No chip-based toolbar exists. Follow RESEARCH.md Pattern 3 (Monaco `executeEdits`). |

---

## Metadata

**Analog search scope:** `src/pages/`, `src/components/`, `src/components/hr/`, `src/hooks/`, `src/lib/`, `src/layouts/`
**Files scanned:** 18 source files read directly
**Key anti-patterns documented:** `authHeaders()` must NOT be used with FormData; `indigo-600` is deprecated (use `bg-primary`); Monaco requires explicit height container; iframe preview must use `srcdoc` with `sandbox` (no `allow-scripts`)
**Pattern extraction date:** 2026-05-09
