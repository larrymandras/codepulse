/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activeTime from "../activeTime.js";
import type * as agentProfiles from "../agentProfiles.js";
import type * as agents from "../agents.js";
import type * as alertRules from "../alertRules.js";
import type * as alertRulesConfig from "../alertRulesConfig.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as apiErrors from "../apiErrors.js";
import type * as automation from "../automation.js";
import type * as avatars from "../avatars.js";
import type * as build from "../build.js";
import type * as compactionEvents from "../compactionEvents.js";
import type * as contextSnapshots from "../contextSnapshots.js";
import type * as coordination from "../coordination.js";
import type * as crons from "../crons.js";
import type * as dataRetention from "../dataRetention.js";
import type * as docker from "../docker.js";
import type * as drift from "../drift.js";
import type * as episodic from "../episodic.js";
import type * as events from "../events.js";
import type * as fileOps from "../fileOps.js";
import type * as forge from "../forge.js";
import type * as git from "../git.js";
import type * as gitActivity from "../gitActivity.js";
import type * as health from "../health.js";
import type * as heroStats from "../heroStats.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as instructionsLoaded from "../instructionsLoaded.js";
import type * as integrations from "../integrations.js";
import type * as llm from "../llm.js";
import type * as memory from "../memory.js";
import type * as metrics from "../metrics.js";
import type * as otelLogs from "../otelLogs.js";
import type * as otelMetrics from "../otelMetrics.js";
import type * as permissionRequests from "../permissionRequests.js";
import type * as pipelines from "../pipelines.js";
import type * as profiles from "../profiles.js";
import type * as promptActivity from "../promptActivity.js";
import type * as registry from "../registry.js";
import type * as runtimeIngest from "../runtimeIngest.js";
import type * as scan from "../scan.js";
import type * as security from "../security.js";
import type * as seedTeams from "../seedTeams.js";
import type * as selfHealing from "../selfHealing.js";
import type * as sessions from "../sessions.js";
import type * as supabase from "../supabase.js";
import type * as systemResources from "../systemResources.js";
import type * as toolExecutions from "../toolExecutions.js";
import type * as worktreeEvents from "../worktreeEvents.js";
import type * as wsl2 from "../wsl2.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activeTime: typeof activeTime;
  agentProfiles: typeof agentProfiles;
  agents: typeof agents;
  alertRules: typeof alertRules;
  alertRulesConfig: typeof alertRulesConfig;
  alerts: typeof alerts;
  analytics: typeof analytics;
  apiErrors: typeof apiErrors;
  automation: typeof automation;
  avatars: typeof avatars;
  build: typeof build;
  compactionEvents: typeof compactionEvents;
  contextSnapshots: typeof contextSnapshots;
  coordination: typeof coordination;
  crons: typeof crons;
  dataRetention: typeof dataRetention;
  docker: typeof docker;
  drift: typeof drift;
  episodic: typeof episodic;
  events: typeof events;
  fileOps: typeof fileOps;
  forge: typeof forge;
  git: typeof git;
  gitActivity: typeof gitActivity;
  health: typeof health;
  heroStats: typeof heroStats;
  http: typeof http;
  ingest: typeof ingest;
  instructionsLoaded: typeof instructionsLoaded;
  integrations: typeof integrations;
  llm: typeof llm;
  memory: typeof memory;
  metrics: typeof metrics;
  otelLogs: typeof otelLogs;
  otelMetrics: typeof otelMetrics;
  permissionRequests: typeof permissionRequests;
  pipelines: typeof pipelines;
  profiles: typeof profiles;
  promptActivity: typeof promptActivity;
  registry: typeof registry;
  runtimeIngest: typeof runtimeIngest;
  scan: typeof scan;
  security: typeof security;
  seedTeams: typeof seedTeams;
  selfHealing: typeof selfHealing;
  sessions: typeof sessions;
  supabase: typeof supabase;
  systemResources: typeof systemResources;
  toolExecutions: typeof toolExecutions;
  worktreeEvents: typeof worktreeEvents;
  wsl2: typeof wsl2;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
