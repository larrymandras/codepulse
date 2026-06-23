import AgentAvatar from "@/components/AgentAvatar";

interface StackedAvatarsProps {
  agents: Array<{ name: string; id: string }>;
  max?: number;
  size?: "sm" | "md";
}

export function StackedAvatars({
  agents,
  max = 4,
  size = "sm",
}: StackedAvatarsProps) {
  const visible = agents.slice(0, max);
  const overflow = agents.length - max;

  return (
    <div className="flex items-center">
      {visible.map((agent, i) => (
        <div
          key={agent.id}
          className={`ring-2 ring-background rounded-full ${i > 0 ? "-ml-2" : ""}`}
          style={{ zIndex: max - i }}
        >
          <AgentAvatar
            avatar={{ name: agent.name }}
            size={size}
            status="idle"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="-ml-2 flex items-center justify-center rounded-full bg-muted ring-2 ring-background"
          style={{
            width: size === "sm" ? 24 : 40,
            height: size === "sm" ? 24 : 40,
            zIndex: 0,
          }}
        >
          <span className="text-xs font-medium text-muted-foreground">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}

export default StackedAvatars;
