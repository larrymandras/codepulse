/**
 * Tests for src/hooks/useLifecycle.ts — LifecycleCommandRow adapter, status
 * mapper, and per-skill lookup helper (Phase 98, LIFE-06).
 *
 * Following the repo's pure-logic testing pattern (see useIntake.test.ts
 * precedent): exercise mapLifecycleStatus, adaptLifecycleCommand, and
 * latestLifecycleForSkill as plain functions, no React rendering, no Convex
 * mock needed.
 */

import { describe, it, expect } from "vitest";
import {
  mapLifecycleStatus,
  adaptLifecycleCommand,
  latestLifecycleForSkill,
  type LifecycleCommandRow,
} from "./useLifecycle";

// ---------------------------------------------------------------------------
// mapLifecycleStatus — same behavior as mapIntakeStatus: every known raw
// status passes through unchanged, unknown values fall back to "queued"
// without throwing.
// ---------------------------------------------------------------------------

describe("mapLifecycleStatus", () => {
  it("passes 'queued' through unchanged", () => {
    expect(mapLifecycleStatus("queued")).toBe("queued");
  });

  it("passes 'executing' through unchanged", () => {
    expect(mapLifecycleStatus("executing")).toBe("executing");
  });

  it("passes 'done' through unchanged", () => {
    expect(mapLifecycleStatus("done")).toBe("done");
  });

  it("passes 'failed' through unchanged", () => {
    expect(mapLifecycleStatus("failed")).toBe("failed");
  });

  it("passes 'expired' through unchanged", () => {
    expect(mapLifecycleStatus("expired")).toBe("expired");
  });

  it("falls back to 'queued' for an unexpected raw value, without throwing", () => {
    expect(() => mapLifecycleStatus("some-unexpected-value")).not.toThrow();
    expect(mapLifecycleStatus("some-unexpected-value")).toBe("queued");
  });
});

// ---------------------------------------------------------------------------
// adaptLifecycleCommand
// ---------------------------------------------------------------------------

describe("adaptLifecycleCommand", () => {
  it("reads lifecyclePayload fields (skillName, action, destination, workspaceId, sourceOrigin)", () => {
    const doc = {
      commandId: "cmd-1",
      status: "queued",
      lifecyclePayload: {
        action: "move",
        skillName: "legal",
        sourceOrigin: "claude-code",
        destination: "project",
        workspaceId: "ws-1",
      },
      error: null,
      createdAt: 1000,
      expiresAt: 2000,
    };

    const row = adaptLifecycleCommand(doc);

    expect(row).toEqual({
      commandId: "cmd-1",
      status: "queued",
      skillName: "legal",
      action: "move",
      sourceOrigin: "claude-code",
      destination: "project",
      workspaceId: "ws-1",
      error: null,
      createdAt: 1000,
      expiresAt: 2000,
    });
  });

  it("does not throw on a malformed row with lifecyclePayload: null — every payload-derived field resolves safely", () => {
    const doc = {
      commandId: "cmd-2",
      status: "failed",
      lifecyclePayload: null,
      error: "boom",
      createdAt: 1000,
      expiresAt: 2000,
    };

    expect(() => adaptLifecycleCommand(doc)).not.toThrow();
    const row = adaptLifecycleCommand(doc);
    expect(row.skillName).toBe("");
    expect(row.action).toBe("archive");
    expect(row.sourceOrigin).toBeNull();
    expect(row.destination).toBeNull();
    expect(row.workspaceId).toBeNull();
    expect(row.error).toBe("boom");
  });

  it("maps doc.error through with ?? null coalescing", () => {
    const doc = {
      commandId: "cmd-3",
      status: "done",
      lifecyclePayload: {
        action: "delete",
        skillName: "old-skill",
        sourceOrigin: "claude-code:available",
        destination: "cold",
        workspaceId: null,
      },
      createdAt: 1000,
      expiresAt: 2000,
    };

    const row = adaptLifecycleCommand(doc);
    expect(row.error).toBeNull();
    expect(row.status).toBe("done");
    expect(row.action).toBe("delete");
    expect(row.skillName).toBe("old-skill");
  });
});

// ---------------------------------------------------------------------------
// latestLifecycleForSkill
// ---------------------------------------------------------------------------

describe("latestLifecycleForSkill", () => {
  const rowFor = (
    skillName: string,
    createdAt: number,
    overrides: Partial<LifecycleCommandRow> = {}
  ): LifecycleCommandRow => ({
    commandId: `cmd-${skillName}-${createdAt}`,
    status: "queued",
    skillName,
    action: "archive",
    sourceOrigin: "claude-code",
    destination: "cold",
    workspaceId: null,
    error: null,
    createdAt,
    expiresAt: createdAt + 1000,
    ...overrides,
  });

  it("returns null when no row matches the given skillName", () => {
    const rows = [rowFor("legal", 1000), rowFor("finance", 2000)];
    expect(latestLifecycleForSkill(rows, "not-present")).toBeNull();
  });

  it("returns the single matching row when only one exists", () => {
    const rows = [rowFor("legal", 1000), rowFor("finance", 2000)];
    const result = latestLifecycleForSkill(rows, "legal");
    expect(result?.commandId).toBe("cmd-legal-1000");
  });

  it("returns the newest (highest createdAt) row when multiple match the same skillName, regardless of list order", () => {
    const rows = [
      rowFor("legal", 3000, { action: "restore" }),
      rowFor("legal", 1000, { action: "archive" }),
      rowFor("legal", 5000, { action: "move" }),
      rowFor("other", 9000),
    ];
    const result = latestLifecycleForSkill(rows, "legal");
    expect(result?.createdAt).toBe(5000);
    expect(result?.action).toBe("move");
  });

  it("returns null for an empty rows array", () => {
    expect(latestLifecycleForSkill([], "legal")).toBeNull();
  });
});
