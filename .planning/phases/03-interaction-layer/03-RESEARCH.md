# Phase 3: Interaction Layer - Research

**Researched:** 2026-04-13
**Domain:** React command palette (cmdk), Generative UI block rendering, React Flow DAG visualization, LLM-over-Convex, keyboard-driven inbox UX
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Command Palette**
- D-01: Cmd+K opens a command palette (cmdk library) with search across ALL entity types: agents, sessions/executions, alerts & inbox items, cron jobs & automation
- D-02: Palette includes both search AND quick actions — search entities to navigate, plus actions like "Send task to agent", "Mute all alerts", "Navigate to page" (VS Code-style)
- D-03: Search results grouped by entity type with section headers (Agents, Sessions, Alerts, Cron Jobs) — not a flat ranked list or tabs

**Generative UI Blocks**
- D-04: Agent Chat evolves from plain markdown ChatBubble to a block renderer supporting 5 block types: metric (renders MetricCard), table (sortable data table), chart (FlexBarChart), code/diff (syntax-highlighted), approval (inline action card with approve/reject)
- D-05: Approval requests from Ástríðr render as inline action cards in the chat flow with approve/reject buttons — matches existing InboxCard pattern, no modal or redirect
- D-06: Unknown/unrecognized block types fall back to rendering raw content as markdown — graceful degradation, always shows something

**Live Run Hierarchy**
- D-07: RunTimeline restructured from flat block stream to nested accordion: Run > Rounds (collapsible sections) > Tool Calls (nested inside rounds). Completed rounds auto-collapse, active round stays expanded
- D-08: Flow tab uses React Flow (already a project dependency) to render a visual flowchart — nodes are tool calls, edges show data flow. Directed graph layout
- D-09: Stop button remains on the Live Run widget to cancel active runs

**Insights Chat**
- D-10: Insights Chat is a separate dedicated page in the sidebar under INSIGHTS section — distinct from Agent Chat which sends tasks to Ástríðr
- D-11: Backend uses LLM with structured Convex tool calls (cost_summary, error_counts, session_list, etc.) — not raw query generation. Structured, auditable, no raw DB access
- D-12: Insights Chat responses use the same Generative UI Block renderer as Agent Chat — "What's the error rate?" returns a MetricCard block. Shared renderer, consistent UX

**Inbox Enhancements**
- D-13: Inbox page (already exists from Phase 56) gets keyboard navigation added — arrow keys for item focus, Enter to expand, keyboard shortcuts for approve/reject

### Claude's Discretion
- cmdk library choice and configuration details
- Command palette result ranking algorithm and search index approach
- Generative UI Block wire protocol (JSON schema for block messages from Ástríðr)
- Block renderer component architecture (single dispatcher vs registry pattern)
- Insights Chat LLM provider and model selection
- Convex tool set for Insights Chat (which queries to expose as tools)
- Keyboard shortcut specifics for Inbox navigation
- React Flow layout algorithm for Flow tab
- Round auto-collapse threshold and animation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IL-01 | Cmd+K opens command palette with search across agents, sessions, alerts, cron jobs | cmdk/shadcn Command component pattern; CommandDialog with global keydown listener |
| IL-02 | Unified Inbox shows alerts, failed runs, and approval requests with keyboard navigation | useRef focus management, arrow key handlers, existing InboxCard/InboxFilterBar reuse |
| IL-03 | Agent Chat panel sends tasks to Ástríðr and shows live run transcripts with Generative UI Blocks | ChatBubble extension with block dispatcher; 5 block types mapped to existing components |
| IL-04 | HITL approval requests appear as action cards with approve/reject buttons | InboxCard reused as approval block type; same sendCommand("approval.respond") flow |
| IL-05 | Live Run Widget shows streaming tool calls, reasoning, and text output with stop button | RunTimeline restructure to nested accordion; new "round" grouping layer; stop via sendCommand |
| IL-06 | Insights Chat answers operational questions by querying Convex data | Convex actions wrapping existing queries as LLM tools; same block renderer reused |

</phase_requirements>

---

## Summary

Phase 3 transforms CodePulse from a passive dashboard into an active command center. Six major UI surfaces are involved: Command Palette, Inbox keyboard nav, Agent Chat with Generative UI Blocks, Live Run nested accordion + Flow tab, HITL Approval Gates, and Insights Chat. All six build on existing Phase 1/2 infrastructure — no new framework dependencies except cmdk.

