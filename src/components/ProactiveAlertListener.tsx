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
 *
 * Checkpoint round 5 cosmetic nit (Larry: "add some color... a bit more
 * noticeable"): priority-tinted — a colored left border + icon reusing the
 * SAME `--status-warn`/`--status-info` design tokens InboxCard.tsx's
 * stripeClass() already uses (no hardcoded hex). Money gets the amber/warn
 * accent + DollarSign icon; high gets the info/cyan accent + AlertCircle
 * icon (already the established "needs attention" icon elsewhere in
 * Chat.tsx); normal/low get sonner's plain default styling.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { DollarSign, AlertCircle } from "lucide-react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import {
  extractProactiveAlertBody,
  extractProactiveAlertPriority,
  PRIORITY_TOAST_STYLE,
  PROACTIVE_ALERT_TOAST_DURATION_MS,
  type ProactiveAlertPriority,
} from "@/lib/proactiveAlert";

const PRIORITY_TOAST_ICON: Record<ProactiveAlertPriority, React.ReactNode> = {
  money: <DollarSign className="w-4 h-4 text-(--status-warn)" />,
  high: <AlertCircle className="w-4 h-4 text-(--status-info)" />,
  normal: null,
  low: null,
};

export function ProactiveAlertListener() {
  const { subscribeEvent } = useAstridrWS();

  useEffect(() => {
    const unsubscribe = subscribeEvent("proactive_alert", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (!data) return;
      const body = extractProactiveAlertBody(data);
      if (!body) return;
      const priority = extractProactiveAlertPriority(data);
      const visual = priority ? PRIORITY_TOAST_STYLE[priority] : null;
      toast(body, {
        duration: PROACTIVE_ALERT_TOAST_DURATION_MS,
        ...(visual ? { style: visual.style } : {}),
        ...(priority && PRIORITY_TOAST_ICON[priority] ? { icon: PRIORITY_TOAST_ICON[priority] } : {}),
      });
    });
    return unsubscribe;
  }, [subscribeEvent]);

  return null;
}
