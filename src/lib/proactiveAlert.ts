/**
 * proactiveAlert — renders a governor-delivered "proactive_alert" WS event
 * (Phase 186 checkpoint round 4, D-09 observability fix).
 *
 * Root cause this fixes: the governor's WS-tier presence-cascade delivery
 * (astridr/automation/governor.py's _resolve_presence_target -> channel_id
 * "codepulse") previously had NO registered channel sender in the backend
 * -- send_alert silently no-op'd yet reported success, so a money/high
 * interrupt's audit intent reached "complete" for a delivery nobody ever
 * saw (no toast, no chat message, nothing in Telegram). The backend now
 * pushes an observable "proactive_alert" event via ConvexHandler.send_live
 * (astridr/automation/proactive.py's make_codepulse_channel_sender); this
 * module renders it as BOTH a sonner toast AND a visible assistant
 * chat-timeline message — mirrors voiceState.ts's runLostScreenAck pattern
 * (speak + appendLocalAssistantMessage together) for the same reason:
 * neither channel alone is reliable on its own (a toast auto-dismisses and
 * can be missed while looking away; a silent chat line can be scrolled
 * past without a toast ever drawing the eye).
 *
 * Phase 186 checkpoint round 5 (page-scoping fix): the toast and the
 * chat-timeline append are now rendered by TWO SEPARATE listeners --
 * ProactiveAlertListener.tsx (app-level mount, App.tsx, toast only) and
 * Chat.tsx's own subscription (append only). Root cause: the round-4
 * version wired both into Chat.tsx's single subscription, so the toast
 * only ever fired while /chat happened to be mounted -- Larry was on
 * /inbox when a real money card arrived and never saw a toast at all.
 * :func:`extractProactiveAlertBody` is the shared validation both
 * listeners use so the "malformed/blank body is silently ignored" rule
 * lives in exactly one place. :func:`renderProactiveAlert` (both channels
 * together) is kept for callers that legitimately want both from a single
 * mount point (and its existing test coverage).
 *
 * Checkpoint round 5 cosmetic nit (Larry: "add some color... a bit more
 * noticeable"): the WS event now also carries the governor's validated
 * `priority`. :func:`extractProactiveAlertPriority` + `PRIORITY_TOAST_STYLE`
 * give ProactiveAlertListener.tsx a priority-tinted left border + icon,
 * reusing the SAME `--status-warn`/`--status-info` design tokens
 * InboxCard.tsx's stripeClass() already uses (no hardcoded hex, per repo
 * convention) -- money gets the amber/warn accent, high gets the
 * info/cyan accent, normal/low get no special tint (they're quiet cards,
 * Phase 186 checkpoint round 5's own "normal = quiet card" decision --
 * this toast is never shown for them in the first place, since
 * should_speak() only ever delivers money/high through the cascade, but
 * the style map stays total for safety).
 */

// Mirrors FocusExitDigest.tsx's TOAST_DURATION_MS (186-UI-SPEC: 5-8s
// auto-dismiss, matching existing toast usage elsewhere).
export const PROACTIVE_ALERT_TOAST_DURATION_MS = 7000;

export type ProactiveAlertPriority = "money" | "high" | "normal" | "low";

const VALID_PRIORITIES: ReadonlySet<string> = new Set(["money", "high", "normal", "low"]);

export interface ProactiveAlertEventData {
  profileId?: unknown;
  body?: unknown;
  priority?: unknown;
}

export interface ProactiveAlertCallbacks {
  toast: (text: string) => void;
  appendLocalAssistantMessage: (text: string) => void;
}

/**
 * Validates + extracts the body text from a "proactive_alert" WS event's
 * `data` payload. Returns `null` for a malformed event (missing/non-string/
 * blank body) -- callers must treat `null` as "render nothing".
 */
export function extractProactiveAlertBody(data: ProactiveAlertEventData): string | null {
  const body = typeof data.body === "string" ? data.body.trim() : "";
  return body || null;
}

/**
 * Validates + extracts the priority from a "proactive_alert" WS event's
 * `data` payload. Returns `null` for a missing/unrecognized value (an
 * out-of-enum string, e.g. a future backend change) -- never trusted
 * as-is, mirrors the backend's own governor._normalize_priority posture.
 */
export function extractProactiveAlertPriority(
  data: ProactiveAlertEventData
): ProactiveAlertPriority | null {
  return typeof data.priority === "string" && VALID_PRIORITIES.has(data.priority)
    ? (data.priority as ProactiveAlertPriority)
    : null;
}

/** One toast's visual treatment: a left-border accent color (CSS var
 * reference, never a hardcoded hex) + an inline style object ready to
 * spread onto sonner's `style` option. `null` means "no special styling"
 * (sonner's own default). */
export interface ProactiveAlertToastStyle {
  borderColorVar: string;
  style: { borderLeft: string };
}

export const PRIORITY_TOAST_STYLE: Record<ProactiveAlertPriority, ProactiveAlertToastStyle | null> = {
  // Matches InboxCard.tsx's stripeClass() token choices exactly (D-14 "card"
  // stripe uses --status-info; approval-pending uses --status-warn) so the
  // toast and the Cards-tab stripe read as the same visual language.
  money: { borderColorVar: "--status-warn", style: { borderLeft: "4px solid var(--status-warn)" } },
  high: { borderColorVar: "--status-info", style: { borderLeft: "4px solid var(--status-info)" } },
  normal: null,
  low: null,
};

/**
 * Renders one "proactive_alert" WS event through BOTH channels (toast +
 * chat-timeline append) from a single call site. A malformed event
 * (missing/blank body) is silently ignored — never a blank toast or empty
 * chat bubble.
 */
export function renderProactiveAlert(
  callbacks: ProactiveAlertCallbacks,
  data: ProactiveAlertEventData
): void {
  const body = extractProactiveAlertBody(data);
  if (!body) return;
  callbacks.toast(body);
  callbacks.appendLocalAssistantMessage(body);
}
