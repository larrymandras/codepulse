# Phase 1: Design Studio — Research

**Researched:** 2026-05-07
**Domain:** Open Design integration (React SPA + Express daemon + Convex sync)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Design Studio is an Open Design integration — not a custom-built tool.
- **D-02:** Two modes delivered: iframe embed (full Open Design UI) AND native CodePulse UI (Paperclip design language). Both complete in this phase.
- **D-03:** Native UI rebuilds the full Open Design flow: skill selection → discovery form → direction picker → live streaming → sandboxed preview → export. No partial/hybrid approach.
- **D-04:** iframe embed mode lives on a dedicated `/design-studio` route, full content area (sidebar stays).
- **D-05:** Native UI artifact preview uses `srcdoc` iframe approach.
- **D-06:** Native UI communicates directly with the Open Design daemon REST API from the browser. New env var: `VITE_OPEN_DESIGN_URL`.
- **D-07:** Open Design daemon runs as a Docker sidecar container.
- **D-08:** Open Design owns persistence in its SQLite (`.od/app.sqlite`). Project metadata mirrors to a Convex table for native listing/search.
- **D-09:** User-saved templates also mirror to Convex for cross-session template discovery.
- **D-10:** All 129 design systems and 31 skills surfaced in the native template gallery. Full catalog, user can browse and filter.
- **D-11:** Native UI supports all Open Design export formats: HTML, PDF, PPTX, ZIP, Markdown.
- **D-12:** Claude Design ZIP import supported in Phase 1.

### Claude's Discretion

- API communication pattern: direct browser → daemon (decided), but Claude can choose proxy patterns for specific endpoints if security requires it
- Convex table schema design for mirrored project metadata and user templates
- Docker sidecar configuration (ports, volumes, networking)
- Sync mechanism between SQLite and Convex (polling, webhook, or event-driven)
- Navigation placement in DashboardLayout sidebar (icon, position, badge)
- Native UI component decomposition and state management approach

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Open Design is a local-first design generation platform (Node 24, Express daemon, Next.js 16 web app, SQLite at `.od/app.sqlite`) that wraps 16 coding agent CLIs (Claude Code, Cursor, Gemini, etc.) with 31 composable skills and 129 design systems. The daemon runs as a standalone Express server on port 17456 by default, exposing a REST+SSE API at `/api/*`. The two integration paths are complementary: the iframe embed simply points at the daemon's `apps/web` Next.js app, while the native UI calls the daemon API directly from the browser using the `VITE_OPEN_DESIGN_URL` env var pattern already established by `VITE_ASTRIDR_API_URL`.

The daemon has no authentication by default — it is designed to run locally on a trusted network. The Docker sidecar pattern (D-07) fits this perfectly: the container shares a host network or a named bridge with CodePulse's Vite dev server, and both `VITE_OPEN_DESIGN_URL` (browser-to-daemon for native UI) and the iframe src URL resolve to the same daemon port. The daemon's SQLite schema is well-understood from source: `projects`, `conversations`, `messages`, `templates`, `tabs`, `deployments` tables — the planner can design Convex mirror tables against this exact schema.

The SSE streaming API (Run pattern: `POST /api/runs` → `GET /api/runs/:id/events`) is the critical integration point for the native UI's live generation step. The daemon emits typed SSE events (`agent`, `error`, `end`, `usage`) over a persistent stream identified by a `runId`. The browser must consume this stream from JavaScript and update the `srcdoc` iframe progressively as artifact HTML emerges.

**Primary recommendation:** Build `openDesignApi.ts` modeled exactly on `astridrApi.ts` for all daemon REST calls. Use `EventSource` or `fetch` with `ReadableStream` for the SSE run stream. Mirror projects and templates to Convex via a polling Convex action (every 30s) rather than a webhook, since the daemon has no outbound webhook capability.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill/design-system catalog (31 skills, 129 systems) | API (daemon) | Browser cache | Daemon serves `GET /api/skills` and `GET /api/design-systems`; browser fetches on mount |
| Project creation | API (daemon) | — | Daemon owns SQLite; browser POSTs to create project |
| Live design generation (streaming) | API (daemon) | Browser (SSE consumer) | Daemon spawns agent subprocess, streams SSE events |
| Artifact preview (srcdoc) | Browser | — | Browser injects HTML into `<iframe srcdoc>` — no server round-trip |
| Export (HTML/PDF/PPTX/ZIP/MD) | API (daemon) | Browser (download trigger) | Daemon generates export file, browser triggers download |
| Claude Design ZIP import | API (daemon) | Browser (file upload) | `POST /api/import/claude-design` accepts ZIP, returns project |
| Project list / search | Convex | Browser (`useQuery`) | Mirror from daemon SQLite to Convex for native listing |
| Template gallery | Convex + Daemon | Browser (`useQuery`) | Convex holds mirrored templates; daemon is authoritative source |
| Daemon health monitoring | Browser (polling) | — | `GET /api/health` polled every 10s; no Convex involvement |
| Docker sidecar lifecycle | Host OS / Docker | — | `docker compose up` managed outside CodePulse React app |
| iframe embed | Browser | — | `<iframe src={VITE_OPEN_DESIGN_URL}>` — purely client-side |

