# Phase 2: Email Template Manager — Research

**Researched:** 2026-05-08
**Domain:** React SPA — CRUD UI for email template management, Monaco Editor integration, multipart asset upload, iframe preview
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single `/email-templates` route with 4 tabs: Layouts, Templates, Agent Defaults, Assets. Follows CatalogBrowser tabbed pattern.
- **D-02:** Editing and creating layouts/templates opens in a Sheet (slide-over panel) from the right. Same Sheet for create and edit — pre-filled defaults for create, populated from API for edit.
- **D-03:** Agent Defaults tab displays agents as a card grid — each card shows avatar thumbnail, signature name/title, and assigned layout. Click opens a Sheet to edit.
- **D-04:** Assets tab shows a thumbnail grid of all uploaded images (avatars + logos). Central gallery.
- **D-05:** HTML body editor uses Monaco Editor (`@monaco-editor/react`) with syntax highlighting. Used for `html_body`, `text_body`, and layout `html_header`/`html_footer`/`css`.
- **D-06:** Variable schema editor is an interactive table — rows with name, type, required, description, example. Add/remove rows via buttons.
- **D-07:** Variable chips toolbar above Monaco editor. Clickable chips insert `{{variable_name}}` at cursor.
- **D-08:** Layout editor Sheet uses sub-tabs within Sheet: Header | Footer | CSS | Settings.
- **D-09:** TemplateSheet uses split layout — editor left, rendered email preview (iframe) right.
- **D-10:** Preview updates via debounced auto-update (~500ms). Calls `POST /api/email-templates/{slug}/preview`. Shows loading indicator.
- **D-11:** Preview sample values auto-fill from `example` field in variable schema. Variables without examples show `[variable_name]`.
- **D-12:** Image upload fields use inline dropzones in Sheets. Show current thumbnail with "Replace" overlay on hover.
- **D-13:** Central asset gallery as 4th tab. Thumbnail grid from `email-assets/` bucket.
- **D-14:** Asset picker allows selecting from central gallery OR uploading new. Avoids duplicate uploads.

### Claude's Discretion
- Monaco Editor integration approach (lazy loading, bundle optimization)
- Sheet width breakpoint logic for split preview layout
- Exact debounce timing for preview auto-update
- Loading state patterns for API calls
- Error handling for failed preview renders or asset uploads
- Empty states for each tab
- Component decomposition and hook structure
- Responsive behavior on smaller screens

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 2 builds a dedicated `/email-templates` page in CodePulse that is a pure frontend-to-API integration exercise. The Ástríðr backend is already complete: Supabase tables exist, REST API is implemented in `template_routes.py`, and the rendering engine is live. This phase adds zero Convex tables and makes no backend changes — all data flows through `fetch()` calls to the Ástríðr REST API using the existing `authHeaders()` / `apiRequest<T>()` pattern already in `src/lib/astridrApi.ts`.

The two technically novel elements are (1) Monaco Editor integration and (2) multipart file upload. Monaco requires `@monaco-editor/react` (not currently installed) with CDN-loaded workers — no Vite worker configuration needed with the default CDN strategy. File upload must use raw `fetch()` with FormData and a manual `Authorization` header (not `authHeaders()`, which sets `Content-Type: application/json`). This pattern already exists in the codebase in `importAgentYaml()`.

The UI-SPEC.md is detailed and precise. The planner can treat it as a binding contract for all visual and interaction decisions — component names, sheet widths, typography, color tokens, empty state copy, and toast messages are all fully specified. Research focus below is on API contracts, data shapes, gotchas, and implementation patterns not covered by the UI-SPEC.

