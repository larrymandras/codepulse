#!/usr/bin/env node
// CodePulse Connection Tester
// Tests connectivity to all CodePulse endpoints.
// Usage: node hooks/test-connection.mjs

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}\u2713${RESET}`;
const FAIL = `${RED}\u2717${RESET}`;

/**
 * Resolve the CodePulse site URL (same logic as codepulse-hook.mjs).
 */
function resolveUrl() {
  if (process.env.CODEPULSE_URL) return process.env.CODEPULSE_URL;

  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const siteMatch = envContent.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
      if (siteMatch) return siteMatch[1].trim();
      const viteMatch = envContent.match(/^VITE_CONVEX_URL\s*=\s*(.+)$/m);
      if (viteMatch) return viteMatch[1].trim().replace(".convex.cloud", ".convex.site");
    } catch {
      // ignore
    }
  }

  return "https://ideal-sandpiper-297.convex.site";
}

async function testEndpoint(name, url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const status = resp.status;
    let responseText = "";
    try {
      responseText = await resp.text();
    } catch {
      responseText = "(could not read response body)";
    }

    if (resp.ok) {
      console.log(`  ${PASS} ${BOLD}${name}${RESET}  ${GREEN}${status}${RESET}`);
      if (responseText) {
        // Truncate long responses
        const preview = responseText.length > 120 ? responseText.slice(0, 120) + "..." : responseText;
        console.log(`     Response: ${preview}`);
      }
      return true;
    } else {
      console.log(`  ${FAIL} ${BOLD}${name}${RESET}  ${RED}${status}${RESET}`);
      if (responseText) {
        const preview = responseText.length > 200 ? responseText.slice(0, 200) + "..." : responseText;
        console.log(`     ${RED}Response: ${preview}${RESET}`);
      }
      return false;
    }
  } catch (err) {
    const msg = err.name === "AbortError" ? "Timeout (5s)" : err.message;
    console.log(`  ${FAIL} ${BOLD}${name}${RESET}  ${RED}${msg}${RESET}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const url = resolveUrl();
  const now = Math.floor(Date.now() / 1000);

  console.log(`\n${BOLD}CodePulse Connection Test${RESET}`);
  console.log(`${"=".repeat(40)}`);
  console.log(`${YELLOW}URL:${RESET} ${url}\n`);

  const results = [];

  // Test 1: /ingest
  results.push(
    await testEndpoint("POST /ingest", `${url}/ingest`, {
      sessionId: "test-connection",
      eventType: "test",
      toolName: "test-connection",
      timestamp: now,
    })
  );

  // Test 2: /runtime-ingest
  results.push(
    await testEndpoint("POST /runtime-ingest", `${url}/runtime-ingest`, {
      eventType: "llm_call",
      provider: "test",
      model: "test",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      timestamp: now,
    })
  );

  // Test 3: /scan
  results.push(
    await testEndpoint("POST /scan", `${url}/scan`, {
      sessionId: "test-connection",
      scannedAt: now,
      mcpServers: [],
      hooks: [],
      plugins: [],
      skills: [],
    })
  );

  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${"=".repeat(40)}`);

  if (passed === total) {
    console.log(`${GREEN}${BOLD}All ${total} endpoints OK${RESET}\n`);
  } else {
    console.log(`${RED}${BOLD}${passed}/${total} endpoints passed${RESET}`);
    console.log(`${YELLOW}Check the CodePulse Convex deployment and ensure HTTP actions are deployed.${RESET}\n`);
  }
}

main();
