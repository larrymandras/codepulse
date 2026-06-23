import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { AgentDetail } from "@/lib/astridrApi";

interface DetailRuntimeTabProps {
  agentId: string;
  agentDetail: AgentDetail | null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground uppercase mb-0.5">{label}</p>
      <div className="text-base text-foreground">{children}</div>
    </div>
  );
}

export function DetailRuntimeTab({ agentDetail }: DetailRuntimeTabProps) {
  if (!agentDetail) {
    return (
      <p className="text-base text-muted-foreground py-8 text-center">
        No runtime data available.
      </p>
    );
  }

  const status = agentDetail.active ? "active" : "idle";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <StatusBadge status={status} />
        </Field>
        <Field label="Max Rounds">{agentDetail.max_rounds}</Field>
        <Field label="Budget Fraction">
          {agentDetail.budget_fraction > 0
            ? `${Math.round(agentDetail.budget_fraction * 100)}%`
            : "\u2014"}
        </Field>
        <Field label="Model">{agentDetail.model ?? "\u2014"}</Field>
        <div className="col-span-2">
          <Field label="Channels">
            {(agentDetail.channels ?? []).length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {agentDetail.channels.map((ch) => (
                  <Badge key={ch} variant="outline" className="text-xs">
                    {ch}
                  </Badge>
                ))}
              </div>
            ) : (
              "\u2014"
            )}
          </Field>
        </div>
      </div>

      {/* Future enhancement */}
      <div className="border-t border-border pt-4 mt-4">
        <p className="text-sm text-muted-foreground italic">
          Active sessions will be displayed here when real-time session tracking
          is available.
        </p>
      </div>
    </div>
  );
}

export default DetailRuntimeTab;