The core challenge is the Generative UI Block system: a shared wire protocol (JSON message schema) and a shared block renderer that both Agent Chat and Insights Chat use. The block renderer is a dispatcher component that switches on `block.type` and renders the appropriate existing component (MetricCard, FlexBarChart, InboxCard for approvals, SyntaxHighlighter for code). The same `ChatBubble` component is extended to handle `content` as either a string (markdown, existing path) or an array of typed blocks (new path).

The Insights Chat backend requires a Convex `action` that calls an LLM with a structured tool set exposing safe, pre-scoped queries. The LLM cannot run arbitrary Convex queries — only the tools you expose. This is the auditable, no-raw-DB-access pattern locked in D-11.

**Primary recommendation:** Implement in this order: (1) Block renderer + wire protocol (shared foundation), (2) cmdk Command Palette (global, no page dependency), (3) ChatBubble block upgrade, (4) Inbox keyboard nav (smallest diff), (5) RunTimeline accordion + stop button, (6) Insights Chat page + Convex action.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | 1.1.1 | Headless command palette primitive | Used by shadcn/ui Command component; fast filtered list; accessible by default |
| @xyflow/react | 12.10.1 | React Flow graph rendering | Already installed; locked decision D-08 |
| shadcn/ui Command | N/A (CLI install) | Styled Command wrapper over cmdk | Matches existing shadcn/ui New York style system |
| react-syntax-highlighter | 16.1.1 | Code block rendering | Already installed (used in ChatBubble) |

[VERIFIED: npm registry — cmdk 1.1.1, @xyflow/react 12.10.1 confirmed installed/published]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dagre | 0.8.5 | DAG layout for React Flow | Flow tab node positioning; NOT installed yet — needs `npm install dagre @types/dagre` |
| sonner | 2.0.7 | Toast feedback | Already installed; use for approve/reject confirmations (already used in Inbox.tsx) |
| lucide-react | 1.8.0 | Icons | Already installed; use for Stop (Square), Expand/Collapse (ChevronDown/Right) |

[VERIFIED: npm registry — dagre 0.8.5 latest; not in node_modules — must install]
[VERIFIED: codebase — sonner, lucide-react present in package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk via shadcn add | cmdk direct | shadcn wraps it with project tokens already applied — saves style wiring |
| dagre | elkjs | elkjs is more powerful but heavier; dagre sufficient for simple tool-call DAGs |
| Registry pattern for blocks | Switch dispatcher | Registry is more extensible; switch is simpler and adequate for 5 known types |

### Installation

```bash
# shadcn Command component (installs cmdk as transitive dep)
npx shadcn@latest add command

# dagre for React Flow layout
npm install dagre @types/dagre
```

[ASSUMED: `npx shadcn@latest add command` — assumed to work with project's shadcn v4.2.0 configuration]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── CommandPalette.tsx        # NEW — global Cmd+K palette
│   ├── BlockRenderer.tsx         # NEW — shared Generative UI block dispatcher
│   ├── blocks/
│   │   ├── MetricBlock.tsx       # Wraps MetricCard
│   │   ├── TableBlock.tsx        # Sortable data table
│   │   ├── ChartBlock.tsx        # Wraps FlexBarChart
│   │   ├── CodeBlock.tsx         # Wraps SyntaxHighlighter
│   │   └── ApprovalBlock.tsx     # Wraps/mirrors InboxCard
│   ├── ChatBubble.tsx            # MODIFIED — detects block array vs string
│   ├── RunTimeline.tsx           # MODIFIED — nested accordion (Round > ToolCall)
│   └── ui/
│       └── command.tsx           # NEW — shadcn Command install
├── pages/
│   ├── Chat.tsx                  # MODIFIED — subscribe to run.block events
│   ├── LiveRun.tsx               # MODIFIED — round grouping, stop button, Flow tab
│   ├── Inbox.tsx                 # MODIFIED — keyboard nav
│   └── InsightsChat.tsx          # NEW — LLM Q&A page
├── hooks/
│   └── useCommandPaletteSearch.ts  # NEW — Convex queries for palette data
convex/
└── insightsChat.ts               # NEW — Convex action calling LLM with tool set
```

### Pattern 1: shadcn CommandDialog (Cmd+K Global Palette)

**What:** A `CommandDialog` rendered at `DashboardLayout` level, triggered by global keydown. Stays mounted but hidden; opening is instant.

**When to use:** Global keyboard shortcut that must work from any page.

```typescript
// Source: https://ui.shadcn.com/docs/components/command [CITED]
// Place in DashboardLayout.tsx (alongside existing keyboard shortcut useEffect)

import { CommandDialog, CommandInput, CommandList, CommandEmpty,
         CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command"

const [open, setOpen] = useState(false)

useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen((o) => !o)
    }
  }
  document.addEventListener("keydown", down)
  return () => document.removeEventListener("keydown", down)
}, [])

