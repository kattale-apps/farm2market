/**
 * Scheduled Cron Jobs
 * 
 * Defines scheduled functions that run automatically on a schedule.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run expired UTID check every 5 minutes
// This checks for UTIDs that are overdue by 1 hour and automatically expires them
crons.interval(
  "check expired UTIDs",
  { minutes: 5 }, // Run every 5 minutes
  internal.scheduled.checkExpiredUTIDs,
);

export default crons;
