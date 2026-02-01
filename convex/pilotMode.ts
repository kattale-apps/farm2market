/**
 * Pilot Mode System
 * 
 * Global flag that blocks all mutations that move money or inventory
 * when pilotMode = true.
 * 
 * - Admin-controlled boolean
 * - When pilotMode = true:
 *   - All mutations that move money or inventory are blocked
 *   - Read-only access still allowed
 * - Admin actions still allowed
 * - Failures must be explicit and logged
 */

import { v } from "convex/values";
import { mutation, query, DatabaseReader } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { pilotModeActiveError, throwAppError, notAdminError } from "./errors";

/**
 * Get current pilot mode status
 */
export async function getPilotModeStatus(ctx: { db: DatabaseReader }): Promise<{
  pilotMode: boolean;
  setBy: string | null;
  setAt: number | null;
  reason: string | null;
  utid: string | null;
}> {
  // Get system settings (singleton pattern - should only be one record)
  const settings = await ctx.db.query("systemSettings").first();

  if (!settings) {
    // Default: pilot mode is OFF
    return {
      pilotMode: false,
      setBy: null,
      setAt: null,
      reason: null,
      utid: null,
    };
  }

  return {
    pilotMode: settings.pilotMode,
    setBy: settings.setBy,
    setAt: settings.setAt,
    reason: settings.reason,
    utid: settings.utid,
  };
}

/**
 * Check if pilot mode is active and throw if it is
 * 
 * This function should be called at the start of any mutation
 * that moves money or inventory (except admin actions).
 * 
 * @throws Error if pilot mode is active
 */
export async function checkPilotMode(ctx: { db: DatabaseReader }): Promise<void> {
  const status = await getPilotModeStatus(ctx);

  if (status.pilotMode) {
    // Standardized error - no internal details exposed
    throwAppError(pilotModeActiveError(status.reason || undefined));
  }
}

/**
 * Set pilot mode (admin only)
 * 
 * Creates or updates the system settings singleton.
 * All changes are logged with UTID and reason.
 */
export const setPilotMode = mutation({
  args: {
    adminId: v.id("users"),
    pilotMode: v.boolean(),
    reason: v.string(), // Required reason for setting flag
  },
  handler: async (ctx, args) => {
    // Verify admin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") {
      throwAppError(notAdminError());
    }

    // Generate UTID for this admin action
    const utid = generateUTID("admin");

    // Get existing settings (singleton pattern)
    const existing = await ctx.db.query("systemSettings").first();

    const now = getUgandaTime();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        pilotMode: args.pilotMode,
        setBy: args.adminId,
        setAt: now,
        reason: args.reason,
        utid,
      });
    } else {
      // Create new settings
      await ctx.db.insert("systemSettings", {
        pilotMode: args.pilotMode,
        setBy: args.adminId,
        setAt: now,
        reason: args.reason,
        utid,
      });
    }

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: args.pilotMode ? "enable_pilot_mode" : "disable_pilot_mode",
      utid: generateUTID("admin"), // Separate UTID for admin action log
      reason: args.reason,
      metadata: {
        pilotMode: args.pilotMode,
        previousPilotMode: existing?.pilotMode || false,
      },
      timestamp: now,
    });

    return {
      pilotMode: args.pilotMode,
      setBy: args.adminId,
      setAt: now,
      reason: args.reason,
      utid,
    };
  },
});

/**
 * Get pilot mode status (query - anyone can check)
 */
export const getPilotMode = query({
  handler: async (ctx) => {
    return await getPilotModeStatus(ctx);
  },
});
