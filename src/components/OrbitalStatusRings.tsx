import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useDockerHealth } from "../hooks/useDockerHealth";

type NodeStatus = "healthy" | "degraded" | "down" | "unknown";

interface RingNode {
  label: string;
  icon: string;
  status: NodeStatus;
}

interface Ring {
  label: string;
  radius: number;
  duration: number; // seconds per revolution
  direction: 1 | -1;
  nodes: RingNode[];
}

const STATUS_COLORS: Record<NodeStatus, { ring: string; dot: string; glow: string }> = {
  healthy: {
    ring: "rgba(34,197,94,0.25)",
    dot: "#22c55e",
    glow: "0 0 8px rgba(34,197,94,0.6)",
  },
  degraded: {
    ring: "rgba(250,204,21,0.25)",
    dot: "#facc15",
    glow: "0 0 8px rgba(250,204,21,0.6)",
  },
  down: {
    ring: "rgba(239,68,68,0.25)",
    dot: "#ef4444",
    glow: "0 0 8px rgba(239,68,68,0.6)",
  },
  unknown: {
    ring: "rgba(107,114,128,0.2)",
    dot: "#6b7280",
    glow: "0 0 6px rgba(107,114,128,0.3)",
  },
};

function worstStatus(nodes: RingNode[]): NodeStatus {
  if (nodes.some((n) => n.status === "down")) return "down";
  if (nodes.some((n) => n.status === "degraded")) return "degraded";
  if (nodes.every((n) => n.status === "unknown")) return "unknown";
  return "healthy";
}

function overallHealth(rings: Ring[]): NodeStatus {
  const all = rings.flatMap((r) => r.nodes);
  return worstStatus(all);
}

function dockerStatus(status: string): NodeStatus {
  if (status === "running") return "healthy";
  if (status === "paused" || status === "restarting") return "degraded";
  return "down";
}

function supabaseStatus(status: string): NodeStatus {
  if (status === "healthy") return "healthy";
  if (status === "degraded") return "degraded";
  return "down";
}

