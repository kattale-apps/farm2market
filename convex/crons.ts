/**
 * Scheduled Cron Jobs
 * 
 * Defines scheduled functions that run automatically on a schedule.
 * 
 * NOTE: Currently disabled until scheduled module is properly registered.
 * To enable, ensure scheduled.ts is properly imported in the Convex API.
 */

import { cronJobs } from "convex/server";
// import { internal } from "./_generated/api";

const crons = cronJobs();

// Run expired UTID check every 5 minutes
// This checks for UTIDs that are overdue by 1 hour and automatically expires them
// TODO: Re-enable once scheduled module is properly registered
// crons.interval(
//   "check expired UTIDs",
//   { minutes: 5 }, // Run every 5 minutes
//   internal.scheduled.checkExpiredUTIDs,
// );

export default crons;
