/**
 * CostBudgetsAdmin test — mocks convex/react and @/components/ui/select
 * following IntakeModal.test.tsx's established convention (Radix Select's
 * portal/pointer-capture behavior is not implemented in jsdom).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BudgetRow } from "../../convex/costBudgets";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Convex mocks ────────────────────────────────────────────────────────────
const mockCreate = vi.fn(() => Promise.resolve("newid"));
const mockUpdate = vi.fn(() => Promise.resolve());
const mockRemove = vi.fn(() => Promise.resolve());

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn((fnRef: unknown, ..._args: unknown[]) => {
    if (fnRef === "costBudgets:create") return mockCreate;
    if (fnRef === "costBudgets:update") return mockUpdate;
    if (fnRef === "costBudgets:remove") return mockRemove;
    return vi.fn();
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    costBudgets: {
      list: "costBudgets:list",
      create: "costBudgets:create",
      update: "costBudgets:update",
      remove: "costBudgets:remove",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Select mock — Radix Select doesn't render/interact in jsdom, so this
// mock swaps in plain buttons keyed by the `name` prop this component sets
// on each <Select>, matching IntakeModal.test.tsx's established pattern. ──
interface SelectCtxValue {
  onValueChange?: (v: string) => void;
  disabled?: boolean;
}
const SelectCtx = createContext<SelectCtxValue>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
    name,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
    name?: string;
  }) => (
    <SelectCtx.Provider value={{ onValueChange, disabled }}>
      <div data-testid={`select-root-${name ?? "select"}`} data-value={value}>
        {children}
      </div>
    </SelectCtx.Provider>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => {
    const { disabled } = useContext(SelectCtx);
    return (
      <button type="button" role="combobox" disabled={disabled}>
        {children}
      </button>
    );
  },
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
    const { onValueChange } = useContext(SelectCtx);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

import { useQuery } from "convex/react";
import { toast } from "sonner";
import CostBudgetsAdmin from "./CostBudgetsAdmin";

const mockUseQuery = vi.mocked(useQuery);

function budgetRow(overrides: Partial<BudgetRow> & { scope: BudgetRow["scope"] }): BudgetRow {
  return {
    _id: "b1" as unknown as BudgetRow["_id"],
    scopeKey: "",
    period: "daily",
    limit: 5,
    warnFraction: 0.8,
    unit: "usd",
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("CostBudgetsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "costBudgets:list") return [];
      return undefined;
    });
  });

  it("selecting the Quota scope switches the limit label to Limit (% of quota) and rejects 150", () => {
    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getAllByText("Add budget threshold")[0]);

    const scopeRoot = screen.getByTestId("select-root-scope");
    fireEvent.click(within(scopeRoot).getByText("Quota"));

    expect(screen.getByText("Limit (% of quota)")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. 90"), { target: { value: "150" } });
    fireEvent.click(screen.getByText("Save Threshold"));

    expect(toast.error).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("selecting the Global scope hides the scope-key field and submits scopeKey: ''", async () => {
    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getAllByText("Add budget threshold")[0]);

    // Global is the default scope on create — the scope-key field never renders.
    expect(screen.queryByPlaceholderText("e.g. claude-opus-5")).not.toBeInTheDocument();
    expect(screen.queryByTestId("select-root-scopeKey")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. 100"), { target: { value: "50" } });
    fireEvent.click(screen.getByText("Save Threshold"));

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ scope: "global", scopeKey: "" }));
  });

  it("a warnFraction of 1.2 shows a validation toast and calls no mutation", () => {
    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getAllByText("Add budget threshold")[0]);

    fireEvent.change(screen.getByPlaceholderText("e.g. 100"), { target: { value: "50" } });
    fireEvent.change(screen.getByPlaceholderText("0.8"), { target: { value: "1.2" } });
    fireEvent.click(screen.getByText("Save Threshold"));

    expect(toast.error).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("editing an existing row renders scope, scope key and period as disabled controls", () => {
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "costBudgets:list") {
        return [budgetRow({ scope: "model", scopeKey: "claude-opus-5", period: "daily" })];
      }
      return undefined;
    });

    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getByLabelText("Edit budget threshold"));

    const scopeRoot = screen.getByTestId("select-root-scope");
    expect(within(scopeRoot).getByRole("combobox")).toBeDisabled();

    const periodRoot = screen.getByTestId("select-root-period");
    expect(within(periodRoot).getByRole("combobox")).toBeDisabled();

    expect(screen.getByPlaceholderText("e.g. claude-opus-5")).toBeDisabled();
  });

  it("the warn helper text recomputes when the limit changes (enter limit 10, assert it contains 8)", () => {
    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getAllByText("Add budget threshold")[0]);

    fireEvent.change(screen.getByPlaceholderText("e.g. 100"), { target: { value: "10" } });

    expect(screen.getByText(/Warn at .*8.* — breach at/)).toBeInTheDocument();
  });

  it("every icon-only button has a non-empty accessible name", () => {
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "costBudgets:list") return [budgetRow({ scope: "global" })];
      return undefined;
    });

    render(<CostBudgetsAdmin />);

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      const accessibleName = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
      expect(accessibleName.trim().length).toBeGreaterThan(0);
    }
  });

  it("never implies enforcement — no throttle/swap/cap-enforced anywhere, and 'stop work' appears only in the disclaimer", () => {
    render(<CostBudgetsAdmin />);
    fireEvent.click(screen.getAllByText("Add budget threshold")[0]);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/throttle/i);
    expect(text).not.toMatch(/swap/i);
    expect(text).not.toMatch(/cap enforced/i);
    expect(text).toContain("Budgets raise alerts. They don't stop work.");
    const stopWorkOccurrences = text.match(/stop work/g) ?? [];
    expect(stopWorkOccurrences.length).toBe(1);
  });

  it("contains no hardcoded hex color in the source file", () => {
    const source = readFileSync(join(__dirname, "CostBudgetsAdmin.tsx"), "utf-8");
    const hexMatches = source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
    expect(hexMatches).toBeNull();
  });
});
