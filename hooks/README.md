# CodePulse Hooks

Claude Code hook scripts that forward session events to CodePulse for observability and analytics.

## Prerequisites

- **Node.js 18+** (for native `fetch` support)
- A running CodePulse Convex deployment

## Quick Install

Run the installer, pointing it at the project you want to instrument:

```bash
node hooks/install.mjs /path/to/your/project
```

This merges `PreToolUse`, `PostToolUse`, and `SessionStart` hook entries into the target project's `.claude/settings.json`.

If no path is given, the current working directory is used.

## Manual Setup

Add the following to your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "command": "node /absolute/path/to/codepulse/hooks/codepulse-hook.mjs" }
    ],
    "PostToolUse": [
      { "command": "node /absolute/path/to/codepulse/hooks/codepulse-hook.mjs" }
    ],
    "SessionStart": [
      { "command": "node /absolute/path/to/codepulse/hooks/codepulse-hook.mjs" }
    ]
  }
}
```

Replace `/absolute/path/to/codepulse/` with the actual path to your CodePulse checkout.

## Verify

Test that hooks can reach the CodePulse backend:

```bash
node hooks/test-connection.mjs
```

This sends test payloads to `/ingest`, `/runtime-ingest`, and `/scan` and reports pass/fail for each.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `CODEPULSE_URL` | CodePulse Convex site URL (HTTP actions) | Auto-detected from `.env.local` or falls back to `https://ideal-sandpiper-297.convex.site` |

The URL resolution order is:

1. `CODEPULSE_URL` environment variable
2. `CONVEX_SITE_URL` from `codepulse/.env.local`
3. `VITE_CONVEX_URL` from `codepulse/.env.local` (with `.cloud` swapped to `.site`)
4. Hardcoded fallback

## Files

| File | Purpose |
|---|---|
| `codepulse-hook.mjs` | Main entry point for all hook events. Reads stdin JSON, POSTs to `/ingest`, triggers scanner on `SessionStart`. |
| `scanner.mjs` | Environment scanner. Discovers MCP servers, hooks, agents, plugins from `.claude/settings.json`. Exports `runScan()`. |
| `install.mjs` | CLI installer. Merges hook entries into a target project's `.claude/settings.json`. |
| `test-connection.mjs` | Connectivity test. Verifies all CodePulse endpoints are reachable. |

## Troubleshooting

**Hooks not firing**
- Confirm `.claude/settings.json` exists in your project root and contains the hook entries.
- Run `node hooks/test-connection.mjs` to check connectivity.

**Fetch errors / timeouts**
- Hooks use a 3-second timeout. If your network is slow, events may be dropped silently.
- Verify `CODEPULSE_URL` points to the correct Convex site URL (not the `.cloud` URL).

**"Cannot find module" errors**
- Ensure the hook command uses an absolute path to `codepulse-hook.mjs`.
- Re-run `node hooks/install.mjs` to regenerate the settings.

**Events not appearing in the dashboard**
- Check that the Convex deployment has the `/ingest` and `/scan` HTTP actions deployed.
- Look at the Convex dashboard logs for errors.

**Hooks blocking Claude Code**
- All hook scripts exit with code 0 regardless of errors. If Claude Code stalls, the issue is elsewhere.
