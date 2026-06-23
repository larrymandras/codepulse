/**
 * Langfuse trace link — opens external Langfuse dashboard (per D-07).
 * Displays as a compact link/button in the Analytics page header area.
 */
import { ExternalLink } from "lucide-react";

interface LangfuseTraceLinkProps {
  baseUrl?: string;
  className?: string;
}

export function LangfuseTraceLink({
  baseUrl = "https://cloud.langfuse.com",
  className = "",
}: LangfuseTraceLinkProps) {
  return (
    <a
      href={baseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-base font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-md transition-colors ${className}`}
    >
      <ExternalLink className="w-3.5 h-3.5" />
      Langfuse Traces
    </a>
  );
}
