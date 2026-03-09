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
      return "text-gray-400";
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
      return "bg-gray-400";
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
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">File Operations</h2>
        <button
          onClick={() => setSortMode(sortMode === "recency" ? "frequency" : "recency")}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded bg-gray-700/50"
        >
          Sort: {sortMode === "recency" ? "Recent" : "Frequent"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No file operations yet</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {Array.from(groups.entries()).map(([dir, files]) => (
            <div key={dir}>
              <p className="text-xs text-gray-500 font-mono mb-1">{maskFilePath(truncatePath(dir, 50))}/</p>
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
                        className="w-full flex items-center gap-2 text-left py-1 px-2 rounded hover:bg-gray-700/30 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opDot(file.lastOp)}`} />
                        <span className="text-sm text-gray-100 font-mono truncate flex-1">
                          {fileName}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {file.ops} op{file.ops !== 1 ? "s" : ""}
                        </span>
                        {file.linesChanged > 0 && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {file.linesChanged}L
                          </span>
                        )}
                        <span className="text-xs text-gray-600 flex-shrink-0">
                          {isExpanded ? "v" : ">"}
                        </span>
                      </button>

                      {isExpanded && fileOps.length > 0 && (
                        <div className="ml-6 mt-1 mb-2 space-y-1 border-l border-gray-700 pl-3">
                          {fileOps.map((op, i) => {
                            const d = new Date(op.timestamp * 1000);
                            const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={opColor(op.operation)}>{op.operation}</span>
                                <span className="text-gray-500">{time}</span>
                                {op.linesChanged != null && op.linesChanged > 0 && (
                                  <span className="text-gray-600">{op.linesChanged}L</span>
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
