import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDockerHealth() {
  const containers = useQuery(api.docker.currentStatus);
  return containers ?? [];
}
