/**
 * ForgeLaunchModal — trimmed port of forge/web NewJobModal.tsx (Phase 80, FI-07).
 *
 * Trim list (vs. the local Forge port source):
 *  - DROP apiFetch — submit calls api.forge.enqueueLaunch (Convex mutation) instead.
 *  - DROP dangerous-mode (D-06): no Switch, no warning panel, no dangerous state.
 *    A `// D-06` comment marks the deliberate omission; capabilities NEVER include it.
 *  - DROP inline workspace creation (D-07): operator selects an existing synced/local
 *    workspace; no "+ New workspace" control, no create state/handlers.
 *  - ADD host picker (D-08): online host pre-selected; offline hosts disabled.
 *
 * Optimism (B2): this modal does NOT use a Convex optimistic write. ForgePage subscribes to
 * listForgeCommands with {} (all hosts) while an optimistic write keyed by {hostId} lands
 * in a different Convex cache entry — so the row would not appear until the server round-trip,
 * defeating D-10. Instead the modal builds a pending ForgeCommandRow and reports it up via
 * onLaunched() (ForgePage appends it to local pendingLocal state) BEFORE awaiting the
 * mutation; on failure onLaunchFailed() flips that local row to "failed" (D-11).
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useForgeHostsRaw } from "@/hooks/useForge";
import type { ForgeCommandRow, ForgeHostRow, JobMode } from "@/hooks/useForge";

type Agent = "codex" | "claude" | "agy";

/** Stable empty fallback so the host list keeps a constant identity across renders. */
const EMPTY_HOSTS: ForgeHostRow[] = [];

/**
 * Current Claude models offered for the Claude Code agent (id → label).
 * Copied verbatim from the Forge NewJobModal port source. Opus 4.8 is default.
 */
const CLAUDE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (default)" },
  { id: "claude-fable-5", label: "Claude Fable 5 (most capable)" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest)" },
];

const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";

/** Host is "online" when its last poll was within 30s (UI-SPEC §Surface 1, D-08). */
const ONLINE_THRESHOLD_MS = 30_000;

interface ForgeLaunchModalProps {
  open: boolean;
  onClose: () => void;
  /** ForgePage appends this optimistic Queued row to its local pendingLocal state (B2/D-10). */
  onLaunched: (row: ForgeCommandRow) => void;
  /** ForgePage flips the matching local row to "failed" with the reason (D-11). */
  onLaunchFailed: (commandId: string, message: string) => void;
}

