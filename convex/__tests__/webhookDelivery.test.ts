import { describe, test } from "vitest";

describe("Webhook Delivery (ALR-02, ALR-03)", () => {
  test.todo("sendAlertWebhook builds correct Discord embed payload with severity color");
  test.todo("sendAlertWebhook builds correct Slack block kit payload");
  test.todo("sendAlertWebhook skips delivery when alert is muted");
  test.todo("sendAlertWebhook skips delivery when delivery mode is dashboard_only");
  test.todo("sendAlertWebhook retries on failure with exponential backoff delays 5s/30s/2m");
  test.todo("sendAlertWebhook marks alert as failed after 3 failed attempts");
  test.todo("sendAlertWebhook marks alert as delivered on success");
  test.todo("sendDigest groups alerts by severity and sends consolidated message");
  test.todo("sendDigest caps at 20 alerts per message to avoid payload limits");
});
