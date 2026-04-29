/**
 * useHitlApprovals — REST polling hook for HITL approval requests.
 *
 * Polls GET /api/hitl/pending every 10 seconds and exposes approve/reject
 * actions that call the corresponding REST POST endpoints.
 *
 * Auth: Authorization: Bearer {VITE_ASTRIDR_API_KEY} on all requests,
 * using the same env var as AstridrWSContext and astridrApi.ts.
 *
 * Error handling:
 *   - Background poll failure: sets error state, keeps existing approvals (stale-while-revalidate)
 *   - Action failure (approve/reject): throws for caller to display as toast
 *   - 404 on action: throws with "This request was already resolved" message
 *
 * Phase 86: DATA-03, DATA-04 — HITL approval dashboard integration.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const ASTRIDR_API_BASE = (import.meta.env.VITE_ASTRIDR_API_URL as string | undefined) ?? "";
const ASTRIDR_API_KEY = (import.meta.env.VITE_ASTRIDR_API_KEY as string | undefined) ?? "";

const POLL_INTERVAL_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HitlApproval {
  id: string;
  action: string;
  details: Record<string, unknown>;
  profile_id: string;
  channel_id: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
  decided_by?: string; // "telegram" | "dashboard" | "codepulse" | etc.
  decided_at?: number;
}

export interface UseHitlApprovalsReturn {
  approvals: HitlApproval[];
  loading: boolean;
  error: string | null;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHitlApprovals(): UseHitlApprovalsReturn {
  const [approvals, setApprovals] = useState<HitlApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mount state to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchApprovals = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${ASTRIDR_API_BASE}/api/hitl/pending`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HITL poll failed: ${res.status}`);
      }
      const data = (await res.json()) as HitlApproval[];
      if (mountedRef.current) {
        setApprovals(data);
        setError(null);
      }
    } catch (err) {
      // Stale-while-revalidate: keep existing data, just set error
      if (mountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load approvals. Check connection to Astridhr."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch + polling interval
  useEffect(() => {
    mountedRef.current = true;

    void fetchApprovals();

    const interval = setInterval(() => {
      void fetchApprovals();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchApprovals]);

  const approve = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`${ASTRIDR_API_BASE}/api/hitl/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ decided_by: "dashboard" }),
      });

      if (res.status === 404) {
        await fetchApprovals();
        throw new Error("This request was already resolved.");
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        const msg =
          typeof body.detail === "string" ? body.detail : `Approval failed: ${res.status}`;
        throw new Error(msg);
      }

      await fetchApprovals();
    },
    [fetchApprovals]
  );

  const reject = useCallback(
    async (id: string, reason?: string): Promise<void> => {
      const res = await fetch(`${ASTRIDR_API_BASE}/api/hitl/${id}/reject`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ decided_by: "dashboard", reason: reason ?? null }),
      });

      if (res.status === 404) {
        await fetchApprovals();
        throw new Error("This request was already resolved.");
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        const msg =
          typeof body.detail === "string" ? body.detail : `Rejection failed: ${res.status}`;
        throw new Error(msg);
      }

      await fetchApprovals();
    },
    [fetchApprovals]
  );

  return {
    approvals,
    loading,
    error,
    approve,
    reject,
    refresh: fetchApprovals,
  };
}
