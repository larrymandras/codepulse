import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CancelButton from "@/components/CancelButton";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }));
});

describe("CancelButton", () => {
  test("bug_001_includes_authorization_header_in_cancel_request", async () => {
    render(<CancelButton executionId="exec-42" />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers).toBeDefined();
    expect(init.headers["Authorization"]).toMatch(/^Bearer .+/);
  });
});
