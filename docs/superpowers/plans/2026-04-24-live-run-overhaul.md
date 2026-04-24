# Live Run Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Live Run page show actionable data — thinking state, tool call details, cost/tokens, failover transitions — by consuming events Ástríðr already emits but the page currently ignores.

**Architecture:** Decompose the monolithic RunBlock into focused sub-components (ThinkingBlock, ToolCallBlock, TextBlock, ErrorBlock, FailoverBlock). Add new WS subscriptions for `run.thinking`, `run.tool_call`, and `self_healing`. Replace the Flow/dagre tab with a RunSummary stats panel. All changes are CodePulse-only.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, Tailwind v4 with CSS custom properties, lucide-react icons.

---

## File Structure

**Create:**
- `src/components/blocks/ThinkingBlock.tsx` — thinking/round indicator block
- `src/components/blocks/ToolCallBlock.tsx` — tool call with args + result
- `src/components/blocks/TextBlock.tsx` — text response block
- `src/components/blocks/ErrorBlock.tsx` — error display block
- `src/components/blocks/FailoverBlock.tsx` — provider failover alert block
- `src/components/RunSummary.tsx` — summary stats panel (replaces Flow tab)
- `src/components/__tests__/blocks.test.tsx` — tests for all block sub-components
- `src/components/__tests__/RunSummary.test.tsx` — tests for RunSummary
- `src/components/__tests__/LiveRun.test.tsx` — tests for new subscriptions and dedup

**Modify:**
- `src/components/RunBlock.tsx` — gut inline renderers, become thin dispatcher
- `src/components/RunTimeline.tsx` — update tool call count to include new `tool_call` type
- `src/pages/LiveRun.tsx` — add subscriptions, dedup filter, replace Flow with Summary tab

**Delete (imports only):**
- ReactFlow, dagre imports and flowGraph logic from LiveRun.tsx

---

### Task 1: Extract TextBlock and ErrorBlock sub-components

**Files:**
- Create: `src/components/blocks/TextBlock.tsx`
- Create: `src/components/blocks/ErrorBlock.tsx`
- Create: `src/components/__tests__/blocks.test.tsx`

- [ ] **Step 1: Write failing tests for TextBlock and ErrorBlock**

```tsx
// src/components/__tests__/blocks.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextBlock } from "../blocks/TextBlock";
import { ErrorBlock } from "../blocks/ErrorBlock";

describe("TextBlock", () => {
  it("renders text content", () => {
    render(<TextBlock block={{ type: "text", text: "Hello world" }} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders empty string when text is missing", () => {
    const { container } = render(<TextBlock block={{ type: "text" }} />);
    expect(container.querySelector("p")).toBeInTheDocument();
  });
});

describe("ErrorBlock", () => {
  it("renders error type and message", () => {
    render(
      <ErrorBlock
        block={{ type: "error", error_type: "TimeoutError", message: "Request timed out" }}
      />
    );
    expect(screen.getByText("TimeoutError")).toBeInTheDocument();
    expect(screen.getByText("Request timed out")).toBeInTheDocument();
  });

  it("renders fallback when error_type is missing", () => {
    render(<ErrorBlock block={{ type: "error", message: "Something broke" }} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement TextBlock**

```tsx
// src/components/blocks/TextBlock.tsx
interface TextBlockProps {
  block: { type: string; text?: string };
}

