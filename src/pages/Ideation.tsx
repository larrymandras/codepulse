import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";

const SEVERITY_TABS = ["all", "critical", "high", "medium", "low", "dismissed"] as const;
type SeverityFilter = (typeof SEVERITY_TABS)[number];

const SCAN_TYPE_TABS = ["all", "code_quality", "security", "performance", "documentation", "operational", "cost"] as const;
type ScanTypeFilter = (typeof SCAN_TYPE_TABS)[number];

const severityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10",
  high: "text-orange-400 bg-orange-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  low: "text-blue-400 bg-blue-400/10",
};

function formatTimestamp(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Ideation() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [scanTypeFilter, setScanTypeFilter] = useState<ScanTypeFilter>("all");

  const findings = useQuery(api.ideation.listFindings, {
    dismissed: severityFilter === "dismissed" ? true : undefined,
  });
  const stats = useQuery(api.ideation.findingStats);
  const dismissFinding = useMutation(api.ideation.dismissFinding);

  const filteredFindings = (findings ?? []).filter((f) => {
    if (severityFilter === "dismissed") return f.dismissed;
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (severityFilter !== "dismissed" && f.dismissed) return false;
    if (scanTypeFilter !== "all" && f.scanType !== scanTypeFilter) return false;
    return true;
  });

  const totalActive = (stats?.critical ?? 0) + (stats?.high ?? 0) + (stats?.medium ?? 0) + (stats?.low ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Ideation</h1>
        <span className="text-xs text-gray-500">{totalActive} findings</span>
      </div>

      <SectionErrorBoundary>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <MetricCard
              key={sev}
              label={sev.charAt(0).toUpperCase() + sev.slice(1)}
              value={stats?.[sev] ?? 0}
              trend="neutral"
            />
          ))}
        </div>
      </SectionErrorBoundary>

      <div className="flex gap-1 bg-gray-800/50 border border-gray-700/50 rounded-lg p-1 w-fit">
        {SCAN_TYPE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setScanTypeFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              scanTypeFilter === tab
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
            }`}
          >
            {tab === "all" ? "All" : tab}
          </button>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-800/50 border border-gray-700/50 rounded-lg p-1 w-fit">
        {SEVERITY_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSeverityFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              severityFilter === tab
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <SectionErrorBoundary>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Ideation Findings
            <InfoTooltip text="Proactive scan findings across code quality, security, performance, documentation, operational, and cost dimensions." />
            <span className="ml-2 text-xs text-gray-500 font-normal">{filteredFindings.length}</span>
          </h2>

          {filteredFindings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                {severityFilter === "dismissed" ? "No dismissed findings" : "No findings yet"}
              </p>
              {severityFilter !== "dismissed" && (
                <p className="text-xs text-gray-500 mt-1">
                  Scans run on a daily schedule. Check back after the next scheduled scan.
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1">
              {filteredFindings.map((finding) => (
                <div
                  key={finding._id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-700/30 transition-colors"
                >
                  <span className="text-xs font-mono text-gray-600 shrink-0 w-16">
                    {formatTimestamp(finding.createdAt)}
                  </span>

                  <span
                    className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                      finding.dismissed
                        ? "text-gray-400 bg-gray-600/10"
                        : severityColors[finding.severity] ?? "text-gray-400 bg-gray-600/10"
                    }`}
                  >
                    {finding.severity}
                  </span>

                  <span className="text-[10px] font-mono text-gray-500 shrink-0">
                    {finding.scanType}
                  </span>

                  <span className="text-xs text-gray-400 shrink-0">
                    {finding.category}
                  </span>

                  <span className="text-xs font-mono text-gray-500 truncate shrink-0 max-w-32">
                    {finding.location}
                  </span>

                  <span className="text-sm text-gray-300 truncate flex-1">
                    {finding.description}
                  </span>

                  {finding.dismissed ? (
                    <span className="text-[10px] text-gray-500 shrink-0">Dismissed</span>
                  ) : (
                    <button
                      onClick={() => dismissFinding({ id: finding._id })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20 transition-colors shrink-0"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionErrorBoundary>
    </div>
  );
}
