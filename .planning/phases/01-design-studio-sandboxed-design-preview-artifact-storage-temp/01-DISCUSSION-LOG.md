# Phase 1: Design Studio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 01-design-studio-sandboxed-design-preview-artifact-storage-temp
**Areas discussed:** Studio purpose, Sandbox approach, Storage & templates, Export & sharing

---

## Studio Purpose

### What are users designing?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard builder | Drag-and-drop layout editor for custom dashboard pages | ✓ (partial) |
| Component playground | Storybook-like sandbox to preview/configure individual UI components | ✓ (partial) |
| Agent workflow designer | Visual pipeline/flow editor for Ástríðr agent workflows | |

**User's choice:** "both 1 & 2" — then clarified this is about integrating nexu-io/open-design, not building a custom tool.
**Notes:** User redirected the conversation — the original gray areas assumed a custom-built tool. The actual intent is to embed the Open Design platform (https://github.com/nexu-io/open-design) into CodePulse.

### Integration approach

| Option | Description | Selected |
|--------|-------------|----------|
| iframe embed | Run Open Design as sidecar, embed full UI via iframe | ✓ |
| API + native UI | Run daemon as backend, build CodePulse-native UI calling REST API | ✓ |
| Port the codebase | Fork and rebuild inside CodePulse's React/Convex stack | |

**User's choice:** "lets do 1 and 2 and see how it goes"
**Notes:** Both approaches, not either/or.

### Phase scope

| Option | Description | Selected |
|--------|-------------|----------|
| iframe only | Phase 1 = iframe embed only, native UI later | |
| iframe + native start | iframe embed + begin native API integration | |
| Both complete | Both iframe embed AND full native UI end-to-end | ✓ |

**User's choice:** Both complete

### Daemon setup

| Option | Description | Selected |
|--------|-------------|----------|
| Docker sidecar | Open Design in its own Docker container | ✓ |
| Same host process | Start daemon alongside Vite dev server | |
| You decide | Claude picks | |

**User's choice:** Docker sidecar

### Native UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full flow | Complete Open Design workflow in Paperclip style | ✓ |
| Key surfaces only | Native project list + skill picker, rest stays in iframe | |
| You decide | Claude picks | |

**User's choice:** Full flow

---

## Sandbox Approach

### iframe layout

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated page | New /design-studio route, full content area | ✓ |
| Side panel | Resizable split view | |
| Both modes | Dedicated page + pop-out panel option | |

**User's choice:** Dedicated page

### Artifact preview

| Option | Description | Selected |
|--------|-------------|----------|
| srcdoc iframe | Same sandboxed iframe as Open Design | ✓ |
| Inline render | Render directly in React tree | |
| You decide | Claude picks | |

**User's choice:** srcdoc iframe

### API routing

| Option | Description | Selected |
|--------|-------------|----------|
| Direct to daemon | Browser calls Open Design REST API directly | ✓ |
| Convex proxy | Convex actions proxy requests | |
| You decide | Claude picks | ✓ |

**User's choice:** "You decide"
**Notes:** Claude chose direct-to-daemon based on existing Ástríðr API pattern.

---

## Storage & Templates

### Persistence ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Open Design owns it | SQLite is source of truth, read via REST API | |
| Mirror to Convex | Sync project metadata to Convex table | ✓ |
| Convex primary | Replace SQLite with Convex | |

**User's choice:** Mirror to Convex

### Template catalog scope

| Option | Description | Selected |
|--------|-------------|----------|
| All available | Surface all 129 design systems + 31 skills | ✓ |
| Curated subset | Start with 10-15 most relevant | |
| You decide | Claude picks | |

**User's choice:** All available

### User template sync

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mirror | User templates also sync to Convex | ✓ |
| No, daemon only | Templates stay in SQLite only | |
| You decide | Claude picks | |

**User's choice:** Yes, mirror

---

## Export & Sharing

### Export formats

| Option | Description | Selected |
|--------|-------------|----------|
| All formats | HTML, PDF, PPTX, ZIP, Markdown | ✓ |
| HTML + PDF only | Start with two most common | |
| You decide | Claude picks | |

**User's choice:** All formats

### Claude Design import

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Include Claude Design ZIP import in Phase 1 | ✓ |
| No, skip for now | Focus on creation and export first | |
| You decide | Claude picks | |

**User's choice:** Yes

---

## Claude's Discretion

- API communication: direct browser → daemon (decided by Claude based on Ástríðr pattern)
- Convex table schema for mirrored projects and user templates
- Docker sidecar configuration
- Sync mechanism (polling, webhook, or event-driven)
- Sidebar nav placement and icon
- Native UI component decomposition and state management

## Deferred Ideas

None — discussion stayed within phase scope
