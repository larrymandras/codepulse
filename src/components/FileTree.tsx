import { useState, useMemo } from "react";
import { useFileOpsSummary } from "../hooks/useFileOps";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

interface FileTreeProps {
  sessionId: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  ops: number;
  linesChanged: number;
  lastOp: string;
}

const OP_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  write: { text: "text-green-400", bg: "bg-green-400/10", dot: "bg-green-400" },
  edit: { text: "text-yellow-400", bg: "bg-yellow-400/10", dot: "bg-yellow-400" },
  read: { text: "text-blue-400", bg: "bg-blue-400/10", dot: "bg-blue-400" },
};

function buildTree(
  files: { filePath: string; ops: number; linesChanged: number; lastOp: string }[]
): TreeNode {
  const root: TreeNode = {
    name: "",
    fullPath: "",
    isDir: true,
    children: new Map(),
    ops: 0,
    linesChanged: 0,
    lastOp: "",
  };

  for (const file of files) {
    const parts = file.filePath.replace(/\\/g, "/").split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: parts.slice(0, i + 1).join("/"),
          isDir: !isLast,
          children: new Map(),
          ops: 0,
          linesChanged: 0,
          lastOp: "",
        });
      }

      const child = current.children.get(part)!;

      if (isLast) {
        child.ops = file.ops;
        child.linesChanged = file.linesChanged;
        child.lastOp = file.lastOp;
        child.isDir = false;
      }

      // Bubble up counts to parent
      current.ops += file.ops;
      current.linesChanged += file.linesChanged;

      current = child;
    }
  }

  return root;
}

function collapseOnlyChildren(node: TreeNode): TreeNode {
  // If a dir has exactly 1 child dir, merge them: "src" → "components" → "src/components"
  if (node.isDir && node.children.size === 1) {
    const [child] = node.children.values();
    if (child.isDir) {
      const merged: TreeNode = {
        ...child,
        name: node.name ? `${node.name}/${child.name}` : child.name,
      };
      return collapseOnlyChildren(merged);
    }
  }

  // Recurse into children
  const newChildren = new Map<string, TreeNode>();
  for (const [key, child] of node.children) {
    newChildren.set(key, collapseOnlyChildren(child));
  }
  return { ...node, children: newChildren };
}

function TreeNodeRow({
  node,
  depth,
  maskPath,
}: {
  node: TreeNode;
  depth: number;
  maskPath: (p: string) => string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const sortedChildren = useMemo(() => {
    const dirs: TreeNode[] = [];
    const files: TreeNode[] = [];
    for (const child of node.children.values()) {
      if (child.isDir) dirs.push(child);
      else files.push(child);
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => b.ops - a.ops);
    return [...dirs, ...files];
  }, [node.children]);

  const opStyle = OP_COLORS[node.lastOp] ?? OP_COLORS.read;

  if (!node.isDir) {
    // File leaf
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-700/20 transition-colors"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opStyle.dot}`} />
        <span className="text-xs text-gray-200 font-mono truncate flex-1">
          {maskPath(node.name)}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${opStyle.text} ${opStyle.bg}`}>
          {node.lastOp}
        </span>
        <span className="text-[10px] text-gray-500">{node.ops}×</span>
        {node.linesChanged > 0 && (
          <span className="text-[10px] text-gray-600">{node.linesChanged}L</span>
        )}
      </div>
    );
  }

  // Directory
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-700/20 transition-colors text-left"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <span className="text-[10px] text-gray-600 w-3 shrink-0">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="text-xs text-gray-400 font-mono truncate flex-1">
          {maskPath(node.name)}/
        </span>
        <span className="text-[10px] text-gray-600">{node.ops}×</span>
      </button>
      {expanded &&
        sortedChildren.map((child) => (
          <TreeNodeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            maskPath={maskPath}
          />
        ))}
    </div>
  );
}

export default function FileTree({ sessionId }: FileTreeProps) {
  const summary = useFileOpsSummary(sessionId);
  const { maskFilePath } = usePrivacyMask();

  const tree = useMemo(() => {
    const raw = buildTree(summary);
    return collapseOnlyChildren(raw);
  }, [summary]);

  const writeCount = summary.filter((f: any) => f.lastOp === "write").length;
  const editCount = summary.filter((f: any) => f.lastOp === "edit").length;
  const readCount = summary.filter((f: any) => f.lastOp === "read").length;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          File Tree ({summary.length} files)
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-400" /> Write ({writeCount})
          </span>
          <span className="flex items-center gap-1 text-[9px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-yellow-400" /> Edit ({editCount})
          </span>
          <span className="flex items-center gap-1 text-[9px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Read ({readCount})
          </span>
        </div>
      </div>

      {summary.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No file operations yet</p>
      ) : (
        <div className="max-h-[500px] overflow-y-auto -mx-1">
          {[...tree.children.values()]
            .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
            .map((child) => (
              <TreeNodeRow key={child.fullPath} node={child} depth={0} maskPath={maskFilePath} />
            ))}
        </div>
      )}
    </div>
  );
}
