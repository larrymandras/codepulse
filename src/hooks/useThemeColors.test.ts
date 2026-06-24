import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useThemeColors, resolveThemeColors, ThemeColors } from "./useThemeColors";

// Token values for "cyan" theme (Electric Cyan)
const CYAN_TOKENS: Record<string, string> = {
  "--primary": "#06b6d4",
  "--accent": "#8b5cf6",
  "--vault-node-color": "#8b5cf6",
  "--chart-bar": "#0a0a0c",
  "--chart-bar-accent": "#06b6d4",
  "--status-ok": "#06b6d4",
  "--status-warn": "#f59e0b",
  "--status-error": "#ef4444",
  "--status-info": "#3b82f6",
};

// Token values for "readable" theme
const READABLE_TOKENS: Record<string, string> = {
  "--primary": "#5eead4",
  "--accent": "#3b82f6",
  "--vault-node-color": "#8b5cf6",
  "--chart-bar": "#1e2433",
  "--chart-bar-accent": "#5eead4",
  "--status-ok": "#34d399",
  "--status-warn": "#fbbf24",
  "--status-error": "#f87171",
  "--status-info": "#60a5fa",
};

function makeComputedStyleStub(tokens: Record<string, string>) {
  return {
    getPropertyValue: (prop: string) => tokens[prop] ?? "",
  } as unknown as CSSStyleDeclaration;
}

describe("useThemeColors", () => {
  let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;
  let currentTokens = CYAN_TOKENS;

  beforeEach(() => {
    currentTokens = CYAN_TOKENS;
    getComputedStyleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation(
      () => makeComputedStyleStub(currentTokens)
    );
    // Reset data-theme to cyan
    document.documentElement.setAttribute("data-theme", "cyan");
  });

  afterEach(() => {
    getComputedStyleSpy.mockRestore();
    document.documentElement.removeAttribute("data-theme");
  });

  describe("resolveThemeColors", () => {
    it("reads --primary from getComputedStyle and trims whitespace", () => {
      // Simulate leading whitespace from browser
      currentTokens = { ...CYAN_TOKENS, "--primary": " #06b6d4" };
      getComputedStyleSpy.mockImplementation(
        () => makeComputedStyleStub(currentTokens)
      );
      const colors = resolveThemeColors();
      expect(colors.primary).toBe("#06b6d4");
    });

    it("returns correct hex fields for cyan theme", () => {
      const colors = resolveThemeColors();
      expect(colors.primary).toBe("#06b6d4");
      expect(colors.accent).toBe("#8b5cf6");
      expect(colors.vaultNode).toBe("#8b5cf6");
      expect(colors.statusOk).toBe("#06b6d4");
    });

    it("builds alpha variants via hexToRgba", () => {
      const colors = resolveThemeColors();
      expect(colors.primaryAlpha18).toBe("rgba(6, 182, 212, 0.18)");
      expect(colors.primaryAlpha55).toBe("rgba(6, 182, 212, 0.55)");
      expect(colors.vaultNodeAlpha18).toBe("rgba(139, 92, 246, 0.18)");
    });

    it("calls getComputedStyle(document.documentElement) fresh each call (not cached)", () => {
      resolveThemeColors();
      resolveThemeColors();
      // Should have been called twice — no caching
      expect(getComputedStyleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("useThemeColors hook", () => {
    it("returns resolved colors from current data-theme on initial render", () => {
      const { result } = renderHook(() => useThemeColors());
      expect(result.current.primary).toBe("#06b6d4");
      expect(result.current.primaryAlpha18).toBe("rgba(6, 182, 212, 0.18)");
    });

    it("re-resolves colors when data-theme attribute changes", async () => {
      const { result } = renderHook(() => useThemeColors());

      // Initial state: cyan
      expect(result.current.primary).toBe("#06b6d4");

      // Switch mock to readable tokens and mutate the attribute
      currentTokens = READABLE_TOKENS;
      getComputedStyleSpy.mockImplementation(
        () => makeComputedStyleStub(currentTokens)
      );

      act(() => {
        document.documentElement.setAttribute("data-theme", "readable");
      });

      // MutationObserver fires asynchronously in jsdom — wait for re-render
      await waitFor(() => {
        expect(result.current.primary).toBe("#5eead4");
      });

      expect(result.current.primaryAlpha18).toBe("rgba(94, 234, 212, 0.18)");
      expect(result.current.statusOk).toBe("#34d399");
    });

    it("disconnects MutationObserver on unmount (no leak)", () => {
      const disconnectSpy = vi.spyOn(MutationObserver.prototype, "disconnect");
      const { unmount } = renderHook(() => useThemeColors());
      unmount();
      expect(disconnectSpy).toHaveBeenCalledOnce();
      disconnectSpy.mockRestore();
    });

    it("returns all ThemeColors fields", () => {
      const { result } = renderHook(() => useThemeColors());
      const colors: ThemeColors = result.current;
      // All required fields must be present and non-empty
      expect(colors.primary).toBeTruthy();
      expect(colors.primaryAlpha18).toBeTruthy();
      expect(colors.primaryAlpha55).toBeTruthy();
      expect(colors.accent).toBeTruthy();
      expect(colors.vaultNode).toBeTruthy();
      expect(colors.vaultNodeAlpha18).toBeTruthy();
      expect(colors.chartBar).not.toBeUndefined();
      expect(colors.chartBarAccent).not.toBeUndefined();
      expect(colors.statusOk).not.toBeUndefined();
      expect(colors.statusWarn).not.toBeUndefined();
      expect(colors.statusError).not.toBeUndefined();
      expect(colors.statusInfo).not.toBeUndefined();
    });
  });
});
