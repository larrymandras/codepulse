import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Network } from "lucide-react";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders an h1 with the F7 typography contract", () => {
    const { container } = render(<PageHeader title="Build Progress" />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.className).toContain("text-2xl");
    expect(h1?.className).toContain("font-bold");
    expect(h1?.className).toContain("text-foreground");
  });

  it("renders the provided title text content", () => {
    render(<PageHeader title="Build Progress" />);
    expect(screen.getByText("Build Progress")).toBeInTheDocument();
  });

  it("renders an actions node when provided", () => {
    render(<PageHeader title="Tasks" actions={<button>By Agent</button>} />);
    expect(screen.getByText("By Agent")).toBeInTheDocument();
  });

  it("renders an icon svg when an icon prop is provided", () => {
    const { container } = render(<PageHeader title="Knowledge Graph" icon={Network} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("lets a caller-passed margin override replace the default mb-4 (twMerge, WR-01)", () => {
    const { container } = render(<PageHeader title="Config" className="mb-0" />);
    const root = container.firstChild as HTMLElement;
    // twMerge must DROP the conflicting default — keeping both would let
    // mb-4 win via CSS emission order regardless of class order.
    expect(root.className).toContain("mb-0");
    expect(root.className).not.toContain("mb-4");
  });
});
