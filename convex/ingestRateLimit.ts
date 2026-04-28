/**
 * Rate limiter configuration for all ingest HTTP endpoints.
 *
 * Uses @convex-dev/rate-limiter (token bucket) with four categories
 * matching the throughput recommendations from RESEARCH.md D-07.
 * Limits are scoped per-API-key (D-06).
 *
 * Categories:
 *   - ingest:  High-volume hook events (/ingest) — 120/min, burst 240
 *   - runtime: Runtime health/status (/runtime-ingest) — 60/min, burst 120
 *   - otel:    OTEL metrics + logs batches (/v1/metrics, /v1/logs) — 10/min, burst 20
 *   - general: v6, war room, HR, config, scan — 30/min, burst 60
 */

import { components } from "./_generated/api";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";

export const ingestRateLimiter = new RateLimiter(components.rateLimiter, {
  // High-volume hook event ingest (per D-06: scoped per API key)
  ingest: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 240 },
  // Runtime health/status events
  runtime: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 120 },
  // OTEL metrics and logs batches
  otel: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
  // General: v6, war room, HR, config, scan
  general: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 60 },
});

/** Rate limit category type for type-safe usage across ingest handlers. */
export type RateLimitCategory = "ingest" | "runtime" | "otel" | "general";
