import { useState, useMemo } from "react";
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

type ZoomLevel = "1h" | "6h" | "24h" | "7d";

const zoomConfig: Record<ZoomLevel, { hours: number; bucketMinutes: number }> = {
  "1h": { hours: 1, bucketMinutes: 1 },
  "6h": { hours: 6, bucketMinutes: 5 },
  "24h": { hours: 24, bucketMinutes: 15 },
  "7d": { hours: 168, bucketMinutes: 60 },
};

export function useConversationTimeline() {
  const [zoom, setZoom] = useState<ZoomLevel>("6h");

  const { hours, bucketMinutes } = zoomConfig[zoom];
  const now = Math.floor(Date.now() / 60000) * 60; // round to nearest minute (in seconds)
  const startTime = now - hours * 3600;

  const data = useThrottledQuery(
    api.conversationTimeline.buckets,
    { startTime, endTime: now, bucketMinutes },
    2000
  );

  const buckets = useMemo(() => data ?? [], [data]);

  return { buckets, zoom, setZoom };
}
