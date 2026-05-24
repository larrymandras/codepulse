import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SectionHeader } from "./SectionHeader";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function DeliveryHistory() {
  const emailLogs = useQuery(api.deliveryLogs.listEmailLogs, {});
  const pagerdutyLogs = useQuery(api.deliveryLogs.listPagerdutyLogs, {});

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-semibold text-gray-300 mb-1">
        No deliveries yet
      </p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Delivery history appears here after the first scheduled digest or
        PagerDuty trigger.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHeader title="DELIVERY HISTORY" />

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="pagerduty">PagerDuty</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          {!emailLogs || emailLogs.length === 0 ? (
            renderEmptyState()
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs.slice(0, 50).map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "success"
                            ? "border-green-500 text-green-400"
                            : "border-red-500 text-red-400"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.subject ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.recipient ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {new Date(log.sentAt * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {log.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="pagerduty">
          {!pagerdutyLogs || pagerdutyLogs.length === 0 ? (
            renderEmptyState()
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Dedup Key</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagerdutyLogs.slice(0, 50).map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "success"
                            ? "border-green-500 text-green-400"
                            : log.status === "resolved"
                              ? "border-blue-500 text-blue-400"
                              : "border-red-500 text-red-400"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {log.action ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.dedupKey ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{log.ruleId}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {new Date(log.sentAt * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {log.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
