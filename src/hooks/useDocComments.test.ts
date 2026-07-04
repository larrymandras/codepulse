import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as api from "../lib/docCommentsApi";
import { useDocComments } from "./useDocComments";

describe("useDocComments", () => {
  // Repo convention (see src/lib/docCommentsApi.test.ts): vi.spyOn call/mock
  // history is not reset between tests unless explicitly restored, since
  // vitest.config.ts doesn't set clearMocks/restoreMocks globally.
  beforeEach(() => vi.restoreAllMocks());

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

  it("does not update state after unmount when fetch resolves late", async () => {
    // Deferred promise so we control exactly when listCommentsForDoc resolves,
    // letting us unmount while the fetch is still in flight.
    let resolveFetch: (v: { comments: api.DocComment[]; count: number }) => void;
    const deferred = new Promise<{ comments: api.DocComment[]; count: number }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(api, "listCommentsForDoc").mockReturnValue(deferred);

    const { unmount } = renderHook(() =>
      useDocComments("larry", "astridr", ".planning/x-SPEC.md"),
    );

    // Unmount before the in-flight fetch resolves — mountedRef flips false.
    unmount();

    // Resolving now would previously call setComments/setLoading on a torn-down
    // hook. This should not throw or produce an act() warning.
    resolveFetch!({ comments: [{ id: "c1", status: "open" } as api.DocComment], count: 1 });
    await expect(deferred).resolves.toEqual({
      comments: [{ id: "c1", status: "open" }],
      count: 1,
    });
  });
});