export function ForgeLaunchModal({
  open,
  onClose,
  onLaunched,
  onLaunchFailed,
}: ForgeLaunchModalProps) {
  // Form state
  const [hostId, setHostId] = useState<string>("");
  const [agent, setAgent] = useState<Agent>("codex");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [mode, setMode] = useState<JobMode>("goal");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-5.5");
  const [maxTurns, setMaxTurns] = useState("50");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Convex data + mutation (plain — B2, no Convex optimistic write)
  const launch = useMutation(api.forge.enqueueLaunch);
  // Distinguish "still loading" (undefined) from "no hosts have polled" ([]) so
  // a fresh deployment shows an empty state instead of an eternal skeleton (WR-01).
  const hostsRaw = useForgeHostsRaw();
  const hostsLoading = hostsRaw === undefined;
  const hosts = hostsRaw ?? EMPTY_HOSTS;
  const workspacesRaw = useQuery(
    api.forge.listWorkspaces,
    hostId ? { hostId } : "skip"
  );
  const workspaces = workspacesRaw ?? [];

  // Reset state when the modal opens
  useEffect(() => {
    if (open) {
      setAgent("codex");
      setWorkspaceId("");
      setMode("goal");
      setPrompt("");
      setModel("gpt-5.5");
      setMaxTurns("50");
      setAdvancedOpen(false);
      setSubmitting(false);
      setHostId("");
    }
  }, [open]);

  // Pre-select the most-recently-seen online host once the modal opens (D-08).
  useEffect(() => {
    if (!open || hostId) return;
    const onlineNewestFirst = hosts
      .filter((h) => Date.now() - h.lastSeenAt < ONLINE_THRESHOLD_MS)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    if (onlineNewestFirst.length > 0) {
      setHostId(onlineNewestFirst[0].hostId);
    }
  }, [open, hosts, hostId]);

  // Model default follows the agent (copied verbatim from the port source).
  useEffect(() => {
    if (agent === "codex") {
      setModel("gpt-5.5");
    } else if (agent === "claude") {
      setModel(DEFAULT_CLAUDE_MODEL);
    }
  }, [agent]);

  // Submit enabled: host selected + workspace selected (if any exist) +
  // (claude → model set) + not submitting (UI-SPEC §Surface 1).
  const workspaceOk = workspaces.length === 0 || workspaceId.trim() !== "";
  const submitEnabled =
    hostId.trim() !== "" &&
    workspaceOk &&
    (agent !== "claude" || model.trim() !== "") &&
    !submitting;

  const submitLabel = mode === "goal" ? "Launch Job" : "Send";

  const handleSubmit = async () => {
    if (!submitEnabled) return;
    setSubmitting(true);

    // Build capabilities WITHOUT dangerous. D-06: dangerous is NEVER included in
    // the cloud launch surface (the server also strips it — defense in depth).
    const capabilities: Record<string, unknown> = {};
    const parsedMaxTurns = Number.parseInt(maxTurns, 10);
    if (Number.isFinite(parsedMaxTurns) && parsedMaxTurns > 0) {
      capabilities["maxTurns"] = parsedMaxTurns;
    }
    const capabilitiesStr =
      Object.keys(capabilities).length > 0 ? JSON.stringify(capabilities) : null;

    const commandId = crypto.randomUUID();
    const trimmedPrompt = prompt.trim() ? prompt.trim() : null;
    const trimmedModel = model.trim() ? model.trim() : null;

    // B2/D-10: report the optimistic Queued row up FIRST so it paints immediately,
    // then await the server. The row is keyed by commandId for reconciliation.
    const pendingRow: ForgeCommandRow = {
      commandId,
      commandType: "launch",
      status: "pending",
      agent,
      mode,
      prompt: trimmedPrompt,
      hostId,
      resolvedForgeJobId: null,
      error: null,
      createdAt: Date.now(),
    };
    onLaunched(pendingRow);
    onClose();

    try {
      await launch({
        hostId,
        commandId,
        agent,
        workspaceId,
        mode,
        prompt: trimmedPrompt,
        model: trimmedModel,
        capabilities: capabilitiesStr,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // D-11: flip the matching local pending row to "failed" with the reason.
      // The modal is already closed by this point; the failure surfaces on the
      // optimistic row in the job list (no dead inline error state — WR-02).
      onLaunchFailed(commandId, message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Launch Job</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Host picker (D-08) — online host pre-selected; offline disabled */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="host-select" className="text-sm">
              Host
            </label>
            {hostsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : hosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hosts online — start the Forge daemon to launch jobs.
              </p>
            ) : (
              <Select value={hostId} onValueChange={setHostId}>
                <SelectTrigger id="host-select" aria-label="Host">
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host) => {
                    const isOnline =
                      Date.now() - host.lastSeenAt < ONLINE_THRESHOLD_MS;
                    return (
                      <SelectItem
                        key={host.hostId}
                        value={host.hostId}
                        disabled={!isOnline}
                      >
                        <span className="flex items-center gap-2">
                          {isOnline && (
                            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                          )}
                          {host.hostId}
                          {!isOnline ? " (offline)" : ""}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Agent picker (ported, unchanged) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="agent-select" className="text-sm">
              Agent
            </label>
            <Select value={agent} onValueChange={(v) => setAgent(v as Agent)}>
              <SelectTrigger id="agent-select" aria-label="Agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="claude">Claude Code</SelectItem>
                <SelectItem value="agy" disabled aria-disabled="true">
                  Antigravity (disabled)
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              className="text-xs text-muted-foreground"
              id="antigravity-disabled-note"
            >
              Antigravity is disabled — PTY spike failed on this machine
            </p>
          </div>

          {/* Workspace picker (ported, inline-create REMOVED — D-07) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="workspace-select" className="text-sm">
              Workspace
            </label>
            <Select
              value={workspaceId}
              onValueChange={setWorkspaceId}
              disabled={workspaces.length === 0}
            >
              <SelectTrigger id="workspace-select" aria-label="Workspace">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.workspaceId} value={ws.workspaceId}>
                    <span className="flex items-center gap-2">
                      {ws.name}
                      <Badge
                        variant={ws.class === "synced" ? "default" : "outline"}
                        className="text-xs"
                      >
                        {ws.class}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workspaces.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No workspaces synced from this host yet.
              </p>
            )}
          </div>

          {/* Mode segmented control (ported verbatim) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm">Mode</label>
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("goal")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "goal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-accent"
                }`}
              >
                Goal
              </button>
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-input ${
                  mode === "chat"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-accent"
                }`}
              >
                Chat
              </button>
            </div>
          </div>

          {/* Prompt textarea (ported, unchanged) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prompt-input" className="text-sm">
              Prompt
            </label>
            <Textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want the agent to do…"
              rows={4}
              className="min-h-[96px] max-h-[192px] resize-y"
            />
          </div>

          {/* Advanced collapsible — dangerous-mode section REMOVED (D-06) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {advancedOpen ? "▾" : "▸"} Advanced
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3 pt-3">
              {agent === "claude" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="model-select" className="text-sm">
                    Model
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model-select" aria-label="Model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLAUDE_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {agent === "codex" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="model-input" className="text-sm">
                    Model
                  </label>
                  <input
                    id="model-input"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-5.5"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="max-turns-input" className="text-sm">
                  Max turns
                </label>
                <input
                  id="max-turns-input"
                  type="number"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(e.target.value)}
                  min={1}
                  max={500}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
            disabled={!submitEnabled}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Launching…
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
