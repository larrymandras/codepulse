/**
 * IntakeModal — single-skill submit surface for the CodePulse Intake feature
 * (Phase 07-02, CP-06/CP-07). Structurally a trimmed port of
 * ForgeLaunchModal.tsx (D-P7-01, minus agent/prompt/model): host picker
 * (D-08 online pre-select copied verbatim), destination ToggleGroup (no
 * default, D-P7-03), workspace picker (revealed only for Project), a
 * drop-zone/URL XOR pair (D-P7-02), and the B2/D-10
 * paint-before-await-the-mutation optimistic submit pattern.
 *
 * Deliberate divergence from ForgeLaunchModal (D-P7-12): an offline host
 * remains SELECTABLE in the host Select (the per-item online/offline gate
 * ForgeLaunchModal applies is intentionally dropped here) — the
 * currently-selected host's offline state instead renders an inline warning
 * below the picker, since intake execution has no live daemon yet
 * (Phase 8) and a queued command simply waits out its TTL.
 *
 * Batch label variant ("Validate {N} skills") and the multi-skill collection
 * scanner are Plan 07-03's job — this modal is single-skill only.
 */

import { useState, useEffect, useRef } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useForgeHostsRaw } from "@/hooks/useForge";
import type { ForgeHostRow } from "@/hooks/useForge";
import type { IntakeCommandRow, IntakeDestination } from "@/hooks/useIntake";

/** Host is "online" when its last poll was within 30s (mirrors ForgeLaunchModal D-08). */
const ONLINE_THRESHOLD_MS = 30_000;

/** Stable empty fallback so the host list keeps a constant identity across renders. */
const EMPTY_HOSTS: ForgeHostRow[] = [];

interface IntakeModalProps {
  open: boolean;
  onClose: () => void;
  /** IntakePanel prepends this optimistic row to its local pendingLocal state (B2/D-10). */
  onEnqueued: (row: IntakeCommandRow) => void;
  /** IntakePanel flips the matching local row to "failed" with the reason (D-11). */
  onEnqueueFailed: (commandId: string, message: string) => void;
}

