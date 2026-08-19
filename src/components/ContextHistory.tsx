import { FlexBarChart } from "./FlexBarChart";
import { useContextHistory } from "../hooks/useContextSnapshots";

interface ContextHistoryProps {
  sessionId: string;
}

export default function ContextHistory({ sessionId }: ContextHistoryProps) {
  const snapshots = useContextHistory(sessionId);

  const data = [...snapshots]
    .reverse()
    .map((s) => {
      const date = new Date(s.timestamp * 1000);
      return {
        label: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        value: s.contextTokens ?? 0,
      };
    });

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Context History</h2>
      {data.length === 0 ? (
        <p className="text-base text-muted-foreground py-12 text-center">No context data yet</p>
      ) : (
        <FlexBarChart data={data} height={200} />
      )}
    </div>
  );
}
