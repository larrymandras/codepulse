import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type {
  McpServer,
  DiscoveredTool,
  CallGraphEdge,
  ToolGovernanceRow,
} from "../lib/mcp-health";

/**
 * Live sources for the MCP Inventory + Health surface (Phase 73).
 *
 * Joins the same three registry sources the Tool Galaxy uses (mcpServers,
 * discoveredTools, callGraphEdges) plus the Phase 73 governance flags.
 * `loading` is true while ANY core query is still undefined (Convex returns
 * `undefined` during load) so the page shows one coherent loading state.
 * `governance` is additive — its absence does not gate loading.
 */
export function useMcpHealthSources(): {
  mcpServers: McpServer[];
  tools: DiscoveredTool[];
  edges: CallGraphEdge[];
  governance: ToolGovernanceRow[];
  loading: boolean;
} {
  const mcpServers = useQuery(api.registry.listMcpServers);
  const tools = useQuery(api.registry.listAllTools);
  const edges = useQuery(api.callGraphEdges.listEdges);
  const governance = useQuery(api.toolGovernance.listGovernance);

  const loading =
    mcpServers === undefined || tools === undefined || edges === undefined;

  return {
    mcpServers: (mcpServers ?? []) as McpServer[],
    tools: (tools ?? []) as DiscoveredTool[],
    edges: (edges ?? []) as CallGraphEdge[],
    governance: (governance ?? []) as ToolGovernanceRow[],
    loading,
  };
}

/** MCP-03: toggle a tool's governance disable flag. */
export function useSetToolDisabled() {
  return useMutation(api.toolGovernance.setToolDisabled);
}
