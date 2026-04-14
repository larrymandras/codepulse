import { describe, test } from "vitest";

describe("briefings", () => {
  test.todo("onSessionCompleted skips if briefing already exists for sessionId (idempotency)");
  test.todo("onSessionCompleted schedules generateSessionBriefingAction");
  test.todo("triggerDailyDigest schedules generateDailyDigestAction");
  test.todo("daily digest stored with type='daily_digest' and correct date field");
  test.todo("session briefing stored with type='session' and correct sessionId");
  test.todo("groupActivityEvents groups by toolName and returns sorted counts");
  test.todo("groupActivityEvents returns empty array for no events");
  test.todo("callLLMWithFallback falls back to backup on primary failure");
});
