# Phase 2: Email Template Manager — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds the CodePulse management UI for Ástríðr's email template system. The backend is already complete — Supabase tables (`email_layouts`, `email_templates`, `agent_email_defaults`), REST API (full CRUD + preview + asset upload), and rendering engine all live in the Ástríðr repo. This phase delivers a dedicated `/email-templates` page in CodePulse that calls the Ástríðr REST API to manage layouts, content templates, per-agent email defaults, and image assets (logos/avatars).

</domain>

<decisions>
## Implementation Decisions

### Page Structure
- **D-01:** Single `/email-templates` route with 4 tabs: **Layouts**, **Templates**, **Agent Defaults**, **Assets**. Follows the CatalogBrowser tabbed pattern.
- **D-02:** Editing and creating layouts/templates opens in a **Sheet (slide-over panel)** from the right. Same Sheet component for both create and edit — pre-filled with defaults for create, populated from API for edit.
- **D-03:** Agent Defaults tab displays agents as a **card grid** — each card shows avatar thumbnail, signature name/title, and assigned layout. Click opens a Sheet to edit.
- **D-04:** Assets tab shows a **thumbnail grid** of all uploaded images (avatars + logos). Serves as the central gallery. When editing a layout or agent default, an asset picker lets users select from existing uploads OR upload new.

### Template Editing
- **D-05:** HTML body editor uses **Monaco Editor** (the VS Code engine) with syntax highlighting and HTML validation. Used for template `html_body`, `text_body`, and layout `html_header`/`html_footer`/`css`.
- **D-06:** Variable schema editor is an **interactive table** — rows with name, type dropdown, required toggle, description, and example fields. Add/remove rows via buttons. Each row defines one `{{variable}}`.
- **D-07:** Template editor Sheet shows a **variable chips toolbar** above the Monaco editor. Clickable chips insert `{{variable_name}}` at the cursor position. Chips derived from the variable schema table.
- **D-08:** Layout editor Sheet uses **sub-tabs** within the Sheet: Header | Footer | CSS | Settings. Each tab gets its own Monaco editor (Header/Footer/CSS) or form fields (Settings: name, slug, description, logo).

### Preview Behavior
- **D-09:** Template editor Sheet uses a **split layout** — editor fields on the left, rendered email preview (iframe) on the right. Sheet opens wider to accommodate both panels.
- **D-10:** Preview updates via **debounced auto-update** (~500ms after typing stops). Calls the Ástríðr `POST /api/email-templates/{slug}/preview` endpoint. Shows a subtle loading indicator during render.
- **D-11:** Preview sample variable values **auto-fill from the `example` field** in each variable's schema definition. Variables without examples show placeholder text like `[variable_name]`.

### Asset Management
- **D-12:** Image upload fields (logos on layouts, avatars on agent defaults) use **inline dropzones** directly in the Sheet. Show current image thumbnail with a "Replace" overlay on hover.
- **D-13:** Central asset gallery lives as a **4th tab (Assets)** on the main page. Thumbnail grid of all uploaded images from `email-assets/` bucket. Upload new assets here or via inline dropzones in editors.
- **D-14:** When editing a layout logo or agent avatar, an **asset picker** allows selecting from the central gallery OR uploading new. Avoids duplicate uploads.

### Claude's Discretion
- Monaco Editor integration approach (lazy loading, bundle optimization)
- Sheet width breakpoint logic for split preview layout
- Exact debounce timing for preview auto-update
- Loading state patterns for API calls
- Error handling for failed preview renders or asset uploads
- Empty states for each tab (no layouts yet, no templates yet, etc.)
- Component decomposition and hook structure
- Responsive behavior on smaller screens (Sheet width, tab layout)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ástríðr Email Template System (Backend)
- `C:\Users\mandr\astridr-repo\docs\specs\2026-05-08-email-template-engine-design.md` — Complete design spec covering data model (3 Supabase tables), REST API surface (layouts, templates, agent defaults, asset upload), rendering engine, variable syntax (`{{double}}` for text, `{{{triple}}}` for raw HTML slots), and agent integration. **Read this first — it defines the entire API contract this UI consumes.**
- `C:\Users\mandr\astridr-repo\astridr\api\template_routes.py` — Implemented REST API routes (full CRUD + preview + upload). Shows request/response shapes for all endpoints.
- `C:\Users\mandr\astridr-repo\astridr\email\renderer.py` — Template rendering engine. Understanding the render pipeline helps design the preview UX.

