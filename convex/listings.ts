/**
 * Listings & Inventory Management
 * 
 * - Farmers list produce → auto-split into 10kg units
 * - Units lock only on successful payment (pay-to-lock)
 * - Trader inventory aggregates into 100kg blocks for buyers
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { LISTING_UNIT_SIZE_KG, BUYER_BLOCK_SIZE_KG } from "./constants";
import { checkPilotMode } from "./pilotMode";
import { checkRateLimit } from "./rateLimits";
import {
  invalidRoleError,
  invalidKilosError,
  invalidAmountError,
  throwAppError,
} from "./errors";

/**
 * Create a listing (farmer only)
 * Auto-splits into 10kg units
 */
export const createListing = mutation({
  args: {
    farmerId: v.id("users"),
    produceType: v.string(),
    totalKilos: v.number(),
    pricePerKilo: v.number(), // In UGX (for unit mode)
    qualityRating: v.optional(v.string()), // Quality rating from dropdown
    qualityComment: v.optional(v.string()), // Farmer's text comment about produce quality
    storageLocationId: v.id("storageLocations"), // Storage location (district) where produce will be delivered
    // Garden mode fields
    listingMode: v.optional(v.union(v.literal("unit"), v.literal("garden"))), // Default: "unit"
    gardenSize: v.optional(v.number()), // Garden size in acres (for garden mode)
    gardenDimensions: v.optional(v.any()), // Raw garden dimensions (for garden mode)
    totalPrice: v.optional(v.number()), // Total price for entire garden (for garden mode, in UGX)
  },
  handler: async (ctx, args) => {
    // ============================================================
    // PILOT MODE CHECK (MUST BE FIRST - BEFORE ANY OPERATIONS)
    // ============================================================
    // This mutation creates inventory that can be purchased (moves money),
    // so it must be blocked during pilot mode. The check happens FIRST to fail fast.
    await checkPilotMode(ctx);

    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throwAppError(invalidRoleError("farmer"));
    }

    // Check onboarding completion
    if (!user.onboardingCompleted) {
      throw new Error("Please complete your profile onboarding before creating listings. Go to the onboarding page to provide your location and farm size.");
    }

    // ============================================================
    // RATE LIMIT CHECK (BEFORE OPERATIONS)
    // ============================================================
    // Check if farmer has exceeded listing creation rate limit.
    // This prevents spam and manipulation attempts.
    await checkRateLimit(ctx, args.farmerId, user.role, "create_listing", {
      produceType: args.produceType,
      totalKilos: args.totalKilos,
    });

    const listingMode = args.listingMode || "unit"; // Default to unit mode

    // Validate based on mode
    if (listingMode === "garden") {
      // Garden mode: requires totalPrice and gardenSize
      if (!args.totalPrice || args.totalPrice <= 0) {
        throw new Error("Total price is required for garden sale mode");
      }
      if (!args.gardenSize || args.gardenSize <= 0) {
        throw new Error("Garden size is required for garden sale mode");
      }
      if (args.totalKilos <= 0) {
        throwAppError(invalidKilosError());
      }
      // For garden mode, pricePerKilo is calculated from totalPrice / totalKilos
      // But we still validate it's provided for consistency
      if (!args.pricePerKilo || args.pricePerKilo <= 0) {
        // Calculate from totalPrice
        args.pricePerKilo = args.totalPrice / args.totalKilos;
      }
    } else {
      // Unit mode: standard validation
      if (args.totalKilos <= 0) {
        throwAppError(invalidKilosError());
      }
      if (args.pricePerKilo <= 0) {
        throwAppError(invalidAmountError());
      }
    }

    // Generate UTID
    const utid = generateUTID(user.role);

    // Calculate units based on mode
    let totalUnits: number;
    let actualUnitSize: number;
    
    if (listingMode === "garden") {
      // Garden mode: entire plot is 1 unit
      totalUnits = 1;
      actualUnitSize = args.totalKilos; // Entire garden weight
    } else {
      // Unit mode: split into 10kg units
      totalUnits = args.totalKilos < LISTING_UNIT_SIZE_KG 
        ? 1 
        : Math.floor(args.totalKilos / LISTING_UNIT_SIZE_KG);
      actualUnitSize = args.totalKilos < LISTING_UNIT_SIZE_KG 
        ? args.totalKilos 
        : LISTING_UNIT_SIZE_KG;
    }

    // Verify storage location exists and is active
    const storageLocation = await ctx.db.get(args.storageLocationId);
    if (!storageLocation) {
      throw new Error("Storage location not found");
    }
    if (!storageLocation.active) {
      throw new Error("Storage location is not active");
    }

    // Create listing
    const listingId = await ctx.db.insert("listings", {
      farmerId: args.farmerId,
      utid,
      produceType: args.produceType,
      totalKilos: args.totalKilos,
      pricePerKilo: args.pricePerKilo,
      unitSize: actualUnitSize, // Store actual unit size (10kg or entire garden)
      totalUnits,
      status: "active",
      createdAt: getUgandaTime(),
      deliverySLA: 0, // Set when payment is made
      qualityRating: args.qualityRating?.trim() || undefined,
      qualityComment: args.qualityComment?.trim() || undefined,
      storageLocationId: args.storageLocationId,
      // Garden mode fields
      listingMode,
      gardenSize: args.gardenSize,
      gardenDimensions: args.gardenDimensions,
      totalPrice: args.totalPrice,
    });

    // Create individual units
    const unitIds = [];
    let remainingKilos = args.totalKilos;
    
    for (let i = 1; i <= totalUnits; i++) {
      // Calculate unit size: last unit gets remaining kilos if not exactly divisible
      let unitKilos = LISTING_UNIT_SIZE_KG;
      if (i === totalUnits && remainingKilos < LISTING_UNIT_SIZE_KG) {
        unitKilos = remainingKilos; // Last unit gets remaining kilos
      }
      
      const unitId = await ctx.db.insert("listingUnits", {
        listingId,
        unitNumber: i,
        status: "available",
      });
      unitIds.push(unitId);
      remainingKilos -= unitKilos;
    }

    return { listingId, utid, totalUnits, unitIds };
  },
});

