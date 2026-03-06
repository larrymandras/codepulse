#!/usr/bin/env node
// CodePulse Hook Installer
// Installs Claude Code hook entries in a target project's .claude/settings.json
// Usage: node hooks/install.mjs [target-project-path]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hookScript = resolve(join(__dirname, "codepulse-hook.mjs"));

// The hook types we need to register
const HOOK_TYPES = ["PreToolUse", "PostToolUse", "SessionStart"];

function main() {
  const targetDir = resolve(process.argv[2] || process.cwd());
  const claudeDir = join(targetDir, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  console.log("CodePulse Hook Installer");
  console.log("========================\n");
  console.log(`Target project : ${targetDir}`);
  console.log(`Hook script    : ${hookScript}\n`);

  // Ensure .claude directory exists
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
    console.log(`Created ${claudeDir}`);
  }

  // Read existing settings or start fresh
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      console.log("Found existing .claude/settings.json");
    } catch {
      console.log("Warning: Could not parse existing settings.json, starting fresh");
      settings = {};
    }
  } else {
    console.log("No existing .claude/settings.json, creating new one");
  }

  // Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Build the command string
  const command = `node ${hookScript}`;

  let addedCount = 0;

  for (const hookType of HOOK_TYPES) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = [];
    }

    // Normalize: settings.hooks[hookType] can be an array of objects or strings
    // Claude Code hook format: array of { matcher, command } or just command strings
    const entries = settings.hooks[hookType];
    const isArray = Array.isArray(entries);

    if (!isArray) {
      // Convert to array if it's a single entry
      settings.hooks[hookType] = [entries];
    }

    // Check if already installed
    const alreadyInstalled = settings.hooks[hookType].some(entry => {
      if (typeof entry === "string") return entry.includes("codepulse-hook.mjs");
      if (typeof entry === "object" && entry.command) return entry.command.includes("codepulse-hook.mjs");
      return false;
    });

    if (alreadyInstalled) {
      console.log(`  [skip] ${hookType} — already installed`);
      continue;
    }

    // Add the hook entry (using the object format with no matcher = match everything)
    settings.hooks[hookType].push({
      command,
    });

    console.log(`  [add]  ${hookType} — added`);
    addedCount++;
  }

  // Write settings back
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${settingsPath}`);

  if (addedCount === 0) {
    console.log("\nAll hooks were already installed. No changes made.");
  } else {
    console.log(`\nInstalled ${addedCount} hook(s) successfully.`);
  }

  // Check for CODEPULSE_URL
  if (!process.env.CODEPULSE_URL) {
    console.log("\nNote: CODEPULSE_URL environment variable is not set.");
    console.log("The hook will fall back to reading .env.local or using the default URL.");
    console.log("To set it explicitly, add to your shell profile:");
    console.log(`  export CODEPULSE_URL="https://ideal-sandpiper-297.convex.site"`);
  }

  console.log("\nVerify with: node hooks/test-connection.mjs");
}

main();
