/**
 * Tests for convex/forge.ts — idempotent upsert mutations + read queries (Phase 78).
 *
 * Following the repo's pure-logic testing pattern: extract the decision
 * logic from the DB handlers and exercise it without a live Convex runtime.
 * DB round-trip tests are marked .todo per the established convention.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// upsertJob — last-writer-wins logic (SC#2)
// ---------------------------------------------------------------------------

/**
 * Mirror of the upsertJob "should I patch?" decision without a DB.
 * Given an existing updatedAt and an incoming updatedAt, returns whether
 * the mutation would apply the patch.
 */
function shouldPatchJob(existingUpdatedAt: string, incomingUpdatedAt: string): boolean {
  return incomingUpdatedAt >= existingUpdatedAt;
}

describe("forge.upsertJob — last-writer-wins logic (SC#2)", () => {
  it("patches when incoming updatedAt is newer than existing", () => {
    expect(shouldPatchJob("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:01.000Z")).toBe(true);
  });

  it("patches when incoming updatedAt equals existing (idempotent re-emit)", () => {
    expect(shouldPatchJob("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z")).toBe(true);
  });

  it("drops stale update when incoming updatedAt is older than existing", () => {
    expect(shouldPatchJob("2024-01-01T00:00:01.000Z", "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  it("patches when existing row has no previous data (first write)", () => {
    // There is no existing row — the mutation inserts unconditionally.
    // Represented here: a "new" updatedAt is always >= non-existent existing.
    const noExisting: string | undefined = undefined;
    const incoming = "2024-06-01T12:00:00.000Z";
    const shouldInsert = noExisting === undefined || incoming >= (noExisting as string);
    expect(shouldInsert).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// upsertJob — field mapping from wire payload to DB row
// ---------------------------------------------------------------------------

interface WireJob {
  forgeJobId:    string;
  hostId:        string;
  agent:         string;
  mode:          string;
  prompt:        string | null;
  workspaceId:   string;
  status:        string;
  pid:           number | null;
  exitCode:      number | null;
  startedAt:     string | null;
  finishedAt:    string | null;
  artifactCount: number;
  model:         string | null;
  capabilities:  string;
  createdAt:     string;
  updatedAt:     string;
}

function buildJobRow(hostId: string, job: WireJob): WireJob & { hostId: string } {
  return {
    forgeJobId:    job.forgeJobId,
    hostId,
    agent:         job.agent,
    mode:          job.mode,
    prompt:        job.prompt ?? null,
    workspaceId:   job.workspaceId,
    status:        job.status,
    pid:           job.pid ?? null,
    exitCode:      job.exitCode ?? null,
    startedAt:     job.startedAt ?? null,
    finishedAt:    job.finishedAt ?? null,
    artifactCount: job.artifactCount ?? 0,
    model:         job.model ?? null,
    capabilities:  job.capabilities ?? "{}",
    createdAt:     job.createdAt,
    updatedAt:     job.updatedAt,
  };
}

const sampleJob: WireJob = {
  forgeJobId:    "01JXMQ00000000000000000001",
  hostId:        "desktop-abc",
  agent:         "claude",
  mode:          "goal",
  prompt:        "Build a landing page",
  workspaceId:   "ws-1",
  status:        "running",
  pid:           1234,
  exitCode:      null,
  startedAt:     "2024-06-01T12:00:00.000Z",
  finishedAt:    null,
  artifactCount: 0,
  model:         "claude-opus-4-8",
  capabilities:  '{"fullAuto":false}',
  createdAt:     "2024-06-01T12:00:00.000Z",
  updatedAt:     "2024-06-01T12:00:00.000Z",
};

describe("forge.upsertJob — field mapping", () => {
  it("maps all wire fields correctly to the DB row shape", () => {
    const row = buildJobRow("desktop-abc", sampleJob);
    expect(row.forgeJobId).toBe("01JXMQ00000000000000000001");
    expect(row.hostId).toBe("desktop-abc");
    expect(row.agent).toBe("claude");
    expect(row.mode).toBe("goal");
    expect(row.prompt).toBe("Build a landing page");
    expect(row.workspaceId).toBe("ws-1");
    expect(row.status).toBe("running");
    expect(row.pid).toBe(1234);
    expect(row.exitCode).toBeNull();
    expect(row.startedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(row.finishedAt).toBeNull();
    expect(row.artifactCount).toBe(0);
    expect(row.model).toBe("claude-opus-4-8");
    expect(row.capabilities).toBe('{"fullAuto":false}');
    expect(row.createdAt).toBe("2024-06-01T12:00:00.000Z");
    expect(row.updatedAt).toBe("2024-06-01T12:00:00.000Z");
  });

  it("defaults null/missing optional fields when absent from wire payload", () => {
    const sparse: WireJob = {
      ...sampleJob,
      prompt:     null,
      pid:        null,
      exitCode:   null,
      startedAt:  null,
      finishedAt: null,
      model:      null,
    };
    const row = buildJobRow("desktop-abc", sparse);
    expect(row.prompt).toBeNull();
    expect(row.pid).toBeNull();
    expect(row.exitCode).toBeNull();
    expect(row.startedAt).toBeNull();
    expect(row.finishedAt).toBeNull();
    expect(row.model).toBeNull();
  });

  it("preserves capabilities as a JSON string (never double-encodes)", () => {
    const row = buildJobRow("desktop-abc", sampleJob);
    // capabilities must remain a string, not an object
    expect(typeof row.capabilities).toBe("string");
    expect(row.capabilities).toBe('{"fullAuto":false}');
  });

  it("defaults capabilities to '{}' when absent from wire payload", () => {
    const jobWithoutCaps = { ...sampleJob, capabilities: "" } as WireJob;
    const row = buildJobRow("desktop-abc", {
      ...jobWithoutCaps,
      capabilities: (jobWithoutCaps.capabilities || "{}"),
    });
    expect(row.capabilities).toBe("{}");
  });
});

// ---------------------------------------------------------------------------
// upsertWorkspaces — per-workspace upsert logic
// ---------------------------------------------------------------------------

interface WireWorkspace {
  workspaceId: string;
  class:       string;
  name:        string;
  rootPath:    string;
  updatedAt:   string;
}

/**
 * Mirror of the upsertWorkspaces handler logic: given a list of workspaces
 * and a simulated "existing" set, compute which operations would occur.
 */
function computeWorkspaceOps(
  hostId: string,
  incoming: WireWorkspace[],
  existing: Map<string, WireWorkspace>
): { inserts: WireWorkspace[]; patches: WireWorkspace[] } {
  const inserts: WireWorkspace[] = [];
  const patches: WireWorkspace[] = [];
  for (const ws of incoming) {
    const key = `${hostId}::${ws.workspaceId}`;
    if (existing.has(key)) {
      patches.push(ws);
    } else {
      inserts.push(ws);
    }
  }
  return { inserts, patches };
}

describe("forge.upsertWorkspaces — upsert dispatch", () => {
  const ws1: WireWorkspace = {
    workspaceId: "ws-1",
    class:       "synced",
    name:        "MyProject",
    rootPath:    "C:\\Users\\mandr\\projects\\myproject",
    updatedAt:   "2024-06-01T12:00:00.000Z",
  };
  const ws2: WireWorkspace = {
    workspaceId: "ws-2",
    class:       "local-only",
    name:        "Secret",
    rootPath:    "C:\\local-only\\secret",
    updatedAt:   "2024-06-01T12:00:00.000Z",
  };

  it("inserts all workspaces when none exist", () => {
    const { inserts, patches } = computeWorkspaceOps("host-1", [ws1, ws2], new Map());
    expect(inserts).toHaveLength(2);
    expect(patches).toHaveLength(0);
  });

  it("patches existing workspace and inserts new one", () => {
    const existing = new Map([["host-1::ws-1", ws1]]);
    const { inserts, patches } = computeWorkspaceOps("host-1", [ws1, ws2], existing);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].workspaceId).toBe("ws-2");
    expect(patches).toHaveLength(1);
    expect(patches[0].workspaceId).toBe("ws-1");
  });

  it("patches all workspaces when all already exist", () => {
    const existing = new Map([
      ["host-1::ws-1", ws1],
      ["host-1::ws-2", ws2],
    ]);
    const { inserts, patches } = computeWorkspaceOps("host-1", [ws1, ws2], existing);
    expect(inserts).toHaveLength(0);
    expect(patches).toHaveLength(2);
  });

  it("handles empty workspace array gracefully", () => {
    const { inserts, patches } = computeWorkspaceOps("host-1", [], new Map());
    expect(inserts).toHaveLength(0);
    expect(patches).toHaveLength(0);
  });

  it("isolates by hostId — same workspaceId on different host is treated as new", () => {
    const existingHost1 = new Map([["host-1::ws-1", ws1]]);
    // Upsert ws-1 for host-2 — should insert, not patch
    const { inserts, patches } = computeWorkspaceOps("host-2", [ws1], existingHost1);
    expect(inserts).toHaveLength(1);
    expect(patches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listJobs / listWorkspaces — filter logic (SC#5)
// ---------------------------------------------------------------------------

interface StoredJob extends WireJob {
  _id: string;
}

function filterJobsByHost(jobs: StoredJob[], hostId: string | undefined): StoredJob[] {
  if (!hostId) return jobs;
  return jobs.filter((j) => j.hostId === hostId);
}

function filterWorkspacesByHost(
  workspaces: Array<WireWorkspace & { hostId: string; _id: string }>,
  hostId: string | undefined
): Array<WireWorkspace & { hostId: string; _id: string }> {
  if (!hostId) return workspaces;
  return workspaces.filter((w) => w.hostId === hostId);
}

describe("forge.listJobs — host filter logic (SC#5)", () => {
  const jobs: StoredJob[] = [
    { ...sampleJob, _id: "j1", hostId: "desktop-abc" },
    { ...sampleJob, _id: "j2", hostId: "laptop-xyz", forgeJobId: "02JXMQ" },
    { ...sampleJob, _id: "j3", hostId: "desktop-abc", forgeJobId: "03JXMQ" },
  ];

  it("returns all jobs when no hostId filter", () => {
    expect(filterJobsByHost(jobs, undefined)).toHaveLength(3);
  });

  it("filters to matching hostId only", () => {
    const result = filterJobsByHost(jobs, "desktop-abc");
    expect(result).toHaveLength(2);
    expect(result.every((j) => j.hostId === "desktop-abc")).toBe(true);
  });

  it("returns empty when no jobs match the hostId", () => {
    expect(filterJobsByHost(jobs, "nonexistent-host")).toHaveLength(0);
  });

  it("returns a single job for laptop-xyz", () => {
    const result = filterJobsByHost(jobs, "laptop-xyz");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("j2");
  });
});

describe("forge.getJob — lookup by (hostId, forgeJobId)", () => {
  const jobs: StoredJob[] = [
    { ...sampleJob, _id: "j1", hostId: "desktop-abc", forgeJobId: "01JXMQ" },
    { ...sampleJob, _id: "j2", hostId: "laptop-xyz",  forgeJobId: "01JXMQ" },
  ];

  function findJob(hostId: string, forgeJobId: string): StoredJob | undefined {
    return jobs.find((j) => j.hostId === hostId && j.forgeJobId === forgeJobId);
  }

  it("finds the correct job by (hostId, forgeJobId) tuple", () => {
    const result = findJob("desktop-abc", "01JXMQ");
    expect(result?._id).toBe("j1");
  });

  it("does not cross-match across hosts with the same forgeJobId", () => {
    const result = findJob("laptop-xyz", "01JXMQ");
    expect(result?._id).toBe("j2");
  });

  it("returns undefined when no match", () => {
    expect(findJob("desktop-abc", "NONEXISTENT")).toBeUndefined();
  });
});

describe("forge.listWorkspaces — host filter logic", () => {
  const workspaces = [
    {
      _id: "w1",
      hostId: "desktop-abc",
      workspaceId: "ws-1",
      class: "synced",
      name: "ProjectA",
      rootPath: "C:\\projects\\a",
      updatedAt: "2024-06-01T12:00:00.000Z",
    },
    {
      _id: "w2",
      hostId: "laptop-xyz",
      workspaceId: "ws-1",
      class: "synced",
      name: "ProjectA",
      rootPath: "C:\\projects\\a",
      updatedAt: "2024-06-01T12:00:00.000Z",
    },
  ];

  it("returns all workspaces when no hostId filter", () => {
    expect(filterWorkspacesByHost(workspaces, undefined)).toHaveLength(2);
  });

  it("filters to matching host only", () => {
    const result = filterWorkspacesByHost(workspaces, "desktop-abc");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("w1");
  });
});

// ---------------------------------------------------------------------------
// DB round-trip stubs (to be implemented when Convex test harness is available)
// ---------------------------------------------------------------------------

describe("forge mutations — DB round-trip (integration)", () => {
  it.todo("upsertJob: insert then re-upsert same (hostId, forgeJobId) → ONE row, updatedAt advanced");
  it.todo("upsertJob: stale updatedAt is ignored (SC#2 last-writer-wins)");
  it.todo("upsertWorkspaces: inserts new rows then idempotently patches on resync");
  it.todo("listJobs: returns upserted data newest-first (SC#5)");
  it.todo("getJob: returns the correct single job row");
  it.todo("listWorkspaces: returns all upserted workspaces for host");
});

// ---------------------------------------------------------------------------
// Phase 80: Command Bridge — pure-logic helpers (FI-06, FI-08)
// ---------------------------------------------------------------------------
// Import the exported pure helpers from convex/forge.ts.
// These are extracted decision functions exercised without a live Convex runtime.
import {
  stripDangerousCapability,
  shouldExpireCommand,
  isTerminalCommandStatus,
  buildLaunchRow,
  buildIntakeRow,
  isAcceptedGithubUrlShape,
  isSafeSubpath,
  isSafeSkillName,
  buildLifecycleRow,
  validateLifecyclePreflight,
  resolveClaimTypes,
  isValidSupportedTypesShape,
  capAckReport,
  MAX_ACK_REPORT_BYTES,
  synthesizeWriteRefusalReport,
  FORGE_COMMAND_TTL_MS,
} from "./forge";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// stripDangerousCapability — Pitfall 7 / D-06 mitigation
// ---------------------------------------------------------------------------

describe("forge.stripDangerousCapability — removes dangerous key (D-06, Pitfall 7)", () => {
  it("removes the dangerous key from a capabilities JSON string", () => {
    const input = JSON.stringify({ maxTurns: 50, dangerous: true });
    const result = stripDangerousCapability(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed).not.toHaveProperty("dangerous");
    expect(parsed.maxTurns).toBe(50);
  });

  it("keeps non-dangerous keys intact", () => {
    const input = JSON.stringify({ maxTurns: 50, fullAuto: false });
    const result = stripDangerousCapability(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.maxTurns).toBe(50);
    expect(parsed.fullAuto).toBe(false);
  });

  it("returns null when input is null", () => {
    expect(stripDangerousCapability(null)).toBeNull();
  });

  it("returns null when input is empty string", () => {
    expect(stripDangerousCapability("")).toBeNull();
  });

  it("returns null when the only key is dangerous (resulting object is empty)", () => {
    const input = JSON.stringify({ dangerous: true });
    const result = stripDangerousCapability(input);
    // An empty {} has no keys — null is the correct return per the spec
    expect(result).toBeNull();
  });

  it("returns null when input is unparseable JSON", () => {
    expect(stripDangerousCapability("not-json")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// shouldExpireCommand — TTL expiry decision (D-12)
// ---------------------------------------------------------------------------

describe("forge.shouldExpireCommand — TTL expiry logic (D-12)", () => {
  const PAST = 1000;
  const FUTURE = Date.now() + 60_000;
  const NOW = 5000;

  it("returns true for queued command whose expiresAt is in the past", () => {
    expect(shouldExpireCommand("queued", PAST, NOW)).toBe(true);
  });

  it("returns false for queued command whose expiresAt is in the future", () => {
    expect(shouldExpireCommand("queued", FUTURE, NOW)).toBe(false);
  });

  it("returns false for executing command even if past TTL", () => {
    expect(shouldExpireCommand("executing", PAST, NOW)).toBe(false);
  });

  it("returns false for done command even if past TTL", () => {
    expect(shouldExpireCommand("done", PAST, NOW)).toBe(false);
  });

  it("returns false for failed command even if past TTL", () => {
    expect(shouldExpireCommand("failed", PAST, NOW)).toBe(false);
  });

  it("returns false for already-expired command (idempotent)", () => {
    expect(shouldExpireCommand("expired", PAST, NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveClaimTypes — supportedTypes default (D-P6-11)
// ---------------------------------------------------------------------------

describe("forge.resolveClaimTypes — supportedTypes default (D-P6-11)", () => {
  it("defaults to ['launch', 'stop'] when supportedTypes is undefined (today's daemon)", () => {
    expect(resolveClaimTypes(undefined)).toEqual(["launch", "stop"]);
  });

  it("returns an explicit empty array unchanged (absent is not the same as empty)", () => {
    expect(resolveClaimTypes([])).toEqual([]);
  });

  it("returns ['intake'] when supportedTypes explicitly declares only intake", () => {
    expect(resolveClaimTypes(["intake"])).toEqual(["intake"]);
  });

  it("returns a composed list when supportedTypes declares launch + intake", () => {
    expect(resolveClaimTypes(["launch", "intake"])).toEqual(["launch", "intake"]);
  });
});

// ---------------------------------------------------------------------------
// isValidSupportedTypesShape — malformed-shape 400 guard (D-P10-12)
// ---------------------------------------------------------------------------

describe("forge.isValidSupportedTypesShape — malformed-shape 400 guard (D-P10-12)", () => {
  it("returns true for undefined (field omitted)", () => {
    expect(isValidSupportedTypesShape(undefined)).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isValidSupportedTypesShape([])).toBe(true);
  });

  it("returns true for an array of strings", () => {
    expect(isValidSupportedTypesShape(["intake"])).toBe(true);
  });

  it("returns false for a bare string (not an array)", () => {
    expect(isValidSupportedTypesShape("intake")).toBe(false);
  });

  it("returns false for an array containing a non-string member", () => {
    expect(isValidSupportedTypesShape([1, 2])).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidSupportedTypesShape(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// claimAndUpsertHost — empty supportedTypes claims nothing (D-P6-11 +
// Plan 06-04 review fix)
// ---------------------------------------------------------------------------

describe("forge.claimAndUpsertHost — empty supportedTypes short-circuit (D-P6-11)", () => {
  /**
   * Mirror of the empty-types early return in claimAndUpsertHost. In
   * production, `types.length === 0` returns [] after the forgeHosts liveness
   * upsert but BEFORE the queued-commands query — a zero-length spread into
   * q.or(...) would error at runtime. Here we test the extracted decision
   * function without a live Convex runtime.
   */
  function shouldSkipClaimQuery(types: string[]): boolean {
    return types.length === 0;
  }

  it("skips the claim query for an explicit empty supportedTypes ([] -> claim nothing)", () => {
    expect(shouldSkipClaimQuery(resolveClaimTypes([]))).toBe(true);
  });

  it("does not skip for an omitted supportedTypes (defaults to launch/stop)", () => {
    expect(shouldSkipClaimQuery(resolveClaimTypes(undefined))).toBe(false);
  });

  it("does not skip for a declared non-empty capability set", () => {
    expect(shouldSkipClaimQuery(resolveClaimTypes(["intake"]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTerminalCommandStatus — ack idempotency guard (CR-01)
// ---------------------------------------------------------------------------

describe("forge.isTerminalCommandStatus — ack never overwrites terminal state (CR-01)", () => {
  it("treats done / failed / expired as terminal", () => {
    expect(isTerminalCommandStatus("done")).toBe(true);
    expect(isTerminalCommandStatus("failed")).toBe(true);
    expect(isTerminalCommandStatus("expired")).toBe(true);
  });

  it("treats queued / executing as non-terminal (ackable)", () => {
    expect(isTerminalCommandStatus("queued")).toBe(false);
    expect(isTerminalCommandStatus("executing")).toBe(false);
  });

  it("treats an unknown status as non-terminal", () => {
    expect(isTerminalCommandStatus("")).toBe(false);
    expect(isTerminalCommandStatus("bogus")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildLaunchRow — field mapping for forgeCommands insert
// ---------------------------------------------------------------------------

interface LaunchArgs {
  hostId: string;
  commandId: string;
  agent: string;
  workspaceId: string;
  mode: string;
  prompt: string | null;
  model: string | null;
  capabilities: string | null;
}

describe("forge.buildLaunchRow — field mapping (FI-06)", () => {
  const now = 1_700_000_000_000;
  const TTL_MS = 5 * 60 * 1000;
  const args: LaunchArgs = {
    hostId:      "desktop-abc",
    commandId:   "01JXMQ00000000000000000001",
    agent:       "claude",
    workspaceId: "ws-1",
    mode:        "goal",
    prompt:      "Build a landing page",
    model:       "claude-opus-4-8",
    capabilities: JSON.stringify({ maxTurns: 50 }),
  };
  const subject = "user_abc123";

  it("sets commandType to launch", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.commandType).toBe("launch");
  });

  it("sets status to queued", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.status).toBe("queued");
  });

  it("sets issuedBy to the Clerk identity subject", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.issuedBy).toBe(subject);
  });

  it("sets expiresAt to createdAt + TTL_MS", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.expiresAt).toBe(now + TTL_MS);
    expect(row.createdAt).toBe(now);
  });

  it("sets all nullable timing fields to null", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.claimedAt).toBeNull();
    expect(row.executedAt).toBeNull();
    expect(row.completedAt).toBeNull();
    expect(row.resolvedForgeJobId).toBeNull();
    expect(row.error).toBeNull();
  });

  it("sets stopPayload to null for launch commands", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.stopPayload).toBeNull();
  });

  it("maps launchPayload fields from args", () => {
    const row = buildLaunchRow(args, subject, now, TTL_MS);
    expect(row.launchPayload).not.toBeNull();
    expect(row.launchPayload!.agent).toBe("claude");
    expect(row.launchPayload!.workspaceId).toBe("ws-1");
    expect(row.launchPayload!.mode).toBe("goal");
    expect(row.launchPayload!.prompt).toBe("Build a landing page");
    expect(row.launchPayload!.model).toBe("claude-opus-4-8");
  });
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): buildIntakeRow — field mapping (D-P6-01..09)
// ---------------------------------------------------------------------------

describe("forge.buildIntakeRow — field mapping", () => {
  const now = 1_700_000_000_000;
  const TTL_MS = 5 * 60 * 1000;
  const subject = "user_abc123";

  const uploadArgs = {
    hostId:      "desktop-abc",
    commandId:   "01JXMQ00000000000000000002",
    destination: "project" as const,
    workspaceId: "ws-desktop-1",
    storageId:   "storage-id-1" as Id<"_storage">,
    githubUrl:   undefined,
    subpath:     undefined,
  };

  const urlArgs = {
    hostId:      "desktop-abc",
    commandId:   "01JXMQ00000000000000000003",
    destination: "global" as const,
    workspaceId: null,
    storageId:   undefined,
    githubUrl:   "https://github.com/owner/repo",
    subpath:     "skills/foo",
  };

  it("sets commandType to intake", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.commandType).toBe("intake");
  });

  it("sets launchPayload and stopPayload to null", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.launchPayload).toBeNull();
    expect(row.stopPayload).toBeNull();
  });

  it("sets status to queued", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.status).toBe("queued");
  });

  it("sets issuedBy to the Clerk identity subject", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.issuedBy).toBe(subject);
  });

  it("sets expiresAt to createdAt + TTL_MS", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.expiresAt).toBe(now + TTL_MS);
    expect(row.createdAt).toBe(now);
  });

  it("sets all nullable timing/ack fields to null", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.claimedAt).toBeNull();
    expect(row.executedAt).toBeNull();
    expect(row.completedAt).toBeNull();
    expect(row.resolvedForgeJobId).toBeNull();
    expect(row.error).toBeNull();
  });

  it("maps intakePayload fields from args (upload variant)", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(row.intakePayload.destination).toBe("project");
    expect(row.intakePayload.workspaceId).toBe("ws-desktop-1");
    expect(row.intakePayload.storageId).toBe("storage-id-1");
    expect(row.intakePayload.githubUrl).toBeUndefined();
    expect(row.intakePayload.subpath).toBeUndefined();
  });

  it("maps intakePayload fields from args (githubUrl variant)", () => {
    const row = buildIntakeRow(urlArgs, subject, now, TTL_MS);
    expect(row.intakePayload.destination).toBe("global");
    expect(row.intakePayload.workspaceId).toBeNull();
    expect(row.intakePayload.storageId).toBeUndefined();
    expect(row.intakePayload.githubUrl).toBe("https://github.com/owner/repo");
    expect(row.intakePayload.subpath).toBe("skills/foo");
  });

  // SC1 / CP-01 — "no open-bag": intakePayload must carry EXACTLY the five
  // declared fields and nothing else. The field-mapping tests above assert each
  // field is *present*; this asserts no *extra* free-text/open-bag key can leak
  // through buildIntakeRow into the enqueued row (e.g. via a future `...args`
  // spread or an added open field). Guards the schema's narrowness at runtime,
  // complementing the compile-time `v.union`/no-`v.any()` guarantee.
  it("emits an intakePayload with exactly the 5 declared keys (no open-bag, SC1)", () => {
    const uploadKeys = Object.keys(
      buildIntakeRow(uploadArgs, subject, now, TTL_MS).intakePayload
    ).sort();
    const urlKeys = Object.keys(
      buildIntakeRow(urlArgs, subject, now, TTL_MS).intakePayload
    ).sort();
    const expected = [
      "destination",
      "githubUrl",
      "storageId",
      "subpath",
      "workspaceId",
    ];
    expect(uploadKeys).toEqual(expected);
    expect(urlKeys).toEqual(expected);
  });

  it("emits a top-level intake row with no fields outside the declared command shape (no open-bag, SC1)", () => {
    const row = buildIntakeRow(uploadArgs, subject, now, TTL_MS);
    expect(Object.keys(row).sort()).toEqual(
      [
        "claimedAt",
        "commandId",
        "commandType",
        "completedAt",
        "createdAt",
        "error",
        "executedAt",
        "expiresAt",
        "hostId",
        "intakePayload",
        "issuedBy",
        "launchPayload",
        "resolvedForgeJobId",
        "status",
        "stopPayload",
      ].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): isAcceptedGithubUrlShape — accept/reject (D-P6-06)
// ---------------------------------------------------------------------------

describe("forge.isAcceptedGithubUrlShape — accept/reject", () => {
  it("accepts a plain github.com URL", () => {
    expect(isAcceptedGithubUrlShape("https://github.com/owner/repo")).toBe(true);
  });

  it("accepts a github.com URL with a /tree/ subpath", () => {
    expect(
      isAcceptedGithubUrlShape("https://github.com/owner/repo/tree/main/skills/foo")
    ).toBe(true);
  });

  it("accepts owner/repo shorthand", () => {
    expect(isAcceptedGithubUrlShape("owner/repo")).toBe(true);
  });

  it("rejects a non-github.com URL", () => {
    expect(isAcceptedGithubUrlShape("https://gitlab.com/owner/repo")).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(isAcceptedGithubUrlShape("not a url at all")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isAcceptedGithubUrlShape("")).toBe(false);
  });

  // WR-01 (phase-06 review): the Python parser's full-URL branch is gated on
  // a CASE-SENSITIVE scheme prefix (raw.startswith("http://")/("https://"))
  // before its IGNORECASE FULL_URL regex — mirror both halves of that.
  it("rejects an uppercase-scheme URL, matching Python's case-sensitive scheme gate (WR-01)", () => {
    expect(isAcceptedGithubUrlShape("HTTPS://github.com/owner/repo")).toBe(false);
  });

  it("rejects a mixed-case-scheme URL (WR-01)", () => {
    expect(isAcceptedGithubUrlShape("hTtp://github.com/owner/repo")).toBe(false);
  });

  it("accepts a lowercase-scheme URL with uppercase host, matching Python's IGNORECASE FULL_URL (WR-01)", () => {
    expect(isAcceptedGithubUrlShape("https://GITHUB.COM/owner/repo")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): isSafeSubpath — traversal guard (D-P6-07)
// ---------------------------------------------------------------------------

describe("forge.isSafeSubpath — traversal guard", () => {
  it("accepts undefined", () => {
    expect(isSafeSubpath(undefined)).toBe(true);
  });

  it("accepts a plain relative subpath", () => {
    expect(isSafeSubpath("skills/foo")).toBe(true);
  });

  it("rejects a leading ../ traversal", () => {
    expect(isSafeSubpath("../etc/passwd")).toBe(false);
  });

  it("rejects a leading-slash absolute path", () => {
    expect(isSafeSubpath("/etc/passwd")).toBe(false);
  });

  it("rejects a nested .. segment", () => {
    expect(isSafeSubpath("skills/../../etc")).toBe(false);
  });

  it("rejects a Windows drive-letter absolute path with backslashes (CR-01)", () => {
    expect(isSafeSubpath("C:\\evil")).toBe(false);
  });

  it("rejects a Windows drive-letter absolute path with forward slashes (CR-01)", () => {
    expect(isSafeSubpath("C:/Users/mandr")).toBe(false);
  });

  it("rejects a Windows drive-relative path (CR-01)", () => {
    expect(isSafeSubpath("c:relative")).toBe(false);
  });

  it("rejects an empty string (distinct from absent, CR-01)", () => {
    expect(isSafeSubpath("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 98 (skill lifecycle mutations): isSafeSkillName — bare directory-name
// guard (T-98-01). Stricter than isSafeSubpath: skillName drives a real
// fs.rmSync/rename in the daemon, so a skill name must be exactly one path
// segment (no separators at all, not just no traversal).
// ---------------------------------------------------------------------------

describe("forge.isSafeSkillName — bare directory-name guard (T-98-01)", () => {
  it("accepts a plain skill name", () => {
    expect(isSafeSkillName("legal")).toBe(true);
  });

  it("rejects a traversal segment", () => {
    expect(isSafeSkillName("../etc")).toBe(false);
  });

  it("rejects a forward-slash separator", () => {
    expect(isSafeSkillName("a/b")).toBe(false);
  });

  it("rejects a backslash separator", () => {
    expect(isSafeSkillName("a\\b")).toBe(false);
  });

  it("rejects a Windows drive-letter prefix", () => {
    expect(isSafeSkillName("C:foo")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeSkillName("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 98 Task 2: validateLifecyclePreflight — LAYER-1 pre-flight refusal
// rules (D-02/D-03/D-05/T-98-06), exercised directly against an
// originsForName array — the extracted decision function this file's
// convention calls for (mirrors xorGuard/storageMetaGuard/
// projectWorkspaceGuard: real logic, no live Convex runtime needed).
// ---------------------------------------------------------------------------

describe("forge.validateLifecyclePreflight — LAYER-1 refusal rules (D-02/D-03/D-05)", () => {
  const baseArgs = {
    action: "archive" as const,
    destination: "cold" as const,
    workspaceId: null as string | null,
    sourceOrigin: "claude-code",
  };

  it("throws when destination='project' and workspaceId is null", () => {
    expect(() =>
      validateLifecyclePreflight(
        { ...baseArgs, action: "move", destination: "project", workspaceId: null },
        ["claude-code"]
      )
    ).toThrow("workspaceId is required when destination is 'project'");
  });

  it("does not throw when destination='project' and workspaceId is present", () => {
    expect(() =>
      validateLifecyclePreflight(
        { ...baseArgs, action: "move", destination: "project", workspaceId: "ws-1" },
        ["claude-code"]
      )
    ).not.toThrow();
  });

  it("throws when sourceOrigin does not match any existing origin row (V5)", () => {
    expect(() =>
      validateLifecyclePreflight(
        { ...baseArgs, sourceOrigin: "claude-code:project:deadbeef" },
        ["claude-code", "claude-code:available"]
      )
    ).toThrow(/sourceOrigin .* does not match/);
  });

  it("action='restore' destination='global' throws lifecycle-refused:shadow: when claude-code is already active (LIFE-05/D-03)", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "restore", destination: "global", workspaceId: null, sourceOrigin: "claude-code:available" },
        ["claude-code", "claude-code:available"]
      )
    ).toThrow(/^lifecycle-refused:shadow:/);
  });

  it("action='restore' destination='global' does not throw when no active claude-code row exists", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "restore", destination: "global", workspaceId: null, sourceOrigin: "claude-code:available" },
        ["claude-code:available"]
      )
    ).not.toThrow();
  });

  it("action='archive' throws lifecycle-refused:collision: when a dormant copy already exists (D-02)", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "archive", destination: "cold", workspaceId: null, sourceOrigin: "claude-code" },
        ["claude-code", "claude-code:available"]
      )
    ).toThrow(/^lifecycle-refused:collision:/);
  });

  it("action='archive' does not throw when no dormant copy exists", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "archive", destination: "cold", workspaceId: null, sourceOrigin: "claude-code" },
        ["claude-code"]
      )
    ).not.toThrow();
  });

  it("action='move' destination='global' throws lifecycle-refused:collision: when claude-code is already active (D-02)", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "move", destination: "global", workspaceId: null, sourceOrigin: "claude-code:project:abc1234" },
        ["claude-code", "claude-code:project:abc1234"]
      )
    ).toThrow(/^lifecycle-refused:collision:/);
  });

  it("action='delete' throws lifecycle-refused: when any non-dormant origin row exists (D-05 cold-only)", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "delete", destination: "cold", workspaceId: null, sourceOrigin: "claude-code:available" },
        ["claude-code", "claude-code:available"]
      )
    ).toThrow(/^lifecycle-refused:/);
  });

  it("action='delete' does not throw when the skill exists ONLY at the dormant origin", () => {
    expect(() =>
      validateLifecyclePreflight(
        { action: "delete", destination: "cold", workspaceId: null, sourceOrigin: "claude-code:available" },
        ["claude-code:available"]
      )
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 98 Task 2: buildLifecycleRow — field mapping (mirrors buildIntakeRow's
// own field-mapping test precedent).
// ---------------------------------------------------------------------------

describe("forge.buildLifecycleRow — field mapping", () => {
  it("maps all lifecyclePayload fields and sets commandType='lifecycle', launch/stop/intakePayload=null", () => {
    const row = buildLifecycleRow(
      {
        hostId: "desktop-abc",
        commandId: "cmd-lifecycle-1",
        action: "archive",
        skillName: "legal",
        sourceOrigin: "claude-code",
        destination: "cold",
        workspaceId: null,
      },
      "user_abc123",
      1_000,
      FORGE_COMMAND_TTL_MS
    );

    expect(row.commandType).toBe("lifecycle");
    expect(row.launchPayload).toBeNull();
    expect(row.stopPayload).toBeNull();
    expect(row.intakePayload).toBeNull();
    expect(row.lifecyclePayload).toEqual({
      action: "archive",
      skillName: "legal",
      sourceOrigin: "claude-code",
      destination: "cold",
      workspaceId: null,
    });
    expect(row.status).toBe("queued");
    expect(row.issuedBy).toBe("user_abc123");
    expect(row.createdAt).toBe(1_000);
    expect(row.expiresAt).toBe(1_000 + FORGE_COMMAND_TTL_MS);
    expect(row.claimedAt).toBeNull();
    expect(row.executedAt).toBeNull();
    expect(row.completedAt).toBeNull();
    expect(row.resolvedForgeJobId).toBeNull();
    expect(row.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 98 Task 2: enqueueLifecycle — mutation handler order (DB round-trip
// mirror). enqueueLifecycleMirror (defined near this file's other DB
// round-trip mirrors, below) performs the SAME ctx.db calls the real handler
// does; the skills-registry query is stood in for by a directly-passed
// originsForName array — the same "extract the decision, skip the live
// runtime" convention as storageMetaGuard/projectWorkspaceGuard above.
// ---------------------------------------------------------------------------

describe("forge.enqueueLifecycle — mutation handler order (auth -> idempotency -> validation -> insert)", () => {
  it("throws when unauthenticated (D-13 fail-closed)", async () => {
    const store = makeForgeCommandsStore();
    await expect(
      enqueueLifecycleMirror(
        store,
        {
          hostId: "desktop-abc",
          commandId: "cmd-1",
          action: "archive",
          skillName: "legal",
          sourceOrigin: "claude-code",
          destination: "cold",
          workspaceId: null,
          originsForName: ["claude-code"],
        },
        null,
        1_000
      )
    ).rejects.toThrow("Authentication required to issue Forge commands");
    expect(store.forgeCommands).toHaveLength(0);
  });

  it("a duplicate commandId is a silent no-op — no second row inserted (WR-04 parity)", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-dup",
      commandType: "lifecycle",
      status: "queued",
    });

    const result = await enqueueLifecycleMirror(
      store,
      {
        hostId: "desktop-abc",
        commandId: "cmd-dup",
        action: "archive",
        skillName: "legal",
        sourceOrigin: "claude-code",
        destination: "cold",
        workspaceId: null,
        originsForName: ["claude-code"],
      },
      { subject: "user_abc123" },
      2_000
    );

    expect(result).toBeNull();
    expect(store.forgeCommands).toHaveLength(1); // still just the pre-existing row
  });

  it("throws before any insert when skillName fails isSafeSkillName", async () => {
    const store = makeForgeCommandsStore();
    await expect(
      enqueueLifecycleMirror(
        store,
        {
          hostId: "desktop-abc",
          commandId: "cmd-bad-name",
          action: "archive",
          skillName: "../etc",
          sourceOrigin: "claude-code",
          destination: "cold",
          workspaceId: null,
          originsForName: ["claude-code"],
        },
        { subject: "user_abc123" },
        3_000
      )
    ).rejects.toThrow("Invalid skill name: ../etc");
    expect(store.forgeCommands).toHaveLength(0);
  });

  it("throws before any insert when LAYER-1 pre-flight refuses (archive cold-collision)", async () => {
    const store = makeForgeCommandsStore();
    await expect(
      enqueueLifecycleMirror(
        store,
        {
          hostId: "desktop-abc",
          commandId: "cmd-collision",
          action: "archive",
          skillName: "legal",
          sourceOrigin: "claude-code",
          destination: "cold",
          workspaceId: null,
          originsForName: ["claude-code", "claude-code:available"],
        },
        { subject: "user_abc123" },
        4_000
      )
    ).rejects.toThrow(/^lifecycle-refused:collision:/);
    expect(store.forgeCommands).toHaveLength(0);
  });

  it("a valid archive inserts exactly one forgeCommands row with commandType='lifecycle' and the populated lifecyclePayload", async () => {
    const store = makeForgeCommandsStore();
    const id = await enqueueLifecycleMirror(
      store,
      {
        hostId: "desktop-abc",
        commandId: "cmd-valid-archive",
        action: "archive",
        skillName: "legal",
        sourceOrigin: "claude-code",
        destination: "cold",
        workspaceId: null,
        originsForName: ["claude-code"],
      },
      { subject: "user_abc123" },
      5_000
    );

    expect(id).not.toBeNull();
    expect(store.forgeCommands).toHaveLength(1);
    const row = store.forgeCommands[0];
    expect(row.commandType).toBe("lifecycle");
    expect(row.status).toBe("queued");
    expect(row.lifecyclePayload).toEqual({
      action: "archive",
      skillName: "legal",
      sourceOrigin: "claude-code",
      destination: "cold",
      workspaceId: null,
    });
  });

  it("a valid restore/move/delete each insert exactly one lifecycle row", async () => {
    const store = makeForgeCommandsStore();

    await enqueueLifecycleMirror(
      store,
      {
        hostId: "desktop-abc",
        commandId: "cmd-restore",
        action: "restore",
        skillName: "legal",
        sourceOrigin: "claude-code:available",
        destination: "global",
        workspaceId: null,
        originsForName: ["claude-code:available"],
      },
      { subject: "user_abc123" },
      6_000
    );
    await enqueueLifecycleMirror(
      store,
      {
        hostId: "desktop-abc",
        commandId: "cmd-move",
        action: "move",
        skillName: "docs",
        sourceOrigin: "claude-code",
        destination: "project",
        workspaceId: "ws-1",
        originsForName: ["claude-code"],
      },
      { subject: "user_abc123" },
      7_000
    );
    await enqueueLifecycleMirror(
      store,
      {
        hostId: "desktop-abc",
        commandId: "cmd-delete",
        action: "delete",
        skillName: "old-skill",
        sourceOrigin: "claude-code:available",
        destination: "cold",
        workspaceId: null,
        originsForName: ["claude-code:available"],
      },
      { subject: "user_abc123" },
      8_000
    );

    expect(store.forgeCommands).toHaveLength(3);
    expect(store.forgeCommands.map((r) => r.lifecyclePayload.action).sort()).toEqual([
      "delete",
      "move",
      "restore",
    ]);
  });
});

describe("forge.synthesizeLifecycleRefusalReport — RED scaffold (Task 3 not yet implemented)", () => {
  it.todo("synthesizeLifecycleRefusalReport: lifecycle-refused:collision: for an archive returns the UI-SPEC cold-collision house copy naming the skill");
  it.todo("synthesizeLifecycleRefusalReport: lifecycle-refused:shadow: returns the UI-SPEC shadow-block house copy naming the skill + scope");
  it.todo("synthesizeLifecycleRefusalReport: a non-framed error string passes through unchanged");
  it.todo("listLifecycleCommands: returns only commandType 'lifecycle' rows, newest-first, bounded");
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): enqueueIntake — XOR enforcement (D-P6-05)
// ---------------------------------------------------------------------------

describe("forge.enqueueIntake — XOR enforcement (D-P6-05)", () => {
  /**
   * Mirror of the storageId/githubUrl XOR guard used in enqueueIntake.
   * Here we test the extracted decision function without a live Convex runtime.
   */
  function xorGuard(hasFile: boolean, hasUrl: boolean): void {
    if (hasFile === hasUrl) {
      throw new Error("Provide exactly one of storageId or githubUrl");
    }
  }

  it("throws when both storageId and githubUrl are present", () => {
    expect(() => xorGuard(true, true)).toThrow(
      "Provide exactly one of storageId or githubUrl"
    );
  });

  it("throws when neither storageId nor githubUrl is present", () => {
    expect(() => xorGuard(false, false)).toThrow(
      "Provide exactly one of storageId or githubUrl"
    );
  });

  it("does not throw when only storageId is present", () => {
    expect(() => xorGuard(true, false)).not.toThrow();
  });

  it("does not throw when only githubUrl is present", () => {
    expect(() => xorGuard(false, true)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): enqueueIntake — storageId existence + size guard
// (D-P6-09 + Plan 06-04 review fix)
// ---------------------------------------------------------------------------

describe("forge.enqueueIntake — storageId existence + size guard (D-P6-09)", () => {
  /**
   * Mirror of the storage-metadata guard used in enqueueIntake. In production
   * `meta` is `await ctx.db.system.get("_storage", storageId)`, which returns
   * null for a bogus/dangling storageId. Here we test the extracted decision
   * function without a live Convex runtime.
   */
  const MAX = 1_000_000; // MAX_INTAKE_UPLOAD_BYTES
  function storageMetaGuard(meta: { size: number } | null): void {
    if (!meta) {
      throw new Error("Uploaded file not found: storageId does not reference an existing file");
    }
    if (meta.size > MAX) {
      throw new Error(`Uploaded file exceeds ${MAX} bytes`);
    }
  }

  it("throws when the storageId resolves to no file (null metadata)", () => {
    expect(() => storageMetaGuard(null)).toThrow(
      "Uploaded file not found: storageId does not reference an existing file"
    );
  });

  it("throws when the file exceeds the 1 MB cap", () => {
    expect(() => storageMetaGuard({ size: MAX + 1 })).toThrow(
      `Uploaded file exceeds ${MAX} bytes`
    );
  });

  it("does not throw for an existing file within the cap", () => {
    expect(() => storageMetaGuard({ size: MAX })).not.toThrow();
    expect(() => storageMetaGuard({ size: 1 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 06 (skill-intake): enqueueIntake — workspaceId required for
// destination='project' (D-P6-04)
// ---------------------------------------------------------------------------

describe("forge.enqueueIntake — workspaceId required for project destination (D-P6-04)", () => {
  /**
   * Mirror of the project-destination workspaceId guard used in enqueueIntake.
   * Here we test the extracted decision function without a live Convex runtime.
   */
  function projectWorkspaceGuard(
    destination: "global" | "project" | "cold",
    workspaceId: string | null
  ): void {
    if (destination === "project" && !workspaceId) {
      throw new Error("workspaceId is required when destination is 'project'");
    }
  }

  it("throws for destination='project' with a null workspaceId", () => {
    expect(() => projectWorkspaceGuard("project", null)).toThrow(
      "workspaceId is required when destination is 'project'"
    );
  });

  it("does not throw for destination='project' with a workspaceId", () => {
    expect(() => projectWorkspaceGuard("project", "ws-desktop-1")).not.toThrow();
  });

  it("does not throw for destination='global' with a null workspaceId", () => {
    expect(() => projectWorkspaceGuard("global", null)).not.toThrow();
  });

  it("does not throw for destination='cold' with a null workspaceId", () => {
    expect(() => projectWorkspaceGuard("cold", null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Auth fail-closed guard — FI-08 / D-13 (applies to enqueueLaunch, enqueueStop,
// enqueueIntake, and generateForgeUploadUrl — all four Clerk-gated mutations
// share the identical guard shape and throw message, D-P6 phase 06 addition)
// ---------------------------------------------------------------------------

describe("forge.enqueueLaunch / enqueueStop / enqueueIntake / generateForgeUploadUrl — auth fail-closed guard (FI-08, D-13)", () => {
  /**
   * Mirror of the fail-closed identity guard used in enqueueLaunch / enqueueStop /
   * enqueueIntake / generateForgeUploadUrl. In production this is
   * `ctx.auth.getUserIdentity()` returning null. Here we test the extracted
   * decision function without a live Convex runtime.
   */
  function authGuard(identity: { subject: string } | null): void {
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }
  }

  it("throws when identity is null (unauthenticated caller, FI-08)", () => {
    expect(() => authGuard(null)).toThrow(
      "Authentication required to issue Forge commands"
    );
  });

  it("does not throw when identity is present (authenticated caller)", () => {
    expect(() => authGuard({ subject: "user_abc123" })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 06 review WR-02: forgeCommandsAck — only done/failed are ackable
// ---------------------------------------------------------------------------

describe("forgeCommandsAck — ack status gate (WR-02)", () => {
  /**
   * Mirror of the HTTP-layer status gate in forgeCommandsAck (backed by
   * ackCommand's v.union(v.literal("done"), v.literal("failed")) validator).
   * Here we test the extracted decision function without a live Convex
   * runtime.
   */
  function isAckableStatus(status: string): boolean {
    return status === "done" || status === "failed";
  }

  it("accepts done and failed", () => {
    expect(isAckableStatus("done")).toBe(true);
    expect(isAckableStatus("failed")).toBe(true);
  });

  it("rejects expired (would leak the blob with no remaining deletion site)", () => {
    expect(isAckableStatus("expired")).toBe(false);
  });

  it("rejects queued (would re-queue an executed command) and executing", () => {
    expect(isAckableStatus("queued")).toBe(false);
    expect(isAckableStatus("executing")).toBe(false);
  });

  it("rejects arbitrary strings", () => {
    expect(isAckableStatus("bogus")).toBe(false);
    expect(isAckableStatus("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 06 review WR-03: capAckReport — oversized report degrades, never fails
// ---------------------------------------------------------------------------

describe("forge.capAckReport — report size cap (WR-03)", () => {
  it("passes a normal report through unchanged", () => {
    const report = { schema_version: 1, verdict: "admit", findings: [] };
    expect(capAckReport(report)).toBe(report);
  });

  it("passes null/undefined through as null", () => {
    expect(capAckReport(null)).toBeNull();
    expect(capAckReport(undefined)).toBeNull();
  });

  it("replaces an oversized report with a truncation stub carrying the byte count", () => {
    const oversized = { findings: "x".repeat(MAX_ACK_REPORT_BYTES + 1) };
    const result = capAckReport(oversized) as { truncated: boolean; reason: string; bytes: number };
    expect(result.truncated).toBe(true);
    expect(result.reason).toBe("report exceeded size cap");
    expect(result.bytes).toBeGreaterThan(MAX_ACK_REPORT_BYTES);
  });

  it("preserves the top-level verdict when truncating an oversized report (07 review #5)", () => {
    // The collapsed Intake row reads report.verdict; if truncation strips it,
    // the row falls back to a misleading red "Error" for a skill that was
    // actually admitted/rejected. Verdict is small — keep it through the cap.
    const oversized = {
      verdict: "admit",
      findings: "x".repeat(MAX_ACK_REPORT_BYTES + 1),
    };
    const result = capAckReport(oversized) as {
      truncated: boolean;
      verdict?: string;
    };
    expect(result.truncated).toBe(true);
    expect(result.verdict).toBe("admit");
  });

  it("keeps a report exactly at the cap", () => {
    // JSON.stringify wraps a bare string in quotes: 2 chars of overhead.
    const atCap = "x".repeat(MAX_ACK_REPORT_BYTES - 2);
    expect(capAckReport(atCap)).toBe(atCap);
  });

  it("treats an unserializable report as oversized (stub, not throw)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = capAckReport(circular) as { truncated: boolean };
    expect(result.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 97 Plan 05 (INTAKE-04): synthesizeWriteRefusalReport — write-refusal
// → house-copy adapter (Open Question 2, RESOLVED: Convex-side)
// ---------------------------------------------------------------------------

describe("forge.synthesizeWriteRefusalReport — write-refusal house-copy adapter (INTAKE-04, D-07)", () => {
  const baseReport = { schema_version: 1, verdict: "admit", findings: [] as unknown[] };

  it("collision (exit 5): error becomes the D-07 actionable house copy naming skill + destination, no raw token", () => {
    const rawError =
      "write-refused:collision:C:/skills/foo already exists and differs from the candidate -- pass --allow-overwrite to write here";
    const { report, error } = synthesizeWriteRefusalReport(baseReport, rawError, "global");

    expect(error).not.toContain("write-refused:");
    expect(error).toContain('"foo"');
    expect(error).toContain("global");
    expect(error).toContain("already exists");
    expect(error).toBe(
      'A skill named "foo" already exists at global. Choose a different destination, or remove the existing skill first.'
    );

    const findings = (report as { findings: Array<Record<string, unknown>> }).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule_id: "write-refused",
      severity: "error",
      path: null,
      line: null,
      message: error,
    });
    expect((report as { verdict: string }).verdict).toBe("reject");
  });

  it("collision: falls back to a name-less phrasing when the raw reason has no extractable path", () => {
    const rawError = "write-refused:collision:already exists somewhere unusual";
    const { error } = synthesizeWriteRefusalReport(baseReport, rawError, "project");
    expect(error).not.toContain("write-refused:");
    expect(error).not.toContain('"');
    expect(error).toContain("already exists");
    expect(error).toContain("project");
  });

  it.each([
    ["unrecoverable", "destination is unrecoverable (gitignored) -- pass --allow-unrecoverable to write here"],
    ["cold-marker", "ASTRIDR-01 marker not confirmed in skill-intake.toml"],
    ["project-git", "No git top-level found for --project path"],
  ])("write-refused:%s → error is 'Install failed: <reason>. Nothing was written.'; finding severity error + verdict reject", (kind, reason) => {
    const rawError = `write-refused:${kind}:${reason}`;
    const { report, error } = synthesizeWriteRefusalReport(baseReport, rawError, "global");

    expect(error).not.toContain("write-refused:");
    expect(error).toBe(`Install failed: ${reason}. Nothing was written.`);

    const findings = (report as { findings: Array<Record<string, unknown>> }).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].rule_id).toBe("write-refused");
    expect((report as { verdict: string }).verdict).toBe("reject");
  });

  it.each([
    ["catalog", "CATALOG.md regeneration failed after placement"],
    ["ledger", "provenance ledger write failed after placement"],
  ])(
    "post-placement-warning:%s → error is 'Installed, but a post-placement step failed: <reason>.'; never says 'nothing was written'; finding severity warning; verdict UNCHANGED",
    (kind, reason) => {
      const rawError = `post-placement-warning:${kind}:${reason}`;
      const { report, error } = synthesizeWriteRefusalReport(baseReport, rawError, "global");

      expect(error).not.toContain("post-placement-warning:");
      expect(error).toBe(`Installed, but a post-placement step failed: ${reason}.`);
      expect(error).not.toContain("nothing was written");
      expect(error?.toLowerCase()).not.toContain("nothing was written");

      const findings = (report as { findings: Array<Record<string, unknown>> }).findings;
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("warning");
      expect(findings[0].rule_id).toBe("write-refused");
      // verdict UNCHANGED (Pitfall 4) — the write already succeeded.
      expect((report as { verdict: string }).verdict).toBe("admit");
    }
  );

  it("returns report + error unchanged when error is null", () => {
    const result = synthesizeWriteRefusalReport(baseReport, null, "global");
    expect(result.error).toBeNull();
    expect(result.report).toBe(baseReport);
  });

  it("returns report + error unchanged (raw pass-through) when error matches neither known prefix", () => {
    const result = synthesizeWriteRefusalReport(baseReport, "some other error entirely", "global");
    expect(result.error).toBe("some other error entirely");
    expect(result.report).toBe(baseReport);
  });

  it("preserves pre-existing findings entries — the synthetic finding is appended, not a replacement", () => {
    const existing = {
      schema_version: 1,
      verdict: "reject",
      findings: [{ rule_id: "frontmatter", severity: "error", path: "SKILL.md", line: 3, message: "bad frontmatter" }],
    };
    const { report } = synthesizeWriteRefusalReport(
      existing,
      "write-refused:collision:C:/skills/bar already exists and differs",
      "global"
    );
    const findings = (report as { findings: Array<Record<string, unknown>> }).findings;
    expect(findings).toHaveLength(2);
    expect(findings[0].rule_id).toBe("frontmatter");
    expect(findings[1].rule_id).toBe("write-refused");
  });

  it("defensive reshape: a null report is passed through as-is, but error is still composed (mirrors capAckReport)", () => {
    const { report, error } = synthesizeWriteRefusalReport(
      null,
      "write-refused:collision:C:/skills/baz already exists and differs",
      "global"
    );
    expect(report).toBeNull();
    expect(error).not.toContain("write-refused:");
    expect(error).toContain('"baz"');
  });

  it("defensive reshape: a non-object report (e.g. a truncation stub string) is passed through as-is, error still composed", () => {
    const { report, error } = synthesizeWriteRefusalReport(
      "not an object",
      "post-placement-warning:catalog:regen failed",
      "global"
    );
    expect(report).toBe("not an object");
    expect(error).toBe("Installed, but a post-placement step failed: regen failed.");
  });

  it("behavior guard: composing into findings alone (leaving error the raw token) would fail this assertion", () => {
    // Directly encodes the acceptance criterion: an implementation that only
    // synthesizes a finding and passes args.error through raw would leave
    // 'write-refused:collision:' in the persisted error string.
    const rawError = "write-refused:collision:C:/skills/qux already exists and differs";
    const { error } = synthesizeWriteRefusalReport(baseReport, rawError, "global");
    expect(error).not.toBe(rawError);
    expect(error).not.toMatch(/^write-refused:/);
  });
});

// ---------------------------------------------------------------------------
// Phase 80 DB round-trip stubs
// ---------------------------------------------------------------------------
//
// D-P10-13: an in-memory forgeCommands mock + ctx.storage.delete spy,
// extending swarmTasks.test.ts's makeStore()/mirror-function convention
// (in-memory array per table, db.query/.withIndex/.filter/.insert/.patch
// emulation via captured eq()/field() calls). NO existing test file mocks
// ctx.storage — this is the first. convex-test is NOT installed in this
// repo and must not be added; this mock is a plain vitest construct.
//
// Each mirror function below performs the SAME ctx.db/ctx.storage calls the
// real handler in forge.ts does (claimAndUpsertHost/ackCommand/
// expireStaleCommands, all unchanged by this plan) — tests call the mirror
// against the mock store/ctx, never the real Convex-wrapped export's
// .handler.

type ForgeCommandDoc = Record<string, any> & { _id: string };

function makeForgeCommandsStore() {
  const forgeCommands: ForgeCommandDoc[] = [];
  let seq = 0;
  const nextId = () => `cmd_${++seq}`;

  // Ordered call log shared by storage.delete and db.patch, so tests can
  // assert delete-before-patch ordering (D-P6-10) via index comparison,
  // not just "was called at all".
  const opLog: Array<{ op: "delete" | "patch"; id: string }> = [];
  const deletedStorageIds: string[] = [];

  const storage = {
    delete: async (storageId: string) => {
      deletedStorageIds.push(storageId);
      opLog.push({ op: "delete", id: storageId });
    },
  };

  // Index-query builder: supports the chained q.eq(...).eq(...) form used
  // by claimAndUpsertHost's withIndex, and the single q.lt(...)/q.eq(...)
  // forms used by expireStaleCommands'/ackCommand's withIndex.
  function makeIndexQ(conditions: Array<{ field: string; op: "eq" | "lt" | "gt"; value: any }>) {
    const q: any = {
      eq: (field: string, value: any) => {
        conditions.push({ field, op: "eq", value });
        return q;
      },
      lt: (field: string, value: any) => {
        conditions.push({ field, op: "lt", value });
        return q;
      },
      gt: (field: string, value: any) => {
        conditions.push({ field, op: "gt", value });
        return q;
      },
    };
    return q;
  }

  // Filter builder: supports q.field(name), q.eq(fieldRef, value),
  // q.gt(fieldRef, value), q.and(...preds), q.or(...preds) — matching
  // claimAndUpsertHost's exact filter shape (q.and(q.gt(...), q.or(...))).
  function makeFilterQ() {
    const fieldName = (ref: any) => (ref && typeof ref === "object" && "__field" in ref ? ref.__field : ref);
    return {
      field: (name: string) => ({ __field: name }),
      eq: (leftRef: any, value: any) => (row: ForgeCommandDoc) => row[fieldName(leftRef)] === value,
      gt: (leftRef: any, value: any) => (row: ForgeCommandDoc) => row[fieldName(leftRef)] > value,
      and: (...preds: Array<(row: ForgeCommandDoc) => boolean>) => (row: ForgeCommandDoc) =>
        preds.every((p) => p(row)),
      or: (...preds: Array<(row: ForgeCommandDoc) => boolean>) => (row: ForgeCommandDoc) =>
        preds.some((p) => p(row)),
    };
  }

  function applyIndexConditions(
    rows: ForgeCommandDoc[],
    conditions: Array<{ field: string; op: "eq" | "lt" | "gt"; value: any }>
  ) {
    return rows.filter((r) =>
      conditions.every((c) => {
        if (c.op === "eq") return r[c.field] === c.value;
        if (c.op === "lt") return r[c.field] < c.value;
        return r[c.field] > c.value; // "gt"
      })
    );
  }

  const db = {
    query: (tableName: string) => {
      const table = tableName === "forgeCommands" ? forgeCommands : [];
      return {
        withIndex: (_indexName: string, indexFn?: (q: any) => any) => {
          const conditions: Array<{ field: string; op: "eq" | "lt" | "gt"; value: any }> = [];
          if (indexFn) indexFn(makeIndexQ(conditions));
          const applyIndex = (rows: ForgeCommandDoc[]) => applyIndexConditions(rows, conditions);
          return {
            filter: (filterFn: (q: any) => any) => {
              const predicate = filterFn(makeFilterQ());
              const applyBoth = (rows: ForgeCommandDoc[]) => applyIndex(rows).filter((r) => predicate(r));
              return {
                collect: async () => applyBoth(table).map((r) => ({ ...r })),
                take: async (n: number) => applyBoth(table).slice(0, n).map((r) => ({ ...r })),
              };
            },
            collect: async () => applyIndex(table).map((r) => ({ ...r })),
            unique: async () => {
              const match = applyIndex(table)[0];
              return match ? { ...match } : null;
            },
            take: async (n: number) => applyIndex(table).slice(0, n).map((r) => ({ ...r })),
          };
        },
      };
    },
    insert: async (tableName: string, data: Record<string, any>) => {
      const doc = { ...data, _id: nextId() };
      if (tableName === "forgeCommands") forgeCommands.push(doc as ForgeCommandDoc);
      return doc._id;
    },
    patch: async (id: string, data: Record<string, any>) => {
      const idx = forgeCommands.findIndex((r) => r._id === id);
      if (idx !== -1) {
        Object.assign(forgeCommands[idx], data);
        opLog.push({ op: "patch", id });
      }
    },
  };

  return { forgeCommands, db, storage, deletedStorageIds, opLog };
}

// Mirror of claimAndUpsertHost's queued-commands claim loop (forge.ts
// L692-739). Omits the forgeHosts liveness upsert (out of scope for this
// task's claim/skip-claim behavior) but performs the SAME ctx.db.query/
// withIndex/filter/take/patch calls the real handler does, parameterized
// by resolveClaimTypes (imported, unchanged).
async function claimAndUpsertHostMirror(
  ctx: { db: any },
  args: { hostId: string; now: number; supportedTypes?: string[] }
) {
  const types = resolveClaimTypes(args.supportedTypes);
  if (types.length === 0) return [];

  const queued = await ctx.db
    .query("forgeCommands")
    .withIndex("by_host_status_created", (q: any) => q.eq("hostId", args.hostId).eq("status", "queued"))
    .filter((q: any) =>
      q.and(
        q.gt(q.field("expiresAt"), args.now),
        q.or(...types.map((t: string) => q.eq(q.field("commandType"), t)))
      )
    )
    .take(10);

  for (const cmd of queued) {
    await ctx.db.patch(cmd._id, {
      status: "executing",
      claimedAt: args.now,
      executedAt: args.now,
    });
  }

  // W1: matches production — returned docs still show the pre-patch
  // status:"queued" snapshot.
  return queued;
}

// Mirror of ackCommand (forge.ts L757-786): terminal-idempotency guard
// (isTerminalCommandStatus, imported, unchanged) + blob-delete-before-patch
// ordering for intake rows.
async function ackCommandMirror(
  ctx: { db: any; storage: any },
  args: {
    commandId: string;
    status: "done" | "failed";
    resolvedForgeJobId: string | null;
    error: string | null;
    now: number;
    report?: any;
  }
) {
  const cmd = await ctx.db
    .query("forgeCommands")
    .withIndex("by_commandId", (q: any) => q.eq("commandId", args.commandId))
    .unique();
  if (!cmd) return;
  if (isTerminalCommandStatus(cmd.status)) return;
  if (
    cmd.commandType === "intake" &&
    cmd.intakePayload?.storageId &&
    (args.status === "done" || args.status === "failed")
  ) {
    await ctx.storage.delete(cmd.intakePayload.storageId);
  }
  // Phase 97 Plan 05 (INTAKE-04): mirrors the real ackCommand's write-refusal
  // adapter wiring — non-intake acks and unmatched/null errors pass through.
  let patchedError = args.error;
  let patchedReport: unknown = args.report ?? null;
  if (cmd.commandType === "intake") {
    const adapted = synthesizeWriteRefusalReport(
      args.report ?? null,
      args.error,
      cmd.intakePayload?.destination ?? null
    );
    patchedReport = adapted.report;
    patchedError = adapted.error;
  }
  await ctx.db.patch(cmd._id, {
    status: args.status,
    resolvedForgeJobId: args.resolvedForgeJobId,
    error: patchedError,
    completedAt: args.now,
    report: capAckReport(patchedReport),
  });
}

// Mirror of expireStaleCommands (forge.ts L791-812): blob-delete-before-patch
// ordering for unclaimed intake rows, gated by shouldExpireCommand (imported,
// unchanged).
async function expireStaleCommandsMirror(ctx: { db: any; storage: any }, now: number) {
  const stale = await ctx.db
    .query("forgeCommands")
    .withIndex("by_expires", (q: any) => q.lt("expiresAt", now))
    .collect();
  for (const cmd of stale) {
    if (shouldExpireCommand(cmd.status, cmd.expiresAt, now)) {
      if (cmd.commandType === "intake" && cmd.intakePayload?.storageId) {
        await ctx.storage.delete(cmd.intakePayload.storageId);
      }
      await ctx.db.patch(cmd._id, { status: "expired" });
    }
  }
}

// Mirror of enqueueLifecycle (forge.ts, Phase 98): performs the SAME
// ctx.db.query/withIndex/unique/insert calls the real handler does. The
// skills-registry pre-flight query is stood in for by a directly-passed
// `originsForName` array on `args` (this file's established "extract the
// decision, skip the live runtime" convention — see storageMetaGuard /
// projectWorkspaceGuard above) rather than modeling a second mock table,
// since validateLifecyclePreflight (imported, unchanged) is exercised
// directly and exhaustively in its own describe block.
async function enqueueLifecycleMirror(
  ctx: { db: any },
  args: {
    hostId: string;
    commandId: string;
    action: "archive" | "restore" | "move" | "delete";
    skillName: string;
    sourceOrigin: string;
    destination: "global" | "project" | "cold";
    workspaceId: string | null;
    originsForName: string[];
  },
  identity: { subject: string } | null,
  now: number
): Promise<string | null> {
  if (identity === null) {
    throw new Error("Authentication required to issue Forge commands");
  }

  const existing = await ctx.db
    .query("forgeCommands")
    .withIndex("by_commandId", (q: any) => q.eq("commandId", args.commandId))
    .unique();
  if (existing) return null; // idempotent retry no-op

  if (!isSafeSkillName(args.skillName)) {
    throw new Error(`Invalid skill name: ${args.skillName}`);
  }

  validateLifecyclePreflight(
    {
      action: args.action,
      destination: args.destination,
      workspaceId: args.workspaceId,
      sourceOrigin: args.sourceOrigin,
    },
    args.originsForName
  );

  const row = buildLifecycleRow(args, identity.subject, now, FORGE_COMMAND_TTL_MS);
  return await ctx.db.insert("forgeCommands", row);
}

describe("forge command bridge — DB round-trip (integration)", () => {
  it.todo("enqueueLaunch: inserts forgeCommands row with status='queued'");
  it.todo("enqueueLaunch: strips dangerous from capabilities before insert (D-06)");
  it.todo("enqueueStop: inserts forgeCommands row with commandType='stop'");
  it.todo("claimAndUpsertHost: atomically claims queued commands + upserts forgeHosts row");
  it.todo("claimAndUpsertHost: does not claim expired commands (expiresAt < now)");
  it.todo("expireStaleCommands: marks queued commands past expiresAt as expired");
  it.todo("expireStaleCommands: does not touch executing/done/failed commands");
  it.todo("ackCommand: sets resolvedForgeJobId and status=done on claimed command");
  it.todo("ackCommand: sets status=failed and error on failed command");
  it.todo("enqueueIntake: inserts forgeCommands row with commandType='intake' and status='queued'");
  it.todo("enqueueIntake: a duplicate commandId is a silent no-op -- idempotent client retry, no second row (WR-04)");
  it.todo("enqueueIntake: rejects an upload exceeding MAX_INTAKE_UPLOAD_BYTES (requires a live storage-backed row)");
  it.todo("generateForgeUploadUrl: returns a usable signed upload URL");
  it("claimAndUpsertHost: does not claim an intake row when supportedTypes omits 'intake'", async () => {
    const store = makeForgeCommandsStore();
    const now = 1_000;
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-intake-1",
      commandType: "intake",
      status: "queued",
      createdAt: now - 10,
      expiresAt: now + 60_000,
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-1" },
    });

    // supportedTypes omitted -> resolveClaimTypes defaults to ["launch", "stop"]
    const result = await claimAndUpsertHostMirror(store, { hostId: "desktop-abc", now });

    expect(result).toEqual([]);
    expect(store.forgeCommands[0].status).toBe("queued");
  });

  it("claimAndUpsertHost: claims an intake row when supportedTypes includes 'intake'", async () => {
    const store = makeForgeCommandsStore();
    const now = 1_000;
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-intake-2",
      commandType: "intake",
      status: "queued",
      createdAt: now - 10,
      expiresAt: now + 60_000,
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-2" },
    });

    const result = await claimAndUpsertHostMirror(store, {
      hostId: "desktop-abc",
      now,
      supportedTypes: ["intake"],
    });

    // W1: returned snapshot still shows pre-patch status:"queued"
    expect(result).toHaveLength(1);
    expect(result[0].commandId).toBe("cmd-intake-2");
    expect(result[0].status).toBe("queued");
    // Server-side, the row is atomically claimed (queued -> executing)
    expect(store.forgeCommands[0].status).toBe("executing");
    expect(store.forgeCommands[0].claimedAt).toBe(now);
    expect(store.forgeCommands[0].executedAt).toBe(now);
  });
  it.todo("forgeCommandsClaim: resolves storageId to a fetchable downloadUrl for a claimed intake row (SC5 — covered live by scripts/verify-intake-claim.mjs in Plan 06-04, not here)");
  it.todo("listIntakeCommands: returns only commandType='intake' rows, newest-first, capped at INTAKE_LIST_LIMIT, across all hosts");

  // D-P6-10/D-P6-13 lifecycle stubs: these genuinely require a live storage-backed
  // row to verify meaningfully (the interesting behavior IS the ctx.storage.delete
  // call against a real blob), so they cannot be pure-logic-extracted the way
  // resolveClaimTypes/isSafeSubpath were. Coverage split (do not overstate):
  // Plan 06-04's scripts/verify-intake-claim.mjs covers exactly TWO of these five
  // live against the dev deployment — the done-path blob delete (its post-ack
  // fetch(downloadUrl) non-200 assertion) and report-on-ack storage (its
  // listForgeCommands report assertion). The remaining three — failed-status blob
  // delete, duplicate-ack idempotency, and the expire-path blob delete — are NOT
  // covered by any automation this phase; they remain honest todos with optional
  // manual spot-checks documented in 06-VALIDATION.md's Manual-Only Verifications
  // table.
  it("ackCommand: deletes the intake row's storage blob before patching status to done", async () => {
    const store = makeForgeCommandsStore();
    const cmdId = await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-done",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-done" },
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-done",
      status: "done",
      resolvedForgeJobId: null,
      error: null,
      now: 2_000,
    });

    expect(store.deletedStorageIds).toContain("storage-done");
    const deleteIdx = store.opLog.findIndex((e) => e.op === "delete");
    const patchIdx = store.opLog.findIndex((e) => e.op === "patch" && e.id === cmdId);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(patchIdx).toBeGreaterThan(deleteIdx);
    expect(store.forgeCommands[0].status).toBe("done");
  });

  it("ackCommand: deletes the intake row's storage blob before patching status to failed", async () => {
    const store = makeForgeCommandsStore();
    const cmdId = await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-failed",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-failed" },
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-failed",
      status: "failed",
      resolvedForgeJobId: null,
      error: "daemon reported an error",
      now: 2_000,
    });

    expect(store.deletedStorageIds).toContain("storage-failed");
    const deleteIdx = store.opLog.findIndex((e) => e.op === "delete");
    const patchIdx = store.opLog.findIndex((e) => e.op === "patch" && e.id === cmdId);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(patchIdx).toBeGreaterThan(deleteIdx);
    expect(store.forgeCommands[0].status).toBe("failed");
    expect(store.forgeCommands[0].error).toBe("daemon reported an error");
  });

  it("ackCommand: does not re-delete an already-terminal intake row's blob on a duplicate ack (CR-01 idempotency)", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-dup",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-dup" },
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-dup",
      status: "done",
      resolvedForgeJobId: null,
      error: null,
      now: 2_000,
    });
    // Second, duplicate/late ack on the now-terminal row
    await ackCommandMirror(store, {
      commandId: "cmd-ack-dup",
      status: "done",
      resolvedForgeJobId: null,
      error: null,
      now: 3_000,
    });

    // storage.delete called exactly once across the two sequential acks —
    // proves CR-01 idempotency, not just that it was called at all.
    const deleteCalls = store.opLog.filter((e) => e.op === "delete" && e.id === "storage-dup");
    expect(deleteCalls).toHaveLength(1);
    expect(store.forgeCommands[0].completedAt).toBe(2_000); // unchanged by the 2nd ack
  });

  it("ackCommand: stores the report field on the row for a terminal intake ack", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-report",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-report" },
    });

    const report = { verdict: "admit", findings: [] };
    await ackCommandMirror(store, {
      commandId: "cmd-ack-report",
      status: "done",
      resolvedForgeJobId: null,
      error: null,
      now: 2_000,
      report,
    });

    expect(store.forgeCommands[0].report).toEqual(capAckReport(report));
  });

  it("expireStaleCommands: deletes an unclaimed intake row's storage blob before marking it expired", async () => {
    const store = makeForgeCommandsStore();
    const now = 10_000;
    const cmdId = await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-expire-1",
      commandType: "intake",
      status: "queued",
      expiresAt: now - 1_000, // already past TTL
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-expire" },
    });

    await expireStaleCommandsMirror(store, now);

    expect(store.deletedStorageIds).toContain("storage-expire");
    const deleteIdx = store.opLog.findIndex((e) => e.op === "delete");
    const patchIdx = store.opLog.findIndex((e) => e.op === "patch" && e.id === cmdId);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(patchIdx).toBeGreaterThan(deleteIdx);
    expect(store.forgeCommands[0].status).toBe("expired");
  });

  // -------------------------------------------------------------------------
  // Phase 97 Plan 05 (INTAKE-04): ackCommand wires synthesizeWriteRefusalReport
  // before capAckReport — end-to-end through the mirror (Task 2)
  // -------------------------------------------------------------------------

  it("ackCommand: a write-refused:collision: ack persists the actionable house copy in error AND the synthetic finding + verdict reject in report", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-collision",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-collision" },
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-collision",
      status: "failed",
      resolvedForgeJobId: null,
      error:
        "write-refused:collision:C:/skills/foo already exists and differs from the candidate -- pass --allow-overwrite to write here",
      now: 2_000,
      report: { schema_version: 1, verdict: "admit", findings: [] },
    });

    const row = store.forgeCommands[0];
    expect(row.status).toBe("failed");
    expect(row.error).not.toContain("write-refused:");
    expect(row.error).toBe(
      'A skill named "foo" already exists at global. Choose a different destination, or remove the existing skill first.'
    );
    expect(row.report.verdict).toBe("reject");
    expect(row.report.findings).toHaveLength(1);
    expect(row.report.findings[0]).toMatchObject({ rule_id: "write-refused", severity: "error" });
  });

  it("ackCommand: a post-placement-warning:catalog: ack (status done) stays done, error is kind-accurate (never 'nothing was written'), report has a warning finding", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-catalog-warning",
      commandType: "intake",
      status: "executing",
      intakePayload: { destination: "global", workspaceId: null, storageId: "storage-catalog-warning" },
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-catalog-warning",
      status: "done",
      resolvedForgeJobId: null,
      error: "post-placement-warning:catalog:CATALOG.md regeneration failed after placement",
      now: 2_000,
      report: { schema_version: 1, verdict: "admit", findings: [] },
    });

    const row = store.forgeCommands[0];
    expect(row.status).toBe("done");
    expect(row.error).not.toContain("post-placement-warning:");
    expect(row.error?.toLowerCase()).not.toContain("nothing was written");
    expect(row.error).toBe(
      "Installed, but a post-placement step failed: CATALOG.md regeneration failed after placement."
    );
    expect(row.report.verdict).toBe("admit"); // unchanged — the skill IS on disk (Pitfall 4)
    expect(row.report.findings).toHaveLength(1);
    expect(row.report.findings[0]).toMatchObject({ rule_id: "write-refused", severity: "warning" });
  });

  it("ackCommand: a non-intake (launch) ack passes error through verbatim — adapter never fires for launch/stop", async () => {
    const store = makeForgeCommandsStore();
    await store.db.insert("forgeCommands", {
      hostId: "desktop-abc",
      commandId: "cmd-ack-launch",
      commandType: "launch",
      status: "executing",
    });

    await ackCommandMirror(store, {
      commandId: "cmd-ack-launch",
      status: "failed",
      resolvedForgeJobId: null,
      error: "write-refused:collision:this looks like an intake token but isn't one",
      now: 2_000,
    });

    const row = store.forgeCommands[0];
    expect(row.status).toBe("failed");
    // Adapter only runs for commandType === "intake" — a launch/stop ack's
    // error (even one that happens to look like the intake token shape)
    // passes through completely verbatim.
    expect(row.error).toBe("write-refused:collision:this looks like an intake token but isn't one");
  });
});
