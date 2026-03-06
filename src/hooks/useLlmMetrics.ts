import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useLlmMetrics() {
  const calls = useQuery(api.llm.recentCalls);
  return calls ?? [];
}
