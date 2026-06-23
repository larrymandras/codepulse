import { useState } from "react";
import { useFormContext } from "react-hook-form";
import type { WizardFormData } from "@/lib/wizardSchemas";
import { ChevronDown, ChevronUp, X, Plus, Search } from "lucide-react";

const KNOWN_TOOLS = [
  "web_search",
  "web_browse",
  "code_execute",
  "file_read",
  "file_write",
  "memory_read",
  "memory_write",
  "calendar_read",
  "calendar_write",
  "email_send",
  "email_read",
  "slack_send",
  "slack_read",
];

const AUTONOMY_LEVELS = ["full", "supervised", "manual"] as const;

export default function ToolsStep() {
  const { setValue, watch } = useFormContext<WizardFormData>();
  const mode = watch("tools.mode");
  const patterns = watch("tools.patterns") ?? [];
  const tools = watch("tools.tools") ?? [];
  const autonomyRules = watch("tools.autonomyRules") ?? [];
  const peerCommAllowed = watch("tools.peerCommAllowed") ?? [];
  const dailyRhythm = watch("tools.dailyRhythm") ?? [];

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [patternInput, setPatternInput] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [peerInput, setPeerInput] = useState("");

  const addPattern = () => {
    const trimmed = patternInput.trim();
    if (trimmed && !patterns.includes(trimmed)) {
      setValue("tools.patterns", [...patterns, trimmed]);
    }
    setPatternInput("");
  };

  const removePattern = (p: string) => {
    setValue(
      "tools.patterns",
      patterns.filter((x) => x !== p),
    );
  };

  const toggleTool = (tool: string) => {
    if (tools.includes(tool)) {
      setValue(
        "tools.tools",
        tools.filter((t) => t !== tool),
      );
    } else {
      setValue("tools.tools", [...tools, tool]);
    }
  };

  const filteredTools = KNOWN_TOOLS.filter((t) =>
    t.toLowerCase().includes(toolSearch.toLowerCase()),
  );

  // Autonomy rules helpers
  const addAutonomyRule = () => {
    setValue("tools.autonomyRules", [
      ...autonomyRules,
      { pattern: "", level: "supervised" as const },
    ]);
  };
  const removeAutonomyRule = (idx: number) => {
    setValue(
      "tools.autonomyRules",
      autonomyRules.filter((_, i) => i !== idx),
    );
  };
  const updateAutonomyRule = (
    idx: number,
    field: "pattern" | "level",
    val: string,
  ) => {
    const updated = [...autonomyRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setValue("tools.autonomyRules", updated);
  };

  // Daily rhythm helpers
  const addRhythm = () => {
    setValue("tools.dailyRhythm", [...dailyRhythm, { cron: "", task: "" }]);
  };
  const removeRhythm = (idx: number) => {
    setValue(
      "tools.dailyRhythm",
      dailyRhythm.filter((_, i) => i !== idx),
    );
  };
  const updateRhythm = (
    idx: number,
    field: "cron" | "task",
    val: string,
  ) => {
    const updated = [...dailyRhythm];
    updated[idx] = { ...updated[idx], [field]: val };
    setValue("tools.dailyRhythm", updated);
  };

  // Peer comm helpers
  const addPeer = () => {
    const trimmed = peerInput.trim();
    if (trimmed && !peerCommAllowed.includes(trimmed)) {
      setValue("tools.peerCommAllowed", [...peerCommAllowed, trimmed]);
    }
    setPeerInput("");
  };

  const selectedCount =
    mode === "glob" ? patterns.length : tools.length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-medium text-foreground">Tools</h2>
        <p className="text-base text-muted-foreground mt-1">
          Choose which tools this agent can use.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-1 bg-background/60 border border-border/40 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setValue("tools.mode", "glob")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === "glob"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Glob Patterns
        </button>
        <button
          onClick={() => setValue("tools.mode", "individual")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === "individual"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Individual Pick
        </button>
      </div>

      {/* Glob mode */}
      {mode === "glob" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-primary/10 text-primary rounded-lg"
              >
                {p}
                <button
                  onClick={() => removePattern(p)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPattern();
                }
              }}
              placeholder="e.g. web_*, code_*, memory_*"
              className="flex-1 px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={addPattern}
              className="px-3 py-2 text-base bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Patterns will be resolved against available tools at deployment
            time.
          </p>
        </div>
      )}

      {/* Individual mode */}
      {mode === "individual" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder="Filter tools..."
              className="w-full pl-9 pr-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="max-h-60 overflow-auto space-y-1 border border-border/40 rounded-lg p-2">
            {filteredTools.map((tool) => (
              <label
                key={tool}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={tools.includes(tool)}
                  onChange={() => toggleTool(tool)}
                  className="rounded border-border/40"
                />
                <span className="text-base text-foreground font-mono">
                  {tool}
                </span>
              </label>
            ))}
            {filteredTools.length === 0 && (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No tools match your filter.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selected summary */}
      {selectedCount > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedCount} {mode === "glob" ? "pattern" : "tool"}
          {selectedCount !== 1 ? "s" : ""} selected
        </div>
      )}

      {/* Advanced */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-5 pl-4 border-l-2 border-border/30">
            {/* Autonomy Rules */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Autonomy Rules
              </label>
              <div className="space-y-2">
                {autonomyRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rule.pattern}
                      onChange={(e) =>
                        updateAutonomyRule(idx, "pattern", e.target.value)
                      }
                      placeholder="Pattern (e.g. web_*)"
                      className="flex-1 px-3 py-1.5 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <select
                      value={rule.level}
                      onChange={(e) =>
                        updateAutonomyRule(idx, "level", e.target.value)
                      }
                      className="px-2 py-1.5 text-base bg-background/60 border border-border/40 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      {AUTONOMY_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAutonomyRule(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addAutonomyRule}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Rule
              </button>
            </div>

            {/* Peer Communication */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Peer Communication
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {peerCommAllowed.map((peer) => (
                  <span
                    key={peer}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary/10 text-primary rounded"
                  >
                    {peer}
                    <button
                      onClick={() =>
                        setValue(
                          "tools.peerCommAllowed",
                          peerCommAllowed.filter((p) => p !== peer),
                        )
                      }
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={peerInput}
                onChange={(e) => setPeerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPeer();
                  }
                }}
                placeholder="Agent ID (press Enter)"
                className="w-full px-3 py-1.5 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Daily Rhythm */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Daily Rhythm
              </label>
              <div className="space-y-2">
                {dailyRhythm.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.cron}
                      onChange={(e) =>
                        updateRhythm(idx, "cron", e.target.value)
                      }
                      placeholder="Cron (e.g. 0 9 * * *)"
                      className="w-40 px-3 py-1.5 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                    />
                    <input
                      type="text"
                      value={item.task}
                      onChange={(e) =>
                        updateRhythm(idx, "task", e.target.value)
                      }
                      placeholder="Task description"
                      className="flex-1 px-3 py-1.5 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => removeRhythm(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addRhythm}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
