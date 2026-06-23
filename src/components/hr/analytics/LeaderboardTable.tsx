import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ScoredRow } from "@/lib/leaderboardScoring";
import { formatCost, formatDurationMs } from "@/lib/formatters";

interface LeaderboardTableProps {
  rows: ScoredRow[];
  agentNameMap: Map<string, string>;
  onRowClick: (agentId: string) => void;
}

export function LeaderboardTable({
  rows,
  agentNameMap,
  onRowClick,
}: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-base text-muted-foreground py-8 text-center">
        No metrics yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Completion</TableHead>
          <TableHead className="text-right">Avg Response</TableHead>
          <TableHead className="text-right">Cost Eff.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const rank = i + 1;
          const isFirst = rank === 1;
          return (
            <TableRow
              key={row.agentId}
              className={`cursor-pointer hover:bg-accent/10 ${isFirst ? "bg-[--status-ok]/5" : ""}`}
              onClick={() => onRowClick(row.agentId)}
            >
              <TableCell className="tabular-nums">
                {isFirst ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--status-ok)] text-[var(--status-ok)]"
                  >
                    1
                  </Badge>
                ) : (
                  rank
                )}
              </TableCell>
              <TableCell className="font-medium">
                {agentNameMap.get(row.agentId) ?? row.agentId}
              </TableCell>
              <TableCell className="tabular-nums text-right">
                {row.score}
              </TableCell>
              <TableCell className="tabular-nums text-right">
                {(row.completionRate * 100).toFixed(1)}%
              </TableCell>
              <TableCell className="tabular-nums text-right">
                {row.avgResponseTimeMs != null
                  ? formatDurationMs(row.avgResponseTimeMs)
                  : "-"}
              </TableCell>
              <TableCell className="tabular-nums text-right">
                {formatCost(row.totalCost)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
