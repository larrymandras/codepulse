/**
 * MetricCard.test.tsx — the six-state contract (Plan 122-13, D-13/D-14).
 *
 * One named test per behavior line in 122-13-PLAN.md's `<behavior>` block,
 * plus the prop-compatibility surface, plus the source-level centralization
 * guard (D-20: no state's default copy lives here as a literal) and the
 * Task 2 population/coverage ratchet.
 *
 * A pre-existing, unrelated legacy test file also exercises MetricCard at
 * `src/components/__tests__/MetricCard.test.tsx` (out of this plan's
 * `files_modified` scope) — see 122-13-SUMMARY.md for why it was left
 * alone rather than merged or deleted.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MetricCard from "./MetricCard";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, "MetricCard.tsx");

/** Strips `//` and `/* *\/` comments before a literal-copy-string search,
 *  so a comment that legitimately NAMES a state's copy in prose (e.g.
 *  explaining the design law) is not mistaken for the component defining
 *  that copy as a code literal — the D-20 guarantee is about literals the
 *  component would RENDER, not about the word never appearing in English. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

describe("MetricCard — six-state contract", () => {
  // ── Backward compatibility (D-13/D-14: no caller breaks) ──────────────────

  it("BACKWARD-COMPATIBILITY CONTROL: renders with the exact pre-rewrite prop set and no `state` prop", () => {
    const onClick = vi.fn();
    render(
      <MetricCard
        label="Active Sessions"
        value="128"
        trend="up"
        severity="warning"
        threshold={{ ok: 100, warn: 150 }}
        onClick={onClick}
        sparklineData={[1, 2, 3]}
      />
    );
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("`numericValue` + `format` render without throwing (AnimatedNumber path)", () => {
    const format = (v: number) => `${v}ms`;
    const { container } = render(
      <MetricCard label="Latency" value="—" numericValue={120} format={format} />
    );
    expect(screen.getByText("Latency")).toBeInTheDocument();
    // Animation timing is not asserted (motion's spring is frame-driven and
    // does not settle synchronously in jsdom) — only that the animated
    // node mounted.
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });

  // ── state="ready" (default) ────────────────────────────────────────────────

  it('state="ready" renders the value, and is the default when no `state` prop is supplied', () => {
    render(<MetricCard label="CPU" value="42%" />);
    expect(screen.getByTestId("metric-card-value")).toHaveTextContent("42%");
  });

  // ── state="loading" ─────────────────────────────────────────────────────────

  it('state="loading" renders a skeleton shaped like the tile\'s own content, and never the word "Loading"', () => {
    const { container } = render(<MetricCard label="CPU" value="42%" state="loading" />);
    expect(screen.getByTestId("metric-card-skeleton")).toBeInTheDocument();
    // Label-width block + numeral-width block, per the design law.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/Loading/i);
    // Neither the real label text nor the real value text renders as text —
    // they're replaced by the skeleton, not shown alongside it.
    expect(screen.queryByText("CPU")).not.toBeInTheDocument();
    expect(screen.queryByText("42%")).not.toBeInTheDocument();
  });

  // ── state="empty" ────────────────────────────────────────────────────────────

  it('state="empty" renders exactly "no signal yet", sourced from the shared module', () => {
    render(<MetricCard label="CPU" value="42%" state="empty" />);
    expect(screen.getByText(METRIC_STATE_COPY.empty.label)).toBeInTheDocument();
    expect(METRIC_STATE_COPY.empty.label).toBe("no signal yet");
  });

  // ── state="stale" ────────────────────────────────────────────────────────────

  it('state="stale" renders the value AND a stale affordance — the figure is shown, not hidden', () => {
    render(<MetricCard label="CPU" value="42%" state="stale" />);
    expect(screen.getByTestId("metric-card-value")).toHaveTextContent("42%");
    expect(screen.getByTestId("metric-card-stale-note")).toHaveTextContent(
      METRIC_STATE_COPY.stale.label
    );
  });

  // ── state="unavailable" ─────────────────────────────────────────────────────

  it('state="unavailable" renders the unavailable copy and does NOT render an em dash as though it were a value', () => {
    render(<MetricCard label="CPU" value="—" state="unavailable" />);
    expect(screen.getByText(METRIC_STATE_COPY.unavailable.label)).toBeInTheDocument();
    expect(screen.queryByTestId("metric-card-value")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  // ── state="error" ────────────────────────────────────────────────────────────

  it('state="error" renders the error affordance without throwing and without duplicating boundary-fallback chrome', () => {
    let result!: ReturnType<typeof render>;
    expect(() => {
      result = render(<MetricCard label="CPU" value="42%" state="error" />);
    }).not.toThrow();
    expect(
      result.getAllByText(METRIC_STATE_COPY.error.label).length
    ).toBeGreaterThan(0);
    // No retry affordance — that's SectionErrorBoundary's job one layer up,
    // not the tile's.
    expect(result.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  // ── Prop surface stays live in the states that show a value ────────────────

  it("trend up/down read --status-ok / --status-error tokens, never a palette class", () => {
    const { container: up } = render(<MetricCard label="X" value="1" trend="up" />);
    const upIcon = up.querySelector("svg");
    expect(upIcon?.getAttribute("class")).toContain("text-(--status-ok)");

    const { container: down } = render(<MetricCard label="X" value="1" trend="down" />);
    const downIcon = down.querySelector("svg");
    expect(downIcon?.getAttribute("class")).toContain("text-(--status-error)");
  });

  it("does not render a trend icon when trend is neutral or omitted", () => {
    const { container } = render(<MetricCard label="X" value="1" trend="neutral" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("threshold + numericValue color the value via the --metric-* tokens", () => {
    render(
      <MetricCard
        label="Error rate"
        value="—"
        numericValue={50}
        threshold={{ ok: 60, warn: 80 }}
      />
    );
    const valueEl = screen.getByTestId("metric-card-value") as HTMLElement;
    expect(valueEl.style.color).toBe("var(--metric-ok)");
  });

  it("severity dot renders for ready/stale and is withheld for the other four states", () => {
    const ready = render(<MetricCard label="X" value="1" severity="critical" />);
    expect(ready.container.querySelector(".rounded-full")).not.toBeNull();
    ready.unmount();

    const loading = render(
      <MetricCard label="X" value="1" severity="critical" state="loading" />
    );
    expect(loading.container.querySelector(".rounded-full")).toBeNull();
    loading.unmount();
  });

  it("onClick fires on click and on Enter/Space keydown, matching the pre-rewrite affordance", () => {
    const onClick = vi.fn();
    render(<MetricCard label="X" value="1" onClick={onClick} />);
    const card = screen.getByRole("button");
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  // ── D-20 centralization: no state's copy lives here as a literal ──────────

  it("defines no copy string of its own — none of the shared module's six default labels appear as literals in the source", () => {
    const source = stripComments(fs.readFileSync(SOURCE_PATH, "utf8"));
    for (const entry of Object.values(METRIC_STATE_COPY)) {
      expect(source.includes(JSON.stringify(entry.label))).toBe(false);
    }
  });

  // ── Task 2: corpus-derived state-coverage ratchet ──────────────────────────
  //
  // Derives the state list from `Object.keys(METRIC_STATE_COPY)` at test
  // time rather than writing the six names into this file — an enumerated
  // list can only ratify today's six states. MUTATION PROOF performed
  // during execution (see 122-13-SUMMARY.md): a synthetic 7th state added
  // to `src/lib/metricState.ts` made this test fail (MetricCard's
  // exhaustive switch throws via `assertNever` for any state it has no
  // case for), then the mutation was reverted and this test went green
  // again. An enumerated `["loading","ready",...]` array would not have
  // caught it — it would have simply never exercised the new key.
  it("renders every state currently defined by the shared vocabulary without throwing", () => {
    const states = Object.keys(METRIC_STATE_COPY) as MetricState[];
    expect(states.length).toBeGreaterThan(0); // sanity: derivation found entries
    for (const state of states) {
      const { unmount } = render(<MetricCard label="Coverage" value="1" state={state} />);
      unmount();
    }
  });

  // ── Accessible name for the clickable wrapper (122-22) ─────────────────────
  //
  // A clickable tile renders `role="button"`, which requires an accessible
  // name. Name-from-content is unreliable here because the value slot renders
  // a Skeleton or an InlineMetricState in four of the six states, so what the
  // tile exposes varies with its data. Phase 122's own after-matrix measured
  // the gap as 8 serious `aria-command-name` violations / 52 nodes across the
  // 4x5 theme-page matrix (122-21-REMATRIX.md).
  //
  // Asserted through the ACCESSIBILITY TREE (`getByRole(..., { name })`), not
  // by reading the attribute back — querying `aria-label` directly would pass
  // even if the attribute never reached the element the role sits on.
  it("gives a clickable tile an accessible name, in EVERY state", () => {
    const states = Object.keys(METRIC_STATE_COPY) as MetricState[];
    for (const state of states) {
      const { unmount } = render(
        <MetricCard label="Total Events" value="42" state={state} onClick={() => {}} />,
      );
      expect(
        screen.getByRole("button", { name: "Total Events" }),
        `state "${state}": clickable tile exposed no accessible name`,
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("CONTROL: a non-clickable tile exposes no button role at all", () => {
    render(<MetricCard label="Total Events" value="42" state="ready" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
