// Shared sankey-flow classifier.
//
// Extracted VERBATIM from convex/analytics.ts:53-65 (Phase 88, D-02/Pitfall 2).
// This is the SOLE source of categoryOf/outcomeOf so the read path (analytics.ts
// toolFlowSankey) and the ingest-time write path (analyticsRollup.ts
// incrementSankeyBuckets) can never drift in how they classify an event. Any
// change here changes both paths atomically.
//
// outcomeOf historically took a `{ eventType, payload }` object but only ever read
// `eventType` (RESEARCH OQ-2). The unused `payload` param is dropped here; callers
// pass the eventType string directly.

export function categoryOf(eventType: string): string {
  if (eventType.startsWith("tool_")) return "Tool Use";
  if (eventType.startsWith("llm_") || eventType.startsWith("model_")) return "LLM";
  if (eventType.startsWith("file_")) return "File Ops";
  if (eventType.startsWith("agent_")) return "Agents";
  return "Other";
}

export function outcomeOf(eventType: string): string {
  if (eventType.includes("error") || eventType.includes("fail")) return "Error";
  if (eventType.includes("hitl") || eventType.includes("review")) return "HITL";
  return "Success";
}
