import { useState } from "react";
import { useFileOpsSummary, useFileOps } from "../hooks/useFileOps";
import { truncatePath } from "../lib/formatters";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

interface FileOpsPanelProps {
  sessionId: string;
}

type SortMode = "recency" | "frequency";

function opColor(operation: string): string {
  switch (operation) {
    case "write":
      return "text-green-400";
    case "edit":
      return "text-yellow-400";
    case "read":
      return "text-blue-400";
    default:
      return "text-muted-foreground";
  }
}

function opDot(operation: string): string {
  switch (operation) {
    case "write":
      return "bg-green-400";
    case "edit":
      return "bg-yellow-400";
    case "read":
      return "bg-blue-400";
    default:
      return "bg-muted-foreground";
  }
}

function getDirectory(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
}

export default function FileOpsPanel({ sessionId }: FileOpsPanelProps) {
  const summary = useFileOpsSummary(sessionId);
  const allOps = useFileOps(sessionId);
  const [sortMode, setSortMode] = useState<SortMode>("recency");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const { maskFilePath } = usePrivacyMask();

  const sorted = [...summary].sort((a, b) =>
    sortMode === "recency"
      ? b.lastTimestamp - a.lastTimestamp
      : b.ops - a.ops
  );

  // Group by directory
  const groups = new Map<string, typeof sorted>();
  for (const file of sorted) {
    const dir = getDirectory(file.filePath);
    const existing = groups.get(dir);
    if (existing) {
      existing.push(file);
    } else {
      groups.set(dir, [file]);
    }
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">File Operations</h2>
        <button
          onClick={() => setSortMode(sortMode === "recency" ? "frequency" : "recency")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted"
        >
          Sort: {sortMode === "recency" ? "Recent" : "Frequent"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-base text-muted-foreground py-6 text-center">No file operations yet</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {Array.from(groups.entries()).map(([dir, files]) => (
            <div key={dir}>
              <p className="text-sm text-muted-foreground font-mono mb-1">{maskFilePath(truncatePath(dir, 50))}/</p>
              <div className="space-y-1 ml-2">
                {files.map((file) => {
                  const fileName = file.filePath.split("/").pop() ?? file.filePath;
                  const isExpanded = expandedFile === file.filePath;
                  const fileOps = isExpanded
                    ? allOps.filter((op) => op.filePath === file.filePath)
                    : [];

                  return (
                    <div key={file.filePath}>
                      <button
                        onClick={() => setExpandedFile(isExpanded ? null : file.filePath)}
                        className="w-full flex items-center gap-2 text-left py-1 px-2 rounded hover:bg-[var(--surface-3)]/30 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opDot(file.lastOp)}`} />
                        <span className="text-base text-foreground font-mono truncate flex-1">
                          {fileName}
                        </span>
                        <span className="text-sm text-muted-foreground flex-shrink-0">
                          {file.ops} op{file.ops !== 1 ? "s" : ""}
                        </span>
                        {file.linesChanged > 0 && (
                          <span className="text-sm text-muted-foreground flex-shrink-0">
                            {file.linesChanged}L
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground flex-shrink-0">
                          {isExpanded ? "v" : ">"}
                        </span>
                      </button>

                      {isExpanded && fileOps.length > 0 && (
                        <div className="ml-6 mt-1 mb-2 space-y-1 border-l border-border pl-3">
                          {fileOps.map((op, i) => {
                            const d = new Date(op.timestamp * 1000);
                            const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                            return (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={opColor(op.operation)}>{op.operation}</span>
                                <span className="text-muted-foreground">{time}</span>
                                {op.linesChanged != null && op.linesChanged > 0 && (
                                  <span className="text-muted-foreground">{op.linesChanged}L</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
