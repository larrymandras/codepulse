import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGithubWorkflowRuns() {
  return useQuery(api.githubActions.latestRuns) ?? [];
}
