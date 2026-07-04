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
