/**
 * Bifröst — liveness resolution (Phase 117, D-02/D-03).
 *
 * `livenessOf` is the whole liveness decision. Its load-bearing rule is D-03:
 * "no signal" must return null so the UI renders NO dot — never a green one.
 * A green dot for an unknown service is worse than no dot at all, because it
 * asserts something the system does not know.
 *
 * The red case is proven here rather than live: every container on the machine
 * was running at verification time, and manufacturing a red dot would mean
 * stopping one of Larry's real services.
 */
import { describe, test, expect } from "vitest";
import { livenessOf } from "./Bifrost";

const STATUSES = {
  "astridr-agent": "running",
  "convex-backend": "running",
  "old-thing": "exited",
  "paused-thing": "paused",
};

describe("livenessOf — D-02 container-name join", () => {
  test("a running container reads up", () => {
    expect(livenessOf({ containerName: "astridr-agent" }, STATUSES)).toBe("up");
  });

  test("an exited container reads down", () => {
    expect(livenessOf({ containerName: "old-thing" }, STATUSES)).toBe("down");
  });

  test("any non-running status reads down, not just 'exited'", () => {
    expect(livenessOf({ containerName: "paused-thing" }, STATUSES)).toBe("down");
  });
});

describe("livenessOf — D-03 absent signal is never 'up'", () => {
  test("a link with no containerName returns null", () => {
    expect(livenessOf({}, STATUSES)).toBeNull();
  });

  test("a containerName with no matching container returns null, NOT down", () => {
    // This distinction matters: "we have no reading for this" is not the same
    // claim as "this service is down", and rendering the latter would invent a
    // fact. The UI draws nothing for null.
    expect(livenessOf({ containerName: "never-existed" }, STATUSES)).toBeNull();
  });

  test("an empty containerName string returns null", () => {
    expect(livenessOf({ containerName: "" }, STATUSES)).toBeNull();
  });

  test("CONTROL: the same map does resolve a real name, so null is a real absence", () => {
    // Without this, every null above is consistent with a lookup that simply
    // cannot see the map at all.
    expect(livenessOf({ containerName: "convex-backend" }, STATUSES)).toBe("up");
  });
});
