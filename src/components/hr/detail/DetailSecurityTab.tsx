import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import type { AgentDetail } from "@/lib/astridrApi";

interface DetailSecurityTabProps {
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
      <p className="text-xs text-muted-foreground uppercase mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function DetailSecurityTab({ agentDetail }: DetailSecurityTabProps) {
  if (!agentDetail) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No security data available.
      </p>
    );
  }

  const hasSecurityData =
    agentDetail.autonomy_level ||
    (agentDetail.peer_comm_allowed ?? []).length > 0 ||
    (agentDetail.tools_enabled ?? []).length > 0;

  return (
    <div className="space-y-4">
      {hasSecurityData && (
        <div className="grid grid-cols-1 gap-4">
          {agentDetail.autonomy_level && (
            <Field label="Autonomy Level">
              <Badge variant="outline" className="text-[10px]">
                {agentDetail.autonomy_level}
              </Badge>
            </Field>
          )}

          <Field label="Peer Communication">
            {(agentDetail.peer_comm_allowed ?? []).length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {agentDetail.peer_comm_allowed!.map((peer) => (
                  <Badge
                    key={peer}
                    variant="outline"
                    className="text-[10px] font-mono"
                  >
                    {peer}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">None configured</span>
            )}
          </Field>

          <Field label="Tool Access">
            {(agentDetail.tools_enabled ?? []).length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {agentDetail.tools_enabled.map((tool) => (
                  <Badge
                    key={tool}
                    variant="outline"
                    className="text-[10px] font-mono"
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">No tools enabled</span>
            )}
          </Field>
        </div>
      )}

      {/* Placeholder for future scan results */}
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-xs italic">
            Security scan results will be displayed here when security scanning
            is integrated.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DetailSecurityTab;
