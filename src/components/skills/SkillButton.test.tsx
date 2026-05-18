import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillButton } from "./SkillButton";

describe("SkillButton", () => {
  const defaultProps = {
    displayName: "NDA Generator",
    description: "Generate non-disclosure agreements",
    onLaunch: vi.fn(),
  };

  it("renders skill name and description", () => {
    render(<SkillButton {...defaultProps} />);
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.getByText("Generate non-disclosure agreements")).toBeInTheDocument();
  });

  it("calls onLaunch when clicked", () => {
    const onLaunch = vi.fn();
    render(<SkillButton {...defaultProps} onLaunch={onLaunch} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it("renders without description", () => {
    render(<SkillButton displayName="Test" onLaunch={vi.fn()} />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
