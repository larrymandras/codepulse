import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type {
  CallGraphEdge,
  DiscoveredTool,
  McpServer,
} from "../lib/tool-galaxy";

/**
 * Live sources for the Tool / Capability Galaxy (Phase 72).
 *
 * Returns `loading: true` while ANY of the three queries is still undefined
 * (Convex returns `undefined` during load), so the page can show one coherent
 * loading state instead of partial graphs.
 */
export function useToolGalaxySources(): {
  tools: DiscoveredTool[];
  mcpServers: McpServer[];
  edges: CallGraphEdge[];
  loading: boolean;
} {
  const tools = useQuery(api.registry.listAllTools);
  const mcpServers = useQuery(api.registry.listMcpServers);
  const edges = useQuery(api.callGraphEdges.listEdges);

  const loading =
    tools === undefined || mcpServers === undefined || edges === undefined;

  return {
    tools: (tools ?? []) as DiscoveredTool[],
    mcpServers: (mcpServers ?? []) as McpServer[],
    edges: (edges ?? []) as CallGraphEdge[],
    loading,
  };
}