/**
 * Get active listings (traders can view)
 */
export const getActiveListings = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Get farmer/trader aliases (anonymity) and unit availability
    const listingsWithAliases = await Promise.all(
      listings.map(async (listing) => {
        const farmer = listing.farmerId ? await ctx.db.get(listing.farmerId) : null;
        const trader = listing.traderId ? await ctx.db.get(listing.traderId) : null;
        const units = await ctx.db
          .query("listingUnits")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect();
        
        const availableUnits = units.filter((u) => u.status === "available").length;
        const lockedUnits = units.filter((u) => u.status === "locked").length;

        return {
          listingId: listing._id,
          utid: listing.utid,
          produceType: listing.produceType,
          totalKilos: listing.totalKilos,
          pricePerKilo: listing.pricePerKilo,
          unitSize: listing.unitSize || (listing.traderId ? BUYER_BLOCK_SIZE_KG : LISTING_UNIT_SIZE_KG), // Traders list in 100kg, farmers in 10kg
          totalUnits: listing.totalUnits,
          availableUnits,
          lockedUnits,
          farmerAlias: farmer?.alias || null,
          traderAlias: trader?.alias || null,
          isTraderListing: !!listing.traderId, // Flag to identify trader listings (100kg blocks)
          createdAt: listing.createdAt,
        };
      })
    );

    return listingsWithAliases;
  },
});

/**
 * Get listing details with unit status
 */
export const getListingDetails = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      return null;
    }

    const farmer = listing.farmerId ? await ctx.db.get(listing.farmerId) : null;
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    const availableUnits = units.filter((u) => u.status === "available").length;
    const lockedUnits = units.filter((u) => u.status === "locked").length;

    return {
      listingId: listing._id,
      utid: listing.utid,
      produceType: listing.produceType,
      totalKilos: listing.totalKilos,
      pricePerKilo: listing.pricePerKilo,
      totalUnits: listing.totalUnits,
      availableUnits,
      lockedUnits,
      status: listing.status,
      farmerAlias: farmer?.alias || "unknown",
      createdAt: listing.createdAt,
      units: units.map((u) => ({
        unitId: u._id,
        unitNumber: u.unitNumber,
        status: u.status,
        lockedBy: u.lockedBy,
        lockedAt: u.lockedAt,
      })),
    };
  },
});

/**
 * Get first available unit ID for a listing (helper for negotiations)
 */
export const getFirstAvailableUnit = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    const availableUnit = units.find((u) => u.status === "available");
    if (!availableUnit) {
      return null;
    }

    return {
      unitId: availableUnit._id,
      unitNumber: availableUnit.unitNumber,
    };
  },
});

/**
 * Get active quality options (for farmers)
 * Returns all active quality options sorted by order
 */
export const getActiveQualityOptions = query({
  args: {},
  handler: async (ctx) => {
    const options = await ctx.db
      .query("qualityOptions")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    // Sort by order
    options.sort((a, b) => a.order - b.order);

    return options.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));
  },
});

/**
 * Get active produce options (for farmers)
 * Returns all active produce options sorted by order
 */
export const getActiveProduceOptions = query({
  args: {},
  handler: async (ctx) => {
    const options = await ctx.db
      .query("produceOptions")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    // Sort by order
    options.sort((a, b) => a.order - b.order);

    return options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: opt.icon,
      allowedStorageLocationIds: opt.allowedStorageLocationIds || [],
    }));
  },
});

