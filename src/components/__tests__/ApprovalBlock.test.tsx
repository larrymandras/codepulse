import { describe, test } from "vitest";

describe("ApprovalBlock", () => {
  test.todo("renders action description and agent name");
  test.todo("renders approve button with 'Approve' label");
  test.todo("renders reject button with 'Reject Request' label");
  test.todo("applies border-l-4 border-(--status-warn) for medium risk");
  test.todo("applies border-l-4 border-(--status-error) for high risk");
  test.todo("calls onApprove with requestId when approve clicked");
  test.todo("calls onReject with requestId when reject clicked");
  test.todo("collapses to 'Approved — sent to Ástríðr' after approve");
  test.todo("collapses to 'Rejected' after reject");
});
