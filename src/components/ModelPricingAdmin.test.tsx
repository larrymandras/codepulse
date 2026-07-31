import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PricingRow } from "../../convex/modelPricing";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Convex mocks ────────────────────────────────────────────────────────────
const mockCreate = vi.fn(() => Promise.resolve("newid"));
const mockUpdate = vi.fn(() => Promise.resolve());
const mockRemove = vi.fn(() => Promise.resolve());

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn((fnRef: unknown, ..._args: unknown[]) => {
    if (fnRef === "modelPricing:create") return mockCreate;
    if (fnRef === "modelPricing:update") return mockUpdate;
    if (fnRef === "modelPricing:remove") return mockRemove;
    return vi.fn();
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    modelPricing: {
      list: "modelPricing:list",
      create: "modelPricing:create",
      update: "modelPricing:update",
      remove: "modelPricing:remove",
    },
    costDerived: {
      unpricedModels: "costDerived:unpricedModels",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useQuery } from "convex/react";
import { toast } from "sonner";
import ModelPricingAdmin from "./ModelPricingAdmin";

const mockUseQuery = vi.mocked(useQuery);

function pricingRow(overrides: Partial<PricingRow> & { model: string }): PricingRow {
  return {
    _id: `id-${overrides.model}` as unknown as PricingRow["_id"],
    inputPerToken: 0.000003,
    outputPerToken: 0.000015,
    source: "manual",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("ModelPricingAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "modelPricing:list") return [];
      if (fnRef === "costDerived:unpricedModels") return { count: 0, models: [] };
      return undefined;
    });
  });

  it("renders one row per api.modelPricing.list result with the rate displayed per Mtok", () => {
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "modelPricing:list") {
        return [pricingRow({ model: "claude-sonnet-5", inputPerToken: 0.000005, outputPerToken: 0.000015 })];
      }
      if (fnRef === "costDerived:unpricedModels") return { count: 0, models: [] };
      return undefined;
    });

    render(<ModelPricingAdmin />);

    expect(screen.getByText("claude-sonnet-5")).toBeInTheDocument();
    // 0.000005 per token -> 5 per Mtok
    expect(screen.getByText("5")).toBeInTheDocument();
    // 0.000015 per token -> 15 per Mtok
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("saving a per-Mtok input of 5 calls api.modelPricing.create with inputPerToken of 0.000005 (1e6 round-trip guard)", async () => {
    render(<ModelPricingAdmin />);

    fireEvent.click(screen.getByText("Add pricing rate"));

    fireEvent.change(screen.getByPlaceholderText("e.g. claude-sonnet-5"), {
      target: { value: "claude-opus-5" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 3"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 15"), { target: { value: "25" } });

    fireEvent.click(screen.getByText("Save Rate"));

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5",
        inputPerToken: 0.000005,
        outputPerToken: 0.000025,
      })
    );
  });

  it("every icon-only action button has a non-empty accessible name", () => {
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "modelPricing:list") {
        return [pricingRow({ model: "claude-sonnet-5" })];
      }
      if (fnRef === "costDerived:unpricedModels") return { count: 0, models: [] };
      return undefined;
    });

    render(<ModelPricingAdmin />);

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      const accessibleName = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
      expect(accessibleName.trim().length).toBeGreaterThan(0);
    }
  });

  it("renders the unpriced list from api.costDerived.unpricedModels and its Add rate action opens the sheet with the model id pre-filled", () => {
    mockUseQuery.mockImplementation((fnRef: unknown, ..._args: unknown[]) => {
      if (fnRef === "modelPricing:list") return [];
      if (fnRef === "costDerived:unpricedModels") {
        return {
          count: 1,
          models: [
            { provider: "openrouter", model: "gpt-4.1", billingType: "api", promptTokens: 100, completionTokens: 50 },
          ],
        };
      }
      return undefined;
    });

    render(<ModelPricingAdmin />);

    expect(screen.getByText(/gpt-4\.1/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add rate"));

    const modelInput = screen.getByPlaceholderText("e.g. claude-sonnet-5") as HTMLInputElement;
    expect(modelInput.value).toBe("gpt-4.1");
  });

  it("a rate input of 0 shows the validation toast and calls no mutation", async () => {
    render(<ModelPricingAdmin />);

    fireEvent.click(screen.getByText("Add pricing rate"));
    fireEvent.change(screen.getByPlaceholderText("e.g. claude-sonnet-5"), {
      target: { value: "some-model" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 3"), { target: { value: "0" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 15"), { target: { value: "15" } });

    fireEvent.click(screen.getByText("Save Rate"));

    expect(toast.error).toHaveBeenCalledWith("Enter a valid rate greater than 0.");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("contains no hardcoded hex color in the source file", () => {
    const source = readFileSync(join(__dirname, "ModelPricingAdmin.tsx"), "utf-8");
    const hexMatches = source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
    expect(hexMatches).toBeNull();
  });
});
