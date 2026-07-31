/**
 * Tests for WebhookStatusBadge.
 *
 * Regression origin: the badge carried its own local `relativeTime` that did
 * `Date.now() - ts`, i.e. it expected MILLISECONDS, while every producer of
 * `alerts.webhookDeliveredAt` writes epoch SECONDS. A webhook delivered seconds
 * earlier rendered as "Delivered 20645d ago" (a 1970 date). Caught live on the
 * first real budget alert at Phase 104's validation gate, 2026-07-31.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebhookStatusBadge } from "./WebhookStatusBadge";

// A fixed "now" so relative output is deterministic.
const NOW_MS = Date.UTC(2026, 6, 31, 22, 15, 0);
const NOW_SEC = NOW_MS / 1000;

afterEach(() => vi.restoreAllMocks());

function freezeClock() {
  vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
}

describe("WebhookStatusBadge — delivered timestamp units", () => {
  it("renders a just-delivered webhook as recent, NOT as a 1970 date", () => {
    freezeClock();
    // 30 seconds ago, expressed in epoch SECONDS as the schema stores it.
    render(<WebhookStatusBadge status="delivered" deliveredAt={NOW_SEC - 30} />);

    const text = screen.getByText(/Delivered/).textContent ?? "";
    expect(text).toMatch(/Delivered (just now|\d+[sm] ago)/);
    // The actual regression: a seconds value read as milliseconds produced a
    // ~20645-day diff. Anything in days here is the bug returning.
    expect(text).not.toMatch(/\d+d ago/);
    expect(text).not.toMatch(/20645/);
  });

  it("renders a genuinely old delivery in days", () => {
    freezeClock();
    render(<WebhookStatusBadge status="delivered" deliveredAt={NOW_SEC - 3 * 86400} />);
    expect(screen.getByText(/Delivered 3d ago/)).toBeInTheDocument();
  });

  it("treats the value as seconds, not milliseconds (direct unit assertion)", () => {
    freezeClock();
    // If the component treated this as ms it would compute a ~56-year age.
    const { container } = render(
      <WebhookStatusBadge status="delivered" deliveredAt={NOW_SEC - 120} />
    );
    expect(container.textContent).toContain("2m ago");
  });

  it("renders bare 'Delivered' when no timestamp is present", () => {
    freezeClock();
    render(<WebhookStatusBadge status="delivered" />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("renders nothing without a status", () => {
    const { container } = render(<WebhookStatusBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders the failed and retrying states", () => {
    const { rerender, container } = render(<WebhookStatusBadge status="failed" />);
    expect(container.textContent).toContain("Failed after 3 attempts");
    rerender(<WebhookStatusBadge status="pending" attempts={2} />);
    expect(container.textContent).toContain("Retrying (2/3)");
  });
});
