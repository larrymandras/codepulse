/**
 * RunAstridrPopover test (Phase 99 Plan 03, LAUNCH-03, D-07/D-08/D-09/D-14a).
 *
 * Asserts the persona-picker + arg-capture contract:
 *  - Exactly 3 persona options sourced from PROFILES, correct default selected
 *  - Selecting a persona forwards it on submit; default is defaultProfile ?? "personal"
 *  - Escape / close submits nothing (D-05)
 *  - Honesty guard: no "answered as {persona}" copy anywhere (D-09/D-14a)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RunAstridrPopover from "./RunAstridrPopover";
import { PROFILES } from "@/lib/profiles";

// Radix UI Popover uses ResizeObserver internally; jsdom doesn't provide it
// (same shim as src/components/kg/KGViewsPopover.test.tsx).
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderPopover(
  overrides: Partial<React.ComponentProps<typeof RunAstridrPopover>> = {}
) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <RunAstridrPopover
      open={true}
      onOpenChange={onOpenChange}
      displayName="GSD Plan Phase"
      invocation="/gsd-plan-phase "
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...utils, onOpenChange, onSubmit };
}

function getInput() {
  return screen.getByLabelText(/Run GSD Plan Phase invocation/i) as HTMLInputElement;
}

function getSendButton() {
  return screen.getByRole("button", { name: "Send" });
}

function getTab(label: string) {
  return screen.getByRole("tab", { name: new RegExp(label, "i") });
}

describe("RunAstridrPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: renders exactly 3 persona options from PROFILES with role=tab; default is aria-selected", () => {
    renderPopover();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(PROFILES.map((p) => p.label).sort()).toEqual(
      ["Personal", "Business", "Consulting"].sort()
    );
    const personalTab = getTab("Personal");
    expect(personalTab).toHaveAttribute("aria-selected", "true");
    expect(getTab("Business")).toHaveAttribute("aria-selected", "false");
    expect(getTab("Consulting")).toHaveAttribute("aria-selected", "false");
  });

  it("Test 1b: honors an explicit defaultProfile as the initially-selected tab", () => {
    renderPopover({ defaultProfile: "business" });
    expect(getTab("Business")).toHaveAttribute("aria-selected", "true");
    expect(getTab("Personal")).toHaveAttribute("aria-selected", "false");
  });

  it("Test 2: selecting Business then Enter calls onSubmit with the business profile", () => {
    const { onSubmit } = renderPopover({ invocation: "/skill " });
    fireEvent.click(getTab("Business"));
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("/skill", "business");
  });

  it("Test 3: default (no persona click) + Send calls onSubmit with the personal profile", () => {
    const { onSubmit } = renderPopover({ invocation: "/skill " });
    fireEvent.click(getSendButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("/skill", "personal");
  });

  it("Test 4: Escape calls neither onSubmit — only onOpenChange(false)", () => {
    const { onSubmit, onOpenChange } = renderPopover({ invocation: "/skill " });
    fireEvent.click(getTab("Consulting"));
    fireEvent.keyDown(getInput(), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 5: no rendered text ever claims a persona-voice override (D-09/D-14a honesty guard)", () => {
    renderPopover();
    const container = document.body;
    expect(container.textContent).not.toMatch(/answer(ed|ing) as/i);
    expect(container.textContent).not.toMatch(/as (personal|business|consulting)/i);
  });

  async function readSource(): Promise<string> {
    const [fs, path] = await Promise.all([
      import("fs/promises"),
      import("path"),
    ]);
    return fs.readFile(
      path.resolve(process.cwd(), "src/components/skills/RunAstridrPopover.tsx"),
      "utf-8"
    );
  }

  it("acceptance: imports PROFILES from @/lib/profiles (no inline persona array, D-08)", async () => {
    const source = await readSource();
    expect(source).toMatch(/from "@\/lib\/profiles"/);
  });

  it("acceptance: does not import useAstridrChat/useNavigate/recordSkillLaunch (D-05 pure capture)", async () => {
    const source = await readSource();
    // Check actual usage (imports/calls), not this file's own doc-comment
    // prose describing what it deliberately does NOT do.
    const codeLines = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"));
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/useAstridrChat/);
    expect(code).not.toMatch(/useNavigate/);
    expect(code).not.toMatch(/recordSkillLaunch/);
  });

  it("acceptance: persona dots read --status-ok/--status-warn/--status-info via CSS var", async () => {
    const source = await readSource();
    expect(source).toMatch(/var\(\$\{p\.accentVar\}\)/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}/); // no hardcoded hex
  });
});
