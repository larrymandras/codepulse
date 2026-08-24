// 125-13 Task 1 — pre-arm baseline probe. READ-ONLY: arms nothing, disarms nothing.
//
// Records the Signal Horizon and Pulse ECG observables at t~10s and t~70s. D-17's
// evidence is the PAIR: the numeral is expected ABSENT early (the 60s live-WS window
// is not full yet, so countState === "loading") and PRESENT late. Either reading
// alone shows neither -- "absent" could just mean broken, and "present" could just
// mean it was never degraded.
//
// The three countState branches render distinguishable elements (PulseEcgHero.tsx:51-85):
//   ready       -> span[aria-label="N events in the trailing 60 seconds"], text-[40px]
//   loading     -> Skeleton[aria-label="Pulse count loading"]
//   unavailable -> italic text-[13px] label
import { chromium } from "playwright";

const BASE = process.env.PW_BASE_URL || "http://localhost:5181";

async function snap(page, label, t) {
  const attr = async (sel, name) =>
    (await page.locator(sel).first().count())
      ? await page.locator(sel).first().getAttribute(name)
      : "(absent)";

  const horizon = await attr("[data-horizon-state]", "data-horizon-state");
  const ecg = await attr("[data-ecg-state]", "data-ecg-state");
  const truncated = await attr("[data-backfill-truncated]", "data-backfill-truncated");

  const numeralEl = page.locator('[aria-label$="events in the trailing 60 seconds"]');
  const loadingEl = page.locator('[aria-label="Pulse count loading"]');

  let countState, numeral;
  if (await numeralEl.count()) {
    countState = "ready";
    numeral = (await numeralEl.first().textContent())?.trim() ?? "";
  } else if (await loadingEl.count()) {
    countState = "loading";
    numeral = "(skeleton — window not full)";
  } else {
    countState = "unavailable-or-missing";
    numeral = "(no numeral, no skeleton)";
  }

  console.log(`[${label} t~${t}s] horizon=${horizon}  ecg=${ecg}  truncated=${truncated}`);
  console.log(`[${label} t~${t}s] countState=${countState}  numeral=${numeral}`);
  return { horizon, ecg, countState, numeral };
}

const b = await chromium.launch({ headless: true });
const page = await b.newPage();
const t0 = Date.now();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

await page.waitForTimeout(Math.max(0, 10_000 - (Date.now() - t0)));
const early = await snap(page, "EARLY", Math.round((Date.now() - t0) / 1000));

console.log("\n… waiting past the 60s D-17 fill window …\n");
await page.waitForTimeout(Math.max(0, 70_000 - (Date.now() - t0)));
const late = await snap(page, "LATE ", Math.round((Date.now() - t0) / 1000));

console.log("\n=== D-17 PAIR (the required before/after) ===");
console.log(`countState  early=${early.countState}  late=${late.countState}`);
console.log(`numeral     early=${early.numeral}  late=${late.numeral}`);
console.log(`DEGRADED STATE ENTERED THEN LEFT: ${early.countState === "loading" && late.countState === "ready"}`);
console.log(`horizon     early=${early.horizon}  late=${late.horizon}  (calm baseline = resting)`);

await b.close();
