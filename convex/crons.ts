import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "auto-acknowledge stale alerts",
  { hours: 1 },
  internal.alerts.autoAcknowledgeStaleInternal
);

export default crons;
