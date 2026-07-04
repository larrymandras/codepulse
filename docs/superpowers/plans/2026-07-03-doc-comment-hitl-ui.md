# Anchored Doc-Comment HITL Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the closed-loop anchored doc-comment HITL feature — 5 new Ástríðr `/api/doc-comments/*` endpoints plus a CodePulse authoring/status surface — so Larry can highlight text in a GSD spec, leave an anchored comment, and apply the reviewer persona's approved edit from one click.

**Architecture:** Two repos against one contract. Backend (Ástríðr, `astridr-hitl-wt`) adds create / doc-list / doc-read / by-doc / apply endpoints, reusing the existing `resolve_doc_path` guard, `relocate_anchor`, `apply_edit`, and `atomic_io`. Frontend (CodePulse, `codepulse-doccomments-wt`) mirrors the `kgApi.ts → KnowledgeGraph.tsx` analog: a typed `docCommentsApi.ts` client, a pure `docAnchor.ts` (backend-symmetric relocation), and a `DocComments.tsx` 3-pane page. Anchors live in **source coordinates** (authoritative for the backend splice); underlines are presentation-only DOM finds.

**Tech Stack:** Python 3.11 / FastAPI / httpx / pytest (backend); React 19 / TypeScript / Vite / react-markdown + remark-gfm / jsdiff / vitest (frontend).

## Global Constraints

- Backend: `async/await` everywhere, no blocking I/O (reads via `asyncio.to_thread`); all file writes through `astridr/engine/atomic_io.py` (never raw `open()`); `structlog` only; type hints on all public functions; tests in `tests/` mirroring `astridr/`.
- Backend endpoints mount under `/api/doc-comments/*` so the WebChannel `auth_check` Bearer middleware enforces auth fail-closed (401 unauth). RLS on `doc_comments` stays `service_role`-only.
- `doc_ref` v1 scope is `doc_type == "gsd_spec"` only; every path must pass `resolve_doc_path` (rejects unknown repo / absolute / backslash / `..` / non-`.planning`).
- Frontend: all Ástríðr `fetch()` calls use `authHeaders()` from `src/lib/astridrApi.ts` (Bearer via `VITE_ASTRIDR_API_KEY`). Markdown renders with **no `rehype-raw`** (sanitized — DCH-09). Icons Lucide-only. Path alias `@/` → `./src/`. Tests colocated `*.test.ts(x)`, vitest + jsdom.
- Anchor status union: `"open" | "acked" | "approved" | "resolved" | "stale"`.
- Never persist an anchor that cannot be **uniquely** located in source; never write an edit onto a stale anchor.

---

# PART A — Ástríðr backend (worktree `C:\Users\mandr\astridr-hitl-wt`, branch `team/alpha/doc-comment-hitl-persona`)

All Part A work happens in the `astridr-hitl-wt` worktree. Run tests with:
`python -m pytest tests/unit/channels/test_doc_comments.py -v` (single file — avoids the pytest-OOM-on-full-suite issue).

The existing file `astridr/channels/doc_comments.py` already defines `Anchor`, `AnchorLocation`, `relocate_anchor`, `apply_edit`, `resolve_doc_path`, `DocCommentStore`, `DocCommentService` (with `open_comments`, `ack`, `mark_stale`, `record_approved`, `resolve`, `_patch`), and `register_doc_comments_api(app, store)`. Tasks A1–A5 extend these.

---

### Task A1: Thread `repo_roots` into registration + `create` endpoint

