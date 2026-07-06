import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Per-persona KPI grid data (Quality page). Passes the selected range through
 * to listPersonaKpis (WR-04) so the 7/30/90-day selector actually moves the
 * current/previous comparison window; omitted, the backend defaults to
 * DEFAULT_KPI_RANGE_DAYS (30 days, convex/evalScores.ts Plan 04).
 */
export function useQualityKpis(rangeDays?: number) {
  return (
    useQuery(
      api.evalScores.listPersonaKpis,
      rangeDays !== undefined ? { rangeDays } : {}
    ) ?? []
  );
}

/**
 * Persona drill-in trend series + change-event markers (Quality detail page).
 * Skips the query entirely when profileId is not yet available (route param
 * not resolved), following the useAlerts.ts thin-wrapper convention.
 */
export function usePersonaDetail(profileId: string | undefined, rangeDays: number) {
  return (
    useQuery(
      api.evalScores.getPersonaDetail,
      profileId ? { profileId, rangeDays } : "skip"
    ) ?? null
  );
}

/**
 * Judged-sessions list for the persona detail page's session drill-in.
 */
export function useJudgedSessions(profileId: string | undefined, rangeDays: number) {
  return (
    useQuery(
      api.evalScores.listJudgedSessions,
      profileId ? { profileId, rangeDays } : "skip"
    ) ?? []
  );
}
