import { useQuery } from "convex/react";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

type BadgeState = "ok" | "warning" | "hit";

export function useRateLimitState(providerName: string): BadgeState {
  const events = useQuery(api.rateLimitEvents.recentByProvider, {
    providerName,
    windowSeconds: 300, // 5-minute window per D-16
  });
  const { subscribeEvent } = useAstridrWS();
  const [wsEvents, setWsEvents] = useState<Array<{ eventType: string; timestamp: number }>>([]);

  useEffect(() => {
    const unsubHit = subscribeEvent("rate_limit_hit", (event) => {
      const d = event.data as any;
      if (d?.provider === providerName || d?.provider_name === providerName) {
        setWsEvents((prev) => {
          const cutoff = Date.now() / 1000 - 300;
          const pruned = prev.filter((e) => e.timestamp > cutoff);
          return [...pruned, { eventType: "rate_limit_hit", timestamp: Date.now() / 1000 }];
        });
      }
    });
    const unsubWarn = subscribeEvent("rate_limit_warning", (event) => {
      const d = event.data as any;
      if (d?.provider === providerName || d?.provider_name === providerName) {
        setWsEvents((prev) => {
          const cutoff = Date.now() / 1000 - 300;
          const pruned = prev.filter((e) => e.timestamp > cutoff);
          return [...pruned, { eventType: "rate_limit_warning", timestamp: Date.now() / 1000 }];
        });
      }
    });
    return () => {
      unsubHit();
      unsubWarn();
    };
  }, [subscribeEvent, providerName]);

  return useMemo(() => {
    const now = Date.now() / 1000;
    const cutoff = now - 300;

    // Combine Convex events + WS overlay events
    const convexRows = (events ?? []) as Array<{ eventType: string; timestamp: number }>;
    const allEvents = [
      ...convexRows.map((e) => ({ eventType: e.eventType, timestamp: e.timestamp })),
      ...wsEvents.filter((e) => e.timestamp > cutoff),
    ];

    const recent = allEvents.filter((e) => e.timestamp > cutoff);

    // Priority: hit > warning > ok (per UI-SPEC)
    if (recent.some((e) => e.eventType === "rate_limit_hit")) return "hit";
    if (recent.some((e) => e.eventType === "rate_limit_warning")) return "warning";
    return "ok";
  }, [events, wsEvents]);
}
