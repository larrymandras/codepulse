import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewSkillsBanner } from "../NewSkillsBanner";

describe("NewSkillsBanner", () => {
  test("renders count of new skills", () => {
    render(
      <NewSkillsBanner count={5} onReview={vi.fn()} onAcceptAll={vi.fn()} />
    );
    expect(
      screen.getByText(/5 new skills auto-categorized/)
    ).toBeInTheDocument();
  });

  test("returns null when count is 0", () => {
    const { container } = render(
      <NewSkillsBanner count={0} onReview={vi.fn()} onAcceptAll={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("calls onReview when Review button clicked", () => {
    const onReview = vi.fn();
    render(
      <NewSkillsBanner count={3} onReview={onReview} onAcceptAll={vi.fn()} />
    );
    fireEvent.click(screen.getByText("[ Review ]"));
    expect(onReview).toHaveBeenCalled();
  });

  test("calls onAcceptAll when Accept All clicked", () => {
    const onAcceptAll = vi.fn();
    render(
      <NewSkillsBanner
        count={3}
        onReview={vi.fn()}
        onAcceptAll={onAcceptAll}
      />
    );
    fireEvent.click(screen.getByText("[ Accept All ]"));
    expect(onAcceptAll).toHaveBeenCalled();
  });
});
