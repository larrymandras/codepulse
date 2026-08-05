/**
 * Producer-side dedup key for /ingest (Phase 88 D-04).
 *
 * Why this exists: a single Claude Code event can be delivered to the ingest
 * endpoint more than once when the same hook is wired at two settings scopes
 * (e.g. user ~/.claude/settings.json AND a project .claude/settings.json). Both
 * deliveries carry a byte-identical payload but run as SEPARATE processes, so
 * anything process-local — pid, hrtime, Date.now() — differs between them and
 * would defeat dedup rather than provide it. The key must be derived purely
 * from payload content.
 *
 * convex/events.ts dedups on `idempotencyKey` when present; when absent the
 * event is always counted (D-05: no lossy hash, no silent drop).
 *
 * We therefore emit a key ONLY for events carrying `tool_use_id`, which Claude
 * Code assigns per tool call and repeats verbatim across both deliveries.
 * `hook_event_name` is part of the key because PreToolUse and PostToolUse for
 * the SAME call share one tool_use_id — keying on the id alone would dedup a
 * PostToolUse against its own PreToolUse and silently lose the result event.
 *
 * Deliberately NOT keyed (left un-keyed, preserving D-05 always-count):
 *   - SessionStart  — (session_id, source) legitimately repeats across two
 *                     resumes of the same session.
 *   - Stop / UserPromptSubmit — prompt_id can repeat when a Stop hook continues
 *                     a turn (stop_hook_active), so a real event could be lost.
 * Those events are low-volume; duplicate-wiring there is better fixed at the
 * wiring, which is where it was actually introduced.
 */
export function buildIdempotencyKey(data) {
  if (!data || typeof data !== "object") return undefined;

  const toolUseId = data.tool_use_id;
  if (typeof toolUseId !== "string" || toolUseId === "") return undefined;

  const sessionId =
    typeof data.session_id === "string" && data.session_id ? data.session_id : "unknown";
  const eventName =
    typeof data.hook_event_name === "string" && data.hook_event_name
      ? data.hook_event_name
      : "unknown";

  return `${sessionId}:${eventName}:${toolUseId}`;
}
