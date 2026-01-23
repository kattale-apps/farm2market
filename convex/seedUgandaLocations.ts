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
import {
  UG_DISTRICTS,
  UG_COUNTIES,
  UG_SUBCOUNTIES,
  UG_PARISHES,
} from "./ugandaLocationsData";
import { Id } from "./_generated/dataModel";

/**
 * Seed all Uganda administrative units
 * This will create districts, subcounties, and parishes from the data file
 */
export const seedUgandaLocations = mutation({
  args: {
    adminId: v.id("users"),
    skipExisting: v.optional(v.boolean()), // If true, skip districts/subcounties/parishes that already exist
    stage: v.optional(v.union(v.literal("districts"), v.literal("subcounties"), v.literal("parishes"))),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
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
    const stage = args.stage ?? "districts";
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 500;

    const normalizeName = (name: string) => name.trim().toLowerCase();

    const existingDistricts = await ctx.db.query("districts").collect();
    const existingDistrictByName = new Map<string, Id<"districts">>();
    for (const district of existingDistricts) {
      existingDistrictByName.set(normalizeName(district.name), district._id);
    }

    const existingSubcounties = await ctx.db.query("subcounties").collect();
    const existingSubcountyByKey = new Map<string, Id<"subcounties">>();
    for (const subcounty of existingSubcounties) {
      const key = `${subcounty.districtId}:${normalizeName(subcounty.name)}`;
      existingSubcountyByKey.set(key, subcounty._id);
    }

    const existingParishes = await ctx.db.query("parishes").collect();
    const existingParishByKey = new Map<string, Id<"parishes">>();
    for (const parish of existingParishes) {
      const key = `${parish.subcountyId}:${normalizeName(parish.name)}`;
      existingParishByKey.set(key, parish._id);
    }

    const countyToDistrictDataId = new Map<string, string>();
    for (const county of UG_COUNTIES) {
      countyToDistrictDataId.set(county.id, county.district);
    }

    const subcountiesByDistrictDataId = new Map<string, Array<{ id: string; name: string }>>();
    for (const subcounty of UG_SUBCOUNTIES) {
      const districtDataId = countyToDistrictDataId.get(subcounty.county);
      if (!districtDataId) {
        results.errors.push(`County ${subcounty.county} missing district for subcounty ${subcounty.name}`);
        continue;
      }
      const list = subcountiesByDistrictDataId.get(districtDataId) || [];
      list.push({ id: subcounty.id, name: subcounty.name });
      subcountiesByDistrictDataId.set(districtDataId, list);
    }

    const parishesBySubcountyDataId = new Map<string, Array<{ id: string; name: string }>>();
    for (const parish of UG_PARISHES) {
      const list = parishesBySubcountyDataId.get(parish.subcounty) || [];
      list.push({ id: parish.id, name: parish.name });
      parishesBySubcountyDataId.set(parish.subcounty, list);
    }

    // Step 1: Create all districts (alphabetical order)
    const sortedDistricts = [...UG_DISTRICTS].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
    let districtOrder = 1;
    if (stage === "districts") {
      for (const district of sortedDistricts) {
        try {
          const existingByName = existingDistrictByName.get(normalizeName(district.name));

          if (existingByName) {
            if (args.skipExisting) {
              results.districtsSkipped++;
              districtMap.set(district.id, existingByName);
              continue;
            } else {
              throw new Error(`District ${district.name} already exists`);
            }
          }

          // Create district
          const utid = generateUTID(adminUser.role);
          const code = `UGD-${district.id}`;
          const districtId = await ctx.db.insert("districts", {
            name: district.name,
            code,
            active: true,
            order: districtOrder++,
            createdAt: getUgandaTime(),
            createdBy: args.adminId,
            utid,
          });

          districtMap.set(district.id, districtId);
          results.districtsCreated++;

          // Log admin action
          await ctx.db.insert("adminActions", {
            adminId: args.adminId,
            actionType: "create_district",
            utid,
            reason: `Seeded district: ${district.name} (${code})`,
            timestamp: getUgandaTime(),
          });
        } catch (error: any) {
          results.errors.push(`District ${district.name}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `District seeding completed. Created: ${results.districtsCreated}, Skipped: ${results.districtsSkipped}.`,
        ...results,
      };
    }

    for (const district of sortedDistricts) {
      const existingByName = existingDistrictByName.get(normalizeName(district.name));
      if (existingByName) {
        districtMap.set(district.id, existingByName);
      } else {
        results.errors.push(`District ${district.name} missing. Seed districts first.`);
      }
    }

    if (stage === "subcounties") {
      const subcountyItems: Array<{ id: string; name: string; districtDataId: string; order: number }> = [];
      for (const [districtDataId, subcounties] of subcountiesByDistrictDataId.entries()) {
        const sortedSubcounties = [...subcounties].sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        );
        let subcountyOrder = 1;
        for (const subcounty of sortedSubcounties) {
          subcountyItems.push({
            id: subcounty.id,
            name: subcounty.name,
            districtDataId,
            order: subcountyOrder++,
          });
        }
      }

      const batch = subcountyItems.slice(offset, offset + limit);
      for (const subcounty of batch) {
        const districtId = districtMap.get(subcounty.districtDataId);
        if (!districtId) {
          results.errors.push(`District ${subcounty.districtDataId} not found for subcounty ${subcounty.name}`);
          continue;
        }

        try {
          const existingKey = `${districtId}:${normalizeName(subcounty.name)}`;
          const existingId = existingSubcountyByKey.get(existingKey);

          if (existingId) {
            if (args.skipExisting) {
              results.subcountiesSkipped++;
              subcountyMap.set(subcounty.id, existingId);
              continue;
            } else {
              throw new Error(`Subcounty ${subcounty.name} already exists`);
            }
          }

          const utid = generateUTID(adminUser.role);
          const code = `UGSC-${subcounty.id}`;
          const subcountyId = await ctx.db.insert("subcounties", {
            districtId,
            name: subcounty.name,
            code,
            active: true,
            order: subcounty.order,
            createdAt: getUgandaTime(),
            createdBy: args.adminId,
            utid,
          });

          subcountyMap.set(subcounty.id, subcountyId);
          results.subcountiesCreated++;

          await ctx.db.insert("adminActions", {
            adminId: args.adminId,
            actionType: "create_subcounty",
            utid,
            reason: `Seeded subcounty: ${subcounty.name} (${code})`,
            timestamp: getUgandaTime(),
          });
        } catch (error: any) {
          results.errors.push(`Subcounty ${subcounty.name}: ${error.message}`);
        }
      }

      const nextOffset = offset + batch.length < subcountyItems.length ? offset + batch.length : null;

      return {
        success: true,
        message: `Subcounty seeding batch completed. Created: ${results.subcountiesCreated}, Skipped: ${results.subcountiesSkipped}.`,
        nextOffset,
        total: subcountyItems.length,
        ...results,
      };
    }

    if (stage === "parishes") {
      const subcountyItems: Array<{ id: string; name: string; districtDataId: string }> = [];
      for (const [districtDataId, subcounties] of subcountiesByDistrictDataId.entries()) {
        for (const subcounty of subcounties) {
          subcountyItems.push({ id: subcounty.id, name: subcounty.name, districtDataId });
        }
      }

      for (const subcounty of subcountyItems) {
        const districtId = districtMap.get(subcounty.districtDataId);
        if (!districtId) {
          continue;
        }
        const key = `${districtId}:${normalizeName(subcounty.name)}`;
        const existingId = existingSubcountyByKey.get(key);
        if (existingId) {
          subcountyMap.set(subcounty.id, existingId);
        }
      }

      const parishItems: Array<{ id: string; name: string; subcountyDataId: string; order: number }> = [];
      for (const [subcountyDataId, parishes] of parishesBySubcountyDataId.entries()) {
        const sortedParishes = [...parishes].sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        );
        let parishOrder = 1;
        for (const parish of sortedParishes) {
          parishItems.push({
            id: parish.id,
            name: parish.name,
            subcountyDataId,
            order: parishOrder++,
          });
        }
      }

      const batch = parishItems.slice(offset, offset + limit);
      for (const parish of batch) {
        const subcountyId = subcountyMap.get(parish.subcountyDataId);
        if (!subcountyId) {
          results.errors.push(`Subcounty ${parish.subcountyDataId} not found for parish ${parish.name}`);
          continue;
        }

        try {
          const existingKey = `${subcountyId}:${normalizeName(parish.name)}`;
          const existingId = existingParishByKey.get(existingKey);

          if (existingId) {
            if (args.skipExisting) {
              results.parishesSkipped++;
              continue;
            } else {
              throw new Error(`Parish ${parish.name} already exists`);
            }
          }

          const utid = generateUTID(adminUser.role);
          const code = `UGP-${parish.id}`;
          await ctx.db.insert("parishes", {
            subcountyId,
            name: parish.name,
            code,
            active: true,
            order: parish.order,
            createdAt: getUgandaTime(),
            createdBy: args.adminId,
            utid,
          });

          results.parishesCreated++;

          await ctx.db.insert("adminActions", {
            adminId: args.adminId,
            actionType: "create_parish",
            utid,
            reason: `Seeded parish: ${parish.name} (${code})`,
            timestamp: getUgandaTime(),
          });
        } catch (error: any) {
          results.errors.push(`Parish ${parish.name}: ${error.message}`);
        }
      }

      const nextOffset = offset + batch.length < parishItems.length ? offset + batch.length : null;

      return {
        success: true,
        message: `Parish seeding batch completed. Created: ${results.parishesCreated}, Skipped: ${results.parishesSkipped}.`,
        nextOffset,
        total: parishItems.length,
        ...results,
      };
    }

    return {
      success: true,
      message: `Seeding completed. Created: ${results.districtsCreated} districts, ${results.subcountiesCreated} subcounties, ${results.parishesCreated} parishes.`,
      ...results,
    };
  },
});
