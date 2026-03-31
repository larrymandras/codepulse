import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useChannelHealth() {
  return useThrottledQuery(api.channelHealth.latest, {}, 5000) ?? {};
}
