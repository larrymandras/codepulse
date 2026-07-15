/**
 * IntakeReportView — CLI-02 report render for a done Intake row (Phase
 * 07-02, CP-06). Renders the frozen ReportEnvelope JSON (verdict, per-rule
 * findings, severity tally), a copyable CLI command reconstructing the
 * equivalent `skill-intake admit` invocation, and a collapsed raw-JSON
 * toggle. Distinguishes the `capAckReport` truncation stub from a real
 * report (Pitfall 3) — the CLI command remains the useful fallback when the
 * browser-rendered report is incomplete.
 *
 * Security (T-07-02-01, mitigate): every report-derived string renders via
 * React's default JSX text-node escaping — no raw-HTML-injection API is
 * used anywhere in this file — a hostile SKILL.md's content can reach these
 * strings indirectly via the CLI's own findings, so this is a real control,
 * not incidental.
 *
 * Scope note (D-P7-06 amendment, 2026-07-14): the frozen ReportEnvelope
 * contract carries no dry-run file-op list field, so nothing here can
 * represent one — see 07-CONTEXT.md's Deferred Ideas. Do not add a
 * placeholder or "coming soon" section for it.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  VerdictBadge,
  SeverityBadge,
} from "@/components/skills/IntakeStatusBadge";
import { useForgeWorkspace } from "@/hooks/useForge";
import type { IntakeCommandRow } from "@/hooks/useIntake";
import { pluralize } from "@/lib/formatters";

interface IntakeReportViewProps {
  row: IntakeCommandRow;
}

interface Finding {
  rule_id: string;
  severity: string;
  path: string | null;
  line: number | null;
  message: string;
}

/** Builds "2 errors · 1 warning" from a summary tally, error/warning/info order, zero counts omitted. */
function buildSeverityTally(
  summary: Record<string, number> | undefined
): string {
  const counts = {
    error: summary?.error ?? 0,
    warning: summary?.warning ?? 0,
    info: summary?.info ?? 0,
  };
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => pluralize(n, k))
    .join(" · ");
}

export function IntakeReportView({ row }: IntakeReportViewProps) {
  // Rules of Hooks: called unconditionally regardless of destination/status
  // branches below; useForgeWorkspace itself already no-ops on a null
  // workspaceId, and the guard return happens after every hook call.
  const [copied, setCopied] = useState(false);
  const workspace = useForgeWorkspace(
    row.hostId,
    row.destination === "project" ? row.workspaceId : null
  );

  // Defensive — this component should only ever be mounted for done rows
  // by IntakePanel (Task 2).
  if (row.status !== "done") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = row.report as any;
  const truncated = report?.truncated === true;

  const destination = row.destination ?? "global";
  // Claude's Discretion (documented per plan): prefer the CLI's own resolved
  // input string when the report carries it, fall back to the submitted
  // GitHub URL, then the uploaded file's original name, then a placeholder —
  // the browser cannot know an uploaded file's original local filesystem
  // path, only its filename.
  const src =
    report?.candidate?.input ??
    row.githubUrl ??
    row.fileName ??
    "<path to SKILL.md>";
  // WR-06: src and rootPath are interpolated into a command the UI invites
  // the operator to copy-run — quote them so paths with spaces survive the
  // paste, and escape embedded double quotes so a report-derived (hostile-
  // influenceable, per T-07-02-01) string cannot break out of its operand.
  // `destination` is a controlled enum and needs no quoting.
  const quoteArg = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const command = `skill-intake admit ${quoteArg(src)} --to ${destination} --write${
    destination === "project"
      ? ` --project ${quoteArg(workspace?.rootPath ?? "<workspace path>")}`
      : ""
  }`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {truncated ? (
        <p className="text-sm text-foreground">
          Report too large to store — run the CLI command below for the full
          report.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={report?.verdict ?? "error"} />
            <span className="text-sm text-muted-foreground">
              {buildSeverityTally(report?.summary)}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>File:line</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((report?.findings ?? []) as Finding[]).map((finding, i) => (
                <TableRow key={`${finding.rule_id}-${i}`}>
                  <TableCell>{finding.rule_id}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {finding.path ?? "—"}
                      {finding.line ? `:${finding.line}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{finding.message}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Copyable CLI command (D-P7-04) — rendered in both branches above */}
      <div className="flex items-start gap-2">
        <pre className="font-mono text-xs bg-secondary rounded-md p-2 flex-1 overflow-x-auto">
          {command}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy CLI command"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <span aria-live="polite" className="sr-only">
            {copied ? "Copied" : ""}
          </span>
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Raw-JSON toggle (D-P7-06) — closed by default */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-fit"
          >
            Raw JSON
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-[320px]">
            <pre className="font-mono text-xs">
              {JSON.stringify(report, null, 2)}
            </pre>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
