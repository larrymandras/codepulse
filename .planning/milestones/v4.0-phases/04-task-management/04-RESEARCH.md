# Phase 4: Task Management - Research

**Researched:** 2026-04-13
**Domain:** React Kanban DnD, Convex mutations, CodeMirror diff, cron expression UX, WebSocket command dispatch
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Expand Kanban from 3 to 6 columns: backlog → queued → running → review → done → cancelled
- **D-02:** Collapsible columns — auto-collapse empty columns to 40px thin strip with rotated label; expand on hover or task arrival
- **D-03:** Rich task cards — labels/tags, due dates, time-in-column indicator, linked finding badge; left-border priority stripe
- **D-04:** Drag to action columns (running, cancelled) triggers confirmation toast before sending WS command
- **D-05:** Data source architecture — Claude's Discretion: choose best approach for genuine Ástríðr control (Ástríðr WS primary with Convex persistence vs. Convex-primary with WS overlay)
- **D-06:** Both inline ("Create Task" icon button) and batch (checkbox multi-select + "Convert Selected") ideation conversion
- **D-07:** Bidirectional linking — finding shows linked task status badge; task detail shows originating finding
- **D-08:** Full finding status workflow: open → acknowledged → converted → dismissed
- **D-09:** Inline diff preview below editor after "Review Changes"; no modal
- **D-10:** Full hot-reload feedback loop: pending → validating → applied → confirmed status bar; WS ack confirms reload
- **D-11:** Both CodeMirror native undo AND a "Revert to Saved" button
- **D-12:** Visual dropdown cron builder with live human-readable preview
- **D-13:** Inline controls on cron row: play button (manual trigger) + toggle switch (enable/disable)
- **D-14:** Slide-out shadcn Sheet panel for cron create/edit

### Claude's Discretion
- Kanban data source architecture (D-05) — choose the best approach
- KanbanCard component API and layout density within the "rich cards" directive
- Collapsible column animation and collapse threshold
- Diff view library choice (CodeMirror diff extension vs. custom)
- Cron expression builder component design
- Finding-to-task field mapping (severity → priority, category → label)
- Slide-out panel component choice (shadcn Sheet or custom)
- Hot-reload status bar animation and timing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TM-01 | Kanban board with drag-and-drop across task lifecycle columns | @dnd-kit already installed (v6.3.1 core, v10.0.0 sortable); existing 3-col board to expand to 6 |
| TM-02 | Ideation findings with severity/category display and one-click task conversion | convex/ideation.ts has listFindings/dismissFinding; schema needs status workflow fields added |
| TM-03 | Agent config editable from dashboard with diff preview and hot-reload | ConfigEditor.tsx fully functional; @codemirror/merge NOT installed — needs adding |
| TM-04 | Cron jobs manageable with visual builder, manual trigger, enable/disable toggle | Automation.tsx is read-only; CronJobList reads static CRON_SCHEDULES; Sheet/Switch/Select shadcn components NOT installed |

Note: REQUIREMENTS.md maps ALR-01 through ALR-05 to Phase 4, but CONTEXT.md defines the actual Phase 4 scope as TM-01 through TM-04 (Task Management). The ALR requirements are for a different milestone. The planning phase should target TM-01 through TM-04.
</phase_requirements>

---

## Summary

Phase 4 upgrades four existing scaffold surfaces (Tasks, Ideation, ConfigEditor, Automation) that were built in Phase 56. The foundation is strong: @dnd-kit is installed and working, CodeMirror YAML editor has WS integration, and the WebSocket command dispatch pattern (`useCommandDispatch`) is established. The primary work is additive — extending existing components rather than replacing them.

The two new dependencies to install are: `@codemirror/merge` (6.12.1, for inline diff view) and three shadcn components (`sheet`, `switch`, `select`, plus supporting `textarea`, `input`, `label`, `checkbox`). The Convex schema for `ideationFindings` needs new fields for the status workflow and task linking. The `kanban.ts` types file needs expansion to 6 columns.

The data source architecture decision (D-05) is the most consequential design choice. Based on the existing codebase, the current Tasks.tsx already uses a hybrid pattern: Convex `commandExecutions` as source of truth with a local state overlay for optimistic column moves. The right approach for Phase 4 is to extend this pattern — tasks live in a new Convex `tasks` table (not reusing commandExecutions) with WS commands sent for action columns (running, cancelled) as side effects. This gives both persistence and genuine Ástríðr control.

