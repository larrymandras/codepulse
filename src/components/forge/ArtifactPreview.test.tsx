/**
 * ArtifactPreview tests (Phase 82, plan 03, FI-14 / T-82-10)
 *
 * SECURITY-CRITICAL assertions (T-82-10 / SPEC Req 9):
 *   1. iframe sandbox attribute === "allow-scripts" (exactly, never allow-same-origin)
 *   2. Source view renders as <pre> with React text node (never innerHTML/dangerouslySetInnerHTML)
 *   3. No occurrence of "allow-same-origin" or "dangerouslySetInnerHTML" in source
 *
 * Functional assertions:
 *   - text artifact ≤ 1 MB with textContent → Preview (iframe) + Source toggle
 *   - Source toggle renders <pre> with escaped script text
 *   - image artifact ≤ 1 MB with imageUrl → <img src={imageUrl}>
 *   - 2 MB file → not-previewable card (no iframe/img)
 *   - video/audio/pdf/binary → not-previewable card
 *   - text file with textContent absent → preview-unavailable card
 *   - empty filePath → "Select a file to preview"
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArtifactPreview } from "./ArtifactPreview";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONE_MB = 1_048_576;
const TWO_MB = 2 * ONE_MB;

const BASE_PROPS = {
  rootPath: "C:\\workspace",
  filePath: "output/report.html",
  fileKind: "text" as const,
  sizeBytes: 1024,
};

// ---------------------------------------------------------------------------
// Text / HTML Preview mode
// ---------------------------------------------------------------------------

describe("ArtifactPreview — text preview mode (iframe)", () => {
  it("renders an iframe in Preview mode for a text artifact ≤ 1 MB with textContent", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent="<h1>Hello</h1>"
      />
    );

    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.title).toBe("Artifact preview");
  });

  it("iframe sandbox attribute is exactly 'allow-scripts' (FI-14 / T-82-10)", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent="<h1>Hello</h1>"
      />
    );

    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();

    // SECURITY INVARIANT: sandbox must be exactly "allow-scripts"
    expect(iframe!.getAttribute("sandbox")).toBe("allow-scripts");

    // SECURITY INVARIANT: must NOT contain allow-same-origin
    expect(iframe!.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  it("iframe src is a data: URI (not an http:// URL)", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent="<h1>Hello</h1>"
      />
    );

    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toMatch(/^data:text\/html/);
    expect(iframe!.getAttribute("src")).not.toMatch(/^https?:\/\//);
  });
});

// ---------------------------------------------------------------------------
// Source toggle
// ---------------------------------------------------------------------------

describe("ArtifactPreview — Source toggle", () => {
  it("clicking Source shows a <pre> with the text content", () => {
    const textContent = "<h1>Hello</h1><p>World</p>";

    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent={textContent}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Source" }));

    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe(textContent);
  });

  it("Source pre renders script-tag content as escaped text (React text node, not innerHTML)", () => {
    const textContent = '<script>alert("xss")</script>';

    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent={textContent}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Source" }));

    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();

    // Text content matches (React escaped it)
    expect(pre!.textContent).toBe(textContent);

    // innerHTML must NOT contain an actual <script> element
    // (React escapes it to &lt;script&gt; in textContent, so it renders as text)
    expect(pre!.innerHTML).not.toContain("<script>");
  });

  it("Preview/Source toggle buttons carry aria-pressed", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        textContent="<p>hi</p>"
        defaultMode="preview"
      />
    );

    const previewBtn = screen.getByRole("button", { name: "Preview" });
    const sourceBtn = screen.getByRole("button", { name: "Source" });

    expect(previewBtn).toHaveAttribute("aria-pressed", "true");
    expect(sourceBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(sourceBtn);

    expect(previewBtn).toHaveAttribute("aria-pressed", "false");
    expect(sourceBtn).toHaveAttribute("aria-pressed", "true");
  });
});

// ---------------------------------------------------------------------------
// Image renderer
// ---------------------------------------------------------------------------

describe("ArtifactPreview — image renderer", () => {
  it("renders an <img> with imageUrl as src for an image artifact ≤ 1 MB", () => {
    const imageUrl = "https://storage.convex.cloud/abc123";

    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="image"
        imageUrl={imageUrl}
        sizeBytes={512 * 1024}
      />
    );

    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(imageUrl);
    expect(img!.getAttribute("alt")).toBe("output/report.html");
  });

  it("does NOT render an iframe for image artifacts", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="image"
        imageUrl="https://storage.convex.cloud/abc123"
        sizeBytes={512 * 1024}
      />
    );

    expect(document.querySelector("iframe")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Not-previewable fallback
// ---------------------------------------------------------------------------

describe("ArtifactPreview — not-previewable fallback", () => {
  it("shows not-previewable card for a 2 MB file (no iframe, no img)", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="text"
        sizeBytes={TWO_MB}
        textContent="big content"
      />
    );

    expect(screen.getByText(/Not previewable in cloud/)).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows not-previewable card for video kind", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="video"
        sizeBytes={500 * 1024}
      />
    );

    expect(screen.getByText(/Not previewable in cloud/)).toBeInTheDocument();
  });

  it("shows not-previewable card for audio kind", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="audio"
        sizeBytes={500 * 1024}
      />
    );

    expect(screen.getByText(/Not previewable in cloud/)).toBeInTheDocument();
  });

  it("shows not-previewable card for pdf kind", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="pdf"
        sizeBytes={500 * 1024}
      />
    );

    expect(screen.getByText(/Not previewable in cloud/)).toBeInTheDocument();
  });

  it("shows not-previewable card for binary kind", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="binary"
        sizeBytes={500 * 1024}
      />
    );

    expect(screen.getByText(/Not previewable in cloud/)).toBeInTheDocument();
  });

  it("not-previewable card shows local path and VS Code link", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="binary"
        sizeBytes={500 * 1024}
      />
    );

    expect(screen.getByText(/Local path:/)).toBeInTheDocument();
    expect(screen.getByText("Open in VS Code")).toBeInTheDocument();
    expect(screen.getByText(/same machine only/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Preview unavailable (text with no textContent)
// ---------------------------------------------------------------------------

describe("ArtifactPreview — preview unavailable", () => {
  it("shows preview-unavailable card when text file has no textContent", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        fileKind="text"
        sizeBytes={1024}
        // textContent intentionally absent
      />
    );

    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No file selected placeholder
// ---------------------------------------------------------------------------

describe("ArtifactPreview — no file selected", () => {
  it("shows 'Select a file to preview' when filePath is empty", () => {
    render(
      <ArtifactPreview
        {...BASE_PROPS}
        filePath=""
        textContent="<p>hi</p>"
      />
    );

    expect(screen.getByText("Select a file to preview")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SECURITY AUDIT: No allow-same-origin or dangerouslySetInnerHTML in source
// ---------------------------------------------------------------------------

describe("ArtifactPreview — security source audit (T-82-10)", () => {
  it("ArtifactPreview.tsx sandbox attribute never includes allow-same-origin in JSX", () => {
    const srcPath = path.resolve(
      __dirname,
      "ArtifactPreview.tsx"
    );
    const source = fs.readFileSync(srcPath, "utf-8");
    // Check the actual sandbox= attribute value does not include allow-same-origin.
    // Comments explaining "NEVER add allow-same-origin" are fine; the attribute value must not.
    // Match: sandbox="..." where the value includes allow-same-origin
    expect(source).not.toMatch(/sandbox\s*=\s*["'][^"']*allow-same-origin[^"']*["']/);
  });

  it("ArtifactPreview.tsx source contains no dangerouslySetInnerHTML usage (JSX attr)", () => {
    const srcPath = path.resolve(
      __dirname,
      "ArtifactPreview.tsx"
    );
    const source = fs.readFileSync(srcPath, "utf-8");
    // Check for JSX attribute usage: dangerouslySetInnerHTML={...}
    // (comments explaining "never use X" are acceptable; actual assignment is not)
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it("FileBrowser.tsx source contains no dangerouslySetInnerHTML usage (JSX attr)", () => {
    const srcPath = path.resolve(
      __dirname,
      "FileBrowser.tsx"
    );
    const source = fs.readFileSync(srcPath, "utf-8");
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });
});
