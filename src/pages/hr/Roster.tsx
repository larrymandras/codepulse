import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { RosterFilterBar } from "@/components/hr/RosterFilterBar";
import { ViewSwitcher } from "@/components/hr/ViewSwitcher";
import { RosterOrgChart } from "@/components/hr/RosterOrgChart";
import { RosterCardGrid } from "@/components/hr/RosterCardGrid";
import { RosterTable } from "@/components/hr/RosterTable";
import { ApprovalBanner } from "@/components/hr/ApprovalBanner";
import { AgentDetailSheet } from "@/components/hr/AgentDetailSheet";
import { BulkActionBar } from "@/components/hr/BulkActionBar";
import { WarRoomLaunchDialog } from "@/components/hr/WarRoomLaunchDialog";
import { YamlImportDialog } from "@/components/hr/YamlImportDialog";
import {
  useRosterAgents,
  filterAgents,
  sortAgents,
} from "@/hooks/useRosterAgents";
import { useRosterPrefs } from "@/hooks/useRosterPrefs";
import { Button } from "@/components/ui/button";
import { Users, Plus, RefreshCw, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";

export default function Roster() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  const { agents, isLoading, error, refetch } = useRosterAgents();
  const {
    viewMode,
    sortBy,
    filters,
    setViewMode,
    setSortBy,
    setFilters,
  } = useRosterPrefs();

  const [search, setSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agentId ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Compute filtered & sorted agents
  const filteredAgents = useMemo(
    () => filterAgents(agents, { ...filters, search }),
    [agents, filters, search],
  );
  const sortedAgents = useMemo(
    () => sortAgents(filteredAgents, sortBy, "asc"),
    [filteredAgents, sortBy],
  );

  // Stats
  const totalCount = agents.length;
  const activeCount = agents.filter((a) => a.status === "active").length;
  const pendingCount = agents.filter((a) => a.status === "pending").length;

  // Unique profiles for filter dropdown
  const profiles = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) {
      for (const p of a.profiles ?? []) set.add(p);
    }
    return Array.from(set).sort();
  }, [agents]);

  const handleAgentClick = (id: string) => {
    setSelectedAgentId(id);
    navigate(`/hr/roster/${id}`, { replace: true });
  };

  const handleDetailClose = () => {
    setSelectedAgentId(null);
    navigate("/hr/roster", { replace: true });
  };

  const handleDeregister = () => {
    setSelectedAgentId(null);
    navigate("/hr/roster", { replace: true });
    refetch();
  };

  // Error state
  if (error && agents.length === 0) {
    return (
      <div className="flex-1 overflow-auto">
        <GlassPanel className="m-6 p-8 hover:scale-[1.01] transition-transform duration-300">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-base text-destructive">
              Failed to load agents — check that Astridhr is running and
              accessible.
            </p>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <GlassPanel className="m-6 p-6 flex-1 overflow-y-auto flex flex-col gap-6 relative hover:scale-[1.01] transition-transform duration-300">
        <div className="flex flex-col gap-6 relative z-10">
          {/* Header row */}
          <PageHeader
            title="Agent Roster"
            icon={Users}
            actions={
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-xs font-mono tracking-widest uppercase text-muted-foreground/80 bg-muted/20 px-3 py-1 rounded border border-border/50">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary/70" />
                    {totalCount} total
                  </span>
                  <span className="text-[var(--status-ok)] font-bold drop-shadow-[var(--glow-xs)]">
                    {activeCount} active
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-[var(--status-warn)] font-bold drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImportDialog(true)}
                    className="font-mono text-xs uppercase tracking-widest border-primary/20 hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Import YAML
                  </Button>
                  <Button asChild size="sm" className="font-mono text-xs uppercase tracking-widest shadow-[var(--glow-xs)] hover:shadow-[var(--glow-md)] transition-all">
                    <Link to="/hr/onboarding">
                      <Plus className="h-4 w-4 mr-1" />
                      Onboard Agent
                    </Link>
                  </Button>
                </div>
              </div>
            }
          />

          {/* Filter row + view switcher */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <RosterFilterBar
              filters={filters}
              search={search}
              onFiltersChange={setFilters}
              onSearchChange={setSearch}
              profiles={profiles}
            />
            <ViewSwitcher value={viewMode} onChange={setViewMode} />
          </div>

          {/* Approval banner */}
          <ApprovalBanner onDetailsClick={handleAgentClick} />

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[180px] rounded-lg" />
              ))}
            </div>
          )}

          {/* View area */}
          {!isLoading && (
            <>
              {sortedAgents.length === 0 && agents.length > 0 && (
                <p className="text-base text-muted-foreground text-center py-12">
                  No agents match your search.
                </p>
              )}

              {sortedAgents.length === 0 && agents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-base font-medium text-foreground">
                    No agents registered
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Agents will appear here once registered through the
                    onboarding wizard or config files. Get started by onboarding
                    your first agent.
                  </p>
                </div>
              )}

              {sortedAgents.length > 0 && (
                <div className="min-h-[400px]">
                  {viewMode === "chart" && (
                    <RosterOrgChart
                      agents={sortedAgents}
                      onAgentClick={handleAgentClick}
                    />
                  )}
                  {viewMode === "grid" && (
                    <RosterCardGrid
                      agents={sortedAgents}
                      onAgentClick={handleAgentClick}
                    />
                  )}
                  {viewMode === "table" && (
                    <RosterTable
                      agents={sortedAgents}
                      onAgentClick={handleAgentClick}
                      sortBy={sortBy}
                      onSortChange={setSortBy}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </GlassPanel>

      {/* Bulk action bar for multi-select */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onLaunchWarRoom={() => setShowLaunchDialog(true)}
        onClearSelection={() => setSelectedIds([])}
      />

      {/* Agent detail slide-out panel */}
      <AgentDetailSheet
        agentId={selectedAgentId}
        onClose={handleDetailClose}
        onDeregister={handleDeregister}
      />

      {/* YAML Import Dialog */}
      <YamlImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={refetch}
      />

      {/* War Room Launch Dialog (ad-hoc from roster) */}
      <WarRoomLaunchDialog
        open={showLaunchDialog}
        onOpenChange={(open) => {
          setShowLaunchDialog(open);
          if (!open) setSelectedIds([]);
        }}
        initialParticipantIds={selectedIds}
        showSaveAsTeam={true}
      />
    </div>
  );
}
