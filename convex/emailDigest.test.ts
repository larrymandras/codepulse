import { describe, it } from "vitest";

describe("emailDigest", () => {
  describe("sendEmailDigest action", () => {
    it.todo("logs failure when RESEND_API_KEY is not configured");
    it.todo("skips send when email-digest-enabled config is false");
    it.todo("calls Resend SDK with rendered HTML template");
    it.todo("logs success to emailDeliveryLog after successful send");
    it.todo("logs failure to emailDeliveryLog on Resend error");
  });

  describe("getEmailDigestConfig query", () => {
    it.todo("returns defaults when no agentConfigs rows exist");
    it.todo("reads email-digest-enabled and email-digest-schedule from agentConfigs");
  });

  describe("setEmailDigestConfig mutation", () => {
    it.todo("upserts email-digest-enabled agentConfigs row");
    it.todo("upserts email-digest-schedule agentConfigs row");
  });
});
