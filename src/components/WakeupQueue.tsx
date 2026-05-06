import { useState, useEffect } from "react";
import InfoTooltip from "./InfoTooltip";

interface WakeupQueueProps {
  pending: any[];
  recent: any[];
}

function formatCountdown(fireAtEpoch: number): string {
  const diff = fireAtEpoch - Date.now() / 1000;
  if (diff <= 0) return "00:00:00";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = Math.floor(diff % 60);
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function relTime(epoch: number): string {
  const d = Math.floor(Date.now() / 1000 - epoch);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function WakeupQueue({ pending, recent }: WakeupQueueProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [pending.length]);

  // tick is used to force re-render on each second for countdown updates
  void tick;

  const isUrgent = (fireAt: number) => fireAt - Date.now() / 1000 < 300;

  const statusColors: Record<string, string> = {
    fired: "text-green-400 bg-green-400/10",
    failed: "text-red-400 bg-red-400/10",
    cancelled: "text-gray-500 bg-gray-800/50",
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Pending Wakeups */}
      <h2 className="text-sm font-bold text-gray-300 mb-3">
        Scheduled Wakeups{" "}
        <span className="ml-2 text-xs text-gray-500 font-normal">{pending.length}</span>
        <InfoTooltip text="Agent-scheduled callbacks — fire as sub-agent sessions at the specified delay" />
      </h2>

      {pending.length === 0 ? (
        <div>
          <p className="text-sm text-gray-500 py-6 text-center">No pending wakeups</p>
          <p className="text-xs text-gray-600 text-center">
            Agents can schedule follow-up sessions using the wakeup tool.
          </p>
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-0">
          {pending.map((w: any) => (
            <div
              key={w._id}
              className="flex items-center gap-2 px-2 py-1.5 text-xs"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isUrgent(w.fireAt) ? "bg-yellow-400" : "bg-indigo-400"
                }`}
              />
              <span
                className={`text-2xl font-bold font-mono w-28 shrink-0 ${
                  isUrgent(w.fireAt) ? "text-yellow-400" : "text-indigo-400"
                }`}
              >
                {formatCountdown(w.fireAt)}
              </span>
              <span className="text-gray-200 truncate flex-1">{w.reason}</span>
              <span className="text-[10px] text-gray-500 bg-gray-900/50 px-1.5 py-0.5 rounded">
                {w.profileId}
              </span>
              {w.chainDepth > 0 && (
                <span className="text-[10px] text-gray-500">depth {w.chainDepth}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Wakeup History */}
      <div className="border-t border-gray-700/30 mt-3 pt-3">
        <h2 className="text-sm font-bold text-gray-300 mb-3">
          Wakeup History{" "}
          <span className="ml-2 text-xs text-gray-500 font-normal">{recent.length}</span>
        </h2>

        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No wakeups have fired yet</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-0">
            {recent.map((w: any) => (
              <div
                key={w._id}
                className="flex items-center gap-2 px-2 py-1.5 text-xs"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    w.status === "fired"
                      ? "bg-green-400"
                      : w.status === "failed"
                      ? "bg-red-400"
                      : "bg-gray-500"
                  }`}
                />
                <span className="text-gray-400 font-mono w-16 shrink-0 text-[10px]">
                  {relTime(w.firedAt ?? w.timestamp)}
                </span>
                <span className="text-gray-200 truncate flex-1">{w.reason}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    statusColors[w.status] ?? "text-gray-500 bg-gray-800/50"
                  }`}
                >
                  {w.status}
                </span>
                {w.chainDepth > 0 && (
                  <span className="text-[10px] text-gray-500">depth {w.chainDepth}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
