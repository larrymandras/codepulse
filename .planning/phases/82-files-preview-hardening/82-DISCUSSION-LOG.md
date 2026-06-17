# Phase 82: Files + Artifact Preview + Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 82-files-preview-hardening
**Areas discussed:** Byte delivery, Byte storage mechanism, Enumeration scope, Read auth + local-path affordance

> Requirements were locked upstream by `82-SPEC.md` (12 reqs). Discussion was HOW-only.

---

## Byte delivery (eager vs lazy)

| Option | Description | Selected |
|--------|-------------|----------|
| Eager push at terminal state | Daemon pushes listing + previewable bytes (within caps) in one shot on job completion; no request path | ✓ |
| Lazy on-demand | Daemon pushes listing only; cloud enqueues a fetch via forgeCommands when a file is opened; daemon uploads just that file | |

**User's choice:** Eager push at terminal state.
**Notes:** No new request path / no command-bridge round-trip; matches the "files appear after terminal state" timing; bounded by per-file + per-job caps + retention. (D-01)

---

## Byte storage mechanism (Convex)

| Option | Description | Selected |
|--------|-------------|----------|
| Docs only; images via File Storage | Text/HTML as plain string in a forgeArtifacts doc; images via Convex File Storage (storageId → getUrl → `<img>`) | ✓ |
| Docs only; image cap ~700KB | All in docs; images base64 (raw ≤ ~700KB to stay under the doc-value limit after 33% base64 overhead) | |
| All via File Storage | Both text and images via File Storage; UI fetches by URL | |

**User's choice:** Docs only; images via File Storage.
**Notes:** Avoids the base64-over-1MB-doc-limit wrinkle; true ≤1 MB for both kinds. Flagged tradeoff (D-02a): Convex File Storage URLs are unauthenticated (unguessable) — accepted for image bytes behind the AuthGuard'd UI; researcher to confirm URL access semantics for the FI-14 security audit. Retention must `ctx.storage.delete` blobs (D-05).

---

## Enumeration scope

| Option | Description | Selected |
|--------|-------------|----------|
| Workspace tree, recursive + ignores | List all workspace files recursively (relative paths) with ignore rules (.git/node_modules/build) + file-count cap; full FileBrowser parity | ✓ |
| Job outputs / artifacts only | List only promoted artifacts (drives artifactCount); smaller payload | |

**User's choice:** Workspace tree, recursive + ignores + count cap.
**Notes:** Full file-browser parity with Forge web. Bytes pushed only for previewable ≤cap files; most files are metadata-only rows. Ignore list + count cap set at plan time. (D-03)

---

## Read auth + local-path affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Public graceful-skip + always-show path | Reads stay public graceful-skip (like listJobLogs); always render local rootPath + best-effort "Open in VS Code" link | ✓ |
| Gate reads behind Clerk | Make file/artifact read queries Clerk fail-closed (diverges from existing Forge read model) | |

**User's choice:** Public graceful-skip + always-show path.
**Notes:** Consistent with listJobs/listJobLogs; `/forge` is already behind AuthGuard, ingest write path is bearer-authed, control mutations are Clerk fail-closed. Fallback affordance always shown, labeled best-effort (same-machine only). (D-04 / D-04a)

---

## Claude's Discretion

- Exact per-file byte cap, per-job total-byte/file-count caps, ignore-rule list, sweep cadence, `listJobFiles` take-limit.
- File-kind classifier on the daemon side (reuse Forge web classifier).
- Ingest envelope/message shape (mirror forge-log-ingest).
- Deploy-checklist doc location/format (OPS-01).

## Deferred Ideas

- Inline cloud preview of video/audio/PDF/binary (download fallback for now).
- Chunked large-artifact (>1 MB) preview/reassembly (rejected for MVP).
- Live mid-run file updates (terminal-state-only for now).
- Lazy on-demand byte fetch via command queue (not needed under eager push).
- Full folder-navigation chrome in FileBrowser (flat recursive listing covers MVP).