### CodePulse Patterns
- `src/layouts/DashboardLayout.tsx` — Sidebar navigation, route registration pattern, `navItems` array + `iconMap`
- `src/pages/Operations.tsx` — Reference for a dedicated page with multiple surfaces (tab pattern)
- `src/lib/astridrApi.ts` — `authHeaders()` pattern for external API calls. All Ástríðr REST calls use this.
- `src/components/hr/CatalogBrowser.tsx` — Tab-based browsing pattern with filters. Reusable for the 4-tab structure.
- `convex/schema.ts` — Existing table definitions (this phase does NOT add Convex tables — data lives in Supabase via Ástríðr API)

### Design Language
- Paperclip design language: shadcn/ui New York, monochromatic oklch palette, `--radius: 0`, Lucide icons
- All new UI follows existing CodePulse conventions (dark theme, `bg-gray-800/50` cards, `border-gray-700/50`, `indigo-600` accents)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EntityRow` — List item pattern, usable for layout/template listing in the Layouts and Templates tabs
- `MetricCard` — Stats display, usable for template counts or layout usage metrics
- `SectionErrorBoundary` — Error isolation for each tab surface
- `CatalogBrowser` / `CatalogCard` / `CatalogFilters` — Tab-based gallery browsing with filters, directly applicable to the 4-tab page structure
- `LoadingState` / `Skeleton` — Loading states during API calls
- `src/lib/astridrApi.ts` — `authHeaders()` + fetch wrapper for Ástríðr API calls

### Established Patterns
- External API integration via `VITE_ASTRIDR_API_URL` env var + `authHeaders()` bearer token
- Direct browser → Ástríðr API communication (no Convex proxy for REST calls)
- Page-level lazy loading via `React.lazy` in `App.tsx`
- shadcn/ui components: `Sheet`, `Tabs`, `Dialog`, `Command` for complex interactions
- Form state management with React `useState` + controlled components

### Integration Points
- `src/App.tsx` — New `<Route>` for `/email-templates` (lazy-loaded)
- `src/layouts/DashboardLayout.tsx` — New nav entry in `navItems` array + icon in `iconMap` (e.g., `Mail` or `FileText` from Lucide)
- `src/lib/astridrApi.ts` — May need new helper functions for template API calls, or raw `fetch` with `authHeaders()` is sufficient
- No Convex changes needed — all data lives in Supabase via Ástríðr's API

</code_context>

<specifics>
## Specific Ideas

- Ástríðr's variable syntax: `{{variable}}` for text (HTML-escaped), `{{{slot}}}` for raw HTML (layout slots). The Monaco editor could syntax-highlight these differently.
- Layout `html_header` and `html_footer` use layout-level placeholders: `{{{content}}}`, `{{{logo_url}}}`, `{{{avatar_url}}}`, `{{{signature_name}}}`, `{{{signature_title}}}` — the sub-tab editors should document these available slots.
- Agent email defaults include: `default_layout_id` (FK to layouts), `signature_name`, `signature_title`, `avatar_storage_path`. The card grid should show which layout is assigned and the rendered signature line.
- Asset upload max size is 5MB, restricted to `avatars/` and `logos/` subfolders per the API.
- The preview endpoint accepts `agent_id` and `channel` ("smtp" or "gmail") — the preview panel could offer a channel toggle to see how images render differently (CID vs public URL).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-Email Template Manager*
*Context gathered: 2026-05-08*