export function TextBlock({ block }: TextBlockProps) {
  return (
    <div className="bg-(--card) rounded p-3">
      <p className="text-sm text-(--foreground) whitespace-pre-wrap leading-relaxed">
        {block.text ?? ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implement ErrorBlock**

```tsx
// src/components/blocks/ErrorBlock.tsx
interface ErrorBlockProps {
  block: { type: string; error_type?: string; message?: string };
}

export function ErrorBlock({ block }: ErrorBlockProps) {
  return (
    <div className="bg-(--card) border-l-2 border-l-(--status-error) rounded bg-red-500/5 p-3">
      <p className="text-xs font-semibold text-(--status-error) mb-1">
        {block.error_type ?? "Error"}
      </p>
      <p className="text-sm text-(--foreground) whitespace-pre-wrap">
        {block.message ?? ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: PASS — all 4 tests pass

- [ ] **Step 6: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/blocks/TextBlock.tsx src/components/blocks/ErrorBlock.tsx src/components/__tests__/blocks.test.tsx
git commit -m "feat(live-run): extract TextBlock and ErrorBlock sub-components"
```

---

### Task 2: Create ThinkingBlock sub-component

**Files:**
- Create: `src/components/blocks/ThinkingBlock.tsx`
- Modify: `src/components/__tests__/blocks.test.tsx`

- [ ] **Step 1: Write failing tests for ThinkingBlock**

Append to `src/components/__tests__/blocks.test.tsx`:

```tsx
import { ThinkingBlock } from "../blocks/ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders round number badge", () => {
    render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 3, thinking_text: "Analyzing..." }}
        streaming={false}
      />
    );
    expect(screen.getByText("Round 3")).toBeInTheDocument();
  });

  it("renders thinking text preview collapsed by default", () => {
    render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Deep analysis of the problem" }}
        streaming={false}
      />
    );
    const details = screen.getByRole("group");
    expect(details).not.toHaveAttribute("open");
  });

  it("has amber left stripe", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Thinking..." }}
        streaming={false}
      />
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-l-(--status-warn)");
  });

  it("shows pulse animation when streaming", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Thinking..." }}
        streaming={true}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("does not pulse when not streaming", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Done thinking" }}
        streaming={false}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify ThinkingBlock tests fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: FAIL — ThinkingBlock module not found

- [ ] **Step 3: Implement ThinkingBlock**

```tsx
// src/components/blocks/ThinkingBlock.tsx
import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ThinkingBlockProps {
  block: { type: string; round_num?: number; thinking_text?: string };
  streaming?: boolean;
}

export function ThinkingBlock({ block, streaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const text = block.thinking_text ?? "";
  const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;

  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-4 border-l-(--status-warn) rounded"
      role="group"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
        )}
        <span className="text-xs font-semibold text-(--foreground) bg-(--secondary) px-2 py-0.5 rounded">
          Round {block.round_num ?? "?"}
        </span>
        {streaming && (
          <span className="h-2 w-2 rounded-full bg-(--status-warn) animate-pulse" />
        )}
        {!expanded && text && (
          <span className="text-xs text-(--muted-foreground) truncate">
            {preview}
          </span>
        )}
      </div>
      {expanded && text && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: PASS — all ThinkingBlock tests pass

- [ ] **Step 5: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/blocks/ThinkingBlock.tsx src/components/__tests__/blocks.test.tsx
git commit -m "feat(live-run): add ThinkingBlock sub-component with round badge and expand/collapse"
```

---

### Task 3: Create ToolCallBlock sub-component

**Files:**
- Create: `src/components/blocks/ToolCallBlock.tsx`
- Modify: `src/components/__tests__/blocks.test.tsx`

- [ ] **Step 1: Write failing tests for ToolCallBlock**

Append to `src/components/__tests__/blocks.test.tsx`:

```tsx
import { ToolCallBlock } from "../blocks/ToolCallBlock";
import { fireEvent } from "@testing-library/react";

describe("ToolCallBlock", () => {
  const block = {
    type: "tool_call",
    tool_name: "web_search",
    arguments: { query: "test query", limit: 10 },
    result: "Found 3 results for test query",
    status: "success",
  };

  it("renders tool name as header", () => {
    render(<ToolCallBlock block={block} />);
    expect(screen.getByText("web_search")).toBeInTheDocument();
  });

  it("has blue left stripe", () => {
    const { container } = render(<ToolCallBlock block={block} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-l-(--primary)");
  });

  it("shows green indicator for success status", () => {
    const { container } = render(<ToolCallBlock block={block} />);
    expect(container.querySelector(".bg-green-500, .text-(--status-ok)")).not.toBeNull();
  });

  it("shows red indicator for error status", () => {
    const { container } = render(
      <ToolCallBlock block={{ ...block, status: "error" }} />
    );
    expect(container.querySelector(".bg-red-500, .text-(--status-error)")).not.toBeNull();
  });

  it("shows arguments when expanded", () => {
    render(<ToolCallBlock block={block} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText(/"query": "test query"/)).toBeInTheDocument();
  });

  it("shows result when expanded", () => {
    render(<ToolCallBlock block={block} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText(/Found 3 results/)).toBeInTheDocument();
  });

  it("shows args summary when collapsed", () => {
    render(<ToolCallBlock block={block} />);
    expect(screen.getByText(/query.*test query/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: FAIL — ToolCallBlock module not found

- [ ] **Step 3: Implement ToolCallBlock**

```tsx
// src/components/blocks/ToolCallBlock.tsx
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface ToolCallBlockProps {
  block: {
    type: string;
    tool_name?: string;
    arguments?: unknown;
    result?: string;
    status?: string;
  };
}

function truncateArgs(args: unknown, maxLen = 80): string {
  try {
    const s = JSON.stringify(args);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  } catch {
    return String(args);
  }
}

export function ToolCallBlock({ block }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = block.status === "error";

  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-4 border-l-(--primary) rounded cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
          )}
          <span className="text-xs font-mono font-semibold text-(--foreground) shrink-0">
            {block.tool_name ?? "tool"}
          </span>
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              isError ? "bg-red-500" : "bg-green-500"
            }`}
            title={block.status ?? "unknown"}
          />
        </div>
        {!expanded && (
          <span className="text-xs text-(--muted-foreground) font-mono truncate">
            {truncateArgs(block.arguments)}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {block.arguments != null && (
            <div>
              <p className="text-xs font-semibold text-(--muted-foreground) mb-1">Arguments</p>
              <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto">
                {JSON.stringify(block.arguments, null, 2)}
              </pre>
            </div>
          )}
          {block.result != null && (
            <div>
              <p className="text-xs font-semibold text-(--muted-foreground) mb-1">Result</p>
              <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto max-h-48">
                {block.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: PASS — all ToolCallBlock tests pass

- [ ] **Step 5: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/blocks/ToolCallBlock.tsx src/components/__tests__/blocks.test.tsx
git commit -m "feat(live-run): add ToolCallBlock with args/result expand and status indicator"
```

---

### Task 4: Create FailoverBlock sub-component

**Files:**
- Create: `src/components/blocks/FailoverBlock.tsx`
- Modify: `src/components/__tests__/blocks.test.tsx`

- [ ] **Step 1: Write failing tests for FailoverBlock**

Append to `src/components/__tests__/blocks.test.tsx`:

```tsx
import { FailoverBlock } from "../blocks/FailoverBlock";

describe("FailoverBlock", () => {
  const block = {
    type: "failover",
    failedProvider: "anthropic_direct",
    newProvider: "ollama",
    errorMessage: "Connection timeout after 90s",
  };

  it("renders provider transition message", () => {
    render(<FailoverBlock block={block} />);
    expect(screen.getByText(/anthropic_direct/)).toBeInTheDocument();
    expect(screen.getByText(/ollama/)).toBeInTheDocument();
  });

  it("has warning left stripe", () => {
    const { container } = render(<FailoverBlock block={block} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-l-(--status-warn)");
  });

  it("shows error detail when expanded", () => {
    render(<FailoverBlock block={block} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText(/Connection timeout after 90s/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: FAIL — FailoverBlock module not found

- [ ] **Step 3: Implement FailoverBlock**

```tsx
// src/components/blocks/FailoverBlock.tsx
import { useState } from "react";
import { AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";

interface FailoverBlockProps {
  block: {
    type: string;
    failedProvider?: string;
    newProvider?: string;
    errorMessage?: string;
  };
}

export function FailoverBlock({ block }: FailoverBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-yellow-500/5 border border-(--border) border-l-4 border-l-(--status-warn) rounded cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-(--status-warn)" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-(--status-warn)" />
        )}
        <AlertTriangle className="h-4 w-4 shrink-0 text-(--status-warn)" />
        <span className="text-xs text-(--foreground)">
          <span className="font-mono font-semibold">{block.failedProvider ?? "unknown"}</span>
          {" failed → "}
          <span className="font-mono font-semibold">{block.newProvider ?? "unknown"}</span>
        </span>
      </div>
      {expanded && block.errorMessage && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--muted-foreground) bg-(--card) rounded p-2">
            {block.errorMessage}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: PASS — all FailoverBlock tests pass

- [ ] **Step 5: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/blocks/FailoverBlock.tsx src/components/__tests__/blocks.test.tsx
git commit -m "feat(live-run): add FailoverBlock with provider transition display"
```

---

### Task 5: Refactor RunBlock into thin dispatcher

**Files:**
- Modify: `src/components/RunBlock.tsx`
- Modify: `src/components/__tests__/blocks.test.tsx` (add dispatcher tests)

- [ ] **Step 1: Write failing tests for the dispatcher**

Append to `src/components/__tests__/blocks.test.tsx`:

```tsx
import { RunBlock } from "../RunBlock";

describe("RunBlock dispatcher", () => {
  it("dispatches text block to TextBlock", () => {
    render(<RunBlock block={{ type: "text", text: "Hello from dispatcher" }} />);
    expect(screen.getByText("Hello from dispatcher")).toBeInTheDocument();
  });

  it("dispatches error block to ErrorBlock", () => {
    render(
      <RunBlock block={{ type: "error", error_type: "TestError", message: "test" }} />
    );
    expect(screen.getByText("TestError")).toBeInTheDocument();
  });

  it("dispatches thinking block to ThinkingBlock", () => {
    render(
      <RunBlock block={{ type: "thinking", round_num: 2, thinking_text: "hmm" }} />
    );
    expect(screen.getByText("Round 2")).toBeInTheDocument();
  });

  it("dispatches tool_call block to ToolCallBlock", () => {
    render(
      <RunBlock
        block={{ type: "tool_call", tool_name: "search", arguments: {}, status: "success" }}
      />
    );
    expect(screen.getByText("search")).toBeInTheDocument();
  });

  it("dispatches failover block to FailoverBlock", () => {
    render(
      <RunBlock
        block={{
          type: "failover",
          failedProvider: "anthropic",
          newProvider: "ollama",
        }}
      />
    );
    expect(screen.getByText(/anthropic/)).toBeInTheDocument();
  });

  it("renders unknown block types as raw JSON", () => {
    render(<RunBlock block={{ type: "mystery", data: "test" }} />);
    expect(screen.getByText(/"mystery"/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: FAIL — RunBlock doesn't handle `thinking`, `tool_call`, or `failover` types yet

- [ ] **Step 3: Rewrite RunBlock as dispatcher**

Replace the entire content of `src/components/RunBlock.tsx`:

```tsx
import { TextBlock } from "./blocks/TextBlock";
import { ErrorBlock } from "./blocks/ErrorBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolCallBlock } from "./blocks/ToolCallBlock";
import { FailoverBlock } from "./blocks/FailoverBlock";

interface RunBlockProps {
  block: { type: string; [key: string]: unknown };
  streaming?: boolean;
}

export function RunBlock({ block, streaming = false }: RunBlockProps) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block as { type: string; text?: string }} />;

    case "thinking":
    case "reasoning":
      return (
        <ThinkingBlock
          block={block as { type: string; round_num?: number; thinking_text?: string }}
          streaming={streaming}
        />
      );

    case "tool_call":
      return (
        <ToolCallBlock
          block={
            block as {
              type: string;
              tool_name?: string;
              arguments?: unknown;
              result?: string;
              status?: string;
            }
          }
        />
      );

    case "tool_use":
      return (
        <ToolCallBlock
          block={{
            type: "tool_call",
            tool_name: (block.name as string | undefined) ?? "tool",
            arguments: block.arguments,
            status: "success",
          }}
        />
      );

    case "tool_result":
      return null;

    case "error":
      return (
        <ErrorBlock
          block={block as { type: string; error_type?: string; message?: string }}
        />
      );

    case "failover":
      return (
        <FailoverBlock
          block={
            block as {
              type: string;
              failedProvider?: string;
              newProvider?: string;
              errorMessage?: string;
            }
          }
        />
      );

    default:
      return (
        <div className="bg-(--muted) border border-(--border) rounded p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--muted-foreground)">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx`
Expected: PASS — all dispatcher tests pass

- [ ] **Step 5: Run existing RunTimeline tests to verify no regressions**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/RunTimeline.test.tsx`
Expected: PASS — existing tests still pass (RunTimeline still imports RunBlock, which now dispatches)

- [ ] **Step 6: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/RunBlock.tsx src/components/__tests__/blocks.test.tsx
git commit -m "refactor(live-run): convert RunBlock to thin dispatcher over sub-components"
```

---

### Task 6: Update RunTimeline to pass streaming and count tool_call blocks

**Files:**
- Modify: `src/components/RunTimeline.tsx`
- Modify: `src/components/__tests__/RunTimeline.test.tsx`

- [ ] **Step 1: Write failing test for tool_call block counting**

Add to `src/components/__tests__/RunTimeline.test.tsx`:

```tsx
it("counts tool_call blocks (not just tool_use) in round header", () => {
  const blocks = [
    { type: "thinking", round_num: 1, thinking_text: "thinking" },
    { type: "tool_call", tool_name: "search", arguments: {}, status: "success" },
    { type: "tool_call", tool_name: "write", arguments: {}, status: "success" },
  ];
  render(<RunTimeline blocks={blocks} streaming={false} />);
  expect(screen.getByText(/2 tool calls/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/RunTimeline.test.tsx`
Expected: FAIL — current code only counts `tool_use`, not `tool_call`

- [ ] **Step 3: Update RunTimeline to count both types and pass streaming to RunBlock**

In `src/components/RunTimeline.tsx`, update the toolCallCount line (line 86-88) and the RunBlock rendering (line 112-113):

Change toolCallCount from:
```tsx
const toolCallCount = round.blocks.filter(
  (b) => b.type === "tool_use"
).length;
```
To:
```tsx
const toolCallCount = round.blocks.filter(
  (b) => b.type === "tool_use" || b.type === "tool_call"
).length;
```

Change RunBlock rendering from:
```tsx
<RunBlock key={idx} block={block} />
```
To:
```tsx
<RunBlock key={idx} block={block} streaming={isActive && streaming} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/RunTimeline.test.tsx`
Expected: PASS — all RunTimeline tests pass including the new one

- [ ] **Step 5: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/RunTimeline.tsx src/components/__tests__/RunTimeline.test.tsx
git commit -m "feat(live-run): count tool_call blocks in round header and pass streaming to RunBlock"
```

---

### Task 7: Create RunSummary component

**Files:**
- Create: `src/components/RunSummary.tsx`
- Create: `src/components/__tests__/RunSummary.test.tsx`

- [ ] **Step 1: Write failing tests for RunSummary**

```tsx
// src/components/__tests__/RunSummary.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunSummary } from "../RunSummary";

const completedData = {
  rounds: 3,
  inputTokens: 1500,
  outputTokens: 800,
  cost: 0.047,
  startedAt: 1714000000000,
  completedAt: 1714000012000,
  status: "completed" as const,
};

describe("RunSummary", () => {
  it("renders round count", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders cost formatted as dollars", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("$0.047")).toBeInTheDocument();
  });

  it("renders token counts", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("renders duration", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("12.0s")).toBeInTheDocument();
  });

  it("renders status indicator", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("shows dashes for token/cost during live run", () => {
    render(
      <RunSummary
        rounds={1}
        status="running"
        startedAt={Date.now()}
        blocks={[]}
      />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders tool usage from blocks", () => {
    const blocks = [
      { type: "tool_call", tool_name: "web_search" },
      { type: "tool_call", tool_name: "web_search" },
      { type: "tool_call", tool_name: "memory_save" },
    ];
    render(<RunSummary {...completedData} blocks={blocks} />);
    expect(screen.getByText(/web_search/)).toBeInTheDocument();
    expect(screen.getByText(/×2/)).toBeInTheDocument();
    expect(screen.getByText(/memory_save/)).toBeInTheDocument();
  });

  it("renders provider trail from failover blocks", () => {
    const blocks = [
      { type: "failover", failedProvider: "anthropic_direct", newProvider: "ollama" },
    ];
    render(<RunSummary {...completedData} blocks={blocks} />);
    expect(screen.getByText(/anthropic_direct/)).toBeInTheDocument();
    expect(screen.getByText(/ollama/)).toBeInTheDocument();
  });

  it("shows empty state when no run data", () => {
    render(<RunSummary status="idle" blocks={[]} />);
    expect(screen.getByText(/No run data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/RunSummary.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RunSummary**

```tsx
// src/components/RunSummary.tsx
import { useMemo } from "react";
import { Activity, Clock, Coins, Cpu, Layers, Wrench } from "lucide-react";

type Block = { type: string; [key: string]: unknown };

interface RunSummaryProps {
  rounds?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  startedAt?: number;
  completedAt?: number;
  status: "idle" | "running" | "completed" | "error";
  blocks: Block[];
}

function formatDuration(startMs: number, endMs: number): string {
  const seconds = (endMs - startMs) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${mins}m ${secs}s`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-(--card) border border-(--border) rounded p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-(--muted-foreground)">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-lg font-semibold text-(--foreground) font-mono">{value}</span>
    </div>
  );
}

export function RunSummary({
  rounds,
  inputTokens,
  outputTokens,
  cost,
  startedAt,
  completedAt,
  status,
  blocks,
}: RunSummaryProps) {
  const toolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of blocks) {
      if (b.type === "tool_call") {
        const name = (b.tool_name as string) ?? "unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  }, [blocks]);

  const failoverTrail = useMemo(() => {
    return blocks
      .filter((b) => b.type === "failover")
      .map((b) => ({
        from: (b.failedProvider as string) ?? "unknown",
        to: (b.newProvider as string) ?? "unknown",
      }));
  }, [blocks]);

  if (status === "idle") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-(--muted-foreground)">No run data yet.</p>
      </div>
    );
  }

  const isLive = status === "running";
  const duration =
    startedAt && completedAt
      ? formatDuration(startedAt, completedAt)
      : isLive && startedAt
        ? "running…"
        : "—";

  const statusColor =
    status === "completed"
      ? "text-(--status-ok)"
      : status === "error"
        ? "text-(--status-error)"
        : "text-(--status-warn)";

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Run Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Rounds"
          value={rounds != null ? String(rounds) : "—"}
        />
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Duration"
          value={duration}
        />
        <div className="bg-(--card) border border-(--border) rounded p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-(--muted-foreground)">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-xs">Status</span>
          </div>
          <span className={`text-lg font-semibold font-mono ${statusColor}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Token & Cost */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="Input Tokens"
          value={inputTokens != null ? formatNumber(inputTokens) : "—"}
        />
        <StatCard
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="Output Tokens"
          value={outputTokens != null ? formatNumber(outputTokens) : "—"}
        />
        <StatCard
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Cost"
          value={cost != null ? formatCost(cost) : "—"}
        />
      </div>

      {/* Provider Trail */}
      {failoverTrail.length > 0 && (
        <div className="bg-(--card) border border-(--border) rounded p-3">
          <div className="flex items-center gap-1.5 text-(--muted-foreground) mb-2">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-xs">Provider Trail</span>
          </div>
          <div className="flex flex-col gap-1">
            {failoverTrail.map((f, i) => (
              <span key={i} className="text-xs font-mono text-(--foreground)">
                <span className="text-(--status-error)">{f.from}</span>
                {" → "}
                <span className="text-(--status-ok)">{f.to}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tool Usage */}
      {toolCounts.size > 0 && (
        <div className="bg-(--card) border border-(--border) rounded p-3">
          <div className="flex items-center gap-1.5 text-(--muted-foreground) mb-2">
            <Wrench className="h-3.5 w-3.5" />
            <span className="text-xs">Tool Usage ({toolCounts.size} unique)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(toolCounts.entries()).map(([name, count]) => (
              <span
                key={name}
                className="text-xs font-mono bg-(--secondary) text-(--foreground) px-2 py-0.5 rounded"
              >
                {name} {count > 1 ? `×${count}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/RunSummary.test.tsx`
Expected: PASS — all RunSummary tests pass

- [ ] **Step 5: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/components/RunSummary.tsx src/components/__tests__/RunSummary.test.tsx
git commit -m "feat(live-run): add RunSummary stats panel with cost, tokens, provider trail, tool usage"
```

---

### Task 8: Wire new subscriptions and dedup into LiveRun.tsx

**Files:**
- Modify: `src/pages/LiveRun.tsx`
- Create: `src/components/__tests__/LiveRun.test.tsx`

- [ ] **Step 1: Write failing tests for dedup logic and new block accumulation**

```tsx
// src/components/__tests__/LiveRun.test.tsx
import { describe, it, expect } from "vitest";
import { appendBlocksWithDedup } from "../../pages/LiveRun";

describe("appendBlocksWithDedup", () => {
  it("keeps text blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [{ type: "text", text: "hello" }]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
  });

  it("drops tool_use blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [
      { type: "text", text: "hi" },
      { type: "tool_use", name: "search", arguments: {} },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
  });

  it("drops tool_result blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [
      { type: "tool_result", tool_call_id: "tc_1", result: "data" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("caps at BLOCK_CAP (500)", () => {
    const existing = Array.from({ length: 498 }, (_, i) => ({
      type: "text",
      text: `block-${i}`,
    }));
    const incoming = [
      { type: "text", text: "new-1" },
      { type: "text", text: "new-2" },
      { type: "text", text: "new-3" },
    ];
    const result = appendBlocksWithDedup(existing, incoming);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/LiveRun.test.tsx`
Expected: FAIL — `appendBlocksWithDedup` not exported

- [ ] **Step 3: Rewrite LiveRun.tsx — add subscriptions, dedup, replace Flow with Summary**

Replace the entire content of `src/pages/LiveRun.tsx`:

```tsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type UIEvent,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { RunTimeline } from "../components/RunTimeline";
import { RunHistorySelector } from "../components/RunHistorySelector";
import { RunSummary } from "../components/RunSummary";
import { Square } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = { type: string; [key: string]: unknown };
type ActiveTab = "timeline" | "summary";
type RunStatus = "idle" | "running" | "completed" | "error";

// ─── Cap blocks to 500 entries (T-56-10 DoS mitigation) ───────────────────────
const BLOCK_CAP = 500;

// ─── Dedup filter: drop tool_use and tool_result from run.blocks ─────────────
export function appendBlocksWithDedup(prev: Block[], incoming: Block[]): Block[] {
  const filtered = incoming.filter(
    (b) => b.type !== "tool_use" && b.type !== "tool_result"
  );
  const combined = [...prev, ...filtered];
  if (combined.length > BLOCK_CAP) {
    return combined.slice(combined.length - BLOCK_CAP);
  }
  return combined;
}

// ─── Summary state accumulated from live events ──────────────────────────────

interface RunMeta {
  status: RunStatus;
  rounds: number;
  startedAt: number | undefined;
  completedAt: number | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  cost: number | undefined;
}

const INITIAL_META: RunMeta = {
  status: "idle",
  rounds: 0,
  startedAt: undefined,
  completedAt: undefined,
  inputTokens: undefined,
  outputTokens: undefined,
  cost: undefined,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveRun() {
  const { status, subscribeEvent, sendCommand } = useAstridrWS();

  // Live streaming state
  const [liveBlocks, setLiveBlocks] = useState<Block[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [runDone, setRunDone] = useState(false);
  const [runMeta, setRunMeta] = useState<RunMeta>(INITIAL_META);

  // History / selector state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");

  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Convex queries ────────────────────────────────────────────────────────
  const sessions = useQuery(api.runBlocks.listSessions) ?? [];

  const historyRecords = useQuery(
    api.runBlocks.getBySession,
    !isLive && selectedSessionId ? { sessionId: selectedSessionId } : "skip"
  );

  const historicalBlocks: Block[] = historyRecords
    ? historyRecords.flatMap((r) => (r.blocks as Block[]) ?? [])
    : [];

  // ─── WS subscriptions ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsubStarted = subscribeEvent("run.started", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      const sid = data?.session_id ?? null;
      setLiveSessionId(sid);
      setLiveBlocks([]);
      setRunDone(false);
      setIsLive(true);
      setAutoScroll(true);
      setRunMeta({
        ...INITIAL_META,
        status: "running",
        startedAt: Date.now(),
      });
    });

    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      const data = event.data as
        | { session_id?: string; blocks?: Block[] }
        | undefined;
      if (!data?.blocks) return;
      setLiveBlocks((prev) => appendBlocksWithDedup(prev, data.blocks!));
    });

    const unsubThinking = subscribeEvent("run.thinking", (event) => {
      const data = event.data as
        | { session_id?: string; round_num?: number; thinking_text?: string }
        | undefined;
      if (!data) return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          {
            type: "thinking",
            round_num: data.round_num,
            thinking_text: data.thinking_text,
          },
        ])
      );
      setRunMeta((prev) => ({
        ...prev,
        rounds: data.round_num ?? prev.rounds + 1,
      }));
    });

    const unsubToolCall = subscribeEvent("run.tool_call", (event) => {
      const data = event.data as
        | {
            session_id?: string;
            tool_name?: string;
            arguments?: unknown;
            status?: string;
            result?: string;
          }
        | undefined;
      if (!data) return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          {
            type: "tool_call",
            tool_name: data.tool_name,
            arguments: data.arguments,
            status: data.status,
            result: data.result,
          },
        ])
      );
    });

    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as
        | {
            rounds?: number;
            tokens?: { input?: number; output?: number };
            cost?: number;
          }
        | undefined;
      setRunDone(true);
      setRunMeta((prev) => ({
        ...prev,
        status: "completed",
        completedAt: Date.now(),
        rounds: data?.rounds ?? prev.rounds,
        inputTokens: data?.tokens?.input,
        outputTokens: data?.tokens?.output,
        cost: data?.cost,
      }));
    });

    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as
        | { error_type?: string; message?: string }
        | undefined;
      setRunDone(true);
      setRunMeta((prev) => ({
        ...prev,
        status: "error",
        completedAt: Date.now(),
      }));
      if (data) {
        setLiveBlocks((prev) =>
          appendBlocksWithDedup(prev, [
            {
              type: "error",
              error_type: data.error_type ?? "Error",
              message: data.message ?? "",
            },
          ])
        );
      }
    });

    const unsubFailover = subscribeEvent("self_healing", (event) => {
      const data = event.data as
        | {
            failedProvider?: string;
            errorMessage?: string;
            remainingProviders?: number;
            healEventType?: string;
          }
        | undefined;
      if (!data || data.healEventType !== "failover_activated") return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          {
            type: "failover",
            failedProvider: data.failedProvider,
            newProvider: "next provider",
            errorMessage: data.errorMessage,
          },
        ])
      );
    });

    return () => {
      unsubStarted();
      unsubBlocks();
      unsubThinking();
      unsubToolCall();
      unsubCompleted();
      unsubError();
      unsubFailover();
    };
  }, [subscribeEvent]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [liveBlocks, historicalBlocks, autoScroll, scrollToBottom]);

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (!atBottom && autoScroll) setAutoScroll(false);
      if (atBottom && !autoScroll) setAutoScroll(true);
    },
    [autoScroll]
  );

  // ─── History selection ─────────────────────────────────────────────────────
  const handleSelectSession = useCallback((sid: string | null) => {
    if (sid === null) {
      setIsLive(true);
      setSelectedSessionId(null);
    } else {
      setIsLive(false);
      setSelectedSessionId(sid);
    }
  }, []);

  // ─── Stop button ───────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    void sendCommand({ type: "run.stop" });
  }, [sendCommand]);

  // ─── Determine displayed blocks ───────────────────────────────────────────
  const displayBlocks = isLive ? liveBlocks : historicalBlocks;
  const displayStreaming = isLive && !runDone;
  const hasActiveRun = isLive && !runDone && liveBlocks.length > 0;

  // ─── Summary props from history ───────────────────────────────────────────
  const summaryStatus: RunStatus = isLive ? runMeta.status : "completed";
  const summaryRounds = isLive
    ? runMeta.rounds
    : displayBlocks.filter((b) => b.type === "thinking" || b.type === "reasoning").length || undefined;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
        <h1 className="text-xl font-semibold text-(--foreground)">Live Run</h1>
        <div className="flex items-center gap-3">
          <RunHistorySelector
            sessions={sessions}
            selectedSessionId={isLive ? null : selectedSessionId}
            onSelect={handleSelectSession}
          />
          <WSStatusIndicator status={status} />
        </div>
      </div>

      {/* Tab bar + stop button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--border) shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1 text-sm ${
              activeTab === "timeline"
                ? "bg-(--primary) text-(--primary-foreground)"
                : "bg-(--secondary) text-(--foreground)"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1 text-sm ${
              activeTab === "summary"
                ? "bg-(--primary) text-(--primary-foreground)"
                : "bg-(--secondary) text-(--foreground)"
            }`}
          >
            Summary
          </button>
        </div>
        <button
          onClick={handleStop}
          disabled={!hasActiveRun}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-(--destructive) text-white disabled:opacity-50"
          title="Stop Run"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
      </div>

      {/* Session label */}
      {isLive && liveSessionId && (
        <div className="px-4 py-1.5 border-b border-(--border) shrink-0">
          <span className="text-xs text-(--muted-foreground) font-mono">
            Session: {liveSessionId.slice(0, 16)}…
            {runDone ? " — completed" : " — live"}
          </span>
        </div>
      )}

      {/* Content area */}
      {activeTab === "timeline" ? (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4"
          onScroll={handleScroll}
        >
          {displayBlocks.length === 0 && !displayStreaming ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-(--muted-foreground) text-center">
                {isLive
                  ? "No active run. Start a task from Agent Chat."
                  : "No blocks found for this session."}
              </p>
            </div>
          ) : (
            <RunTimeline blocks={displayBlocks} streaming={displayStreaming} />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <RunSummary
            status={summaryStatus}
            rounds={summaryRounds}
            inputTokens={isLive ? runMeta.inputTokens : undefined}
            outputTokens={isLive ? runMeta.outputTokens : undefined}
            cost={isLive ? runMeta.cost : undefined}
            startedAt={isLive ? runMeta.startedAt : undefined}
            completedAt={isLive ? runMeta.completedAt : undefined}
            blocks={displayBlocks}
          />
        </div>
      )}

      {/* Scroll-to-bottom button when auto-scroll suppressed (Timeline only) */}
      {activeTab === "timeline" && !autoScroll && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            className="text-xs px-3 py-1 bg-(--primary) text-(--primary-foreground) rounded-full"
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
          >
            ↓ Latest
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run dedup tests to verify they pass**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/LiveRun.test.tsx`
Expected: PASS — all dedup tests pass

- [ ] **Step 5: Run all related tests**

Run: `cd C:/Users/mandr/codepulse && npx vitest run src/components/__tests__/blocks.test.tsx src/components/__tests__/RunTimeline.test.tsx src/components/__tests__/RunSummary.test.tsx src/components/__tests__/LiveRun.test.tsx`
Expected: PASS — all tests pass

- [ ] **Step 6: Commit**

```bash
cd C:/Users/mandr/codepulse && git add src/pages/LiveRun.tsx src/components/__tests__/LiveRun.test.tsx
git commit -m "feat(live-run): add thinking/tool_call/failover subscriptions, dedup filter, replace Flow with Summary"
```

---

### Task 9: Verify build and run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

Run: `cd C:/Users/mandr/codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run full test suite**

Run: `cd C:/Users/mandr/codepulse && npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 3: Start dev server and verify Live Run page loads**

Run: `cd C:/Users/mandr/codepulse && npm run dev`
Open: `http://localhost:5174` (CodePulse port), navigate to Live Run page.
Verify:
- Page loads without errors
- Timeline tab shows "No active run" message
- Summary tab shows "No run data yet" message
- Tab switching works between Timeline and Summary
- No Flow tab or dagre-related console errors

- [ ] **Step 4: Commit any fixes if needed**

If type errors or test failures were found and fixed, commit them:
```bash
cd C:/Users/mandr/codepulse && git add -u
git commit -m "fix(live-run): resolve build issues from overhaul"
```

---

### Task 10: Clean up unused dagre/ReactFlow imports

**Files:**
- Modify: `src/pages/LiveRun.tsx` (already done in Task 8, but verify)

- [ ] **Step 1: Verify no remaining dagre or ReactFlow imports**

Run: `cd C:/Users/mandr/codepulse && grep -r "dagre\|ReactFlow\|@xyflow\|FLOW_BLOCK_CAP" src/`
Expected: No matches (all removed in Task 8's rewrite)

- [ ] **Step 2: Verify the ReactFlow and dagre packages are not imported elsewhere**

Run: `cd C:/Users/mandr/codepulse && grep -r "@xyflow\|from.*dagre" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches. If no other files use these packages, they could be removed from package.json in a future cleanup, but don't remove them in this phase.

- [ ] **Step 3: Final commit**

```bash
cd C:/Users/mandr/codepulse && git add -A
git commit -m "chore(live-run): verify dagre/ReactFlow cleanup complete"
```
