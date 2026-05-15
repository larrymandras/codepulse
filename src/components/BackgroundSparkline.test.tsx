import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundSparkline, catmullRomPath, flatSparkline } from "./BackgroundSparkline";

vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
  },
  useReducedMotion: () => false,
}));

describe("catmullRomPath", () => {
  it("returns empty string for fewer than 2 points", () => {
    expect(catmullRomPath([])).toBe("");
    expect(catmullRomPath([{ x: 0, y: 0 }])).toBe("");
  });

  it("produces a valid SVG d string starting with M for 2+ points", () => {
    const pts = [
      { x: 0, y: 10 },
      { x: 10, y: 5 },
      { x: 20, y: 15 },
    ];
    const d = catmullRomPath(pts);
    expect(d).toMatch(/^M /);
    expect(d).toContain("C ");
  });

  it("produces 11 C commands for 12-point input", () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ x: i * 8, y: Math.sin(i) * 20 + 30 }));
    const d = catmullRomPath(pts);
    const cCount = (d.match(/ C /g) || []).length;
    expect(cCount).toBe(11);
  });

  it("produces no NaN values for flat (identical y) input", () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ x: i * 8, y: 36 }));
    const d = catmullRomPath(pts);
    expect(d).not.toContain("NaN");
  });
});

describe("flatSparkline", () => {
  it("produces 12 elements by default", () => {
    expect(flatSparkline(5)).toHaveLength(12);
  });

  it("fills with the given value", () => {
    const result = flatSparkline(42);
    expect(result.every((v) => v === 42)).toBe(true);
  });

  it("handles zero without NaN", () => {
    const result = flatSparkline(0);
    expect(result.every((v) => v === 0)).toBe(true);
  });

  it("accepts custom length", () => {
    expect(flatSparkline(1, 6)).toHaveLength(6);
  });
});

describe("BackgroundSparkline", () => {
  it("renders an SVG element", () => {
    const { container } = render(
      <BackgroundSparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} accentColor="oklch(0.70 0.15 80)" />
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders two path elements (stroke + fill area)", () => {
    const { container } = render(
      <BackgroundSparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} accentColor="oklch(0.70 0.15 80)" />
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });

  it("renders with flat sparkline data (all same value) without crash", () => {
    const { container } = render(
      <BackgroundSparkline data={flatSparkline(5)} accentColor="oklch(0.70 0.15 142)" />
    );
    expect(container.querySelector("svg")).not.toBeNull();
    const paths = container.querySelectorAll("path");
    paths.forEach((path) => {
      expect(path.getAttribute("d")).not.toContain("NaN");
    });
  });

  it("renders with all-zero data without NaN", () => {
    const { container } = render(
      <BackgroundSparkline data={flatSparkline(0)} accentColor="oklch(0.70 0.15 142)" />
    );
    const paths = container.querySelectorAll("path");
    paths.forEach((path) => {
      expect(path.getAttribute("d")).not.toContain("NaN");
    });
  });

  it("SVG has aria-hidden attribute", () => {
    const { container } = render(
      <BackgroundSparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} accentColor="oklch(0.70 0.15 80)" />
    );
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders linearGradient defs element", () => {
    const { container } = render(
      <BackgroundSparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} accentColor="oklch(0.70 0.15 80)" />
    );
    expect(container.querySelector("linearGradient")).not.toBeNull();
  });
});
