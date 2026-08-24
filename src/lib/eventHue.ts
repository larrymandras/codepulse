/**
 * eventHue.ts — the shared event_type -> hue vocabulary for the Signal
 * Horizon and Pulse ECG (D-06, Phase 125). One module answers "what colour
 * is this event" for both surfaces, so a `run.tool_call` packet and a
 * `run.tool_call` blip always paint the same colour — see `metricState.ts`
 * for the precedent this follows (a single table/lookup, one comment per
 * non-obvious mapping, tokens only, never a hex).
 *
 * D-06's rule, in priority order:
 *   1. Error-shaped types (including `run.error`) -> "error". Checked FIRST
 *      so `run.error` paints red, not violet, despite carrying the `run.`
 *      prefix rule (2) would otherwise match.
 *   2. `run.*` and the literal `chat.response` -> "astridr" (Ástríðr the
 *      entity, and only her — same category law `--astridr` itself follows,
 *      CLAUDE.md's colour law).
 *   3. Everything else -- including every type absent from the live
 *      `TOPIC_EVENT_MAP` -- -> "machine". An unrecognised event still
 *      renders (it is a real event), but mis-attributing it to Ástríðr is
 *      the worse error, so the fallback is never "astridr".
 */

export type EventHue = "astridr" | "machine" | "error";

/**
 * Error-shaped: the literal `run.error`, or any type whose final
 * dot-segment (or whole name, when there is no dot) is exactly `error`,
 * `failed`, or `failure`. Narrow and explicit on purpose — a looser
 * substring match would misclassify a type like `run.error_recovery` that
 * merely mentions the word.
 */
const ERROR_SUFFIXES = new Set(["error", "failed", "failure"]);

function isErrorShaped(eventType: string): boolean {
  if (eventType === "run.error") return true;
  const lastDot = eventType.lastIndexOf(".");
  const lastSegment = lastDot === -1 ? eventType : eventType.slice(lastDot + 1);
  return ERROR_SUFFIXES.has(lastSegment);
}

/**
 * event_type -> hue. Rules are checked in priority order (1) error-shaped,
 * (2) Ástríðr's own `run.*` / `chat.response` family, (3) machine, which is
 * also the fallback for anything unrecognised. Never throws.
 */
export function eventTypeToHue(eventType: string): EventHue {
  if (isErrorShaped(eventType)) return "error";
  if (eventType.startsWith("run.") || eventType === "chat.response") return "astridr";
  return "machine";
}

/**
 * The CSS custom property each hue paints with. Always a `var(--token)`
 * reference — never a hex, per this repo's token law. `astridr` reads
 * `--astridr` (the third hue owner, "Ástríðr the entity, and only her" --
 * `index.css`'s own D-08 comment); `machine` reads `--primary` (the
 * everyday cyan/emerald/etc. hue every theme already owns); `error` reads
 * `--status-error`.
 */
export const HUE_TOKEN: Record<EventHue, string> = {
  astridr: "var(--astridr)",
  machine: "var(--primary)",
  error: "var(--status-error)",
};
