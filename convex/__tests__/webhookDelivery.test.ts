import { describe, test, expect } from "vitest";
import { buildDiscordPayload, buildSlackPayload } from "../webhookDelivery";

const SEVERITIES = ["critical", "error", "warning", "info"] as const;

const DISCORD_COLORS: Record<string, number> = {
  critical: 16711680,
  error: 16744192,
  warning: 16776960,
  info: 5592575,
};

const SLACK_EMOJIS: Record<string, string> = {
  critical: "🔴",
  error: "🟠",
  warning: "🟡",
  info: "🔵",
};

function makeAlert(severity: string) {
  return {
    message: `Test alert for ${severity}`,
    severity,
    source: `test-rule-${severity}`,
    createdAt: 1713100800, // 2024-04-14T16:00:00Z
  };
}

describe("buildDiscordPayload", () => {
  test("sendAlertWebhook builds correct Discord embed payload with severity color", () => {
    for (const sev of SEVERITIES) {
      const payload = buildDiscordPayload(makeAlert(sev));
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].color).toBe(DISCORD_COLORS[sev]);
    }
  });

  test("Discord payload includes alert message", () => {
    const alert = makeAlert("error");
    const payload = buildDiscordPayload(alert);
    expect(payload.embeds[0].title).toBe(alert.message);
  });

  test("Discord payload includes source as Rule field", () => {
    const alert = makeAlert("warning");
    const payload = buildDiscordPayload(alert);
    const ruleField = payload.embeds[0].fields.find((f) => f.name === "Rule");
    expect(ruleField?.value).toBe(alert.source);
  });

  test("Discord payload includes timestamp", () => {
    const alert = makeAlert("info");
    const payload = buildDiscordPayload(alert);
    expect(payload.embeds[0].timestamp).toBe(new Date(alert.createdAt * 1000).toISOString());
  });

  test("Discord payload falls back to info color for unknown severity", () => {
    const payload = buildDiscordPayload({
      message: "test",
      severity: "unknown",
      source: "src",
      createdAt: 1713100800,
    });
    expect(payload.embeds[0].color).toBe(5592575);
  });
});

describe("buildSlackPayload", () => {
  test("sendAlertWebhook builds correct Slack block kit payload", () => {
    for (const sev of SEVERITIES) {
      const payload = buildSlackPayload(makeAlert(sev));
      const sectionBlock = payload.blocks[0] as any;
      expect(sectionBlock.text.text).toContain(SLACK_EMOJIS[sev]);
    }
  });

  test("Slack payload includes alert message", () => {
    const alert = makeAlert("critical");
    const payload = buildSlackPayload(alert);
    const block = payload.blocks[0] as any;
    expect(block.text.text).toContain(alert.message);
  });

  test("Slack payload includes source as Rule field", () => {
    const alert = makeAlert("error");
    const payload = buildSlackPayload(alert);
    const fieldsBlock = payload.blocks[1] as any;
    const ruleField = fieldsBlock.fields.find((f: any) =>
      f.text.includes("*Rule:*")
    );
    expect(ruleField?.text).toContain(alert.source);
  });

  test("Slack payload includes a View in CodePulse button", () => {
    const alert = makeAlert("warning");
    const payload = buildSlackPayload(alert);
    const actionsBlock = payload.blocks[2];
    const button = (actionsBlock as any).elements[0];
    expect(button.type).toBe("button");
    expect(button.url).toContain("codepulse.app");
  });

  test("Slack payload falls back to white circle for unknown severity", () => {
    const payload = buildSlackPayload({
      message: "test",
      severity: "unknown",
      source: "src",
      createdAt: 1713100800,
    });
    expect((payload.blocks[0] as any).text.text).toContain("⚪");
  });
});
