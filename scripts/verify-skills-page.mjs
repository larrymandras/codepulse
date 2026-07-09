/**
 * Drive the real SPA and assert the Skills page changes are live.
 * Requires a dev server with Clerk disabled:
 *   VITE_CLERK_PUBLISHABLE_KEY= npx vite --port 5175 --strictPort
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5175";
const OUT = process.env.OUT ?? ".";

const consoleErrors = [];
const pageErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 180)));
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 180)));

// A fresh profile shows the 4-step onboarding tour (a z-50 overlay that swallows every
// click). It is gated by this localStorage flag; seed it before the app boots.
await page.addInitScript(() => localStorage.setItem("codepulse_onboarding_complete", "true"));

await page.goto(`${BASE}/skills`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("h1", { timeout: 30000 });
await page.waitForTimeout(6000); // Convex live queries

const fail = [];
const ok = (cond, label, extra = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!cond) fail.push(label);
};

// NB: the dashboard layout renders its own <h1>CodePulse</h1>; scope to the page heading.
const pageHeading = page.locator("h1", { hasText: /skills database/i });
ok((await pageHeading.count()) > 0, "Skills Database heading renders");

const options = await page.locator('select[aria-label="Filter by origin"] option').allTextContents();
console.log(`\n  origin options (${options.length}): ${JSON.stringify(options)}`);
const dupes = options.filter((o, i) => options.indexOf(o) !== i);
ok(dupes.length === 0, "no duplicate origin labels", dupes.length ? JSON.stringify(dupes) : "");
ok(options.some((o) => /dormant/i.test(o)), "Dormant (cold storage) origin present");
const projects = options.filter((o) => /^Project/.test(o));
ok(projects.length === 0 || projects.every((p) => p.includes("·")), "project origins are named", JSON.stringify(projects));

const pillSection = page.locator('section[aria-label="Most used skills"]');
const pillCount = await pillSection.locator("button").count();
console.log(`\n  most-used pills: ${pillCount}`);
if (pillCount) {
  const labels = await pillSection.locator("button").allTextContents();
  console.log(`   ${JSON.stringify(labels.slice(0, 8))}`);
  ok(labels.every((l) => l.trim().startsWith("/")), "pills render an invocation");
} else {
  // Honest: an empty pill row is correct when nothing has been launched from this page.
  console.log("   (no skill has useCount > 0 yet — the row hides itself by design)");
}

ok((await page.locator("div.fixed.inset-0.z-50").count()) === 0, "no modal overlay blocking the page");

const bannerCount = await page.locator("text=/auto-categorized/i").count();
console.log(`\n  new-skills banner present: ${bannerCount > 0}`);
if (bannerCount) {
  // The sidebar's "Review" category is a div[role=button]; the banner's is a real
  // <button> reading "[ Review ]". Target the element, not the role.
  await page.locator("button").filter({ hasText: /^\[\s*Review\s*\]$/i }).first().click({ timeout: 10000 });
  await page.waitForTimeout(900);
  const drawer = page.locator('[role="dialog"][aria-label="Review auto-categorized skills"]');
  const opened = (await drawer.count()) > 0;
  ok(opened, "[REVIEW] opens the drawer (was a no-op)");
  if (opened) {
    const rows = await drawer.locator("li").count();
    console.log(`   drawer lists ${rows} pending skills`);
    await page.screenshot({ path: `${OUT}/skills-review-drawer.png` });
    await drawer.getByRole("button", { name: /^close$/i }).click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

await page.screenshot({ path: `${OUT}/skills-page.png` });

console.log(`\n  console errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 6).forEach((e) => console.log(`     ${e}`));
console.log(`  page errors: ${pageErrors.length}`);
pageErrors.slice(0, 6).forEach((e) => console.log(`     ${e}`));
ok(pageErrors.length === 0, "no uncaught page errors");

await browser.close();
console.log(`\n  ${fail.length === 0 ? "ALL CHECKS PASSED" : `FAILED: ${JSON.stringify(fail)}`}`);
process.exit(fail.length === 0 ? 0 : 1);
