import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FactsTable, type Fact } from "../FactsTable";

const baseFacts: Fact[] = [
  {
    _id: "fact-1",
    factText: "Larry prefers dark themes",
    category: "preference",
    confidence: 0.8,
    timestamp: Date.now() / 1000,
  },
  {
    _id: "fact-2",
    factText: "CodePulse uses Convex",
    category: "architecture",
    confidence: 0.95,
    timestamp: Date.now() / 1000,
  },
];

describe("FactsTable", () => {
  it("renders one row per fact with fact text and formatted confidence", () => {
    render(
      <FactsTable
        facts={baseFacts}
        search=""
        onSearchChange={() => {}}
        category=""
        onCategoryChange={() => {}}
        categories={["preference", "architecture"]}
        sectionName="Test Facts"
      />
    );

    expect(screen.getByText("Larry prefers dark themes")).toBeInTheDocument();
    expect(screen.getByText("CodePulse uses Convex")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("renders the existing empty-state copy when facts is an empty array", () => {
    render(
      <FactsTable
        facts={[]}
        search=""
        onSearchChange={() => {}}
        category=""
        onCategoryChange={() => {}}
        categories={[]}
        sectionName="Test Facts"
      />
    );

    expect(
      screen.getByText(
        /No durable facts extracted yet\. Run a dreaming cycle to extract long-term facts from your conversation history\./
      )
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when the user types in the search input", () => {
    const onSearchChange = vi.fn();
    render(
      <FactsTable
        facts={baseFacts}
        search=""
        onSearchChange={onSearchChange}
        category=""
        onCategoryChange={() => {}}
        categories={["preference", "architecture"]}
        sectionName="Test Facts"
      />
    );

    const input = screen.getByPlaceholderText("Search facts...");
    fireEvent.change(input, { target: { value: "dark" } });
    expect(onSearchChange).toHaveBeenCalledWith("dark");
  });

  it("calls onCategoryChange when the category select changes", () => {
    const onCategoryChange = vi.fn();
    render(
      <FactsTable
        facts={baseFacts}
        search=""
        onSearchChange={() => {}}
        category=""
        onCategoryChange={onCategoryChange}
        categories={["preference", "architecture"]}
        sectionName="Test Facts"
      />
    );

    const select = screen.getByDisplayValue("All Categories");
    fireEvent.change(select, { target: { value: "preference" } });
    expect(onCategoryChange).toHaveBeenCalledWith("preference");
  });
});
