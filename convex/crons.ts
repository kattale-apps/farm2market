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

crons.interval(
  "check ETA notifications",
  { minutes: 15 },
  internal.scheduled.checkEtaNotifications,
);

// Expire stale negotiations every 6 hours (7-day threshold)
crons.interval(
  "expire stale negotiations",
  { hours: 6 },
  internal.scheduled.expireStaleNegotiations,
);

// Archive old completed/cancelled listings once per day (30-day threshold)
crons.interval(
  "archive old listings",
  { hours: 24 },
  internal.scheduled.archiveOldListings,
);

// Purge junk session/token/rateLimit rows once per day (30-day threshold)
crons.interval(
  "purge junk rows",
  { hours: 24 },
  internal.scheduled.purgeJunkRows,
);

export default crons;
