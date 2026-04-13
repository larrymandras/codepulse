/**
 * BlockRenderer — switch dispatcher for GenerativeBlock types.
 *
 * Dispatches each block to the correct sub-component based on block.type.
 * Unknown types render as JSON in a markdown code fence (D-06 fallback).
 * Never uses dangerouslySetInnerHTML — ReactMarkdown sanitizes all output.
 *
 * Phase 03, Plan 02: IL-03 block rendering (D-04, D-06).
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  GenerativeBlock,
  MetricBlockData,
  TableBlockData,
  ChartBlockData,
  CodeBlockData,
  DiffBlockData,
  ApprovalBlockData,
  MarkdownBlockData,
} from "@/types/generative-blocks";
import { MetricBlock } from "@/components/blocks/MetricBlock";
import { TableBlock } from "@/components/blocks/TableBlock";
import { ChartBlock } from "@/components/blocks/ChartBlock";
import { CodeBlock } from "@/components/blocks/CodeBlock";
import { ApprovalBlock } from "@/components/blocks/ApprovalBlock";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlockRendererProps {
  block: GenerativeBlock;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason?: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

// FallbackBlockData uses `type: string` (not a literal), which prevents TypeScript
// switch-narrowing from excluding it from specific cases. Cast via unknown to
// each concrete type within each case — the switch guard ensures type safety at runtime.
export function BlockRenderer({ block, onApprove, onReject }: BlockRendererProps) {
  const b = block as unknown;
  switch (block.type) {
    case "metric":
      return <MetricBlock block={b as MetricBlockData} />;

    case "table":
      return <TableBlock block={b as TableBlockData} />;

    case "chart":
      return <ChartBlock block={b as ChartBlockData} />;

    case "code":
      return <CodeBlock block={b as CodeBlockData} />;

    case "diff":
      return <CodeBlock block={b as DiffBlockData} diff />;

    case "approval":
      return (
        <ApprovalBlock
          block={b as ApprovalBlockData}
          onApprove={onApprove}
          onReject={onReject}
        />
      );

    case "markdown":
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {(b as MarkdownBlockData).content}
        </ReactMarkdown>
      );

    default:
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {"```json\n" + JSON.stringify(block, null, 2) + "\n```"}
        </ReactMarkdown>
      );
  }
}

export default BlockRenderer;
