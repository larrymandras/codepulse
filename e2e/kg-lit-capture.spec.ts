import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";

/**
 * D-10 acceptance capture — produces the matched image pair
 * `190-D10-PROTOCOL.md` (astridr-repo) consumes for the blind human
 * identification test (GLXY-03).
 *
 * Two captures of the SAME `/knowledge-graph` overview graph, both asserted
 * to be in 3D render mode (the page defaults to 2D and the entire lit
 * encoding is gated behind `renderMode !== "3d"` — see 190-UI-SPEC.md
 * §Acceptance Precondition):
 *
 *  - **Experimental**: live Convex connection. If a `kg_answer_sync` row is
 *    already persisted (a real prior turn), the answer-sync effect applies
 *    it on load and the halo ring (190-05) renders on the source nodes.
 *  - **Control**: identical navigation, but every WebSocket the page opens
 *    is intercepted and left unconnected (Playwright mocks it — the socket
 *    reports "open" to the page but never receives a sync handshake), so
 *    Convex's `useQuery(api.kg.latestAnswerSync)` never resolves and
 *    `litNodeIds` stays at its initial empty Set forever. The `/api/kg/*`
 *    REST graph data is untouched by this — it is a different transport —
 *    which is what makes this the cleanest available control: same graph,
 *    zero lit signal.
 *
 * Like the other e2e specs here, this assumes Clerk is disabled. Run via
 * `npm run test:e2e:noauth:help` for the exact invocation (dev:noauth on a
 * dedicated port, started in its own terminal — this config's `webServer`
 * is hardcoded to a different port and will not proxy these requests).
 *
 * ⚠️ Output discipline (T-190-14 / D-10 blinding, both load-bearing):
 *  - Screenshots may show a real personal knowledge graph. They are written
 *    under `test-results/` (gitignored) and never committed. Their absolute
 *    paths are what `190-D10-RESULT.md` records, not the images themselves.
 *  - This spec writes the capture-time-named originals (unambiguous to the
 *    experimenter) AND a neutrally-named, order-randomised copy pair
 *    (`image-1.png` / `image-2.png`, what the OBSERVER is shown) plus a
 *    `mapping.json` recording which is which. `mapping.json` is for the
 *    experimenter only — per the protocol, the condition→image mapping is
 *    transcribed into `190-D10-RESULT.md` ONLY after the observer answers.
 *    Do not open `mapping.json` in front of the observer.
 */

const OUTPUT_DIR = path.join("test-results", "kg-lit-capture");

interface CaptureResult {
  renderMode: string | null;
  nodeCount: number | null;
  hasPersonEntity: boolean;
  litSignalLog: string[];
  screenshotPath: string;
}

/**
 * Navigates to /knowledge-graph, toggles to 3D, waits past the arrival
 * bloom, and screenshots the graph canvas.
 *
 * `blockConvex`: when true, mocks every WebSocket the page opens (Convex's
 * sync transport) so `litNodeIds` cannot populate — the D-10 control.
 */
