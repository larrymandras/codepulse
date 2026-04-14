import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";

type ProviderSlot = "primary" | "backup";
type SaveState = "idle" | "saving" | "saved";

interface ProviderRowProps {
  slot: ProviderSlot;
  label: string;
}

function ProviderRow({ slot, label }: ProviderRowProps) {
  const configKey = `intelligence.llm_${slot}`;
  const existingConfig = useQuery(api.briefings.getLLMConfig, { key: configKey });
  const setLLMConfig = useMutation(api.briefings.setLLMConfig);

  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Sync from server on initial load (only if fields are empty)
  const effectiveProvider = provider || existingConfig?.provider || "openai";
  const effectiveModel = model || existingConfig?.model || "";

  const handleSave = async () => {
    if (!apiKey && !existingConfig) return;
    setSaveState("saving");
    try {
      await setLLMConfig({
        slot,
        provider: effectiveProvider,
        model: effectiveModel || (effectiveProvider === "anthropic" ? "claude-3-5-haiku-20241022" : "gpt-4o-mini"),
        apiKey,
      });
      setSaveState("saved");
      setApiKey("");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  };

  const handleRemove = async () => {
    if (!showRemoveConfirm) {
      setShowRemoveConfirm(true);
      return;
    }
    setSaveState("saving");
    try {
      await setLLMConfig({
        slot,
        provider: effectiveProvider,
        model: effectiveModel || "gpt-4o-mini",
        apiKey: "",
      });
      setSaveState("idle");
      setShowRemoveConfirm(false);
    } catch {
      setSaveState("idle");
      setShowRemoveConfirm(false);
    }
  };

  return (
    <div className="space-y-2 py-3 border-b border-border last:border-0">
      <p className="text-sm font-medium">{label}</p>

      {existingConfig && (
        <p className="text-xs text-muted-foreground">
          Current: {existingConfig.provider} / {existingConfig.model}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Provider select */}
        <select
          value={provider || existingConfig?.provider || "openai"}
          onChange={(e) => setProvider(e.target.value)}
          disabled={saveState === "saving"}
          className="bg-background border border-input px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring/50"
        >
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
        </select>

        {/* Model input */}
        <input
          type="text"
          value={model || existingConfig?.model || ""}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini or claude-3-5-haiku-20241022"
          disabled={saveState === "saving"}
          className="flex-1 min-w-40 bg-background border border-input px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring/50"
        />

        {/* API Key input */}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          disabled={saveState === "saving"}
          className="flex-1 min-w-40 bg-background border border-input px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring/50"
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveState === "saving" || (!apiKey && !existingConfig)}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {saveState === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveState === "saved"
            ? "Saved"
            : saveState === "saving"
              ? "Saving..."
              : "Save Provider Config"}
        </button>
      </div>

      {/* Remove / confirm */}
      {existingConfig && (
        <div className="flex items-center gap-2">
          {showRemoveConfirm ? (
            <>
              <p className="text-xs text-muted-foreground">
                Remove Provider: This will disable briefing generation and anomaly digest until a new provider is configured. Remove anyway?
              </p>
              <button
                onClick={handleRemove}
                disabled={saveState === "saving"}
                className="px-2 py-0.5 text-xs text-destructive border border-destructive/50 hover:bg-destructive/10 disabled:opacity-50"
              >
                {saveState === "saving" ? "Removing..." : "Confirm Remove"}
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="px-2 py-0.5 text-xs text-muted-foreground border border-border hover:bg-muted/50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleRemove}
              disabled={saveState === "saving"}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              Remove Provider
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LLMProviderConfig() {
  return (
    <div className="space-y-1">
      <ProviderRow slot="primary" label="Primary Provider" />
      <ProviderRow slot="backup" label="Backup Provider" />
    </div>
  );
}
