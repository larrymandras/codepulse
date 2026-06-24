import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeSwitcher } from "./ThemeSwitcher";

/**
 * ThemeSwitcher unit tests.
 *
 * Tests the default data-theme behavior and localStorage key reads on mount.
 *
 * NOTE: The key-migration assertion (old "theme" key → "codepulse-theme") is
 * owned by Plan 05 (89-05, localStorage key consolidation) and is left as a
 * placeholder below. Plan 05 fills in that test when it implements the migration.
 */

// shadcn Select uses Radix primitives that require a browser-like environment.
// In jsdom the SelectContent portal/scroll behavior is absent — mock the entire
// Select to expose only the value/onValueChange props we need for assertions.
vi.mock("./ui/select", () => ({
  Select: ({
    children,
    onValueChange: _onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => <div data-testid="select-root">{children}</div>,
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button data-testid="select-trigger" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

describe("ThemeSwitcher", () => {
  let setAttributeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear any stored theme
    localStorage.removeItem("codepulse-theme");
    // Reset data-theme to a known state
    document.documentElement.removeAttribute("data-theme");
    // Spy on setAttribute to verify theme is applied to <html>
    setAttributeSpy = vi.spyOn(document.documentElement, "setAttribute");
  });

  afterEach(() => {
    setAttributeSpy.mockRestore();
    localStorage.removeItem("codepulse-theme");
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders without crashing", () => {
    const { getByTestId } = render(<ThemeSwitcher />);
    expect(getByTestId("select-root")).toBeDefined();
  });

  it("sets data-theme to 'cyan' on mount when no localStorage key is present", async () => {
    render(<ThemeSwitcher />);

    // useEffect runs after render — wait a tick
    await new Promise((r) => setTimeout(r, 0));

    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "cyan");
  });

  it("sets data-theme to the saved value when codepulse-theme key is present", async () => {
    localStorage.setItem("codepulse-theme", "emerald");

    render(<ThemeSwitcher />);
    await new Promise((r) => setTimeout(r, 0));

    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "emerald");
  });

  it("renders the four expected theme options (amber removed, readable + aubergine added)", () => {
    const { getByTestId, queryByTestId } = render(<ThemeSwitcher />);

    expect(getByTestId("select-item-cyan")).toBeDefined();
    expect(getByTestId("select-item-emerald")).toBeDefined();
    expect(getByTestId("select-item-readable")).toBeDefined();
    expect(getByTestId("select-item-aubergine")).toBeDefined();

    // amber was removed in Plan 89-01 (PATTERNS.md §ThemeSwitcher changes)
    expect(queryByTestId("select-item-amber")).toBeNull();
  });

  // --- Plan 05: localStorage key migration (inline pre-paint script handles at page load) ---
  // The React-side guard: ThemeSwitcher only ever reads/writes codepulse-theme.
  // It does NOT read the old "theme" key — migration is owned by the index.html script.
  it("Plan 05 — ThemeSwitcher ignores the old 'theme' key and defaults to cyan when codepulse-theme is absent", async () => {
    // Simulate a user who only has the old key set (not yet migrated)
    localStorage.setItem("theme", "light");
    localStorage.removeItem("codepulse-theme");

    render(<ThemeSwitcher />);
    await new Promise((r) => setTimeout(r, 0));

    // ThemeSwitcher reads codepulse-theme (absent → "cyan"), not the old "theme" key
    expect(setAttributeSpy).toHaveBeenCalledWith("data-theme", "cyan");
    // Old key is untouched by the React component (migration is the pre-paint script's job)
    expect(localStorage.getItem("theme")).toBe("light");
    // codepulse-theme is NOT written until the user changes theme
    expect(localStorage.getItem("codepulse-theme")).toBeNull();
  });

  it("Plan 05 — DarkModeToggle is removed: no element with aria-label containing 'dark mode' exists", () => {
    const { container } = render(<ThemeSwitcher />);
    // DarkModeToggle was removed in Plan 05; ThemeSwitcher has no dark-mode toggle button
    const darkToggle = container.querySelector('[aria-label*="dark mode"]');
    expect(darkToggle).toBeNull();
  });
});
