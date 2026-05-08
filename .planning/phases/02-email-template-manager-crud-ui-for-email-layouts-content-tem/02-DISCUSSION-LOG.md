# Phase 2: Email Template Manager - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 02-email-template-manager
**Areas discussed:** Page structure, Template editing, Preview behavior, Asset management

---

## Page Structure

### Domain organization

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed page | Single /email-templates route with tabs: Layouts, Templates, Agent Defaults. Matches CatalogBrowser pattern. | ✓ |
| Sidebar master-detail | Left sidebar lists all items grouped by type. Clicking opens editor in main panel. | |
| Sub-routes | /email-templates/layouts, /templates, /agents as separate routes. | |

**User's choice:** Tabbed page
**Notes:** None

### Edit flow

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet (slide-over panel) | shadcn Sheet slides in from the right. List stays visible behind. | ✓ |
| Inline expand | Clicked row expands in-place to reveal editor form below. | |
| Full page editor | Navigate to dedicated editor view with more room. | |

**User's choice:** Sheet (slide-over panel)
**Notes:** None

### Create flow

| Option | Description | Selected |
|--------|-------------|----------|
| Same Sheet | Create and edit use the same slide-over panel. Pre-fills with defaults. | ✓ |
| Dialog first, then Sheet | Dialog collects basics, creates record, then opens Sheet for full editing. | |
| You decide | Let Claude pick. | |

**User's choice:** Same Sheet
**Notes:** None

### Agent Defaults tab display

| Option | Description | Selected |
|--------|-------------|----------|
| Agent card grid | Grid of cards with avatar thumbnail, signature info, assigned layout. | ✓ |
| Table/list view | Simple table: Agent Name, Layout, Signature, Avatar. Compact. | |
| You decide | Let Claude pick. | |

**User's choice:** Agent card grid
**Notes:** None

---

## Template Editing

### HTML body editor

| Option | Description | Selected |
|--------|-------------|----------|
| Code editor (Monaco) | Full syntax highlighting, auto-complete, HTML validation. ~2MB bundle. | ✓ |
| Textarea + syntax hints | Plain textarea with variable chips toolbar above. Lighter weight. | |
| You decide | Let Claude pick. | |

**User's choice:** Code editor (Monaco)
**Notes:** None

### Variable schema editor

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive table | Editable table with name, type dropdown, required toggle, description, example. Add/remove rows. | ✓ |
| JSON editor | Raw JSON editor (Monaco) showing the variables schema. | |
| Form builder style | Visual builder with drag-to-reorder cards. | |

**User's choice:** Interactive table
**Notes:** None

### Layout editor organization

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-tabs in Sheet | Tabs within Sheet: Header, Footer, CSS, Settings. Each gets a Monaco editor. | ✓ |
| Scrollable form | Single scroll with all editors stacked vertically. | |
| You decide | Let Claude pick. | |

**User's choice:** Sub-tabs in Sheet
**Notes:** None

### Variable chips toolbar

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, variable chips toolbar | Row of clickable chips above Monaco editor. Click to insert at cursor. | ✓ |
| No, just the schema table | Users type {{variable_name}} manually. | |

**User's choice:** Yes, variable chips toolbar
**Notes:** None

---

## Preview Behavior

### Preview position

| Option | Description | Selected |
|--------|-------------|----------|
| Split Sheet (editor left, preview right) | Widen Sheet for side-by-side editor + preview. | ✓ |
| Bottom of Sheet | Preview iframe at bottom, scroll down to see. | |
| Separate preview dialog | Preview button opens a Dialog. Keeps Sheet clean. | |

**User's choice:** Split Sheet (editor left, preview right)
**Notes:** None

### Preview update timing

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced auto-update | Re-renders ~500ms after typing stops. Subtle loading indicator. | ✓ |
| Manual button | Explicit Refresh Preview button. | |
| On blur/save | Updates when leaving a field or saving. | |

**User's choice:** Debounced auto-update
**Notes:** None

### Sample variable values

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fill from examples | Use example field from variable schema. Zero effort. | ✓ |
| Editable sample form | Small form above preview for custom sample values. | |
| You decide | Let Claude pick. | |

**User's choice:** Auto-fill from examples
**Notes:** None

---

## Asset Management

### Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline dropzone | Drag-and-drop zone in the Sheet with current thumbnail + Replace overlay. | ✓ |
| Upload dialog | Change image button opens Dialog with file picker and preview. | |
| You decide | Let Claude pick. | |

**User's choice:** Inline dropzone
**Notes:** None

### Central asset browser

| Option | Description | Selected |
|--------|-------------|----------|
| Central gallery + picker | Assets tab showing all uploaded images. Picker in editors to select existing or upload new. | ✓ |
| Per-field only | Each image field has its own dropzone. No central gallery. | |
| You decide | Let Claude pick. | |

**User's choice:** Central gallery + picker
**Notes:** None

### Gallery location

| Option | Description | Selected |
|--------|-------------|----------|
| 4th tab: Assets | Add a 4th tab alongside Layouts, Templates, Agent Defaults. Thumbnail grid. | ✓ |
| Sub-tab within Layouts | Nest as section within layout/agent editors. | |
| You decide | Let Claude pick. | |

**User's choice:** 4th tab: Assets
**Notes:** None

---

## Claude's Discretion

- Monaco Editor integration approach (lazy loading, bundle optimization)
- Sheet width breakpoint logic for split preview layout
- Exact debounce timing for preview auto-update
- Loading state patterns for API calls
- Error handling for failed preview renders or asset uploads
- Empty states for each tab
- Component decomposition and hook structure
- Responsive behavior on smaller screens

## Deferred Ideas

None — discussion stayed within phase scope
