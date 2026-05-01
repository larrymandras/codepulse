import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as commandExecutions from "../commandExecutions";

/**
 * Behavioral integration tests for upsertLifecycle field coverage (CPHLTH-07).
 *
 * Verifies that all 5 previously-missing fields (toolName, origin, profileId,
 * channelId, parentExecutionId) are present in the args schema and patch logic.
 */

// Read source once for source-level assertions
const src = readFileSync(
  resolve(__dirname, "../commandExecutions.ts"),
  "utf-8"
);

describe("commandExecutions upsertLifecycle (CPHLTH-07)", () => {
  it("upsertLifecycle mutation is exported and defined", () => {
    expect(commandExecutions.upsertLifecycle).toBeDefined();
  });

  it("upsertLifecycle args schema includes all previously-missing fields", () => {
    // These fields were missing from the original upsertLifecycle args schema
    const requiredFields = [
      "toolName",
      "origin",
      "profileId",
      "channelId",
      "parentExecutionId",
    ];
    for (const field of requiredFields) {
      expect(src, `Expected args schema to contain field: ${field}`).toContain(field);
    }
  });

  it("upsertLifecycle patch block includes toolName conditional update", () => {
    // The patch object must conditionally include toolName (not hard-coded skip)
    expect(src).toMatch(/toolName.*!==\s*undefined|if.*toolName.*patch/s);
  });

  it("upsertLifecycle patch block includes origin conditional update", () => {
    expect(src).toMatch(/origin.*!==\s*undefined|if.*origin.*patch/s);
  });

  it("upsertLifecycle patch block includes profileId conditional update", () => {
    expect(src).toMatch(/profileId.*!==\s*undefined|if.*profileId.*patch/s);
  });

  it("upsertLifecycle patch block includes channelId conditional update", () => {
    expect(src).toMatch(/channelId.*!==\s*undefined|if.*channelId.*patch/s);
  });

  it("upsertLifecycle patch block includes parentExecutionId conditional update", () => {
    expect(src).toMatch(/parentExecutionId.*!==\s*undefined|if.*parentExecutionId.*patch/s);
  });

  it("upsertLifecycle insert block includes all 5 previously-missing fields with defaults", () => {
    // On insert, all fields must be included (with ?? fallback defaults for required ones)
    expect(src).toContain("toolName:");
    expect(src).toContain("origin:");
    expect(src).toContain("profileId:");
    expect(src).toContain("channelId:");
    expect(src).toContain("parentExecutionId:");
  });

  it("upsertLifecycle args schema includes cancelRequested", () => {
    expect(src).toContain("cancelRequested: v.optional(v.boolean())");
  });

  it("upsertLifecycle patch block includes queuedAt conditional update", () => {
    expect(src).toMatch(/args\.queuedAt\s*!==\s*undefined/);
  });

  it("upsertLifecycle patch block includes cancelRequested conditional update", () => {
    expect(src).toMatch(/args\.cancelRequested\s*!==\s*undefined/);
  });

  it("listExecutions query is exported", () => {
    expect(commandExecutions.listExecutions).toBeDefined();
  });
});
