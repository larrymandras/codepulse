/**
 * ProactiveAlertListener — headless, app-level toast for governor
 * "proactive_alert" WS events (Phase 186 checkpoint round 5, D-09 fix).
 *
 * Root cause this fixes: the round-4 observability fix wired the
 * "proactive_alert" subscription directly into Chat.tsx, so the toast only
 * ever fired while the Chat page happened to be mounted — Larry was on
 * /inbox when a money-priority card arrived and never saw a toast at all.
 * Mounted ONCE at the app root (App.tsx, alongside AstridrWSProvider) so
 * the toast fires from ANY page, not just /chat.
 *
 * Renders nothing (headless, returns null) — mirrors FocusExitDigest.tsx's
 * pattern, which has the SAME app-level mount requirement (moved to App.tsx
 * in this same round, see deferred-items.md).
 *
 * The chat-timeline append (chat.appendLocalAssistantMessage) intentionally
 * stays Chat.tsx-scoped — it can only append to a message list that exists,
 * which only exists while useAstridrChat is mounted. Splitting the two
 * observable channels this way means: toast always fires (any page); the
 * chat line appears too whenever Chat happens to be open (a bonus, not a
 * requirement) — the inbox row itself (record-everything, D-15) is the
 * durable record regardless of either UI channel.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { extractProactiveAlertBody } from "@/lib/proactiveAlert";
import { PROACTIVE_ALERT_TOAST_DURATION_MS } from "@/lib/proactiveAlert";

export function ProactiveAlertListener() {
  const { subscribeEvent } = useAstridrWS();

  useEffect(() => {
    const unsubscribe = subscribeEvent("proactive_alert", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (!data) return;
      const body = extractProactiveAlertBody(data);
      if (!body) return;
      toast(body, { duration: PROACTIVE_ALERT_TOAST_DURATION_MS });
    });
    return unsubscribe;
  }, [subscribeEvent]);

  return null;
}
