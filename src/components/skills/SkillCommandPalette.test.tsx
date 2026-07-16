import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SkillCommandPalette } from "./SkillCommandPalette";

// cmdk calls scrollIntoView on selection; jsdom has no layout. cmdk also
// requires ResizeObserver, which jsdom does not implement — polyfill both,
// matching the precedent in src/components/__tests__/CommandPalette.test.tsx.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  }
});

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skills = [
  { name: "legal-nda", displayName: "NDA Generator", description: "Generate NDAs", overrideDescription: null, categoryName: "legal", categoryIcon: "⚖️", favorite: true, origins: ["claude-code"], useCount: 5 },
  { name: "gsd-plan-phase", displayName: "Plan Phase", description: "Create detailed plans", overrideDescription: null, categoryName: "gsd", categoryIcon: "📋", favorite: false, origins: ["claude-code"], useCount: 10 },
  { name: "hidden-one", displayName: "Hidden", description: null, overrideDescription: null, categoryName: null, categoryIcon: "⚡", favorite: false, origins: ["claude-code"], hidden: true },
];

const categories = [
  { name: "legal", displayName: "Legal" },
  { name: "gsd", displayName: "Project Management" },
];

function renderPalette(open = true) {
  const onOpenChange = vi.fn();
  const onRecordUse = vi.fn();
  const onOpenInChat = vi.fn();
  render(
    <SkillCommandPalette
      open={open}
      onOpenChange={onOpenChange}
      skills={skills}
      categories={categories}
      onRecordUse={onRecordUse}
      onOpenInChat={onOpenInChat}
    />
  );
  return { onOpenChange, onRecordUse, onOpenInChat };
}

describe("SkillCommandPalette", () => {
  it("Ctrl+K toggles the palette", () => {
    const { onOpenChange } = renderPalette(false);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("lists favorites group first and hides hidden skills", () => {
    renderPalette();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getAllByText("NDA Generator").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("typing filters to matching skills", async () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), { target: { value: "plan" } });
    await waitFor(() => expect(screen.queryByText("NDA Generator")).toBeNull());
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
  });

  it("selecting an item copies its invocation, records use, shows feedback", async () => {
    const { onRecordUse } = renderPalette();
    fireEvent.click(screen.getByText("Plan Phase"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/gsd-plan-phase"));
    expect(onRecordUse).toHaveBeenCalledWith("gsd-plan-phase");
    await waitFor(() => expect(screen.getByText(/\/gsd-plan-phase copied/)).toBeTruthy());
  });

  it("Ctrl+Enter opens the highlighted skill in Chat and closes", () => {
    const { onOpenInChat, onOpenChange } = renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), { target: { value: "plan" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Search skills..."), { key: "Enter", ctrlKey: true });
    expect(onOpenInChat).toHaveBeenCalledWith("gsd-plan-phase");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
