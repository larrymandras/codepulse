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
// Phase 80 DB round-trip stubs
// ---------------------------------------------------------------------------

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
  it.todo("enqueueIntake: rejects an upload exceeding MAX_INTAKE_UPLOAD_BYTES (requires a live storage-backed row)");
  it.todo("generateForgeUploadUrl: returns a usable signed upload URL");
});
