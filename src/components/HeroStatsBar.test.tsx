import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import HeroStatsBar from "./HeroStatsBar";

// Mock all external dependencies

vi.mock("../hooks/useHeroStats", () => ({
  useHeroStats: () => ({
    activeSessions: 3,
    runningAgents: 1,
    errorRate: 5,
    errorsThisHour: 2,
    eventsThisHour: 40,
    eventSparkline: Array(12).fill(3),
    activeAlerts: 0,
    criticalAlerts: 0,
    errorAlerts: 0,
    hourlyCost: 0.05,
    hourlyTokens: 1000,
    costSparkline: Array(12).fill(0.004),
    knownTools: 8,
    securityEvents: 0,
    health: "green" as const,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    // AnimatedNumber passes a MotionValue as children — unwrap it via .get() if needed
    span: ({ children, ...rest }: any) => {
      const text = children && typeof children === "object" && typeof children.get === "function"
        ? String(children.get())
        : children;
      return <span {...rest}>{text}</span>;
    },
  },
  useReducedMotion: () => false,
  useMotionValue: (v: number) => ({ set: vi.fn(), get: () => v }),
  useSpring: (v: any) => v,
  useTransform: (_v: any, fn: any) => ({ get: () => fn(0) }),
}));

describe("HeroStatsBar", () => {
  it("renders without crash", () => {
    const { container } = render(<HeroStatsBar />);
    expect(container.querySelector(".grid")).not.toBeNull();
  });

  it("renders 7 KPI tiles", () => {
    const { container } = render(<HeroStatsBar />);
    // Each tile has data-accent attribute
    const tiles = container.querySelectorAll("[data-accent]");
    expect(tiles.length).toBe(7);
  });

  it("tiles with thresholds have data-tone attribute when value triggers tone", () => {
    const { container } = render(<HeroStatsBar />);
    // Error Rate tile: value=5, threshold={ok:10, warn:20} → 5 <= 10 → tone "good"
    const goodToneEls = container.querySelectorAll('[data-tone="good"]');
    expect(goodToneEls.length).toBeGreaterThan(0);
  });

  it("tiles without thresholds do NOT have data-tone attribute", () => {
    const { container } = render(<HeroStatsBar />);
    // Sessions tile (first tile, accent="activity") has no threshold → no data-tone
    const sessionsTile = container.querySelector('[data-accent="activity"]');
    expect(sessionsTile).not.toBeNull();
    expect(sessionsTile?.hasAttribute("data-tone")).toBe(false);
  });

  it("tiles have min-h-[72px] class", () => {
    const { container } = render(<HeroStatsBar />);
    const tilesWithMinH = container.querySelectorAll(".min-h-\\[72px\\]");
    expect(tilesWithMinH.length).toBe(7);
  });

  it("tiles have relative and overflow-hidden classes", () => {
    const { container } = render(<HeroStatsBar />);
    const tiles = container.querySelectorAll("[data-accent]");
    tiles.forEach((tile) => {
      expect(tile.classList.contains("relative")).toBe(true);
      expect(tile.classList.contains("overflow-hidden")).toBe(true);
    });
  });

  it("tiles render SVG elements (BackgroundSparkline)", () => {
    const { container } = render(<HeroStatsBar />);
    const svgs = container.querySelectorAll("[data-accent] svg");
    expect(svgs.length).toBe(7);
  });

  it("tile inline styles contain color-mix for backgroundColor", () => {
    const { container } = render(<HeroStatsBar />);
    const tile = container.querySelector("[data-accent]") as HTMLElement;
    expect(tile.style.backgroundColor).toContain("color-mix");
  });

  it("tile inline styles contain color-mix for borderColor", () => {
    const { container } = render(<HeroStatsBar />);
    const tile = container.querySelector("[data-accent]") as HTMLElement;
    expect(tile.style.borderColor).toContain("color-mix");
  });

  it("outer container is unchanged (bg-card border rounded-xl p-4)", () => {
    const { container } = render(<HeroStatsBar />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.classList.contains("bg-card")).toBe(true);
    expect(outer.classList.contains("rounded-xl")).toBe(true);
    expect(outer.classList.contains("p-4")).toBe(true);
  });
});
