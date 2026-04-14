import { describe, it, expect } from "vitest";
import { classifyNotification } from "../notifications";

import { describe, test } from "vitest";

describe("classifyNotification", () => {
  it("routes critical severity to alert type", () => {
    const result = classifyNotification({
      severity: "critical",
      category: "security",
      title: "Critical event",
      message: "Something critical happened",
    });
    expect(result.type).toBe("alert");
  });

  it("routes error severity to alert type", () => {
    const result = classifyNotification({
      severity: "error",
      category: "provider",
      title: "Provider down",
      message: "Provider failed",
    });
    expect(result.type).toBe("alert");
  });

  it("routes warning severity to bell type", () => {
    const result = classifyNotification({
      severity: "warning",
      category: "channel",
      title: "Channel degraded",
      message: "Slack response time high",
    });
    expect(result.type).toBe("bell");
  });

  it("routes info severity to toast type with 1-hour expiry", () => {
    const result = classifyNotification({
      severity: "info",
      category: "pipe",
      title: "Pipe completed",
      message: "morning-briefing completed",
    });
    expect(result.type).toBe("toast");
    expect(result.expiresAt).toBeDefined();
    const now = Date.now() / 1000;
    expect(result.expiresAt!).toBeGreaterThan(now + 3500);
    expect(result.expiresAt!).toBeLessThan(now + 3700);
  });
});

describe("Inbox Integration (ALR-07)", () => {
  test.todo("active alerts appear as inbox items with type alert");
  test.todo("resolved alerts are excluded from inbox feed");
  test.todo("alert inbox items include acknowledge action");
  test.todo("alert inbox items include mute action");
  test.todo("inbox feed query returns alerts sorted by createdAt descending");
});
