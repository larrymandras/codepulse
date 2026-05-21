import { describe, it, expect, vi } from "vitest";

describe("otelLogs — GW-01: OTel default fix", () => {
  it.todo("api_request without provider attribute defaults to 'unknown' not 'anthropic'");
  it.todo("api_request WITH provider attribute uses that provider value");
  it.todo("logs console.warn when provider attribute is missing");
});

describe("otelLogs — GW-02: gateway event routing", () => {
  it.todo("gateway.task_completed routes to toolExecutions with provider field");
  it.todo("gateway.task_failed routes to toolExecutions with success=false");
  it.todo("gateway.task_started routes to toolExecutions");
  it.todo("gateway.routing_decision routes to events.ingest");
});

describe("otelLogs — GW-04: backward compatibility", () => {
  it.todo("tool_result continues routing to toolExecutions without provider");
  it.todo("api_request with provider='anthropic' attribute still routes correctly");
  it.todo("user_prompt still routes to promptActivity");
});

describe("otelMetrics — GW-01: OTel default fix", () => {
  it.todo("claude_code.cost.usage without provider defaults to 'unknown'");
  it.todo("claude_code.token.usage without provider defaults to 'unknown'");
});
