import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryEditPopover } from "../CategoryEditPopover";

describe("CategoryEditPopover", () => {
  test("renders with pre-filled values", () => {
    render(
      <CategoryEditPopover
        displayName="Project Management"
        description="Planning and execution"
        icon="📋"
        color="indigo"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={true}
      />
    );
    expect(
      screen.getByDisplayValue("Project Management")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("📋")).toBeInTheDocument();
  });

  test("calls onSave with updated values", () => {
    const onSave = vi.fn();
    render(
      <CategoryEditPopover
        displayName="GSD"
        description=""
        icon="📋"
        color="indigo"
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={false}
      />
    );
    const nameInput = screen.getByDisplayValue("GSD");
    fireEvent.change(nameInput, {
      target: { value: "Project Management" },
    });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Project Management" })
    );
  });

  test("disables delete button when canDelete is false", () => {
    render(
      <CategoryEditPopover
        displayName="Legal"
        description=""
        icon="⚖️"
        color="red"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={false}
      />
    );
    const deleteBtn = screen.getByText("Delete");
    expect(deleteBtn).toBeDisabled();
  });
});
