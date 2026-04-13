/**
 * ConfigEditor — YAML config editor with CodeMirror syntax highlighting,
 * dry-run validation, and hot-reload apply with confirmation flow.
 * Phase 56 Plan 04: CPCC-05, CPCC-06, CPCC-07.
 */

import { useState, useEffect, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { githubDark } from "@uiw/codemirror-theme-github";
import { toast } from "sonner";
import * as jsYaml from "js-yaml";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import DiffView from "../components/DiffView";
import HotReloadBar, { type HotReloadStatus } from "../components/HotReloadBar";

// ─── Constants ───────────────────────────────────────────────────────────────

const MUTABLE_SECTIONS = [
  "agent-types",
  "security-rules",
  "tools",
  "profiles",
  "pipes",
] as const;

type MutableSection = (typeof MUTABLE_SECTIONS)[number];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfigEditor() {
  const { status, sendCommand } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // Selected config section
  const [section, setSection] = useState<MutableSection>("agent-types");

  // Editor state
  const [yamlContent, setYamlContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Validation state
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [applyEnabled, setApplyEnabled] = useState(false);

  // Apply confirmation strip
  const [showConfirm, setShowConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validating, setValidating] = useState(false);

  // Diff panel (D-09)
  const [showDiff, setShowDiff] = useState(false);

  // Hot-reload status bar (D-10)
  const [reloadStatus, setReloadStatus] = useState<HotReloadStatus>(null);
  const [reloadError, setReloadError] = useState<string | undefined>(undefined);

  // Revert to Saved (D-11)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  // ─── Load config on mount / section change ──────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setYamlContent("");
    setOriginalContent("");
    setIsDirty(false);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
    setShowDiff(false);
    setReloadStatus(null);
    setShowRevertConfirm(false);

    try {
      const ack = await sendCommand({
        type: "config.get",
        section,
      });

      if (ack.status === "ok" && ack.data) {
        const content = (ack.data as Record<string, unknown>).content as string ?? "";
        setYamlContent(content);
        setOriginalContent(content);
      } else if (ack.status === "ok") {
        // ack.data may be at top level for config.get
        const content = (ack as Record<string, unknown>).content as string ?? "";
        setYamlContent(content);
        setOriginalContent(content);
      } else {
        setLoadError(ack.error ?? "Failed to load config.");
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load config. Check WebSocket connection."
      );
    } finally {
      setLoading(false);
    }
  }, [section, sendCommand]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ─── Editor change handler ───────────────────────────────────────────────

  const handleEditorChange = useCallback(
    (value: string) => {
      setYamlContent(value);
      setIsDirty(value !== originalContent);
      // Invalidate previous dry-run
      setApplyEnabled(false);
      setValidationResult(null);
      setShowConfirm(false);
      setShowRevertConfirm(false);
    },
    [originalContent]
  );

  // ─── Revert to Saved ─────────────────────────────────────────────────────

  const handleRevert = useCallback(() => {
    setYamlContent(originalContent);
    setIsDirty(false);
    setShowDiff(false);
    setShowRevertConfirm(false);
    setReloadStatus(null);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }, [originalContent]);

  // ─── Validate (dry-run) ──────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (validating) return;
    setValidating(true);
    setValidationResult(null);
    setShowConfirm(false);

    // Parse YAML client-side so the server receives a real dict, not a raw string.
    let changes: Record<string, unknown> = {};
    try {
      changes = (jsYaml.load(yamlContent) as Record<string, unknown>) ?? {};
    } catch (err) {
      setValidationResult({ success: false, error: `YAML parse error: ${err}` });
      setValidating(false);
      return;
    }

    try {
      const ack = await sendCommand({
        type: "config.update",
        section,
        changes,
        dry_run: true,
      });

      if (ack.status === "ok") {
        setValidationResult({ success: true });
        setApplyEnabled(true);
      } else {
        setValidationResult({ success: false, error: ack.error ?? "Validation failed." });
        setApplyEnabled(false);
      }
    } catch (err) {
      setValidationResult({
        success: false,
        error: err instanceof Error ? err.message : "Validation request failed.",
      });
      setApplyEnabled(false);
    } finally {
      setValidating(false);
    }
  }, [yamlContent, section, sendCommand, validating]);

  // ─── Apply ───────────────────────────────────────────────────────────────

  const handleApplyConfirm = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    setShowConfirm(false);

    let changes: Record<string, unknown> = {};
    try {
      changes = (jsYaml.load(yamlContent) as Record<string, unknown>) ?? {};
    } catch (err) {
      toast.error(`YAML parse error: ${err}`);
      setApplying(false);
      return;
    }

    try {
      const ack = await sendCommand({
        type: "config.update",
        section,
        changes,
        dry_run: false,
      });

      if (ack.status === "ok") {
        toast("Config applied and reloaded.");
        setOriginalContent(yamlContent);
        setIsDirty(false);
        setApplyEnabled(false);
        setValidationResult(null);
        setReloadStatus("applied");
        triggerFlash();
        setTimeout(() => setReloadStatus("confirmed"), 1500);
        setTimeout(() => setReloadStatus(null), 4000);
      } else {
        setValidationResult({
          success: false,
          error: `Config apply failed: ${ack.error ?? "Unknown error"}`,
        });
        setReloadStatus("error");
        setReloadError(ack.error ?? "Unknown error");
      }
    } catch (err) {
      setValidationResult({
        success: false,
        error: `Config apply failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      setReloadStatus("error");
      setReloadError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setApplying(false);
    }
  }, [yamlContent, section, sendCommand, applying]);

  // ─── Derived UI values ───────────────────────────────────────────────────

  const isDisconnected = status === "disconnected";
  const pageTitle = isDirty ? "Config Editor •" : "Config Editor";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header / action bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) flex-shrink-0 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-lg font-semibold text-(--foreground) whitespace-nowrap">
            {pageTitle}
          </h1>

          {/* Section selector */}
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as MutableSection)}
            className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-(--primary)"
            aria-label="Config section"
          >
            {MUTABLE_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Validate button */}
          <button
            onClick={handleValidate}
            disabled={isDisconnected || loading || validating || !isDirty}
            className={`text-sm px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDirty && !isDisconnected
                ? "bg-(--primary) text-(--primary-foreground) hover:opacity-90"
                : "border border-(--border) text-(--muted-foreground) hover:text-(--foreground)"
            }`}
          >
            {validating ? "Validating…" : "Validate"}
          </button>

          {/* Review Changes button — toggles diff panel */}
          <button
            onClick={() => setShowDiff(!showDiff)}
            disabled={!isDirty}
            className="px-3 py-1.5 text-sm border border-(--border) text-(--foreground) hover:bg-(--accent) disabled:opacity-50"
          >
            {showDiff ? "Hide Diff" : "Review Changes"}
          </button>

          {/* Apply button — only enabled after successful dry-run */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!applyEnabled || isDisconnected || applying || reloadStatus === "pending" || reloadStatus === "validating"}
            className="text-sm px-3 py-1.5 border border-(--border) text-(--muted-foreground) hover:text-(--foreground) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applying ? "Applying…" : "Apply"}
          </button>

          <WSStatusIndicator status={status} />
        </div>
      </div>

      {/* Load error */}
      {loadError && !loading && (
        <div className="px-4 py-3 border-b border-(--border) flex items-center gap-3">
          <span className="text-sm text-(--status-error)">{loadError}</span>
          <button
            onClick={loadConfig}
            className="text-xs text-(--primary) hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Validation result */}
      {validationResult && (
        <div
          className={`mx-4 mt-3 px-3 py-2 text-sm border-l-2 ${
            validationResult.success
              ? "border-l-green-500 bg-green-500/10 text-(--foreground)"
              : "border-l-(--status-error) bg-(--status-error)/10 text-(--foreground)"
          }`}
        >
          {validationResult.success
            ? "Configuration is valid."
            : validationResult.error ?? "Validation failed."}
        </div>
      )}

      {/* Apply confirmation strip */}
      {showConfirm && (
        <div className="mx-4 mt-3 px-3 py-2 border border-(--border) bg-(--muted) flex items-center gap-3">
          <span className="text-sm text-(--foreground)">
            Apply and hot-reload config?
          </span>
          <button
            onClick={handleApplyConfirm}
            className="text-sm bg-(--primary) text-(--primary-foreground) px-3 py-1 hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="text-sm text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hot-reload status bar (D-10) */}
      <div className="px-4 pt-2">
        <HotReloadBar status={reloadStatus} errorMessage={reloadError} />
      </div>

      {/* Revert to Saved (D-11) */}
      {isDirty && (
        <div className="px-4 pt-2">
          {showRevertConfirm ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-(--muted-foreground)">Revert all unsaved changes?</span>
              <button
                onClick={handleRevert}
                className="px-2 py-1 text-sm bg-(--destructive) text-white"
              >
                Revert
              </button>
              <button
                onClick={() => setShowRevertConfirm(false)}
                className="px-2 py-1 text-sm border border-(--border)"
              >
                Keep editing
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRevertConfirm(true)}
              className="px-2 py-1 text-sm text-(--destructive) border border-(--border) hover:bg-(--destructive)/10"
            >
              Revert to Saved
            </button>
          )}
        </div>
      )}

      {/* Editor area */}
      <div ref={flashRef} className="flex-1 overflow-hidden mt-3">
        {loading ? (
          /* Loading skeleton */
          <div className="mx-4 flex flex-col gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-(--muted) animate-pulse"
                style={{ width: `${60 + Math.random() * 35}%` }}
              />
            ))}
          </div>
        ) : loadError ? null : (
          <>
            <CodeMirror
              value={yamlContent}
              height="calc(100vh - 120px)"
              extensions={[yaml()]}
              theme={githubDark}
              onChange={handleEditorChange}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
              }}
            />
            {showDiff && (
              <div className="mt-4 mx-0">
                <DiffView original={originalContent} current={yamlContent} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