**Primary recommendation:** Extend existing components incrementally. No rewrites — every surface already has the right structural skeleton. Install two new packages, add Convex schema fields, expand types, and layer in the new behaviors.

---

## Standard Stack

### Core (already installed — verified from package.json)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@dnd-kit/core` | ^6.3.1 | DnD context, sensors, collision detection | INSTALLED [VERIFIED: package.json] |
| `@dnd-kit/sortable` | ^10.0.0 | SortableContext, useSortable | INSTALLED [VERIFIED: package.json] |
| `@dnd-kit/utilities` | ^3.2.2 | CSS transform utilities | INSTALLED [VERIFIED: package.json] |
| `@uiw/react-codemirror` | ^4.25.9 | CodeMirror React wrapper | INSTALLED [VERIFIED: package.json] |
| `@codemirror/lang-yaml` | ^6.1.3 | YAML language support | INSTALLED [VERIFIED: node_modules] |
| `convex` | ^1.17.0 | Reactive database + mutations | INSTALLED [VERIFIED: package.json] |
| `sonner` | ^2.0.7 | Toast notifications | INSTALLED [VERIFIED: package.json] |
| `shadcn/ui` | ^4.2.0 | Component system | INSTALLED [VERIFIED: package.json] |
| `js-yaml` | ^4.1.1 | YAML parse/stringify | INSTALLED [VERIFIED: package.json] |

### New dependencies to install

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@codemirror/merge` | 6.12.1 | Inline unified diff view | NOT INSTALLED [VERIFIED: node_modules check] |

### shadcn components to add (not yet installed)

Verified against `src/components/ui/` directory: `badge`, `button`, `command`, `dialog`, `popover`, `separator`, `tooltip` are installed. The following are not:

| Component | Install Command | Required By |
|-----------|----------------|-------------|
| `sheet` | `npx shadcn@latest add sheet` | Cron slide-out panel (D-14) |
| `switch` | `npx shadcn@latest add switch` | Cron enable/disable toggle (D-13) |
| `select` | `npx shadcn@latest add select` | Cron builder dropdowns (D-12) |
| `textarea` | `npx shadcn@latest add textarea` | Task description field |
| `input` | `npx shadcn@latest add input` | Task/cron form fields |
| `label` | `npx shadcn@latest add label` | Form field labels |
| `checkbox` | `npx shadcn@latest add checkbox` | Ideation multi-select (D-06) |

[VERIFIED: src/components/ui/ directory listing confirms none of the above are present]

**Installation:**
```bash
cd C:/Users/mandr/codepulse
npm install @codemirror/merge
npx shadcn@latest add sheet switch select textarea input label checkbox
```

---

## Architecture Patterns

### Recommended Data Source Architecture (D-05 resolution)

**Decision: Convex-primary for tasks, WS commands for Ástríðr side effects.**

Rationale based on codebase analysis:
- The existing Tasks.tsx already uses `commandExecutions` from Convex + local state override. The `commandExecutions` table is for Ástríðr-originated executions, not operator-created tasks. These are fundamentally different entities.
- A dedicated `tasks` Convex table is the correct architecture. Tasks persist, survive WS disconnections, and are queryable.
- WS `task.move` commands are sent when tasks enter action columns (running, cancelled) — this signals Ástríðr to act. Convex reflects the state immediately via optimistic update; WS ack confirms Ástríðr received it.
- This matches the existing `useCommandDispatch` pattern already established.

```typescript
// Recommended task data flow
// 1. Operator creates task → insert to Convex tasks table
// 2. Operator drags to "running" → optimistic Convex update + sendCommand({ type: "task.move", task_id, column: "running" })
// 3. WS ack received → column confirmed (or revert on error)
// 4. Ástríðr sends task.status_update event → Convex mutation updates task
```

### New Convex Schema Additions

**`tasks` table (new):**
```typescript
tasks: defineTable({
  taskId: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  priority: v.string(), // "high" | "medium" | "low"
  column: v.string(),   // "backlog" | "queued" | "running" | "review" | "done" | "cancelled"
  agentId: v.optional(v.string()),
  agentName: v.optional(v.string()),
  labels: v.optional(v.array(v.string())),
  dueAt: v.optional(v.number()),
  columnEnteredAt: v.number(),    // unix ms — for time-in-column
  findingId: v.optional(v.id("ideationFindings")),  // bidirectional link (D-07)
  createdAt: v.number(),
})
  .index("by_column", ["column", "createdAt"])
  .index("by_findingId", ["findingId"])