**Primary recommendation:** Follow the `apiRequest<T>()` wrapper pattern from `astridrApi.ts` for all new API functions. Install `@monaco-editor/react@4.7.0` with CDN workers. Use the `importAgentYaml` multipart pattern for asset upload.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout/template CRUD | Browser (React) | API (Ástríðr) | CodePulse is a browser SPA; Ástríðr owns data persistence |
| HTML editing | Browser | — | Monaco runs entirely in-browser; no server involvement |
| Live preview rendering | API (Ástríðr) | Browser (iframe) | Preview endpoint does server-side Mustache render + layout assembly |
| Asset storage | API (Ástríðr) | Supabase Storage | Upload proxies through Ástríðr to Supabase Storage bucket |
| Asset listing | Browser | API (Ástríðr) | No dedicated list endpoint — Assets tab uses Supabase Storage API via Ástríðr proxy |
| Agent defaults persistence | API (Ástríðr) | Supabase | Upsert via `PUT /api/agents/{agent_id}/email-defaults` |
| Navigation registration | Browser | — | `overviewNavItems` array in `DashboardLayout.tsx` + `iconComponents` map |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Project baseline |
| TypeScript | 5.9.3 | Type safety | Project baseline |
| shadcn/ui (Radix) | — | Sheet, Tabs, Dialog, AlertDialog, Badge, Switch, Table, ToggleGroup, Skeleton | Already installed per UI-SPEC component inventory |
| Lucide React | 1.8.0 | Icons | Project baseline — `Mail` icon for nav entry |
| Tailwind CSS | 4.2.1 | Styling | Project baseline |
| sonner | 2.0.7 | Toast notifications | Already used in DashboardLayout (`<Toaster />` mounted there) |
| React Router v7 | 7.13.1 | Routing | Project baseline — lazy-loaded `<Route>` in App.tsx |

### New Dependency Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @monaco-editor/react | 4.7.0 | HTML/CSS editor with syntax highlighting | VS Code engine; CDN worker loading; `@uiw/react-codemirror` already installed but Monaco is locked by D-05 |

**Version verified:** `npm view @monaco-editor/react version` → `4.7.0` [VERIFIED: npm registry]

**Installation:**
```bash
npm install @monaco-editor/react
```

No additional packages needed. React-dropzone (15.0.0 available) is NOT required — the dropzone is implemented with native `<input type="file" />` + drag events per the UI-SPEC pattern (80px height, dashed border, native input hidden behind).

### Note on asset listing endpoint
The API spec defines `GET /api/email-assets/{path}` as a proxy for single asset retrieval, NOT a listing endpoint. There is no `GET /api/email-assets` (list all) endpoint in `template_routes.py`. [VERIFIED: template_routes.py read]

