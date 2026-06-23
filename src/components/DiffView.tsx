/**
 * DiffView — Inline unified diff renderer with line numbers and oklch colors.
 * Phase 04 Plan 04: TM-03 (inline diff preview for Config Editor).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiffViewProps {
  original: string;
  current: string;
}

type DiffLineType = "added" | "removed" | "unchanged";

interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNum: number;
}

// ─── Diff algorithm ───────────────────────────────────────────────────────────

function computeDiff(original: string, current: string): DiffLine[] {
  const origLines = original.split("\n");
  const currLines = current.split("\n");
  const result: DiffLine[] = [];

  // Build LCS table
  const m = origLines.length;
  const n = currLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === currLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const rawLines: { type: DiffLineType; content: string }[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === currLines[j - 1]) {
      rawLines.unshift({ type: "unchanged", content: origLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawLines.unshift({ type: "added", content: currLines[j - 1] });
      j--;
    } else {
      rawLines.unshift({ type: "removed", content: origLines[i - 1] });
      i--;
    }
  }

  // Assign line numbers (sequential, 1-based)
  let lineNum = 1;
  for (const line of rawLines) {
    result.push({ ...line, lineNum: lineNum++ });
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiffView({ original, current }: DiffViewProps) {
  if (original === current) {
    return (
      <p className="text-base text-(--muted-foreground) italic py-4 text-center">
        No changes to review.
      </p>
    );
  }

  const lines = computeDiff(original, current);

  return (
    <div className="border border-(--border) bg-(--muted)/30 font-mono text-sm max-h-[300px] overflow-y-auto">
      {lines.map((line, idx) => {
        let bgClass = "";
        let prefixColorClass = "text-(--muted-foreground)";
        let prefix = " ";

        if (line.type === "added") {
          bgClass = "bg-(--status-ok)/15";
          prefixColorClass = "text-(--status-ok)";
          prefix = "+";
        } else if (line.type === "removed") {
          bgClass = "bg-(--status-error)/15";
          prefixColorClass = "text-(--status-error)";
          prefix = "-";
        }

        return (
          <div key={idx} className={`flex ${bgClass}`}>
            <span className="w-10 text-right pr-2 text-(--muted-foreground) select-none border-r border-(--border)">
              {line.lineNum}
            </span>
            <span className={`w-4 text-center font-bold ${prefixColorClass}`}>
              {prefix}
            </span>
            <span className="flex-1 px-2">{line.content}</span>
          </div>
        );
      })}
    </div>
  );
}
