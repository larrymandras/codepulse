import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { rollbackAgent } from "@/lib/astridrApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  History,
  GitCompareArrows,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface DetailVersionsTabProps {
  agentId: string;
}

const CHANGE_TYPE_COLORS: Record<string, string> = {
  create: "bg-green-600 text-white",
  update: "bg-blue-600 text-white",
  clone: "bg-purple-600 text-white",
  import: "bg-amber-600 text-white",
  rollback: "bg-red-600 text-white",
};

function formatTimestamp(epochSecs: number): string {
  return new Date(epochSecs * 1000).toLocaleString();
}

/** Compute structured diff between two config objects. */
export function computeDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Array<{ field: string; oldVal: unknown; newVal: unknown; type: "added" | "removed" | "changed" }> {
  const diffs: Array<{ field: string; oldVal: unknown; newVal: unknown; type: "added" | "removed" | "changed" }> = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of Array.from(allKeys).sort()) {
    if (key === "id") continue;
    const oldVal = a[key];
    const newVal = b[key];
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);

    if (oldStr !== newStr) {
      if (oldVal === undefined) {
        diffs.push({ field: key, oldVal, newVal, type: "added" });
      } else if (newVal === undefined) {
        diffs.push({ field: key, oldVal, newVal, type: "removed" });
      } else {
        diffs.push({ field: key, oldVal, newVal, type: "changed" });
      }
    }
  }
  return diffs;
}

function DiffBadge({ type }: { type: "added" | "removed" | "changed" }) {
  const colors = {
    added: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    removed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    changed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[type]}`}>
      {type}
    </span>
  );
}

function ValueDisplay({ value }: { value: unknown }) {
  if (value === undefined) return <span className="text-muted-foreground italic">--</span>;
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length > 100) {
    return (
      <pre className="text-xs font-mono bg-muted p-1.5 rounded max-h-24 overflow-auto whitespace-pre-wrap break-all">
        {str}
      </pre>
    );
  }
  return <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">{str}</code>;
}

export function DetailVersionsTab({ agentId }: DetailVersionsTabProps) {
  const versions = useQuery(api.agentConfigVersions.listByAgent, { agentId });

  // Diff state: select two versions
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState<{
    version: number;
    config: Record<string, unknown>;
  } | null>(null);
  const [rolling, setRolling] = useState(false);

  // Expanded version details
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  // Diff comparison data
  const compareData = useQuery(
    api.agentConfigVersions.compareVersions,
    diffA !== null && diffB !== null
      ? { agentId, versionA: diffA, versionB: diffB }
      : "skip",
  );

  const diffResults = useMemo(() => {
    if (!compareData?.a?.config || !compareData?.b?.config) return null;
    return computeDiff(
      compareData.a.config as Record<string, unknown>,
      compareData.b.config as Record<string, unknown>,
    );
  }, [compareData]);

  const handleDiffSelect = (version: number) => {
    if (diffA === null) {
      setDiffA(version);
    } else if (diffB === null && version !== diffA) {
      setDiffB(version);
      setShowDiff(true);
    } else {
      // Reset
      setDiffA(version);
      setDiffB(null);
      setShowDiff(false);
    }
  };

  const clearDiff = () => {
    setDiffA(null);
    setDiffB(null);
    setShowDiff(false);
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRolling(true);
    try {
      await rollbackAgent(agentId, {
        config: rollbackTarget.config,
        target_version: rollbackTarget.version,
        author: "codepulse",
      });
      toast.success(`Rolled back to version ${rollbackTarget.version}`);
      setRollbackTarget(null);
    } catch {
      toast.error("Rollback failed");
    } finally {
      setRolling(false);
    }
  };

  if (versions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <History className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No version history yet. Versions are recorded when config is saved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Diff selection hint */}
      {diffA !== null && diffB === null && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
          Selected v{diffA} for comparison. Click another version to compare, or{" "}
          <button className="underline" onClick={clearDiff}>
            cancel
          </button>
          .
        </div>
      )}

      {/* Diff viewer */}
      {showDiff && diffResults && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">
                Comparing v{diffA} vs v{diffB}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearDiff} className="text-xs h-6">
              Close
            </Button>
          </div>

          {diffResults.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No differences found between these versions.
            </p>
          ) : (
            <div className="space-y-2">
              {diffResults.map((d) => (
                <div key={d.field} className="border rounded p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{d.field}</span>
                    <DiffBadge type={d.type} />
                  </div>
                  {d.type !== "added" && (
                    <div className="flex items-start gap-1">
                      <span className="text-[10px] text-red-500 font-mono mt-0.5">-</span>
                      <ValueDisplay value={d.oldVal} />
                    </div>
                  )}
                  {d.type !== "removed" && (
                    <div className="flex items-start gap-1">
                      <span className="text-[10px] text-green-500 font-mono mt-0.5">+</span>
                      <ValueDisplay value={d.newVal} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version list */}
      {versions.map((v) => {
        const isExpanded = expandedVersion === v.version;
        const isSelectedForDiff = v.version === diffA || v.version === diffB;
        return (
          <div
            key={v._id}
            className={`border rounded-lg p-3 transition-colors ${
              isSelectedForDiff ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">v{v.version}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${CHANGE_TYPE_COLORS[v.changeType] ?? ""}`}
                  >
                    {v.changeType}
                  </Badge>
                  {v.parentVersion && (
                    <span className="text-[10px] text-muted-foreground">
                      from v{v.parentVersion}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {v.changeSummary}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{formatTimestamp(v.createdAt)}</span>
                  {v.author && <span>by {v.author}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Diff select button */}
                <Button
                  variant={isSelectedForDiff ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[10px] px-2"
                  onClick={() => handleDiffSelect(v.version)}
                  aria-label={`Compare version ${v.version}`}
                >
                  <GitCompareArrows className="h-3 w-3" />
                </Button>

                {/* Rollback button (not on latest version) */}
                {v.version !== versions[0]?.version && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() =>
                      setRollbackTarget({
                        version: v.version,
                        config: v.config as Record<string, unknown>,
                      })
                    }
                    aria-label={`Rollback to version ${v.version}`}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}

                {/* Expand/collapse config */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2"
                  onClick={() =>
                    setExpandedVersion(isExpanded ? null : v.version)
                  }
                  aria-label={isExpanded ? `Collapse version ${v.version}` : `Expand version ${v.version}`}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Expanded config snapshot */}
            {isExpanded && (
              <pre className="mt-2 text-xs font-mono bg-muted p-2 rounded max-h-48 overflow-auto">
                {JSON.stringify(v.config, null, 2)}
              </pre>
            )}
          </div>
        );
      })}

      {/* Rollback confirmation dialog */}
      <Dialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback to version {rollbackTarget?.version}?</DialogTitle>
            <DialogDescription>
              This will apply the config from version {rollbackTarget?.version} as a
              new version. The current config will be preserved in version history.
              If the agent is running, it will be hot-reloaded with the rolled-back config.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRollback} disabled={rolling}>
              {rolling && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DetailVersionsTab;