**Files:**
- Modify: `astridr/channels/doc_comments.py` (add `DocCommentService.create`, `_CreateBody`, extend `register_doc_comments_api` signature + new route)
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:**
- Consumes: `resolve_doc_path(doc_ref, repo_roots)`, `DocCommentStore._ensure_client()`, `DocCommentStore._base`, existing `DocCommentsConfig().repo_roots` default (`{"astridr": "/app/repos/astridr-repo", "codepulse": "/app/repos/codepulse"}`).
- Produces: `DocCommentService.create(record: dict) -> dict`; `register_doc_comments_api(app, store, repo_roots: dict[str,str] | None = None)`; route `POST /api/doc-comments` accepting `{doc_ref, anchor, comment, author, profile_id, assignee_persona?}` returning the inserted row.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/channels/test_doc_comments.py`:

```python
@pytest.mark.asyncio
async def test_create_inserts_open_comment(monkeypatch):
    """POST /api/doc-comments validates doc_ref and inserts an open row."""
    store = MagicMock()
    inserted = {"id": "c9", "status": "open"}
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp([inserted]))
    store._ensure_client = AsyncMock(return_value=client)
    store._base = "http://sb/rest/v1"

    app = FastAPI()
    register_doc_comments_api(app, store, repo_roots={"astridr": "/repo"})
    body = {
        "doc_ref": {"repo": "astridr", "path": ".planning/x-SPEC.md",
                    "doc_type": "gsd_spec", "doc_hash": "h"},
        "anchor": asdict(_anchor("hello world", "world")),
        "comment": "tighten", "author": "larry", "profile_id": "larry",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        resp = await ac.post("/api/doc-comments", json=body)
    assert resp.status_code == 200
    assert resp.json()["id"] == "c9"
    client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_rejects_out_of_scope_doc_ref():
    """A doc_ref outside the whitelist (unknown repo) is rejected with 422."""
    store = MagicMock()
    app = FastAPI()
    register_doc_comments_api(app, store, repo_roots={"astridr": "/repo"})
    body = {
        "doc_ref": {"repo": "evil", "path": ".planning/x-SPEC.md",
                    "doc_type": "gsd_spec", "doc_hash": "h"},
        "anchor": asdict(_anchor("hello world", "world")),
        "comment": "x", "author": "larry", "profile_id": "larry",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        resp = await ac.post("/api/doc-comments", json=body)
    assert resp.status_code == 422
```

Add these helpers near the top of the test file if not already present:

```python
def _json_resp(payload, status_code=200):
    """A stand-in httpx.Response-like object exposing .json() and .raise_for_status()."""
    r = MagicMock()
    r.json = MagicMock(return_value=payload)
    r.raise_for_status = MagicMock()
    r.status_code = status_code
    return r
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_create_inserts_open_comment tests/unit/channels/test_doc_comments.py::test_create_rejects_out_of_scope_doc_ref -v`
Expected: FAIL — `register_doc_comments_api()` got an unexpected keyword argument `repo_roots` / route 404.

- [ ] **Step 3: Implement**

In `astridr/channels/doc_comments.py`, add the service method (inside `DocCommentService`):

```python
    async def create(self, record: dict[str, Any]) -> dict[str, Any]:
        """Insert a new doc comment (status defaults to ``open``); return the row."""
        client = await self._store._ensure_client()
        payload = {**record, "status": "open"}
        resp = await client.post(f"{self._store._base}/doc_comments", json=payload)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
```

Add the request model near `_ResolveBody`:

```python
class _CreateBody(BaseModel):
    doc_ref: dict[str, Any]
    anchor: dict[str, Any]
    comment: str
    author: str
    profile_id: str
    assignee_persona: str | None = None
```

Change the imports at the top: add `HTTPException` to the fastapi import line
(`from fastapi import FastAPI, HTTPException, Query`) and import the config default:

```python
from astridr.engine.config import DocCommentsConfig
```

Change `register_doc_comments_api` signature and add the create route:

```python
def register_doc_comments_api(
    app: FastAPI, store: DocCommentStore, repo_roots: dict[str, str] | None = None
) -> None:
    service = DocCommentService(store)
    roots = repo_roots if repo_roots is not None else DocCommentsConfig().repo_roots

    @app.post("/api/doc-comments")
    async def doc_comments_create(body: _CreateBody) -> JSONResponse:
        if resolve_doc_path(body.doc_ref, roots) is None:
            raise HTTPException(status_code=422, detail="doc_ref out of scope")
        record = {
            "doc_ref": body.doc_ref, "anchor": body.anchor,
            "comment": body.comment, "author": body.author,
            "profile_id": body.profile_id,
            "assignee_persona": body.assignee_persona,
        }
        return JSONResponse(content=await service.create(record))

    # ... existing @app.get("/api/doc-comments/open"), /ack, /resolve routes stay ...
```

(Keep the three existing routes exactly as they are, inside the function.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v -k "create"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/mandr/astridr-hitl-wt add astridr/channels/doc_comments.py tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "feat(alpha): doc-comments create endpoint + repo_roots wiring"
```

---

### Task A2: Doc-list endpoint (`GET /api/doc-comments/docs`)

**Files:**
- Modify: `astridr/channels/doc_comments.py`
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:**
- Produces: module function `list_in_scope_docs(repo_roots: dict[str,str]) -> list[dict]` returning `[{"repo","path","doc_type":"gsd_spec"}]`; route `GET /api/doc-comments/docs`.

- [ ] **Step 1: Write the failing test**

```python
def test_list_in_scope_docs_finds_gsd_specs(tmp_path):
    """Enumerates SPEC.md / PLAN.md under .planning, returns repo-relative paths."""
    from astridr.channels.doc_comments import list_in_scope_docs
    (tmp_path / ".planning" / "phases" / "161-x").mkdir(parents=True)
    spec = tmp_path / ".planning" / "phases" / "161-x" / "161-SPEC.md"
    spec.write_text("# spec", encoding="utf-8")
    (tmp_path / ".planning" / "notes.md").write_text("nope", encoding="utf-8")

    docs = list_in_scope_docs({"astridr": str(tmp_path)})
    assert {"repo": "astridr",
            "path": ".planning/phases/161-x/161-SPEC.md",
            "doc_type": "gsd_spec"} in docs
    assert all(d["path"].endswith(("SPEC.md", "PLAN.md")) for d in docs)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_list_in_scope_docs_finds_gsd_specs -v`
Expected: FAIL — cannot import `list_in_scope_docs`.

- [ ] **Step 3: Implement**

Add to `doc_comments.py` (module level, near `resolve_doc_path`). Note `Path`/`glob` import:

```python
from pathlib import Path, PurePosixPath  # extend the existing PurePosixPath import


def list_in_scope_docs(repo_roots: dict[str, str]) -> list[dict[str, Any]]:
    """List v1-in-scope GSD docs (``*SPEC.md`` / ``*PLAN.md`` under ``.planning/``)."""
    out: list[dict[str, Any]] = []
    for repo, root in repo_roots.items():
        planning = Path(root) / ".planning"
        if not planning.is_dir():
            continue
        for pattern in ("**/*SPEC.md", "**/*PLAN.md"):
            for p in planning.glob(pattern):
                rel = p.relative_to(root).as_posix()
                out.append({"repo": repo, "path": rel, "doc_type": "gsd_spec"})
    out.sort(key=lambda d: (d["repo"], d["path"]))
    return out
```

Add the route inside `register_doc_comments_api` (uses `roots`):

```python
    @app.get("/api/doc-comments/docs")
    async def doc_comments_docs() -> JSONResponse:
        docs = await asyncio.to_thread(list_in_scope_docs, roots)
        return JSONResponse(content={"docs": docs, "count": len(docs)})
```

Add `import asyncio` at the top of the module if absent.

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_list_in_scope_docs_finds_gsd_specs -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/mandr/astridr-hitl-wt add astridr/channels/doc_comments.py tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "feat(alpha): doc-comments doc-list endpoint"
```

---

### Task A3: Doc-read endpoint (`GET /api/doc-comments/doc`)

**Files:**
- Modify: `astridr/channels/doc_comments.py`
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:**
- Produces: module function `read_in_scope_doc(doc_ref, repo_roots) -> dict | None` returning `{"repo","path","content","doc_hash"}`; route `GET /api/doc-comments/doc?repo=&path=`. `doc_hash` = `hashlib.sha256(content.encode()).hexdigest()`.

- [ ] **Step 1: Write the failing test**

```python
def test_read_in_scope_doc_returns_content_and_hash(tmp_path):
    import hashlib
    from astridr.channels.doc_comments import read_in_scope_doc
    (tmp_path / ".planning").mkdir()
    doc = tmp_path / ".planning" / "y-SPEC.md"
    doc.write_text("# hello\nbody", encoding="utf-8")

    result = read_in_scope_doc(
        {"repo": "astridr", "path": ".planning/y-SPEC.md", "doc_type": "gsd_spec"},
        {"astridr": str(tmp_path)},
    )
    assert result["content"] == "# hello\nbody"
    assert result["doc_hash"] == hashlib.sha256(b"# hello\nbody").hexdigest()


def test_read_in_scope_doc_rejects_out_of_scope(tmp_path):
    from astridr.channels.doc_comments import read_in_scope_doc
    result = read_in_scope_doc(
        {"repo": "astridr", "path": "../secret", "doc_type": "gsd_spec"},
        {"astridr": str(tmp_path)},
    )
    assert result is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v -k read_in_scope`
Expected: FAIL — cannot import `read_in_scope_doc`.

- [ ] **Step 3: Implement**

```python
import hashlib  # top of module


def read_in_scope_doc(
    doc_ref: dict[str, Any], repo_roots: dict[str, str]
) -> dict[str, Any] | None:
    """Read a resolved GSD doc; return content + sha256, or ``None`` if out of scope."""
    path = resolve_doc_path(doc_ref, repo_roots)
    if path is None:
        return None
    try:
        content = Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("doc_comments.doc_read_failed", path=path, error=str(exc))
        return None
    return {
        "repo": doc_ref.get("repo"),
        "path": doc_ref.get("path"),
        "content": content,
        "doc_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
    }
```

Route inside `register_doc_comments_api`:

```python
    @app.get("/api/doc-comments/doc")
    async def doc_comments_doc(
        repo: str = Query(...), path: str = Query(...)
    ) -> JSONResponse:
        doc_ref = {"repo": repo, "path": path, "doc_type": "gsd_spec"}
        result = await asyncio.to_thread(read_in_scope_doc, doc_ref, roots)
        if result is None:
            raise HTTPException(status_code=404, detail="doc not found or out of scope")
        return JSONResponse(content=result)
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v -k read_in_scope`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/mandr/astridr-hitl-wt add astridr/channels/doc_comments.py tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "feat(alpha): doc-comments doc-read endpoint (content + sha256)"
```

---

### Task A4: Comments-for-doc endpoint (`GET /api/doc-comments/by-doc`)

**Files:**
- Modify: `astridr/channels/doc_comments.py`
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:**
- Produces: `DocCommentService.comments_for_doc(profile_id, repo, path) -> dict` (all statuses, filtered on `doc_ref->>repo` and `doc_ref->>path`); route `GET /api/doc-comments/by-doc?repo=&path=&profile_id=`.

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_comments_for_doc_filters_by_doc_ref():
    """by-doc queries PostgREST on profile + doc_ref repo/path, returns all statuses."""
    store = MagicMock()
    rows = [{"id": "a", "status": "open"}, {"id": "b", "status": "resolved"}]
    client = MagicMock()
    client.get = AsyncMock(return_value=_json_resp(rows))
    store._ensure_client = AsyncMock(return_value=client)
    store._base = "http://sb/rest/v1"

    svc = DocCommentService(store)
    result = await svc.comments_for_doc("larry", "astridr", ".planning/x-SPEC.md")
    assert result["count"] == 2
    params = client.get.await_args.kwargs["params"]
    assert params["profile_id"] == "eq.larry"
    assert params["doc_ref->>repo"] == "eq.astridr"
    assert params["doc_ref->>path"] == "eq..planning/x-SPEC.md"
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_comments_for_doc_filters_by_doc_ref -v`
Expected: FAIL — `DocCommentService` has no attribute `comments_for_doc`.

- [ ] **Step 3: Implement**

Add to `DocCommentService`:

```python
    async def comments_for_doc(
        self, profile_id: str, repo: str, path: str
    ) -> dict[str, Any]:
        """All comments (any status) for one doc — powers CodePulse inline rendering."""
        try:
            client = await self._store._ensure_client()
            params = {
                "select": "*",
                "profile_id": f"eq.{profile_id}",
                "doc_ref->>repo": f"eq.{repo}",
                "doc_ref->>path": f"eq.{path}",
                "order": "created_at.asc",
            }
            resp = await client.get(f"{self._store._base}/doc_comments", params=params)
            resp.raise_for_status()
            rows = resp.json()
            return {"comments": rows, "count": len(rows)}
        except Exception as exc:
            logger.warning("doc_comments.by_doc_failed", error=str(exc))
            return {"comments": [], "count": 0}
```

Route inside `register_doc_comments_api`:

```python
    @app.get("/api/doc-comments/by-doc")
    async def doc_comments_by_doc(
        repo: str = Query(...), path: str = Query(...),
        profile_id: str = Query(...),
    ) -> JSONResponse:
        return JSONResponse(
            content=await service.comments_for_doc(profile_id, repo, path)
        )
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_comments_for_doc_filters_by_doc_ref -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/mandr/astridr-hitl-wt add astridr/channels/doc_comments.py tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "feat(alpha): doc-comments by-doc endpoint (all statuses)"
```

---

### Task A5: Apply endpoint (`POST /api/doc-comments/{id}/apply`)

**Files:**
- Modify: `astridr/channels/doc_comments.py`
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:**
- Consumes: `resolve_doc_path`, `relocate_anchor`, `apply_edit`, `Anchor`, `DocCommentService.resolve`, `DocCommentService.mark_stale`, `astridr/engine/atomic_io.py` (atomic write).
- Produces: `DocCommentService.get_by_id(comment_id) -> dict`; module coroutine `apply_approved_edit(service, comment, repo_roots) -> dict` returning `{"status": "resolved"|"stale"|"skipped", "row": {...}}`; route `POST /api/doc-comments/{id}/apply`.

Behavior: guard `status == "approved"` (else `skipped`); read the doc; `relocate_anchor` — if stale → `mark_stale`, do **not** write; else `apply_edit` splice → atomic write the file → `service.resolve(id, note, proposed_edit)`. Verify the write happened (no silent catch).

- [ ] **Step 1: Confirm the atomic-write helper name**

Run: `python -c "import astridr.engine.atomic_io as a; print([n for n in dir(a) if not n.startswith('__')])"` from the worktree root.
Expected: a public write function (e.g. `atomic_write` / `write_text_atomic`). Use the actual name below wherever `ATOMIC_WRITE` appears.

- [ ] **Step 2: Write the failing test**

```python
@pytest.mark.asyncio
async def test_apply_writes_edit_and_resolves(tmp_path, monkeypatch):
    from astridr.channels import doc_comments as dc
    (tmp_path / ".planning").mkdir()
    doc = tmp_path / ".planning" / "z-SPEC.md"
    doc.write_text("alpha bravo charlie", encoding="utf-8")
    comment = {
        "id": "c1", "status": "approved",
        "proposed_edit": "BRAVO",
        "doc_ref": {"repo": "astridr", "path": ".planning/z-SPEC.md",
                    "doc_type": "gsd_spec", "doc_hash": "h"},
        "anchor": asdict(_anchor("alpha bravo charlie", "bravo")),
    }
    service = MagicMock()
    service.resolve = AsyncMock(return_value={"id": "c1", "status": "resolved"})
    service.mark_stale = AsyncMock()

    result = await dc.apply_approved_edit(service, comment, {"astridr": str(tmp_path)})
    assert result["status"] == "resolved"
    assert doc.read_text(encoding="utf-8") == "alpha BRAVO charlie"
    service.resolve.assert_awaited_once()
    service.mark_stale.assert_not_called()


@pytest.mark.asyncio
async def test_apply_on_stale_marks_stale_and_does_not_write(tmp_path):
    from astridr.channels import doc_comments as dc
    (tmp_path / ".planning").mkdir()
    doc = tmp_path / ".planning" / "z-SPEC.md"
    doc.write_text("totally different text now", encoding="utf-8")
    comment = {
        "id": "c1", "status": "approved", "proposed_edit": "X",
        "doc_ref": {"repo": "astridr", "path": ".planning/z-SPEC.md",
                    "doc_type": "gsd_spec", "doc_hash": "h"},
        "anchor": asdict(_anchor("alpha bravo charlie", "bravo")),
    }
    service = MagicMock()
    service.resolve = AsyncMock()
    service.mark_stale = AsyncMock(return_value={"id": "c1", "status": "stale"})

    result = await dc.apply_approved_edit(service, comment, {"astridr": str(tmp_path)})
    assert result["status"] == "stale"
    assert doc.read_text(encoding="utf-8") == "totally different text now"  # untouched
    service.mark_stale.assert_awaited_once()
    service.resolve.assert_not_called()


@pytest.mark.asyncio
async def test_apply_skips_when_not_approved(tmp_path):
    from astridr.channels import doc_comments as dc
    comment = {"id": "c1", "status": "open", "proposed_edit": None,
               "doc_ref": {"repo": "astridr", "path": ".planning/z-SPEC.md",
                           "doc_type": "gsd_spec"},
               "anchor": asdict(_anchor("a b c", "b"))}
    service = MagicMock()
    service.resolve = AsyncMock(); service.mark_stale = AsyncMock()
    result = await dc.apply_approved_edit(service, comment, {"astridr": str(tmp_path)})
    assert result["status"] == "skipped"
    service.resolve.assert_not_called(); service.mark_stale.assert_not_called()
```

- [ ] **Step 3: Run to verify they fail**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v -k apply`
Expected: FAIL — module has no `apply_approved_edit`.

- [ ] **Step 4: Implement**

Add the atomic-write import (use the real name from Step 1):

```python
from astridr.engine.atomic_io import atomic_write  # adjust to actual public name
```

Add `get_by_id` to `DocCommentService`:

```python
    async def get_by_id(self, comment_id: str) -> dict[str, Any]:
        """Fetch one comment row by id (empty dict if missing)."""
        try:
            client = await self._store._ensure_client()
            resp = await client.get(
                f"{self._store._base}/doc_comments",
                params={"select": "*", "id": f"eq.{comment_id}"},
            )
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else {}
        except Exception as exc:
            logger.warning("doc_comments.get_by_id_failed",
                           comment_id=comment_id, error=str(exc))
            return {}
```

Add the module coroutine:

```python
async def apply_approved_edit(
    service: "DocCommentService", comment: dict[str, Any], repo_roots: dict[str, str]
) -> dict[str, Any]:
    """Apply an approved comment's stored edit to the real doc, then resolve it.

    Guarded: only ``approved`` comments; a stale anchor marks stale and never writes.
    """
    if comment.get("status") != "approved" or not comment.get("proposed_edit"):
        return {"status": "skipped", "row": {}}

    doc_ref = comment["doc_ref"]
    path = resolve_doc_path(doc_ref, repo_roots)
    if path is None:
        return {"status": "skipped", "row": {}}

    text = await asyncio.to_thread(Path(path).read_text, encoding="utf-8")
    anchor = Anchor(**comment["anchor"])
    new_text = apply_edit(text, anchor, comment["proposed_edit"])
    if new_text is None:  # anchor no longer locatable → never mis-apply
        row = await service.mark_stale(comment["id"])
        return {"status": "stale", "row": row}

    await asyncio.to_thread(atomic_write, path, new_text)  # adjust to real signature
    row = await service.resolve(
        comment["id"],
        resolution_note="Applied from CodePulse",
        proposed_edit=comment["proposed_edit"],
    )
    return {"status": "resolved", "row": row}
```

Add the route inside `register_doc_comments_api`:

```python
    @app.post("/api/doc-comments/{comment_id}/apply")
    async def doc_comments_apply(comment_id: str) -> JSONResponse:
        comment = await service.get_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="comment not found")
        result = await apply_approved_edit(service, comment, roots)
        return JSONResponse(content=result)
```

- [ ] **Step 5: Run to verify they pass**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v -k apply`
Expected: PASS (3 tests).

- [ ] **Step 6: Full-file regression + commit**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py -v`
Expected: PASS (all prior + new tests green).

```bash
git -C /c/Users/mandr/astridr-hitl-wt add astridr/channels/doc_comments.py tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "feat(alpha): doc-comments apply endpoint (splice + atomic write + resolve)"
```

---

### Task A6: Verify auth fail-closed on the new routes (end of Part A)

**Files:**
- Test: `tests/unit/channels/test_doc_comments.py`

**Interfaces:** Consumes `WebChannel` (real app with `auth_check` middleware).

- [ ] **Step 1: Write the test**

Mirror any existing 401 test in the file (there is already one for `/open`). Add:

```python
@pytest.mark.asyncio
async def test_new_routes_reject_unauthenticated():
    """create / docs / doc / by-doc / apply all 401 without a Bearer token."""
    ch = WebChannel(api_key="secret", graph_store=MagicMock())
    ch._build_app()  # use the same app-build entrypoint the existing 401 test uses
    app = ch._app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        assert (await ac.get("/api/doc-comments/docs")).status_code == 401
        assert (await ac.get("/api/doc-comments/doc?repo=astridr&path=x")).status_code == 401
        assert (await ac.post("/api/doc-comments", json={})).status_code == 401
        assert (await ac.post("/api/doc-comments/c1/apply")).status_code == 401
```

> If the existing 401 test uses a different app-construction helper, copy that exact setup (grep the file for `401` / `WebChannel(` and reuse it verbatim).

- [ ] **Step 2: Run**

Run: `python -m pytest tests/unit/channels/test_doc_comments.py::test_new_routes_reject_unauthenticated -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/mandr/astridr-hitl-wt add tests/unit/channels/test_doc_comments.py
git -C /c/Users/mandr/astridr-hitl-wt commit -m "test(alpha): doc-comments new routes fail-closed on unauth"
```

**Part A done.** Open a PR from `team/alpha/doc-comment-hitl-persona`. The five endpoints are live for Part B.

---

# PART B — CodePulse UI (worktree `C:\Users\mandr\codepulse-doccomments-wt`, branch `feat/doc-comment-hitl-ui`)

Run all Part B commands from `C:\Users\mandr\codepulse-doccomments-wt`. Test: `npx vitest run <file>`. Type-check: `npx tsc --noEmit`.

---

### Task B0: Add the `diff` dependency

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1: Install**

Run: `npm install diff@^7 && npm install -D @types/diff`
Expected: both added to `package.json`.

- [ ] **Step 2: Sanity type-check**

Run: `node -e "const {diffWords}=require('diff'); console.log(typeof diffWords)"`
Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add jsdiff for inline word-diff in doc-comment apply UI"
```

---

### Task B1: `docCommentsApi.ts` — contract types + fetchers

**Files:**
- Create: `src/lib/docCommentsApi.ts`
- Test: `src/lib/docCommentsApi.test.ts`

**Interfaces:**
- Consumes: `authHeaders`, `astridrApiBase`, `AstridrApiError` from `./astridrApi`.
- Produces: types `DocRef`, `Anchor`, `DocCommentStatus`, `DocComment`, `DocListItem`, `DocContent`, `ApplyResult`; fetchers `listDocs(profileId)`, `readDoc(repo, path)`, `listCommentsForDoc(profileId, repo, path)`, `createComment(input)`, `ackComment(id)`, `resolveComment(id, note, edit?)`, `applyComment(id)`. All Bearer-authed; throw `AstridrApiError` on non-2xx.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "./docCommentsApi";

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe("docCommentsApi", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("createComment POSTs with a Bearer header and returns the row", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockReturnValue(okJson({ id: "c1", status: "open" }));
    const row = await api.createComment({
      doc_ref: { repo: "astridr", path: ".planning/x-SPEC.md", doc_type: "gsd_spec", doc_hash: "h" },
      anchor: { quote: "q", prefix: "", suffix: "", start: 0, end: 1, line_start: 1, line_end: 1 },
      comment: "tighten", author: "larry", profile_id: "larry",
    });
    expect(row.id).toBe("c1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/doc-comments");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("readDoc GETs content + hash", async () => {
    vi.spyOn(global, "fetch").mockReturnValue(okJson({ repo: "astridr", path: "p", content: "# x", doc_hash: "h" }));
    const doc = await api.readDoc("astridr", ".planning/x-SPEC.md");
    expect(doc.content).toBe("# x");
    expect(doc.doc_hash).toBe("h");
  });

  it("throws AstridrApiError on non-2xx", async () => {
    vi.spyOn(global, "fetch").mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: "nope" }) } as Response),
    );
    await expect(api.listDocs("larry")).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/docCommentsApi.test.ts`
Expected: FAIL — module `./docCommentsApi` not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/docCommentsApi.ts
import { authHeaders, astridrApiBase, AstridrApiError } from "./astridrApi";

export interface DocRef {
  repo: string;
  path: string;
  doc_type: "gsd_spec";
  doc_hash: string;
}
export interface Anchor {
  quote: string; prefix: string; suffix: string;
  start: number; end: number; line_start: number; line_end: number;
}
export type DocCommentStatus = "open" | "acked" | "approved" | "resolved" | "stale";
export interface DocComment {
  id: string; doc_ref: DocRef; anchor: Anchor; comment: string; author: string;
  status: DocCommentStatus; assignee_persona: string | null;
  proposed_edit: string | null; resolution_note: string | null;
  profile_id: string; created_at: string; resolved_at: string | null;
}
export interface DocListItem { repo: string; path: string; doc_type: "gsd_spec"; }
export interface DocContent { repo: string; path: string; content: string; doc_hash: string; }
export interface ApplyResult { status: "resolved" | "stale" | "skipped"; row: Partial<DocComment>; }

export interface CreateCommentInput {
  doc_ref: DocRef; anchor: Anchor; comment: string; author: string;
  profile_id: string; assignee_persona?: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${astridrApiBase()}${path}`, { headers: authHeaders(), ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof body.detail === "string" ? body.detail : res.statusText;
    throw new AstridrApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string>) =>
  "?" + new URLSearchParams(params).toString();

export function listDocs(profileId: string): Promise<{ docs: DocListItem[]; count: number }> {
  return req(`/api/doc-comments/docs${qs({ profile_id: profileId })}`);
}
export function readDoc(repo: string, path: string): Promise<DocContent> {
  return req(`/api/doc-comments/doc${qs({ repo, path })}`);
}
export function listCommentsForDoc(
  profileId: string, repo: string, path: string,
): Promise<{ comments: DocComment[]; count: number }> {
  return req(`/api/doc-comments/by-doc${qs({ profile_id: profileId, repo, path })}`);
}
export function createComment(input: CreateCommentInput): Promise<DocComment> {
  return req(`/api/doc-comments`, { method: "POST", body: JSON.stringify(input) });
}
export function ackComment(id: string): Promise<DocComment> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/ack`, { method: "POST" });
}
export function resolveComment(id: string, note: string, edit?: string): Promise<DocComment> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/resolve`, {
    method: "POST", body: JSON.stringify({ resolution_note: note, proposed_edit: edit ?? null }),
  });
}
export function applyComment(id: string): Promise<ApplyResult> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/apply`, { method: "POST" });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/docCommentsApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docCommentsApi.ts src/lib/docCommentsApi.test.ts
git commit -m "feat: docCommentsApi client (contract types + Bearer fetchers)"
```

---

### Task B2: `docAnchor.ts` — backend-symmetric relocation + selection capture

This is the correctness-critical module. TDD hard, parity with the backend algorithm.

**Files:**
- Create: `src/lib/docAnchor.ts`
- Test: `src/lib/docAnchor.test.ts`

**Interfaces:**
- Consumes: `Anchor` from `./docCommentsApi`.
- Produces:
  - `relocateAnchor(source: string, anchor: Anchor): { status: "located" | "stale"; start: number | null; end: number | null; reason: string }` — mirrors the Python `relocate_anchor` exactly (position → prefix+quote+suffix unique → unique-quote → stale).
  - `captureAnchorFromSelection(source: string, quote: string, renderedPrefix: string, renderedSuffix: string): Anchor | null` — builds a full source-coordinate anchor by locating `quote` in `source`; returns `null` when it cannot be uniquely located (caller then refuses to save).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { relocateAnchor, captureAnchorFromSelection } from "./docAnchor";
import type { Anchor } from "./docCommentsApi";

const A = (o: Partial<Anchor>): Anchor => ({
  quote: "", prefix: "", suffix: "", start: 0, end: 0, line_start: 1, line_end: 1, ...o,
});

describe("relocateAnchor (parity with backend)", () => {
  it("position match when offsets still hold", () => {
    const src = "alpha bravo charlie";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 6, end: 11 })))
      .toMatchObject({ status: "located", start: 6, end: 11, reason: "position_match" });
  });
  it("context match after a shift", () => {
    const src = "XX alpha bravo charlie";
    const r = relocateAnchor(src, A({ quote: "bravo", prefix: "alpha ", suffix: " charlie", start: 6, end: 11 }));
    expect(r).toMatchObject({ status: "located", reason: "context_match" });
    expect(src.slice(r.start!, r.end!)).toBe("bravo");
  });
  it("unique-quote fallback", () => {
    const src = "the bravo is here";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 999, end: 1000 })))
      .toMatchObject({ status: "located", reason: "quote_unique" });
  });
  it("ambiguous quote → stale", () => {
    const src = "bravo and bravo";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 999, end: 1000 })))
      .toMatchObject({ status: "stale" });
  });
  it("missing → stale", () => {
    expect(relocateAnchor("nothing here", A({ quote: "zzz", start: 0, end: 3 })))
      .toMatchObject({ status: "stale" });
  });
});

describe("captureAnchorFromSelection", () => {
  it("builds a source-coordinate anchor with correct offsets + line numbers", () => {
    const src = "line one\nalpha bravo charlie\nline three";
    const a = captureAnchorFromSelection(src, "bravo", "alpha ", " charlie");
    expect(a).not.toBeNull();
    expect(src.slice(a!.start, a!.end)).toBe("bravo");
    expect(a!.line_start).toBe(2);
    expect(a!.quote).toBe("bravo");
  });
  it("returns null when the quote cannot be uniquely located", () => {
    expect(captureAnchorFromSelection("bravo bravo", "bravo", "", "")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/docAnchor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/docAnchor.ts
import type { Anchor } from "./docCommentsApi";

export interface RelocateResult {
  status: "located" | "stale";
  start: number | null;
  end: number | null;
  reason: string;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + 1); }
  return n;
}

/** Mirrors the Python `relocate_anchor`: position → context → unique-quote → stale. */
export function relocateAnchor(source: string, anchor: Anchor): RelocateResult {
  if (source.slice(anchor.start, anchor.end) === anchor.quote && anchor.quote) {
    return { status: "located", start: anchor.start, end: anchor.end, reason: "position_match" };
  }
  const needle = anchor.prefix + anchor.quote + anchor.suffix;
  if (needle && countOccurrences(source, needle) === 1) {
    const start = source.indexOf(needle) + anchor.prefix.length;
    return { status: "located", start, end: start + anchor.quote.length, reason: "context_match" };
  }
  if (anchor.quote && countOccurrences(source, anchor.quote) === 1) {
    const start = source.indexOf(anchor.quote);
    return { status: "located", start, end: start + anchor.quote.length, reason: "quote_unique" };
  }
  return { status: "stale", start: null, end: null, reason: "not_found" };
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === "\n") line++;
  return line;
}

/**
 * Build a full source-coordinate anchor from a selection. `quote` is the selected
 * string; `renderedPrefix`/`renderedSuffix` are context strings from the rendered view
 * used to disambiguate repeats. Returns null when the quote can't be uniquely located
 * in `source` (caller must then refuse to save — never persist a bad anchor).
 */
export function captureAnchorFromSelection(
  source: string, quote: string, renderedPrefix: string, renderedSuffix: string,
): Anchor | null {
  if (!quote) return null;
  const contextNeedle = renderedPrefix + quote + renderedSuffix;
  let start = -1;
  if (contextNeedle && countOccurrences(source, contextNeedle) === 1) {
    start = source.indexOf(contextNeedle) + renderedPrefix.length;
  } else if (countOccurrences(source, quote) === 1) {
    start = source.indexOf(quote);
  } else {
    return null; // ambiguous or absent → refuse
  }
  const end = start + quote.length;
  return {
    quote,
    prefix: source.slice(Math.max(0, start - 32), start),
    suffix: source.slice(end, end + 32),
    start, end,
    line_start: lineAt(source, start),
    line_end: lineAt(source, end),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/docAnchor.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docAnchor.ts src/lib/docAnchor.test.ts
git commit -m "feat: docAnchor — backend-symmetric relocation + selection capture"
```

