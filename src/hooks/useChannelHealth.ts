import { usePollQuery } from "./usePollQuery";
import { api } from "../../convex/_generated/api";

export function useChannelHealth() {
  const { data } = usePollQuery(api.channelHealth.latest, {}, 10000);
  return data ?? {};
}
