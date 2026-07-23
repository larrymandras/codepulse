/**
 * RunChatPopover test (Phase 99 Plan 03, LAUNCH-01, D-04/D-05).
 *
 * Asserts the deliberate pre-send capture contract:
 *  - Prefilled with `invocation`, cursor at end, never auto-selected
 *  - Enter / Send submit the trimmed value exactly once
 *  - Escape / close submits nothing (D-05: zero side effects)
 *  - An empty/whitespace-only value can never submit
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RunChatPopover from "./RunChatPopover";

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
  overrides: Partial<React.ComponentProps<typeof RunChatPopover>> = {}
) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <RunChatPopover
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

describe("RunChatPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: opens with the Input value === invocation, cursor at end, not auto-selected", () => {
    renderPopover({ invocation: "/gsd-plan-phase " });
    const input = getInput();
    expect(input.value).toBe("/gsd-plan-phase ");
    const end = "/gsd-plan-phase ".length;
    expect(input.selectionStart).toBe(end);
    expect(input.selectionEnd).toBe(end);
  });

  it("renders the title, helper text, and Send button copy verbatim", () => {
    renderPopover();
    expect(screen.getByText("Run GSD Plan Phase")).toBeInTheDocument();
    expect(
      screen.getByText("Press Enter to send, or add arguments first.")
    ).toBeInTheDocument();
    expect(getSendButton()).toBeInTheDocument();
  });

  it("Test 2: pressing Enter with the prefill unchanged calls onSubmit (trimmed) once", () => {
    const { onSubmit } = renderPopover({ invocation: "/skill " });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("/skill");
  });

  it("Test 3: typing args then Enter calls onSubmit with the full trimmed text", () => {
    const { onSubmit } = renderPopover({ invocation: "/skill " });
    fireEvent.change(getInput(), { target: { value: "/skill 99" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("/skill 99");
  });

  it("Test 4: clicking Send submits identically to Enter", () => {
    const { onSubmit } = renderPopover({ invocation: "/skill " });
    fireEvent.change(getInput(), { target: { value: "/skill 99" } });
    fireEvent.click(getSendButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("/skill 99");
  });

  it("closes the popover (onOpenChange(false)) after a successful submit", () => {
    const { onOpenChange } = renderPopover({ invocation: "/skill " });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 5: Escape calls neither onSubmit — only onOpenChange(false)", () => {
    const { onSubmit, onOpenChange } = renderPopover({ invocation: "/skill " });
    fireEvent.keyDown(getInput(), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 6: an empty value cannot submit — Send disabled and Enter no-ops", () => {
    const { onSubmit } = renderPopover({ invocation: "" });
    expect(getSendButton()).toBeDisabled();
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Test 6b: a whitespace-only value cannot submit", () => {
    const { onSubmit } = renderPopover({ invocation: "   " });
    expect(getSendButton()).toBeDisabled();
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("acceptance: does not import useAstridrChat/useNavigate/recordSkillLaunch (D-05 pure capture)", async () => {
    const [fs, path] = await Promise.all([
      import("fs/promises"),
      import("path"),
    ]);
    const source = await fs.readFile(
      path.resolve(process.cwd(), "src/components/skills/RunChatPopover.tsx"),
      "utf-8"
    );
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
});
