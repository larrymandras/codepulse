/**
 * loomStepState — per-step visual state (Phase 119).
 *
 * The design doc's gate requires "an error event renders distinctly (control: a
 * clean run shows no error styling)". That control is what these tests encode:
 * every error assertion is paired with a clean-run assertion, so a function
 * that simply returned "error" always could not pass.
 */
import { describe, test, expect } from "vitest";
import { stepStateFrom, STEP_STATE_COLOR, isRunActive } from "./loomStepState";

const ev = (stepId: string, event: string) => ({ stepId, event });

describe("stepStateFrom", () => {
  test("a step with no events is pending", () => {
    expect(stepStateFrom([], "a")).toBe("pending");
    expect(stepStateFrom([ev("b", "complete")], "a")).toBe("pending");
  });

  test("start or action reads running", () => {
    expect(stepStateFrom([ev("a", "start")], "a")).toBe("running");
    expect(stepStateFrom([ev("a", "action")], "a")).toBe("running");
  });

  test("complete reads complete", () => {
    expect(stepStateFrom([ev("a", "start"), ev("a", "complete")], "a")).toBe(
      "complete"
    );
  });

  test("error outranks a later complete on the SAME step", () => {
    // A step that errored and was retried to green is not a clean step. Losing
    // this is losing the only visible trace that anything went wrong.
    const events = [ev("a", "start"), ev("a", "error"), ev("a", "complete")];
    expect(stepStateFrom(events, "a")).toBe("error");
  });

  test("CONTROL: the same shape without the error reads complete", () => {
    // Pairs with the test above — proves "error" is not simply always returned.
    const events = [ev("a", "start"), ev("a", "complete")];
    expect(stepStateFrom(events, "a")).toBe("complete");
  });

  test("warn outranks complete but not error", () => {
    expect(stepStateFrom([ev("a", "warn"), ev("a", "complete")], "a")).toBe(
      "warn"
    );
    expect(
      stepStateFrom([ev("a", "warn"), ev("a", "error")], "a")
    ).toBe("error");
  });

  test("one step's error does not leak onto another step", () => {
    const events = [ev("a", "error"), ev("b", "complete")];
    expect(stepStateFrom(events, "b")).toBe("complete");
    expect(stepStateFrom(events, "a")).toBe("error");
  });
});

describe("STEP_STATE_COLOR", () => {
  test("every state maps to a CSS var, never a hex literal", () => {
    for (const value of Object.values(STEP_STATE_COLOR)) {
      expect(value).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  test("pending is muted, not a status colour — an unrun step has no health", () => {
    expect(STEP_STATE_COLOR.pending).toBe("var(--muted-foreground)");
  });

  test("error and complete are visually distinct, which the gate requires", () => {
    expect(STEP_STATE_COLOR.error).not.toBe(STEP_STATE_COLOR.complete);
  });
});

describe("isRunActive", () => {
  test("only 'running' is active", () => {
    expect(isRunActive("running")).toBe(true);
    expect(isRunActive("complete")).toBe(false);
    expect(isRunActive("error")).toBe(false);
    expect(isRunActive(undefined)).toBe(false);
  });
});
