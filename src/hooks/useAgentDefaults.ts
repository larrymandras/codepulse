import { useState, useEffect, useCallback } from "react";
import {
  fetchAgents,
  fetchAgentEmailDefaults,
  AstridrApiError,
} from "@/lib/astridrApi";
import type { AgentListItem, AgentEmailDefaults } from "@/lib/astridrApi";

export interface AgentWithDefaults extends AgentListItem {
  emailDefaults: AgentEmailDefaults | null;
}

export function useAgentDefaults() {
  const [agents, setAgents] = useState<AgentWithDefaults[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const agentList = await fetchAgents();
      const withDefaults = await Promise.all(
        agentList.map(async (agent): Promise<AgentWithDefaults> => {
          try {
            const emailDefaults = await fetchAgentEmailDefaults(agent.id);
            return { ...agent, emailDefaults };
          } catch (err) {
            // 404 means no defaults configured yet — treat as null, not an error
            if (err instanceof AstridrApiError && err.status === 404) {
              return { ...agent, emailDefaults: null };
            }
            // Re-throw other errors so they surface at the hook level
            throw err;
          }
        }),
      );
      setAgents(withDefaults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load agent defaults",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { agents, loading, error, reload: load };
}
