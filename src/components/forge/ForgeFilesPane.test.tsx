/**
 * ForgeFilesPane tests (Phase 82, plan 03, FI-12 / FI-14)
 *
 * Task 1: Hook shape smoke test
 *   - adaptFileEntry maps Convex doc to ForgeFileRow with correct fields
 *   - ForgeFilesPane wired to useForgeJobFilesRaw returns rows via FileBrowser
 *   - null hostId (empty files) yields empty state
 *
 * Task 3 (extended below): ForgeFilesPane component
 *   - running job shows "Files appear after the job completes." (terminal-state gate)
 *   - terminal job + zero files shows "No files found for this job."
 *   - terminal job with files renders FileBrowser
 *   - ForgeJobDetail renders all three tab labels and defaults to Details
 *
 * Mocks: useForgeJobFilesRaw, useForgeJobArtifact, useForgeWorkspace from hook module.
 * No Convex runtime needed.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hook mocks — hoisted so they are available before imports
// ---------------------------------------------------------------------------

const mockUseForgeJobFilesRaw = vi.fn();
const mockUseForgeJobFiles = vi.fn();
const mockUseForgeJobArtifact = vi.fn();
const mockUseForgeWorkspace = vi.fn();
const mockUseForgeJobLogs = vi.fn();

vi.mock("@/hooks/useForge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useForge")>();
  return {
    ...actual,
    useForgeJobFilesRaw: (...args: unknown[]) => mockUseForgeJobFilesRaw(...args),
    useForgeJobFiles: (...args: unknown[]) => mockUseForgeJobFiles(...args),
    useForgeJobArtifact: (...args: unknown[]) => mockUseForgeJobArtifact(...args),
    useForgeWorkspace: (...args: unknown[]) => mockUseForgeWorkspace(...args),
    useForgeJobLogs: (...args: unknown[]) => mockUseForgeJobLogs(...args),
  };
});

// Mock JumpToLatestPill (used by ForgeLogPane which ForgeJobDetail imports)
vi.mock("@/components/JumpToLatestPill", () => ({
  JumpToLatestPill: ({ visible }: { visible: boolean; onClick: () => void }) =>
    visible ? <button data-testid="jump-pill">Jump</button> : null,
}));

// Mock SectionErrorBoundary — render children passthrough
vi.mock("@/components/SectionErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock convex/react to avoid ConvexProvider requirement in ForgeJobDetail
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

import React from "react";
import { adaptFileEntry, type ForgeFileRow } from "@/hooks/useForge";
import { ForgeFilesPane } from "./ForgeFilesPane";
import { ForgeJobDetail } from "./ForgeJobDetail";
import type { ForgeJobRow } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: "file-id-1",
    path: "output/report.html",
    kind: "text",
    sizeBytes: 1024,
    ...overrides,
  };
}

function makeFileRow(overrides: Partial<ForgeFileRow> = {}): ForgeFileRow {
  return {
    id: "file-id-1",
    path: "output/report.html",
    kind: "text",
    sizeBytes: 1024,
    ...overrides,
  };
}

function makeJob(overrides: Partial<ForgeJobRow> = {}): ForgeJobRow {
  return {
    id: "job-42",
    agent: "codex",
    mode: "goal",
    prompt: "Build a thing",
    workspaceId: "ws-1",
    status: "completed",
    pid: null,
    exitCode: 0,
    startedAt: "2026-06-17T00:00:00Z",
    finishedAt: "2026-06-17T01:00:00Z",
    artifactCount: 1,
    capabilities: "[]",
    model: null,
    createdAt: "2026-06-17T00:00:00Z",
    hostId: "host-1",
    updatedAt: "2026-06-17T01:00:00Z",
    ...overrides,
  };
}

const DEFAULT_PANE_PROPS = {
  hostId: "host-1",
  forgeJobId: "job-42",
  jobStatus: "completed",
  workspace: { rootPath: "C:\\workspace" },
};

// ---------------------------------------------------------------------------
// Task 1: adaptFileEntry — real function, not mocked
// ---------------------------------------------------------------------------

describe("adaptFileEntry — maps Convex doc to ForgeFileRow", () => {
  it("maps _id → id, preserves path/kind/sizeBytes", () => {
    const doc = makeFileDoc();
    const row = adaptFileEntry(doc);
    expect(row.id).toBe("file-id-1");
    expect(row.path).toBe("output/report.html");
    expect(row.kind).toBe("text");
    expect(row.sizeBytes).toBe(1024);
  });

  it("maps a different doc correctly (image kind)", () => {
    const doc = makeFileDoc({ _id: "img-id", path: "assets/logo.png", kind: "image", sizeBytes: 51200 });
    const row = adaptFileEntry(doc);
    expect(row.id).toBe("img-id");
    expect(row.path).toBe("assets/logo.png");
    expect(row.kind).toBe("image");
    expect(row.sizeBytes).toBe(51200);
  });
});

// ---------------------------------------------------------------------------
// Task 1: ForgeFilesPane hook wiring smoke test
// ---------------------------------------------------------------------------

describe("ForgeFilesPane — hook wiring (Task 1 smoke)", () => {
  beforeEach(() => {
    mockUseForgeJobFilesRaw.mockReset();
    mockUseForgeJobArtifact.mockReset();
    mockUseForgeWorkspace.mockReset();
  });

  it("renders two file rows when hook returns two ForgeFileRow entries", () => {
    const rows: ForgeFileRow[] = [
      makeFileRow({ id: "f1", path: "a.html", kind: "text", sizeBytes: 100 }),
      makeFileRow({ id: "f2", path: "b.png", kind: "image", sizeBytes: 200 }),
    ];
    mockUseForgeJobFilesRaw.mockReturnValue(rows);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} />);
    expect(screen.getByText("a.html")).toBeInTheDocument();
    expect(screen.getByText("b.png")).toBeInTheDocument();
  });

  it("returns empty state when hook returns [] (no files)", () => {
    mockUseForgeJobFilesRaw.mockReturnValue([]);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} />);
    expect(screen.getByText("No files found for this job.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Task 3: ForgeFilesPane — terminal-state gate
// ---------------------------------------------------------------------------

describe("ForgeFilesPane — terminal-state gate", () => {
  beforeEach(() => {
    mockUseForgeJobFilesRaw.mockReset();
    mockUseForgeJobArtifact.mockReset();
    mockUseForgeWorkspace.mockReset();
  });

  it("shows running-job empty state for status='running' (no FileBrowser rows)", () => {
    // Even if hooks would return files, the gate blocks rendering
    mockUseForgeJobFilesRaw.mockReturnValue([
      makeFileRow({ id: "f1", path: "a.html" }),
    ]);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(
      <ForgeFilesPane
        {...DEFAULT_PANE_PROPS}
        jobStatus="running"
      />
    );

    expect(screen.getByText("Files appear after the job completes.")).toBeInTheDocument();
    expect(screen.queryByText("a.html")).not.toBeInTheDocument();
  });

  it("shows running-job empty state for status='queued'", () => {
    mockUseForgeJobFilesRaw.mockReturnValue([]);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(
      <ForgeFilesPane
        {...DEFAULT_PANE_PROPS}
        jobStatus="queued"
      />
    );

    expect(screen.getByText("Files appear after the job completes.")).toBeInTheDocument();
  });

  it("shows zero-files empty state for terminal job with no files", () => {
    mockUseForgeJobFilesRaw.mockReturnValue([]);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} jobStatus="completed" />);

    expect(screen.getByText("No files found for this job.")).toBeInTheDocument();
    expect(screen.queryByText("Files appear after the job completes.")).not.toBeInTheDocument();
  });

  it("shows loading spinner when useForgeJobFilesRaw returns undefined", () => {
    mockUseForgeJobFilesRaw.mockReturnValue(undefined);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} />);

    expect(screen.getByText("Loading files…")).toBeInTheDocument();
  });

  it("renders FileBrowser when terminal job has files", () => {
    const rows: ForgeFileRow[] = [
      makeFileRow({ id: "f1", path: "report.html", kind: "text", sizeBytes: 500 }),
    ];
    mockUseForgeJobFilesRaw.mockReturnValue(rows);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} />);

    expect(screen.getByText("report.html")).toBeInTheDocument();
  });

  it("clicking a file row removes the 'Select a file to preview' placeholder when artifact loads", () => {
    const rows: ForgeFileRow[] = [
      makeFileRow({ id: "f1", path: "report.html", kind: "text", sizeBytes: 500 }),
    ];
    mockUseForgeJobFilesRaw.mockReturnValue(rows);
    // Simulate artifact loaded (null = not found → preview unavailable)
    mockUseForgeJobArtifact.mockReturnValue(null);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeFilesPane {...DEFAULT_PANE_PROPS} />);

    // Initially: preview pane shows "Select a file to preview"
    expect(screen.getByText("Select a file to preview")).toBeInTheDocument();

    // Click the file row
    const row = screen.getByText("report.html").closest("[role='listitem']");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    // After click with artifact data loaded: placeholder gone, preview state shown
    expect(screen.queryByText("Select a file to preview")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Task 3: ForgeJobDetail — three tabs, defaults to Details
// ---------------------------------------------------------------------------

describe("ForgeJobDetail — three-tab strip", () => {
  beforeEach(() => {
    mockUseForgeJobFilesRaw.mockReset();
    mockUseForgeJobArtifact.mockReset();
    mockUseForgeWorkspace.mockReset();
    mockUseForgeJobLogs.mockReturnValue([]);
  });

  it("renders Details, Logs, and Files tab labels", () => {
    render(<ForgeJobDetail job={makeJob()} />);

    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
  });

  it("defaults to Details tab (active border-emerald-500 class)", () => {
    render(<ForgeJobDetail job={makeJob()} />);

    const detailsBtn = screen.getByRole("button", { name: "Details" });
    expect(detailsBtn.className).toContain("border-emerald-500");

    const filesBtn = screen.getByRole("button", { name: "Files" });
    expect(filesBtn.className).toContain("border-transparent");
  });

  it("switches to Files tab and shows ForgeFilesPane content", () => {
    mockUseForgeJobFilesRaw.mockReturnValue([]);
    mockUseForgeJobArtifact.mockReturnValue(undefined);
    mockUseForgeWorkspace.mockReturnValue({ rootPath: "C:\\workspace" });

    render(<ForgeJobDetail job={makeJob({ status: "completed" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    // Should show zero-files empty state for completed job with no files
    expect(screen.getByText("No files found for this job.")).toBeInTheDocument();
  });
});
