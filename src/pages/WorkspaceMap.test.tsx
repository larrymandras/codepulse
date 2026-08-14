/**
 * WorkspaceMap page tests (Phase 114 Plan 10).
 *
 * Proves D-12's four lens-param cases (including the unrecognized-value
 * fallback, the one that actually matters), that the two SectionErrorBoundary
 * instances isolate independently (T-114-18), and that switching lenses via
 * the tab control round-trips through the URL.
 *
 * All root/directory names below come from `makeWorkspaceMapFixture()`
 * (synthetic `root-a`/`root-b`/... only) — Phase 115 D-17, carried forward
 * by 114's D-16. No real workspace name appears in this file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { forwardRef } from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  throwInStrip: false,
  throwInCanvas: false,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// The real generated `api` (convex/_generated/api.js) is `anyApi` — a Proxy
// that mints a NEW object on every property access, so `api.workspace.
// getWorkspaceMap` is never `===` across two separate import sites. The
// fixture's discriminating mock relies on reference equality, so — matching
// CodeVaultGraph.test.tsx's established pattern — the api module itself must
// also be mocked with stable sentinel values, resolved to this same module by
// every importer (useWorkspaceMap.ts, useArmsProbe.ts, workspaceMapFixture.ts)
// regardless of which relative specifier each one used to reach it.
vi.mock("../../convex/_generated/api", () => ({
  api: {
    workspace: {
      getWorkspaceMap: "workspace:getWorkspaceMap",
    },
    graphSnapshots: {
      listSnapshots: "graphSnapshots:listSnapshots",
    },
  },
}));

// react-force-graph-2d — heavy canvas dep not available in jsdom. Per-file
// mock, same pattern as WorkspaceMapCanvas.test.tsx:43-53 — this page
// genuinely mounts WorkspaceMapCanvas (not a stub) for the "workspace lens"
// cases, so the same substrate mock is required here.
vi.mock("react-force-graph-2d", () => ({
  default: forwardRef((props: Record<string, unknown>, ref: unknown) => {
    if (ref && typeof ref === "object" && "current" in (ref as object)) {
      (ref as { current: unknown }).current = {};
    }
    return null;
  }),
}));

vi.mock("d3-force-3d", () => ({
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
}));

// Deterministic theme colors — jsdom has no real CSS custom properties.
// Mirrors WorkspaceMapCanvas.test.tsx:63-80.
vi.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => ({
    primary: "#06b6d4",
    primaryAlpha18: "rgba(6, 182, 212, 0.18)",
    primaryAlpha55: "rgba(6, 182, 212, 0.55)",
    accent: "#0ea5e9",
    vaultNode: "#8b5cf6",
    vaultNodeAlpha18: "rgba(139, 92, 246, 0.18)",
    chartBar: "#06b6d4",
    chartBarAccent: "#0ea5e9",
    statusOk: "#22c55e",
    statusWarn: "#f59e0b",
    statusError: "#ef4444",
    statusInfo: "#3b82f6",
    mutedForeground: "#94a3b8",
    deptPersonal: "#ec4899",
    deptConsulting: "#22c55e",
    deptWork: "#f97316",
  }),
}));

// The two boundary-owned children (T-114-18 proof). Wrapping the REAL
// component via importOriginal — not a full stub — so the "lens param"
// suite still exercises genuine rendered output (e.g. "roots covered" text),
// and only the two dedicated error-isolation tests below flip the throw
// flags. A full stub here would make the "lens param" tests measure nothing.
vi.mock("@/components/workspace/WorkspaceCoverageStrip", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/workspace/WorkspaceCoverageStrip")>();
  return {
    ...actual,
    WorkspaceCoverageStrip: (props: Record<string, unknown>) => {
      if (h.throwInStrip) throw new Error("boom-strip");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <actual.WorkspaceCoverageStrip {...(props as any)} />;
    },
  };
});

vi.mock("@/components/workspace/WorkspaceMapCanvas", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/workspace/WorkspaceMapCanvas")>();
  return {
    ...actual,
    WorkspaceMapCanvas: (props: Record<string, unknown>) => {
      if (h.throwInCanvas) throw new Error("boom-canvas");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <actual.WorkspaceMapCanvas {...(props as any)} />;
    },
  };
});

import WorkspaceMap from "./WorkspaceMap";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import {
  makeWorkspaceMapFixture,
  mockGetWorkspaceMap,
  mockArmsProbe,
} from "@/test/workspaceMapFixture";

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/** Surfaces the current router location as text, so tests can assert D-12's
 * URL round-trip without reaching into react-router internals. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname + location.search}</div>;
}

function renderPage(initialEntry: string) {
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({
      enabled: false,
      maskPaths: true,
      maskEmails: true,
      maskKeys: true,
      maskIps: true,
      level: "off",
    })
  );
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PrivacyProvider>
        <LocationProbe />
        <WorkspaceMap />
      </PrivacyProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  h.throwInStrip = false;
  h.throwInCanvas = false;
  // Healthy control: all four honesty flags green (per the fixture's own
  // documented default), and no ARMS sources — the honest-empty Ástríðr lens.
  mockGetWorkspaceMap(makeWorkspaceMapFixture());
  mockArmsProbe([]);
});

// ---------------------------------------------------------------------------
// lens param (D-12)
// ---------------------------------------------------------------------------

describe("lens param", () => {
  it("absent param renders the workspace lens", () => {
    renderPage("/workspace-map");
    expect(screen.getByText(/roots covered/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't mapped yet/i)).not.toBeInTheDocument();
  });

  it("?lens=workspace renders the workspace lens", () => {
    renderPage("/workspace-map?lens=workspace");
    expect(screen.getByText(/roots covered/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't mapped yet/i)).not.toBeInTheDocument();
  });

  it("?lens=astridr renders the Ástríðr lens, with the coverage strip absent", () => {
    renderPage("/workspace-map?lens=astridr");
    expect(screen.getByText(/isn't mapped yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/roots covered/i)).not.toBeInTheDocument();
  });

  it("an unrecognized lens value falls back to the workspace lens and is never rendered", () => {
    const garbage = "<script>bogus</script>";
    renderPage(`/workspace-map?lens=${encodeURIComponent(garbage)}`);

    // Falls back to workspace — the honest positive assertion.
    expect(screen.getByText(/roots covered/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't mapped yet/i)).not.toBeInTheDocument();

    // The raw garbage value is never rendered anywhere on the page — proves
    // the derivation actually compares against the closed set rather than
    // rendering whatever it was given.
    expect(screen.queryByText(garbage)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(garbage);
  });
});

// ---------------------------------------------------------------------------
// Error isolation (T-114-18) — the property two SEPARATE boundaries exist
// for. A single shared boundary would pass every other test in this file.
// ---------------------------------------------------------------------------

describe("error isolation", () => {
  it("a fault in the coverage strip does not blank the canvas", () => {
    h.throwInStrip = true;
    renderPage("/workspace-map");

    expect(screen.getByText(/Workspace Coverage Strip failed to load/i)).toBeInTheDocument();
    // The canvas section rendered its real content despite the strip's fault.
    expect(screen.getByRole("button", { name: /expand map/i })).toBeInTheDocument();
  });

  it("a fault in the canvas does not blank the coverage strip", () => {
    h.throwInCanvas = true;
    renderPage("/workspace-map");

    expect(screen.getByText(/Workspace Map Canvas failed to load/i)).toBeInTheDocument();
    // The strip's real content rendered despite the canvas's fault.
    expect(screen.getByText(/roots covered/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Switching
// ---------------------------------------------------------------------------

describe("switching lenses", () => {
  it("clicking the Ástríðr tab updates the URL and swaps the rendered surface; the empty-state action switches back", () => {
    renderPage("/workspace-map");

    // Radix Tabs.Trigger activates on mousedown, not click (react-tabs
    // dist/index.js:164) — fireEvent.click alone never fires onValueChange.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Ástríðr/i }));

    expect(screen.getByTestId("location-probe")).toHaveTextContent(
      "/workspace-map?lens=astridr"
    );
    expect(screen.getByText(/isn't mapped yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /View Larry's Workspace/i }));

    expect(screen.getByTestId("location-probe")).toHaveTextContent(
      "/workspace-map?lens=workspace"
    );
    expect(screen.getByText(/roots covered/i)).toBeInTheDocument();
  });
});
