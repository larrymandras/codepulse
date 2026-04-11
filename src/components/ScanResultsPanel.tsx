/**
 * ScanResultsPanel — security scan findings for a single tool.
 *
 * Phase 56 Plan 05: CPCC-06 / SCAN-05.
 *
 * Renders as a collapsible/expandable panel within the Agents page.
 * Each finding shows: severity badge, category label, description,
 * optional suggestedFix, and a dismiss button.
 *
 * Severity badge colors per UI-SPEC scan color rules:
 *   HIGH   → bg-(--status-error)  text-(--foreground)
 *   MEDIUM → bg-(--status-warn)   text-(--foreground)
 *   LOW    → bg-(--status-ok)     text-(--foreground)
 *   SAFE   → text-(--muted-foreground) plain text "Clean"
 */

import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronRight, X } from "lucide-react";

export interface ScanFinding {
  _id: string;
  severity: string;
  category: string;
  description: string;
  suggestedFix?: string;
  dismissed: boolean;
}

interface ScanResultsPanelProps {
  toolName: string;
  findings: ScanFinding[];
  onDismiss: (id: string) => void;
}

/** Badge classes per severity level, per UI-SPEC. */
function severityBadgeClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case "HIGH":
      return "bg-(--status-error) text-(--foreground)";
    case "MEDIUM":
      return "bg-(--status-warn) text-(--foreground)";
    case "LOW":
      return "bg-(--status-ok) text-(--foreground)";
    default:
      return "bg-gray-700/40 text-(--muted-foreground)";
  }
}

/** Returns the highest-severity label from a list of findings. */
export function highestSeverity(findings: ScanFinding[]): string {
  if (findings.some((f) => f.severity.toUpperCase() === "HIGH")) return "HIGH";
  if (findings.some((f) => f.severity.toUpperCase() === "MEDIUM")) return "MEDIUM";
  if (findings.some((f) => f.severity.toUpperCase() === "LOW")) return "LOW";
  return "SAFE";
}

/** Compact inline badge shown in the agent row before expansion. */
export function RiskLevelBadge({
  severity,
  onClick,
}: {
  severity: string;
  onClick?: () => void;
}) {
  if (severity.toUpperCase() === "SAFE") {
    return (
      <span className="text-[10px] text-(--muted-foreground)" onClick={onClick}>
        Clean
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${severityBadgeClass(severity)}`}
    >
      {severity.toUpperCase()}
    </button>
  );
}

export function ScanResultsPanel({
  toolName,
  findings,
  onDismiss,
}: ScanResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (findings.length === 0) {
    return (
      <span className="text-[10px] text-(--muted-foreground)">Clean</span>
    );
  }

  const topSeverity = highestSeverity(findings);

  return (
    <div className="space-y-1">
      {/* Row summary — click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 group"
        aria-expanded={expanded}
        aria-label={`Security findings for ${toolName}`}
      >
        <ShieldAlert className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <RiskLevelBadge severity={topSeverity} />
        <span className="text-[10px] text-(--muted-foreground)">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Expanded finding list */}
      {expanded && (
        <div className="mt-2 space-y-2 pl-2 border-l border-(--border)">
          {findings.map((finding) => (
            <div
              key={finding._id}
              className="bg-(--card) border border-(--border) rounded p-2 text-xs space-y-1"
            >
              {/* Severity + category + dismiss */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${severityBadgeClass(finding.severity)}`}
                >
                  {finding.severity.toUpperCase()}
                </span>
                <span className="text-(--muted-foreground) uppercase tracking-wide text-[10px]">
                  {finding.category}
                </span>
                <button
                  onClick={() => onDismiss(finding._id)}
                  className="ml-auto text-(--muted-foreground) hover:text-(--foreground) transition-colors"
                  aria-label="Dismiss finding"
                  title="Dismiss finding"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Description */}
              <p className="text-(--foreground) leading-snug">
                {finding.description}
              </p>

              {/* Suggested fix */}
              {finding.suggestedFix && (
                <p className="text-xs text-(--muted-foreground) italic">
                  Fix: {finding.suggestedFix}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
