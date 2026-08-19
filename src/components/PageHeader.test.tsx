import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Zap } from "lucide-react";
import { PageHeader } from "./PageHeader";

const SOURCE_PATH = path.resolve(__dirname, "PageHeader.tsx");

function readSourceWithoutComments(): string {
  const raw = readFileSync(SOURCE_PATH, "utf-8");
  // Strip block comments and line comments so the file's own explanatory
  // prose cannot self-invalidate the no-hardcoded-colour / no-app-chrome
  // gates below (122-CONTEXT.md D-17 boundary with Phase 124).
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("PageHeader", () => {
  // BACKWARD-COMPATIBILITY CONTROL (122-11 Task 1 acceptance criteria):
  // renders with ONLY the four pre-existing props and asserts the title,
  // icon and actions are present AND that no eyebrow/subtitle element
  // exists -- without the second half a component that always renders an
  // empty eyebrow would pass this test.
  it("with only the four pre-existing props, renders title/icon/actions and no eyebrow or subtitle", () => {
    render(
      <PageHeader
        title="Legacy Page"
        icon={Zap}
        actions={<button type="button">Do Thing</button>}
      />
    );
    expect(screen.getByText("Legacy Page")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Do Thing" })).toBeTruthy();
    // No eyebrow or subtitle text node should exist anywhere in the tree.
    expect(screen.queryByTestId("page-header-eyebrow")).toBeNull();
    expect(screen.queryByTestId("page-header-subtitle")).toBeNull();
  });

  it("renders an 11px mono uppercase eyebrow above the title when supplied", () => {
    render(<PageHeader title="Analytics" eyebrow="Insights" />);
    const eyebrow = screen.getByTestId("page-header-eyebrow");
    expect(eyebrow.textContent).toBe("Insights");
    expect(eyebrow.className).toContain("text-[11px]");
    expect(eyebrow.className).toContain("font-mono");
    expect(eyebrow.className).toContain("uppercase");
  });

  it("renders a subtitle below the title in muted ink when supplied", () => {
    render(<PageHeader title="Analytics" subtitle="Last 30 days" />);
    const subtitle = screen.getByTestId("page-header-subtitle");
    expect(subtitle.textContent).toBe("Last 30 days");
    expect(subtitle.className).toContain("text-muted-foreground");
  });

  it("with neither eyebrow nor subtitle, no stray empty eyebrow/subtitle elements are present", () => {
    render(<PageHeader title="Bare" />);
    expect(screen.queryByTestId("page-header-eyebrow")).toBeNull();
    expect(screen.queryByTestId("page-header-subtitle")).toBeNull();
  });

  it("renders no hex colour literal and no raw palette class in its source", () => {
    const source = readSourceWithoutComments();
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/-(slate|zinc|gray|neutral|stone)-[0-9]/);
  });

  it("renders none of Phase 124's app chrome (breadcrumb, command bar, E-Stop)", () => {
    const source = readSourceWithoutComments();
    expect(source.toLowerCase()).not.toMatch(/breadcrumb/);
    expect(source.toLowerCase()).not.toMatch(/command-bar|commandbar/);
    expect(source.toLowerCase()).not.toMatch(/e-stop|estop/);
  });
});
