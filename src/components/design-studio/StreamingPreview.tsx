import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { streamRunEvents } from "@/lib/openDesignApi";

interface StreamingPreviewProps {
  runId: string | null;
  onGenerationComplete: () => void;
  onRegenerate: () => void;
}

/**
 * Extracts artifact HTML from accumulated text.
 * Looks for content between <artifact> tags.
 * Exported for testability.
 */
export function extractArtifact(text: string): string | null {
  const m = /<artifact[^>]*>([\s\S]*?)<\/artifact>/i.exec(text);
  return m ? m[1].trim() : null;
}

export default function StreamingPreview({
  runId,
  onGenerationComplete,
  onRegenerate,
}: StreamingPreviewProps) {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [iframeContent, setIframeContent] = useState("");
  const [accumulatedText, setAccumulatedText] = useState("");
  const [streamStatus, setStreamStatus] = useState<
    "idle" | "streaming" | "complete" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Suppress unused variable warning — accumulatedText exposed for debugging
  void accumulatedText;

  useEffect(() => {
    if (!runId) return;

    // Reset state for new run
    setLogLines([]);
    setIframeContent("");
    setAccumulatedText("");
    setStreamStatus("streaming");
    setProgress(0);
    setErrorMessage(null);

    const controller = new AbortController();
    let textBuffer = "";

    streamRunEvents(runId, {
      onToken: (text) => {
        textBuffer += text;
        setAccumulatedText(textBuffer);
        setLogLines((prev) => [...prev, text]);
        // Extract artifact HTML from accumulated text
        const artifact = extractArtifact(textBuffer);
        if (artifact) setIframeContent(artifact);
        // Approximate progress (rough heuristic based on text length)
        setProgress((prev) => Math.min(prev + 0.5, 95));
      },
      onError: (err) => {
        setStreamStatus("error");
        setErrorMessage(
          err.message || "Generation failed. The daemon returned an error.",
        );
      },
      onDone: () => {
        setStreamStatus("complete");
        setProgress(100);
        onGenerationComplete();
      },
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [runId]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 py-2">
        <Progress value={progress} className="h-1.5" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {streamStatus === "streaming"
              ? "Generating design..."
              : streamStatus === "complete"
                ? ""
                : ""}
          </span>
          {streamStatus === "complete" && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
              Preview Ready
            </Badge>
          )}
        </div>
      </div>

      {/* Split panels */}
      <div className="flex flex-1 min-h-0">
        {/* Left: streaming log */}
        <div className="w-1/2 border-r border-border/30">
          <ScrollArea className="h-full">
            <div className="p-4 bg-gray-900 min-h-full">
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap"
                >
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Right: srcdoc preview — SECURITY: sandbox="allow-scripts" WITHOUT allow-same-origin
            This prevents untrusted artifact HTML from accessing CodePulse's origin DOM.
            See STRIDE T-01-11. */}
        <div className="w-1/2">
          {iframeContent ? (
            <iframe
              title="Design Preview"
              srcDoc={iframeContent}
              sandbox="allow-scripts"
              className="w-full h-full border-0 bg-white"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Waiting for preview...
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {streamStatus === "error" && (
        <div className="px-4 py-3 bg-destructive/10 border-t border-destructive/30 flex items-center justify-between">
          <span className="text-sm text-destructive">
            {errorMessage || "Generation failed. The daemon returned an error."}
          </span>
          <button
            onClick={onRegenerate}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Regenerate button (only after completion) */}
      {streamStatus === "complete" && (
        <div className="px-4 py-3 border-t border-border/30">
          <button
            onClick={onRegenerate}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
