import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { previewTemplate } from "@/lib/astridrApi";
import {
  buildSampleVariables,
  type VariableDefinition,
} from "@/lib/emailTemplateUtils";

interface EmailPreviewPaneProps {
  slug: string;
  html: string;
  subject: string;
  variables: Record<string, VariableDefinition>;
  disabled?: boolean;
}

export function EmailPreviewPane({
  slug,
  html,
  subject,
  variables,
  disabled = false,
}: EmailPreviewPaneProps) {
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [channel, setChannel] = useState<"smtp" | "gmail">("smtp");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (disabled) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(false);
      try {
        const sampleVars = buildSampleVariables(variables);
        const result = await previewTemplate(slug, {
          variables: sampleVars,
          channel,
        });
        setPreviewHtml(result.html);
      } catch {
        setPreviewError(true);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timerRef.current);
  }, [slug, html, subject, variables, channel, disabled]);

  if (disabled) {
    return (
      <div className="flex flex-col h-full border border-border rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 text-xs">
          <span className="text-muted-foreground">Preview</span>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground bg-muted/20">
          Save the template first to enable preview.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-md overflow-hidden">
      {/* Preview header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 text-xs">
        <span className="text-muted-foreground">Preview</span>
        <ToggleGroup
          type="single"
          value={channel}
          onValueChange={(v) => {
            if (v === "smtp" || v === "gmail") setChannel(v);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="smtp" className="text-xs px-2 py-0.5 h-6">
            SMTP
          </ToggleGroupItem>
          <ToggleGroupItem value="gmail" className="text-xs px-2 py-0.5 h-6">
            Gmail
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="w-16 flex items-center justify-end gap-1">
          {previewLoading && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Updating preview…</span>
            </>
          )}
        </div>
      </div>

      {/* Preview body */}
      {previewError ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-destructive text-center">
            Preview failed. Check your template syntax and variable definitions.
          </p>
        </div>
      ) : (
        <iframe
          srcDoc={previewHtml}
          sandbox="allow-same-origin"
          className="flex-1 w-full border-0"
          title="Email preview"
        />
      )}
    </div>
  );
}

export default EmailPreviewPane;
