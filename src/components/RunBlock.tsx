/**
 * RunBlock — renders a single typed response block from an agent run.
 *
 * Block types:
 *   text       → prose paragraph, no left stripe
 *   tool_use   → collapsible card, primary left stripe
 *   tool_result→ collapsible card, green left stripe
 *   error      → always expanded, red left stripe + tint
 *
 * Phase 56, Plan 03: CPCC-03 Live Run panel.
 */

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunBlockProps {
  block: { type: string; [key: string]: unknown };
  defaultExpanded?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, maxLen = 80): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function argsToSummary(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return truncate(s, 80);
  } catch {
    return String(args);
  }
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function TextBlockView({ block }: { block: { text?: string } }) {
  return (
    <div className="bg-(--card) rounded p-3">
      <p className="text-sm text-(--foreground) whitespace-pre-wrap leading-relaxed">
        {block.text ?? ""}
      </p>
    </div>
  );
}

function ToolUseBlockView({
  block,
  expanded,
  onToggle,
}: {
  block: { name?: string; arguments?: unknown; tool_call_id?: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-2 border-l-(--primary) rounded cursor-pointer select-none"
      onClick={onToggle}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-(--muted-foreground)" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-(--muted-foreground)" />
          )}
          <span className="text-xs font-mono font-semibold text-(--foreground) shrink-0">
            {block.name ?? "tool_use"}
          </span>
        </div>
        {!expanded && (
          <span className="text-xs text-(--muted-foreground) font-mono truncate">
            {argsToSummary(block.arguments)}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto">
            {JSON.stringify(block.arguments, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultBlockView({
  block,
  expanded,
  onToggle,
}: {
  block: { tool_call_id?: string; result?: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  const idSnippet = block.tool_call_id
    ? block.tool_call_id.slice(0, 8) + "…"
    : "—";

  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-2 border-l-green-500 rounded cursor-pointer select-none"
      onClick={onToggle}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-(--muted-foreground)" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-(--muted-foreground)" />
          )}
          <span className="text-xs font-mono font-semibold text-(--foreground) shrink-0">
            Result
          </span>
        </div>
        {!expanded && (
          <span className="text-xs text-(--muted-foreground) font-mono">
            id: {idSnippet}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto max-h-48">
            {block.result ?? ""}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorBlockView({
  block,
}: {
  block: { error_type?: string; message?: string };
}) {
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

// ─── RunBlock ─────────────────────────────────────────────────────────────────

export function RunBlock({ block, defaultExpanded = false }: RunBlockProps) {
  // ErrorBlocks are always expanded; others respect defaultExpanded
  const isError = block.type === "error";
  const [expanded, setExpanded] = useState(isError ? true : defaultExpanded);

  const toggle = () => {
    if (!isError) setExpanded((v) => !v);
  };

  switch (block.type) {
    case "text":
      return <TextBlockView block={block as { text?: string }} />;

    case "tool_use":
      return (
        <ToolUseBlockView
          block={
            block as { name?: string; arguments?: unknown; tool_call_id?: string }
          }
          expanded={expanded}
          onToggle={toggle}
        />
      );

    case "tool_result":
      return (
        <ToolResultBlockView
          block={block as { tool_call_id?: string; result?: string }}
          expanded={expanded}
          onToggle={toggle}
        />
      );

    case "error":
      return (
        <ErrorBlockView
          block={block as { error_type?: string; message?: string }}
        />
      );

    default:
      // Unknown block type — render as raw JSON
      return (
        <div className="bg-(--muted) border border-(--border) rounded p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--muted-foreground)">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      );
  }
}