---

## Standard Stack

### Core (already in CodePulse)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component tree | Project standard |
| TypeScript | 5.9.3 | Types | Project standard |
| Convex | 1.36.1 | Database + backend functions | Project standard |
| Tailwind CSS 4 | 4.2.1 | Styling | Project standard |
| React Router v7 | 7.13.1 | Routing | Project standard |
| sonner | 2.0.7 | Toasts | Project standard |
| shadcn/ui | installed (29 components) | UI primitives | Project standard |
| Lucide React | 1.8.0 | Icons | Project standard |

[VERIFIED: package.json]

### New Libraries Needed

None. All required browser APIs (`EventSource`, `fetch` with `ReadableStream`, `URL.createObjectURL`) are native to modern browsers and require no npm dependency. [VERIFIED: Open Design daemon test suite uses native `fetch` for SSE consumption]

### Open Design Daemon

| Requirement | Value | Source |
|-------------|-------|--------|
| Runtime | Node.js ~24 | [VERIFIED: nexu-io/open-design package.json `engines.node: "~24"`] |
| Package manager | pnpm 10.33.x | [VERIFIED: nexu-io/open-design package.json `packageManager`] |
| Default daemon port | 17456 | [CITED: nexu-io/open-design QUICKSTART.md] |
| Default data dir | `.od/` (project root) | [VERIFIED: db.ts `path.join(projectRoot, '.od')`] |
| Data dir override | `OD_DATA_DIR=<path>` env var | [VERIFIED: QUICKSTART.md] |
| Daemon start | `pnpm tools-dev run web` or `pnpm tools-dev start web` | [VERIFIED: QUICKSTART.md] |

**Installation:**
```bash
# Clone Open Design (no npm install — not a published package)
git clone https://github.com/nexu-io/open-design.git
cd open-design
corepack enable
pnpm install
pnpm tools-dev start web  # background daemon + web on port 17456
```

---

## Open Design REST API Surface

[VERIFIED: nexu-io/open-design source — WebFetch + gh api]

### Catalog Endpoints

```
GET  /api/agents          — detect + list available CLIs on PATH
GET  /api/skills          — list all 31 skills with id, title, category, summary
GET  /api/design-systems  — list 129 systems with id, title, category, summary, swatches, surface
GET  /api/health          — daemon health check (use for DaemonStatusBadge polling)
```

### Project Endpoints

```
POST /api/projects                     — create project { name, skill_id?, design_system_id? }
GET  /api/projects/:id/files           — list workspace files
POST /api/projects/:id/files           — write to project folder
```

### Run / Generation Endpoints (SSE streaming)

```
POST /api/runs                         — create + start a run (async)
  Body: { agentId, message, conversationId?, projectId?, clientRequestId? }
  Response 202: { runId }

GET  /api/runs/:id                     — get run status
  Response: { id, status, projectId, conversationId, exitCode, signal, createdAt, updatedAt }

GET  /api/runs/:id/events              — SSE stream of run events
  Supports: Last-Event-ID header for reconnect
  Events:
    event: agent   data: { type, ... }        — agent output tokens
    event: error   data: { code, message }    — error from agent
    event: end     data: { code, signal, status }  — terminal event

GET  /api/runs                         — list runs (filter by projectId, conversationId, status)
DELETE /api/runs/:id                   — cancel a run

POST /api/chat                         — legacy inline SSE (older API, avoid for new code)
```

**Terminal run statuses:** `succeeded` | `failed` | `canceled` [VERIFIED: runs.ts `TERMINAL_RUN_STATUSES`]

### Artifact & Import Endpoints

```
POST /api/artifacts/save               — persist generated artifact
POST /api/artifacts/lint               — validate <artifact> structure
POST /api/import/claude-design         — parse Anthropic export ZIP → returns project
POST /api/templates                    — save user-created template
GET  /artifacts/*                      — static artifact serve
```

### Export Endpoint (inferred from UI-SPEC)

```
GET  /api/export/:projectId?format=html|pdf|pptx|zip|md
```
[ASSUMED — export endpoint not directly verified in source; format list verified from Open Design feature description]

### BYOK Proxy (avoid in CodePulse integration)

