import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReplayButton from "@/components/ReplayButton";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  }));
});

describe("ReplayButton", () => {
  test("bug_002_includes_authorization_header_in_replay_request", async () => {
    render(<ReplayButton executionId="exec-42" profileId="profile-1" disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /replay/i }));
    fireEvent.click(screen.getByRole("button", { name: /re-run/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers).toBeDefined();
    expect(init.headers["Authorization"]).toMatch(/^Bearer .+/);
  });
});
