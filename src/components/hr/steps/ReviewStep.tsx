import { useState } from "react";
import { useFormContext } from "react-hook-form";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { githubDark } from "@uiw/codemirror-theme-github";
import * as jsYaml from "js-yaml";
import { toast } from "sonner";
import { createAgent } from "@/lib/astridrApi";
import type { WizardFormData } from "@/lib/wizardSchemas";
import { STEP_LABELS } from "@/lib/wizardSchemas";
import type { useWizard } from "@/hooks/useWizard";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";

interface ReviewStepProps {
  wizard: ReturnType<typeof useWizard>;
}

function buildAgentConfig(data: WizardFormData): Record<string, unknown> {
  const config: Record<string, unknown> = {
    id: data.identity.agentId,
    name: data.identity.displayName,
    tier: data.identity.tier,
    description: data.identity.description,
    profiles: data.identity.profiles,
  };
  if (data.identity.reportsTo) config.reports_to = data.identity.reportsTo;
  if (data.identity.channels?.length)
    config.channels = data.identity.channels;
  if (data.identity.budgetFraction != null)
    config.budget_fraction = data.identity.budgetFraction;
  if (data.identity.timeoutSeconds != null)
    config.timeout_seconds = data.identity.timeoutSeconds;
  if (data.identity.maxRounds != null)
    config.max_rounds = data.identity.maxRounds;
  config.tools =
    data.tools.mode === "glob" ? data.tools.patterns : data.tools.tools;
  if (data.tools.autonomyRules?.length)
    config.autonomy_rules = data.tools.autonomyRules;
  if (data.tools.peerCommAllowed?.length)
    config.peer_comm_allowed = data.tools.peerCommAllowed;
  if (data.tools.dailyRhythm?.length)
    config.daily_rhythm = data.tools.dailyRhythm;
  return config;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function ReviewStep({ wizard }: ReviewStepProps) {
  const { watch } = useFormContext<WizardFormData>();
  const data = watch();
  const [showRawConfig, setShowRawConfig] = useState(false);

  const config = buildAgentConfig(data);
  let yamlStr = "";
  try {
    yamlStr = jsYaml.dump(config, { noRefs: true, lineWidth: 80 });
  } catch {
    yamlStr = "# Failed to generate YAML";
  }

  const isEphemeral = data.deployment.type === "ephemeral";
  const toolCount =
    data.tools.mode === "glob"
      ? (data.tools.patterns?.length ?? 0)
      : (data.tools.tools?.length ?? 0);
  const personalityPreview = (data.personality.content ?? "").slice(0, 100);

  const handleDeploy = async () => {
    wizard.setDeploying(true);
    wizard.setDeployResult(null);
    try {
      const req = {
        config,
        ephemeral: isEphemeral,
        ttl_seconds: isEphemeral ? data.deployment.ttlSeconds : undefined,
        soul_variant_content:
          data.personality.mode !== "import"
            ? data.personality.content
            : undefined,
      };
      const result = await createAgent(req);
      const msg = isEphemeral
        ? `Ephemeral agent "${data.identity.displayName}" activated.`
        : `Agent "${data.identity.displayName}" created. Awaiting approval.`;
      wizard.setDeployResult({ success: true, message: msg });
      toast.success(msg);

      // Update draft status
      try {
        await wizard.autoSave();
      } catch {
        // non-critical
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Deployment failed";
      wizard.setDeployResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      wizard.setDeploying(false);
    }
  };

  // Success/error state
  if (wizard.deployResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        {wizard.deployResult.success ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Agent Deployed
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {wizard.deployResult.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEphemeral
                ? "The agent is now running."
                : "The agent will appear in the roster after approval."}
            </p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">
              Deployment Failed
            </h2>
            <p className="text-sm text-destructive text-center max-w-md">
              {wizard.deployResult.message}
            </p>
            <button
              onClick={() => wizard.setDeployResult(null)}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-medium text-foreground">
          Review & Deploy
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your agent configuration before deployment.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Template card */}
        <SummaryCard
          label={STEP_LABELS[0]}
          onEdit={() => wizard.goToStep(0)}
        >
          <p className="text-sm text-foreground">
            {data.template.catalogEntryName || "Blank Agent"}
          </p>
        </SummaryCard>

        {/* Identity card */}
        <SummaryCard
          label={STEP_LABELS[1]}
          onEdit={() => wizard.goToStep(1)}
        >
          <p className="text-sm text-foreground font-medium">
            {data.identity.displayName || "(unnamed)"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.identity.agentId || "(no id)"} --{" "}
            <span className="uppercase">{data.identity.tier}</span>
          </p>
        </SummaryCard>

        {/* Personality card */}
        <SummaryCard
          label={STEP_LABELS[2]}
          onEdit={() => wizard.goToStep(2)}
        >
          <p className="text-xs text-muted-foreground capitalize">
            Mode: {data.personality.mode}
          </p>
          <p className="text-xs text-muted-foreground">
            {wordCount(data.personality.content ?? "")} words
          </p>
          {personalityPreview && (
            <p className="text-xs text-foreground/60 truncate mt-1">
              {personalityPreview}...
            </p>
          )}
        </SummaryCard>

        {/* Tools card */}
        <SummaryCard
          label={STEP_LABELS[3]}
          onEdit={() => wizard.goToStep(3)}
        >
          <p className="text-xs text-muted-foreground capitalize">
            Mode: {data.tools.mode}
          </p>
          <p className="text-sm text-foreground">
            {toolCount} {data.tools.mode === "glob" ? "pattern" : "tool"}
            {toolCount !== 1 ? "s" : ""}
          </p>
        </SummaryCard>
      </div>

      {/* Deployment type */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          Deployment Type
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              !isEphemeral
                ? "border-primary/40 bg-primary/5"
                : "border-border/40 hover:border-border"
            }`}
          >
            <input
              type="radio"
              checked={!isEphemeral}
              onChange={() =>
                wizard.form.setValue("deployment.type", "permanent")
              }
              className="mt-0.5"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-medium text-foreground">
                  Permanent
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Creates an approval-gated agent. Persists to agent-types.yaml
                after approval.
              </p>
            </div>
          </label>
          <label
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              isEphemeral
                ? "border-primary/40 bg-primary/5"
                : "border-border/40 hover:border-border"
            }`}
          >
            <input
              type="radio"
              checked={isEphemeral}
              onChange={() =>
                wizard.form.setValue("deployment.type", "ephemeral")
              }
              className="mt-0.5"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-sm font-medium text-foreground">
                  Ephemeral
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Activates immediately. Runtime-only, auto-deregisters on
                TTL/completion.
              </p>
            </div>
          </label>
        </div>

        {!isEphemeral && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This agent will require approval before activation.
          </div>
        )}

        {isEphemeral && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              TTL (seconds) -- optional
            </label>
            <input
              type="number"
              min="1"
              value={data.deployment.ttlSeconds ?? ""}
              onChange={(e) =>
                wizard.form.setValue(
                  "deployment.ttlSeconds",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="Leave empty for no TTL"
              className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        )}
      </div>

      {/* Raw config */}
      <div>
        <button
          onClick={() => setShowRawConfig(!showRawConfig)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showRawConfig ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          View Raw Config
        </button>
        {showRawConfig && (
          <div className="mt-2 rounded-lg overflow-hidden border border-border/40">
            <CodeMirror
              value={yamlStr}
              theme={githubDark}
              extensions={[yaml()]}
              height="250px"
              readOnly
            />
          </div>
        )}
      </div>

      {/* Deploy actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/30">
        <button
          onClick={() => wizard.autoSave()}
          className="px-4 py-2 text-sm rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          Save Draft
        </button>
        <button
          onClick={handleDeploy}
          disabled={wizard.deploying}
          className="ml-auto px-6 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
        >
          {wizard.deploying ? "Deploying..." : "Deploy Agent"}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
