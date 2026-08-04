import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Convex mocks ────────────────────────────────────────────────────────────
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    costDerived: {
      unpricedModels: "costDerived:unpricedModels",
    },
  },
}));

import UnpricedModelsNudge from "./UnpricedModelsNudge";

function renderNudge() {
  return render(
    <MemoryRouter>
      <UnpricedModelsNudge />
    </MemoryRouter>
  );
}

describe("UnpricedModelsNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when count is 0", () => {
    mockUseQuery.mockReturnValue({ count: 0, models: [] });
    const { container } = renderNudge();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while loading (useQuery returns undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = renderNudge();
    expect(container.firstChild).toBeNull();
  });

  it("renders the exact copy with the live count and an 'Add rates' action when count > 0", () => {
    mockUseQuery.mockReturnValue({
      count: 3,
      models: [
        { provider: "codex", model: "gpt-mystery", billingType: "api", promptTokens: 10, completionTokens: 5 },
      ],
    });
    renderNudge();

    expect(screen.getByText("3 models")).toBeInTheDocument();
    expect(
      screen.getByText(/need pricing rates — their cost isn't in the total above\./)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add rates" })).toBeInTheDocument();
  });

  it("updates the rendered number when the live count changes (never-stale guard)", () => {
    mockUseQuery.mockReturnValue({ count: 2, models: [] });
    const { rerender } = renderNudge();
    expect(screen.getByText("2 models")).toBeInTheDocument();

    mockUseQuery.mockReturnValue({ count: 5, models: [] });
    rerender(
      <MemoryRouter>
        <UnpricedModelsNudge />
      </MemoryRouter>
    );
    expect(screen.getByText("5 models")).toBeInTheDocument();
    expect(screen.queryByText("2 models")).not.toBeInTheDocument();
  });

  it("writes nothing to localStorage", () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    mockUseQuery.mockReturnValue({ count: 4, models: [] });
    renderNudge();
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it("contains no hardcoded hex color", () => {
    const source = readFileSync(join(__dirname, "UnpricedModelsNudge.tsx"), "utf-8");
    expect(source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)).toBeNull();
  });

  it("references no localStorage in source", () => {
    const source = readFileSync(join(__dirname, "UnpricedModelsNudge.tsx"), "utf-8");
    expect(source).not.toMatch(/localStorage/);
  });
});