return (
  <CommandDialog open={open} onOpenChange={setOpen}>
    <CommandInput placeholder="Search agents, sessions, alerts..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Agents">
        {agents.map(agent => (
          <CommandItem key={agent.id} onSelect={() => { navigate(`/agents`); setOpen(false) }}>
            {agent.name}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Quick Actions">
        <CommandItem onSelect={() => { navigate("/chat"); setOpen(false) }}>
          Send task to agent
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
)
```

[CITED: https://ui.shadcn.com/docs/components/command]

### Pattern 2: Generative UI Block Wire Protocol

**What:** Ástríðr sends `run.block` events over WebSocket. Each event carries a single typed block. ChatBubble accumulates blocks per session, detects `blocks[]` vs plain `string` content, and dispatches to `BlockRenderer`.

**Wire format (JSON schema — Claude's Discretion):**

```typescript
// Proposed wire protocol — awaits Ástríðr v4.0 Phase 48 implementation
type GenerativeBlock =
  | { type: "metric"; label: string; value: string | number; trend?: "up" | "down" | "neutral" }
  | { type: "table"; columns: string[]; rows: (string | number)[][] }
  | { type: "chart"; data: { label: string; value: number }[]; title?: string }
  | { type: "code"; language: string; content: string }
  | { type: "diff"; before: string; after: string; language?: string }
  | { type: "approval"; requestId: string; action: string; details: Record<string, unknown>; riskLevel: "high" | "medium" | "low"; agentName?: string }
  | { type: "markdown"; content: string }  // explicit markdown type
  | { type: string; [key: string]: unknown }  // fallback — renders as raw JSON wrapped in markdown

// WS event type — subscribe via subscribeEvent("run.block", ...)
interface RunBlockEvent {
  event_type: "run.block"
  session_id: string
  block: GenerativeBlock
}
```

[ASSUMED: Wire protocol is a design proposal. Must be confirmed with Ástríðr v4.0 Phase 48 implementation before coding the Chat subscriber.]

### Pattern 3: Block Renderer (Switch Dispatcher)

**What:** Single dispatcher component. Switch on `block.type`. Falls back to markdown for unknown types (D-06).

```typescript
// Source: codebase analysis + project patterns [VERIFIED: codebase]
import { BlockRenderer } from "./BlockRenderer"

// In ChatBubble — extend props to accept either string or block array:
type ChatMessage = {
  role: "user" | "assistant"
  // content is string for markdown; blocks is array for Generative UI
  content?: string
  blocks?: GenerativeBlock[]
  streaming: boolean
  timestamp: number
}

// BlockRenderer.tsx dispatcher:
export function BlockRenderer({ block }: { block: GenerativeBlock }) {
  switch (block.type) {
    case "metric":    return <MetricBlock block={block} />
    case "table":     return <TableBlock block={block} />
    case "chart":     return <ChartBlock block={block} />
    case "code":      return <CodeBlock block={block} />
    case "diff":      return <CodeBlock block={block} diff />
    case "approval":  return <ApprovalBlock block={block} />
    default:
      // D-06: graceful degradation — render raw as markdown
      return <MarkdownFallback content={`\`\`\`json\n${JSON.stringify(block, null, 2)}\n\`\`\``} />
  }
}
```

[VERIFIED: codebase — RunBlock.tsx uses same switch-on-type pattern; ChatBubble.tsx uses SyntaxHighlighter already]

### Pattern 4: RunTimeline Nested Accordion (Round > Tool Calls)

**What:** A "round" groups one reasoning step with its tool calls. Each round is a collapsible accordion section. Completed rounds auto-collapse; active round stays open.

```typescript
// Source: codebase analysis of RunTimeline.tsx + RunBlock.tsx [VERIFIED: codebase]
// Key grouping logic — blocks arrive flat, must be grouped into rounds

type Round = {
  id: string
  index: number
  blocks: Block[]
  done: boolean
}

// Grouping heuristic: a new "round" starts on each "run.thinking" block
// or when block.type === "reasoning" | "thinking" arrives.
// Tool calls (tool_use, tool_result) nest inside the current round.
// Text blocks at end of round are the assistant's reply for that round.

// Accordion: completed round collapses automatically
// Active round: stays expanded, shows streaming pulse dot
```

[ASSUMED: Round boundary signal is a "run.thinking" or "reasoning" block type. Must verify what Ástríðr v4.0 Phase 48 emits as round delimiter.]

### Pattern 5: React Flow DAG Layout (Flow Tab)

**What:** Tool calls become nodes. Data flow edges connect tool_use to tool_result by `tool_call_id`. Dagre provides left-to-right hierarchical auto-layout.

```typescript
// Source: https://reactflow.dev/examples/layout/dagre [CITED]
import dagre from "dagre"
import { useNodesState, useEdgesState, ReactFlow } from "@xyflow/react"

function buildFlowGraph(blocks: Block[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 })

  const nodes: Node[] = []
  const edges: Edge[] = []
  const toolCallIds = new Map<string, string>() // tool_call_id -> node id

  blocks.forEach((block, i) => {
    if (block.type === "tool_use") {
      const id = `tool_use_${i}`
      toolCallIds.set(block.tool_call_id as string, id)
      g.setNode(id, { width: 160, height: 40 })
      nodes.push({ id, type: "default", data: { label: block.name }, position: { x: 0, y: 0 } })
    }
    if (block.type === "tool_result") {
      const sourceId = toolCallIds.get(block.tool_call_id as string)
      const id = `tool_result_${i}`
      g.setNode(id, { width: 160, height: 40 })
      if (sourceId) {
        g.setEdge(sourceId, id)
        edges.push({ id: `e_${sourceId}_${id}`, source: sourceId, target: id })
      }
      nodes.push({ id, type: "default", data: { label: "Result" }, position: { x: 0, y: 0 } })
    }
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map(n => ({
    ...n,
    position: { x: g.node(n.id).x, y: g.node(n.id).y },
  }))

  return { nodes: layoutedNodes, edges }
}
```

[CITED: https://reactflow.dev/examples/layout/dagre]

### Pattern 6: Insights Chat — Convex Action with LLM Tools

**What:** A Convex `action` receives the user question, calls an LLM (e.g., Claude via LiteLLM) with a fixed set of tool definitions. LLM calls tools, Convex runs the corresponding queries, responses are assembled into blocks.

```typescript
// convex/insightsChat.ts — Convex action
import { action } from "./_generated/server"
import { v } from "convex/values"

export const ask = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<GenerativeBlock[]> => {
    // 1. Call LLM with tools: cost_summary, error_counts, session_list, alert_counts, agent_status
    // 2. When LLM calls a tool, run the corresponding ctx.runQuery(...)
    // 3. Assemble tool results, return to LLM for final response
    // 4. Parse LLM response into GenerativeBlock[]
    // Returns blocks array — same shape as Chat GenerativeBlock[]
  }
})
```

[ASSUMED: LLM provider for Insights Chat is not specified — likely same LiteLLM setup used by Ástríðr. Confirm before implementation.]

### Pattern 7: Inbox Keyboard Navigation

**What:** `useRef` array to track InboxCard DOM nodes. `useEffect` on keydown to move `focusedIndex`. `Enter` expands focused card. `A` approves, `R` rejects.

```typescript
// Source: codebase analysis — Inbox.tsx, InboxCard.tsx [VERIFIED: codebase]
// Key insight: InboxCard currently handles its own approve/reject via local state.
// Keyboard nav needs to focus a card and trigger actions externally.
// Options: (1) forward refs + imperative handle on InboxCard, OR
//          (2) lift approve/reject state up to Inbox and pass focused index
// Recommendation: option (2) — lift state, keep InboxCard as controlled component

const cardRefs = useRef<HTMLDivElement[]>([])
const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (document.activeElement?.tagName === "TEXTAREA") return
    if (e.key === "ArrowDown") { /* increment focusedIndex */ }
    if (e.key === "ArrowUp")   { /* decrement focusedIndex */ }
    if (e.key === "Enter")     { /* expand focused card */ }
    if (e.key === "a" && focusedCard?.type === "approval") { /* approve */ }
    if (e.key === "r" && focusedCard?.type === "approval") { /* reject */ }
  }
  document.addEventListener("keydown", handler)
  return () => document.removeEventListener("keydown", handler)
}, [focusedIndex, filteredItems])
```

[VERIFIED: codebase — DashboardLayout.tsx uses same keydown pattern; InboxCard.tsx currently stateful]

### Anti-Patterns to Avoid

- **Mounting CommandPalette inside a page component:** It must live in DashboardLayout so Cmd+K works globally regardless of current page.
- **Streaming block content into the existing `content: string` field on ChatMessage:** Blocks and markdown are different shapes. Keep them separate (`content?: string`, `blocks?: GenerativeBlock[]`). Mixing them causes type confusion.
- **Calling Convex queries directly from Insights Chat LLM:** All data access must go through explicit tool definitions (D-11). Never pass raw query strings to the LLM.
- **Using `dagre.layout()` in render:** Call it once when blocks change, memoize results. Dagre is synchronous and CPU-heavy on large graphs.
- **Auto-collapsing all rounds on `run.completed`:** Only completed rounds should collapse; the last round stays visible. Track `done` per round, not globally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filtered search list with keyboard nav | Custom filtered list | cmdk / shadcn Command | cmdk handles filtering, ARIA, keyboard nav, empty states |
| Command palette modal | Custom dialog with backdrop | CommandDialog (shadcn) | Already handles Radix Dialog integration, focus trap, Escape close |
| Flow graph layout | Custom x/y positioning | dagre + @xyflow/react | Auto-layout is a solved problem; manual positioning is unmaintainable |
| Syntax-highlighted diff | Custom diff renderer | react-syntax-highlighter (already installed) | Already in ChatBubble; reuse CodeBlock pattern |
| Approval block in chat | New component from scratch | InboxCard pattern (reuse) | InboxCard already has risk stripe, approve/reject, WS integration |

**Key insight:** Every Generative UI block type maps to an existing Phase 1/2 component. The block renderer is a thin dispatcher — the heavy lifting is already built.

---

## Common Pitfalls

### Pitfall 1: cmdk Not Installed

**What goes wrong:** `CommandDialog` import fails; shadcn/ui's `command.tsx` component is not present in `src/components/ui/`.
**Why it happens:** cmdk is not listed in `package.json` and `src/components/ui/command.tsx` does not exist in the current codebase.
**How to avoid:** Run `npx shadcn@latest add command` as Wave 0 step before any other Command work. This installs cmdk as a dep and adds `command.tsx`.
**Warning signs:** `Cannot find module 'cmdk'` or `Module @/components/ui/command not found`.

[VERIFIED: codebase — `ls node_modules/cmdk` returned "No such file or directory"; `ls src/components/ui/` does not contain command.tsx]

### Pitfall 2: Palette Data Goes Stale

**What goes wrong:** Command palette shows agents/sessions/alerts from initial mount; never reflects deletions or new items during session.
**Why it happens:** `useQuery` results only update if the component is mounted and subscribed. If palette data is loaded once on open, it's snapshot data.
**How to avoid:** Load palette data via `useQuery` hooks that are always live (mounted at DashboardLayout level, not inside CommandDialog). Pass results as props to CommandDialog.
**Warning signs:** Palette shows deleted agents; stale session counts.

### Pitfall 3: Block Wire Protocol Mismatch

**What goes wrong:** Chat subscribes to `run.block` events but Ástríðr v4.0 Phase 48 emits a different event type or schema.
**Why it happens:** The wire protocol is a design proposal (ASSUMED) — not yet confirmed against Ástríðr implementation.
**How to avoid:** Before implementing ChatBubble block upgrade, confirm with Ástríðr Phase 48 what event types and block shapes are emitted. Use the existing `run.text` / `run.blocks` events as a fallback if Phase 48 isn't ready.
**Warning signs:** No blocks rendered in chat despite Ástríðr responding; console shows unhandled WS events.

[ASSUMED: run.block is the event type — must confirm against Ástríðr v4.0 Phase 48]

### Pitfall 4: Inbox Keyboard Nav Conflicts with Chat Input

**What goes wrong:** Arrow keys move inbox focus while user is typing in ChatInput or textarea.
**Why it happens:** Global keydown listeners don't check focused element context.
**How to avoid:** Guard all keyboard nav handlers: `if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return`. DashboardLayout already does this — follow the same pattern.
**Warning signs:** Pressing arrow keys while typing sends focus to inbox cards.

[VERIFIED: codebase — DashboardLayout.tsx line 226: same guard pattern already used]

### Pitfall 5: dagre Not Installed

**What goes wrong:** `import dagre from "dagre"` fails at Flow tab render time.
**Why it happens:** dagre is not in `package.json` and not in `node_modules`.
**How to avoid:** Add `npm install dagre @types/dagre` to Wave 0 setup steps.
**Warning signs:** `Cannot find module 'dagre'` at runtime.

[VERIFIED: codebase — `ls node_modules/dagre` returned "No such file or directory"]

### Pitfall 6: Insights Chat Convex Action Context Limits

**What goes wrong:** Insights Chat Convex action tries to call `useQuery` inside the action handler, or import frontend hooks.
**Why it happens:** Convex actions run server-side; they use `ctx.runQuery(api.x.y, args)` not React hooks.
**How to avoid:** Insights Chat backend must use `ctx.runQuery(api.metrics.dashboardSummary)` etc. — not React hooks. Frontend calls the action via `useAction(api.insightsChat.ask)`.
**Warning signs:** `useQuery is not a function` in Convex action logs.

[VERIFIED: codebase — existing convex/metrics.ts, convex/agents.ts use standard query/mutation/action pattern]

---

## Code Examples

### Command Palette Global Integration

```typescript
// Source: DashboardLayout.tsx — add alongside existing keyboard shortcut useEffect [VERIFIED: codebase]
// DashboardLayout already has: useEffect with 'm', 'p', 'Escape' handlers
// ADD: Cmd+K listener in the same or a new useEffect

