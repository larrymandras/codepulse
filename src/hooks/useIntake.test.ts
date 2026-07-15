/**
 * Tests for src/hooks/useIntake.ts — IntakeCommandRow adapter + status mapper.
 *
 * Following the repo's pure-logic testing pattern (see forge.test.ts /
 * useForge.ts precedent): exercise mapIntakeStatus and adaptIntakeCommand as
 * plain functions, no React rendering, no Convex mock needed.
 */

import { describe, it, expect } from "vitest";
import { mapIntakeStatus, adaptIntakeCommand } from "./useIntake";

// ---------------------------------------------------------------------------
// mapIntakeStatus — deliberate divergence from useForge.ts's mapCommandStatus:
// intake has no second table, so "done" must pass through unchanged, never
// collapsed into "pending".
// ---------------------------------------------------------------------------

describe("mapIntakeStatus", () => {
  it("passes 'queued' through unchanged", () => {
    expect(mapIntakeStatus("queued")).toBe("queued");
  });

  it("passes 'executing' through unchanged", () => {
    expect(mapIntakeStatus("executing")).toBe("executing");
  });

  it("passes 'done' through unchanged (NOT collapsed to 'pending' — deliberate divergence from useForge.ts's mapCommandStatus)", () => {
    expect(mapIntakeStatus("done")).toBe("done");
  });

  it("passes 'failed' through unchanged", () => {
    expect(mapIntakeStatus("failed")).toBe("failed");
  });

  it("passes 'expired' through unchanged", () => {
    expect(mapIntakeStatus("expired")).toBe("expired");
  });

  it("falls back to 'queued' for an unexpected raw value, without throwing", () => {
    expect(() => mapIntakeStatus("some-unexpected-value")).not.toThrow();
    expect(mapIntakeStatus("some-unexpected-value")).toBe("queued");
  });
});

// ---------------------------------------------------------------------------
// adaptIntakeCommand
// ---------------------------------------------------------------------------

describe("adaptIntakeCommand", () => {
  it("reads intakePayload fields and sets fileName to null (server rows never carry a filename)", () => {
    const doc = {
      commandId: "cmd-1",
      hostId: "host-1",
      status: "queued",
      intakePayload: {
        destination: "global",
        workspaceId: null,
        storageId: "storage-abc",
        githubUrl: undefined,
        subpath: undefined,
      },
      report: null,
      error: null,
      createdAt: 1000,
      expiresAt: 2000,
    };

    const row = adaptIntakeCommand(doc);

    expect(row).toEqual({
      commandId: "cmd-1",
      status: "queued",
      hostId: "host-1",
      destination: "global",
      workspaceId: null,
      storageId: "storage-abc",
      githubUrl: null,
      subpath: null,
      fileName: null,
      report: null,
      error: null,
      createdAt: 1000,
      expiresAt: 2000,
    });
  });

  it("does not throw on a malformed/pre-migration row with intakePayload: null — every payload-derived field resolves to null", () => {
    const doc = {
      commandId: "cmd-2",
      hostId: "host-2",
      status: "failed",
      intakePayload: null,
      report: null,
      error: "boom",
      createdAt: 1000,
      expiresAt: 2000,
    };

    expect(() => adaptIntakeCommand(doc)).not.toThrow();
    const row = adaptIntakeCommand(doc);
    expect(row.destination).toBeNull();
    expect(row.workspaceId).toBeNull();
    expect(row.storageId).toBeNull();
    expect(row.githubUrl).toBeNull();
    expect(row.subpath).toBeNull();
    expect(row.fileName).toBeNull();
  });

  it("maps doc.report and doc.error through with ?? null coalescing", () => {
    const doc = {
      commandId: "cmd-3",
      hostId: "host-3",
      status: "done",
      intakePayload: {
        destination: "cold",
        workspaceId: null,
        githubUrl: "https://github.com/owner/repo",
        subpath: "skills/foo",
      },
      report: { verdict: "admit" },
      createdAt: 1000,
      expiresAt: 2000,
    };

    const row = adaptIntakeCommand(doc);
    expect(row.report).toEqual({ verdict: "admit" });
    expect(row.error).toBeNull();
    expect(row.status).toBe("done");
    expect(row.githubUrl).toBe("https://github.com/owner/repo");
    expect(row.subpath).toBe("skills/foo");
    expect(row.storageId).toBeNull();
  });
});