/**
 * Get active storage locations (for farmers)
 * Returns all active storage locations sorted by order
 */
export const getActiveStorageLocations = query({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db
      .query("storageLocations")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    // Sort by order
    locations.sort((a, b) => a.order - b.order);

    return locations.map((loc) => ({
      locationId: loc._id,
      districtName: loc.districtName,
      code: loc.code,
      active: loc.active,
    }));
  },
});

/**
 * Create a trader listing from 100kg inventory block (trader only)
 * Traders can only list in 100kg blocks
 */
export const createTraderListing = mutation({
  args: {
    traderId: v.id("users"),
    inventoryId: v.id("traderInventory"),
    pricePerKilo: v.number(), // In UGX - trader's asking price
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    // Rate limit check
    await checkRateLimit(ctx, args.traderId, user.role, "create_trader_listing", {
      inventoryId: args.inventoryId,
      pricePerKilo: args.pricePerKilo,
    });

    if (args.pricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    // Get the inventory block
    const inventory = await ctx.db.get(args.inventoryId);
    if (!inventory) {
      throw new Error("Inventory block not found");
    }

    // Verify trader owns this inventory
    if (inventory.traderId !== args.traderId) {
      throw new Error("You can only create listings from your own inventory");
    }

    // Verify inventory is in_storage
    if (inventory.status !== "in_storage") {
      throw new Error("Inventory must be in storage to create a listing");
    }

    // CRITICAL: Traders can only list in 100kg blocks
    if (!inventory.is100kgBlock || inventory.totalKilos !== BUYER_BLOCK_SIZE_KG) {
      throw new Error(`Traders can only list in exactly ${BUYER_BLOCK_SIZE_KG}kg blocks. This inventory block is ${inventory.totalKilos}kg.`);
    }

    // Check if this inventory block already has an active listing
    const existingListing = await ctx.db
      .query("listings")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .filter((q) => 
        q.and(
          q.eq(q.field("inventoryId"), args.inventoryId),
          q.eq(q.field("status"), "active")
        )
      )
      .first();

    if (existingListing) {
      throw new Error("This inventory block already has an active listing");
    }

    // Generate UTID
    const utid = generateUTID(user.role);

    // Create listing - traders list in 100kg blocks (1 unit = 100kg)
    const listingId = await ctx.db.insert("listings", {
      traderId: args.traderId,
      inventoryId: args.inventoryId,
      farmerId: undefined, // Not a farmer listing
      utid,
      produceType: inventory.produceType,
      totalKilos: BUYER_BLOCK_SIZE_KG, // Exactly 100kg
      pricePerKilo: args.pricePerKilo,
      unitSize: BUYER_BLOCK_SIZE_KG, // 100kg per unit for trader listings
      totalUnits: 1, // 1 unit = 100kg block
      status: "active",
      createdAt: getUgandaTime(),
      deliverySLA: 0, // Not applicable for trader listings
      qualityRating: inventory.qualityRating,
      qualityComment: undefined,
      storageLocationId: inventory.storageLocationId,
    });

    // Create a single listing unit representing the 100kg block
    const unitId = await ctx.db.insert("listingUnits", {
      listingId,
      unitNumber: 1,
      status: "available",
    });

    return { listingId, utid, totalUnits: 1, unitIds: [unitId] };
  },
});

/**
 * Get trader's available 100kg inventory blocks for listing
 */
export const getTraderAvailableInventoryForListing = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    // Get all 100kg blocks in storage that don't have active listings
    const inventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "in_storage"),
          q.eq(q.field("is100kgBlock"), true),
          q.eq(q.field("totalKilos"), BUYER_BLOCK_SIZE_KG)
        )
      )
      .collect();

    // Check which inventory blocks already have active listings
    const inventoryWithListings = await Promise.all(
      inventory.map(async (inv) => {
        const existingListing = await ctx.db
          .query("listings")
          .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
          .filter((q) => 
            q.and(
              q.eq(q.field("inventoryId"), inv._id),
              q.eq(q.field("status"), "active")
            )
          )
          .first();

        return {
          inventoryId: inv._id,
          utid: inv.utid,
          produceType: inv.produceType,
          totalKilos: inv.totalKilos,
          unitPrice: inv.unitPrice, // Original purchase price per kilo
          storageLocationId: inv.storageLocationId,
          qualityRating: inv.qualityRating,
          acquiredAt: inv.acquiredAt,
          hasActiveListing: !!existingListing,
        };
      })
    );

    // Filter to only blocks without active listings
    const available = inventoryWithListings.filter((inv) => !inv.hasActiveListing);

    return {
      availableBlocks: available,
      total: available.length,
    };
  },
});
