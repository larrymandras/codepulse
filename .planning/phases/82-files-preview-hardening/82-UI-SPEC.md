---
phase: 82
slug: files-preview-hardening
status: draft
shadcn_initialized: true
preset: "new-york / neutral / dark Matrix Emerald (inherited Phase 71)"
created: 2026-06-17
---

# Phase 82 — UI Design Contract
# Files + Artifact Preview + Hardening

> Visual and interaction contract for the new Files surface in the CodePulse /forge UI.
> This phase is a PORT + RE-SKIN, not greenfield. The design system is ESTABLISHED (Phase 71).
> All palette, typography, spacing, radius, and icon choices below are inherited unless
> explicitly marked [NEW DECISION].

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui New York | components.json — style: "new-york" |
| Preset | Phase 71 established — no re-init required | components.json exists; npx shadcn info confirmed |
| Component library | Radix UI (via shadcn/ui), 30 primitives in src/components/ui/ | Phase 71 UI-SPEC |
| Icon library | Lucide (lucide-react ^1.8.0) — EXCLUSIVELY | components.json iconLibrary: "lucide" |
| Body font | Geist — `var(--font-geist)` | src/index.css:9, index.html:12 |
| Code/mono font | JetBrains Mono — `var(--font-mono)` | src/index.css:10 |
| Heading font | Geist via `var(--font-heading)` (Cinzel retired Phase 71) | Phase 71 UI-SPEC §7 |
| Theme | Dark Matrix Emerald cyberpunk, `<html class="dark">` — never light mode for new surfaces | index.html:2 |
| Radius | `--radius: 0.5rem` effective (corrected Phase 71) | Phase 71 UI-SPEC §7 Q1 |

Registry: shadcn official only. No third-party registries declared. Vetting gate: not applicable.

---

## Spacing Scale

Inherited from Phase 71 de-facto rhythm. No new scale defined; the values below are the
established CodePulse spacings confirmed from live components.

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Icon-to-label gap in file rows (gap-1) |
| sm | 8px | Toggle bar padding, row icon gap (gap-2) |
| md | 16px | File row horizontal padding, preview pane padding (px-4 / p-4) |
| lg | 24px | Tab body top spacing, empty state vertical pad (py-6) |
| xl | 32px | Empty state center-padding (py-8) |
| 2xl | 48px | — (not used in this surface) |
| 3xl | 64px | — (not used in this surface) |

Exceptions:
- File row height: 44px (touch target minimum, matches Forge source FileBrowser.tsx:100).
  This is intentional and carries over from the Forge port — do not reduce.
- Toggle bar (Preview/Source): 8px vertical padding (`py-2`) above the content border.

---

## Typography

Inherited from Phase 71 type scale. All values confirmed from ForgeMetadataPanel.tsx,
ForgeLogPane.tsx, and Phase 71 UI-SPEC §2.7.

| Role | Size | Weight | Line Height | Font | Usage |
|------|------|--------|-------------|------|-------|
| File tab label | 12px (text-xs) | 500 (font-medium) | 1.5 | Geist | "Details" / "Logs" / "Files" tab buttons — matches existing ForgeJobDetail.tsx:158 |
| File row filename | 14px (text-sm) | 400 (font-normal) | 1.5 | Geist | Filename text node in each file row |
| Kind group header | 10px (text-[10px]) | 600 (font-semibold) | 1.5 | JetBrains Mono | "TEXT" / "IMAGES" / "VIDEO" / "AUDIO" / "PDF" / "BINARY" section headers — uppercase tracking-widest |
| Metadata label | 10px (text-[10px]) | 400 (font-normal) | 1.5 | JetBrains Mono | Size annotation (e.g. "1.2 MB") and VS Code link label |
| Source pre | 13px (text-[13px]) | 400 (font-normal) | 1.538 | JetBrains Mono | `<pre>` source view, matches Forge ArtifactPreview.tsx:155 |
| Empty/state copy | 14px (text-sm) | 400 (font-normal) | 1.5 | Geist | Loading, empty, error state copy |
| Not-previewable fallback | 13px (text-[13px]) | 400 (font-normal) | 1.5 | Geist | Fallback card message + local path |

Note: Only 2 font weights are introduced in new surfaces: 400 (regular) and 600 (semibold).
Medium (500) appears only on tab labels to match the existing tab strip — no new weight.

---

## Color

All values from Phase 71 UI-SPEC §2 and src/index.css. Dark theme tokens apply; no new palette entries.

