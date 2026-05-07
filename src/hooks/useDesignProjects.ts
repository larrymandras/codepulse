import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDesignProjects() {
  return useQuery(api.designProjects.list) ?? [];
}