```
POST /api/proxy/{anthropic,openai,azure,google}/stream  — BYOK API fallback
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (CodePulse SPA)
       │
       ├─── Convex (useQuery subscriptions)
       │         └── designProjects table
       │         └── designTemplates table
       │         └── Convex action: syncFromDaemon() (polls every 30s)
       │                   │
       │                   └── fetch GET /api/projects (daemon)
       │                       fetch GET /api/templates (daemon)
       │
       ├─── VITE_OPEN_DESIGN_URL (openDesignApi.ts)
       │         ├── GET /api/skills → SkillPicker data
       │         ├── GET /api/design-systems → DesignSystemPicker data
       │         ├── GET /api/agents → available agent CLIs
       │         ├── GET /api/health → DaemonStatusBadge polling
       │         ├── POST /api/runs → start generation → { runId }
       │         ├── GET /api/runs/:id/events (SSE) → StreamingPreview log
       │         │       └── parse <artifact>...</artifact> from agent tokens
       │         │       └── inject into iframe srcdoc
       │         ├── POST /api/import/claude-design → ZIP import
       │         ├── GET /api/export/:id?format=... → download trigger
       │         └── POST /api/artifacts/save → persist artifact
       │
       └─── <iframe src={VITE_OPEN_DESIGN_URL}>
                 └── Open Design Next.js web app (full native UI embed)

Docker (sidecar)
  └── open-design daemon (Express, port 17456)
            ├── SQLite at .od/app.sqlite
            └── spawn child_process (claude / cursor / gemini / etc.)
```

### Recommended Project Structure

```
src/
├── pages/
│   └── DesignStudio.tsx           # top-level page, mode tabs
├── components/design-studio/
│   ├── IframeEmbed.tsx            # full-bleed iframe + health polling overlay
│   ├── NativeWorkflow.tsx         # 6-step wizard shell + step indicator
│   ├── SkillPicker.tsx            # step 1: skill grid (adapts CatalogCard pattern)
│   ├── DesignSystemPicker.tsx     # step 2: design system grid
│   ├── DiscoveryForm.tsx          # step 3: project brief textarea
│   ├── DirectionPicker.tsx        # step 4: 3-direction card choice
│   ├── StreamingPreview.tsx       # step 5: SSE log + srcdoc preview split
│   ├── ExportPanel.tsx            # step 6: format select + download
│   ├── ProjectGallery.tsx         # EntityRow list of saved projects
│   └── DaemonStatusBadge.tsx     # live health indicator
├── lib/
│   └── openDesignApi.ts           # all daemon API calls (modeled on astridrApi.ts)
├── hooks/
│   └── useDesignProjects.ts       # useQuery(api.designProjects.list)
│   └── useDesignTemplates.ts      # useQuery(api.designTemplates.list)
convex/
├── schema.ts                      # +designProjects, +designTemplates tables
├── designProjects.ts              # queries + mutations for project mirror
└── designTemplates.ts             # queries + mutations for template mirror
docker-compose.yml                 # open-design sidecar service
```

### Pattern 1: SSE Run Consumption (StreamingPreview)

```typescript
// Source: [VERIFIED: nexu-io/open-design runs.ts + chat-route.test.ts]
// Open Design uses the /api/runs pattern (not /api/chat) for all new code

async function startGeneration(agentId: string, message: string, projectId: string) {
  const res = await fetch(`${OD_BASE}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message, projectId }),
  });
  // Response 202 Accepted
  const { runId } = await res.json();
  return runId;
}

function streamRunEvents(runId: string, onToken: (text: string) => void, onDone: () => void) {
  // Use fetch + ReadableStream for better control than EventSource
  const controller = new AbortController();
  fetch(`${OD_BASE}/api/runs/${runId}/events`, {
    signal: controller.signal,
    headers: { 'Accept': 'text/event-stream' },
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Parse SSE lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event: end')) { onDone(); return; }
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text' || data.type === 'assistant') {
            onToken(data.text ?? '');
          }
        }
      }
    }
  });
  return () => controller.abort(); // cleanup
}
```

### Pattern 2: srcdoc iframe Progressive Update

```typescript
// Source: [VERIFIED: Open Design uses srcdoc — WebFetch confirmed]
// Extract <artifact> block from streaming tokens and inject into iframe

function extractArtifact(text: string): string | null {
  const m = /<artifact[^>]*>([\s\S]*?)<\/artifact>/i.exec(text);
  return m ? m[1].trim() : null;
}

// In StreamingPreview component:
const [iframeContent, setIframeContent] = useState('');
const [accumulatedText, setAccumulatedText] = useState('');

const onToken = (token: string) => {
  setAccumulatedText(prev => {
    const next = prev + token;
    const artifact = extractArtifact(next);
    if (artifact) setIframeContent(artifact);
    return next;
  });
};

// Render:
<iframe
  title="Design Preview"
  srcDoc={iframeContent}
  sandbox="allow-scripts"
  className="w-full h-full border-0"