// In DashboardLayout.tsx, add to existing keyboard handler OR new useEffect:
if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
  e.preventDefault()
  setPaletteOpen((o) => !o)
}

// Add <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} /> before </TooltipProvider>
```

### BlockRenderer Dispatcher

```typescript
// Source: RunBlock.tsx switch pattern [VERIFIED: codebase — RunBlock.tsx uses exact same switch-on-type]
// MetricCard, FlexBarChart already exported from their files
// InboxCard already handles approve/reject with WS integration

export function BlockRenderer({ block, onApprove, onReject }: BlockRendererProps) {
  switch (block.type) {
    case "metric":
      return <MetricCard label={block.label} value={block.value} trend={block.trend} />
    case "chart":
      return <FlexBarChart data={block.data} />
    case "table":
      return <TableBlock columns={block.columns} rows={block.rows} />
    case "code":
    case "diff":
      return <CodeBlock language={block.language} content={block.content} />
    case "approval":
      return (
        <InboxCard
          item={approvalBlockToInboxItem(block)}
          onApprove={onApprove}
          onReject={onReject}
        />
      )
    default:
      // D-06: graceful fallback
      return <ReactMarkdown>{`\`\`\`json\n${JSON.stringify(block, null, 2)}\n\`\`\``}</ReactMarkdown>
  }
}
```

### Extending ChatMessage Type

```typescript
// Source: Chat.tsx type extension [VERIFIED: codebase — Chat.tsx ChatMessage type]
// Current: { id, role, content: string, streaming, timestamp, sessionId }
// Extended:

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content?: string        // markdown text (existing path)
  blocks?: GenerativeBlock[]  // block array (new path — mutually exclusive with content)
  streaming: boolean
  timestamp: number
  sessionId?: string
}

