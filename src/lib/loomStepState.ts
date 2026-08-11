/**
 * loomStepState.ts — derive each pipeline step's visual state from a run's
 * event trail (Phase 119).
 *
 * Kept as a pure function rather than inlined into the node component because
 * it is the one place a live run can lie about itself, and it needs to be
 * mutation-testable without React Flow.
 */

export type StepState = "pending" | "running" | "complete" | "error" | "warn";

export interface StepEventLike {
  stepId: string;
  event: string;
  at?: number;
}

/**
 * Precedence, highest first: error > warn > complete > running > pending.
 *
 * `error` outranks `complete` for the SAME step deliberately. A step that
 * errored and was then retried to completion is not a clean step, and rendering
 * it green loses the only visible trace that anything went wrong — the design
 * doc's gate explicitly asks for an error event to "render distinctly".
 *
 * `warn` outranks `complete` for the same reason but sits below error.
 */
export function stepStateFrom(
  events: StepEventLike[],
  stepId: string
): StepState {
  const mine = events.filter((e) => e.stepId === stepId);
  if (mine.length === 0) return "pending";

  if (mine.some((e) => e.event === "error")) return "error";
  if (mine.some((e) => e.event === "warn")) return "warn";
  if (mine.some((e) => e.event === "complete")) return "complete";
  if (mine.some((e) => e.event === "start" || e.event === "action")) {
    return "running";
  }
  return "pending";
}

/**
 * CSS var per state. Every colour is a token — no hex literals, per the repo's
 * standing rule. `pending` deliberately uses the muted border rather than a
 * status colour: a step that has not run yet has no health to report, and
 * giving it one would be the same fabricated-signal mistake Bifröst's D-03
 * avoids for liveness dots.
 */
export const STEP_STATE_COLOR: Record<StepState, string> = {
  pending: "var(--muted-foreground)",
  running: "var(--primary)",
  complete: "var(--status-ok)",
  warn: "var(--status-warn)",
  error: "var(--status-error)",
};

/** Whether a run should be treated as currently executing. */
export function isRunActive(status: string | undefined): boolean {
  return status === "running";
}