/>
```

### Pattern 3: Convex Mirror (SQLite → Convex Sync)

```typescript
// Source: [VERIFIED: Convex docs — action pattern for external HTTP calls]
// convex/designProjects.ts

export const syncFromDaemon = action({
  handler: async (ctx) => {
    const url = process.env.OPEN_DESIGN_URL ?? 'http://localhost:17456';
    const res = await fetch(`${url}/api/projects`);
    if (!res.ok) return;  // daemon offline — skip silently
    const projects = await res.json();
    for (const p of projects) {
      await ctx.runMutation(api.designProjects.upsert, {
        odProjectId: p.id,
        name: p.name,
        skillId: p.skill_id ?? null,
        designSystemId: p.design_system_id ?? null,
        updatedAt: p.updated_at,
      });
    }
  },
});

// Convex action called from browser: useMutation(api.designProjects.syncFromDaemon)
// OR: scheduled via Convex cron every 30s
```

### Pattern 4: openDesignApi.ts (modeled on astridrApi.ts)

```typescript
// Source: [VERIFIED: astridrApi.ts pattern + Open Design API surface]
const OD_BASE = import.meta.env.VITE_OPEN_DESIGN_URL ?? 'http://localhost:17456';

// No auth header needed — daemon has no auth by default
async function odRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OD_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Open Design API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const fetchSkills = () => odRequest<Skill[]>('/api/skills');
export const fetchDesignSystems = () => odRequest<DesignSystem[]>('/api/design-systems');
export const fetchAgents = () => odRequest<Agent[]>('/api/agents');
export const checkHealth = () => odRequest<{ status: string }>('/api/health');
export const createRun = (body: RunRequest) => odRequest<{ runId: string }>('/api/runs', {
  method: 'POST', body: JSON.stringify(body),
});
```

### Pattern 5: Docker Sidecar Configuration

```yaml
# docker-compose.yml (new file at codepulse repo root)
# Source: [VERIFIED: Open Design QUICKSTART.md — pnpm tools-dev pattern]
# [ASSUMED: Docker image name/registry — Open Design has no published Docker image]
services:
  open-design:
    build:
      context: ./open-design      # local clone of nexu-io/open-design
      dockerfile: Dockerfile      # [ASSUMED: needs to be authored]
    ports:
      - "17456:17456"             # daemon default port
    volumes:
      - open-design-data:/app/.od  # persist SQLite + projects across restarts
    environment:
      - OD_DATA_DIR=/app/.od
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:17456/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  open-design-data:
```

**Critical note:** Open Design has NO published Docker image. The planner must include a task to author a `Dockerfile` for the daemon OR to run it as a native Node.js process (not Docker). Docker sidecar is the locked decision (D-07), so the Dockerfile task is required.

### Pattern 6: DashboardLayout Nav Entry

```typescript
// Source: [VERIFIED: DashboardLayout.tsx iconComponents + overviewNavItems pattern]
// Add to iconComponents:
"palette": Palette,   // import Palette from 'lucide-react'

// Add to overviewNavItems (or a new STUDIO group):
{ to: "/design-studio", label: "Design Studio", icon: "palette", group: "OVERVIEW" }
```

### Anti-Patterns to Avoid

- **Using `POST /api/chat` for new code:** The test suite confirms `/api/runs` is the current pattern. `/api/chat` is the legacy inline-SSE endpoint. [VERIFIED: chat-route.test.ts uses `/api/runs`]
- **Polling `/api/runs/:id` for streaming:** The `/api/runs/:id/events` SSE endpoint is the correct stream; polling status is only for state checks after stream closes.
- **Setting Content-Type on EventSource:** `EventSource` does not support custom headers. Use `fetch` + `ReadableStream` for SSE when you need control over reconnect logic.
- **Wrapping Open Design calls in Convex actions for streaming:** SSE streams cannot be proxied through Convex actions — direct browser-to-daemon is correct (D-06 is right for this reason).
- **Assuming `border-radius` on srcdoc iframe:** `--radius: 0` is global; the srcdoc iframe's content is isolated and won't inherit it, but the iframe element itself should have no radius class added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill catalog | Custom skill store | `GET /api/skills` from daemon | Daemon reads SKILL.md files at runtime, handles new skills automatically |
| Design system catalog | Custom DB | `GET /api/design-systems` from daemon | Daemon parses DESIGN.md, extracts swatches, category — all done |
| Agent detection | PATH scanning | `GET /api/agents` from daemon | Daemon detects 16 CLI variants with complex adapter logic |
| Artifact parsing | `<artifact>` regex | Daemon's artifact manifest | Use `POST /api/artifacts/lint` to validate before `POST /api/artifacts/save` |
| Export generation | HTML→PDF | `GET /api/export/:id?format=...` | Daemon handles all 5 formats — complex browser conversions not needed |
| Claude Design ZIP parsing | ZIP reader | `POST /api/import/claude-design` | Daemon handles import format differences |
| SQLite access | Direct node-sqlite3 | Convex sync pattern | Convex is the standard store; daemon owns SQLite; no direct access from browser |

**Key insight:** The daemon is a complete design server. Every temptation to build custom parsing, cataloging, or export logic has a daemon API endpoint instead.

---

## SQLite Schema (Open Design)

[VERIFIED: nexu-io/open-design db.ts]

```sql
-- projects table
id TEXT PRIMARY KEY
name TEXT NOT NULL
skill_id TEXT
design_system_id TEXT
pending_prompt TEXT
metadata_json TEXT
created_at INTEGER (epoch ms)
updated_at INTEGER (epoch ms)