---

### Task B3: `useDocComments` hook (poll by-doc)

**Files:**
- Create: `src/hooks/useDocComments.ts`
- Test: `src/hooks/useDocComments.test.ts`

**Interfaces:**
- Consumes: `listCommentsForDoc`, `DocComment` from `../lib/docCommentsApi`.
- Produces: `useDocComments(profileId, repo, path, intervalMs = 5000): { comments: DocComment[]; loading: boolean; error: string | null; refetch: () => void }`. When `repo`/`path` are empty, it does nothing and returns `[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as api from "../lib/docCommentsApi";
import { useDocComments } from "./useDocComments";

describe("useDocComments", () => {
  it("fetches comments for the active doc", async () => {
    vi.spyOn(api, "listCommentsForDoc").mockResolvedValue({
      comments: [{ id: "c1", status: "open" } as api.DocComment], count: 1,
    });
    const { result } = renderHook(() => useDocComments("larry", "astridr", ".planning/x-SPEC.md"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
  });

  it("is inert with no doc selected", () => {
    const spy = vi.spyOn(api, "listCommentsForDoc");
    const { result } = renderHook(() => useDocComments("larry", "", ""));
    expect(result.current.comments).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useDocComments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/hooks/useDocComments.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { listCommentsForDoc, type DocComment } from "../lib/docCommentsApi";

export function useDocComments(
  profileId: string, repo: string, path: string, intervalMs = 5000,
) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tick = useRef(0);

  const fetchOnce = useCallback(async () => {
    if (!repo || !path) { setComments([]); return; }
    setLoading(true);
    try {
      const res = await listCommentsForDoc(profileId, repo, path);
      setComments(res.comments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profileId, repo, path]);

  useEffect(() => {
    fetchOnce();
    if (!repo || !path) return;
    const id = setInterval(fetchOnce, intervalMs);
    return () => clearInterval(id);
  }, [fetchOnce, repo, path, intervalMs, tick.current]);

  const refetch = useCallback(() => { tick.current++; fetchOnce(); }, [fetchOnce]);
  return { comments, loading, error, refetch };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/hooks/useDocComments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDocComments.ts src/hooks/useDocComments.test.ts
git commit -m "feat: useDocComments polling hook"
```

