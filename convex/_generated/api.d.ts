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
import type * as advisorEvents from "../advisorEvents.js";
import type * as agentConfigVersions from "../agentConfigVersions.js";
import type * as agentMetrics from "../agentMetrics.js";
import type * as agentProfiles from "../agentProfiles.js";
import type * as agents from "../agents.js";
import type * as aggregates from "../aggregates.js";
import type * as alertLifecycle from "../alertLifecycle.js";
import type * as alertMutes from "../alertMutes.js";
import type * as alertRuleCustom from "../alertRuleCustom.js";
import type * as alertRules from "../alertRules.js";
import type * as alertRulesConfig from "../alertRulesConfig.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as anomalyDetection from "../anomalyDetection.js";
import type * as apiErrors from "../apiErrors.js";
import type * as approvalQueue from "../approvalQueue.js";
import type * as archival from "../archival.js";
import type * as authAliases from "../authAliases.js";
import type * as automation from "../automation.js";
import type * as avatars from "../avatars.js";
import type * as briefings from "../briefings.js";
import type * as build from "../build.js";
import type * as callGraphEdges from "../callGraphEdges.js";
import type * as channelHealth from "../channelHealth.js";
import type * as commandExecutions from "../commandExecutions.js";
import type * as compactionEvents from "../compactionEvents.js";
import type * as configVersionIngest from "../configVersionIngest.js";
import type * as contextSnapshots from "../contextSnapshots.js";
import type * as conversationImports from "../conversationImports.js";
import type * as conversationTimeline from "../conversationTimeline.js";
import type * as coordination from "../coordination.js";
import type * as credentialAudit from "../credentialAudit.js";
import type * as crons from "../crons.js";
import type * as dataRetention from "../dataRetention.js";
import type * as deliveryLogs from "../deliveryLogs.js";
import type * as docker from "../docker.js";
import type * as dreaming from "../dreaming.js";
import type * as drift from "../drift.js";
import type * as episodic from "../episodic.js";
import type * as events from "../events.js";
import type * as executionModes from "../executionModes.js";
import type * as fileOps from "../fileOps.js";
import type * as forecasts from "../forecasts.js";
import type * as git from "../git.js";
import type * as gitActivity from "../gitActivity.js";
import type * as githubActions from "../githubActions.js";
import type * as health from "../health.js";
import type * as heroStats from "../heroStats.js";
import type * as hiveMind from "../hiveMind.js";
import type * as hrIngest from "../hrIngest.js";
import type * as http from "../http.js";
import type * as ideation from "../ideation.js";
import type * as ideationFindings from "../ideationFindings.js";
import type * as ingest from "../ingest.js";
import type * as ingestAuth from "../ingestAuth.js";
import type * as insightsChat from "../insightsChat.js";
import type * as instructionsLoaded from "../instructionsLoaded.js";
import type * as integrationCalls from "../integrationCalls.js";
import type * as integrations from "../integrations.js";
import type * as llm from "../llm.js";
import type * as meetingBot from "../meetingBot.js";
import type * as memory from "../memory.js";
import type * as memoryPreflight from "../memoryPreflight.js";
import type * as memoryQuality from "../memoryQuality.js";
import type * as memoryTiers from "../memoryTiers.js";
import type * as metrics from "../metrics.js";
import type * as missionControl from "../missionControl.js";
import type * as navCounts from "../navCounts.js";
import type * as notifications from "../notifications.js";
import type * as otelLogs from "../otelLogs.js";
import type * as otelMetrics from "../otelMetrics.js";
import type * as permissionRequests from "../permissionRequests.js";
import type * as pipelineCheckpoints from "../pipelineCheckpoints.js";
import type * as pipelines from "../pipelines.js";
import type * as profiles from "../profiles.js";
import type * as promptActivity from "../promptActivity.js";
import type * as providerHealth from "../providerHealth.js";
import type * as reflections from "../reflections.js";
import type * as registry from "../registry.js";
import type * as rosterViewPrefs from "../rosterViewPrefs.js";
import type * as runBlocks from "../runBlocks.js";
import type * as runtimeIngest from "../runtimeIngest.js";
import type * as sandboxViolations from "../sandboxViolations.js";
import type * as scan from "../scan.js";
import type * as security from "../security.js";
import type * as seedTeams from "../seedTeams.js";
import type * as selfHealing from "../selfHealing.js";
import type * as sessions from "../sessions.js";
import type * as skillCategories from "../skillCategories.js";
import type * as startupEvents from "../startupEvents.js";
import type * as supabase from "../supabase.js";
import type * as systemResources from "../systemResources.js";
import type * as tasks from "../tasks.js";
import type * as teamPresets from "../teamPresets.js";
import type * as toolExecutions from "../toolExecutions.js";
import type * as v6Ingest from "../v6Ingest.js";
import type * as v6Mutations from "../v6Mutations.js";
import type * as voiceCalls from "../voiceCalls.js";
import type * as warRoom from "../warRoom.js";
import type * as warRoomIngest from "../warRoomIngest.js";
import type * as webhookDelivery from "../webhookDelivery.js";
import type * as wizardDrafts from "../wizardDrafts.js";
import type * as worktreeEvents from "../worktreeEvents.js";
import type * as worktrees from "../worktrees.js";
import type * as wsl2 from "../wsl2.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activeTime: typeof activeTime;
  advisorEvents: typeof advisorEvents;
  agentConfigVersions: typeof agentConfigVersions;
  agentMetrics: typeof agentMetrics;
  agentProfiles: typeof agentProfiles;
  agents: typeof agents;
  aggregates: typeof aggregates;
  alertLifecycle: typeof alertLifecycle;
  alertMutes: typeof alertMutes;
  alertRuleCustom: typeof alertRuleCustom;
  alertRules: typeof alertRules;
  alertRulesConfig: typeof alertRulesConfig;
  alerts: typeof alerts;
  analytics: typeof analytics;
  anomalyDetection: typeof anomalyDetection;
  apiErrors: typeof apiErrors;
  approvalQueue: typeof approvalQueue;
  archival: typeof archival;
  authAliases: typeof authAliases;
  automation: typeof automation;
  avatars: typeof avatars;
  briefings: typeof briefings;
  build: typeof build;
  callGraphEdges: typeof callGraphEdges;
  channelHealth: typeof channelHealth;
  commandExecutions: typeof commandExecutions;
  compactionEvents: typeof compactionEvents;
  configVersionIngest: typeof configVersionIngest;
  contextSnapshots: typeof contextSnapshots;
  conversationImports: typeof conversationImports;
  conversationTimeline: typeof conversationTimeline;
  coordination: typeof coordination;
  credentialAudit: typeof credentialAudit;
  crons: typeof crons;
  dataRetention: typeof dataRetention;
  deliveryLogs: typeof deliveryLogs;
  docker: typeof docker;
  dreaming: typeof dreaming;
  drift: typeof drift;
  episodic: typeof episodic;
  events: typeof events;
  executionModes: typeof executionModes;
  fileOps: typeof fileOps;
  forecasts: typeof forecasts;
  git: typeof git;
  gitActivity: typeof gitActivity;
  githubActions: typeof githubActions;
  health: typeof health;
  heroStats: typeof heroStats;
  hiveMind: typeof hiveMind;
  hrIngest: typeof hrIngest;
  http: typeof http;
  ideation: typeof ideation;
  ideationFindings: typeof ideationFindings;
  ingest: typeof ingest;
  ingestAuth: typeof ingestAuth;
  insightsChat: typeof insightsChat;
  instructionsLoaded: typeof instructionsLoaded;
  integrationCalls: typeof integrationCalls;
  integrations: typeof integrations;
  llm: typeof llm;
  meetingBot: typeof meetingBot;
  memory: typeof memory;
  memoryPreflight: typeof memoryPreflight;
  memoryQuality: typeof memoryQuality;
  memoryTiers: typeof memoryTiers;
  metrics: typeof metrics;
  missionControl: typeof missionControl;
  navCounts: typeof navCounts;
  notifications: typeof notifications;
  otelLogs: typeof otelLogs;
  otelMetrics: typeof otelMetrics;
  permissionRequests: typeof permissionRequests;
  pipelineCheckpoints: typeof pipelineCheckpoints;
  pipelines: typeof pipelines;
  profiles: typeof profiles;
  promptActivity: typeof promptActivity;
  providerHealth: typeof providerHealth;
  reflections: typeof reflections;
  registry: typeof registry;
  rosterViewPrefs: typeof rosterViewPrefs;
  runBlocks: typeof runBlocks;
  runtimeIngest: typeof runtimeIngest;
  sandboxViolations: typeof sandboxViolations;
  scan: typeof scan;
  security: typeof security;
  seedTeams: typeof seedTeams;
  selfHealing: typeof selfHealing;
  sessions: typeof sessions;
  skillCategories: typeof skillCategories;
  startupEvents: typeof startupEvents;
  supabase: typeof supabase;
  systemResources: typeof systemResources;
  tasks: typeof tasks;
  teamPresets: typeof teamPresets;
  toolExecutions: typeof toolExecutions;
  v6Ingest: typeof v6Ingest;
  v6Mutations: typeof v6Mutations;
  voiceCalls: typeof voiceCalls;
  warRoom: typeof warRoom;
  warRoomIngest: typeof warRoomIngest;
  webhookDelivery: typeof webhookDelivery;
  wizardDrafts: typeof wizardDrafts;
  worktreeEvents: typeof worktreeEvents;
  worktrees: typeof worktrees;
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
