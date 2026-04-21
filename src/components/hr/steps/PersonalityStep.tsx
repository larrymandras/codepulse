import { useState, useRef } from "react";
import { useFormContext } from "react-hook-form";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { githubDark } from "@uiw/codemirror-theme-github";
import type { WizardFormData } from "@/lib/wizardSchemas";
import { ChevronDown, ChevronUp, FileUp } from "lucide-react";

const MODES = [
  { value: "template", label: "From Template" },
  { value: "custom", label: "Write Custom" },
  { value: "import", label: "Import File" },
] as const;

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function PersonalityStep() {
  const { setValue, watch } = useFormContext<WizardFormData>();
  const mode = watch("personality.mode");
  const content = watch("personality.content") ?? "";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setValue("personality.content", text);
      setValue("personality.mode", "import");
      setImportedFile(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-medium text-foreground">Personality</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define the agent's soul variant -- its personality, instructions, and
          behavioral guidelines.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-1 bg-background/60 border border-border/40 rounded-lg p-0.5 w-fit">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setValue("personality.mode", m.value)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              mode === m.value
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Info banners */}
      {mode === "template" && content && (
        <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          Pre-filled from template. Edit below to customize.
        </div>
      )}
      {mode === "import" && importedFile && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <FileUp className="h-3.5 w-3.5" />
          Imported: {importedFile}
        </div>
      )}

      {/* File import trigger (only in import mode) */}
      {mode === "import" && !importedFile && (
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 text-sm border-2 border-dashed border-border/50 rounded-lg text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <FileUp className="h-4 w-4" />
            Choose a .md file to import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      )}

      {/* CodeMirror editor */}
      <div className="rounded-lg overflow-hidden border border-border/40">
        <CodeMirror
          value={content}
          onChange={(val) => setValue("personality.content", val)}
          theme={githubDark}
          extensions={[markdown()]}
          height="300px"
          placeholder="Write the agent's personality and behavioral instructions in markdown..."
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {wordCount(content)} words
      </p>

      {/* Advanced */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 pl-4 border-l-2 border-border/30">
            {/* System Prompt Override */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                System Prompt Override
              </label>
              <textarea
                value={watch("personality.systemPromptOverride") ?? ""}
                onChange={(e) =>
                  setValue("personality.systemPromptOverride", e.target.value)
                }
                rows={4}
                placeholder="Raw system_prompt that overrides personality content..."
                className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none font-mono"
              />
            </div>

            {/* Soul Variant Path */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Soul Variant Path
              </label>
              <input
                value={watch("personality.soulVariantPath") ?? ""}
                onChange={(e) =>
                  setValue("personality.soulVariantPath", e.target.value)
                }
                placeholder="souls/my-variant.md"
                className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Memory paths */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                L1 Index Path
              </label>
              <input
                value={watch("personality.l1Index") ?? ""}
                onChange={(e) =>
                  setValue("personality.l1Index", e.target.value)
                }
                placeholder="memory/l1/index.md"
                className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                L2 Topics Directory
              </label>
              <input
                value={watch("personality.l2TopicsDir") ?? ""}
                onChange={(e) =>
                  setValue("personality.l2TopicsDir", e.target.value)
                }
                placeholder="memory/l2/topics/"
                className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                L3 Logs Directory
              </label>
              <input
                value={watch("personality.l3LogsDir") ?? ""}
                onChange={(e) =>
                  setValue("personality.l3LogsDir", e.target.value)
                }
                placeholder="memory/l3/logs/"
                className="w-full px-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
