/**
 * Seed Uganda Administrative Units
 * 
 * This mutation populates the database with Uganda's administrative divisions
 * (Districts, Subcounties, Parishes) from official sources.
 * 
 * SuperAdmin only - Run once to initialize location data
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminRole } from "./auth";
import { generateUTID, getUgandaTime } from "./utils";
import { UGANDA_DISTRICTS, UGANDA_SUBCOUNTIES, UGANDA_PARISHES } from "./ugandaLocationsData";
import { Id } from "./_generated/dataModel";

/**
 * Seed all Uganda administrative units
 * This will create districts, subcounties, and parishes from the data file
 */
export const seedUgandaLocations = mutation({
  args: {
    adminId: v.id("users"),
    skipExisting: v.optional(v.boolean()), // If true, skip districts/subcounties/parishes that already exist
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can seed location data");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    const results = {
      districtsCreated: 0,
      districtsSkipped: 0,
      subcountiesCreated: 0,
      subcountiesSkipped: 0,
      parishesCreated: 0,
      parishesSkipped: 0,
      errors: [] as string[],
    };

    const districtMap = new Map<string, Id<"districts">>();
    const subcountyMap = new Map<string, Id<"subcounties">>();

    // Step 1: Create all districts
    for (const district of UGANDA_DISTRICTS) {
      try {
        // Check if district already exists
        const existing = await ctx.db
          .query("districts")
          .withIndex("by_code", (q) => q.eq("code", district.code))
          .first();

        if (existing) {
          if (args.skipExisting) {
            results.districtsSkipped++;
            districtMap.set(district.code, existing._id);
            continue;
          } else {
            throw new Error(`District ${district.name} (${district.code}) already exists`);
          }
        }

        // Create district
        const utid = generateUTID(adminUser.role);
        const districtId = await ctx.db.insert("districts", {
          name: district.name,
          code: district.code,
          active: true,
          order: district.order,
          createdAt: getUgandaTime(),
          createdBy: args.adminId,
          utid,
        });

        districtMap.set(district.code, districtId);
        results.districtsCreated++;

        // Log admin action
        await ctx.db.insert("adminActions", {
          adminId: args.adminId,
          actionType: "create_district",
          utid,
          reason: `Seeded district: ${district.name} (${district.code})`,
          timestamp: getUgandaTime(),
        });
      } catch (error: any) {
        results.errors.push(`District ${district.name}: ${error.message}`);
      }
    }

    // Step 2: Create subcounties
    for (const [districtCode, subcounties] of Object.entries(UGANDA_SUBCOUNTIES)) {
      const districtId = districtMap.get(districtCode);
      if (!districtId) {
        results.errors.push(`District ${districtCode} not found for subcounties`);
        continue;
      }

      for (const subcounty of subcounties) {
        try {
          // Check if subcounty already exists
          const existing = await ctx.db
            .query("subcounties")
            .withIndex("by_code", (q) => q.eq("code", subcounty.code))
            .first();

          if (existing) {
            if (args.skipExisting) {
              results.subcountiesSkipped++;
              subcountyMap.set(subcounty.code, existing._id);
              continue;
            } else {
              throw new Error(`Subcounty ${subcounty.name} (${subcounty.code}) already exists`);
            }
          }

          // Create subcounty
          const utid = generateUTID(adminUser.role);
          const subcountyId = await ctx.db.insert("subcounties", {
            districtId,
            name: subcounty.name,
            code: subcounty.code,
            active: true,
            order: subcounty.order,
            createdAt: getUgandaTime(),
            createdBy: args.adminId,
            utid,
          });

          subcountyMap.set(subcounty.code, subcountyId);
          results.subcountiesCreated++;

          // Log admin action
          await ctx.db.insert("adminActions", {
            adminId: args.adminId,
            actionType: "create_subcounty",
            utid,
            reason: `Seeded subcounty: ${subcounty.name} (${subcounty.code})`,
            timestamp: getUgandaTime(),
          });
        } catch (error: any) {
          results.errors.push(`Subcounty ${subcounty.name}: ${error.message}`);
        }
      }
    }

    // Step 3: Create parishes
    for (const [subcountyCode, parishes] of Object.entries(UGANDA_PARISHES)) {
      const subcountyId = subcountyMap.get(subcountyCode);
      if (!subcountyId) {
        results.errors.push(`Subcounty ${subcountyCode} not found for parishes`);
        continue;
      }

      for (const parish of parishes) {
        try {
          // Check if parish already exists
          const existing = await ctx.db
            .query("parishes")
            .withIndex("by_code", (q) => q.eq("code", parish.code))
            .first();

          if (existing) {
            if (args.skipExisting) {
              results.parishesSkipped++;
              continue;
            } else {
              throw new Error(`Parish ${parish.name} (${parish.code}) already exists`);
            }
          }

          // Create parish
          const utid = generateUTID(adminUser.role);
          await ctx.db.insert("parishes", {
            subcountyId,
            name: parish.name,
            code: parish.code,
            active: true,
            order: parish.order,
            createdAt: getUgandaTime(),
            createdBy: args.adminId,
            utid,
          });

          results.parishesCreated++;

          // Log admin action
          await ctx.db.insert("adminActions", {
            adminId: args.adminId,
            actionType: "create_parish",
            utid,
            reason: `Seeded parish: ${parish.name} (${parish.code})`,
            timestamp: getUgandaTime(),
          });
        } catch (error: any) {
          results.errors.push(`Parish ${parish.name}: ${error.message}`);
        }
      }
    }

    return {
      success: true,
      message: `Seeding completed. Created: ${results.districtsCreated} districts, ${results.subcountiesCreated} subcounties, ${results.parishesCreated} parishes.`,
      ...results,
    };
  },
});