---

### Task B4: `DocViewer` — sanitized render + selection capture + underline overlay

**Files:**
- Create: `src/components/doccomments/DocViewer.tsx`
- Test: `src/components/doccomments/DocViewer.test.tsx`

**Interfaces:**
- Consumes: `react-markdown`, `remark-gfm`, `DocComment`, `Anchor` (from `../../lib/docCommentsApi`), `captureAnchorFromSelection`, `relocateAnchor` (from `../../lib/docAnchor`).
- Produces: `<DocViewer source={string} comments={DocComment[]} onSelectAnchor={(anchor: Anchor, rect: DOMRect) => void} onCommentClick={(id: string) => void} />`.

Behavior: render `source` via `<ReactMarkdown remarkPlugins={[remarkGfm]}>` (NO `rehype-raw`). On `mouseup`, read `window.getSelection()`; if non-empty, compute `quote` + rendered prefix/suffix (32 chars of `selection.anchorNode`/`focusNode` text around the range — see code), call `captureAnchorFromSelection(source, quote, prefix, suffix)`; if non-null, call `onSelectAnchor(anchor, range.getBoundingClientRect())`. Underlines: after render, for each comment, `relocateAnchor(source, ...)` to know it's non-stale, then find `quote` text in the container DOM and wrap in a status-colored `<mark>` (a `useEffect` DOM walk keyed on `comments`/`source`).

