/**
 * IntakeReportView — placeholder stub.
 *
 * TEMPORARY: Plan 07-02 Task 2 (IntakePanel.tsx) imports this component to
 * mount inside a done row's Collapsible, but Task 2 executes before Task 3
 * (which owns this file's real implementation) in this plan's task order.
 * Per 07-02-PLAN.md Task 2's <action> note ("if executed out of order, stub
 * a minimal typed placeholder and note it in the SUMMARY"), this is that
 * stub — Task 3 replaces this file's contents with the full CLI-02 report
 * render (verdict, findings table, copyable CLI command, raw-JSON toggle).
 */

import type { IntakeCommandRow } from "@/hooks/useIntake";

interface IntakeReportViewProps {
  row: IntakeCommandRow;
}

export function IntakeReportView({ row }: IntakeReportViewProps) {
  if (row.status !== "done") return null;
  return null;
}
