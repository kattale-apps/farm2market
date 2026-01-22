/**
 * Location Hierarchy Management
 * 
 * Manages Uganda administrative divisions: Districts → Subcounties → Parishes
 * Used for farmer onboarding and geo-locking communities
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";

/**
 * Get all active districts
 */
export const getActiveDistricts = query({
  args: {},
  handler: async (ctx) => {
    const districts = await ctx.db
      .query("districts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .order("asc")
      .collect();

    return districts.map((d) => ({
      id: d._id,
      name: d.name,
      code: d.code,
    }));
  },
});

/**
 * Get subcounties by district
 */
export const getSubcountiesByDistrict = query({
  args: { districtId: v.id("districts") },
  handler: async (ctx, args) => {
    const subcounties = await ctx.db
      .query("subcounties")
      .withIndex("by_district", (q) => q.eq("districtId", args.districtId))
      .collect();

    // Filter by active and sort
    return subcounties
      .filter((s) => s.active)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s._id,
        name: s.name,
        code: s.code,
      }));
  },
});

/**
 * Get parishes by subcounty
 */
export const getParishesBySubcounty = query({
  args: { subcountyId: v.id("subcounties") },
  handler: async (ctx, args) => {
    const parishes = await ctx.db
      .query("parishes")
      .withIndex("by_subcounty", (q) => q.eq("subcountyId", args.subcountyId))
      .collect();

    // Filter by active and sort
    return parishes
      .filter((p) => p.active)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        id: p._id,
        name: p.name,
        code: p.code,
      }));
  },
});

/**
 * Create a district (SuperAdmin only)
 */
export const createDistrict = mutation({
  args: {
    adminId: v.id("users"),
    name: v.string(),
    code: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can create districts");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Check if code already exists
    const existing = await ctx.db
      .query("districts")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("District with this code already exists");
    }

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Create district
    const districtId = await ctx.db.insert("districts", {
      name: args.name,
      code: args.code,
      active: true,
      order: args.order,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
      utid,
    });

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "create_district",
      utid,
      reason: `Created district: ${args.name} (${args.code})`,
      timestamp: getUgandaTime(),
    });

    return { districtId, utid };
  },
});

/**
 * Create a subcounty (SuperAdmin only)
 */
export const createSubcounty = mutation({
  args: {
    adminId: v.id("users"),
    districtId: v.id("districts"),
    name: v.string(),
    code: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can create subcounties");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Verify district exists
    const district = await ctx.db.get(args.districtId);
    if (!district) {
      throw new Error("District not found");
    }

    // Check if code already exists
    const existing = await ctx.db
      .query("subcounties")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Subcounty with this code already exists");
    }

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Create subcounty
    const subcountyId = await ctx.db.insert("subcounties", {
      districtId: args.districtId,
      name: args.name,
      code: args.code,
      active: true,
      order: args.order,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
      utid,
    });

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "create_subcounty",
      utid,
      reason: `Created subcounty: ${args.name} (${args.code}) in district ${district.name}`,
      timestamp: getUgandaTime(),
    });

    return { subcountyId, utid };
  },
});

/**
 * Create a parish (SuperAdmin only)
 */
export const createParish = mutation({
  args: {
    adminId: v.id("users"),
    subcountyId: v.id("subcounties"),
    name: v.string(),
    code: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can create parishes");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Verify subcounty exists
    const subcounty = await ctx.db.get(args.subcountyId);
    if (!subcounty) {
      throw new Error("Subcounty not found");
    }

    // Check if code already exists
    const existing = await ctx.db
      .query("parishes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Parish with this code already exists");
    }

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Create parish
    const parishId = await ctx.db.insert("parishes", {
      subcountyId: args.subcountyId,
      name: args.name,
      code: args.code,
      active: true,
      order: args.order,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
      utid,
    });

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "create_parish",
      utid,
      reason: `Created parish: ${args.name} (${args.code}) in subcounty ${subcounty.name}`,
      timestamp: getUgandaTime(),
    });

    return { parishId, utid };
  },
});
