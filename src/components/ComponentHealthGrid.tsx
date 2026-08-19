interface ComponentHealthGridProps {
  components: any[];
}

export default function ComponentHealthGrid({ components }: ComponentHealthGridProps) {
  const healthy = components.filter((c) => c.outcome === "resolved").length;

  const dotColor = (outcome: string) => {
    const colors: Record<string, string> = {
      resolved: "bg-green-400 shadow-green-400/40",
      failed: "bg-red-400 shadow-red-400/40",
      pending: "bg-yellow-400 shadow-yellow-400/40",
    };
    return colors[outcome] ?? "bg-muted-foreground";
  };

  const borderColor = (outcome: string) => {
    const colors: Record<string, string> = {
      resolved: "border-green-500/20",
      failed: "border-red-500/20",
      pending: "border-yellow-500/20",
    };
    return colors[outcome] ?? "border-border/50";
  };

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground uppercase tracking-wide">
          Component Health
        </h2>
        <span className="text-sm text-muted-foreground">
          {components.length === 0
            ? "No components"
            : `${healthy}/${components.length} healthy`}
        </span>
      </div>

      {components.length === 0 ? (
        <p className="text-muted-foreground text-base text-center py-4">
          No component data available
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {components.map((c: any) => (
            <div
              key={c._id}
              className={`flex flex-col items-center gap-2 rounded-lg border ${borderColor(c.outcome)} bg-muted/30 p-3`}
            >
              <span
                className={`w-3 h-3 rounded-full shadow-sm ${dotColor(c.outcome)}`}
              />
              <span className="text-sm text-foreground font-mono text-center truncate w-full">
                {c.component}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
