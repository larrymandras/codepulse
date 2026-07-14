// Scan button (owned by IntakeModal) + auto-select chip / checkbox list +
// manual subpath fallback. Renders based purely on the scan hook's state —
// this component never calls scan()/reset() itself.
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ScanState } from "@/hooks/useGithubTreeScan";

export interface SkillCollectionPickerProps {
  scanState: ScanState;
  onSelectionChange: (paths: string[]) => void;
}

function skillNameFromPath(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx === -1) return path;
  const parentDir = path.slice(0, idx);
  const dirIdx = parentDir.lastIndexOf("/");
  return dirIdx === -1 ? parentDir : parentDir.slice(dirIdx + 1);
}

function ManualSubpathFallback({
  message,
  onSelectionChange,
}: {
  message: string;
  onSelectionChange: (paths: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="space-y-1">
        <label htmlFor="skill-collection-subpath" className="text-sm font-medium">
          Subpath (optional) — e.g. skills/foo
        </label>
        <Input
          id="skill-collection-subpath"
          placeholder="Subpath (optional) — e.g. skills/foo"
          onChange={(e) => {
            const value = e.target.value;
            onSelectionChange(value.trim() ? [value.trim()] : []);
          }}
        />
      </div>
    </div>
  );
}

function TruncatedWarning() {
  return (
    <p className="text-sm text-muted-foreground">
      repository too large to fully scan — some skills may be missing; use the manual subpath
      field
    </p>
  );
}

export function SkillCollectionPicker({
  scanState,
  onSelectionChange,
}: SkillCollectionPickerProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const skillPaths = scanState.status === "done" ? scanState.result.skillPaths : [];
  const singlePath = skillPaths.length === 1 ? skillPaths[0] : null;

  // CR-01: auto-select keys off the DERIVED STABLE STRING (singlePath), never
  // the scanState object — the real hook may hand us a fresh object identity
  // per render, and depending on it re-emitted a fresh array every render,
  // looping until "Maximum update depth exceeded". The ref additionally
  // guards against re-emitting the same selection if the callback identity
  // changes (e.g. a parent passing an inline lambda).
  const lastAutoSelected = useRef<string | null>(null);
  useEffect(() => {
    if (singlePath === null) {
      lastAutoSelected.current = null;
      return;
    }
    if (lastAutoSelected.current !== singlePath) {
      lastAutoSelected.current = singlePath;
      onSelectionChange([singlePath]);
    }
  }, [singlePath, onSelectionChange]);

  if (scanState.status === "idle" || scanState.status === "scanning") {
    return null;
  }

  if (scanState.status === "error") {
    return (
      <ManualSubpathFallback
        message={`Scan failed: ${scanState.errorMessage}. You can still submit — the CLI resolves the skill itself.`}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  // status === "done"
  const { result } = scanState;

  if (result.skillPaths.length === 0) {
    return (
      <div className="space-y-2">
        {result.truncated && <TruncatedWarning />}
        <ManualSubpathFallback
          message="Scan failed: no SKILL.md files found. You can still submit — the CLI resolves the skill itself."
          onSelectionChange={onSelectionChange}
        />
      </div>
    );
  }

  if (result.skillPaths.length === 1 && singlePath) {
    return (
      <div className="space-y-2">
        {result.truncated && <TruncatedWarning />}
        <div className="rounded-md border border-border p-2 text-sm">
          <span className="font-medium">1 skill found</span>{" "}
          <span className="font-mono text-xs text-muted-foreground">{singlePath}</span>
        </div>
      </div>
    );
  }

  const allChecked = checked.size === result.skillPaths.length;

  const toggleAll = () => {
    const next = allChecked ? new Set<string>() : new Set(result.skillPaths);
    setChecked(next);
    onSelectionChange(Array.from(next));
  };

  const togglePath = (path: string) => {
    const next = new Set(checked);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setChecked(next);
    onSelectionChange(Array.from(next));
  };

  return (
    <div className="space-y-2">
      {result.truncated && <TruncatedWarning />}
      <p className="text-sm font-medium">{result.skillPaths.length} skills found</p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
        Select all
      </label>
      <div className="space-y-1">
        {result.skillPaths.map((path) => (
          <label key={path} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checked.has(path)}
              onCheckedChange={() => togglePath(path)}
              aria-label={skillNameFromPath(path)}
            />
            <span>{skillNameFromPath(path)}</span>
            <span className="font-mono text-xs text-muted-foreground">{path}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
