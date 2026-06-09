import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type {
  CallGraphEdge,
  DiscoveredTool,
  Kit,
  McpServer,
} from "../lib/tool-galaxy";

/**
 * Live sources for the Tool / Capability Galaxy (Phase 72).
 *
 * Returns `loading: true` while ANY of the core queries is still undefined
 * (Convex returns `undefined` during load), so the page can show one coherent
 * loading state instead of partial graphs. `kits` is additive — its absence
 * does not gate loading, so the galaxy renders even before any kit snapshot.
 */
export function useToolGalaxySources(): {
  tools: DiscoveredTool[];
  mcpServers: McpServer[];
  edges: CallGraphEdge[];
  kits: Kit[];
  loading: boolean;
} {
  const tools = useQuery(api.registry.listAllTools);
  const mcpServers = useQuery(api.registry.listMcpServers);
  const edges = useQuery(api.callGraphEdges.listEdges);
  const kits = useQuery(api.kits.listKits);

  const loading =
    tools === undefined || mcpServers === undefined || edges === undefined;

  return {
    tools: (tools ?? []) as DiscoveredTool[],
    mcpServers: (mcpServers ?? []) as McpServer[],
    edges: (edges ?? []) as CallGraphEdge[],
    kits: (kits ?? []) as Kit[],
    loading,
  };
}
