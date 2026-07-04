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

  it("clears stale doc content immediately when switching docs (no stale doc_hash race)", async () => {
    vi.spyOn(api, "listDocs").mockResolvedValue({
      docs: [
        { repo: "astridr", path: ".planning/a-SPEC.md", doc_type: "gsd_spec" },
        { repo: "astridr", path: ".planning/b-SPEC.md", doc_type: "gsd_spec" },
      ],
      count: 2,
    });

    // First call (doc A) resolves immediately; second call (doc B) is held
    // open via a controllable promise so we can inspect state mid-flight.
    // (Use a holder object rather than a reassigned `let` — TS's control-flow
    // narrowing across the nested Promise-executor closure otherwise types
    // the later `resolveB?.()` call as `never`.)
    const bResolver: { resolve: ((v: api.DocContent) => void) | null } = { resolve: null };
    const readDocSpy = vi.spyOn(api, "readDoc").mockImplementation((repo: string, path: string) => {
      if (path === ".planning/a-SPEC.md") {
        return Promise.resolve({ repo, path, content: "# Doc A", doc_hash: "hash-a" });
      }
      return new Promise<api.DocContent>((resolve) => { bResolver.resolve = resolve; });
    });

    render(<DocComments />);

    // Doc A loads first (auto-selected as the first doc in the list).
    await waitFor(() => expect(screen.getByRole("heading", { name: "Doc A" })).toBeInTheDocument());

    // Switch to doc B — its readDoc call is still pending.
    screen.getByText((_, el) => el?.textContent === "astridr/b-SPEC.md").closest("button")?.click();

    // While B's fetch is in flight, doc A's content must NOT still be shown
    // (the effect clears `doc` synchronously on active-change), so the
    // "Select a document" placeholder should render instead.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Doc A" })).not.toBeInTheDocument());
    expect(screen.getByText(/select a document/i)).toBeInTheDocument();

    // Resolve doc B's fetch — now B's content should render.
    bResolver.resolve?.({ repo: "astridr", path: ".planning/b-SPEC.md", content: "# Doc B", doc_hash: "hash-b" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Doc B" })).toBeInTheDocument());

    expect(readDocSpy).toHaveBeenCalledWith("astridr", ".planning/a-SPEC.md");
    expect(readDocSpy).toHaveBeenCalledWith("astridr", ".planning/b-SPEC.md");
  });
});