The Assets tab thumbnail grid requires a list of all uploaded assets. **Options (Claude's discretion):**
1. Ástríðr exposes a Supabase Storage list via a new endpoint (backend change needed — out of phase scope)
2. Track uploaded assets client-side in React state during the session
3. Call the Supabase Storage REST API directly from the browser using the Supabase public URL pattern
4. Add a thin `GET /api/email-assets` list endpoint to `template_routes.py` as a Wave 0 task (minimal backend addition, stays within phase boundary)

**Recommendation:** Option 4 — add one thin list endpoint. The assets tab is useless without it, and the endpoint is 5 lines of httpx against Supabase Storage's list API. This should be flagged in the plan as a backend prerequisite task.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (CodePulse SPA)
  └── EmailTemplatesPage (/email-templates)
      ├── Tabs (shadcn) ── [Layouts | Templates | Agent Defaults | Assets]
      │
      ├── Layouts tab
      │   ├── fetch GET /api/email-layouts  ──────────────┐
      │   └── LayoutSheet                                  │
      │       ├── Monaco Editor (html, css)                │
      │       ├── AssetPicker → AssetGallery               ▼
      │       └── POST/PUT /api/email-layouts        Ástríðr REST API
      │                                                    │
      ├── Templates tab                                     │
      │   ├── fetch GET /api/email-templates               │
      │   └── TemplateSheet                                 │
      │       ├── Monaco Editor (html)                      │
      │       ├── VariableSchemaTable                       │
      │       ├── VariableChipsToolbar                      │
      │       └── EmailPreviewPane                          │
      │           └── POST /api/email-templates/{slug}/preview
      │                    └── returns {subject, html, text}
      │                         └── iframe srcdoc="..."    │
      │                                                     │
      ├── Agent Defaults tab                                │
      │   ├── fetch GET /api/agents  (existing endpoint)   │
      │   ├── fetch GET /api/agents/{id}/email-defaults     │
      │   └── AgentDefaultSheet                            │
      │       ├── AssetDropzone (avatar)                    │
      │       └── PUT /api/agents/{id}/email-defaults       │
      │                                                     │
      └── Assets tab                                        │
          ├── fetch GET /api/email-assets  [NEW ENDPOINT]   │
          ├── AssetGallery (thumbnail grid)                  │
          └── POST /api/email-assets/upload (multipart)─────┘
                                                            │
                                                      Supabase Storage
                                                      (email-assets bucket)
```

### Recommended Project Structure
```
src/
├── pages/
│   └── EmailTemplates.tsx          # Route page shell, 4-tab layout
├── components/email/
│   ├── LayoutSheet.tsx             # Create/edit layout (sub-tabs: Header|Footer|CSS|Settings)
│   ├── TemplateSheet.tsx           # Create/edit template (split editor+preview)
│   ├── AgentDefaultSheet.tsx       # Edit agent email defaults
│   ├── VariableSchemaTable.tsx     # Interactive variable rows (D-06)
│   ├── VariableChipsToolbar.tsx    # Insert-at-cursor chips (D-07)
│   ├── EmailPreviewPane.tsx        # iframe preview + channel toggle (D-09/10/11)
│   ├── AssetDropzone.tsx           # Inline drag-drop upload (D-12)
│   ├── AssetPicker.tsx             # Dialog: gallery select + upload new (D-14)
│   └── AssetGallery.tsx            # Assets tab thumbnail grid (D-13)
├── hooks/
│   ├── useEmailLayouts.ts          # Layouts CRUD state
│   ├── useEmailTemplates.ts        # Templates CRUD state
│   ├── useAgentDefaults.ts         # Agent defaults state
│   └── useEmailAssets.ts           # Asset list + upload state
└── lib/
    └── astridrApi.ts               # Append email template API functions
```

### Pattern 1: API Request Hook (follow existing useCatalog.ts pattern)
**What:** Fetch-on-mount with loading/error state, using `apiRequest<T>()` from `astridrApi.ts`
**When to use:** All 4 data domains (layouts, templates, agent defaults, assets)

```typescript
// Source: src/hooks/useCatalog.ts (existing pattern — verified in codebase)
export function useEmailLayouts() {
  const [layouts, setLayouts] = useState<EmailLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<EmailLayout[]>("/api/email-layouts");
      setLayouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { layouts, loading, error, reload: load };
}
```

### Pattern 2: Multipart Upload (follow existing importAgentYaml pattern)
**What:** FormData POST with manual Authorization header — do NOT use `authHeaders()` for multipart
**When to use:** `POST /api/email-assets/upload` — file upload to Supabase Storage

```typescript
// Source: src/lib/astridrApi.ts importAgentYaml() — verified in codebase
export async function uploadEmailAsset(
  file: File,
  folder: "avatars" | "logos",
): Promise<{ storage_path: string; public_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  // DO NOT set Content-Type — browser sets multipart/form-data boundary automatically

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

### Pattern 3: Monaco Editor with Insert-at-Cursor
**What:** Monaco instance captured via `onMount`, text insertion via `executeEdits`
**When to use:** VariableChipsToolbar (D-07) — click chip inserts `{{variable_name}}` at cursor

```typescript
// Source: @monaco-editor/react README — verified via WebFetch
import Editor, { OnMount } from "@monaco-editor/react";

const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

const handleMount: OnMount = (editor) => {
  editorRef.current = editor;
};

const insertAtCursor = (text: string) => {
  const editor = editorRef.current;
  if (!editor) return;
  const selection = editor.getSelection();
  editor.executeEdits("variable-insert", [{
    range: selection ?? new monaco.Range(1, 1, 1, 1),
    text,
    forceMoveMarkers: true,
  }]);
  editor.focus();
};

<Editor
  theme="vs-dark"
  language="html"
  value={value}
  onChange={(v) => onChange(v ?? "")}
  onMount={handleMount}
  options={{
    minimap: { enabled: false },
    wordWrap: "on",
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "JetBrains Mono, monospace",
  }}
  loading={<Skeleton className="h-full w-full" />}
/>
```

**Monaco import note:** The `monaco` namespace for `Range` constructor is available via `import * as monaco from "monaco-editor/esm/vs/editor/editor.api"` OR from the second argument to `onMount`. For `executeEdits`, the `range` can be a plain object `{ startLineNumber, startColumn, endLineNumber, endColumn }` — no import needed. [ASSUMED — based on Monaco API knowledge, not verified in session]

### Pattern 4: Lazy Route Registration (follow App.tsx pattern)
**What:** React.lazy + Suspense with fallback div
**When to use:** EmailTemplatesPage in App.tsx

```typescript
// Source: src/App.tsx — verified in codebase (Operations, DesignStudio, etc.)
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));

// In Routes:
<Route
  path="/email-templates"
  element={
    <Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Email Templates...</div>}>
      <EmailTemplates />
    </Suspense>
  }
/>
```

### Pattern 5: Nav Entry Registration
**What:** Add icon to `iconComponents` map + entry to `overviewNavItems`
**When to use:** DashboardLayout.tsx — one-time nav wiring

```typescript
// Source: src/layouts/DashboardLayout.tsx — verified in codebase
// Step 1: Add to iconComponents map
import { Mail } from "lucide-react";
// ...
mail: Mail,

// Step 2: Add to overviewNavItems (UI-SPEC.md specifies placement)
{ to: "/email-templates", label: "Email Templates", icon: "mail", group: "OVERVIEW" },
```

### Pattern 6: Debounced Preview Fetch
**What:** useRef-based debounce timer, POST to preview endpoint, set iframe srcdoc
**When to use:** TemplateSheet EmailPreviewPane (D-10)

```typescript
// Source: useCatalog.ts timerRef pattern — adapted (verified in codebase)
const timerRef = useRef<ReturnType<typeof setTimeout>>();

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

### Anti-Patterns to Avoid

- **Using `authHeaders()` for FormData upload:** `authHeaders()` sets `Content-Type: application/json`, which corrupts multipart boundaries. Use raw `fetch` with only the `Authorization` header for file uploads. [VERIFIED: astridrApi.ts `importAgentYaml` has comment explaining this exact issue]
- **Importing `monaco-editor` directly for workers in Vite:** Default `@monaco-editor/react` uses CDN workers. Configuring Vite workers manually adds complexity with no benefit for this use case. [ASSUMED — CDN default avoids the Vite worker configuration complexity]
- **Calling `is_active=false` records as "deleted":** The DELETE endpoints are soft-deletes (`is_active=false`). The list endpoints (`GET /api/email-layouts`, `GET /api/email-templates`) return ALL rows including inactive ones unless filtered. Add `is_active=eq.true` filter or handle in display. [VERIFIED: template_routes.py list queries use `order=name.asc` with no `is_active` filter]
- **Using `PUT` with partial data for layouts:** `LayoutUpdate` has all optional fields, but the API returns 400 if no fields are provided. Always pass only the changed fields — a full object update works too since None fields are excluded. [VERIFIED: template_routes.py line 134: `{k: v for k, v in body.model_dump().items() if v is not None}`]
- **Agent Defaults without existing agents list:** The `GET /api/agents/{agent_id}/email-defaults` endpoint returns 404 if no row exists for that agent. The Agent Defaults tab needs to fetch the agents list first (from `GET /api/agents` — existing `fetchAgents()` in astridrApi.ts), then fetch defaults for each agent. Handle 404 gracefully as "no defaults configured yet." [VERIFIED: template_routes.py + astridrApi.ts]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code editor with syntax highlighting | Custom textarea + highlight.js | `@monaco-editor/react` | VS Code engine; handles tokenization, cursor, undo/redo, word wrap, accessibility |
| Toast notifications | Custom toast state + div | `sonner` (already installed, already mounted in DashboardLayout) | `toast("Layout saved")` is one line |
| Sheet/dialog focus trap | Custom focus management | shadcn `Sheet` (Radix Dialog) | Radix handles focus trap, Escape key, aria-modal automatically |
| Delete confirmation | `window.confirm()` | shadcn `AlertDialog` | Already installed; matches UI-SPEC requirement; browser confirm has no styling |
| Form dirty tracking | Complex state diffing | Simple `isDirty` boolean (`JSON.stringify(current) !== JSON.stringify(original)`) | This phase uses controlled components, not react-hook-form |
| Debounce utility | `lodash.debounce` | `useRef` + `setTimeout` pattern (already in useCatalog.ts) | No extra dependency; established pattern |

**Key insight:** Almost all complexity in this phase is UI orchestration, not algorithm. The backend does the hard work (rendering, variable substitution, storage). Reuse existing patterns aggressively.

---

## Common Pitfalls

### Pitfall 1: Soft-Delete Filter Missing
**What goes wrong:** Layouts or templates marked `is_active=false` (deleted) appear in the list tabs.
**Why it happens:** `GET /api/email-layouts` has no `is_active` filter — returns all rows. [VERIFIED: template_routes.py line 111]
**How to avoid:** Append `?is_active=eq.true` to list queries, or filter client-side in the hook: `setLayouts(data.filter(l => l.is_active !== false))`.
**Warning signs:** Items reappear after delete on tab refresh.

### Pitfall 2: Monaco Bundle Size Without CDN
**What goes wrong:** If `monaco-editor` is imported directly (not via `@monaco-editor/react`'s CDN default), the production build balloons by ~2MB+ and Vite worker config is required.
**Why it happens:** Monaco includes multiple language workers that must be loaded as web workers.
**How to avoid:** Use `@monaco-editor/react` with no extra configuration — it loads workers from CDN by default. Do NOT add `import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"` unless switching to local workers intentionally.
**Warning signs:** Build size > 3MB, Vite complaining about circular imports.

### Pitfall 3: TemplateSheet Preview Before Slug Exists
**What goes wrong:** Preview endpoint `POST /api/email-templates/{slug}/preview` requires the template to exist in the database. In create mode, the slug doesn't exist yet.
**Why it happens:** Preview calls the renderer which fetches the template from Supabase by slug.
**How to avoid:** In TemplateSheet create mode, disable the live preview pane — show a static placeholder: "Save the template first to enable preview." Preview only works in edit mode (existing slug).
**Warning signs:** 404 errors from preview endpoint during template creation.

### Pitfall 4: Agent Defaults Tab — No Agents Returned
**What goes wrong:** If Ástríðr is not running or `GET /api/agents` returns empty, the Agent Defaults tab shows the "No agent defaults" empty state even when defaults exist in Supabase.
**Why it happens:** The tab must enumerate agents first, then fetch defaults per agent.
**How to avoid:** Distinguish between "no agents registered" and "agents exist but no defaults configured." Use `fetchAgents()` (already in astridrApi.ts) to drive the card grid, then overlay defaults on top.
**Warning signs:** Empty Agent Defaults tab despite Supabase records existing.

### Pitfall 5: FormData Upload Breaks with `authHeaders()`
**What goes wrong:** File upload returns 400 or 422 with garbled body parsing error.
**Why it happens:** `authHeaders()` sets `"Content-Type": "application/json"`. When used with `FormData`, this overrides the browser's auto-generated `multipart/form-data; boundary=...` header, causing the server to fail to parse file parts.
**How to avoid:** For the upload function, set ONLY the `Authorization` header manually. The `importAgentYaml` function in `astridrApi.ts` has a comment explaining this. [VERIFIED: astridrApi.ts line 204-206]
**Warning signs:** "400 Bad Request" on upload, server logs show missing file part.

### Pitfall 6: Missing Asset List Endpoint
**What goes wrong:** The Assets tab has no data to display — no endpoint to list bucket contents.
**Why it happens:** `template_routes.py` only has `GET /api/email-assets/{path}` (single asset proxy), not a list. [VERIFIED: template_routes.py — no list endpoint exists]
**How to avoid:** Wave 0 must include a backend task to add `GET /api/email-assets` endpoint to `template_routes.py`. The endpoint calls Supabase Storage list API and returns `[{name, public_url, size, created_at}]`.
**Warning signs:** Assets tab always shows empty state or requires client-side tracking.

### Pitfall 7: Sheet + Monaco Editor Height Collapse
**What goes wrong:** Monaco Editor renders at 0px height inside a Sheet because the Sheet uses flex column layout and Monaco needs an explicit height container.
**Why it happens:** Monaco requires a parent with a defined height — it doesn't auto-size to content.
**How to avoid:** Wrap Monaco in a container with explicit height: `<div className="h-80">` or `style={{ height: "320px" }}` (the UI-SPEC min-height is 320px). [ASSUMED — standard Monaco constraint, consistent with UI-SPEC note about 320px minimum]
**Warning signs:** Monaco editor appears as a collapsed 0px-height element.

---

## Code Examples

### TypeScript Types for API Response Shapes

```typescript
// Source: derived from template_routes.py Pydantic models — VERIFIED

export interface EmailLayout {
  id: string;
  slug: string;
  name: string;
  description: string;
  html_header: string;
  html_footer: string;
  css: string;
  logo_storage_path: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VariableDefinition {
  type: "string" | "number" | "url" | "html";
  required: boolean;
  description: string;
  example: string;
  default?: string;
}

export interface EmailTemplate {
  id: string;
  layout_id: string | null;
  slug: string;
  name: string;
  purpose: string;
  category: string;
  subject_template: string;
  html_body: string;
  text_body: string;
  variables: Record<string, VariableDefinition>;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentEmailDefaults {
  id: string;
  agent_id: string;
  default_layout_id: string | null;
  signature_name: string;
  signature_title: string;
  avatar_storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface PreviewResponse {
  subject: string;
  html: string;
  text: string;
}
```

### API Functions to Add to astridrApi.ts

```typescript
// Source: derived from template_routes.py endpoints — VERIFIED

// Layouts
export const fetchLayouts = () =>
  apiRequest<EmailLayout[]>("/api/email-layouts?is_active=eq.true");

export const fetchLayout = (slug: string) =>
  apiRequest<EmailLayout>(`/api/email-layouts/${slug}`);

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

// Templates — similar pattern; preview is POST with body
export const previewTemplate = (
  slug: string,
  body: { variables: Record<string, string>; agent_id?: string; channel?: "smtp" | "gmail" },
) =>
  apiRequest<PreviewResponse>(`/api/email-templates/${slug}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// Agent defaults — 404 means "no defaults yet", handle in hook
export const fetchAgentEmailDefaults = (agentId: string) =>
  apiRequest<AgentEmailDefaults>(`/api/agents/${agentId}/email-defaults`);

export const upsertAgentEmailDefaults = (
  agentId: string,
  body: { default_layout_id?: string | null; signature_name: string; signature_title: string; avatar_storage_path: string },
) =>
  apiRequest<{ agent_id: string }>(`/api/agents/${agentId}/email-defaults`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
```

### Variable Schema — Conversion Between Table Rows and API JSONB

```typescript
// The API stores variables as a Record<string, VariableDefinition> (keyed by name).
// The table editor works with an array of {name, ...definition}.
// These converters handle the translation.

type VariableRow = { name: string } & VariableDefinition;

function variableSchemaToRows(
  schema: Record<string, VariableDefinition>,
): VariableRow[] {
  return Object.entries(schema).map(([name, def]) => ({ name, ...def }));
}

function rowsToVariableSchema(
  rows: VariableRow[],
): Record<string, VariableDefinition> {
  const schema: Record<string, VariableDefinition> = {};
  for (const { name, ...def } of rows) {
    if (name.trim()) schema[name.trim()] = def;
  }
  return schema;
}

// Sample variable values for preview (auto-fills from example field per D-11)
function buildSampleVariables(schema: Record<string, VariableDefinition>): Record<string, string> {
  const sample: Record<string, string> = {};
  for (const [name, def] of Object.entries(schema)) {
    sample[name] = def.example || `[${name}]`;
  }
  return sample;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CodeMirror 6 for editors | Monaco (VS Code engine) | Decided D-05 | Monaco has richer HTML+CSS support, VS Code-familiar UX |
| Global `indigo-600` accent | `--primary` oklch token | UI-SPEC (Paperclip design language) | Executor must NOT use `indigo-600` hardcoded hex — use `bg-primary` Tailwind class |
| `react-hook-form` for sheets | `useState` + controlled components | CONTEXT.md pattern | Sheets are simple enough; avoid form library overhead |

**Deprecated/outdated:**
- Hardcoded `indigo-600` color values: UI-SPEC explicitly says use `--primary` tokens only. The CLAUDE.md global mentions `indigo-600` as an older pattern from v4.0 era.

---

## Runtime State Inventory

This is a greenfield UI phase — no rename, refactor, or data migration involved. No runtime state inventory needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ástríðr REST API | All 4 data domains | Unknown at research time | — | Feature gates on `VITE_ASTRIDR_API_URL` env var |
| @monaco-editor/react | HTML/CSS editing (D-05) | NOT INSTALLED | — | Install: `npm install @monaco-editor/react` |
| Supabase Storage `email-assets` bucket | Asset upload/gallery | Unknown — depends on Phase 1 backend completion | — | Upload fails with 502 if bucket missing |
| Node.js / npm | Build tooling | Available | — | — |

**Missing dependencies with no fallback:**
- `@monaco-editor/react` must be installed before any Monaco editor component can be built.
- `email-assets` Supabase Storage bucket must exist (Phase 1 backend deliverable) before upload works.
- `GET /api/email-assets` list endpoint does not exist in current backend — required for Assets tab.

**Missing dependencies with fallback:**
- If Ástríðr API is unavailable during development, each hook can return mock data. The existing `VITE_ASTRIDR_API_URL` defaults to `http://localhost:8181`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react |
| Config file | vite.config.ts (inline vitest config) |
| Quick run command | `npx vitest run src/components/email` |
| Full suite command | `npx vitest run` |

**Baseline:** 3 test files currently failing (pre-existing `SkillPicker.test.tsx` type errors + `ingestAuth` + `openDesignApi` failures — not related to this phase). 62 test files pass. Do not break the 62 passing files.

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File |
|----------|-----------|-------------------|------|
| `variableSchemaToRows` / `rowsToVariableSchema` round-trip | unit | `npx vitest run src/lib/emailTemplateUtils.test.ts` | Wave 0 |
| `buildSampleVariables` uses example or `[name]` fallback | unit | `npx vitest run src/lib/emailTemplateUtils.test.ts` | Wave 0 |
| `uploadEmailAsset` does NOT include Content-Type header in FormData request | unit | `npx vitest run src/lib/astridrApi.test.ts` | Wave 0 |
| `useEmailLayouts` filters out `is_active=false` records | unit | `npx vitest run src/hooks/useEmailLayouts.test.ts` | Wave 0 |
| VariableSchemaTable adds/removes rows | unit | `npx vitest run src/components/email` | Wave 0 |
| AssetDropzone rejects files > 5MB | unit | `npx vitest run src/components/email` | Wave 0 |
| AssetDropzone rejects non-image types | unit | `npx vitest run src/components/email` | Wave 0 |
| EmailPreviewPane shows placeholder in create mode | unit | `npx vitest run src/components/email` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/email src/hooks/useEmail* src/lib/emailTemplate*`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (matching or better than baseline 62 passing files) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/emailTemplateUtils.ts` + `src/lib/emailTemplateUtils.test.ts` — variable schema converters + sample variable builder
- [ ] `src/hooks/useEmailLayouts.test.ts` — is_active filter behavior
- [ ] `src/components/email/` directory — all 9 new component files
- [ ] `src/hooks/useEmailLayouts.ts`, `useEmailTemplates.ts`, `useAgentDefaults.ts`, `useEmailAssets.ts`
- [ ] Backend: `GET /api/email-assets` list endpoint in `astridr-repo/astridr/api/template_routes.py`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | CodePulse has optional Clerk auth; Ástríðr API requires Bearer token via `VITE_ASTRIDR_API_KEY` |
| V3 Session Management | No | SPA session managed by Clerk/localStorage |
| V4 Access Control | No | All users who can access CodePulse can manage email templates |
| V5 Input Validation | Yes | Client-side: variable name regex `[a-z_][a-z0-9_]*`, file size ≤ 5MB, file type image/* |
| V6 Cryptography | No | No crypto in this phase |
| V7 Error Handling | Yes | Never expose raw error details in toast messages — use generic copy from UI-SPEC |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via HTML template injection | Tampering | Preview renders in `iframe` with `srcdoc` — sandboxed from CodePulse DOM. Do NOT use `dangerouslySetInnerHTML` for preview. |
| Oversized file upload bypass | Tampering | Client-side: validate ≤ 5MB before upload. Server-side: Ástríðr also enforces 5MB. [VERIFIED: template_routes.py line 277] |
| API key exposure in browser | Information Disclosure | `VITE_ASTRIDR_API_KEY` is already in use across the codebase. Follow existing pattern — no change needed. |
| Arbitrary file type upload | Tampering | Client-side: accept `image/png,image/jpeg,image/webp` only. Server uses `file.content_type`. |

**Critical:** The iframe preview must use `srcdoc` attribute, NOT `src` with a data URL. The iframe should NOT have `allow-scripts` in its sandbox attribute — rendered HTML may contain `<script>` tags from the layout. The renderer outputs styled HTML, not scripts, but the sandbox provides defense in depth. [ASSUMED — iframe sandboxing best practice]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Monaco `executeEdits` range can be a plain object `{startLineNumber, startColumn, endLineNumber, endColumn}` without importing `monaco.Range` | Code Examples | Cursor insertion fails — TypeScript error; fix: import `monaco` from onMount second param |
| A2 | CDN-loaded Monaco workers work without Vite worker config in production Vite 7 build | Standard Stack | Monaco editors fail to load in production build; fix: add vite-plugin-monaco-editor |
| A3 | `iframe srcdoc` sandbox without `allow-scripts` is sufficient for email HTML preview | Security Domain | Layout HTML with inline JS would be silently blocked — acceptable for email templates |
| A4 | Supabase Storage list API is accessible via Ástríðr's `_supabase_url` + service key pattern used in upload endpoint | Common Pitfalls | List endpoint implementation differs; fix: test against actual Supabase instance |

---

## Open Questions

1. **Asset list endpoint — backend or workaround?**
   - What we know: No list endpoint exists in `template_routes.py`
   - What's unclear: Whether adding a backend endpoint is within Phase 2 scope, or if a workaround (client-side tracking) is acceptable
   - Recommendation: Add the list endpoint in Wave 0 as a backend prerequisite. It's 5-10 lines and unblocks the Assets tab entirely. Mark it as a cross-repo task.

2. **Phase 1 backend completion status**
   - What we know: `template_routes.py` and `renderer.py` exist and are fully implemented
   - What's unclear: Whether the Supabase migration has been applied and the `email-assets` bucket created
   - Recommendation: Wave 0 should include a verification step — hit `GET /api/email-layouts` against the running Ástríðr and confirm 200 (not 503 "Template service not initialized").

3. **Agent Defaults — which agent list to use?**
   - What we know: `fetchAgents()` returns `AgentListItem[]` from `GET /api/agents`
   - What's unclear: Whether ALL agents should appear in the grid, or only those with existing `agent_email_defaults` rows
   - Recommendation: Show all agents (from `GET /api/agents`) and overlay defaults. Cards without defaults show "No email defaults configured" state. This matches D-03 intent.

---

## Sources

### Primary (HIGH confidence)
- `C:\Users\mandr\astridr-repo\astridr\api\template_routes.py` — All API endpoints, request/response shapes, validation rules verified by direct read
- `C:\Users\mandr\astridr-repo\docs\specs\2026-05-08-email-template-engine-design.md` — Complete data model, API surface, render pipeline
- `C:\Users\mandr\codepulse\src\lib\astridrApi.ts` — `authHeaders()`, `apiRequest<T>()`, `importAgentYaml()` multipart pattern
- `C:\Users\mandr\codepulse\src\layouts\DashboardLayout.tsx` — `iconComponents` map, `overviewNavItems`, nav registration pattern
- `C:\Users\mandr\codepulse\src\App.tsx` — Lazy route pattern
- `C:\Users\mandr\codepulse\src\hooks\useCatalog.ts` — Debounce + fetch hook pattern
- `C:\Users\mandr\codepulse\.planning\phases\02-.../02-CONTEXT.md` — All locked decisions
- `C:\Users\mandr\codepulse\.planning\phases\02-.../02-UI-SPEC.md` — Complete visual/interaction contract
- `npm view @monaco-editor/react version` → 4.7.0 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `https://github.com/suren-atoyan/monaco-react` — `onMount` signature, `loader.config`, `loading` prop, CDN worker default behavior [CITED: GitHub README via WebFetch]

### Tertiary (LOW confidence)
- Monaco `executeEdits` plain object range (A1) — [ASSUMED: training knowledge]
- Monaco CDN workers Vite 7 compatibility (A2) — [ASSUMED: training knowledge]
- iframe srcdoc sandbox behavior (A3) — [ASSUMED: training knowledge]

---

## Metadata

**Confidence breakdown:**
- API contracts: HIGH — read directly from `template_routes.py`
- Standard Stack: HIGH — npm registry verified, existing codebase patterns confirmed
- Architecture patterns: HIGH — derived from verified codebase reads
- Monaco integration: MEDIUM — README verified, insert-at-cursor detail assumed
- Asset list gap: HIGH — confirmed absent from `template_routes.py`

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable stack; Ástríðr API is local so no remote versioning concern)
