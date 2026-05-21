// src/pages/ConfigPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import * as jsYaml from "js-yaml";
import { toast } from "sonner";
import { Shield, Bot, Wrench, User, GitBranch, Code } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "@/components/WSStatusIndicator";
import HotReloadBar, { type HotReloadStatus } from "@/components/HotReloadBar";
import DiffView from "@/components/DiffView";
import { SecurityRulesForm } from "@/components/config/SecurityRulesForm";
import { AgentTypesForm } from "@/components/config/AgentTypesForm";
import { YamlSection } from "@/components/config/YamlSection";

const SECTIONS = [
  { id: "security-rules", label: "Security", icon: Shield },
  { id: "agent-types", label: "Agents", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "profiles", label: "Profiles", icon: User },
  { id: "pipes", label: "Pipes", icon: GitBranch },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const FORM_SECTIONS = new Set<SectionId>(["security-rules", "agent-types"]);

const YAML_DESCRIPTIONS: Partial<Record<SectionId, string>> = {
  tools: "Built-in tools, optional tools, skill/plugin directories, and Claude Code settings.",
  profiles: "Routing profiles, budget limits, channel mappings, and persona voice configuration.",
  pipes: "Automation pipelines with triggers, steps, and approval gates.",
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ConfigPage() {
  const { status, sendCommand } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const [section, setSection] = useState<SectionId>("security-rules");
  const [rawMode, setRawMode] = useState(false);

  // Data state
  const [originalYaml, setOriginalYaml] = useState("");
  const [currentData, setCurrentData] = useState<Record<string, unknown>>({});
  const originalDataRef = useRef<Record<string, unknown>>({});
  const [yamlOverride, setYamlOverride] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [applyEnabled, setApplyEnabled] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [reloadStatus, setReloadStatus] = useState<HotReloadStatus>(null);
  const [reloadError, setReloadError] = useState<string | undefined>(undefined);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const isDisconnected = status === "disconnected";
  const isDirty = rawMode
    ? (yamlOverride ?? "") !== originalYaml
    : !deepEqual(currentData, originalDataRef.current);
  const currentYaml = rawMode
    ? (yamlOverride ?? originalYaml)
    : jsYaml.dump(currentData, { lineWidth: 120 });

  // ── Load config ──
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setValidationResult(null);
    setApplyEnabled(false);
    setShowConfirm(false);
    setShowDiff(false);
    setReloadStatus(null);
    setShowRevertConfirm(false);
    setRawMode(false);
    setYamlOverride(null);

    try {
      const ack = await sendCommand({ type: "config.get", section });
      if (ack.status === "ok") {
        const content = ((ack.data as Record<string, unknown>)?.content ?? (ack as Record<string, unknown>).content ?? "") as string;
        setOriginalYaml(content);
        const parsed = (jsYaml.load(content) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
        originalDataRef.current = parsed;
      } else {
        setLoadError(ack.error ?? "Failed to load config.");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }, [section, sendCommand]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Form onChange ──
  function handleFormChange(updated: Record<string, unknown>) {
    setCurrentData(updated);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  // ── Raw YAML onChange (for raw toggle and YAML-only tabs) ──
  function handleYamlChange(value: string) {
    if (rawMode || !FORM_SECTIONS.has(section)) {
      setYamlOverride(value);
      try {
        const parsed = (jsYaml.load(value) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
      } catch {
        // Invalid YAML mid-edit — keep yamlOverride, dirty tracking uses string compare
      }
    }
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  // ── Toggle raw mode ──
  function toggleRawMode() {
    if (rawMode) {
      const yaml = yamlOverride ?? originalYaml;
      try {
        const parsed = (jsYaml.load(yaml) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
        setYamlOverride(null);
        setRawMode(false);
      } catch {
        toast.error("YAML is invalid — fix errors before switching to form view.");
      }
    } else {
      setYamlOverride(jsYaml.dump(currentData, { lineWidth: 120 }));
      setRawMode(true);
    }
  }

  // ── Validate (dry-run) ──
  async function handleValidate() {
    if (validating) return;
    setValidating(true);
    setValidationResult(null);
    setShowConfirm(false);

    let changes: Record<string, unknown>;
    try {
      changes = rawMode
        ? ((jsYaml.load(yamlOverride ?? "") as Record<string, unknown>) ?? {})
        : currentData;
    } catch (err) {
      setValidationResult({ success: false, error: `YAML parse error: ${err}` });
      setValidating(false);
      return;
    }

    try {
      const ack = await sendCommand({ type: "config.update", section, changes, dry_run: true });
      if (ack.status === "ok") {
        setValidationResult({ success: true });
        setApplyEnabled(true);
      } else {
        setValidationResult({ success: false, error: ack.error ?? "Validation failed." });
      }
    } catch (err) {
      setValidationResult({ success: false, error: err instanceof Error ? err.message : "Validation request failed." });
    } finally {
      setValidating(false);
    }
  }

  // ── Apply ──
  async function handleApplyConfirm() {
    if (applying) return;
    setApplying(true);
    setShowConfirm(false);

    let changes: Record<string, unknown>;
    try {
      changes = rawMode
        ? ((jsYaml.load(yamlOverride ?? "") as Record<string, unknown>) ?? {})
        : currentData;
    } catch (err) {
      toast.error(`YAML parse error: ${err}`);
      setApplying(false);
      return;
    }

    try {
      const ack = await sendCommand({ type: "config.update", section, changes, dry_run: false });
      if (ack.status === "ok") {
        toast("Config applied and reloaded.");
        const newYaml = rawMode ? (yamlOverride ?? "") : jsYaml.dump(currentData, { lineWidth: 120 });
        setOriginalYaml(newYaml);
        originalDataRef.current = { ...currentData };
        setYamlOverride(null);
        setApplyEnabled(false);
        setValidationResult(null);
        setReloadStatus("applied");
        triggerFlash();
        setTimeout(() => setReloadStatus("confirmed"), 1500);
        setTimeout(() => setReloadStatus(null), 4000);
      } else {
        setValidationResult({ success: false, error: `Apply failed: ${ack.error ?? "Unknown error"}` });
        setReloadStatus("error");
        setReloadError(ack.error ?? "Unknown error");
      }
    } catch (err) {
      setValidationResult({ success: false, error: `Apply failed: ${err instanceof Error ? err.message : "Unknown error"}` });
      setReloadStatus("error");
      setReloadError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setApplying(false);
    }
  }

  // ── Revert ──
  function handleRevert() {
    setCurrentData({ ...originalDataRef.current });
    setYamlOverride(null);
    setShowDiff(false);
    setShowRevertConfirm(false);
    setReloadStatus(null);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  const hasForm = FORM_SECTIONS.has(section);
  const showRawToggle = hasForm;

  return (
    <div className="flex h-full max-h-[calc(100vh-64px)]">
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as SectionId)}
        orientation="vertical"
        className="flex h-full w-full"
      >
        <TabsList className="flex flex-col h-full w-44 shrink-0 border-r border-(--border) bg-transparent rounded-none justify-start gap-1 p-2">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="w-full justify-start gap-2 px-3 py-2 text-sm">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) shrink-0 gap-4">
            <h1 className="text-lg font-semibold text-(--foreground) whitespace-nowrap">
              {isDirty ? "Config •" : "Config"}
            </h1>
            <div className="flex items-center gap-2">
              {showRawToggle && (
                <Button variant="ghost" size="sm" onClick={toggleRawMode} className="gap-1.5 text-xs">
                  <Code className="h-3.5 w-3.5" />
                  {rawMode ? "Form" : "Raw YAML"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleValidate}
                disabled={isDisconnected || loading || validating || !isDirty}
              >
                {validating ? "Validating..." : "Validate"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
                disabled={!isDirty}
              >
                {showDiff ? "Hide Diff" : "Review"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={!applyEnabled || isDisconnected || applying}
              >
                {applying ? "Applying..." : "Apply"}
              </Button>
              <WSStatusIndicator status={status} />
            </div>
          </div>

          {/* Validation result */}
          {validationResult && (
            <div className={`mx-4 mt-3 px-3 py-2 text-sm border-l-2 ${
              validationResult.success
                ? "border-l-green-500 bg-green-500/10"
                : "border-l-(--status-error) bg-(--status-error)/10"
            }`}>
              {validationResult.success ? "Configuration is valid." : validationResult.error ?? "Validation failed."}
            </div>
          )}

          {/* Apply confirmation */}
          {showConfirm && (
            <div className="mx-4 mt-3 px-3 py-2 border border-(--border) bg-(--muted) flex items-center gap-3">
              <span className="text-sm">Apply and hot-reload config?</span>
              <Button size="sm" onClick={handleApplyConfirm}>Confirm</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
            </div>
          )}

          {/* Hot-reload bar */}
          <div className="px-4 pt-2">
            <HotReloadBar status={reloadStatus} errorMessage={reloadError} />
          </div>

          {/* Revert */}
          {isDirty && (
            <div className="px-4 pt-2">
              {showRevertConfirm ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-(--muted-foreground)">Revert all unsaved changes?</span>
                  <Button variant="destructive" size="sm" onClick={handleRevert}>Revert</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowRevertConfirm(false)}>Keep editing</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-(--destructive)" onClick={() => setShowRevertConfirm(true)}>
                  Revert to Saved
                </Button>
              )}
            </div>
          )}

          {/* Tab content */}
          <div ref={flashRef} className="flex-1 overflow-hidden mt-3 px-4 pb-4">
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 35}%` }} />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-(--status-error)">{loadError}</span>
                <Button variant="link" size="sm" onClick={loadConfig}>Retry</Button>
              </div>
            ) : (
              <>
                {SECTIONS.map(({ id }) => (
                  <TabsContent key={id} value={id} className="h-full mt-0">
                    {rawMode && hasForm && id === section ? (
                      <YamlSection value={yamlOverride ?? originalYaml} onChange={handleYamlChange} />
                    ) : id === "security-rules" ? (
                      <SecurityRulesForm data={currentData} onChange={handleFormChange} />
                    ) : id === "agent-types" ? (
                      <AgentTypesForm data={currentData} onChange={handleFormChange} />
                    ) : (
                      <YamlSection
                        value={id === section ? (yamlOverride ?? currentYaml) : ""}
                        onChange={handleYamlChange}
                        description={YAML_DESCRIPTIONS[id]}
                      />
                    )}
                  </TabsContent>
                ))}

                {showDiff && (
                  <div className="mt-4">
                    <DiffView original={originalYaml} current={currentYaml} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
