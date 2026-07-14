import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { SkillCollectionPicker } from "./SkillCollectionPicker";
import type { ScanState } from "@/hooks/useGithubTreeScan";

describe("SkillCollectionPicker", () => {
  it("auto-selects without looping when the parent re-renders with a fresh scanState object each render (CR-01 regression)", () => {
    // Reproduces the real useGithubTreeScan contract: the parent re-renders
    // on every onSelectionChange (state update) and hands the picker a NEW
    // scanState object identity each time. Pre-fix, the auto-select effect
    // depended on the whole scanState object and re-emitted a fresh array
    // every render — "Maximum update depth exceeded". The stable-literal
    // mocks in the rest of this file cannot catch that.
    function Harness() {
      const [selected, setSelected] = useState<string[]>([]);
      const scanState: ScanState = {
        status: "done",
        result: { skillPaths: ["skills/foo/SKILL.md"], truncated: false },
      };
      return (
        <>
          <SkillCollectionPicker
            scanState={scanState}
            onSelectionChange={setSelected}
          />
          <div data-testid="cr01-selected">{selected.join(",")}</div>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("cr01-selected")).toHaveTextContent(
      "skills/foo/SKILL.md"
    );
  });

  it("auto-selects the single discovered skill without any user click", () => {
    const scanState: ScanState = {
      status: "done",
      result: { skillPaths: ["skills/foo/SKILL.md"], truncated: false },
    };
    const onSelectionChange = vi.fn();
    render(
      <SkillCollectionPicker scanState={scanState} onSelectionChange={onSelectionChange} />
    );
    expect(onSelectionChange).toHaveBeenCalledWith(["skills/foo/SKILL.md"]);
    expect(screen.getByText(/1 skill found/i)).toBeInTheDocument();
  });

  it("checking two boxes then clicking Select all results in onSelectionChange called with ALL discovered paths", () => {
    const scanState: ScanState = {
      status: "done",
      result: {
        skillPaths: ["skills/a/SKILL.md", "skills/b/SKILL.md", "skills/c/SKILL.md"],
        truncated: false,
      },
    };
    const onSelectionChange = vi.fn();
    render(
      <SkillCollectionPicker scanState={scanState} onSelectionChange={onSelectionChange} />
    );

    expect(screen.getByText(/3 skills found/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is "Select all"; remaining are per-skill.
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const selectAll = screen.getByRole("checkbox", { name: /select all/i });
    fireEvent.click(selectAll);

    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
    expect(new Set(lastCall)).toEqual(
      new Set(["skills/a/SKILL.md", "skills/b/SKILL.md", "skills/c/SKILL.md"])
    );
  });

  it("clears checked paths when a new scan result arrives — no repo-A paths leak into repo-B selections (WR-01 regression)", () => {
    const repoA: ScanState = {
      status: "done",
      result: {
        skillPaths: ["a1/SKILL.md", "a2/SKILL.md", "a3/SKILL.md"],
        truncated: false,
      },
    };
    const repoB: ScanState = {
      status: "done",
      result: {
        skillPaths: ["b1/SKILL.md", "b2/SKILL.md"],
        truncated: false,
      },
    };
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <SkillCollectionPicker scanState={repoA} onSelectionChange={onSelectionChange} />
    );

    // Check two repo-A skills.
    const boxesA = screen.getAllByRole("checkbox");
    fireEvent.click(boxesA[1]);
    fireEvent.click(boxesA[2]);

    // URL edit resets the parent's scanState, then repo B is scanned.
    rerender(
      <SkillCollectionPicker
        scanState={{ status: "idle" }}
        onSelectionChange={onSelectionChange}
      />
    );
    rerender(
      <SkillCollectionPicker scanState={repoB} onSelectionChange={onSelectionChange} />
    );

    // No box should be pre-checked from repo A.
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).not.toBeChecked();
    }

    // Toggling a repo-B box must emit ONLY repo-B paths.
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    const lastCall =
      onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
    expect(lastCall).toEqual(["b1/SKILL.md"]);
  });

  it("renders the never-disabled manual subpath fallback on scan error", () => {
    const scanState: ScanState = { status: "error", errorMessage: "network error" };
    const onSelectionChange = vi.fn();
    render(
      <SkillCollectionPicker scanState={scanState} onSelectionChange={onSelectionChange} />
    );

    const input = screen.getByLabelText(/subpath/i);
    expect(input).toBeInTheDocument();
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute("disabled");

    fireEvent.change(input, { target: { value: "skills/foo" } });
    expect(onSelectionChange).toHaveBeenCalledWith(["skills/foo"]);
  });

  it("renders the same manual fallback when done with zero skillPaths found", () => {
    const scanState: ScanState = {
      status: "done",
      result: { skillPaths: [], truncated: false },
    };
    const onSelectionChange = vi.fn();
    render(
      <SkillCollectionPicker scanState={scanState} onSelectionChange={onSelectionChange} />
    );
    const input = screen.getByLabelText(/subpath/i);
    expect(input).not.toBeDisabled();
  });

  it("renders a truncated warning when result.truncated is true", () => {
    const scanState: ScanState = {
      status: "done",
      result: { skillPaths: ["SKILL.md"], truncated: true },
    };
    const onSelectionChange = vi.fn();
    render(
      <SkillCollectionPicker scanState={scanState} onSelectionChange={onSelectionChange} />
    );
    expect(screen.getByText(/too large to fully scan/i)).toBeInTheDocument();
  });

  it("renders nothing extra during idle/scanning states", () => {
    const onSelectionChange = vi.fn();
    const { container: idleContainer } = render(
      <SkillCollectionPicker scanState={{ status: "idle" }} onSelectionChange={onSelectionChange} />
    );
    expect(idleContainer.textContent).toBe("");

    const { container: scanningContainer } = render(
      <SkillCollectionPicker
        scanState={{ status: "scanning" }}
        onSelectionChange={onSelectionChange}
      />
    );
    expect(scanningContainer.textContent).toBe("");
  });
});
