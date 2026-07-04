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
