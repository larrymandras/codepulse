interface PhaseData {
  phase: string;
  total: number;
  completed: number;
  in_progress: number;
  failed: number;
  avgProgress: number;
}

const PHASE_ORDER = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6"];

function sortPhases(phases: PhaseData[]): PhaseData[] {
  return [...phases].sort((a, b) => {
    const ai = PHASE_ORDER.indexOf(a.phase);
    const bi = PHASE_ORDER.indexOf(b.phase);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.phase.localeCompare(b.phase);
  });
}

function barColor(pct: number): string {
  if (pct > 80) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-orange-500";
}

export default function PhaseProgressBars({ phases }: { phases: PhaseData[] }) {
  const sorted = sortPhases(phases);

  if (sorted.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center text-gray-500 text-sm">
        No phase data available
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Phase Progress</h3>
      {sorted.map((p) => {
        const isComplete = p.total > 0 && p.completed === p.total;
        const failedPct = p.total > 0 ? (p.failed / p.total) * 100 : 0;
        const completedPct = p.total > 0 ? (p.completed / p.total) * 100 : 0;

        return (
          <div key={p.phase}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200 font-medium">{p.phase}</span>
                {isComplete && (
                  <span className="text-green-400 text-xs">&#10003;</span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {p.completed}/{p.total} ({p.avgProgress}%)
              </span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 flex overflow-hidden">
              {isComplete ? (
                <div className="bg-green-500 h-2 rounded-full w-full" />
              ) : (
                <>
                  <div
                    className={`${barColor(p.avgProgress)} h-2 transition-all`}
                    style={{ width: `${completedPct}%` }}
                  />
                  {failedPct > 0 && (
                    <div
                      className="bg-red-500 h-2 transition-all"
                      style={{ width: `${failedPct}%` }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
