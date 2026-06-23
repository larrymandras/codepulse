/**
 * FileBrowser — kind-grouped flat file list with VS Code deep links.
 *
 * Phase 82 (FI-12): Port + re-skin from forge/web/src/components/FileBrowser.tsx.
 * Re-sourced from Convex (ForgeFileRow[] from useForgeJobFiles), not http://127.0.0.1.
 * Style: inline CSS → Tailwind + Matrix Emerald tokens (Phase 71/82-UI-SPEC).
 *
 * Security (T-82-11 / SPEC Req 9):
 *   - Filenames/paths rendered as React text nodes {entry.path} — NEVER innerHTML.
 *   - VS Code deep link uses vscode://file/ prefix (opaque OS URI, not an HTTP fetch).
 *   - No onNavigate / folder drill-down: CodePulse port is flat-list only (SPEC boundary).
 *
 * D-04a: VS Code "Open in VS Code" link shown for ALL file kinds (not just text),
 *   labeled best-effort (same-machine only) — always give the user an action path.
 *
 * Kind-group ordering (locked): text → image → video → audio → pdf → binary (SPEC Req 4).
 */

import { ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ForgeFileRow } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Kind display config — locked order from SPEC Req 4
// ---------------------------------------------------------------------------

type DisplayKind = "text" | "image" | "video" | "audio" | "pdf" | "binary";

const KIND_ORDER: DisplayKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "pdf",
  "binary",
];

const KIND_LABEL: Record<DisplayKind, string> = {
  text: "TEXT",
  image: "IMAGES",
  video: "VIDEO",
  audio: "AUDIO",
  pdf: "PDF",
  binary: "BINARY",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format file size per 82-UI-SPEC: "< 1 KB", "48 KB", "1.2 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return "< 1 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build a vscode://file/<path> URI from workspace rootPath + file path.
 * VS Code's OS handler on Windows accepts both forward and backslash separators.
 */
function buildVsCodeHref(rootPath: string, filePath: string): string {
  return `vscode://file/${rootPath}/${filePath}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FileBrowserProps {
  /** File rows from useForgeJobFiles. */
  files: ForgeFileRow[];
  /** Workspace object — rootPath needed for VS Code deep links. */
  workspace: { rootPath: string };
  /** Called when a file row is clicked. */
  onSelectFile?: (entry: ForgeFileRow) => void;
  /** Currently selected file path (for selected-row styling). */
  selectedPath?: string;
}

// ---------------------------------------------------------------------------
// FileRow
// ---------------------------------------------------------------------------

interface FileRowProps {
  entry: ForgeFileRow;
  workspace: { rootPath: string };
  onSelectFile?: (entry: ForgeFileRow) => void;
  isSelected: boolean;
}

function FileRow({ entry, workspace, onSelectFile, isSelected }: FileRowProps) {
  const vsCodeHref = buildVsCodeHref(workspace.rootPath, entry.path);

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`flex items-center h-11 px-4 gap-2 cursor-pointer border-b border-border transition-colors focus-visible:outline-none focus-visible:bg-accent/50 ${
        isSelected
          ? "bg-accent/50 border-l-2 border-l-primary"
          : "hover:bg-accent/50"
      }`}
      onClick={() => onSelectFile?.(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectFile?.(entry);
        }
      }}
    >
      {/* Filename — React text node, NEVER innerHTML (T-82-11) */}
      <span className="text-base text-foreground truncate flex-1">
        {entry.path}
      </span>

      {/* Size annotation */}
      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
        {formatFileSize(entry.sizeBytes)}
      </span>

      {/* VS Code link — D-04a: shown for all kinds */}
      <a
        href={vsCodeHref}
        aria-label="Open in VS Code"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-[12px] text-blue-500 flex-shrink-0"
        title="Best-effort — same machine only"
      >
        Open in VS Code
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KindGroup
// ---------------------------------------------------------------------------

interface KindGroupProps {
  kind: DisplayKind;
  entries: ForgeFileRow[];
  workspace: { rootPath: string };
  onSelectFile?: (entry: ForgeFileRow) => void;
  selectedPath?: string;
}

function KindGroup({ kind, entries, workspace, onSelectFile, selectedPath }: KindGroupProps) {
  if (entries.length === 0) return null;

  return (
    <div>
      <Separator />
      <div className="px-4 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono bg-card">
        {KIND_LABEL[kind]}
      </div>
      <div role="list">
        {entries.map((entry) => (
          <FileRow
            key={entry.path}
            entry={entry}
            workspace={workspace}
            onSelectFile={onSelectFile}
            isSelected={selectedPath === entry.path}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileBrowser
// ---------------------------------------------------------------------------

/**
 * FileBrowser renders a kind-grouped flat file list.
 * No folder drill-down (SPEC boundary — flat recursive listing only).
 * Empty state: "No files found for this job." (running-job copy is in ForgeFilesPane).
 */
export function FileBrowser({
  files,
  workspace,
  onSelectFile,
  selectedPath,
}: FileBrowserProps) {
  // Group files by kind in the locked order
  const grouped = new Map<DisplayKind, ForgeFileRow[]>();
  for (const kind of KIND_ORDER) {
    grouped.set(kind, []);
  }
  for (const entry of files) {
    const kind = entry.kind as DisplayKind;
    if (grouped.has(kind)) {
      grouped.get(kind)!.push(entry);
    }
    // Unknown kinds silently skipped
  }

  // Empty state — handled here for when the caller renders FileBrowser directly
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-4 text-center">
        <p className="text-base text-muted-foreground">No files found for this job.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      {KIND_ORDER.map((kind) => (
        <KindGroup
          key={kind}
          kind={kind}
          entries={grouped.get(kind)!}
          workspace={workspace}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
        />
      ))}
    </ScrollArea>
  );
}