| Role | Token / Value | Usage |
|------|---------------|-------|
| Dominant (60%) — deep background | `--background` / `#09090b` (zinc-950) | Log pane bg (`bg-background`), pre source bg (`#0F1117` equiv) |
| Secondary (30%) — card / panel surfaces | `--card` / `#141416` | FileBrowser panel bg, kind-group header bg, toggle bar bg |
| Muted surface — row separators | `--border` / `#27272a` | Row border-b (`border-b border-border`), kind group Separator |
| Accent (10%) — Matrix Emerald | `--primary` / `#10b981` | Active tab border-b (`border-emerald-500`), selected file row left indicator |
| Muted foreground | `--muted-foreground` / `#a1a1aa` | Kind group header text, size annotation, empty state copy |
| Foreground | `--foreground` / `#ffffff` | Filename text, source pre text |
| Info / VS Code link | `--info` (proposed token) / `#3b82f6` | "Open in VS Code" link color — matches Phase 71 §2.3 info token; use `text-blue-500` until `--info` token is live |
| Destructive | `--destructive` / `oklch(0.704 0.191 22.216)` | Not used in this surface (no destructive actions) |

Accent (`#10b981`) reserved for:
- Active tab bottom border indicator in the Files tab strip
- Selected file row: left 2px border or subtle `bg-accent/50` background on hover + focus

No new accent usage is introduced beyond this list. The "Open in VS Code" deep link uses blue (`#3b82f6` / `--info`) to semantically distinguish it as an external link, consistent with Forge FileBrowser.tsx:141.

---

## Files Tab Integration [NEW DECISION]

### Tab label and icon
- Label: **"Files"**
- Lucide icon: **`FolderOpen`** (import `{ FolderOpen } from "lucide-react"`)
- Rationale: `FolderOpen` is not in the nav iconComponents map (confirmed grep), not in any
  Forge component, and clearly communicates file browsing. `Files` and `FileText` were
  considered; `FolderOpen` better signals a browsable collection vs. a single file.
- Icon size: `h-4 w-4` (16px), rendered inline-left of the tab label, `aria-hidden="true"`.
- Tab labels in this phase optionally show icons — match the existing Details/Logs tab strip
  which is text-only (ForgeJobDetail.tsx:157-173). **Start text-only for consistency; icon
  is available if the tab strip is ever upgraded uniformly.**

### Tab strip extension (three-state)
Extend the existing `DetailTab` union from `"details" | "logs"` to `"details" | "logs" | "files"`.
Default tab: `"details"` — PRESERVED, no change in default behavior (SPEC Req 6).

```
type DetailTab = "details" | "logs" | "files";
```

Tab strip markup pattern (extends ForgeJobDetail.tsx:153-174 verbatim):
```tsx
<button
  onClick={() => setActiveTab("files")}
  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
    activeTab === "files"
      ? "border-emerald-500 text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`}
>
  Files
</button>
```

Active state: `border-b-2 border-emerald-500 text-foreground`
Inactive state: `border-b-2 border-transparent text-muted-foreground hover:text-foreground`
Transition: `transition-colors` (200ms, matches existing tabs)

### Tab body mounting
```tsx
{activeTab === "files" && (
  <SectionErrorBoundary name="Files">
    <ForgeFilesPane hostId={job.hostId} forgeJobId={job.id} jobStatus={job.status} workspace={job.workspace} />
  </SectionErrorBoundary>
)}
```

---

## Layout — Files Tab Body [NEW DECISION]

### Master-detail vs. stacked

Decision: **Vertical stack** (browser top / preview bottom) within the Files tab body,
not a horizontal split.

Rationale: `ForgeJobDetail` is already a narrow right-panel column in the master-detail
`ForgePage` layout. A horizontal split within that column would produce two very narrow
panes. A vertical stack (browser list ~200px min-height at top, preview pane fills
remaining height) matches the available geometry and avoids cramped horizontal scrolling.

```
┌─────────────────────────────────┐
│  Details  |  Logs  |  Files     │  ← tab strip (shrink-0)
├─────────────────────────────────┤
│  FileBrowser (kind-grouped      │  ← min-h: 160px; overflow-y-auto;
│  file list, scrollable)         │    flex-shrink: 0 OR flex: 0 0 auto
│  ~200px fixed height            │    up to ~40% of panel height
├─────────────────────────────────┤
│  ArtifactPreview (preview pane) │  ← flex: 1; overflow: hidden
│  (fills remaining height)       │
└─────────────────────────────────┘
```

When no file is selected: the preview pane shows the no-selection copy (see Copywriting
section). The FileBrowser occupies the top portion regardless.

At narrow heights (< 400px total): FileBrowser collapses to min-h: 120px; preview pane
min-h: 120px; both independently scrollable.

### ForgeFilesPane wrapper component

New component: `src/components/forge/ForgeFilesPane.tsx`

```tsx
interface ForgeFilesPaneProps {
  hostId: string;
  forgeJobId: string;
  jobStatus: JobStatus;            // gates empty-state vs. file listing
  workspace: { rootPath: string }; // for VS Code deep links
}
```

Internal layout:
```tsx
<div className="flex flex-col h-full overflow-hidden">
  <div className="flex-none min-h-[160px] max-h-[40%] overflow-y-auto border-b border-border">
    <FileBrowser ... />
  </div>
  <div className="flex-1 overflow-hidden">
    <ArtifactPreview ... />
  </div>