export default function OrbitalStatusRings() {
  const containers = useDockerHealth();
  const healthRecords = useQuery(api.supabase.currentHealth) ?? [];

  const rings = useMemo<Ring[]>(() => {
    // Ring 1 — Convex (innermost, always present)
    const convexRing: Ring = {
      label: "Convex",
      radius: 52,
      duration: 30,
      direction: 1,
      nodes: [{ label: "Convex", icon: "CX", status: "healthy" }],
    };

    // Ring 2 — Docker containers
    const dockerNodes: RingNode[] =
      containers.length > 0
        ? containers.map((c: any) => ({
            label: c.name ?? "container",
            icon: "DK",
            status: dockerStatus(c.status ?? "stopped"),
          }))
        : [{ label: "Docker", icon: "DK", status: "unknown" as NodeStatus }];

    const dockerRing: Ring = {
      label: "Docker",
      radius: 92,
      duration: 45,
      direction: -1,
      nodes: dockerNodes,
    };

    // Ring 3 — Supabase services
    const supabaseNodes: RingNode[] =
      healthRecords.length > 0
        ? healthRecords.map((r: any) => ({
            label: r.service,
            icon: "SB",
            status: supabaseStatus(r.status ?? "down"),
          }))
        : [{ label: "Supabase", icon: "SB", status: "unknown" as NodeStatus }];

    const supabaseRing: Ring = {
      label: "Supabase",
      radius: 132,
      duration: 60,
      direction: 1,
      nodes: supabaseNodes,
    };

    // Ring 4 — Integrations (outermost)
    const integrationRing: Ring = {
      label: "Integrations",
      radius: 172,
      duration: 80,
      direction: -1,
      nodes: [
        { label: "GitHub", icon: "GH", status: "unknown" },
        { label: "Telegram", icon: "TG", status: "unknown" },
        { label: "Slack", icon: "SL", status: "unknown" },
        { label: "Email", icon: "EM", status: "unknown" },
      ],
    };

    return [convexRing, dockerRing, supabaseRing, integrationRing];
  }, [containers, healthRecords]);

  const health = overallHealth(rings);
  const healthColor = STATUS_COLORS[health];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">Orbital Status</h2>
        <div className="flex items-center gap-3">
          {(["healthy", "degraded", "down", "unknown"] as NodeStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1 text-[9px] text-gray-500">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[s].dot }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Orbital display */}
      <div className="flex justify-center">
        <div
          className="relative"
          style={{ width: 400, height: 400 }}
        >
          {/* Background grid glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, rgba(99,102,241,0.06) 0%, transparent 70%)",
            }}
          />

          {/* Rings */}
          {rings.map((ring) => {
            const ringStatus = worstStatus(ring.nodes);
            const ringColor = STATUS_COLORS[ringStatus];

            return (
              <div key={ring.label} className="absolute inset-0 flex items-center justify-center">
                {/* Ring circle (track) */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: ring.radius * 2,
                    height: ring.radius * 2,
                    border: `1px solid ${ringColor.ring}`,
                  }}
                />

                {/* Rotating group */}
                <div
                  className="absolute"
                  style={{
                    width: ring.radius * 2,
                    height: ring.radius * 2,
                    animation: `orbital-spin ${ring.duration}s linear infinite ${
                      ring.direction === -1 ? "reverse" : "normal"
                    }`,
                  }}
                >
                  {ring.nodes.map((node, i) => {
                    const angle = (i / ring.nodes.length) * 360;
                    const nodeColor = STATUS_COLORS[node.status];

                    return (
                      <div
                        key={`${node.label}-${i}`}
                        className="absolute"
                        style={{
                          left: "50%",
                          top: "50%",
                          transform: `rotate(${angle}deg) translateX(${ring.radius}px)`,
                        }}
                      >
                        {/* Node dot */}
                        <div
                          className="relative flex items-center justify-center"
                          style={{
                            width: 28,
                            height: 28,
                            marginLeft: -14,
                            marginTop: -14,
                            transform: `rotate(${-angle}deg)`,
                            animation: `orbital-counter-spin ${ring.duration}s linear infinite ${
                              ring.direction === -1 ? "reverse" : "normal"
                            }`,
                          }}
                        >
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              backgroundColor: `${nodeColor.dot}20`,
                              boxShadow: nodeColor.glow,
                            }}
                          />
                          <span
                            className="relative text-[8px] font-bold"
                            style={{ color: nodeColor.dot }}
                          >
                            {node.icon}
                          </span>

                          {/* Tooltip */}
                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-[8px] text-gray-400 bg-gray-900/90 px-1.5 py-0.5 rounded">
                              {node.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ring label */}
                <span
                  className="absolute text-[9px] text-gray-600 font-medium"
                  style={{
                    top: `calc(50% - ${ring.radius}px - 12px)`,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  {ring.label}
                </span>
              </div>
            );
          })}

          {/* Center core */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle, ${healthColor.dot}15, transparent)`,
                boxShadow: healthColor.glow,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  border: `2px solid ${healthColor.dot}`,
                  animation: "orbital-pulse 3s ease-in-out infinite",
                }}
              >
                <span
                  className="text-xs font-bold uppercase"
                  style={{ color: healthColor.dot }}
                >
                  {health === "healthy" ? "OK" : health === "degraded" ? "!!" : health === "down" ? "DN" : "??"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ring summary table */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {rings.map((ring) => {
          const rs = worstStatus(ring.nodes);
          const rc = STATUS_COLORS[rs];
          const healthyCount = ring.nodes.filter((n) => n.status === "healthy").length;
          return (
            <div
              key={ring.label}
              className="text-center py-2 rounded-lg"
              style={{ backgroundColor: `${rc.dot}08`, border: `1px solid ${rc.dot}20` }}
            >
              <p className="text-[10px] text-gray-400">{ring.label}</p>
              <p className="text-sm font-semibold" style={{ color: rc.dot }}>
                {healthyCount}/{ring.nodes.length}
              </p>
            </div>
          );
        })}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes orbital-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbital-counter-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes orbital-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}