export function IntakeModal({
  open,
  onClose,
  onEnqueued,
  onEnqueueFailed,
}: IntakeModalProps) {
  // Form state
  const [hostId, setHostId] = useState<string>("");
  const [destination, setDestination] = useState<IntakeDestination | "">("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex mutations — plain (no Convex optimistic write, B2 — see handleSubmit).
  const enqueueIntake = useMutation(api.forge.enqueueIntake);
  const generateUploadUrl = useMutation(api.forge.generateForgeUploadUrl);

  // Distinguish "still loading" (undefined) from "no hosts have polled" ([]).
  const hostsRaw = useForgeHostsRaw();
  const hostsLoading = hostsRaw === undefined;
  const hosts = hostsRaw ?? EMPTY_HOSTS;

  const workspacesRaw = useQuery(
    api.forge.listWorkspaces,
    hostId ? { hostId } : "skip"
  );
  const workspaces = workspacesRaw ?? [];

  // Reset all fields when the modal opens.
  useEffect(() => {
    if (open) {
      setHostId("");
      setDestination("");
      setWorkspaceId("");
      setFile(null);
      setGithubUrl("");
      setSubmitting(false);
    }
  }, [open]);

  // Pre-select the most-recently-seen online host once the modal opens
  // (D-08, copied verbatim from ForgeLaunchModal). Offline hosts are never
  // auto-selected here, but remain manually selectable — see the host
  // SelectItem below (D-P7-12).
  useEffect(() => {
    if (!open || hostId) return;
    const onlineNewestFirst = hosts
      .filter((h) => Date.now() - h.lastSeenAt < ONLINE_THRESHOLD_MS)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    if (onlineNewestFirst.length > 0) {
      setHostId(onlineNewestFirst[0].hostId);
    }
  }, [open, hosts, hostId]);

  const selectedHost = hosts.find((h) => h.hostId === hostId);
  const selectedHostOffline = selectedHost
    ? Date.now() - selectedHost.lastSeenAt >= ONLINE_THRESHOLD_MS
    : false;

  const hasFile = file !== null;
  const hasUrl = githubUrl.trim() !== "";
  const xorOk = hasFile !== hasUrl;
  const destOk =
    destination !== "" &&
    (destination !== "project" || workspaceId.trim() !== "");
  const submitEnabled = xorOk && destOk && !submitting;

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (f) setGithubUrl("");
  };

  const handleUrlChange = (value: string) => {
    setGithubUrl(value);
    if (value) setFile(null);
  };

  const handleSubmit = async () => {
    if (!submitEnabled) return;
    setSubmitting(true);

    const commandId = crypto.randomUUID();
    const pendingRow: IntakeCommandRow = {
      commandId,
      status: "pending",
      hostId,
      destination: destination as IntakeDestination,
      workspaceId: destination === "project" ? workspaceId : null,
      storageId: null,
      githubUrl: hasUrl ? githubUrl.trim() : null,
      subpath: null,
      fileName: hasFile ? file!.name : null,
      report: null,
      error: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    // B2/D-10: report the optimistic row up FIRST so it paints immediately,
    // then close the modal and await the server. The row is keyed by
    // commandId for reconciliation (IntakePanel's simplified effect).
    onEnqueued(pendingRow);
    onClose();

    try {
      if (hasFile) {
        const uploadUrl = await generateUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file!.type || "text/plain" },
          body: file!,
        });
        const { storageId } = await res.json();
        await enqueueIntake({
          hostId,
          commandId,
          destination: destination as IntakeDestination,
          workspaceId: destination === "project" ? workspaceId : null,
          storageId,
        });
      } else {
        await enqueueIntake({
          hostId,
          commandId,
          destination: destination as IntakeDestination,
          workspaceId: destination === "project" ? workspaceId : null,
          githubUrl: githubUrl.trim(),
        });
      }
    } catch (err: unknown) {
      // D-11: flip the matching local pending row to "failed" with the
      // reason. The modal is already closed by this point.
      const message = err instanceof Error ? err.message : String(err);
      onEnqueueFailed(commandId, message);
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
          <DialogTitle>Validate skill</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Host picker — offline hosts remain selectable (D-P7-12), the
              deliberate reverse of ForgeLaunchModal's per-item online gate. */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="intake-host-select" className="text-base">
              Host
            </label>
            {hostsLoading ? (
              <p className="text-base text-muted-foreground py-2">
                Loading hosts…
              </p>
            ) : hosts.length === 0 ? (
              <p className="text-base text-muted-foreground py-2">
                No hosts online — start the Forge daemon to validate skills.
              </p>
            ) : (
              <Select value={hostId} onValueChange={setHostId}>
                <SelectTrigger id="intake-host-select" aria-label="Host">
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host) => {
                    const isOnline =
                      Date.now() - host.lastSeenAt < ONLINE_THRESHOLD_MS;
                    return (
                      <SelectItem key={host.hostId} value={host.hostId}>
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
            {selectedHostOffline && (
              <p className="text-sm text-muted-foreground">
                Host offline — command will expire in 5 min unless a daemon
                claims it.
              </p>
            )}
          </div>

          {/* Destination control (D-P7-03) — no default selected */}
          <div className="flex flex-col gap-1.5">
            <label className="text-base">Destination</label>
            <ToggleGroup
              type="single"
              value={destination}
              onValueChange={(v) =>
                setDestination((v as IntakeDestination) || "")
              }
            >
              <ToggleGroupItem value="global">Global</ToggleGroupItem>
              <ToggleGroupItem value="project">Project</ToggleGroupItem>
              <ToggleGroupItem value="cold">Cold storage</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Workspace picker (ported, inline-create not applicable here) —
              revealed only when destination === "project" (D-P7-03) */}
          {destination === "project" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intake-workspace-select" className="text-base">
                Workspace
              </label>
              <Select
                value={workspaceId}
                onValueChange={setWorkspaceId}
                disabled={workspaces.length === 0}
              >
                <SelectTrigger
                  id="intake-workspace-select"
                  aria-label="Workspace"
                >
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.workspaceId} value={ws.workspaceId}>
                      <span className="flex items-center gap-2">
                        {ws.name}
                        <Badge
                          variant={ws.class === "synced" ? "default" : "outline"}
                          className="text-sm"
                        >
                          {ws.class}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workspaces.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No workspaces synced from this host yet.
                </p>
              )}
            </div>
          )}

          {/* Drop zone + URL field (D-P7-02) — XOR enforced in state, not
              just visually: selecting a file clears the URL and vice versa. */}
          <div className="flex flex-col gap-1.5">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0] ?? null;
                if (f) handleFileChange(f);
              }}
              className={`min-h-24 border border-dashed border-input rounded-md flex items-center justify-center text-center text-sm text-muted-foreground cursor-pointer p-4${
                file !== null ? " opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {file ? file.name : "Drop a SKILL.md here, or click to browse"}
            </div>
            <input
              type="file"
              accept=".md"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <Input
              placeholder="or paste a GitHub URL"
              value={githubUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={file !== null}
              className={file !== null ? "opacity-50 cursor-not-allowed" : ""}
            />
          </div>

          {/* Dry-run posture note (D-P7-04, always visible, verbatim) */}
          <p className="text-xs text-muted-foreground">
            Validation only — nothing is written.
          </p>
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
                Validate skill
              </>
            ) : (
              "Validate skill"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
