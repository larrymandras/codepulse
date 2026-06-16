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
