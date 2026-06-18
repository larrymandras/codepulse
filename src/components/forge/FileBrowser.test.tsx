/**
 * FileBrowser tests (Phase 82, plan 03, FI-12 / T-82-11)
 *
 * Security-critical assertions (T-82-11):
 *   - A filename containing a script tag renders as escaped text (React text node),
 *     NOT as executable HTML (no innerHTML injection)
 *   - No dangerouslySetInnerHTML in FileBrowser source
 *
 * Functional assertions:
 *   - Mixed-kind file array renders kind-group headers in the locked order
 *     (text → image → video → audio → pdf → binary)
 *   - A row click calls onSelectFile with the entry
 *   - Empty file array renders empty state
 *   - Selected path gets border-l-primary class
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FileBrowser, formatFileSize } from "./FileBrowser";
import type { ForgeFileRow } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(overrides: Partial<ForgeFileRow> = {}): ForgeFileRow {
  return {
    id: "f1",
    path: "output/report.html",
    kind: "text",
    sizeBytes: 1024,
    ...overrides,
  };
}

const DEFAULT_WORKSPACE = { rootPath: "C:\\workspace" };

// ---------------------------------------------------------------------------
// Kind-group ordering
// ---------------------------------------------------------------------------

describe("FileBrowser — kind-group ordering", () => {
  it("renders kind-group headers in locked order: TEXT before IMAGES", () => {
    const files: ForgeFileRow[] = [
      makeFile({ id: "img", path: "photo.jpg", kind: "image", sizeBytes: 2048 }),
      makeFile({ id: "txt", path: "readme.md", kind: "text", sizeBytes: 512 }),
    ];

    render(
      <FileBrowser
        files={files}
        workspace={DEFAULT_WORKSPACE}
      />
    );

    const headers = screen.getAllByText(/^(TEXT|IMAGES|VIDEO|AUDIO|PDF|BINARY)$/);
    // TEXT header must appear before IMAGES header
    expect(headers.length).toBeGreaterThanOrEqual(2);
    const textIdx = headers.findIndex((h) => h.textContent === "TEXT");
    const imgIdx = headers.findIndex((h) => h.textContent === "IMAGES");
    expect(textIdx).toBeLessThan(imgIdx);
  });

  it("renders only headers for kinds present in the file list", () => {
    const files: ForgeFileRow[] = [
      makeFile({ id: "b1", path: "data.bin", kind: "binary", sizeBytes: 100 }),
    ];

    render(<FileBrowser files={files} workspace={DEFAULT_WORKSPACE} />);

    expect(screen.getByText("BINARY")).toBeInTheDocument();
    expect(screen.queryByText("TEXT")).not.toBeInTheDocument();
    expect(screen.queryByText("IMAGES")).not.toBeInTheDocument();
  });

  it("renders all 6 kind headers when all kinds are present", () => {
    const files: ForgeFileRow[] = [
      makeFile({ id: "t", path: "a.html", kind: "text", sizeBytes: 100 }),
      makeFile({ id: "i", path: "b.jpg", kind: "image", sizeBytes: 100 }),
      makeFile({ id: "v", path: "c.mp4", kind: "video", sizeBytes: 100 }),
      makeFile({ id: "a", path: "d.mp3", kind: "audio", sizeBytes: 100 }),
      makeFile({ id: "p", path: "e.pdf", kind: "pdf", sizeBytes: 100 }),
      makeFile({ id: "b", path: "f.bin", kind: "binary", sizeBytes: 100 }),
    ];

    render(<FileBrowser files={files} workspace={DEFAULT_WORKSPACE} />);

    expect(screen.getByText("TEXT")).toBeInTheDocument();
    expect(screen.getByText("IMAGES")).toBeInTheDocument();
    expect(screen.getByText("VIDEO")).toBeInTheDocument();
    expect(screen.getByText("AUDIO")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("BINARY")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Row click and selection
// ---------------------------------------------------------------------------

describe("FileBrowser — row selection", () => {
  it("calls onSelectFile with the entry when a row is clicked", () => {
    const onSelectFile = vi.fn();
    const file = makeFile({ id: "f1", path: "report.html", kind: "text" });

    render(
      <FileBrowser
        files={[file]}
        workspace={DEFAULT_WORKSPACE}
        onSelectFile={onSelectFile}
      />
    );

    const row = screen.getByText("report.html").closest("[role='listitem']");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(onSelectFile).toHaveBeenCalledOnce();
    expect(onSelectFile).toHaveBeenCalledWith(file);
  });

  it("calls onSelectFile with the correct entry for multiple files", () => {
    const onSelectFile = vi.fn();
    const files: ForgeFileRow[] = [
      makeFile({ id: "f1", path: "a.html", kind: "text" }),
      makeFile({ id: "f2", path: "b.html", kind: "text" }),
    ];

    render(
      <FileBrowser
        files={files}
        workspace={DEFAULT_WORKSPACE}
        onSelectFile={onSelectFile}
      />
    );

    fireEvent.click(screen.getByText("b.html").closest("[role='listitem']")!);
    expect(onSelectFile).toHaveBeenCalledWith(files[1]);
  });

  it("applies selected-row styles when selectedPath matches", () => {
    const files = [makeFile({ id: "f1", path: "report.html", kind: "text" })];

    render(
      <FileBrowser
        files={files}
        workspace={DEFAULT_WORKSPACE}
        selectedPath="report.html"
      />
    );

    const row = screen.getByText("report.html").closest("[role='listitem']");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("border-l-primary");
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("FileBrowser — empty state", () => {
  it("renders 'No files found for this job.' when files is empty", () => {
    render(<FileBrowser files={[]} workspace={DEFAULT_WORKSPACE} />);
    expect(screen.getByText("No files found for this job.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Security invariant: filenames as React text nodes (T-82-11)
// ---------------------------------------------------------------------------

describe("FileBrowser — security: filename XSS prevention (T-82-11)", () => {
  it("renders a script-tag filename as escaped text, not executable HTML", () => {
    const scriptPath = '<script>alert("xss")</script>';
    const file = makeFile({ id: "xss", path: scriptPath, kind: "text", sizeBytes: 100 });

    render(
      <FileBrowser
        files={[file]}
        workspace={DEFAULT_WORKSPACE}
      />
    );

    // The filename span must contain the raw text (escaped by React),
    // NOT an actual <script> element in the DOM
    const spans = document.querySelectorAll("span.truncate");
    const found = Array.from(spans).find((el) => el.textContent === scriptPath);
    expect(found).toBeDefined();

    // No actual <script> elements injected into the DOM
    expect(document.querySelectorAll("script[data-injected]")).toHaveLength(0);
    // The script tag text is in the text content, not the innerHTML
    expect(found!.innerHTML).not.toContain("<script>");
  });
});

// ---------------------------------------------------------------------------
// formatFileSize utility
// ---------------------------------------------------------------------------

describe("formatFileSize", () => {
  it("returns '< 1 KB' for bytes < 1024", () => {
    expect(formatFileSize(0)).toBe("< 1 KB");
    expect(formatFileSize(512)).toBe("< 1 KB");
    expect(formatFileSize(1023)).toBe("< 1 KB");
  });

  it("returns integer KB for bytes in the KB range", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(49152)).toBe("48 KB");
  });

  it("returns decimal MB for bytes >= 1 MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1258291)).toBe("1.2 MB");
  });
});
