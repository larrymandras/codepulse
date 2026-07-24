/**
 * SkillCommandDeck test (control-surface redesign) — the right-rail favorites
 * dashboard. Derives four cards purely from the skills list. RunTargetChooser
 * needs SkillLaunchProvider (context) + a router (useNavigate); ForgeLaunchModal
 * is stubbed, mirroring QuickDeck.test.tsx's harness.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SkillCommandDeck, type DeckSkill } from "./SkillCommandDeck";
import { SkillLaunchProvider } from "./SkillLaunchProvider";

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));

vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

const skill = (over: Partial<DeckSkill> & { name: string; displayName: string }): DeckSkill => ({
  favorite: false,
  origins: ["claude-code"],
  ...over,
});

function renderDeck(skills: DeckSkill[]) {
  return render(
    <MemoryRouter>
      <SkillLaunchProvider>
        <SkillCommandDeck skills={skills} onToggleFavorite={vi.fn()} />
      </SkillLaunchProvider>
    </MemoryRouter>
  );
}

describe("SkillCommandDeck", () => {
  it("renders the four dashboard cards from the skills list", () => {
    renderDeck([
      skill({ name: "gsd-code-review", displayName: "Code Review", favorite: true, useCount: 56 }),
      skill({ name: "gsd-quick", displayName: "Quick", useCount: 16, lastUsedAt: Date.now() - 120000 }),
      skill({ name: "fresh-skill", displayName: "Fresh Display", discoveredAt: 9_999_999 }),
    ]);

    expect(screen.getByRole("heading", { name: "Command Deck" })).toBeInTheDocument();
    expect(screen.getByText("Pinned favorites")).toBeInTheDocument();
    expect(screen.getByText("Most used")).toBeInTheDocument();
    expect(screen.getByText("Recently used")).toBeInTheDocument();
    expect(screen.getByText("Recently added")).toBeInTheDocument();

    // Favorites card shows the display label; most-used shows the invocation.
    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("/gsd-code-review")).toBeInTheDocument();
  });

  it("recently-added shows the skill NAME (slug), never the displayName — no collision with the list", () => {
    renderDeck([skill({ name: "fresh-skill", displayName: "Fresh Display", discoveredAt: 9_999_999 })]);
    // Only the recently-added card renders it (useCount 0, not favorite, no lastUsedAt).
    expect(screen.getByText("fresh-skill")).toBeInTheDocument();
    expect(screen.queryByText("Fresh Display")).not.toBeInTheDocument();
  });

  it("renders nothing when no skill carries any usage / favorite / recency signal", () => {
    renderDeck([
      skill({ name: "a", displayName: "A" }),
      skill({ name: "b", displayName: "B" }),
    ]);
    // The deck returns null (the only DOM is the provider's stubbed modal).
    expect(screen.queryByText("Command Deck")).not.toBeInTheDocument();
    expect(screen.queryByText("Pinned favorites")).not.toBeInTheDocument();
    expect(screen.queryByText("Recently added")).not.toBeInTheDocument();
  });

  it("excludes dormant skills from favorites and most-used", () => {
    renderDeck([
      skill({
        name: "old",
        displayName: "Old",
        favorite: true,
        useCount: 99,
        origins: ["claude-code:available"], // dormant
      }),
    ]);
    // Dormant favorite/most-used are excluded; with no other signal the deck is empty.
    expect(screen.queryByText("Command Deck")).not.toBeInTheDocument();
  });
});