```

**`ideationFindings` table — schema additions (patch existing):**
```typescript
// Add these fields to ideationFindings:
status: v.optional(v.string()),  // "open" | "acknowledged" | "converted" | "dismissed"
taskId: v.optional(v.string()),  // linked task ID (D-07)
acknowledgedAt: v.optional(v.number()),
convertedAt: v.optional(v.number()),
```

Note: `dismissed` boolean field stays for backward compatibility; `status` field is the new canonical source. Migration: treat `dismissed: true` as `status: "dismissed"` in query layer.

### Expanded Type Definitions

```typescript
// src/types/kanban.ts — expand existing
export type TaskPriority = "high" | "medium" | "low";
export type TaskColumn =
  | "backlog"
  | "queued"
  | "running"
  | "review"
  | "done"
  | "cancelled";

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  column: TaskColumn;
  agentId?: string;
  agentName?: string;
  labels?: string[];
  dueAt?: number;          // unix seconds
  columnEnteredAt: number; // unix seconds — for time-in-column display
  findingId?: string;      // linked ideation finding
  createdAt: number;
}
```

### Collapsible Column Pattern

```typescript
// KanbanColumn — collapsible state management
const [isCollapsed, setIsCollapsed] = useState(false);
const prevTaskCount = useRef(tasks.length);

useEffect(() => {
  // Auto-collapse when count drops to 0 (not on initial render)
  if (prevTaskCount.current > 0 && tasks.length === 0) {
    setIsCollapsed(true);
  }
  // Auto-expand when tasks arrive
  if (tasks.length > 0 && isCollapsed) {
    setIsCollapsed(false);
  }
  prevTaskCount.current = tasks.length;
}, [tasks.length]);

// CSS: transition-[width] duration-200 ease-in-out
// Collapsed: w-10 (40px), Expanded: w-[260px]
```

### @codemirror/merge Diff View

The UI-SPEC chose `@codemirror/merge` for the inline diff view. This is the correct choice — it integrates natively with the existing CodeMirror setup.

```typescript
// Usage pattern for inline diff (D-09)
import { MergeView } from "@codemirror/merge";
// OR use as React component with @uiw/react-codemirror extensions

// Simpler approach that matches the read-only diff requirement:
// Implement a custom diff renderer using the `diff` algorithm from @codemirror/merge
// and render as a styled div — avoids full MergeView overhead for read-only display
```

**Important:** The UI-SPEC calls for a read-only diff panel (not an interactive merge editor). A lightweight custom diff renderer using simple line comparison may be more appropriate than the full MergeView — avoids a second editor instance. The diff can be computed with a simple line-by-line comparison against `originalContent`. If `@codemirror/merge` API is complex, a pure JS diff implementation is acceptable since this is display-only.

**Recommendation for D-09:** Implement custom diff renderer. Compare `yamlContent.split('\n')` against `originalContent.split('\n')`, render each line with +/-/space prefix and oklch color tokens. No additional library needed beyond `@codemirror/merge` for the actual diffing algorithm if needed, but even that can be omitted for a line-based display.

### Cron Expression Builder Pattern

The visual builder maps frequency selections to cron fields:

```typescript
type FrequencyPreset = "every_minute" | "every_hour" | "every_day" | "every_week" | "custom";

const FREQUENCY_TO_CRON: Record<string, (h: number, m: number, dow: number) => string> = {
  every_minute: () => "* * * * *",
  every_hour: (_, m) => `${m} * * * *`,
  every_day: (h, m) => `${m} ${h} * * *`,
  every_week: (h, m, dow) => `${m} ${h} * * ${dow}`,
  custom: () => "",  // raw input mode
};

