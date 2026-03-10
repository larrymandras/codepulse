import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type IntegrationStatusMap = {
  github: string;
  supabase: string;
  docker: string;
  telegram: string;
  slack: string;
  email: string;
};

export function useIntegrationHealth(): IntegrationStatusMap {
  const data = useQuery(api.integrations.healthStatus);
  return (
    data ?? {
      github: "Unknown",
      supabase: "Unknown",
      docker: "Unknown",
      telegram: "Unknown",
      slack: "Unknown",
      email: "Unknown",
    }
  );
}
