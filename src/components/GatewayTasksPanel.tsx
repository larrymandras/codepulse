import { useGatewayTasksPaginated } from "../hooks/useGatewayTasks";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import LoadMoreButton from "./LoadMoreButton";
import InfoTooltip from "./InfoTooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

const statusColor: Record<string, string> = {
  completed: "bg-emerald-500/20 text-emerald-400",
  running: "bg-blue-500/20 text-blue-400",
  pending: "bg-gray-500/20 text-gray-400",
  failed: "bg-red-500/20 text-red-400",
};

export default function GatewayTasksPanel() {
  const { tasks, status, loadMore } = useGatewayTasksPaginated(25);

  const heading = (
    <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
      Gateway Tasks
      <InfoTooltip text="Recent tasks routed through the CLI Gateway with provider, status, and duration" />
    </h2>
  );

  if (tasks.length === 0 && status !== "LoadingFirstPage") {
    return (
      <div>
        {heading}
        <p className="text-base text-muted-foreground">
          No gateway tasks recorded. Tasks appear here when routed through the CLI Gateway.
        </p>
      </div>
    );
  }

  return (
    <div>
      {heading}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task ID</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const ago = Math.round((Date.now() / 1000 - t.timestamp) / 60);
            const timeStr =
              ago < 60
                ? `${ago}m ago`
                : ago < 1440
                  ? `${Math.round(ago / 60)}h ago`
                  : `${Math.round(ago / 1440)}d ago`;

            return (
              <TableRow key={t._id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-sm" title={t.taskId}>
                  {t.taskId.slice(0, 8)}
                </TableCell>
                <TableCell>
                  {PROVIDER_DISPLAY_NAMES[t.provider] ?? t.provider}
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm px-1.5 py-0.5 font-mono uppercase ${statusColor[t.status] ?? "bg-gray-500/20 text-gray-400"}`}
                  >
                    {t.status}
                  </span>
                </TableCell>
                <TableCell className="font-mono tabular-nums text-sm">
                  {t.durationSeconds != null
                    ? `${t.durationSeconds.toFixed(2)}s`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {timeStr}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <LoadMoreButton status={status} loadMore={loadMore} pageSize={25} />
    </div>
  );
}
