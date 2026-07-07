/**
 * Insights Chat — LLM-powered Q&A over CodePulse operational data.
 *
 * Per D-11: Backend uses LLM with structured Convex tool calls.
 * NOT keyword matching — actual LLM call with OpenAI-compatible function calling.
 * Returns GenerativeBlock[] for rendering in InsightsChat page (D-12).
 *
 * Phase 3, Plan 06: IL-06.
 */
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ─── Tool Definitions (OpenAI function-calling format) ──────────────────────

// These are the safe, pre-scoped queries the LLM can call (D-11).
// No raw DB access — only named queries exposed as tools.

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "cost_summary",
      description:
        "Get the total cost summary including token usage and spend across all agents",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "error_counts",
      description:
        "Get the count of error-level alerts and recent failures",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "agent_status",
      description:
        "List all agents with their current status and last seen timestamp",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "session_list",
      description:
        "List recent sessions/executions with their status and associated agent",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "alert_summary",
      description:
        "Get a summary of active alerts including unread count and total",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>;

async function executeTool(ctx: any, toolName: string): Promise<ToolResult> {
  switch (toolName) {
    case "cost_summary": {
      const metrics = await ctx.runQuery(api.metrics.dashboardSummary);
      return {
        totalCost: metrics?.totalCost ?? 0,
        tokenCount: metrics?.totalTokens ?? 0,
        totalEvents: metrics?.totalEvents ?? 0,
      };
    }
    case "error_counts": {
      const alerts = await ctx.runQuery(api.alerts.listAll);
      const errorCount = (alerts ?? []).filter(
        (a: any) => a.severity === "error" || a.type === "error"
      ).length;
      return { errorCount, total: (alerts ?? []).length };
    }
    case "agent_status": {
      const agents = await ctx.runQuery(api.agents.listAll);
      return {
        agents: (agents ?? []).map((a: any) => ({
          name: a.agentId || a.agentType || "Unknown",
          status: a.status || "unknown",
          lastSeen: a.endedAt
            ? new Date(a.endedAt * 1000).toLocaleString()
            : a.startedAt
            ? new Date(a.startedAt * 1000).toLocaleString()
            : "N/A",
        })),
      };
    }
    case "session_list": {
      const sessions = await ctx.runQuery(api.sessions.listAll, { limit: 20 });
      return {
        sessions: (sessions ?? []).slice(0, 20).map((s: any) => ({
          id: s.sessionId ?? s._id,
          status: s.status ?? "unknown",
          agent: s.model ?? "N/A",
        })),
      };
    }
    case "alert_summary": {
      const alerts = await ctx.runQuery(api.alerts.listAll);
      const total = (alerts ?? []).length;
      const unread = (alerts ?? []).filter((a: any) => !a.acknowledged).length;
      return { unread, total };
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Block Assembly ─────────────────────────────────────────────────────────

export function assembleBlocks(
  toolName: string,
  result: ToolResult
): Record<string, unknown> {
  switch (toolName) {
    case "cost_summary":
      return {
        type: "metric",
        label: "Total Cost",
        value: result.totalCost ?? 0,
        trend: "neutral",
      };
    case "error_counts":
      return {
        type: "metric",
        label: "Error Count",
        value: result.errorCount ?? 0,
        trend: (result.errorCount as number) > 5 ? "up" : "neutral",
      };
    case "agent_status": {
      const agents = (result.agents as any[]) ?? [];
      return {
        type: "table",
        columns: ["Agent", "Status", "Last Seen"],
        rows: agents.map((a: any) => [a.name, a.status, a.lastSeen]),
      };
    }
    case "session_list": {
      const sessions = (result.sessions as any[]) ?? [];
      return {
        type: "table",
        columns: ["Session", "Status", "Agent"],
        rows: sessions.map((s: any) => [s.id, s.status, s.agent]),
      };
    }
    case "alert_summary":
      return {
        type: "metric",
        label: "Active Alerts",
        value: `${result.unread} unread / ${result.total} total`,
        trend: (result.unread as number) > 3 ? "up" : "neutral",
      };
    default:
      return {
        type: "markdown",
        content: `Tool ${toolName} returned: ${JSON.stringify(result)}`,
      };
  }
}

// ─── Environment helpers ─────────────────────────────────────────────────────

// Convex actions run in a Node.js-compatible environment and have access to
// process.env for server-side environment variables. The Convex tsconfig does
// not include @types/node, so we access it via a typed cast to avoid TS errors.
const env = (globalThis as any).process?.env ?? {};

// ─── LLM Call ───────────────────────────────────────────────────────────────

async function callLLM(
  question: string,
  toolResults?: Array<{ role: string; tool_call_id: string; content: string }>,
  assistantToolCallMessage?: Record<string, unknown>
): Promise<any> {
  // Per D-11: actual LLM call with structured tool definitions.
  // Uses OpenAI-compatible API (works with OpenAI directly or LiteLLM proxy).
  const apiKey = env.OPENAI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not set in Convex environment. Set it in Convex Dashboard -> Settings -> Environment Variables."
    );
  }

  const baseUrl =
    (env.OPENAI_BASE_URL as string | undefined) || "https://api.openai.com/v1";

  const messages: any[] = [
    {
      role: "system",
      content:
        "You are an operational insights assistant for CodePulse, an AI agent monitoring dashboard. " +
        "Use the provided tools to answer questions about costs, errors, agents, sessions, and alerts. " +
        "Always call at least one tool to provide data-backed answers. Be concise.",
    },
    { role: "user", content: question },
  ];

  // If we have tool results from a previous round, append them.
  // Per OpenAI multi-turn tool call protocol, the assistant's tool_calls turn
  // must appear in history before the tool result messages.
  if (toolResults && toolResults.length > 0) {
    if (assistantToolCallMessage) {
      messages.push(assistantToolCallMessage);
    }
    messages.push(...toolResults);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: (env.OPENAI_MODEL as string | undefined) || "gpt-4o-mini",
      messages,
      tools: TOOLS,
      tool_choice: toolResults && toolResults.length > 0 ? "none" : "auto",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// ─── Action ─────────────────────────────────────────────────────────────────

export const ask = action({
  args: {
    question: v.string(),
  },
  handler: async (ctx, { question }): Promise<Record<string, unknown>[]> => {
    // CSO-95-02: gate the billed LLM call behind authentication. The Convex
    // deployment URL is public (VITE_CONVEX_URL ships in the frontend bundle),
    // so without this an unauthenticated caller could invoke ask() directly and
    // drive OpenAI spend. Clerk identity is present when the dashboard UI is
    // authenticated; reject direct unauthenticated calls before any LLM cost.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [{ type: "markdown", content: "Authentication required to use Insights Chat." }];
    }

    // Step 1: Call LLM with question and tool definitions
    const llmResponse = await callLLM(question);
    const choice = llmResponse.choices?.[0]?.message;

    if (!choice) {
      return [{ type: "markdown", content: "No response from LLM." }];
    }

    // Step 2: If LLM requests tool calls, execute them
    const blocks: Record<string, unknown>[] = [];

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolResultMessages: Array<{
        role: string;
        tool_call_id: string;
        content: string;
      }> = [];

      for (const toolCall of choice.tool_calls) {
        const toolName = toolCall.function.name;
        try {
          const result = await executeTool(ctx, toolName);
          blocks.push(assembleBlocks(toolName, result));
          toolResultMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          blocks.push({
            type: "markdown",
            content: `Failed to query ${toolName}.`,
          });
          toolResultMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: String(err) }),
          });
        }
      }

      // Step 3: Call LLM again with tool results for a natural language summary
      try {
        const summaryResponse = await callLLM(question, toolResultMessages, choice);
        const summaryChoice = summaryResponse.choices?.[0]?.message;
        if (summaryChoice?.content) {
          blocks.push({ type: "markdown", content: summaryChoice.content });
        }
      } catch {
        // If summary call fails, blocks from tool results are still useful
        blocks.push({
          type: "markdown",
          content: `Queried ${choice.tool_calls.length} data source(s).`,
        });
      }
    } else if (choice.content) {
      // LLM responded without tool calls — just text
      blocks.push({ type: "markdown", content: choice.content });
    }

    return blocks;
  },
});
