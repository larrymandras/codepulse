import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Folder,
  FolderOpen,
  ChevronUp,
  GripVertical,
  X,
  Plus,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  HardDrive,
} from "lucide-react";

const BRIDGE_URL = "http://localhost:8765";

interface DirEntry {
  path: string;
  label: string;
}

interface BrowseResult {
  path: string;
  parent: string;
  entries: string[];
}

type BridgeStatus = "connected" | "disconnected" | "restarting";

// ---------------------------------------------------------------------------
// Bridge API helpers
// ---------------------------------------------------------------------------

async function fetchBridgeHealth(): Promise<{ status: string; dirs: string[] } | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function fetchDirs(): Promise<DirEntry[]> {
  const res = await fetch(`${BRIDGE_URL}/dirs`);
  if (!res.ok) throw new Error("Failed to fetch dirs");
  return res.json();
}

async function saveDirs(dirs: DirEntry[]): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/dirs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dirs),
  });
  if (!res.ok) throw new Error("Failed to save dirs");
}

async function browsePath(targetPath: string): Promise<BrowseResult> {
  const res = await fetch(`${BRIDGE_URL}/browse?path=${encodeURIComponent(targetPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Browse failed" }));
    throw new Error(err.error);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sortable allowed-dir row
// ---------------------------------------------------------------------------

function SortableDir({
  entry,
  onRemove,
}: {
  entry: DirEntry;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-gray-900/40 rounded-lg px-3 py-2 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-600 hover:text-gray-400 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate font-mono">{entry.path}</p>
        {entry.label && (
          <p className="text-xs text-gray-500 truncate">{entry.label}</p>
        )}
      </div>
      {confirmRemove ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-400 mr-1">Remove?</span>
          <button
            onClick={onRemove}
            className="text-red-400 hover:text-red-300 text-xs px-2 py-0.5 bg-red-900/30 rounded"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmRemove(false)}
            className="text-gray-400 hover:text-gray-300 text-xs px-2 py-0.5 bg-gray-700/50 rounded"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRemove(true)}
          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay (follows cursor)
// ---------------------------------------------------------------------------

function DragPreview({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 bg-indigo-900/80 border border-indigo-500/50 rounded-lg px-3 py-2 shadow-lg">
      <Folder className="w-4 h-4 text-indigo-300" />
      <span className="text-sm text-indigo-200 font-mono truncate max-w-[260px]">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop zone in the allowed panel
// ---------------------------------------------------------------------------

function AllowedDropZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={`border-2 border-dashed rounded-lg px-4 py-3 text-center transition-colors ${
        isOver
          ? "border-indigo-500 bg-indigo-900/20 text-indigo-400"
          : "border-gray-700 text-gray-600"
      }`}
    >
      <p className="text-xs">Drag folder here to allow access</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Browser panel folder row (draggable source)
// ---------------------------------------------------------------------------

function BrowserFolder({
  name,
  fullPath,
  isAllowed,
  onNavigate,
  onAdd,
}: {
  name: string;
  fullPath: string;
  isAllowed: boolean;
  onNavigate: () => void;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `browse:${fullPath}`,
    data: { type: "browser", path: fullPath, name },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 group cursor-pointer transition-colors ${
        isDragging
          ? "opacity-40"
          : "hover:bg-gray-700/50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-600 hover:text-gray-400 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <button
        onClick={onNavigate}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <FolderOpen className="w-4 h-4 text-amber-500/80 shrink-0" />
        <span className="text-sm text-gray-300 truncate">{name}</span>
      </button>
      {isAllowed ? (
        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="text-gray-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Add to allowed"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FilesystemAccess() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("disconnected");
  const [serverDirs, setServerDirs] = useState<DirEntry[]>([]);
  const [localDirs, setLocalDirs] = useState<DirEntry[]>([]);
  const [browseDir, setBrowseDir] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"idle" | "saved" | "error">("idle");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const initialLoadDone = useRef(false);

  const { setNodeRef: dropRef, isOver } = useDroppable({ id: "allowed-drop-zone" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allowedPaths = new Set(localDirs.map((d) => d.path));

  const pendingChanges = (() => {
    if (serverDirs.length !== localDirs.length) return true;
    return serverDirs.some(
      (s, i) => s.path !== localDirs[i]?.path || s.label !== localDirs[i]?.label
    );
  })();

  const changeCount = (() => {
    const serverPaths = new Set(serverDirs.map((d) => d.path));
    const localPathSet = new Set(localDirs.map((d) => d.path));
    let count = 0;
    for (const p of localPathSet) if (!serverPaths.has(p)) count++;
    for (const p of serverPaths) if (!localPathSet.has(p)) count++;
    if (count === 0 && pendingChanges) count = 1;
    return count;
  })();

  // -- Load bridge state on mount --
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    (async () => {
      const health = await fetchBridgeHealth();
      if (!health) {
        setBridgeStatus("disconnected");
        return;
      }
      setBridgeStatus(health.status === "ok" ? "connected" : "restarting");

      let dirs: DirEntry[];
      try {
        dirs = await fetchDirs();
      } catch {
        // Fallback: bridge running old code without /dirs endpoint
        dirs = health.dirs.map((p: string) => ({ path: p, label: "" }));
      }
      setServerDirs(dirs);
      setLocalDirs(dirs);

      try {
        const home =
          navigator.userAgent.includes("Win")
            ? "C:\\Users"
            : "/home";
        const result = await browsePath(home);
        setBrowseDir(result);
      } catch {
        // Browse not available — browser panel stays empty until bridge is updated
      }
    })();
  }, []);

  // -- Browse navigation --
  const navigate = useCallback(async (targetPath: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const result = await browsePath(targetPath);
      setBrowseDir(result);
    } catch (err: unknown) {
      setBrowseError(err instanceof Error ? err.message : "Browse failed");
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  // -- Add a directory --
  const addDir = useCallback(
    (fullPath: string) => {
      if (allowedPaths.has(fullPath)) return;
      const name = fullPath.split(/[\\/]/).pop() || fullPath;
      setLocalDirs((prev) => [...prev, { path: fullPath, label: name }]);
    },
    [allowedPaths]
  );

  // -- Remove a directory --
  const removeDir = useCallback((dirPath: string) => {
    setLocalDirs((prev) => prev.filter((d) => d.path !== dirPath));
  }, []);

  // -- Apply & restart --
  const applyChanges = useCallback(async () => {
    setSaving(true);
    setSaveResult("idle");
    try {
      await saveDirs(localDirs);
      setServerDirs([...localDirs]);
      setSaveResult("saved");
      setBridgeStatus("restarting");
      setTimeout(() => {
        setBridgeStatus("connected");
        setSaveResult("idle");
      }, 3000);
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
    }
  }, [localDirs]);

  // -- DnD handlers --
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Drag from browser to allowed drop zone
    if (activeId.startsWith("browse:") && overId === "allowed-drop-zone") {
      const fullPath = activeId.slice("browse:".length);
      addDir(fullPath);
      return;
    }

    // Drag from browser onto an existing allowed item
    if (activeId.startsWith("browse:") && !overId.startsWith("browse:")) {
      const fullPath = activeId.slice("browse:".length);
      addDir(fullPath);
      return;
    }

    // Reorder within allowed list
    if (!activeId.startsWith("browse:") && !overId.startsWith("browse:")) {
      if (activeId !== overId) {
        setLocalDirs((prev) => {
          const oldIndex = prev.findIndex((d) => d.path === activeId);
          const newIndex = prev.findIndex((d) => d.path === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
    }
  }

  // -- Derive drag label for overlay --
  const dragLabel = (() => {
    if (!activeDragId) return "";
    if (activeDragId.startsWith("browse:")) {
      const p = activeDragId.slice("browse:".length);
      return p.split(/[\\/]/).pop() || p;
    }
    const entry = localDirs.find((d) => d.path === activeDragId);
    return entry?.label || entry?.path.split(/[\\/]/).pop() || activeDragId;
  })();

  const statusColor =
    bridgeStatus === "connected"
      ? "text-emerald-400"
      : bridgeStatus === "restarting"
        ? "text-amber-400"
        : "text-red-400";

  const statusDot =
    bridgeStatus === "connected"
      ? "bg-emerald-400"
      : bridgeStatus === "restarting"
        ? "bg-amber-400"
        : "bg-red-400";

  const joinPath = (base: string, name: string) => {
    const sep = base.includes("/") ? "/" : "\\";
    return base.endsWith(sep) ? `${base}${name}` : `${base}${sep}${name}`;
  };

  // All sortable IDs: browser items + allowed items
  const browserIds = browseDir
    ? browseDir.entries.map((name) => `browse:${joinPath(browseDir.path, name)}`)
    : [];
  const allowedIds = localDirs.map((d) => d.path);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2"
          >
            <h2 className="text-sm font-semibold text-gray-300">
              Filesystem Access
            </h2>
            <span className="text-xs text-gray-500">
              {collapsed ? "+" : "-"}
            </span>
          </button>
          <p className="text-xs text-gray-500 mt-0.5">
            Directories Astridr can read and write via MCP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span className={`text-xs ${statusColor}`}>
            {bridgeStatus === "connected"
              ? "Bridge connected"
              : bridgeStatus === "restarting"
                ? "Restarting..."
                : "Bridge offline"}
          </span>
        </div>
      </div>

      {collapsed ? null : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Left panel: Directory browser ── */}
            <div className="bg-gray-900/30 border border-gray-700/50 rounded-xl p-3 max-h-[420px] flex flex-col">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/30">
                <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-400 font-mono truncate flex-1">
                  {browseDir?.path || "Loading..."}
                </span>
                {browseDir?.parent && browseDir.parent !== browseDir.path && (
                  <button
                    onClick={() => navigate(browseDir.parent)}
                    className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-700/50"
                    title="Go up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                {browseLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  </div>
                )}
                {browseError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{browseError}</span>
                  </div>
                )}
                {!browseLoading && browseDir && (
                  <SortableContext
                    items={browserIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {browseDir.entries.length === 0 ? (
                      <p className="text-xs text-gray-600 py-4 text-center">
                        No subdirectories
                      </p>
                    ) : (
                      browseDir.entries.map((name) => {
                        const fullPath = joinPath(browseDir.path, name);
                        return (
                          <BrowserFolder
                            key={fullPath}
                            name={name}
                            fullPath={fullPath}
                            isAllowed={allowedPaths.has(fullPath)}
                            onNavigate={() => navigate(fullPath)}
                            onAdd={() => addDir(fullPath)}
                          />
                        );
                      })
                    )}
                  </SortableContext>
                )}
              </div>

              {/* Drive quick-nav */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700/30">
                {["C:\\", "D:\\"].map((drive) => (
                  <button
                    key={drive}
                    onClick={() => navigate(drive)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-700/50"
                  >
                    {drive}
                  </button>
                ))}
                <button
                  onClick={() => navigate("C:\\Users\\mandr")}
                  className="text-xs text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-700/50"
                >
                  ~
                </button>
              </div>
            </div>

            {/* ── Right panel: Allowed directories ── */}
            <div className="bg-gray-900/30 border border-gray-700/50 rounded-xl p-3 max-h-[420px] flex flex-col">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/30">
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-gray-400">
                  Allowed ({localDirs.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                <SortableContext
                  items={allowedIds}
                  strategy={verticalListSortingStrategy}
                >
                  {localDirs.map((entry) => (
                    <SortableDir
                      key={entry.path}
                      entry={entry}
                      onRemove={() => removeDir(entry.path)}
                    />
                  ))}
                </SortableContext>
              </div>

              {/* Drop zone */}
              <div ref={dropRef} className="mt-2">
                <AllowedDropZone isOver={isOver} />
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragId ? <DragPreview label={dragLabel} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Footer: pending changes + apply */}
      {!collapsed && (
        <div className="flex items-center justify-between">
          <div>
            {pendingChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {changeCount} unsaved {changeCount === 1 ? "change" : "changes"}
              </span>
            )}
            {saveResult === "saved" && (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3 h-3" />
                Applied — bridge restarting
              </span>
            )}
            {saveResult === "error" && (
              <span className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Failed to apply changes
              </span>
            )}
          </div>
          <button
            onClick={applyChanges}
            disabled={!pendingChanges || saving || bridgeStatus === "disconnected"}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Apply & Restart
          </button>
        </div>
      )}
    </div>
  );
}
