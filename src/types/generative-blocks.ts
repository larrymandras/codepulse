/**
 * Generative UI Block wire protocol.
 * Shared contract between Astríðr WebSocket events and the BlockRenderer.
 * Used by both Agent Chat and Insights Chat.
 *
 * Phase 3, Plan 01: Wire protocol types (D-04, D-06).
 */

// ─── Block Types ─────────────────────────────────────────────────────────────

export type MetricBlockData = {
  type: "metric";
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
};

export type TableBlockData = {
  type: "table";
  columns: string[];
  rows: (string | number)[][];
};

export type ChartBlockData = {
  type: "chart";
  data: { label: string; value: number }[];
  title?: string;
};

export type CodeBlockData = {
  type: "code";
  language: string;
  content: string;
};

export type DiffBlockData = {
  type: "diff";
  before: string;
  after: string;
  language?: string;
};

export type ApprovalBlockData = {
  type: "approval";
  requestId: string;
  action: string;
  details: Record<string, unknown>;
  riskLevel: "high" | "medium" | "low";
  agentName?: string;
};

export type MarkdownBlockData = {
  type: "markdown";
  content: string;
};

// Fallback: any block type not in the above union renders as markdown (D-06)
export type FallbackBlockData = {
  type: string;
  [key: string]: unknown;
};

export type GenerativeBlock =
  | MetricBlockData
  | TableBlockData
  | ChartBlockData
  | CodeBlockData
  | DiffBlockData
  | ApprovalBlockData
  | MarkdownBlockData
  | FallbackBlockData;

// ─── WebSocket Event Envelope ────────────────────────────────────────────────

export interface RunBlockEvent {
  event_type: "run.block";
  session_id: string;
  block: GenerativeBlock;
}

// ─── Extended ChatMessage ────────────────────────────────────────────────────

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks?: GenerativeBlock[];
  streaming: boolean;
  timestamp: number;
  sessionId?: string;
  audioUrl?: string;
};
