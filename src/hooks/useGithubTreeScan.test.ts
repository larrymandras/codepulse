import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGithubTreeScan } from "./useGithubTreeScan";

describe("useGithubTreeScan", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transitions idle -> scanning -> done (with result) once the mocked fetch resolves", async () => {
    const mockTree = { tree: [{ type: "blob", path: "SKILL.md" }], truncated: false };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useGithubTreeScan());
    expect(result.current.status).toBe("idle");

    act(() => {
      void result.current.scan("owner/repo");
    });
    expect(result.current.status).toBe("scanning");

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.status).toBe("done");
    if (result.current.status === "done") {
      expect(result.current.result.skillPaths).toEqual(["SKILL.md"]);
      expect(result.current.result.truncated).toBe(false);
    }
  });

  it("transitions idle -> scanning -> error when the mocked fetch rejects", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useGithubTreeScan());

    act(() => {
      void result.current.scan("owner/repo");
    });
    expect(result.current.status).toBe("scanning");

    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.errorMessage).toBe("network error");
    }
  });

  it("transitions idle -> scanning -> error when fetch resolves not-ok", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useGithubTreeScan());

    act(() => {
      void result.current.scan("owner/repo");
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.errorMessage).toBe("repository not found or private");
    }
  });

  it("retries against HEAD when the extracted ref 404s, so a slash-branch URL still scans (review #2)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      // /git/trees/release 404s — the ref extractor stopped at the first slash
      // of the real branch "release/1.0".
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      // /git/trees/HEAD (default branch) succeeds.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tree: [{ type: "blob", path: "SKILL.md" }],
          truncated: false,
        }),
      });

    const { result } = renderHook(() => useGithubTreeScan());
    await act(async () => {
      await result.current.scan("https://github.com/owner/repo/tree/release/1.0");
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    if (result.current.status === "done") {
      expect(result.current.result.skillPaths).toEqual(["SKILL.md"]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/git/trees/release?recursive=1");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/git/trees/HEAD?recursive=1");
  });

  it("still errors when both the extracted ref and the HEAD retry 404 (review #2)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    const { result } = renderHook(() => useGithubTreeScan());
    await act(async () => {
      await result.current.scan("https://github.com/owner/repo/tree/release/1.0");
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("transitions directly to error without ever calling fetch when input fails extractOwnerRepoRef", async () => {
    const { result } = renderHook(() => useGithubTreeScan());

    await act(async () => {
      await result.current.scan("not a url");
    });

    expect(result.current.status).toBe("error");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reset() during an in-flight scan discards the stale response (WR-05 regression)", async () => {
    let resolveFetch!: (value: unknown) => void;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useGithubTreeScan());
    act(() => {
      void result.current.scan("owner/repo-a");
    });
    expect(result.current.status).toBe("scanning");

    // User edits the URL — the modal resets the scan state machine.
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");

    // Repo A's slow response finally lands — it must NOT overwrite state.
    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ type: "blob", path: "SKILL.md" }], truncated: false }),
      });
    });
    expect(result.current.status).toBe("idle");
  });

  it("a newer scan supersedes an older in-flight scan's response (WR-05 regression)", async () => {
    let resolveA!: (value: unknown) => void;
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveA = resolve;
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ type: "blob", path: "b/SKILL.md" }], truncated: false }),
      });

    const { result } = renderHook(() => useGithubTreeScan());
    act(() => {
      void result.current.scan("owner/repo-a");
    });
    await act(async () => {
      await result.current.scan("owner/repo-b");
    });
    await waitFor(() => expect(result.current.status).toBe("done"));

    // Repo A's response lands late — repo B's result must survive.
    await act(async () => {
      resolveA({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ type: "blob", path: "a/SKILL.md" }], truncated: false }),
      });
    });
    expect(result.current.status).toBe("done");
    if (result.current.status === "done") {
      expect(result.current.result.skillPaths).toEqual(["b/SKILL.md"]);
    }
  });

  it("returns a referentially stable object across re-renders when state is unchanged (CR-01 regression)", () => {
    const { result, rerender } = renderHook(() => useGithubTreeScan());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("reset() returns state to idle", async () => {
    const mockTree = { tree: [], truncated: false };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useGithubTreeScan());
    await act(async () => {
      await result.current.scan("owner/repo");
    });
    expect(result.current.status).toBe("done");

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");
  });
});