// ChatBubble updated to:
// if (blocks?.length) → render <BlockRenderer> for each block
// else → existing ReactMarkdown path
```

### Insights Chat — Convex Action Pattern

```typescript
// convex/insightsChat.ts
// Source: Convex action pattern from existing convex/*.ts files [VERIFIED: codebase]
import { action } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

export const ask = action({
  args: { question: v.string(), history: v.optional(v.array(v.any())) },
  handler: async (ctx, { question, history }) => {
    // 1. Define tools (cost_summary, error_counts, session_list, alert_counts, agent_status)
    // 2. Call LLM with tools + question
    // 3. For each tool_call in LLM response, dispatch to ctx.runQuery(api.X.Y)
    // 4. Return assembled GenerativeBlock[]
    const summary = await ctx.runQuery(api.metrics.dashboardSummary)
    // ... assemble into blocks
    return blocks
  }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom dialog + filtered list | cmdk / shadcn Command | 2022-2024 | Standard; every major app uses this pattern |
| Flat block stream in RunTimeline | Nested accordion (Round > Tool Calls) | This phase | More readable for long runs |
| Plain markdown chat bubbles | Generative UI blocks rendered natively | This phase | Chat feels like a dashboard |
| Raw DB queries from LLM | Structured tool definitions exposed to LLM | 2023+ pattern | Auditable, safe, no prompt injection on DB |

**Deprecated/outdated:**
- `RunTimeline` flat mode: will be replaced by nested accordion (D-07). The flat RunBlock rendering is preserved as the leaf renderer inside rounds.
- `ChatMessage.content: string` for all messages: will support `blocks?: GenerativeBlock[]` alongside existing string path. Both must work during transition.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `run.block` is the WS event type emitted by Ástríðr Phase 48 for Generative UI blocks | Generative UI wire protocol, Pitfall 3 | Chat won't render blocks; must update subscribeEvent call and potentially restructure ChatMessage shape |
| A2 | Round boundary is signaled by a `run.thinking` or `reasoning` block type | RunTimeline accordion pattern | Round grouping logic breaks; accordion may have empty rounds or wrong groupings |
| A3 | LLM provider for Insights Chat is same LiteLLM used by Ástríðr | Insights Chat pattern | May need different API key/model config in Convex environment variables |
| A4 | `npx shadcn@latest add command` installs correctly into this project's shadcn v4.2.0 config | Standard Stack, Pitfall 1 | Wave 0 setup step may need manual command.tsx creation if CLI fails |

---

## Open Questions

1. **Ástríðr Phase 48 wire protocol for Generative UI blocks**
   - What we know: D-04 specifies 5 block types; existing `run.blocks` events carry RunBlock arrays
   - What's unclear: Does Phase 48 add a new `run.block` event type? Or does it extend existing `run.blocks`? What is the exact JSON schema per block type?
   - Recommendation: Treat this as a hard dependency. Do not finalize ChatBubble block upgrade until Phase 48 wire format is documented. Plan Wave N+1 as "integrate with Phase 48" if needed.

2. **Round boundary signal in streaming events**
   - What we know: Current `run.blocks` events carry flat block arrays; RunTimeline renders them sequentially
   - What's unclear: What block type (or event type) signals the start of a new "round" in the nested accordion?
   - Recommendation: Define the round grouping heuristic in the PLAN and note it as an integration assumption. Fallback: group by `run.thinking` + all subsequent tool_use/tool_result/text until next `run.thinking`.

3. **Insights Chat LLM provider and environment variables**
   - What we know: Convex actions can call external APIs; the project uses LiteLLM in Ástríðr
   - What's unclear: What LLM API key is available in Convex environment? Is there an existing `CONVEX_OPENAI_KEY` or similar?
   - Recommendation: Wave 0 or early wave should verify Convex env var availability before LLM call is implemented.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @xyflow/react | Flow tab (D-08) | ✓ | 12.10.1 | — |
| react-syntax-highlighter | Code/diff blocks | ✓ | 16.1.1 | — |
| sonner | Approve/reject toasts | ✓ | 2.0.7 | — |
| shadcn Command (cmdk) | Command Palette (IL-01) | ✗ | — | Run `npx shadcn@latest add command` in Wave 0 |
| dagre | Flow tab auto-layout | ✗ | — | Run `npm install dagre @types/dagre` in Wave 0; or manual node positioning |
| Convex LLM env vars | Insights Chat | unknown | — | Must verify in Convex dashboard before Wave N |

**Missing dependencies with no fallback:**
- None that are truly blocking — dagre has a manual-layout fallback; cmdk is installable in Wave 0.

**Missing dependencies with fallback:**
- `shadcn Command (cmdk)`: Install via `npx shadcn@latest add command` — Wave 0 task.
- `dagre`: Install via `npm install dagre @types/dagre` — Wave 0 task. Fallback is `@xyflow/react`'s built-in auto-layout or manual positioning.
- Convex LLM API key: Must be confirmed in Convex dashboard. If unavailable, Insights Chat can be deferred to last wave.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | none detected — uses vite.config defaults |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IL-01 | Cmd+K opens CommandPalette; results grouped by entity type | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` | ❌ Wave 0 |
| IL-02 | Inbox arrow-key navigation moves focus; Enter expands; A/R approve/reject | unit | `npx vitest run src/pages/__tests__/Inbox.test.tsx` | ❌ Wave 0 |
| IL-03 | BlockRenderer renders correct component per block type; markdown fallback for unknown | unit | `npx vitest run src/components/__tests__/BlockRenderer.test.tsx` | ❌ Wave 0 |
| IL-04 | Approval block renders approve/reject; sends sendCommand with correct payload | unit | `npx vitest run src/components/__tests__/ApprovalBlock.test.tsx` | ❌ Wave 0 |
| IL-05 | RunTimeline groups blocks into rounds; completed rounds collapsed; stop button present | unit | `npx vitest run src/components/__tests__/RunTimeline.test.tsx` | ❌ Wave 0 |
| IL-06 | InsightsChat ask() Convex action returns GenerativeBlock array | unit (Convex action) | `npx vitest run convex/__tests__/insightsChat.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/CommandPalette.test.tsx` — covers IL-01
- [ ] `src/pages/__tests__/Inbox.test.tsx` — covers IL-02 (keyboard nav extension)
- [ ] `src/components/__tests__/BlockRenderer.test.tsx` — covers IL-03, IL-04
- [ ] `src/components/__tests__/RunTimeline.test.tsx` — covers IL-05
- [ ] `convex/__tests__/insightsChat.test.ts` — covers IL-06
- [ ] shadcn Command install: `npx shadcn@latest add command`
- [ ] dagre install: `npm install dagre @types/dagre`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — palette reads already-authed Convex data |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Insights Chat Convex action must only expose pre-scoped queries — no raw DB access (D-11) |
| V5 Input Validation | yes | Insights Chat question input: sanitize before LLM prompt; block renderer: only render known block types |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via Insights Chat question field | Tampering | Never interpolate raw user input directly into system prompt; use structured tool-call interface (D-11) |
| Unconstrained LLM generating arbitrary Convex queries | Information Disclosure | Only expose named tool functions — no `eval()`, no dynamic query building |
| Block renderer rendering malicious HTML from LLM | XSS | Use ReactMarkdown (JSX sanitized) for markdown fallback; never use `dangerouslySetInnerHTML` in block renderers |
| Approval block in chat submitting incorrect `requestId` | Tampering | `requestId` comes from the WS event — validate against known pending approvals list before sending |

---

## Sources

### Primary (HIGH confidence)

- Codebase verification — ChatBubble.tsx, InboxCard.tsx, RunTimeline.tsx, RunBlock.tsx, DashboardLayout.tsx, Chat.tsx, Inbox.tsx, LiveRun.tsx, AstridrWSContext.tsx, package.json, node_modules inspection
- npm registry — cmdk 1.1.1, @xyflow/react 12.10.1, dagre 0.8.5 versions confirmed
- [https://ui.shadcn.com/docs/components/command](https://ui.shadcn.com/docs/components/command) — CommandDialog pattern, Cmd+K implementation

### Secondary (MEDIUM confidence)

- [https://reactflow.dev/examples/layout/dagre](https://reactflow.dev/examples/layout/dagre) — dagre layout pattern for @xyflow/react
- [https://reactflow.dev/api-reference/react-flow](https://reactflow.dev/api-reference/react-flow) — ReactFlow props and layout overview

### Tertiary (LOW confidence)

- WebSearch: Generative UI block renderer patterns (2025) — general pattern confirmed, specific Ástríðr wire protocol is ASSUMED

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json and node_modules
- Architecture: HIGH for block renderer, command palette, keyboard nav (all build on verified existing patterns); MEDIUM for Insights Chat (LLM provider unconfirmed)
- Pitfalls: HIGH — cmdk/dagre absence verified; keyboard conflict pattern verified in codebase

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days — stable libraries; Ástríðr Phase 48 wire protocol may invalidate block assumptions sooner)
