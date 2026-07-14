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

  it("transitions directly to error without ever calling fetch when input fails extractOwnerRepoRef", async () => {
    const { result } = renderHook(() => useGithubTreeScan());

    await act(async () => {
      await result.current.scan("not a url");
    });

    expect(result.current.status).toBe("error");
    expect(fetch).not.toHaveBeenCalled();
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
