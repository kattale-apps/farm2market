/**
 * Scheduled Cron Jobs
 * 
 * Defines scheduled functions that run automatically on a schedule.
 */

import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

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

crons.interval(
  "send spray reminders",
  { hours: 1 },
  (internal as any).fertilizerPlanner.sendSprayReminders,
);

// Daily price snapshot publishing is switched off for now (see
// SNAPSHOT_PUBLISHING_ENABLED in marketPrices.ts). To turn it back on,
// restore this cron:
// crons.daily("freeze daily price snapshot", { hourUTC: 21, minuteUTC: 0 }, internal.marketPrices.freezeDailySnapshot);

// Refresh the buyer wallet's UGX -> USD/GBP/EUR exchange rates twice a day
// (the free source API itself only updates once every 24h, so this is
// just a safety margin against a missed/failed fetch).
crons.interval(
  "refresh currency exchange rates",
  { hours: 12 },
  api.exchangeRates.fetchLatestRates,
);

// Diagnostics: weekly iNaturalist photo import into the review queue.
// Does nothing unless a super admin has switched the import on.
// Mondays 01:00 UTC = 04:00 Uganda time.
crons.weekly(
  "diagnostics photo import",
  { dayOfWeek: "monday", hourUTC: 1, minuteUTC: 0 },
  internal.diagnosticsImport.runScheduledImport,
);

// Export Markets price ticker: the ICO monthly composite price, once a day.
crons.interval(
  "refresh ICO composite coffee price",
  { hours: 24 },
  internal.exportPrices.refreshIcoComposite,
);

export default crons;
