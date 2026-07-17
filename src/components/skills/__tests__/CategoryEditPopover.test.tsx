import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryEditPopover } from "../CategoryEditPopover";

const defaultProps = {
  displayName: "Project Management",
  description: "Planning and execution",
  icon: "📋",
  color: "indigo",
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onDelete: vi.fn(),
  canDelete: true,
};

function renderPopover(overrides: Partial<typeof defaultProps> & { isNew?: boolean } = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks each render so callers get fresh spies
  props.onSave = overrides.onSave ?? vi.fn();
  props.onCancel = overrides.onCancel ?? vi.fn();
  props.onDelete = overrides.onDelete ?? vi.fn();
  return render(<CategoryEditPopover {...props} />);
}

describe("CategoryEditPopover", () => {
  test("renders with pre-filled values", () => {
    renderPopover();
    expect(screen.getByDisplayValue("Project Management")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Planning and execution")).toBeInTheDocument();
    expect(screen.getByDisplayValue("📋")).toBeInTheDocument();
  });

  test("shows 'Edit Category' title by default", () => {
    renderPopover();
    expect(screen.getByText("Edit Category")).toBeInTheDocument();
  });

  test("shows 'New Category' title when isNew is true", () => {
    renderPopover({ isNew: true });
    expect(screen.getByText("New Category")).toBeInTheDocument();
  });

  test("color swatches render with inline backgroundColor styles", () => {
    renderPopover();
    const indigoSwatch = screen.getByTitle("indigo");
    expect(indigoSwatch).toHaveStyle({ backgroundColor: "#6366f1" });

    const redSwatch = screen.getByTitle("red");
    expect(redSwatch).toHaveStyle({ backgroundColor: "#ef4444" });

    const tealSwatch = screen.getByTitle("teal");
    expect(tealSwatch).toHaveStyle({ backgroundColor: "#14b8a6" });
  });

  test("renders all 15 color swatches", () => {
    renderPopover();
    const expectedColors = [
      "indigo", "red", "purple", "amber", "cyan", "emerald", "violet",
      "blue", "orange", "pink", "teal", "rose", "green", "yellow", "gray",
    ];
    for (const colorName of expectedColors) {
      expect(screen.getByTitle(colorName)).toBeInTheDocument();
    }
  });

  test("clicking a color swatch updates the selection", () => {
    renderPopover({ color: "indigo" });
    const emeraldSwatch = screen.getByTitle("emerald");

    // Before click, emerald should not have the ring class
    expect(emeraldSwatch.className).not.toContain("ring-2");

    fireEvent.click(emeraldSwatch);

    // After click, emerald should have the ring class
    expect(emeraldSwatch.className).toContain("ring-2");
    expect(emeraldSwatch.className).toContain("ring-foreground");
  });

  test("clicking an emoji quick-pick updates the icon input", () => {
    renderPopover({ icon: "" });
    const rocketBtn = screen.getByTitle("🚀");
    fireEvent.click(rocketBtn);

    const iconInput = screen.getByDisplayValue("🚀");
    expect(iconInput).toBeInTheDocument();
  });

  test("Save calls onSave with all current values", () => {
    const onSave = vi.fn();
    renderPopover({ onSave, displayName: "Legal", description: "Contracts", icon: "⚖️", color: "red" });

    // Change display name
    fireEvent.change(screen.getByDisplayValue("Legal"), {
      target: { value: "Legal & Compliance" },
    });

    // Change color
    fireEvent.click(screen.getByTitle("purple"));

    // Pick an emoji
    fireEvent.click(screen.getByTitle("📦"));

    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      displayName: "Legal & Compliance",
      description: "Contracts",
      icon: "📦",
      color: "purple",
    });
  });

  test("Delete button is not rendered when canDelete is false", () => {
    renderPopover({ canDelete: false });
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  test("Delete button is enabled when canDelete is true", () => {
    renderPopover({ canDelete: true });
    const deleteBtn = screen.getByText("Delete");
    expect(deleteBtn).not.toBeDisabled();
  });

  test("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderPopover({ onCancel });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("calls onDelete when Delete is clicked", () => {
    const onDelete = vi.fn();
    renderPopover({ onDelete, canDelete: true });
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
