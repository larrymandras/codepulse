import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QuickDeck } from "./QuickDeck";
import { DORMANT_ORIGIN } from "@/lib/skills";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skills = [
  { name: "gsd-code-review", displayName: "Code Review", categoryIcon: "📋", origins: ["claude-code"], useCount: 11, favorite: false },
  { name: "legal-nda", displayName: "NDA", categoryIcon: "⚖️", origins: ["claude-code"], useCount: 3, favorite: true, command: "/legal nda <file>" },
  { name: "cold-thing", displayName: "Cold", categoryIcon: "⚡", origins: [DORMANT_ORIGIN], useCount: 99, favorite: true },
  { name: "never-used", displayName: "Never", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false },
];

const noop = () => {};

describe("QuickDeck", () => {
  it("pins favorites first, excludes dormant and never-used non-favorites", () => {
    render(<QuickDeck skills={skills} onUse={noop} onOpenInChat={noop} onToggleFavorite={noop} />);
    const chips = screen.getAllByTestId("deck-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("/legal nda");
    expect(chips[1]).toHaveTextContent("/gsd-code-review");
    expect(screen.queryByText(/cold-thing/)).toBeNull();
  });

  it("copies the invocation and records the use on chip click", async () => {
    const onUse = vi.fn();
    render(<QuickDeck skills={skills} onUse={onUse} onOpenInChat={noop} onToggleFavorite={noop} />);
    screen.getAllByTestId("deck-chip")[1].click();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/gsd-code-review"));
    expect(onUse).toHaveBeenCalledWith("gsd-code-review");
    await waitFor(() => expect(screen.getByText("copied")).toBeTruthy());
  });

  it("says 'copy failed' when the clipboard rejects, still records the use", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const onUse = vi.fn();
    render(<QuickDeck skills={skills} onUse={onUse} onOpenInChat={noop} onToggleFavorite={noop} />);
    screen.getAllByTestId("deck-chip")[0].click();
    await waitFor(() => expect(screen.getByText("copy failed")).toBeTruthy());
    expect(onUse).toHaveBeenCalledWith("legal-nda");
  });

  it("hover actions open Chat and toggle favorite without copying", () => {
    const onOpenInChat = vi.fn();
    const onToggleFavorite = vi.fn();
    render(<QuickDeck skills={skills} onUse={noop} onOpenInChat={onOpenInChat} onToggleFavorite={onToggleFavorite} />);
    screen.getByLabelText("Open legal-nda in Chat").click();
    expect(onOpenInChat).toHaveBeenCalledWith("legal-nda");
    screen.getByLabelText("Toggle favorite legal-nda").click();
    expect(onToggleFavorite).toHaveBeenCalledWith("legal-nda");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders nothing when the deck is empty", () => {
    const { container } = render(
      <QuickDeck skills={[{ name: "a", displayName: "A", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false }]} onUse={noop} onOpenInChat={noop} onToggleFavorite={noop} />
    );
    expect(container.firstChild).toBeNull();
  });
});
