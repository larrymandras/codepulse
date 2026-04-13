import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { anyApi } from "convex/server";
import { toast } from "sonner";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import { IdeationRow } from "../components/IdeationRow";
import type { IdeationRowFinding } from "../components/IdeationRow";
import { TaskCreateForm } from "../components/TaskCreateForm";
import { findingToTaskDefaults } from "../lib/findingToTask";
import type { NewTask, TaskColumn } from "../types/kanban";

const SEVERITY_TABS = ["all", "critical", "high", "medium", "low"] as const;
type SeverityFilter = (typeof SEVERITY_TABS)[number];

const SCAN_TYPE_TABS = ["all", "code_quality", "security", "performance", "documentation", "operational", "cost"] as const;
type ScanTypeFilter = (typeof SCAN_TYPE_TABS)[number];

const STATUS_TABS = ["all", "open", "acknowledged", "converted", "dismissed"] as const;
type StatusFilter = (typeof STATUS_TABS)[number];

export default function Ideation() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [scanTypeFilter, setScanTypeFilter] = useState<ScanTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<NewTask> | null>(null);

  const findings = useQuery(api.ideation.listFindings, { dismissed: false }) ?? [];
  const stats = useQuery(api.ideation.findingStats);
  const createTask = useMutation(anyApi.tasks.create);
  const updateStatus = useMutation(api.ideation.updateFindingStatus);
  const linkTask = useMutation(api.ideation.linkTask);

  // ESC to deselect
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedIds(new Set());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (scanTypeFilter !== "all" && f.scanType !== scanTypeFilter) return false;
    if (statusFilter !== "all") {
      const effectiveStatus = f.status ?? (f.dismissed ? "dismissed" : "open");
      if (effectiveStatus !== statusFilter) return false;
    }
    return true;
  });

  const totalActive = (stats?.critical ?? 0) + (stats?.high ?? 0) + (stats?.medium ?? 0) + (stats?.low ?? 0);

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleBulkConvert() {
    const selected = filteredFindings.filter(f => selectedIds.has(f._id));
    for (const finding of selected) {
      const defaults = findingToTaskDefaults(finding);
      const taskId = await createTask({
        title: defaults.title ?? finding.description,
        priority: defaults.priority ?? "medium",
        description: defaults.description,
        labels: defaults.labels,
        findingId: finding._id as Parameters<typeof createTask>[0]["findingId"],
      });
      await linkTask({ id: finding._id, taskId: taskId as string });
    }
    setSelectedIds(new Set());
    toast.success(`Converted ${selected.length} findings to tasks`);
  }

  function handleCreateTask(finding: IdeationRowFinding) {
    const defaults = findingToTaskDefaults(finding);
    setPrefillData(defaults);
    setShowCreateForm(true);
  }

  async function handleFormSubmit(task: NewTask, column: TaskColumn) {
    const taskId = await createTask({
      title: task.title,
      priority: task.priority,
      description: task.description,
      agentId: task.agentId,
      agentName: task.agentName,
      labels: task.labels,
    });
    if (prefillData?.findingId) {
      await linkTask({ id: prefillData.findingId as Parameters<typeof linkTask>[0]["id"], taskId: taskId as string });
    }
    setShowCreateForm(false);
    setPrefillData(null);
    toast.success("Task created");
  }

  async function handleAcknowledge(id: string) {
    await updateStatus({ id: id as Parameters<typeof updateStatus>[0]["id"], status: "acknowledged" });
  }

  async function handleDismiss(id: string) {
    await updateStatus({ id: id as Parameters<typeof updateStatus>[0]["id"], status: "dismissed" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Ideation</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkConvert}
              className="text-sm px-3 py-1.5 bg-(--primary) text-(--primary-foreground) hover:opacity-90 transition-opacity"
            >
              Convert Selected ({selectedIds.size})
            </button>
          )}
          <span className="text-xs text-gray-500">{totalActive} findings</span>
        </div>
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

      {/* Scan type filter */}
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

      {/* Severity filter */}
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

      {/* Status filter */}
      <div className="flex gap-1 bg-gray-800/50 border border-gray-700/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              statusFilter === tab
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

          {findings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No findings</p>
              <p className="text-xs text-gray-500 mt-1">
                Proactive scans run on a daily schedule. Check back after the next scan.
              </p>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No findings match this filter</p>
              <p className="text-xs text-gray-500 mt-1">
                Try clearing the severity or scan type filter.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {filteredFindings.map((finding) => (
                <IdeationRow
                  key={finding._id}
                  finding={finding as IdeationRowFinding}
                  isSelected={selectedIds.has(finding._id)}
                  onSelect={handleSelect}
                  onCreateTask={handleCreateTask}
                  onAcknowledge={handleAcknowledge}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </div>
      </SectionErrorBoundary>

      <TaskCreateForm
        open={showCreateForm}
        defaultColumn="backlog"
        onClose={() => {
          setShowCreateForm(false);
          setPrefillData(null);
        }}
        onSubmit={handleFormSubmit}
        prefillData={prefillData}
      />
    </div>
  );
}
