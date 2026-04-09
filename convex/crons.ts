import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Morning digest — 6:00 AM UTC
crons.cron(
  "morning digest",
  "0 6 * * *",
  internal.digests.sendScheduledDigests,
  { digestTime: "morning" }
);

// Evening digest — 6:00 PM UTC
crons.cron(
  "evening digest",
  "0 18 * * *",
  internal.digests.sendScheduledDigests,
  { digestTime: "evening" }
);

export default crons;
