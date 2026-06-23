/**
 * ArtifactPreview — sandboxed iframe + Preview/Source toggle + inline image.
 *
 * Phase 82 (FI-14): Port + adapt from forge/web/src/components/ArtifactPreview.tsx.
 * Re-sourced from Convex props (textContent / imageUrl), not http://127.0.0.1.
 * Style: inline CSS → Tailwind + Matrix Emerald tokens (Phase 71/82-UI-SPEC).
 *
 * SECURITY INVARIANTS (T-82-10 / SPEC Req 9 — NON-NEGOTIABLE):
 *   1. iframe sandbox="allow-scripts" ONLY. The sandbox value is a single token;
 *      adding any other token (especially origin-promotion flags) is forbidden.
 *      src is a data: URI (null origin) — no HTTP request, no origin promotion.
 *   2. Source view: <pre>{textContent}</pre> React text node. Raw HTML injection
 *      via innerHTML or equivalent React props is never used. A <script> tag in
 *      textContent renders as escaped text (React auto-escapes JSX children).
 *   3. imageUrl passed to <img src={...}> only — no innerHTML concatenation.
 *   4. filePath/rootPath in VS Code deep links only (opaque OS URI, not HTTP fetch).
 *
 * Removed from source:
 *   - buildArtifactUrl / getForgeConfig / artifactPort (cloud path uses Convex props)
 *   - async switchToSource / fetchedSource / isFetching (textContent in props, D-01)
 *   - video / audio / pdf / binary inline renderers (not-previewable fallback in cloud)
 */

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "./FileBrowser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreviewMode = "preview" | "source";

export interface ArtifactPreviewProps {
  /** Text/HTML content for previewable text artifacts (from forgeArtifacts.textContent). */
  textContent?: string;
  /** Convex File Storage URL for image artifacts (from ctx.storage.getUrl). */
  imageUrl?: string | null;
  /** Kind tag — drives which renderer is used. */
  fileKind: string;
  /** File size in bytes — used in the not-previewable fallback copy. */
  sizeBytes: number;
  /** Workspace rootPath — for local-path fallback text + VS Code deep link. */
  rootPath: string;
  /** Relative file path within workspace — for VS Code deep link. */
  filePath: string;
  /** Default view mode for text/HTML. Defaults to "preview". */
  defaultMode?: PreviewMode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOT_PREVIEWABLE_KINDS = ["video", "audio", "pdf", "binary"];

// ---------------------------------------------------------------------------
// ArtifactPreview
// ---------------------------------------------------------------------------

export function ArtifactPreview({
  textContent,
  imageUrl,
  fileKind,
  sizeBytes,
  rootPath,
  filePath,
  defaultMode = "preview",
}: ArtifactPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(defaultMode);

  // --- No file selected ---
  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-base text-muted-foreground">
        Select a file to preview
      </div>
    );
  }

  const vsCodeHref = `vscode://file/${rootPath}/${filePath}`;

  // --- Not-previewable fallback: >1 MB or video/audio/pdf/binary ---
  if (sizeBytes > 1_048_576 || NOT_PREVIEWABLE_KINDS.includes(fileKind)) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-base text-muted-foreground">
          Not previewable in cloud ({formatFileSize(sizeBytes)} / {fileKind})
        </p>
        <p className="text-[12px] font-mono text-muted-foreground break-all">
          Local path: {rootPath}/{filePath}
        </p>
        <a
          href={vsCodeHref}
          className="inline-flex items-center gap-1 text-[12px] text-blue-500"
          title="Best-effort — same machine only"
        >
          Open in VS Code <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        <p className="text-xs text-muted-foreground">
          VS Code link is best-effort (same machine only)
        </p>
      </div>
    );
  }

  // --- Text / HTML preview (≤ 1 MB) ---
  if (fileKind === "text" && textContent !== undefined) {
    // SECURITY INVARIANT (T-82-10): sandbox="allow-scripts" is a single token.
    // No additional sandbox tokens are permitted. src is a data: URI (null origin).
    const dataSrc = `data:text/html;charset=utf-8,${encodeURIComponent(textContent)}`;

    return (
      <div className="flex flex-col h-full">
        {/* Toggle bar */}
        <div
          className="flex gap-1 px-4 py-2 border-b border-border bg-card shrink-0"
          role="group"
          aria-label="Preview mode"
        >
          <Button
            variant={mode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("preview")}
            aria-pressed={mode === "preview"}
          >
            Preview
          </Button>
          <Button
            variant={mode === "source" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("source")}
            aria-pressed={mode === "source"}
          >
            Source
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === "preview" ? (
            /* SECURITY INVARIANT (T-82-10): sandbox="allow-scripts" — single token only.
               src is a data: URI — null origin, no network round-trip.
               Agent-generated HTML executes scripts in a null-origin sandbox,
               isolated from the parent DOM, cookies, and window state. */
            <iframe
              src={dataSrc}
              sandbox="allow-scripts"
              title="Artifact preview"
              style={{ width: "100%", height: "100%", border: "none", minHeight: "240px" }}
            />
          ) : (
            /* SECURITY INVARIANT (T-82-10): React text node — auto-escaped.
               A <script> in textContent renders as &lt;script&gt; (escaped text).
               Direct innerHTML assignment is never used here. */
            <pre className="m-0 p-4 font-mono text-[13px] leading-[1.538] text-foreground bg-background overflow-auto h-full whitespace-pre-wrap">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // --- Text file with textContent absent (preview unavailable) ---
  if (fileKind === "text" && textContent === undefined) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-base text-muted-foreground">Preview unavailable.</p>
        <p className="text-[12px] font-mono text-muted-foreground break-all">
          Local path: {rootPath}/{filePath}
        </p>
        <a
          href={vsCodeHref}
          className="inline-flex items-center gap-1 text-[12px] text-blue-500"
          title="Best-effort — same machine only"
        >
          Open in VS Code <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        <p className="text-xs text-muted-foreground">
          VS Code link is best-effort (same machine only)
        </p>
      </div>
    );
  }

  // --- Image inline (≤ 1 MB) ---
  if (fileKind === "image" && imageUrl) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        {/* imageUrl is a Convex File Storage URL — passed to src attr only, no innerHTML */}
        <img
          src={imageUrl}
          alt={filePath}
          className="max-w-full max-h-full object-contain"
          style={{ maxHeight: "80vh" }}
        />
      </div>
    );
  }

  // --- Image with imageUrl absent ---
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-base text-muted-foreground">Preview unavailable.</p>
      <p className="text-[12px] font-mono text-muted-foreground break-all">
        Local path: {rootPath}/{filePath}
      </p>
      <a
        href={vsCodeHref}
        className="inline-flex items-center gap-1 text-[12px] text-blue-500"
        title="Best-effort — same machine only"
      >
        Open in VS Code <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
      <p className="text-xs text-muted-foreground">
        VS Code link is best-effort (same machine only)
      </p>
    </div>
  );
}
