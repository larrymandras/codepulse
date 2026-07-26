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
 */

// Mirrors FocusExitDigest.tsx's TOAST_DURATION_MS (186-UI-SPEC: 5-8s
// auto-dismiss, matching existing toast usage elsewhere).
export const PROACTIVE_ALERT_TOAST_DURATION_MS = 7000;

export interface ProactiveAlertEventData {
  profileId?: unknown;
  body?: unknown;
}

export interface ProactiveAlertCallbacks {
  toast: (text: string) => void;
  appendLocalAssistantMessage: (text: string) => void;
}

/**
 * Renders one "proactive_alert" WS event. A malformed event (missing/blank
 * body) is silently ignored — never a blank toast or empty chat bubble.
 */
export function renderProactiveAlert(
  callbacks: ProactiveAlertCallbacks,
  data: ProactiveAlertEventData
): void {
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!body) return;
  callbacks.toast(body);
  callbacks.appendLocalAssistantMessage(body);
}
