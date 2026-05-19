import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "../ViewToggle";

describe("ViewToggle", () => {
  test("renders grid and list buttons", () => {
    render(<ViewToggle view="grid" onChange={vi.fn()} />);
    expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    expect(screen.getByTitle("List view")).toBeInTheDocument();
  });

  test("highlights grid button when view is grid", () => {
    render(<ViewToggle view="grid" onChange={vi.fn()} />);
    const gridBtn = screen.getByTitle("Grid view");
    expect(gridBtn.className).toContain("bg-indigo");
  });

  test("calls onChange with list when list button clicked", () => {
    const onChange = vi.fn();
    render(<ViewToggle view="grid" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("List view"));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  test("calls onChange with grid when grid button clicked", () => {
    const onChange = vi.fn();
    render(<ViewToggle view="list" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Grid view"));
    expect(onChange).toHaveBeenCalledWith("grid");
  });
});
