import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EmptyState } from "./EmptyState";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

const SOURCE_PATH = path.resolve(__dirname, "EmptyState.tsx");

function readSourceWithoutComments(): string {
  const raw = readFileSync(SOURCE_PATH, "utf-8");
  // Strip block comments and line comments so the file's own explanatory
  // prose (which necessarily quotes state names/copy in JSDoc) cannot
  // self-invalidate the centralisation/no-hardcoded-colour gates below.
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ALL_STATES: MetricState[] = [
  "loading",
  "ready",
  "empty",
  "stale",
  "unavailable",
  "error",
];

describe("EmptyState", () => {
  it("renders the shared module's default copy for the state it is given", () => {
    render(<EmptyState state="stale" />);
    expect(screen.getByText(METRIC_STATE_COPY.stale.label)).toBeTruthy();
  });

  it("a label prop overrides the default copy", () => {
    render(<EmptyState state="empty" label="no runs in the last 24h" />);
    expect(screen.getByText("no runs in the last 24h")).toBeTruthy();
    expect(screen.queryByText("no signal yet")).toBeNull();
  });

  it("renders the state's Lucide icon and applies its token tone", () => {
    render(<EmptyState state="unavailable" />);
    const icon = screen.getByTestId("empty-state-icon");
    expect(icon).toBeTruthy();
    expect(icon.style.color).toBe(METRIC_STATE_COPY.unavailable.tone);
  });

  it('given state="empty" with no override, the rendered text is exactly "no signal yet"', () => {
    render(<EmptyState state="empty" />);
    expect(screen.getByText("no signal yet", { exact: true })).toBeTruthy();
  });

  it('given state="loading", it renders a content-shaped skeleton rather than the word "Loading"', () => {
    render(<EmptyState state="loading" />);
    expect(screen.getByTestId("empty-state-skeleton-panel")).toBeTruthy();
    expect(screen.queryByText(/Loading/i)).toBeNull();
  });

  it('given state="error", it renders without throwing and does not duplicate SectionErrorBoundary\'s always-present Retry button', () => {
    expect(() => render(<EmptyState state="error" />)).not.toThrow();
    expect(screen.getByText(METRIC_STATE_COPY.error.label)).toBeTruthy();
    // SectionErrorBoundary's own fallback always renders a "Retry" button.
    // EmptyState must not reproduce that chrome automatically -- an action
    // is only rendered when the caller explicitly supplies one.
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("renders a caller-supplied action only when one is explicitly provided", () => {
    render(<EmptyState state="error" action={<button>Retry</button>} />);
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("contains no copy string for any state as a literal in its own source (centralisation, not duplication)", () => {
    const source = readSourceWithoutComments();
    for (const state of ALL_STATES) {
      const literalLabel = METRIC_STATE_COPY[state].label;
      expect(source.includes(JSON.stringify(literalLabel))).toBe(false);
    }
  });

  it("contains no hardcoded colour literal (no hex, no raw palette class)", () => {
    const source = readSourceWithoutComments();
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/-(slate|zinc|gray|neutral|stone)-[0-9]/);
  });

  it("renders every state without throwing", () => {
    for (const state of ALL_STATES) {
      expect(() => render(<EmptyState state={state} />)).not.toThrow();
    }
  });
});
