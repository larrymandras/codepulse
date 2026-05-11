import { useState } from "react";
import { authHeaders } from "@/lib/astridrApi";

const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";

interface CancelButtonProps {
  executionId: string;
}

type State = "default" | "loading" | "success" | "error";

export default function CancelButton({ executionId }: CancelButtonProps) {
  const [state, setState] = useState<State>("default");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleCancel = async () => {
    setState("loading");
    try {
      const res = await fetch(`${ASTRIDR_API_BASE}/api/executions/${executionId}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.ok) {
        setState("success");
        setTimeout(() => setState("default"), 2000);
      } else {
        const body = await res.json().catch(() => ({ error: "Cancel request failed." }));
        setErrorMsg(body.error ?? "Cancel request failed.");
        setState("error");
        setTimeout(() => setState("default"), 3000);
      }
    } catch {
      setErrorMsg("Network error. Cancel request failed.");
      setState("error");
      setTimeout(() => setState("default"), 3000);
    }
  };

  if (state === "success") {
    return <span className="text-[10px] text-amber-400">Cancelled</span>;
  }

  if (state === "error") {
    return <span className="text-[10px] text-red-400">{errorMsg}</span>;
  }

  return (
    <button
      onClick={handleCancel}
      disabled={state === "loading"}
      className={`text-[10px] px-2 py-1 rounded border border-red-500/40 bg-red-600/10 text-red-400 transition-colors ${
        state === "loading" ? "cursor-not-allowed opacity-50" : "hover:bg-red-600/20"
      }`}
    >
      Cancel Execution
    </button>
  );
}
