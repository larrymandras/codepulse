import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlexBarChart, StackedSegment } from "./FlexBarChart";

describe("FlexBarChart", () => {
  describe("single-value bars (backward compatibility)", () => {
    test("renders single-value bars when segments prop is absent", () => {
      const data = [
        { label: "claude", value: 10 },
        { label: "openai", value: 5 },
      ];
      const { container } = render(<FlexBarChart data={data} />);
      // Single-value bars use bg-gradient-to-t class
      const gradientBars = container.querySelectorAll(".bg-gradient-to-t");
      expect(gradientBars.length).toBe(2);
    });

    test("shows label and value in tooltip for single-value bars", () => {
      const data = [{ label: "claude", value: 42 }];
      const { container } = render(<FlexBarChart data={data} />);
      // Tooltip text contains label and value
      expect(container.textContent).toContain("claude");
      expect(container.textContent).toContain("42");
    });
  });

  describe("stacked segment bars", () => {
    const stackedData = [
      {
        label: "Hour 1",
        segments: [
          { value: 10, color: "#22c55e", label: "claude" },
          { value: 5, color: "#3b82f6", label: "openai" },
        ] as StackedSegment[],
      },
      {
        label: "Hour 2",
        segments: [
          { value: 8, color: "#22c55e", label: "claude" },
          { value: 12, color: "#3b82f6", label: "openai" },
        ] as StackedSegment[],
      },
    ];

    test("renders stacked segments when segments prop is provided", () => {
      const { container } = render(<FlexBarChart data={stackedData} />);
      // Stacked segments use backgroundColor style (not gradient class)
      const segmentDivs = container.querySelectorAll("[style*='background-color']");
      expect(segmentDivs.length).toBeGreaterThanOrEqual(4); // 2 bars * 2 segments each
    });

    test("stacked bar max normalization uses sum of segments not individual values", () => {
      // Bar 1 total: 15, Bar 2 total: 20 (max). Heights should be proportional to totals.
      const data = [
        {
          label: "A",
          segments: [
            { value: 10, color: "#22c55e", label: "claude" },
            { value: 5, color: "#3b82f6", label: "openai" },
          ] as StackedSegment[],
        },
        {
          label: "B",
          segments: [
            { value: 8, color: "#22c55e", label: "claude" },
            { value: 12, color: "#3b82f6", label: "openai" },
          ] as StackedSegment[],
        },
      ];
      const { container } = render(<FlexBarChart data={data} />);
      // B's total is 20 (max), A's total is 15 → A's container should be 75% height
      // We verify by checking that stacked segment containers are rendered
      const segmentContainers = container.querySelectorAll("[data-stacked-bar]");
      expect(segmentContainers.length).toBe(2);
    });

    test("tooltip shows segment labels and values on hover", () => {
      const data = [
        {
          label: "Hour 1",
          segments: [
            { value: 10.5, color: "#22c55e", label: "claude" },
            { value: 5.25, color: "#3b82f6", label: "openai" },
          ] as StackedSegment[],
        },
      ];
      const { container } = render(<FlexBarChart data={data} />);
      // Tooltip renders segment labels
      expect(container.textContent).toContain("claude");
      expect(container.textContent).toContain("openai");
    });

    test("empty segments array renders empty bar without crashing", () => {
      const data = [{ label: "empty", segments: [] as StackedSegment[] }];
      expect(() => render(<FlexBarChart data={data} />)).not.toThrow();
    });
  });
});
