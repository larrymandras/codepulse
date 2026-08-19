import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SectionHeader } from "./SectionHeader";
import { InlineMetricState } from "./EmptyState";
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
      <p className="text-base font-semibold text-foreground mb-1">
        No deliveries yet
      </p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Delivery history appears here after the first scheduled digest or
        PagerDuty trigger.
      </p>
    </div>
  );

  if (emailLogs === undefined || pagerdutyLogs === undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader title="DELIVERY HISTORY" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="DELIVERY HISTORY" />

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="pagerduty">PagerDuty</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          {emailLogs.length === 0 ? (
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
                    <TableCell className="text-base">
                      {log.subject ?? <InlineMetricState state="empty" label="no subject" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.recipient ?? <InlineMetricState state="empty" label="no recipient" />}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {new Date(log.sentAt * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">
                      {/* "n/a", not an empty-state icon: when status is
                          "success" (rendered in the Status column) the
                          absence of an error message is a real fact -- no
                          error occurred -- not a data gap. */}
                      {log.errorMessage ?? "n/a"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="pagerduty">
          {pagerdutyLogs.length === 0 ? (
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
                    <TableCell className="text-base capitalize">
                      {log.action ?? <InlineMetricState state="empty" label="no action" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.dedupKey ?? <InlineMetricState state="empty" label="no dedup key" />}
                    </TableCell>
                    <TableCell className="text-sm">{log.ruleId}</TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {new Date(log.sentAt * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">
                      {/* "n/a", same reasoning as the email tab's error column above. */}
                      {log.errorMessage ?? "n/a"}
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