- [ ] **Step 1: Write the failing test** (behavioral, jsdom)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocViewer } from "./DocViewer";

describe("DocViewer", () => {
  it("renders markdown as sanitized HTML (headings become <h1>, no raw script)", () => {
    render(<DocViewer source={"# Title\n\n<script>alert(1)</script>"} comments={[]}
      onSelectAnchor={vi.fn()} onCommentClick={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title");
    // react-markdown without rehype-raw renders the <script> as text, never executes it
    expect(document.querySelector("script")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/doccomments/DocViewer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/doccomments/DocViewer.tsx
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Anchor, DocComment } from "../../lib/docCommentsApi";
import { captureAnchorFromSelection, relocateAnchor } from "../../lib/docAnchor";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-500/25 border-b-2 border-amber-500",
  acked: "bg-blue-500/25 border-b-2 border-blue-500",
  approved: "bg-emerald-500/25 border-b-2 border-emerald-500",
  resolved: "bg-emerald-500/10 border-b border-emerald-500/40",
  stale: "line-through text-muted-foreground/60 decoration-zinc-500",
};

interface Props {
  source: string;
  comments: DocComment[];
  onSelectAnchor: (anchor: Anchor, rect: DOMRect) => void;
  onCommentClick: (id: string) => void;
}

export function DocViewer({ source, comments, onSelectAnchor, onCommentClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const quote = sel.toString();
    if (!quote.trim()) return;
    const range = sel.getRangeAt(0);
    // rendered context: 32 chars around the selection within its text nodes
    const anchorText = sel.anchorNode?.textContent ?? "";
    const prefix = anchorText.slice(Math.max(0, (range.startOffset) - 32), range.startOffset);
    const focusText = sel.focusNode?.textContent ?? "";
    const suffix = focusText.slice(range.endOffset, range.endOffset + 32);
    const anchor = captureAnchorFromSelection(source, quote, prefix, suffix);
    if (!anchor) return; // ambiguous → caller shows "select cleaner text" via null path
    onSelectAnchor(anchor, range.getBoundingClientRect());
  }

  // Underline overlay: wrap each non-stale comment's quote in a status <mark>.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // (Presentation only. Walk text nodes, find each comment.quote, wrap the first
    // unique match in a <mark class=STATUS_CLASS[status]> with data-comment-id.
    // If not found in the DOM, skip silently — the sidebar still lists it.)
    highlightComments(root, source, comments);
    const marks = root.querySelectorAll<HTMLElement>("mark[data-comment-id]");
    const onClick = (e: Event) => {
      const id = (e.currentTarget as HTMLElement).dataset.commentId;
      if (id) onCommentClick(id);
    };
    marks.forEach((m) => m.addEventListener("click", onClick));
    return () => marks.forEach((m) => m.removeEventListener("click", onClick));
  }, [source, comments, onCommentClick]);

  return (
    <div
      ref={ref}
      onMouseUp={handleMouseUp}
      className="prose prose-invert max-w-none px-6 py-4 font-mono text-sm leading-relaxed"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}

/** Wrap the first unique DOM occurrence of each non-stale comment's quote in a <mark>. */
function highlightComments(root: HTMLElement, source: string, comments: DocComment[]) {
  for (const c of comments) {
    if (relocateAnchor(source, c.anchor).status === "stale" && c.status !== "stale") continue;
    wrapFirstMatch(root, c.anchor.quote, c.id, STATUS_CLASS[c.status] ?? STATUS_CLASS.open);
  }
}

/** Find `quote` in a single text node under root and wrap it in a styled <mark>. */
function wrapFirstMatch(root: HTMLElement, quote: string, id: string, cls: string) {
  if (!quote) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    const idx = text.indexOf(quote);
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + quote.length);
    const mark = document.createElement("mark");
    mark.className = `cursor-pointer rounded-sm ${cls}`;
    mark.dataset.commentId = id;
    range.surroundContents(mark);
    return;
  }
}
```

> Note: `highlightComments`/`wrapFirstMatch` are presentation-only and best-effort. Keep them defensive — `surroundContents` throws if the range partially selects a non-Text node; guard with try/catch and skip on failure (the sidebar still lists the comment).

Add the try/catch guard in `wrapFirstMatch` around `range.surroundContents(mark)`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/doccomments/DocViewer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/doccomments/DocViewer.tsx src/components/doccomments/DocViewer.test.tsx
git commit -m "feat: DocViewer — sanitized markdown + selection capture + underline overlay"
```

---

### Task B5: `CommentPopover` — instruction input on selection

**Files:**
- Create: `src/components/doccomments/CommentPopover.tsx`
- Test: `src/components/doccomments/CommentPopover.test.tsx`

**Interfaces:**
- Consumes: shadcn `Textarea`, `Button` from `../ui/*`.
- Produces: `<CommentPopover rect={DOMRect | null} onSubmit={(text: string) => void} onCancel={() => void} submitting={boolean} />`. Renders a floating card positioned at `rect` with a textarea + Submit/Cancel. Submit disabled when empty or `submitting`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentPopover } from "./CommentPopover";

const rect = { top: 10, left: 10, bottom: 20, right: 20, width: 10, height: 10 } as DOMRect;

it("submits the typed instruction", () => {
  const onSubmit = vi.fn();
  render(<CommentPopover rect={rect} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "tighten this" } });
  fireEvent.click(screen.getByRole("button", { name: /comment/i }));
  expect(onSubmit).toHaveBeenCalledWith("tighten this");
});

