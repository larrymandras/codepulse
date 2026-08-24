// D-09/D-10 (126-03): these tests exercise the REAL CRON_SCHEDULES catalog
// and the real cronToHuman/isValidCron implementations — no vi.mock of
// either module. src/pages/__tests__/Automation.test.tsx mocks
// `../../lib/cronSchedules` with the SAME human-string shape the real data
// has, which is exactly why the suite stayed green while all twelve rows
// rendered "Invalid expression" in production. Reproducing that mock here
// would reproduce the blind spot.
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import CronJobList, { type CronJob } from "./CronJobList";
import { CRON_SCHEDULES, schedulesToCronJobs } from "@/lib/cronSchedules";
import { isValidCron } from "@/lib/cronToHuman";

function noop() {}

describe("CronJobList — real CRON_SCHEDULES catalog (D-09)", () => {
  it("CRON_SCHEDULES.filter(s => isValidCron(s.interval)) has length 0 on the real catalog", () => {
    const validOnes = CRON_SCHEDULES.filter((s) => isValidCron(s.interval));
    expect(validOnes).toHaveLength(0);
  });

  it("renders all twelve catalog rows", () => {
    render(
      <CronJobList
        jobs={schedulesToCronJobs()}
        onTrigger={noop}
        onToggle={noop}
        onEdit={noop}
      />
    );
    expect(CRON_SCHEDULES).toHaveLength(12);
    for (const s of CRON_SCHEDULES) {
      expect(screen.getByText(s.jobName)).toBeInTheDocument();
    }
  });

  it('the "purge old telemetry events" row renders "Daily 03:00 UTC" exactly once', () => {
    render(
      <CronJobList
        jobs={schedulesToCronJobs()}
        onTrigger={noop}
        onToggle={noop}
        onEdit={noop}
      />
    );
    const rowLabel = screen.getByText("purge old telemetry events");
    const row = rowLabel.closest("div.flex.items-center.gap-3") as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getAllByText("Daily 03:00 UTC")).toHaveLength(1);
    expect(within(row).queryByText("Invalid expression")).not.toBeInTheDocument();
  });

  it("no catalog row ever renders the string \"Invalid expression\"", () => {
    render(
      <CronJobList
        jobs={schedulesToCronJobs()}
        onTrigger={noop}
        onToggle={noop}
        onEdit={noop}
      />
    );
    expect(screen.queryByText("Invalid expression")).not.toBeInTheDocument();
  });

  it("POSITIVE CONTROL: a job with a genuine cron expression renders both the raw expression and its human gloss", () => {
    const jobs: CronJob[] = [{ name: "real", expression: "0 3 * * *" }];
    render(<CronJobList jobs={jobs} onTrigger={noop} onToggle={noop} onEdit={noop} />);
    expect(screen.getByText("0 3 * * *")).toBeInTheDocument();
    expect(screen.getByText("Every day at 3:00")).toBeInTheDocument();
  });
});

describe("CronJobList — dead edit affordance retired for catalog rows (D-10)", () => {
  it("clicking a catalog row (non-cron expression) does NOT invoke onEdit", () => {
    const onEdit = vi.fn();
    render(
      <CronJobList
        jobs={schedulesToCronJobs()}
        onTrigger={noop}
        onToggle={noop}
        onEdit={onEdit}
      />
    );
    const rowLabel = screen.getByText("stale sessions");
    const jobInfo = rowLabel.closest("div.cursor-pointer, div.flex.flex-col.gap-0\\.5") as HTMLElement;
    // The job-info block for a catalog row must not carry the clickable
    // affordance at all -- assert there is no cursor-pointer class on it.
    expect(jobInfo.className).not.toMatch(/cursor-pointer/);
    jobInfo.click();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("CONTROL: clicking a row with a REAL cron expression still invokes onEdit and carries the click affordance", () => {
    const onEdit = vi.fn();
    const jobs: CronJob[] = [{ name: "real", expression: "*/5 * * * *" }];
    render(<CronJobList jobs={jobs} onTrigger={noop} onToggle={noop} onEdit={onEdit} />);
    const rowLabel = screen.getByText("real");
    const jobInfo = rowLabel.closest("div") as HTMLElement;
    expect(jobInfo.className).toMatch(/cursor-pointer/);
    jobInfo.click();
    expect(onEdit).toHaveBeenCalledWith(jobs[0]);
  });
});
