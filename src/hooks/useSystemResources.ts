import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useSystemResources() {
  const data = useQuery(api.systemResources.current);
  if (!data) return undefined;
  return {
    cpu: data.cpu ?? undefined,
    ram: data.ram ?? undefined,
    disk: data.disk ?? undefined,
  };
}
