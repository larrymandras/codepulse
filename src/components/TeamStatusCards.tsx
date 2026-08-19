import AgentAvatar from "./AgentAvatar";
import { prefersReducedMotion } from "@/lib/prefersReducedMotion";

interface TeamInfo {
  name: string;
  status: "active" | "completed" | "idle";
  taskCount: number;
  phase: string;
}

function deriveTeams(
  components: Array<{ component: string; phase: string; status: string }>,
  pipelines: Array<{ name: string; status: string }>
): TeamInfo[] {
  const teamMap: Record<string, { phases: Set<string>; statuses: string[]; count: number }> = {};

  for (const c of components) {
    const team = c.phase;
    if (!teamMap[team]) {
      teamMap[team] = { phases: new Set(), statuses: [], count: 0 };
    }
    teamMap[team].phases.add(c.phase);
    teamMap[team].statuses.push(c.status);
    teamMap[team].count++;
  }

  return Object.entries(teamMap).map(([name, data]) => {
    let status: "active" | "completed" | "idle" = "idle";
    if (data.statuses.some((s) => s === "in_progress")) status = "active";
    else if (data.statuses.every((s) => s === "completed")) status = "completed";

    return {
      name,
      status,
      taskCount: data.count,
      phase: [...data.phases].join(", "),
    };
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-400/10 text-green-400" },
  completed: { label: "Completed", className: "bg-green-400/10 text-green-400" },
  idle: { label: "Idle", className: "bg-muted text-muted-foreground" },
};

interface TeamStatusCardsProps {
  components: Array<{ component: string; phase: string; status: string }>;
  pipelines: Array<{ name: string; status: string }>;
}

export default function TeamStatusCards({ components, pipelines }: TeamStatusCardsProps) {
  const teams = deriveTeams(components, pipelines);
  // D-11: gates the "Active" team dot below. Reclassified from the plan's
  // draft (which flagged this as a possible kill) after verifying it is
  // genuinely gated on `team.status === "active"` — see 120-PULSE-TRIAGE.md.
  const reducedMotion = prefersReducedMotion();

  if (teams.length === 0) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center text-muted-foreground text-base">
        No team data available
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h3 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Build Teams</h3>
      <div className="space-y-3">
        {teams.map((team) => {
          const badge = STATUS_BADGE[team.status];
          const avatarStatus =
            team.status === "active" ? "active" : team.status === "completed" ? "completed" : "idle";

          return (
            <div
              key={team.name}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
            >
              <AgentAvatar
                avatar={{ name: team.name }}
                status={avatarStatus}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base text-foreground font-medium truncate">
                    {team.name}
                  </span>
                  <span className={`text-sm px-1.5 py-0.5 rounded ${badge.className}`}>
                    {badge.label}
                  </span>
                  {team.status === "active" && (
                    <>
                      <span
                        className={`w-1.5 h-1.5 rounded-full bg-green-400 ${
                          reducedMotion ? "" : "animate-pulse"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="sr-only">Active</span>
                    </>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {team.taskCount} component{team.taskCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