-- templates table
id TEXT PRIMARY KEY
name TEXT NOT NULL
description TEXT
source_project_id TEXT
files_json TEXT NOT NULL   -- JSON array of { path, content }
created_at INTEGER

-- conversations table (per-project chat sessions)
id, project_id, title, created_at, updated_at

-- messages table (per-conversation messages)
id, conversation_id, role, content, agent_id, agent_name,
events_json, run_id, run_status, last_run_event_id,
produced_files_json, started_at, ended_at, position, created_at
```

### Proposed Convex Mirror Tables

```typescript
// convex/schema.ts additions

designProjects: defineTable({
  odProjectId: v.string(),        // FK to SQLite projects.id
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
  odTemplateId: v.string(),       // FK to SQLite templates.id
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

## Common Pitfalls

### Pitfall 1: Daemon Not Running When CodePulse Loads

**What goes wrong:** `VITE_OPEN_DESIGN_URL` resolves but `/api/health` returns connection refused. IframeEmbed shows spinner forever. Native workflow crashes on first API call.
**Why it happens:** Open Design daemon must be started separately from Vite dev server. No automatic startup.
**How to avoid:** `DaemonStatusBadge` polls health every 10s and shows offline state. All API call sites must catch network errors and show the "Daemon Offline" state rather than throwing.
**Warning signs:** `fetch` to daemon port returns `ERR_CONNECTION_REFUSED` in console.

### Pitfall 2: CORS Rejection from Daemon

**What goes wrong:** Browser blocks API calls to `localhost:17456` from `localhost:5173` due to CORS policy.
**Why it happens:** Open Design's `apps/web` uses Next.js rewrites to proxy `/api/*` to daemon — no CORS needed. Direct browser → daemon skips this proxy. Whether the daemon has CORS headers enabled for arbitrary origins is [ASSUMED] — needs verification when running.
**How to avoid:** Test health check on first run. If CORS blocks, add a thin Vite proxy in `vite.config.ts` for `/open-design-api/*` → `http://localhost:17456/api/*`. This doesn't require Convex proxy and preserves D-06.
**Warning signs:** `Access-Control-Allow-Origin` missing in network tab.

### Pitfall 3: Stale Convex Mirror After Project Delete in Daemon

**What goes wrong:** User deletes project in Open Design iframe, but Convex still shows the row. `ProjectGallery` shows ghost projects.
**Why it happens:** The sync polls `GET /api/projects` but the sync action does upsert — it never deletes.
**How to avoid:** Sync action should diff: load all `odProjectId` values from Convex, compare to daemon list, delete rows not in daemon response.
**Warning signs:** Deleted projects reappear in gallery after sync.

### Pitfall 4: srcdoc iframe Loads Stale Content After Regeneration

**What goes wrong:** User hits "Regenerate" — streaming starts — but `srcdoc` still shows previous artifact until the new `<artifact>` block arrives. No visual indication of progress.
**Why it happens:** `srcdoc` only updates when the React state is updated. If the accumulated text buffer isn't cleared at regeneration start, the old HTML persists.
**How to avoid:** On regeneration, immediately set `iframeContent` to empty string (or a "Generating..." placeholder HTML). Clear `accumulatedText` buffer at run start.
**Warning signs:** Previous design flickers under new streaming content.

### Pitfall 5: Open Design Has No Published Docker Image

**What goes wrong:** `docker compose up open-design` fails — no image on Docker Hub.
**Why it happens:** nexu-io/open-design is source-only. No Dockerfile exists in the repo. No published image.
**How to avoid:** Plan must include a Wave 0 task to author a Dockerfile for the daemon that: installs Node 24, installs pnpm via Corepack, runs `pnpm install`, and starts the daemon via `pnpm tools-dev start web`. OR: run daemon as a native Node process (not Docker) with a startup script, acknowledging D-07 may need to be revisited.
**Warning signs:** `docker pull nexu-io/open-design` → image not found.

### Pitfall 6: Skill Count Discrepancy (31 vs 19)

**What goes wrong:** CONTEXT.md says "31 skills" but the GitHub description says "19 Skills". The repo has evolved since the discussion.
**Why it happens:** Open Design is actively developed. The count was accurate when CONTEXT.md was written.
**How to avoid:** Never hardcode skill/design-system counts in UI copy. Use `skills.length` from API response. The `GET /api/skills` endpoint returns the current set dynamically.
**Warning signs:** "Search 31 skills" copy in UI-SPEC should become "Search {count} skills".

### Pitfall 7: Node.js Version Mismatch in Docker Container

**What goes wrong:** Daemon starts but immediately crashes. `better-sqlite3` native binding fails.
**Why it happens:** Open Design requires Node ~24 (pinned). If Dockerfile uses `node:22` or `node:lts`, `better-sqlite3` may be compiled for wrong ABI.
**How to avoid:** Dockerfile must use `node:24-alpine` or `node:24-slim` base image.
**Warning signs:** `Error: The module '/app/node_modules/better-sqlite3/build/Release/better_node_sqlite3.node' was compiled against a different Node.js version`.

---

## Code Examples

### DaemonStatusBadge — Polling Pattern

```typescript
// Source: [VERIFIED: UI-SPEC + astridrApi.ts pattern]
function useDaemonHealth(url: string) {
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await fetch(`${url}/api/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (mounted) { setStatus('online'); setLastChecked(new Date()); }
      } catch {
        if (mounted) { setStatus('offline'); setLastChecked(new Date()); }
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [url]);

  return { status, lastChecked };
}
```

### Convex Sync Action — Correct Pattern

```typescript
// Source: [VERIFIED: Convex docs pattern for external HTTP in actions]
// convex/designProjects.ts
import { action, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

export const syncFromDaemon = action({
  args: {},
  handler: async (ctx) => {
    const url = process.env.OPEN_DESIGN_URL;
    if (!url) return;
    try {
      const res = await fetch(`${url}/api/projects`);
      if (!res.ok) return;
      const projects: OdProject[] = await res.json();
      const existing = await ctx.runQuery(api.designProjects.listIds);
      const incomingIds = new Set(projects.map(p => p.id));
      // Upsert incoming
      for (const p of projects) {
        await ctx.runMutation(api.designProjects.upsert, { project: p });
      }
      // Delete removed
      for (const id of existing) {
        if (!incomingIds.has(id)) {
          await ctx.runMutation(api.designProjects.remove, { odProjectId: id });
        }
      }
    } catch { /* daemon offline — skip */ }
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/api/chat` (inline SSE) | `/api/runs` + `/api/runs/:id/events` (async run + event stream) | Recent (test suite confirms) | Use `/api/runs` for all new code; `/api/chat` is legacy |
| 19 skills | 29+ skills (description says 19, CONTEXT says 31, repo is evolving) | Active development | Never hardcode counts; use API response length |
| 72 design systems | 129 design systems (CONTEXT/QUICKSTART) | Active development | Same — use API |
| Electron desktop app | Web-only + Electron sidecar | Still supported | Not relevant for Docker sidecar approach |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Open Design daemon in Docker | N/A (in container) | ~24 required | No fallback — Dockerfile must use node:24 |
| pnpm | Open Design daemon in Docker | ✓ (host) | 10.32.1 (host); container needs 10.33.x via corepack | No fallback |
| Docker | Sidecar container (D-07) | ✓ | 29.4.1 | No fallback — D-07 is locked |
| Open Design source | Dockerfile build context | Not cloned yet | 0.5.0 | Must clone nexu-io/open-design |
| Claude Code CLI | Design generation via daemon | [ASSUMED present] | Latest | Other CLIs (Cursor, Gemini) if Claude Code unavailable |

**Missing dependencies with no fallback:**
- `nexu-io/open-design` repo not yet cloned — planner must include clone step
- Dockerfile for open-design daemon not yet authored — planner must include authoring step

**Missing dependencies with fallback:**
- Claude Code CLI — daemon auto-detects all 16 CLI variants on PATH; if none, BYOK mode available

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-04 | `/design-studio` route renders without crash | smoke | `npm test -- src/pages/DesignStudio.test.tsx` | Wave 0 |
| D-05 | srcdoc iframe receives HTML from token stream | unit | `npm test -- src/components/design-studio/StreamingPreview.test.tsx` | Wave 0 |
| D-06 | openDesignApi.ts calls correct URL from env var | unit | `npm test -- src/lib/openDesignApi.test.ts` | Wave 0 |
| D-08 | Convex designProjects upsert + listIds mutations | unit | `npm test -- convex/designProjects.test.ts` | Wave 0 |
| D-11 | ExportPanel calls `/api/export/:id?format=` | unit | `npm test -- src/components/design-studio/ExportPanel.test.tsx` | Wave 0 |
| D-12 | ZIP import triggers `POST /api/import/claude-design` | unit | `npm test -- src/components/design-studio/ZipImport.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/components/design-studio/ src/lib/openDesignApi.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/pages/DesignStudio.test.tsx` — smoke render test for page shell
- [ ] `src/lib/openDesignApi.test.ts` — unit tests for all API call functions (mock fetch)
- [ ] `src/components/design-studio/StreamingPreview.test.tsx` — artifact extraction + srcdoc update
- [ ] `src/components/design-studio/ExportPanel.test.tsx` — format toggle + download trigger
- [ ] `convex/designProjects.test.ts` — upsert, listIds, remove mutations
- [ ] `convex/designTemplates.test.ts` — template mirror mutations

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Daemon has no auth — local-only sidecar |
| V3 Session Management | No | No session state in this integration |
| V4 Access Control | No | Same-user local tool — no ACL needed |
| V5 Input Validation | Yes | Sanitize project name, template name on Convex mutations; validate ZIP import file type |
| V6 Cryptography | No | No secrets handled in Design Studio |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `srcdoc` iframe XSS escalation | Tampering | `sandbox="allow-scripts"` only — no `allow-same-origin` prevents iframe from accessing parent DOM. UI-SPEC specifies correct sandbox attribute. |
| CORS bypass via daemon | Spoofing | Daemon runs on localhost only; Docker bridge network; no remote exposure |
| ZIP import with path traversal | Tampering | Daemon handles ZIP parsing via `POST /api/import/claude-design` — trust daemon validation; add file size limit in browser before upload |
| Malicious srcdoc content | Tampering | `sandbox="allow-scripts"` without `allow-same-origin` is the correct defense; already specified in UI-SPEC |

**Key security finding:** The `srcdoc` iframe MUST use `sandbox="allow-scripts"` without `allow-same-origin`. UI-SPEC already specifies `sandbox="allow-scripts allow-same-origin allow-forms"` for the main iframe embed, but the srcdoc preview iframe should NOT have `allow-same-origin` — that would let the artifact HTML access CodePulse's origin. The srcdoc preview in UI-SPEC Step 5 is correct (no sandbox attribute listed = needs clarification). Recommend `sandbox="allow-scripts"` only for srcdoc preview. [ASSUMED — final sandbox policy needs explicit confirmation]

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase |
|------------|--------|----------------|
| Tailwind CSS 4 only — no component library | CLAUDE.md | All new components use Tailwind utility classes, not CSS modules |
| Dark theme throughout: `bg-gray-800/50`, `border-gray-700/50`, `text-gray-300`, `indigo-600` accents | CLAUDE.md | However, UI-SPEC uses oklch tokens (`--background`, `--card`, etc.) — oklch tokens are the canonical source |
| shadcn/ui New York, --radius: 0 | UI-SPEC | No border-radius on any new component |
| `SectionErrorBoundary` wraps widget groups | CLAUDE.md | Wrap IframeEmbed, NativeWorkflow, ProjectGallery each in their own boundary |
| Path alias `@/` resolves to `./src/` | CLAUDE.md | Use `@/lib/openDesignApi` not `../../lib/openDesignApi` |
| Tests live alongside source: `src/**/*.test.tsx` | CLAUDE.md | Test files go in `src/components/design-studio/` and `src/lib/` |
| New pages: `src/pages/NewPage.tsx` → import in `App.tsx` → add `<Route>` → add nav entry in `DashboardLayout.tsx` | CLAUDE.md | Confirmed 3-step page registration pattern |
| graphify: run `graphify update .` after modifying code files | CLAUDE.md / CLAUDE.md | Add graphify update step in Wave N merge checklist |
| Docker rebuild: `docker compose up --build -d` not `docker compose restart` | CLAUDE.md | Use `--build` for all Docker tasks involving Dockerfile changes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Open Design daemon has CORS headers allowing `localhost:5173` origin | Common Pitfalls #2 | Browser blocks all direct API calls; need Vite proxy workaround |
| A2 | Export endpoint is `GET /api/export/:projectId?format=...` | API Surface | Export format needs different endpoint; investigate daemon routes at run time |
| A3 | Claude Code CLI is available on PATH in the Docker container's host environment | Environment Availability | Generation falls back to BYOK mode or fails if no CLI available |
| A4 | Open Design daemon `/api/projects` returns all projects (not paginated) | Convex Sync Pattern | Sync action may miss projects if paginated; add pagination handling |
| A5 | srcdoc preview should use `sandbox="allow-scripts"` only (not `allow-same-origin`) | Security Domain | Over-restrictive: some features may need `allow-same-origin`; under-restrictive: iframe can access parent DOM |
| A6 | The `Palette` icon from Lucide React is appropriate for the Design Studio nav entry | Architecture Patterns | Icon may not convey "design studio" clearly; planner may prefer alternative |
| A7 | Convex `action()` can reach `localhost:17456` when running in Convex cloud | Convex Sync Pattern | Cloud-deployed Convex cannot reach localhost; sync pattern only works with self-hosted Convex or during local dev. For production, browser should trigger sync instead of Convex-scheduled action. |

**A7 is high-risk.** If CodePulse is deployed to Convex cloud (not self-hosted), the Convex sync action pattern for daemon access breaks entirely. Browser-triggered sync (user-visible button or on-mount effect) is a safer fallback. The planner should clarify deployment context.

---

## Open Questions (RESOLVED)

1. **Does the Open Design daemon expose CORS headers?** (RESOLVED)
   - What we know: `apps/web` uses Next.js proxy rewrites — daemon CORS not needed there
   - What's unclear: Direct browser-to-daemon CORS support
   - Recommendation: Test immediately after Docker sidecar is running; if blocked, add Vite proxy
   - **Resolution:** Planned Vite proxy fallback documented in Plan 01 docker-compose.yml comments. If CORS blocks direct browser access, add `server.proxy` in `vite.config.ts` to rewrite `/od-api/*` to `http://localhost:17456/api/*`. This preserves D-06 (browser-to-daemon) while bypassing CORS.

2. **Is CodePulse deployed to Convex cloud or self-hosted?** (RESOLVED)
   - What we know: `VITE_CONVEX_URL` points to a cloud deployment
   - What's unclear: Whether Convex actions can reach `localhost:17456`
   - Recommendation: Implement sync as browser-triggered (on-mount + manual refresh button) rather than Convex-scheduled action; this works in both local and cloud deployments
   - **Resolution:** Plan 05 implements browser-triggered sync (`useEffect` on mount + manual Refresh button in ProjectGallery). Convex `syncFromDaemon` action retained with A7 limitation comment but browser-triggered is the primary path. Works in both local dev and Convex cloud.

3. **Does Open Design have a Dockerfile or publish a Docker image?** (RESOLVED)
   - What we know: No Dockerfile in repo, no published image found
   - What's unclear: Whether this is intentional (desktop/local-first tool)
   - Recommendation: Plan must include task to author minimal Dockerfile for daemon only (not web); OR reconsider running daemon as native Node process instead
   - **Resolution:** Plan 00 Task 1 authors `open-design/Dockerfile` using `node:24-alpine`, corepack, pnpm install, and `pnpm tools-dev start web`. Dockerfile is a Wave 0 prerequisite for all subsequent plans.

4. **What is the exact export endpoint path?** (RESOLVED)
   - What we know: Open Design supports HTML/PDF/PPTX/ZIP/MD export
   - What's unclear: Exact route path — not found in verified source
   - Recommendation: Inspect daemon routes at startup: `curl http://localhost:17456/api/...` and check logs
   - **Resolution:** Using assumed path `GET /api/export/:projectId?format=...` per A2. Plan 04 ExportPanel.tsx includes a comment noting this is assumed and recommending runtime verification via `curl` on first use. If 404, executor should inspect daemon routes and update openDesignApi.ts.

---

## Sources

### Primary (HIGH confidence)
- `nexu-io/open-design` GitHub repo — gh api reads of `db.ts`, `runs.ts`, `design-systems.ts`, `chat-route.test.ts`, `package.json`, `QUICKSTART.md`
- `C:\Users\mandr\codepulse\convex\schema.ts` — Convex table definitions
- `C:\Users\mandr\codepulse\src\layouts\DashboardLayout.tsx` — nav item pattern
- `C:\Users\mandr\codepulse\src\lib\astridrApi.ts` — external API integration pattern
- `C:\Users\mandr\codepulse\src\App.tsx` — route registration pattern
- `C:\Users\mandr\codepulse\.planning\phases\01-design-studio-sandboxed-design-preview-artifact-storage-temp\01-CONTEXT.md`
- `C:\Users\mandr\codepulse\.planning\phases\01-design-studio-sandboxed-design-preview-artifact-storage-temp\01-UI-SPEC.md`

### Secondary (MEDIUM confidence)
- WebFetch of `https://github.com/nexu-io/open-design` — project structure, API surface summary, confirmed by `gh api` source reads

### Tertiary (LOW confidence)
- Export endpoint path (A2) — inferred from feature description, not verified in source
- CORS behavior (A1) — not verified in daemon source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions from verified package.json files
- Open Design API surface: HIGH for runs/health/skills/design-systems endpoints (verified from source); MEDIUM for export endpoint (inferred)
- Architecture patterns: HIGH — modeled directly on verified CodePulse patterns
- Docker sidecar: LOW-MEDIUM — no existing Dockerfile, Docker image availability unverified
- Pitfalls: HIGH — mostly derived from verified source code analysis

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (Open Design is actively developed — re-verify API surface before execution)