async function captureKgGraph(
  context: BrowserContext,
  opts: { blockConvex: boolean; captureName: string },
): Promise<CaptureResult> {
  const page: Page = await context.newPage();

  // Seed the first-visit onboarding tour as already-complete (OnboardingGuide.tsx
  // STORAGE_KEY) — a fresh browser context has no localStorage, so the "Welcome
  // to CodePulse" modal opens unprompted on first paint and its backdrop
  // intercepts every subsequent click, including the 3D toggle. Confirmed live:
  // without this, the 3D-toggle click retries for the full test timeout against
  // a `fixed inset-0 z-50 … backdrop-blur-sm` overlay.
  await page.addInitScript(() => {
    localStorage.setItem("codepulse_onboarding_complete", "true");
  });

  const litSignalLog: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[kg-answer-sync]")) litSignalLog.push(text);
  });

  let overviewNodeCount: number | null = null;
  let hasPersonEntity = false;
  page.on("response", (response) => {
    if (!response.url().includes("/api/kg/overview")) return;
    response
      .json()
      .then((body: { entities?: Array<{ entityType?: string | null }> }) => {
        const entities = body.entities ?? [];
        overviewNodeCount = entities.length;
        hasPersonEntity = entities.some((e) => e.entityType === "person");
      })
      .catch(() => {
        // Non-JSON or already-consumed body — leave counters unset; the
        // assertions below fail loudly rather than silently accepting an
        // unmeasured graph.
      });
  });

  // ── CORS pass-through for the astridr REST API ────────────────────────
  // Deviation from the plan draft, recorded in the SUMMARY: astridr's
  // CORSMiddleware allowlist (CODEPULSE_GATEWAY_ORIGIN) is configured for
  // the regular dev server's origin (…:5173) and does not include the
  // keyless dev:noauth port this spec runs against (…:5181 per
  // package.json:17's documented invocation) — confirmed live, the browser
  // logs "blocked by CORS policy: … No 'Access-Control-Allow-Origin'
  // header" while a direct curl to the same endpoint succeeds (401 without
  // auth, meaning the route and the backend are both reachable). Editing
  // astridr's CORS allowlist would mean changing its live .env and
  // restarting the container, which is out of scope for this plan and
  // would affect the shared, currently-in-use astridr-agent instance a
  // concurrent session may depend on. Instead, relay `/api/kg/*` through
  // Node's own fetch (not subject to browser CORS at all, since CORS is
  // enforced by the browser's fetch initiator, not by Node) and re-deliver
  // the REAL upstream response with a permissive ACAO header added. This
  // still exercises the live endpoint with the real Authorization header
  // the page would have sent — it works around a dev-only CORS gap, it
  // does not fabricate or stub the graph data.
  await page.route(/\/api\/kg\//, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-allow-methods": "GET, OPTIONS",
        },
      });
      return;
    }
    const upstream = await fetch(req.url(), {
      method: req.method(),
      headers: req.headers(),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const headers = Object.fromEntries(upstream.headers.entries());
    headers["access-control-allow-origin"] = "*";
    delete headers["content-encoding"]; // already decoded by fetch; stale header breaks the browser's decode
    await route.fulfill({ status: upstream.status, headers, body });
  });

  if (opts.blockConvex) {
    // Mock every WebSocket the page opens (Convex's sync protocol is the
    // only one this page uses). Not calling connectToServer() means
    // Playwright auto-opens the socket inside the page (the client sees
    // `onopen`) but forwards nothing further — Convex's client never
    // receives a sync handshake, so every useQuery (including
    // api.kg.latestAnswerSync) stays in its initial "loading" (undefined)
    // state for the lifetime of the page. litNodeIds's initial state is
    // already an empty Set (KnowledgeGraph.tsx), so this is a true "no
    // signal ever arrives" control, not merely "no row today".
    await context.routeWebSocket(
      (url) => url.protocol === "ws:" || url.protocol === "wss:",
      () => {
        /* intentionally inert — see comment above */
      },
    );
  }

  await page.goto("/knowledge-graph", { waitUntil: "domcontentloaded" });

  // Race-safe gate check (existing e2e idiom in this repo) — dev:noauth has
  // no Clerk gate, but fail loudly rather than silently screenshotting a
  // sign-in wall if a Clerk-gated server was used by mistake.
  const signInText = page.getByText("Sign in to access the telemetry dashboard");
  const renderModeGroup = page.getByRole("group", { name: "Render mode" });
  await expect(signInText.or(renderModeGroup).first()).toBeVisible({ timeout: 15000 });
  if (await signInText.count()) {
    throw new Error(
      "Clerk sign-in gate present — this capture requires the keyless dev:noauth server " +
        "(npm run test:e2e:noauth:help). A gated capture cannot be used for D-10.",
    );
  }

  // Wait for the overview graph fetch to actually land before toggling —
  // toggling to 3D before any nodes exist would still pass the renderMode
  // assertion below while capturing an empty scene.
  await expect
    .poll(() => overviewNodeCount, {
      message: "waiting for /api/kg/overview response",
      timeout: 15000,
    })
    .not.toBeNull();

  // ── Toggle to 3D and assert on the RESULT, not the click ──────────────
  // Per 190-06-PLAN.md: do not assume the toggle worked. aria-pressed is a
  // controlled attribute bound to the same `renderMode` state the lit
  // encoding itself is gated on (KnowledgeGraph.tsx renderModeChipClass) —
  // asserting it is asserting the state, not the dispatch of a click event.
  // The canvas-context check below is the stronger, corroborating signal:
  // it can only be true if the library that owns the 3D branch
  // (react-force-graph-3d / three.js WebGLRenderer) actually mounted,
  // since the 2D and 3D renderers are mutually exclusive siblings
  // (`renderMode === "2d" ? <ForceGraphCanvas/> : <LazyForceGraph3D/>`).
  await page.getByRole("button", { name: "3D" }).click();
  await expect(page.getByRole("button", { name: "3D" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const canvasIsWebGL = () =>
    page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      return canvases.some((c) => {
        try {
          return !!(c.getContext("webgl2") || c.getContext("webgl"));
        } catch {
          return false;
        }
      });
    });
  await expect
    .poll(canvasIsWebGL, {
      message: "waiting for a WebGL canvas (3D surface) to mount",
      timeout: 15000,
    })
    .toBe(true);

  // ── Wait past the transient, capture the resting state (D-09) ─────────
  // The arrival bloom is 800ms total (BLOOM_GROW_MS 400 + BLOOM_SETTLE_MS
  // 400, KnowledgeGraph.tsx) and any camera-fly tween is a 400ms zoomToFit.
  // No onEngineStop-derived signal is exposed outside the component (it is
  // not console-logged and this plan does not add app code to expose one),
  // so this is a generous fixed wait chosen to clear both the transient AND
  // the force layout's typical settle time for a ~100-node overview graph,
  // not a precise engine-stop handshake. Documented as a deviation in the
  // plan SUMMARY.
  await page.waitForTimeout(6000);

  const renderMode = await page.evaluate(() => {
    const group = document.querySelector('[aria-label="Render mode"]');
    const pressed = group?.querySelector('[aria-pressed="true"]');
    return pressed?.textContent?.trim().toLowerCase() ?? null;
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const screenshotPath = path.join(OUTPUT_DIR, `${opts.captureName}.png`);
  await page.locator("canvas").first().screenshot({ path: screenshotPath });

  console.log(
    `[kg-lit-capture] ${opts.captureName}: renderMode=${renderMode} ` +
      `nodeCount=${overviewNodeCount} hasPersonEntity=${hasPersonEntity} ` +
      `litSignal=${JSON.stringify(litSignalLog)}`,
  );

  await page.close();

  return {
    renderMode,
    nodeCount: overviewNodeCount,
    hasPersonEntity,
    litSignalLog,
    screenshotPath,
  };
}

test.describe("D-10 — knowledge-graph lit-node capture pair", () => {
  test("captures matched experimental (lit, Convex live) and control (Convex blocked) 3D screenshots", async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    // Two independent browser contexts — NOT two tests sharing one browser
    // fixture — so each gets its own fresh IndexedDB (renderMode/lens
    // persistence keys) and neither capture can see the other's state.
    const experimentalContext = await browser.newContext();
    const controlContext = await browser.newContext();

    const experimental = await captureKgGraph(experimentalContext, {
      blockConvex: false,
      captureName: "capture-experimental",
    });
    const control = await captureKgGraph(controlContext, {
      blockConvex: true,
      captureName: "capture-control",
    });

    await experimentalContext.close();
    await controlContext.close();

    // ── Hard constraint 1: both captures asserted 3D ───────────────────
    expect(experimental.renderMode, "experimental capture must be renderMode=3d").toBe("3d");
    expect(control.renderMode, "control capture must be renderMode=3d").toBe("3d");

    // ── Hard constraint 3: D-10 precondition — person entities present ──
    // (present in the overview fetch itself, independent of which nodes
    // are lit — the canonical 5-source turn contains none, per
    // 190-CONTEXT.md; the precondition is about the GRAPH, not the
    // lit set.)
    expect(
      experimental.hasPersonEntity,
      "experimental graph must contain person entities (D-10 precondition)",
    ).toBe(true);
    expect(
      control.hasPersonEntity,
      "control graph must contain person entities (same underlying data)",
    ).toBe(true);

    // ── Control-of-the-control: same graph data, verified not assumed ──
    expect(
      experimental.nodeCount,
      "experimental and control must show the SAME graph data (equal node count) " +
        `— got experimental=${experimental.nodeCount} control=${control.nodeCount}`,
    ).toBe(control.nodeCount);

    console.log(
      `[kg-lit-capture] SUMMARY experimental=${JSON.stringify(experimental)} ` +
        `control=${JSON.stringify(control)}`,
    );

    // ── Neutral, order-randomised copies for the observer ──────────────
    // Reproducible/recorded, not ad-hoc: the coin flip is generated with
    // Node's CSPRNG and written to mapping.json alongside a timestamp, so
    // the randomisation is auditable after the fact without having been
    // predictable beforehand.
    const experimentalFirst = randomInt(2) === 0;
    const image1Source = experimentalFirst ? experimental.screenshotPath : control.screenshotPath;
    const image2Source = experimentalFirst ? control.screenshotPath : experimental.screenshotPath;
    const image1Path = path.join(OUTPUT_DIR, "image-1.png");
    const image2Path = path.join(OUTPUT_DIR, "image-2.png");
    copyFileSync(image1Source, image1Path);
    copyFileSync(image2Source, image2Path);

    // ── De-correlate file size from condition ──────────────────────────
    // Found in review of the first 190-06 run: the experimental capture is
    // reliably LARGER than the control (the halo ring is extra rendered
    // content), so a plain copy leaves the condition→image mapping
    // recoverable from a directory listing alone — no file needs to be
    // opened. Pad both neutral copies to an IDENTICAL byte length by
    // appending random bytes after the PNG's own IEND chunk (every PNG
    // reader/renderer stops at IEND and ignores trailing bytes, so this
    // does not alter either image). Target size is the larger of the two
    // plus a random amount of extra jitter, so it isn't simply "whichever
    // one was smaller, topped up to match" — recorded in mapping.json.
    const size1 = statSync(image1Path).size;
    const size2 = statSync(image2Path).size;
    const paddedTargetSize = Math.max(size1, size2) + randomInt(2048, 8192);
    for (const p of [image1Path, image2Path]) {
      const buf = readFileSync(p);
      const pad = Buffer.alloc(paddedTargetSize - buf.length, 0);
      writeFileSync(p, Buffer.concat([buf, pad]));
    }

    const mapping = {
      generated_at: new Date().toISOString(),
      coin_flip_result: experimentalFirst ? "experimental-first" : "control-first",
      "image-1.png": experimentalFirst ? "experimental" : "control",
      "image-2.png": experimentalFirst ? "control" : "experimental",
      experimental_capture_time_path: path.resolve(experimental.screenshotPath),
      control_capture_time_path: path.resolve(control.screenshotPath),
      experimental_node_count: experimental.nodeCount,
      control_node_count: control.nodeCount,
      neutral_pair_padded_to_bytes: paddedTargetSize,
      note:
        "EXPERIMENTER-ONLY. Do not show this file or its contents to the observer. " +
        "Transcribe the mapping into 190-D10-RESULT.md only AFTER the observer has " +
        "answered for both images (190-D10-PROTOCOL.md §7).",
    };
    writeFileSync(path.join(OUTPUT_DIR, "mapping.json"), JSON.stringify(mapping, null, 2));

    console.log(
      `[kg-lit-capture] neutral pair written: ${path.resolve(image1Path)} ` +
        `${path.resolve(image2Path)} — mapping at ` +
        `${path.resolve(OUTPUT_DIR, "mapping.json")} (experimenter-only, not for the observer)`,
    );
  });
});
