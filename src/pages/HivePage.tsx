/**
 * HivePage — Swarm observability page.
 *
 * Phase 149-05 — PULSE-03 + PULSE-04 composition.
 * Composes SwarmGraph + BlackboardPanel + CostBreakdown + GoalPicker, each
 * region wrapped in SectionErrorBoundary + GlassPanel, sharing one goalId
 * state that auto-follows the newest goal from useGoalList() (D-08).
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildFocusUrl } from "../lib/focus-url";
import SwarmGraph from "../components/SwarmGraph";
import BlackboardPanel from "../components/BlackboardPanel";
import CostBreakdown from "../components/CostBreakdown";
import GoalPicker from "../components/GoalPicker";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { GlassPanel } from "../components/GlassPanel";
import SwarmTaskDetail, { type SwarmTaskDetailData } from "../components/SwarmTaskDetail";
import { useGoalList } from "../hooks/useSwarmGraph";

export default function HivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalParam = searchParams.get("goal");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<SwarmTaskDetailData | null>(null);
  const goals = useGoalList();

  // Inbound deep-link: /hive?goal=<id> (from a Tool Galaxy agent's "swarm goals"
  // link) preselects that goal instead of auto-following the newest.
  useEffect(() => {
    if (goalParam) setGoalId(goalParam);
  }, [goalParam]);

  // D-08: auto-follow the most-recent goal when none is selected yet — but a
  // ?goal= deep-link takes precedence (don't clobber it on mount).
  useEffect(() => {
    if (goalParam) return;
    if (goalId === null && goals.length > 0) {
      setGoalId(goals[0].goalId);
    }
  }, [goalId, goals, goalParam]);

  return (
    <div className="space-y-6 p-6">
      {/* Page header: HIVE MIND label + live-pulse dot + GoalPicker right */}
      <div className="flex items-center justify-between">
        <h1 className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          HIVE MIND
        </h1>
        <GoalPicker selectedGoalId={goalId} onSelect={setGoalId} />
      </div>

      {/* Region 1: Swarm Graph hero */}
      <SectionErrorBoundary name="Swarm Graph">
        <GlassPanel className="rounded-xl p-5 min-h-[520px] hover:scale-[1.01] transition-transform duration-300">
          <SwarmGraph goalId={goalId} onSelectTask={setSelectedTask} />
        </GlassPanel>
      </SectionErrorBoundary>

      {/* Regions 2 + 3: Blackboard + Cost — side-by-side on ≥1280px, stacked below */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionErrorBoundary name="Blackboard">
          <GlassPanel className="rounded-xl p-5 hover:scale-[1.01] transition-transform duration-300">
            <BlackboardPanel goalId={goalId} onSelectTask={setSelectedTask} />
          </GlassPanel>
        </SectionErrorBoundary>
        <SectionErrorBoundary name="Cost">
          <GlassPanel className="rounded-xl p-5 hover:scale-[1.01] transition-transform duration-300">
            <CostBreakdown goalId={goalId} />
          </GlassPanel>
        </SectionErrorBoundary>
      </div>

      {/* Click-to-read detail panel — opened by graph node or blackboard row.
          Its agent deep-links to the Code/Vault graph (GH-04 cross-nav). */}
      <SwarmTaskDetail
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAgentNav={(agent) =>
          navigate(
            buildFocusUrl(
              { surface: "tool-galaxy", nodeId: `agent:${agent}` },
              "/hive",
            ),
          )
        }
      />
    </div>
  );
}
