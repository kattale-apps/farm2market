/**
 * Pilot Setup - Create Test Users
 * 
 * ⚠️ PILOT ONLY - Creates test users with shared password
 * Run this once to set up all pilot test users
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";

/**
 * Create all pilot test users at once
 * 
 * Creates:
 * - 2 farmers
 * - 2 traders
 * - 1 buyer
 * - 1 admin
 * 
 * All users share the same password: Farm2Market2024
 */
export const createPilotUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const users = [
      // Farmers
      { email: "farmer1@pilot.farm2market", role: "farmer" as const },
      { email: "farmer2@pilot.farm2market", role: "farmer" as const },
      
      // Traders
      { email: "trader1@pilot.farm2market", role: "trader" as const },
      { email: "trader2@pilot.farm2market", role: "trader" as const },
      
      // Buyer
      { email: "buyer1@pilot.farm2market", role: "buyer" as const },
      
      // Admin
      { email: "admin@pilot.farm2market", role: "admin" as const },
    ];

    const created = [];
    const errors = [];

    for (const userData of users) {
      try {
        // Check if user already exists
        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", userData.email))
          .first();

        if (existing) {
          errors.push(`${userData.email} already exists`);
          continue;
        }

        // Generate alias
        const random = Math.random().toString(36).substring(2, 8);
        const alias = `${userData.role}_${random}`;

        // Hash the shared pilot password
        const password = "Farm2Market2024";
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
          const char = password.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const passwordHash = hash.toString(36);

        // Create user
        const userId = await ctx.db.insert("users", {
          email: userData.email,
          role: userData.role,
          alias,
          state: "active", // Initial state for new users
          createdAt: getUgandaTime(),
          lastActiveAt: getUgandaTime(),
          passwordHash,
          // Set adminLevel to "super" for admin users
          ...(userData.role === "admin" && { adminLevel: "super" as const }),
        });

        created.push({
          email: userData.email,
          role: userData.role,
          alias,
          userId,
        });
      } catch (error: any) {
        errors.push(`${userData.email}: ${error.message}`);
      }
    }

    return {
      created,
      errors,
      totalCreated: created.length,
      totalErrors: errors.length,
      sharedPassword: "Farm2Market2024",
    };
  },
});

/**
 * Fix existing admin user to have superadmin level
 * 
 * Updates admin@pilot.farm2market to have adminLevel = "super"
 */
export const fixAdminLevel = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@pilot.farm2market"))
      .first();

    if (!admin) {
      return { error: "Admin user not found" };
    }

    if (admin.adminLevel === "super") {
      return { message: "Admin already has superadmin level", adminLevel: admin.adminLevel };
    }

    await ctx.db.patch(admin._id, {
      adminLevel: "super" as const,
    });

    return {
      message: "Admin level updated to super",
      email: admin.email,
      alias: admin.alias,
      oldLevel: admin.adminLevel,
      newLevel: "super",
    };
  },
});
