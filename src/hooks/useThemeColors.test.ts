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
  "--muted-foreground": "#94a3b8",
  "--dept-personal": "#ec4899",
  "--dept-consulting": "#22c55e",
  "--dept-work": "#f97316",
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
  "--muted-foreground": "#8892a4",
  "--dept-personal": "#d946ef",
  "--dept-consulting": "#818cf8",
  "--dept-work": "#fb923c",
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

    it("resolves mutedForeground and the three department fields on first render, and re-resolves them after a data-theme switch", async () => {
      const { result } = renderHook(() => useThemeColors());

      // Initial state: cyan — exact string equality (not a loose/truthy check),
      // since a field added to the interface but omitted from the returned
      // object would resolve to undefined and pass a loose matcher.
      expect(result.current.mutedForeground).toBe("#94a3b8");
      expect(result.current.deptPersonal).toBe("#ec4899");
      expect(result.current.deptConsulting).toBe("#22c55e");
      expect(result.current.deptWork).toBe("#f97316");

      // Switch mock to readable tokens and mutate the attribute.
      currentTokens = READABLE_TOKENS;
      getComputedStyleSpy.mockImplementation(
        () => makeComputedStyleStub(currentTokens)
      );

      act(() => {
        document.documentElement.setAttribute("data-theme", "readable");
      });

      // The load-bearing assertion: values must re-resolve AFTER the switch,
      // not just hold their first-render value.
      await waitFor(() => {
        expect(result.current.mutedForeground).toBe("#8892a4");
      });
      expect(result.current.deptPersonal).toBe("#d946ef");
      expect(result.current.deptConsulting).toBe("#818cf8");
      expect(result.current.deptWork).toBe("#fb923c");
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
      expect(colors.mutedForeground).toBeTruthy();
      expect(colors.deptPersonal).toBeTruthy();
      expect(colors.deptConsulting).toBeTruthy();
      expect(colors.deptWork).toBeTruthy();
    });
  });
});
