/**
 * PulseEcgHero.test.tsx — SIGNAL-02 (Phase 125 Plan 09): the three numeral
 * treatments, the eyebrow, and the truncation note.
 *
 * `usePulseWindow` and `PulseEcgCanvas` are both mocked -- this file tests
 * only PulseEcgHero's own rendering logic, not the data feed (covered by
 * usePulseWindow.test.ts) or the canvas render layer (covered by
 * PulseEcgCanvas.test.tsx).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PulseEcgHero from "./PulseEcgHero";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import type { EcgFeedState } from "@/components/PulseEcgCanvas";
import type { CountState } from "@/hooks/usePulseWindow";

const mockUsePulseWindow = vi.fn();

vi.mock("@/hooks/usePulseWindow", () => ({
  usePulseWindow: () => mockUsePulseWindow(),
}));

vi.mock("@/components/PulseEcgCanvas", () => ({
  PulseEcgCanvas: () => <div data-testid="pulse-ecg-canvas" />,
}));

function setState(overrides: {
  countState: CountState;
  liveCount?: number | null;
  backfillTruncated?: boolean;
  feedState?: EcgFeedState;
}) {
  mockUsePulseWindow.mockReturnValue({
    blips: [],
    feedState: overrides.feedState ?? "idle",
    liveCount: overrides.liveCount ?? null,
    countState: overrides.countState,
    backfillTruncated: overrides.backfillTruncated ?? false,
  });
}

describe("PulseEcgHero", () => {
  it("renders the eyebrow text exactly 'PULSE / 60s'", () => {
    setState({ countState: "unavailable" });
    render(<PulseEcgHero />);
    expect(screen.getByText("PULSE / 60s")).toBeInTheDocument();
  });

  it("ready: shows the digits", () => {
    setState({ countState: "ready", liveCount: 42 });
    render(<PulseEcgHero />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("loading: shows a numeral-shaped skeleton -- never the word 'Loading', a zero, or a dash", () => {
    setState({ countState: "loading", liveCount: null });
    const { container } = render(<PulseEcgHero />);
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("unavailable: shows METRIC_STATE_COPY.unavailable.label", () => {
    setState({ countState: "unavailable" });
    render(<PulseEcgHero />);
    expect(screen.getByText(METRIC_STATE_COPY.unavailable.label)).toBeInTheDocument();
  });

  it("backfillTruncated=true renders the note and data-backfill-truncated='true'", () => {
    setState({ countState: "ready", liveCount: 1, backfillTruncated: true });
    const { container } = render(<PulseEcgHero />);
    expect(screen.getByText(/backfill capped/)).toBeInTheDocument();
    expect(container.querySelector('[data-backfill-truncated="true"]')).not.toBeNull();
  });

  it("backfillTruncated=false renders neither the note nor data-backfill-truncated='true'", () => {
    setState({ countState: "ready", liveCount: 1, backfillTruncated: false });
    const { container } = render(<PulseEcgHero />);
    expect(screen.queryByText(/backfill capped/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-backfill-truncated="true"]')).toBeNull();
  });

  it("the truncation flag does not change which numeral treatment renders for the same countState", () => {
    setState({ countState: "ready", liveCount: 7, backfillTruncated: true });
    const first = render(<PulseEcgHero />);
    expect(screen.getByText("7")).toBeInTheDocument();
    first.unmount();

    setState({ countState: "ready", liveCount: 7, backfillTruncated: false });
    render(<PulseEcgHero />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