// Human-readable preview
function cronToHuman(expr: string): string {
  // Map common patterns to readable strings
  // "0 3 * * *" → "Every day at 3:00 AM"
  // "0 9 * * 1" → "Every Monday at 9:00 AM"
}
```

### WS Command Types for This Phase

```typescript
// New command types needed (extend AstridrWSContext.tsx comment)
sendCommand({ type: "task.create", task: NewTask })
sendCommand({ type: "task.move", task_id: string, column: TaskColumn })
sendCommand({ type: "cron.trigger", job_name: string })
sendCommand({ type: "cron.toggle", job_name: string, enabled: boolean })
sendCommand({ type: "config.get", section: string })   // already exists
sendCommand({ type: "config.update", section, changes, dry_run }) // already exists
```

The existing `config.get` and `config.update` WS commands are already implemented in ConfigEditor.tsx. New command types for tasks and cron need to be added to `TOPIC_EVENT_MAP` if Ástríðr sends back status events for them.

### Finding → Task Field Mapping (D-06 specifics)

```typescript
function findingToTaskDefaults(finding: IdeationFinding): Partial<NewTask> {
  const SEVERITY_TO_PRIORITY: Record<string, TaskPriority> = {
    critical: "high",
    high: "high",
    medium: "medium",
    low: "low",
  };
  return {
    title: finding.description,          // finding description becomes task title
    description: finding.suggestedFix,  // suggestedFix becomes task description
    priority: SEVERITY_TO_PRIORITY[finding.severity] ?? "medium",
    labels: [finding.category, finding.scanType].filter(Boolean),
    findingId: finding._id,
  };
}
```

### Anti-Patterns to Avoid

- **Don't shadow Convex `commandExecutions` with task overrides.** The existing Tasks.tsx local state override was a workaround. Phase 4 uses a real `tasks` table instead of piggybacking on commandExecutions.
- **Don't use `arrayMove` across columns.** `@dnd-kit/sortable`'s `arrayMove` only handles within-column reordering; cross-column moves require reassigning the `column` field, which the existing code already handles correctly.
- **Don't auto-collapse columns on initial render.** The collapse behavior should only trigger after mount when task count transitions from >0 to 0.
- **Don't skip the drag activation constraint.** The existing board doesn't set `activationConstraint`. Add `PointerSensor` with `{ distance: 8 }` to prevent accidental drags on click (required for rich card interaction targets).
- **Don't add `@codemirror/merge` if implementing custom line-diff.** Only install it if using the MergeView API. A simple custom renderer avoids the dependency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag and drop | Custom DnD event handlers | `@dnd-kit` (installed) | Accessibility, touch support, collision detection |
| Toast notifications | Custom toast system | `sonner` (installed) | Already integrated site-wide |
| YAML editor | `<textarea>` | `@uiw/react-codemirror` (installed) | Syntax highlighting, line numbers, fold/gutter |
| Slide-out panel | Custom drawer | shadcn `Sheet` | Radix portal, keyboard dismiss, focus trap |
| Toggle switch | Custom checkbox-based toggle | shadcn `Switch` | Radix accessible switch primitive |
| Cron validation | Hand-written regex | Standard cron regex `^(\*|[0-9]{1,2})(\/[0-9]+)?( (\*|[0-9]{1,2})(\/[0-9]+)?){4}$` | Covers all edge cases; cron-parser npm is overkill |

**Key insight:** This codebase already has the right libraries. The risk is over-engineering — adding new libraries when extending existing patterns is sufficient.

---

## Common Pitfalls

### Pitfall 1: Drag activation fires on card click targets
**What goes wrong:** Without `activationConstraint`, any mousedown on a card starts a drag, preventing click handlers on labels, badges, and the "Create Task" button from firing.
**Why it happens:** @dnd-kit defaults to immediate drag start on pointerdown.
**How to avoid:** Add `PointerSensor` with `activationConstraint: { distance: 8 }` to DndContext sensors array.
**Warning signs:** Clicking a badge or icon inside a card accidentally moves it.

### Pitfall 2: Convex schema migration breaks existing queries
**What goes wrong:** Adding optional fields to `ideationFindings` is safe. Adding required fields or indexes mid-flight can fail existing queries that don't provide the new field.
**Why it happens:** Convex schema validation is strict — all documents must match the schema.
**How to avoid:** Always use `v.optional()` for new fields on existing tables. The `status` field on `ideationFindings` must be optional with fallback logic in the query layer.
**Warning signs:** Convex `npx convex dev` shows schema validation errors.

### Pitfall 3: WS ack timeout during config apply
**What goes wrong:** The current `ACK_TIMEOUT_MS = 10000` (10s). Config hot-reload can take > 10s if Ástríðr is busy, causing the apply to appear failed even if it succeeded.
**Why it happens:** AstridrWSContext has a hard 10s timeout on all commands.
**How to avoid:** The status bar should show "pending" state optimistically. If WS ack times out, show error state but don't roll back the editor content — let the operator re-apply.
**Warning signs:** Config apply shows error but Ástríðr actually reloaded.

### Pitfall 4: Collapsible column width breaks DnD drop targets
**What goes wrong:** When a column collapses to 40px, its droppable area shrinks. @dnd-kit's `closestCenter` collision may fail to detect the collapsed column as a valid drop target.
**Why it happens:** The droppable element's bounding rect is 40px wide — collision detection misses cards dragged to a thin strip.
**How to avoid:** Auto-expand collapsed columns on dragover (in `handleDragOver`), using React state to temporarily expand. Revert if drag ends elsewhere.
**Warning signs:** Can't drop cards into empty collapsed columns.

### Pitfall 5: Bidirectional link creates stale data
**What goes wrong:** A finding's `taskId` points to a deleted task, or a task's `findingId` points to a dismissed finding — badges show stale linked state.
**Why it happens:** Convex references (`v.id("tasks")`) enforce referential integrity on write but don't cascade deletes.
**How to avoid:** Query the linked document independently and handle null case gracefully. Badge shows "no linked finding" if finding not found.
**Warning signs:** "From finding: undefined" in linked badge tooltip.

### Pitfall 6: shadcn Sheet + @dnd-kit portal collision
**What goes wrong:** shadcn `Sheet` renders in a Radix portal (appended to document body). If DndContext is mounted outside the sheet, drag events from inside the sheet may not reach DndContext handlers.
**Why it happens:** @dnd-kit uses pointer events; portaled content may have event propagation issues.
**How to avoid:** The Sheet is for cron create/edit, not for kanban cards. No DnD inside Sheet — this pitfall only applies if someone tries to put draggable items inside the Sheet.
**Warning signs:** n/a for this phase's actual design.

---

## Code Examples

Verified patterns from existing codebase:

### Existing WS command dispatch (reference pattern)
```typescript
// Source: src/hooks/useCommandDispatch.ts
const { dispatch, isConnected } = useCommandDispatch();
const result = await dispatch(
  { type: "cron.trigger", job_name: "daily_ideation_scan" },
  "Cron job triggered."
);
// result.status === "ok" | "error"
```

### Existing DnD sensor setup (current — missing activation constraint)
```typescript
// Source: src/components/KanbanBoard.tsx — current setup has no sensors prop
// CORRECT PATTERN for Phase 4:
import { useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
);
// Pass to <DndContext sensors={sensors}>
```

### Convex mutation pattern (reference)
```typescript
// Source: convex/ideation.ts (existing dismissFinding pattern)
export const updateFindingStatus = mutation({
  args: { id: v.id("ideationFindings"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status, ...(status === "acknowledged" ? { acknowledgedAt: Date.now() / 1000 } : {}) });
  },
});
```

### StatusBadge reuse for finding workflow
```typescript
// Source: src/components/StatusBadge.tsx
// Existing legacyMap can be extended:
const FINDING_STATUS_MAP = {
  open: { semantic: "idle", label: "OPEN" },
  acknowledged: { semantic: "warn", label: "ACK'D" },
  converted: { semantic: "ok", label: "CONVERTED" },
  dismissed: { semantic: "idle", label: "DISMISSED" },
};
// Pass status + label directly to <StatusBadge status="ok" label="CONVERTED" />
```

### Cron slide-out Sheet pattern
```typescript
// shadcn Sheet usage (D-14)
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={panelOpen} onOpenChange={setPanelOpen}>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>Create Cron Job</SheetTitle>
    </SheetHeader>
    {/* CronBuilderForm */}
  </SheetContent>
