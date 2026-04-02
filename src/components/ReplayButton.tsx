import { useState } from "react";

const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";

interface ReplayButtonProps {
  executionId: string;
  profileId: string;
  disabled: boolean;
}

type State = "default" | "confirming" | "loading" | "success" | "error";

export default function ReplayButton({ executionId, profileId, disabled }: ReplayButtonProps) {
  const [state, setState] = useState<State>("default");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleReplayClick = () => {
    if (disabled) return;
    setState("confirming");
  };

  const handleConfirm = async () => {
    setState("loading");
    try {
      const res = await fetch(`${ASTRIDR_API_BASE}/api/executions/${executionId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      });

      if (res.ok) {
        setState("success");
        setTimeout(() => setState("default"), 2000);
      } else {
        const body = await res.json().catch(() => ({ error: "Replay failed." }));
        setErrorMsg(body.error ?? "Replay failed.");
        setState("error");
        setTimeout(() => setState("default"), 3000);
      }
    } catch {
      setErrorMsg("Network error. Replay request failed.");
      setState("error");
      setTimeout(() => setState("default"), 3000);
    }
  };

  const handleDismiss = () => {
    setState("default");
  };

  if (state === "success") {
    return <span className="text-[10px] text-emerald-400">Replayed</span>;
  }

  if (state === "error") {
    return <span className="text-[10px] text-red-400">{errorMsg}</span>;
  }

  if (state === "confirming" || state === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-[10px] text-gray-300">
        <span>Replay this execution?</span>
        <button
          onClick={handleConfirm}
          disabled={state === "loading"}
          className="px-2 py-1 rounded border border-indigo-500/40 bg-indigo-500/20 text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Re-run Execution
        </button>
        <button
          onClick={handleDismiss}
          disabled={state === "loading"}
          className="text-gray-500 hover:text-gray-300 disabled:opacity-50"
        >
          Dismiss
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleReplayClick}
      disabled={disabled}
      className={`text-[10px] px-2 py-1 rounded border border-indigo-500/40 bg-indigo-500/20 text-indigo-400 transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-indigo-500/30"
      }`}
    >
      Replay Execution
    </button>
  );
}