</div>
```

---

## FileBrowser Component Contract

### Source
Port from `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx`.
Re-skin from inline CSS styles to CodePulse Tailwind tokens.

### Kind-group ordering (locked from SPEC Req 4 + Forge source)
`text → image → video → audio → pdf → binary`

Group headers: uppercase, `font-mono`, `tracking-widest`, `text-[10px]`, `text-muted-foreground`,
`bg-card` surface. Matches `ForgeMetadataPanel` GroupDivider pattern (`text-[10px] font-mono uppercase tracking-widest text-muted-foreground`).

### Per-row layout
Each file row: `flex items-center h-11 px-4 gap-2 cursor-pointer border-b border-border hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none transition-colors`

Row structure (left to right):
1. Filename text node — `text-sm text-foreground truncate flex-1` — rendered as React text node, never HTML
2. Size annotation — `text-[10px] font-mono text-muted-foreground flex-shrink-0` — e.g. "1.2 MB", "48 KB", "< 1 KB"
3. "Open in VS Code" link (text files only) — `text-[12px] text-blue-500 flex-shrink-0 inline-flex items-center gap-1` — uses `ExternalLink` Lucide icon at `h-3 w-3`

Selected row: `bg-accent/50 border-l-2 border-l-primary` (left emerald indicator, 2px)

### Folder navigation
The CodePulse port does NOT need `onNavigate` / drill-down folder UI — out of scope per SPEC
boundaries ("flat recursive listing with relative paths covers MVP"). Pass `onNavigate={undefined}`;
the `dirs` branch in the source will be suppressed automatically.

File paths are shown as relative-path text nodes (e.g. "output/report.html"). Long paths
truncate with `text-overflow: ellipsis` (Tailwind: `truncate`).

### Separator / group header
Use `<Separator />` from `src/components/ui/separator` between kind groups (already in
`src/components/ui/` — confirmed by components.json; no new install required).

### Scroll
`<ScrollArea>` from `src/components/ui/scroll-area` wraps the full list. Emerald custom
scrollbar inherits from `src/index.css` global scrollbar styles — no new CSS needed.

---

## ArtifactPreview Component Contract

### Source
Port from `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx`.
Adapt: remove `buildArtifactUrl` / `artifactPort` / `getForgeConfig()` dependency.
Replace with Convex-sourced content passed as props.

### New prop interface (CodePulse version)
```tsx
interface ArtifactPreviewProps {
  /** Content string for text/code/HTML artifacts (from forgeArtifacts Convex doc). */
  textContent?: string;
  /** Convex File Storage URL for image artifacts (from ctx.storage.getUrl). */
  imageUrl?: string;
  /** Kind tag — drives which renderer is used. */
  fileKind: FileKind;
  /** File size in bytes — used in the not-previewable fallback copy. */
  sizeBytes: number;
  /** Workspace rootPath — for the local-path fallback text + VS Code link. */
  rootPath: string;
  /** Relative file path within the workspace — for VS Code deep link. */
  filePath: string;
  /** Default view mode for text/HTML. Defaults to 'preview'. */
  defaultMode?: 'preview' | 'source';
}
```

### Renderers by kind + size

| Condition | Renderer |
|-----------|----------|
| `kind === 'text'` AND `sizeBytes <= 1_048_576` AND `textContent` present | Sandboxed iframe (Preview) + `<pre>` source (Source) — toggle |
| `kind === 'image'` AND `sizeBytes <= 1_048_576` AND `imageUrl` present | `<img src={imageUrl} alt={filePath} />` |
| `sizeBytes > 1_048_576` OR `kind` is `video`/`audio`/`pdf`/`binary` OR content absent | Not-previewable fallback card |
| No file selected | No-selection placeholder |

### Preview/Source toggle (text/HTML)

Control: Two `<Button>` primitives from `src/components/ui/button` (shadcn).
- `variant="default"` on active mode (emerald-filled)
- `variant="outline"` on inactive mode

Toggle bar: `flex gap-1 px-4 py-2 border-b border-border bg-card shrink-0`

Default mode: `'preview'` (iframe loads immediately).

SECURITY INVARIANT (carry verbatim):
- iframe `sandbox="allow-scripts"` — MUST NOT include `allow-same-origin` (ever)
- Source view: `<pre>{textContent}</pre>` — React text node only, NEVER `innerHTML` / `dangerouslySetInnerHTML`
- iframe `src`: use a `data:` URI constructed from the `textContent` string:
  `src={\`data:text/html;charset=utf-8,${encodeURIComponent(textContent)}\`}`
  This replaces the Forge `http://127.0.0.1:...` URL (which cannot reach the cloud).
  The `data:` origin is opaque (null) — sandbox invariant is preserved.

iframe style: `width: 100%; height: 100%; border: none; min-height: 240px`
No `allow-same-origin`, no `allow-forms`, no `allow-popups` beyond `allow-scripts`.

### Source view (`<pre>`)
```
font-family: var(--font-mono) /* JetBrains Mono */
font-size: 13px
line-height: 1.538
color: var(--foreground)
background: var(--background)
padding: 16px
overflow: auto
height: 100%
white-space: pre-wrap
```
Text rendered as React child `{textContent}` — auto-escaped, no innerHTML.

### Image inline (`<img>`)
```tsx
<div className="p-4 flex items-center justify-center h-full">
  <img
    src={imageUrl}
    alt={filePath}
    className="max-w-full max-h-full object-contain"
    style={{ maxHeight: '80vh' }}
  />
</div>
```
Note: `imageUrl` is a Convex File Storage URL (unauthenticated, unguessable). This is
acceptable per D-02a — confirmed in context. The URL is served from Convex infrastructure,
not a third-party origin. No auth header is set (image tags cannot carry auth headers).

### Not-previewable fallback card

Condition: `sizeBytes > 1_048_576` OR `kind` in `{ video, audio, pdf, binary }` OR no content.

Layout: `flex flex-col gap-3 p-4`

Content:
```
<p class="text-sm text-muted-foreground">
  Not previewable in cloud ({formattedSize} / {kind})
</p>
<p class="text-[12px] font-mono text-muted-foreground break-all">
  Local path: {rootPath}/{filePath}
</p>
<a
  href={vsCodeHref}
  class="inline-flex items-center gap-1 text-[12px] text-blue-500"
  title="Best-effort — same machine only"
>
  Open in VS Code <ExternalLink class="h-3 w-3" aria-hidden />
</a>
<p class="text-[10px] text-muted-foreground">
  VS Code link is best-effort (same machine only)
</p>
```

Size formatting: `formatFileSize(sizeBytes)` — e.g. "< 1 KB", "48 KB", "1.2 MB". Use 1 decimal for MB, integer for KB. Under 1024 bytes: "< 1 KB".

VS Code deep link: `vscode://file/${rootPath}/${filePath}`
- `rootPath` is the workspace absolute path from the `forgeWorkspaces` record (Windows path accepted by VS Code URI handler as-is per Forge FileBrowser.tsx:74).
- Labeled clearly as best-effort / same-machine only (see copy above).

### No-file-selected placeholder

When `filePath` is empty / no file selected:
```tsx
<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
  Select a file to preview
</div>
```

---

## Empty / Loading / Error States (Req 11)

### State matrix

| State | Trigger | Component | Copy |
|-------|---------|-----------|------|
| Running job (terminal gate) | `jobStatus === "running"` (non-terminal) | `ForgeFilesPane` early return | See "Running job" copy below |
| Loading | `listJobFiles` query returns `undefined` | `ForgeFilesPane` | See "Loading" copy below |
| Zero files (terminal) | Query resolved, `files.length === 0` | `FileBrowser` empty state | See "Zero files" copy below |
| No file selected | File list shown, no row selected | `ArtifactPreview` | "Select a file to preview" |
| Preview failure | `textContent` missing for text file | `ArtifactPreview` | See "Preview failure" copy below |
| Surface error | Uncaught render error | `SectionErrorBoundary name="Files"` | Generic SectionErrorBoundary UI |

### Loading state
Display a subtle spinner or skeleton — do NOT use the word "Loading" as a heading.

```tsx
<div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
  Loading files…
</div>
```

`Loader2` from `lucide-react` (already imported in other Forge components — zero new dep).

### Running job empty state

```tsx
<div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
  <p className="text-sm text-muted-foreground">
    Files appear after the job completes.
  </p>
</div>
```

No icon needed — keep it minimal. This copy mirrors the Forge FileBrowser source
("Files appear here after the job completes") with cloud-neutral phrasing.

### Zero-files empty state (terminal job, no files ingested)

```tsx
<div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
  <p className="text-sm text-muted-foreground">No files found for this job.</p>
</div>
```

### Preview failure (text file selected, textContent absent)

```tsx
<div className="flex flex-col gap-2 p-4">
  <p className="text-sm text-muted-foreground">Preview unavailable.</p>
  <p className="text-[12px] font-mono text-muted-foreground break-all">
    Local path: {rootPath}/{filePath}
  </p>
</div>
```

### SectionErrorBoundary wrap

The entire Files tab body (FileBrowser + ArtifactPreview) MUST be wrapped in
`<SectionErrorBoundary name="Files">`. A render failure in either sub-component
must not cascade to Details or Logs tabs (Req 11). Import from `src/components/SectionErrorBoundary`.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Tab label | Files |
| Running job — empty state | "Files appear after the job completes." |
| Zero files — empty state | "No files found for this job." |
| Loading state | "Loading files…" |
| No file selected — preview pane | "Select a file to preview" |
| Not previewable — primary line | "Not previewable in cloud ({size} / {kind})" |
| Not previewable — local path label | "Local path: {rootPath}/{filePath}" |
| Not previewable — VS Code link label | "Open in VS Code" |
| Not previewable — VS Code disclaimer | "VS Code link is best-effort (same machine only)" |
| Preview unavailable — fallback | "Preview unavailable." |
| Preview toggle — Preview mode | "Preview" |
| Preview toggle — Source mode | "Source" |
| No job selected (inherited) | "Select a job to view details" (unchanged ForgeJobDetail.tsx:90) |

### Destructive actions
None. This surface is read-only (SPEC boundary: no editing, writing, or deleting files).
No confirmation dialogs required.

---

## Accessibility Contract

### Keyboard navigation
- File rows are `role="listitem"` within a `role="list"` container (matches Forge source).
- Each row is focusable (`tabIndex={0}`) and activates on `Enter` / `Space`.
- Focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` (emerald, consistent with shadcn ring token).
- Tab order: FileBrowser rows → Preview/Source toggle buttons → VS Code link.

### Preview/Source toggle
- Each `<Button>` carries `aria-pressed={mode === 'preview'}` / `aria-pressed={mode === 'source'}` (boolean).
- Toggle bar `role="group"` with `aria-label="Preview mode"`.

### iframe
- `title="Artifact preview"` attribute on the sandboxed iframe (screen reader context).
- iframe does NOT receive keyboard focus by default — if the user tabs into it, the null-origin sandbox limits what is reachable.

### Contrast
- `text-foreground` (`#ffffff`) on `bg-background` (`#09090b`) — contrast ratio ~21:1. WCAG AAA.
- `text-muted-foreground` (`#a1a1aa`) on `bg-card` (`#141416`) — contrast ratio ~5.5:1. WCAG AA.
- `text-blue-500` (`#3b82f6`) on `bg-card` (`#141416`) — contrast ratio ~4.6:1. WCAG AA (large text link at 12px — borderline; acceptable for a secondary affordance, same as Forge source).
- Active tab: `text-foreground` on `bg-card` — ~21:1.

### Reduced motion
All transitions honor `prefers-reduced-motion` via the global block in `src/index.css:376`
(no new motion tokens introduced; `transition-colors` is low-impact and falls within the
existing reduced-motion policy).

---

## Security Invariants (UI footprint — carry verbatim into implementation)

These are non-negotiable. Failing any of these fails Req 9 acceptance.

1. **iframe sandbox**: `sandbox="allow-scripts"` — MUST NOT include `allow-same-origin`.
   Use a `data:` URI for the iframe src (not an http:// or https:// URL to a Convex endpoint).
   Data URI preserves null-origin sandbox semantics.

2. **Source text**: `<pre>{textContent}</pre>` — React text node only. Never `innerHTML`,
   never `dangerouslySetInnerHTML`. A `<script>` tag in `textContent` renders as escaped
   text (`&lt;script&gt;`) in Source mode, and is sandboxed (null origin) in Preview mode.

3. **Filename/path rendering**: All filenames and paths are React text nodes. Never
   construct anchor `href` from a filename without encoding. VS Code deep link uses
   `vscode://file/` prefix + concatenated path — this is an opaque URI handled by the OS,
   not an HTTP fetch; no XSS vector.

4. **Image URL**: `imageUrl` is a Convex File Storage URL fetched server-side. It is passed
   as a prop to `<img src={...}>`. No `innerHTML` concatenation; React handles attribute escaping.

5. **Bearer key**: `FORGE_INGEST_API_KEY` MUST NOT appear in any browser-side file.
   Audit: confirm with grep before planning ships.

---

## Component Inventory — New Files

| Component | Path | Extends / Ports From |
|-----------|------|----------------------|
| `ForgeFilesPane` | `src/components/forge/ForgeFilesPane.tsx` | New wrapper; mirrors `ForgeLogPane` structure |
| `FileBrowser` | `src/components/forge/FileBrowser.tsx` | Port + re-skin from `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx` |
| `ArtifactPreview` | `src/components/forge/ArtifactPreview.tsx` | Port + adapt from `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx` |

### Shadcn primitives consumed (no new installs)
All already present in `src/components/ui/`:
- `Button` — Preview/Source toggle, fallback "Open in VS Code" button
- `ScrollArea` — FileBrowser list scroll container
- `Separator` — kind-group dividers

### Lucide icons consumed (no new installs beyond `FolderOpen`)
| Icon | Used In | Already in codebase? |
|------|---------|----------------------|
| `Loader2` | Loading state spinner | Yes — ForgeLaunchModal, ForgeStopConfirmDialog |
| `ExternalLink` | VS Code deep link icon | No — new import (available from lucide-react, zero install) |
| `FolderOpen` | Files tab icon (optional) | No — new import if tab icons are added |

`ExternalLink` and `FolderOpen` are standard Lucide icons available from the already-installed
`lucide-react` package. No package install required.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, ScrollArea, Separator (all pre-existing) | not required — already installed |
| Third-party | none | not applicable |

---

## Pre-Population Audit

| Decision | Source |
|----------|--------|
| Color palette (all tokens) | Phase 71 UI-SPEC §2 / src/index.css — pre-populated, not re-asked |
| Typography scale | Phase 71 UI-SPEC §2.7 / ForgeMetadataPanel.tsx / ForgeLogPane.tsx — pre-populated |
| Spacing scale | Phase 71 UI-SPEC §2.8 / live components — pre-populated |
| Radius (0.5rem) | Phase 71 UI-SPEC §7 Q1 — pre-populated |
| Icon library (Lucide only) | components.json iconLibrary + Phase 71 §4 — pre-populated |
| Fonts (Geist + JetBrains Mono) | components.json / src/index.css — pre-populated |
| shadcn primitive set | components.json / src/components/ui/ — pre-populated |
| Tab strip pattern | ForgeJobDetail.tsx:153-174 — pre-populated (extend verbatim) |
| Pane structure pattern | ForgeLogPane.tsx — pre-populated (mirror) |
| Kind-group ordering | SPEC Req 4 + Forge FileBrowser.tsx:41-48 — locked |
| Preview/Source toggle | Forge ArtifactPreview.tsx:115-132 — ported |
| Sandbox invariant | SPEC Req 9 / CONTEXT.md constraints — locked, verbatim |
| Data source (Convex, not localhost) | CONTEXT.md D-01/D-02, SPEC constraint — locked |
| 1 MB cap | SPEC Req 2 / CONTEXT.md D-02 — locked |
| Terminal-state gate | SPEC Req 7 — locked |
| Files tab label | SPEC Req 6 — "Files" (exact label per spec) |
| Files tab icon (`FolderOpen`) | [NEW DECISION] — grep confirmed no collision |
| Layout (vertical stack) | [NEW DECISION] — geometry analysis of ForgeJobDetail narrow panel |
| VS Code link scope (all kinds) | CONTEXT.md D-04a — "always show the local-path fallback" |
| Destructive actions (none) | SPEC boundary — read-only surface |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
