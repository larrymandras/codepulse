/**
 * OnboardingGuide tests — the modal must never trap the operator.
 *
 * Regression for the Phase 84 UAT finding (onboarding-modal-blocks-app): the
 * full-viewport modal had no X / Escape / backdrop dismiss, so a fresh browser
 * (no localStorage flag) was locked out of the whole app ("can't click").
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OnboardingGuide from "./OnboardingGuide";

const STORAGE_KEY = "codepulse_onboarding_complete";

describe("OnboardingGuide", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows on a fresh visit (no localStorage flag)", () => {
    render(<OnboardingGuide />);
    expect(screen.getByText("Welcome to CodePulse")).toBeDefined();
  });

  it("does not render once the flag is set", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    render(<OnboardingGuide />);
    expect(screen.queryByText("Welcome to CodePulse")).toBeNull();
  });

  it("X button dismisses, sets the flag, and removes the modal", () => {
    render(<OnboardingGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Close onboarding" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(screen.queryByText("Welcome to CodePulse")).toBeNull();
  });

  it("Escape dismisses and sets the flag", () => {
    render(<OnboardingGuide />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(screen.queryByText("Welcome to CodePulse")).toBeNull();
  });

  it("backdrop click dismisses, but a click inside the card does not", () => {
    const { container } = render(<OnboardingGuide />);
    const backdrop = container.firstChild as HTMLElement;

    // Click inside the card (the heading) — must NOT dismiss.
    fireEvent.click(screen.getByText("Welcome to CodePulse"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText("Welcome to CodePulse")).toBeDefined();

    // Click the backdrop itself — dismisses.
    fireEvent.click(backdrop);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(screen.queryByText("Welcome to CodePulse")).toBeNull();
  });
});
