// postSnapshot direct wire tests (Phase 115-01, D-04). Complements
// hooks/__tests__/scanner.test.mjs (which exercises postSnapshot indirectly through
// runScan) with tests that exercise the six behaviors of postSnapshot itself, including
// the load-bearing never-throws contract that keeps the awaited SessionStart path
// (hooks/codepulse-hook.mjs:142-145) from ever hanging or crashing the dispatcher.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { postSnapshot } from "../ingestPost.mjs";

/** Resolves with { headers, body } of the server's NEXT incoming request. */
function nextRequest(server, { statusCode = 200 } = {}) {
  return new Promise((resolve) => {
    server.once("request", (req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: statusCode < 400 }));
        resolve({ headers: req.headers, url: req.url, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
  });
}

describe("postSnapshot — direct wire contract", () => {
  let server, url;

  beforeEach(async () => {
    server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("case 1 (bearer present, passing control): sends Authorization header + exact JSON body, returns {ok:true,status:200}", async () => {
    const reqPromise = nextRequest(server, { statusCode: 200 });
    const result = await postSnapshot(`${url}/scan`, "test-key", { hello: "world" });
    const req = await reqPromise;

    expect(req.headers.authorization).toBe("Bearer test-key");
    expect(JSON.parse(req.body)).toEqual({ hello: "world" });
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it("case 2 (bearer absent, control): request still arrives with no authorization header", async () => {
    const reqPromise = nextRequest(server, { statusCode: 200 });
    const result = await postSnapshot(`${url}/scan`, undefined, { hello: "world" });
    const req = await reqPromise;

    expect(req.headers.authorization).toBeUndefined();
    expect(JSON.parse(req.body)).toEqual({ hello: "world" });
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it("case 3: non-2xx response returns {ok:false,status:401} and does not throw", async () => {
    const reqPromise = nextRequest(server, { statusCode: 401 });
    const result = await postSnapshot(`${url}/scan`, "test-key", { hello: "world" });
    await reqPromise;

    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("case 4 (load-bearing non-throwing assertion): unreachable endpoint returns {ok:false,status:null}, not a rejection", async () => {
    // Point at a closed port on localhost — nothing is listening.
    const closedPortUrl = "http://127.0.0.1:1";

    // Explicitly NOT `expect(...).rejects` — that shape would mean the non-throwing
    // contract was broken. Assert on the resolved return value instead.
    const result = await postSnapshot(`${closedPortUrl}/scan`, "test-key", { hello: "world" });

    expect(result).toEqual({ ok: false, status: null });
  }, 10000);

  it("case 5: a timeout resolves (does not hang, does not throw) within the test timeout", async () => {
    // Server that accepts the connection but never responds.
    server.on("request", () => {
      // Deliberately never call res.end() / res.writeHead().
    });

    const result = await postSnapshot(`${url}/scan`, "test-key", { hello: "world" }, { timeoutMs: 20 });

    expect(result).toEqual({ ok: false, status: null });
  }, 10000);

  it("case 6 (path is caller-owned, control for later reuse): server receives the exact path, not a hardcoded /scan", async () => {
    const reqPromise = nextRequest(server, { statusCode: 200 });
    await postSnapshot(`${url}/workspace-ingest`, "test-key", { hello: "world" });
    const req = await reqPromise;

    expect(req.url).toBe("/workspace-ingest");
  });
});
