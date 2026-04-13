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
import type { GenerativeBlock, ApprovalBlockData } from "@/types/generative-blocks";
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

export function BlockRenderer({ block, onApprove, onReject }: BlockRendererProps) {
  switch (block.type) {
    case "metric":
      return <MetricBlock block={block} />;

    case "table":
      return <TableBlock block={block} />;

    case "chart":
      return <ChartBlock block={block} />;

    case "code":
      return <CodeBlock block={block} />;

    case "diff":
      return <CodeBlock block={block} diff />;

    case "approval":
      return (
        <ApprovalBlock
          block={block as ApprovalBlockData}
          onApprove={onApprove}
          onReject={onReject}
        />
      );

    case "markdown":
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
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