it("renders nothing without a rect", () => {
  const { container } = render(<CommentPopover rect={null} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/doccomments/CommentPopover.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/doccomments/CommentPopover.tsx
import { useState } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface Props {
  rect: DOMRect | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CommentPopover({ rect, onSubmit, onCancel, submitting }: Props) {
  const [text, setText] = useState("");
  if (!rect) return null;
  return (
    <div
      className="fixed z-50 w-72 rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-lg"
      style={{ top: rect.bottom + 6 + window.scrollY, left: rect.left + window.scrollX }}
    >
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Instruction for the reviewer persona…"
        className="mb-2 h-20 text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          disabled={!text.trim() || submitting}
          onClick={() => onSubmit(text.trim())}
        >
          {submitting ? "Adding…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
```

> Verify `../ui/textarea` and `../ui/button` exist (`ls src/components/ui`). If `textarea` is absent, add it via `npx shadcn@latest add textarea` (New York style) before implementing.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/doccomments/CommentPopover.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/doccomments/CommentPopover.tsx src/components/doccomments/CommentPopover.test.tsx
git commit -m "feat: CommentPopover — anchored instruction input"
```

---

### Task B6: `CommentSidebar` + status badges

**Files:**
- Create: `src/components/doccomments/CommentSidebar.tsx`
- Test: `src/components/doccomments/CommentSidebar.test.tsx`

**Interfaces:**
- Consumes: `DocComment` from `../../lib/docCommentsApi`; shadcn `Badge` from `../ui/badge`; `ApprovedEditCard` (Task B7) for `approved` comments.
- Produces: `<CommentSidebar comments={DocComment[]} onCommentClick={(id) => void} onApply={(id) => void} applyingId={string | null} />`. Lists each comment with a status badge, the instruction, resolution note (if resolved), a **stale** badge, and — for `approved` — the `ApprovedEditCard`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentSidebar } from "./CommentSidebar";
import type { DocComment } from "../../lib/docCommentsApi";

const c = (o: Partial<DocComment>): DocComment => ({
  id: "c1", doc_ref: {} as any, anchor: { quote: "q" } as any, comment: "tighten",
  author: "larry", status: "open", assignee_persona: null, proposed_edit: null,
  resolution_note: null, profile_id: "larry", created_at: "", resolved_at: null, ...o,
});

it("shows a stale badge for stale comments", () => {
  render(<CommentSidebar comments={[c({ status: "stale" })]} onCommentClick={vi.fn()} onApply={vi.fn()} applyingId={null} />);
  expect(screen.getByText(/stale/i)).toBeInTheDocument();
});

it("renders the instruction text", () => {
  render(<CommentSidebar comments={[c({})]} onCommentClick={vi.fn()} onApply={vi.fn()} applyingId={null} />);
  expect(screen.getByText("tighten")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/doccomments/CommentSidebar.test.tsx`
Expected: FAIL — module not found (and/or ApprovedEditCard not found; implement B7 first if needed, or stub the import).

> Execution note: B6 imports `ApprovedEditCard` from B7. If executing strictly in order, create a minimal `ApprovedEditCard` stub in B6 and flesh it out in B7, OR reorder to do B7 before B6. Recommended: do **B7 before B6**.

- [ ] **Step 3: Implement**

```tsx
// src/components/doccomments/CommentSidebar.tsx
import { Badge } from "../ui/badge";
import type { DocComment, DocCommentStatus } from "../../lib/docCommentsApi";
import { ApprovedEditCard } from "./ApprovedEditCard";

const BADGE: Record<DocCommentStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-500/20 text-amber-300" },
  acked: { label: "Acked", className: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Approved", className: "bg-emerald-500/20 text-emerald-300" },
  resolved: { label: "Resolved", className: "bg-emerald-500/10 text-emerald-400" },
  stale: { label: "Stale", className: "bg-zinc-600/30 text-zinc-400" },
};

interface Props {
  comments: DocComment[];
  onCommentClick: (id: string) => void;
  onApply: (id: string) => void;
  applyingId: string | null;
}

export function CommentSidebar({ comments, onCommentClick, onApply, applyingId }: Props) {
  if (comments.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No comments yet. Highlight text to add one.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-zinc-800">
      {comments.map((c) => {
        const b = BADGE[c.status];
        return (
          <div key={c.id} className="cursor-pointer p-3 hover:bg-zinc-900/50"
               onClick={() => onCommentClick(c.id)}>
            <div className="mb-1 flex items-center justify-between">
              <Badge className={b.className}>{b.label}</Badge>
              <span className="text-xs text-muted-foreground">{c.author}</span>
            </div>
            <p className="text-sm text-zinc-200">{c.comment}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">“{c.anchor.quote}”</p>
            {c.status === "approved" && (
              <ApprovedEditCard comment={c} onApply={onApply} applying={applyingId === c.id} />
            )}
            {c.status === "resolved" && c.resolution_note && (
              <p className="mt-1 text-xs text-emerald-400/80">✓ {c.resolution_note}</p>
            )}
            {c.status === "stale" && (
              <p className="mt-1 text-xs text-zinc-400">Anchor no longer matches — re-comment on current text.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

> Verify `../ui/badge` exists; if not, `npx shadcn@latest add badge`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/doccomments/CommentSidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/doccomments/CommentSidebar.tsx src/components/doccomments/CommentSidebar.test.tsx
git commit -m "feat: CommentSidebar with status badges + stale/resolution copy"
```

---

### Task B7: `ApprovedEditCard` — inline word-diff + Apply (do BEFORE B6)

**Files:**
- Create: `src/components/doccomments/ApprovedEditCard.tsx`
- Test: `src/components/doccomments/ApprovedEditCard.test.tsx`

**Interfaces:**
- Consumes: `diffWords` from `diff`; shadcn `Button`; `DocComment`.
- Produces: `<ApprovedEditCard comment={DocComment} onApply={(id) => void} applying={boolean} />`. Renders an inline word-diff of the anchored span (`comment.anchor.quote`, the "before") vs `comment.proposed_edit` ("after"), plus an **Apply** button.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApprovedEditCard } from "./ApprovedEditCard";
import type { DocComment } from "../../lib/docCommentsApi";

const comment = {
  id: "c1", status: "approved", proposed_edit: "validate and sanitize inputs",
  anchor: { quote: "validate inputs" }, comment: "x", author: "l",
} as unknown as DocComment;

it("renders a word-diff and fires Apply", () => {
  const onApply = vi.fn();
  render(<ApprovedEditCard comment={comment} onApply={onApply} applying={false} />);
  expect(screen.getByText(/sanitize/)).toBeInTheDocument();      // added word visible
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(onApply).toHaveBeenCalledWith("c1");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/doccomments/ApprovedEditCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/doccomments/ApprovedEditCard.tsx
import { diffWords } from "diff";
import { Button } from "../ui/button";
import type { DocComment } from "../../lib/docCommentsApi";

interface Props {
  comment: DocComment;
  onApply: (id: string) => void;
  applying: boolean;
}

export function ApprovedEditCard({ comment, onApply, applying }: Props) {
  const before = comment.anchor.quote;
  const after = comment.proposed_edit ?? "";
  const parts = diffWords(before, after);
  return (
    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2"
         onClick={(e) => e.stopPropagation()}>
      <p className="mb-1 text-xs font-semibold text-emerald-300">Proposed edit</p>
      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
        {parts.map((p, i) => (
          <span key={i}
            className={p.added ? "bg-emerald-600/40 text-emerald-100"
              : p.removed ? "bg-red-600/30 text-red-200 line-through" : "text-zinc-300"}>
            {p.value}
          </span>
        ))}
      </p>
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={applying} onClick={() => onApply(comment.id)}>
          {applying ? "Applying…" : "Apply edit"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/doccomments/ApprovedEditCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/doccomments/ApprovedEditCard.tsx src/components/doccomments/ApprovedEditCard.test.tsx
git commit -m "feat: ApprovedEditCard — inline word-diff + Apply button"
```

---

### Task B8: `DocComments` page — doc-picker + 3-pane composition

**Files:**
- Create: `src/pages/DocComments.tsx`
- Test: `src/pages/DocComments.test.tsx`

**Interfaces:**
- Consumes: `listDocs`, `readDoc`, `createComment`, `applyComment`, types from `../lib/docCommentsApi`; `useDocComments`; `DocViewer`, `CommentPopover`, `CommentSidebar`; `useProfileConfigs` from `../hooks/useProfileConfigs` (for `profile_id`); shadcn `Select`.
- Produces: default-exported `DocComments` page. Left: doc picker (from `listDocs`). Center: `DocViewer` for the selected doc's content. Right: `CommentSidebar`. Manages selection → popover → `createComment` → `refetch`, and Apply → `applyComment` → `refetch`.

`profile_id`: `const profileId = useProfileConfigs()[0]?.profileId ?? "personal";` (single wiring point; adjust if a global active-profile selector exists).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as api from "../lib/docCommentsApi";
import DocComments from "./DocComments";

vi.mock("../hooks/useProfileConfigs", () => ({ useProfileConfigs: () => [{ profileId: "larry" }] }));

describe("DocComments page", () => {
  beforeEach(() => {
    vi.spyOn(api, "listDocs").mockResolvedValue({
      docs: [{ repo: "astridr", path: ".planning/x-SPEC.md", doc_type: "gsd_spec" }], count: 1,
    });
    vi.spyOn(api, "readDoc").mockResolvedValue({ repo: "astridr", path: ".planning/x-SPEC.md", content: "# Doc", doc_hash: "h" });
    vi.spyOn(api, "listCommentsForDoc").mockResolvedValue({ comments: [], count: 0 });
  });

  it("loads the doc list and renders the first doc", async () => {
    render(<DocComments />);
    await waitFor(() => expect(api.listDocs).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Doc" })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/DocComments.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/pages/DocComments.tsx
import { useCallback, useEffect, useState } from "react";
import {
  listDocs, readDoc, createComment, applyComment,
  type Anchor, type DocContent, type DocListItem,
} from "../lib/docCommentsApi";
import { useDocComments } from "../hooks/useDocComments";
import { useProfileConfigs } from "../hooks/useProfileConfigs";
import { DocViewer } from "../components/doccomments/DocViewer";
import { CommentPopover } from "../components/doccomments/CommentPopover";
import { CommentSidebar } from "../components/doccomments/CommentSidebar";

export default function DocComments() {
  const profileId = (useProfileConfigs()[0] as { profileId?: string })?.profileId ?? "personal";
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [active, setActive] = useState<DocListItem | null>(null);
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [pending, setPending] = useState<{ anchor: Anchor; rect: DOMRect } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { comments, refetch } = useDocComments(
    profileId, active?.repo ?? "", active?.path ?? "",
  );

  useEffect(() => {
    listDocs(profileId)
      .then((r) => { setDocs(r.docs); setActive((a) => a ?? r.docs[0] ?? null); })
      .catch((e) => setError(e.message));
  }, [profileId]);

  useEffect(() => {
    if (!active) { setDoc(null); return; }
    readDoc(active.repo, active.path).then(setDoc).catch((e) => setError(e.message));
  }, [active]);

  const submitComment = useCallback(async (text: string) => {
    if (!pending || !active || !doc) return;
    setSubmitting(true);
    try {
      await createComment({
        doc_ref: { repo: active.repo, path: active.path, doc_type: "gsd_spec", doc_hash: doc.doc_hash },
        anchor: pending.anchor, comment: text, author: "larry", profile_id: profileId,
      });
      setPending(null);
      refetch();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  }, [pending, active, doc, profileId, refetch]);

  const onApply = useCallback(async (id: string) => {
    setApplyingId(id);
    try { await applyComment(id); refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setApplyingId(null); }
  }, [refetch]);

  return (
    <div className="grid h-full grid-cols-[240px_1fr_320px] overflow-hidden">
      <aside className="overflow-y-auto border-r border-zinc-800 p-2">
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">GSD Docs</h2>
        {docs.map((d) => (
          <button key={`${d.repo}/${d.path}`}
            onClick={() => setActive(d)}
            className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
              active?.path === d.path && active?.repo === d.repo ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-300 hover:bg-zinc-900"}`}>
            <span className="text-zinc-500">{d.repo}/</span>{d.path.replace(".planning/", "")}
          </button>
        ))}
      </aside>

      <main className="relative overflow-y-auto">
        {error && <div className="m-3 rounded bg-red-500/10 p-2 text-xs text-red-300">{error}</div>}
        {doc
          ? <DocViewer source={doc.content} comments={comments}
              onSelectAnchor={(anchor, rect) => setPending({ anchor, rect })}
              onCommentClick={(id) => { const el = document.querySelector(`[data-comment-id="${id}"]`); el?.scrollIntoView({ block: "center" }); }} />
          : <p className="p-6 text-sm text-muted-foreground">Select a document.</p>}
        <CommentPopover rect={pending?.rect ?? null} submitting={submitting}
          onSubmit={submitComment} onCancel={() => setPending(null)} />
      </main>

      <aside className="overflow-y-auto border-l border-zinc-800">
        <CommentSidebar comments={comments} applyingId={applyingId} onApply={onApply}
          onCommentClick={(id) => { const el = document.querySelector(`mark[data-comment-id="${id}"]`); el?.scrollIntoView({ block: "center" }); }} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/pages/DocComments.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DocComments.tsx src/pages/DocComments.test.tsx
git commit -m "feat: DocComments page — picker + viewer + sidebar composition"
```

---

### Task B9: Route + nav wiring

**Files:**
- Modify: `src/App.tsx` (lazy import + `<Route>`)
- Modify: `src/layouts/DashboardLayout.tsx` (nav entry + iconMap)
- Test: extend `src/App.test.tsx` if it asserts routes, else rely on `tsc`.

**Interfaces:** Consumes `DocComments` default export. Route path `/doc-comments`.

- [ ] **Step 1: Add the lazy import + route in `src/App.tsx`**

Near the other `lazy(...)` lines (around line 58):

```tsx
const DocComments = lazy(() => import("./pages/DocComments"));
```

In the `<Routes>` block, alongside the KnowledgeGraph route:

```tsx
<Route path="/doc-comments" element={<DocComments />} />
```

- [ ] **Step 2: Add the nav entry in `src/layouts/DashboardLayout.tsx`**

In the `COMMAND` group's `items` array (after the `Skills` entry, ~line 145):

```tsx
{ to: "/doc-comments", label: "Doc Review", icon: "message-square-text", group: "COMMAND" },
```

Then map the icon. Find the `iconMap` object (grep for `iconMap` / the Lucide imports) and add:

```tsx
import { MessageSquareText } from "lucide-react"; // add to the existing lucide import
// in iconMap:
"message-square-text": MessageSquareText,
```

- [ ] **Step 3: Type-check + build the route**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (existing app test still green).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/layouts/DashboardLayout.tsx
git commit -m "feat: register /doc-comments route + COMMAND nav entry"
```

---

### Task B10: Full frontend gate + optional Playwright smoke

**Files:** none new (validation task); optional `e2e/doc-comments.spec.ts`.

- [ ] **Step 1: Run the whole unit suite for the new surface**

Run: `npx vitest run src/lib/docCommentsApi.test.ts src/lib/docAnchor.test.ts src/hooks/useDocComments.test.ts src/components/doccomments src/pages/DocComments.test.tsx`
Expected: all PASS.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3 (optional): Playwright smoke**

Only with the live stack (Ástríðr on :8181 + Supabase :55432). Create `e2e/doc-comments.spec.ts` that loads `/doc-comments`, asserts the doc list renders and the first doc's markdown is visible. Run: `npm run test:e2e -- doc-comments`. Skip if the stack isn't up — note it in the PR.

- [ ] **Step 4: Commit (if e2e added)**

```bash
git add e2e/doc-comments.spec.ts
git commit -m "test(e2e): doc-comments surface smoke test"
```

**Part B done.** Open a PR from `feat/doc-comment-hitl-ui`.

---

## End-to-end verification (both PRs merged, live stack up)

1. Start Ástríðr web channel (:8181) + local Supabase (:55432, `doc_comments` applied) + `npm run dev` + `npm run dev:backend`.
2. Open `/doc-comments`, pick a GSD spec → it renders (sanitized).
3. Highlight a line → popover → type an instruction → Submit → the comment appears in the sidebar as **Open** with an amber underline; a row exists in `doc_comments`.
4. Run the reviewer (`run_doc_comment_reviewer`) → the comment flips to **Approved** with a stored `proposed_edit`; the sidebar shows the word-diff.
5. Click **Apply** → the edit lands in the real doc (verify the file changed), the comment flips to **Resolved** with the note, the underline clears.
6. Edit the doc so an anchor orphans → that comment shows **Stale**, never mis-applied.
7. `curl` any `/api/doc-comments/*` route without a Bearer token → `401`.

---

## Self-review notes (author)

- **Spec coverage:** DCH-09 → B4 (sanitized render). DCH-10 → B2 (anchor capture) + B4 (selection) + B5 (popover) + B8 (create). DCH-11 → B6 (status badges + stale) + B4 (underlines). Backend gaps → A1–A5. Apply model → A5 + B7. Doc picker → A2 + B8. Auth fail-closed → A6.
- **Refinement vs spec:** dropped client-side `computeDocHash` — the doc-read endpoint (A3) returns `doc_hash`; the client carries it into `createComment`. Simpler, one source of truth.
- **Execution ordering caveat:** B7 (`ApprovedEditCard`) must land before B6 (`CommentSidebar` imports it). Noted in B6.
- **Two assumptions to verify at execution time (not blockers):** (1) `atomic_io`'s public write function name — Step A5.1 checks it. (2) CodePulse's active-profile source — B8 uses `useProfileConfigs()[0]`; swap for a global selector if one exists.
- **Type consistency:** `Anchor`/`DocComment`/`DocCommentStatus` defined once in B1, imported everywhere; backend `Anchor` fields match the TS shape 1:1.
