import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDesignTemplates() {
  return useQuery(api.designTemplates.list) ?? [];
}