</Sheet>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | — | — |
| `@codemirror/merge` | Config diff view (D-09) | ✗ — not installed | 6.12.1 available | Custom line-diff renderer (pure JS) |
| shadcn `sheet` | Cron panel (D-14) | ✗ — not installed | latest | Custom drawer (more work) |
| shadcn `switch` | Cron toggle (D-13) | ✗ — not installed | latest | Plain HTML checkbox |
| shadcn `select` | Cron dropdowns (D-12) | ✗ — not installed | latest | Native `<select>` (breaks design system) |
| shadcn `checkbox` | Ideation multi-select (D-06) | ✗ — not installed | latest | Native `<input type="checkbox">` |
| Ástríðr v4.0 WS endpoint | task.move, cron.trigger, cron.toggle | ASSUMED | — | Mock/stub commands for UI completeness |

[VERIFIED: node_modules/@codemirror/ directory — merge not present; src/components/ui/ — sheet/switch/select/checkbox/input/label/textarea not present]

**Missing dependencies with no blocking fallback:**
- All are installable via npm/shadcn CLI — no machine-level blockers

**Missing dependencies with viable fallback:**
- `@codemirror/merge` — can use custom line-diff renderer
- Ástríðr WS commands for tasks/cron — commands fire and optimistic UI updates; ack may not return if Ástríðr doesn't handle these yet. Treat as fire-and-forget with toast error on timeout.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TM-01 | KanbanColumn collapses when empty | unit | `npm test -- --run src/components/__tests__/KanbanColumn.test.tsx` | ❌ Wave 0 |
| TM-01 | KanbanCard renders priority stripe, labels, time-in-column | unit | `npm test -- --run src/components/__tests__/KanbanCard.test.tsx` | ❌ Wave 0 |
| TM-01 | 6-column TaskColumn type covers all values | unit | `npm test -- --run src/types/kanban.test.ts` | ❌ Wave 0 |
| TM-02 | Finding row renders checkbox, severity badge, status badge | unit | `npm test -- --run src/components/__tests__/IdeationRow.test.tsx` | ❌ Wave 0 |
| TM-02 | findingToTaskDefaults maps severity to priority correctly | unit | `npm test -- --run src/lib/__tests__/findingToTask.test.ts` | ❌ Wave 0 |
| TM-03 | Diff renderer shows + lines green, - lines red, unchanged muted | unit | `npm test -- --run src/components/__tests__/DiffView.test.tsx` | ❌ Wave 0 |
| TM-03 | Hot-reload status bar transitions through states | unit | `npm test -- --run src/components/__tests__/HotReloadBar.test.tsx` | ❌ Wave 0 |
| TM-04 | cronToHuman returns correct string for known patterns | unit | `npm test -- --run src/lib/__tests__/cronToHuman.test.ts` | ❌ Wave 0 |
| TM-04 | Cron builder generates valid cron expression from dropdowns | unit | `npm test -- --run src/components/__tests__/CronBuilder.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (full suite, fast — all tests are unit)
- **Per wave merge:** `npm test -- --run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/KanbanColumn.test.tsx` — covers TM-01 column collapse
- [ ] `src/components/__tests__/KanbanCard.test.tsx` — covers TM-01 rich card rendering
- [ ] `src/components/__tests__/IdeationRow.test.tsx` — covers TM-02 finding row
- [ ] `src/components/__tests__/DiffView.test.tsx` — covers TM-03 diff renderer
- [ ] `src/components/__tests__/HotReloadBar.test.tsx` — covers TM-03 status bar
- [ ] `src/components/__tests__/CronBuilder.test.tsx` — covers TM-04 expression builder
- [ ] `src/lib/__tests__/findingToTask.test.ts` — covers TM-02 field mapping
- [ ] `src/lib/__tests__/cronToHuman.test.ts` — covers TM-04 human-readable output
- [ ] `src/types/kanban.test.ts` — covers TM-01 type expansion

Existing test pattern: `test.todo(...)` stubs keep suite green while implementation is pending. Follow the same pattern for Wave 0 stubs.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | WS auth handled by AstridrWSContext (api_key in URL) |
| V3 Session Management | No | No session changes in this phase |
| V4 Access Control | No | Single-operator dashboard — no multi-user access |
| V5 Input Validation | Yes | Task title/description, cron expression, config YAML |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed cron expression | Tampering | Validate against cron regex before sending WS command; disable Save button on invalid |
| XSS via finding description in task title | Tampering | React's JSX escaping handles this — never use `dangerouslySetInnerHTML` |
| YAML injection via config editor | Tampering | `js-yaml.load()` used (already in codebase) — not `js-yaml.safeLoad()` but load() is safe in js-yaml v4+ |
| WS command flooding (rapid drag operations) | DoS | AstridrWSContext queue cap (MAX_QUEUE_DEPTH = 50) already in place |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ástríðr v4.0 will handle `task.create`, `task.move`, `cron.trigger`, `cron.toggle` WS command types | WS Command Types | UI sends commands but gets no ack; optimistic UI still works, actions aren't actually dispatched to Ástríðr |
| A2 | `@codemirror/merge` v6.12.1 works with `@uiw/react-codemirror` v4.25.9 peer ecosystem | Standard Stack | May need version alignment; fallback is custom line-diff renderer |
| A3 | CronJobList's `CRON_SCHEDULES` static list is Ástríðr-side Convex cron jobs, not Ástríðr agent cron tasks | Architecture | If these are different systems, the play/toggle controls need to target a different WS endpoint |

---

## Open Questions (RESOLVED)

1. **Ástríðr Phase 49 WS API surface for tasks and cron**
   - What we know: AstridrWSContext sends commands with `{ type, ...params }` pattern; existing types are `config.get`, `config.update`, `agent.send_task`
   - What's unclear: Whether Ástríðr Phase 49 exposes `task.create`, `task.move`, `cron.trigger`, `cron.toggle` — or if CodePulse needs to define these and Ástríðr will implement them
   - Recommendation: Implement UI with WS command dispatch; treat missing acks as graceful degradation (optimistic UI still works). Document expected command shapes as a contract for Ástríðr Phase 49 implementation.
   - **RESOLVED:** Fire-and-forget with graceful degradation per A1. Optimistic Convex updates proceed regardless of WS ack. Command shapes documented as contract for Ástríðr.

2. **CronJobList static vs. dynamic**
   - What we know: `CronJobList.tsx` reads from `CRON_SCHEDULES` — a static array from `src/lib/cronSchedules.ts`
   - What's unclear: Are Ástríðr cron jobs discoverable via WS (`cron.list` command)? Or is the list always hardcoded?
   - Recommendation: Add a `cron.list` WS command to fetch live cron jobs. If Ástríðr doesn't support it yet, fall back to `CRON_SCHEDULES` static list. The slide-out panel creates new dynamic jobs that need WS persistence.
   - **RESOLVED:** Fall back to CRON_SCHEDULES static list per A3. Document `cron.list` as future contract for Ástríðr. Dynamic jobs created via slide-out panel persist to Convex and fire WS commands optimistically.

---

## Sources

### Primary (HIGH confidence)
- `src/components/KanbanBoard.tsx` — Verified @dnd-kit setup, existing 3-column pattern
- `src/types/kanban.ts` — Verified current type definitions
- `src/pages/Tasks.tsx` — Verified existing data flow (Convex + local state overlay)
- `src/pages/ConfigEditor.tsx` — Verified CodeMirror + WS integration pattern
- `src/pages/Ideation.tsx` — Verified current findings display (legacy styles to replace)
- `convex/ideation.ts` — Verified existing mutations: recordFinding, dismissFinding, listFindings
- `convex/schema.ts` — Verified ideationFindings table schema (fields to add)
- `package.json` — Verified all installed dependencies and versions
- `node_modules/@codemirror/` — Verified @codemirror/merge is NOT installed; listed installed codemirror packages
- `src/components/ui/` — Verified which shadcn components are installed
- `src/contexts/AstridrWSContext.tsx` — Verified sendCommand API, ACK_TIMEOUT_MS, MAX_QUEUE_DEPTH
- `src/hooks/useCommandDispatch.ts` — Verified dispatch pattern with toast integration
- `src/components/StatusBadge.tsx` — Verified existing semantic status system
- `vitest.config.ts` — Verified test framework configuration
- `.planning/phases/04-task-management/04-UI-SPEC.md` — Verified full visual/interaction contract
- `.planning/phases/04-task-management/04-CONTEXT.md` — Verified all locked decisions

### Secondary (MEDIUM confidence)
- npm registry — `@codemirror/merge` latest version 6.12.1 [VERIFIED: npm view]
- shadcn/ui docs — Sheet, Switch, Select component patterns [ASSUMED from training; install commands are standard]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and node_modules
- Architecture: HIGH — based on direct codebase analysis; D-05 recommendation grounded in existing Tasks.tsx pattern
- Pitfalls: HIGH — derived from actual code (missing activation constraint, Convex schema rules)
- Test infrastructure: HIGH — verified vitest.config.ts and existing test patterns

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable libraries; Ástríðr WS API surface may change)
