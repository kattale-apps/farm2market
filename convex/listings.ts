/**
 * Listings & Inventory Management
 * 
 * - Farmers list produce → auto-split into 10kg units
 * - Units lock only on successful payment (pay-to-lock)
 * - Trader inventory aggregates into 100kg blocks for buyers
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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
import { Id } from "./_generated/dataModel";

/**
 * Create a listing (farmer only)
 * Auto-splits into 10kg units
 */
export const createListing = mutation({
  args: {
    farmerId: v.id("users"),
    produceType: v.string(),
    totalKilos: v.optional(v.number()),
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
    const listingMode = args.listingMode || "unit"; // Default to unit mode
    const normalizedTotalKilos = listingMode === "garden"
      ? Math.max(args.totalKilos || 1, 1)
      : args.totalKilos || 0;

    await checkRateLimit(ctx, args.farmerId, user.role, "create_listing", {
      produceType: args.produceType,
      totalKilos: normalizedTotalKilos,
    });

    // Validate based on mode
    if (listingMode === "garden") {
      // Garden mode: requires totalPrice and gardenSize
      if (!args.totalPrice || args.totalPrice <= 0) {
        throw new Error("Total price is required for garden sale mode");
      }
      if (!args.gardenSize || args.gardenSize <= 0) {
        throw new Error("Garden size is required for garden sale mode");
      }
      // For garden mode, pricePerKilo is calculated from totalPrice / totalKilos
      // But we still validate it's provided for consistency
      if (!args.pricePerKilo || args.pricePerKilo <= 0) {
        // Calculate from totalPrice
        args.pricePerKilo = args.totalPrice / normalizedTotalKilos;
      }
    } else {
      // Unit mode: standard validation
      if (!args.totalKilos || args.totalKilos <= 0) {
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
      actualUnitSize = normalizedTotalKilos; // Entire garden represented as one unit
    } else {
      // Unit mode: split into 10kg units
      totalUnits = normalizedTotalKilos < LISTING_UNIT_SIZE_KG 
        ? 1 
        : Math.floor(normalizedTotalKilos / LISTING_UNIT_SIZE_KG);
      actualUnitSize = normalizedTotalKilos < LISTING_UNIT_SIZE_KG 
        ? normalizedTotalKilos 
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
      totalKilos: normalizedTotalKilos,
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
    let remainingKilos = normalizedTotalKilos;
    
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
        const storageLocation = listing.storageLocationId
          ? await ctx.db.get(listing.storageLocationId)
          : null;
        const units = await ctx.db
          .query("listingUnits")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect();
        
        const availableUnits = units.filter((u) => u.status === "available").length;
        const lockedUnits = units.filter((u) => u.status === "locked").length;
        const derivedListingMode =
          listing.listingMode ||
          (listing.gardenSize != null || listing.gardenDimensions != null || listing.totalPrice != null
            ? "garden"
            : "unit");

        return {
          listingId: listing._id,
          utid: listing.utid,
          produceType: listing.produceType,
          productName: listing.productName,
          totalKilos: listing.totalKilos,
          pricePerKilo: listing.pricePerKilo,
          pricingUnit: listing.pricingUnit,
          pricePerUnit: listing.pricePerUnit,
          unitSize: listing.unitSize || (listing.traderId ? BUYER_BLOCK_SIZE_KG : LISTING_UNIT_SIZE_KG), // Traders list in 100kg, farmers in 10kg
          totalUnits: listing.totalUnits,
          availableUnits: listing.availableUnits ?? availableUnits,
          lockedUnits,
          packagingTypeEnum: listing.packagingTypeEnum,
          packagingTypeCustom: listing.packagingTypeCustom,
          departureLocation: listing.departureLocation,
          destinationLocation: listing.destinationLocation,
          etaType: listing.etaType,
          etaValue: listing.etaValue,
          etaLastUpdatedAt: listing.etaLastUpdatedAt,
          deliveryStatus: listing.deliveryStatus,
          progressStage: listing.progressStage,
          farmerAlias: farmer?.alias || null,
          traderAlias: trader?.alias || null,
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          isTraderListing: !!listing.traderId, // Flag to identify trader listings (100kg blocks)
          createdAt: listing.createdAt,
          storageLocation: storageLocation
            ? { districtName: storageLocation.districtName, code: storageLocation.code }
            : null,
          // Garden sale fields (optional for older listings)
          listingMode: derivedListingMode,
          gardenSize: listing.gardenSize,
          gardenDimensions: listing.gardenDimensions,
          totalPrice: listing.totalPrice,
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
    const storageLocation = listing.storageLocationId
      ? await ctx.db.get(listing.storageLocationId)
      : null;
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    const availableUnits = units.filter((u) => u.status === "available").length;
    const lockedUnits = units.filter((u) => u.status === "locked").length;

    const derivedListingMode =
      listing.listingMode ||
      (listing.gardenSize != null || listing.gardenDimensions != null || listing.totalPrice != null
        ? "garden"
        : "unit");

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
      storageLocation: storageLocation
        ? { districtName: storageLocation.districtName, code: storageLocation.code }
        : null,
      // Garden sale fields (optional for older listings)
      listingMode: derivedListingMode,
      gardenSize: listing.gardenSize,
      gardenDimensions: listing.gardenDimensions,
      totalPrice: listing.totalPrice,
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
 * Create a trader listing from inventory (trader only)
 * Backward compatible: existing 100kg listings remain valid.
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

    // Verify trader is approved
    if (!user.isVerifiedTrader || user.verificationStatus !== "verified") {
      throw new Error("Trader verification required before posting listings");
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

    // Backward compatibility: allow any inventory size while preserving existing 100kg listings.

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

    // FarmCoin token gating (posting cost)
    const settings = await ctx.db.query("systemSettings").first();
    const postingCost = settings?.farmcoinPostingCost ?? 1;
    if (postingCost > 0) {
      await ctx.runMutation((internal as any).farmcoin.spendFarmcoinTokens, {
        traderId: args.traderId,
        amount: postingCost,
        source: "posting_cost",
        listingId: undefined,
        reason: "Trader listing posting cost",
      });
    }

    // Generate UTID
    const utid = generateUTID(user.role);

    // Create listing - traders list from their inventory as a single unit
    const listingId = await ctx.db.insert("listings", {
      traderId: args.traderId,
      inventoryId: args.inventoryId,
      farmerId: undefined, // Not a farmer listing
      utid,
      produceType: inventory.produceType,
      totalKilos: inventory.totalKilos,
      pricePerKilo: args.pricePerKilo,
      unitSize: inventory.totalKilos, // Single-unit listing sized to inventory
      totalUnits: 1, // 1 unit = inventory size
      status: "active",
      createdAt: getUgandaTime(),
      deliverySLA: 0, // Not applicable for trader listings
      qualityRating: inventory.qualityRating,
      qualityComment: undefined,
      storageLocationId: inventory.storageLocationId,
    });

    // Create a single listing unit representing the inventory lot
    const unitId = await ctx.db.insert("listingUnits", {
      listingId,
      unitNumber: 1,
      status: "available",
    });

    return { listingId, utid, totalUnits: 1, unitIds: [unitId] };
  },
});

/**
 * Create trader inventory lot manually (trader only)
 * Backward compatible: does not alter existing farmer-sourced inventory.
 */
export const createTraderInventoryLot = mutation({
  args: {
    traderId: v.id("users"),
    produceType: v.string(),
    totalKilos: v.number(),
    unitPrice: v.number(),
    storageLocationId: v.id("storageLocations"),
    qualityRating: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    if (args.totalKilos <= 0) {
      throwAppError(invalidKilosError());
    }

    if (args.unitPrice <= 0) {
      throwAppError(invalidAmountError());
    }

    const storageLocation = await ctx.db.get(args.storageLocationId);
    if (!storageLocation || !storageLocation.active) {
      throw new Error("Storage location not available");
    }

    const utid = generateUTID(user.role);

    const inventoryId = await ctx.db.insert("traderInventory", {
      traderId: args.traderId,
      listingUnitIds: [],
      totalKilos: args.totalKilos,
      blockSize: args.totalKilos,
      produceType: args.produceType.trim(),
      storageLocationId: args.storageLocationId,
      qualityRating: args.qualityRating?.trim() || undefined,
      unitPrice: args.unitPrice,
      acquiredAt: getUgandaTime(),
      storageStartTime: getUgandaTime(),
      status: "in_storage",
      utid,
      is100kgBlock: args.totalKilos === BUYER_BLOCK_SIZE_KG,
    });

    return { inventoryId, utid };
  },
});

/**
 * Update trader listing ETA (trader only)
 * Charges FarmCoin tokens per change
 */
export const updateTraderListingEta = mutation({
  args: {
    traderId: v.id("users"),
    listingId: v.id("listings"),
    etaType: v.union(v.literal("duration"), v.literal("arrival_time")),
    etaValue: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || trader.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    if (!trader.isVerifiedTrader || trader.verificationStatus !== "verified") {
      throw new Error("Trader verification required before updating ETA");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.traderId !== args.traderId) {
      throw new Error("Listing not found or not owned by trader");
    }

    if (listing.progressStage === "arrived") {
      throw new Error("ETA cannot be changed after arrival");
    }

    const settings = await ctx.db.query("systemSettings").first();
    const etaChangeCost = settings?.farmcoinEtaChangeCost ?? 1;

    if (etaChangeCost > 0) {
      await ctx.runMutation((internal as any).farmcoin.spendFarmcoinTokens, {
        traderId: args.traderId,
        amount: etaChangeCost,
        source: "eta_change",
        listingId: args.listingId,
        reason: args.reason,
      });
    }

    await ctx.db.insert("etaHistory", {
      listingId: args.listingId,
      oldEtaValue: listing.etaValue,
      newEtaValue: args.etaValue,
      etaType: args.etaType,
      reason: args.reason,
      updatedBy: args.traderId,
      createdAt: getUgandaTime(),
    });

    const now = getUgandaTime();
    const previousEtaValue = listing.etaValue;
    const previousEtaType = listing.etaType;
    const previousBase = listing.etaLastUpdatedAt || listing.createdAt;
    const previousEtaTimestamp = previousEtaValue == null || !previousEtaType
      ? null
      : previousEtaType === "duration"
        ? previousBase + previousEtaValue * 60 * 60 * 1000
        : previousEtaValue;

    const nextBase = now;
    const nextEtaTimestamp = args.etaType === "duration"
      ? nextBase + args.etaValue * 60 * 60 * 1000
      : args.etaValue;

    const isExtended = previousEtaTimestamp != null && nextEtaTimestamp > previousEtaTimestamp;

    await ctx.db.patch(args.listingId, {
      etaType: args.etaType,
      etaValue: args.etaValue,
      etaLastUpdatedAt: now,
      ...(isExtended ? { progressStage: "delayed", deliveryStatus: "in_transit" } : {}),
    });

    if (listing.inventoryId) {
      const purchases = await ctx.db
        .query("buyerPurchases")
        .collect();
      const activeOrders = purchases.filter(
        (p) => p.inventoryId === listing.inventoryId && p.status === "pending_pickup"
      );

      const negotiations = await ctx.db
        .query("traderBuyerNegotiations")
        .withIndex("by_inventory", (q) => q.eq("inventoryId", listing.inventoryId as Id<"traderInventory">))
        .collect();

      const activeWatchers = negotiations.filter((neg) =>
        neg.status === "pending" || neg.status === "countered" || neg.status === "accepted"
      );

      const recipientMap = new Map<Id<"users">, { utid: string; label: string }>();

      for (const order of activeOrders) {
        recipientMap.set(order.buyerId, { utid: order.utid, label: "order" });
      }

      for (const watcher of activeWatchers) {
        if (!recipientMap.has(watcher.buyerId)) {
          recipientMap.set(watcher.buyerId, { utid: watcher.negotiationUtid, label: "watch" });
        }
      }

      const oldEtaLabel = previousEtaType === "arrival_time"
        ? new Date(previousEtaValue || 0).toLocaleString()
        : previousEtaValue != null
          ? `${previousEtaValue}h`
          : "N/A";
      const newEtaLabel = args.etaType === "arrival_time"
        ? new Date(args.etaValue).toLocaleString()
        : `${args.etaValue}h`;

      for (const [buyerId, info] of recipientMap.entries()) {
        await ctx.db.insert("notifications", {
          userId: buyerId,
          type: "system",
          title: "ETA Updated",
          message: `ETA updated for ${listing.produceType}. ${oldEtaLabel} → ${newEtaLabel}. Reason: ${args.reason}`,
          utid: info.utid,
          read: false,
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Update trader delivery status (manual progress)
 */
export const updateTraderDeliveryStatus = mutation({
  args: {
    traderId: v.id("users"),
    listingId: v.id("listings"),
    progressStage: v.union(
      v.literal("departed"),
      v.literal("midway"),
      v.literal("delayed"),
      v.literal("arrived")
    ),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || trader.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.traderId !== args.traderId) {
      throw new Error("Listing not found or not owned by trader");
    }

    const deliveryStatus = args.progressStage === "arrived"
      ? "delivered"
      : listing.deliveryStatus || "in_transit";

    await ctx.db.patch(args.listingId, {
      progressStage: args.progressStage,
      deliveryStatus,
    });

    if (listing.inventoryId) {
      const purchases = await ctx.db
        .query("buyerPurchases")
        .collect();
      const activeOrders = purchases.filter(
        (p) => p.inventoryId === listing.inventoryId && p.status === "pending_pickup"
      );

      const negotiations = await ctx.db
        .query("traderBuyerNegotiations")
        .withIndex("by_inventory", (q) => q.eq("inventoryId", listing.inventoryId as Id<"traderInventory">))
        .collect();

      const activeWatchers = negotiations.filter((neg) =>
        neg.status === "pending" || neg.status === "countered" || neg.status === "accepted"
      );

      const recipientMap = new Map<Id<"users">, { utid: string; label: string }>();

      for (const order of activeOrders) {
        recipientMap.set(order.buyerId, { utid: order.utid, label: "order" });
      }

      for (const watcher of activeWatchers) {
        if (!recipientMap.has(watcher.buyerId)) {
          recipientMap.set(watcher.buyerId, { utid: watcher.negotiationUtid, label: "watch" });
        }
      }

      for (const [buyerId, info] of recipientMap.entries()) {
        await ctx.db.insert("notifications", {
          userId: buyerId,
          type: "system",
          title: "Delivery Status Updated",
          message: `Delivery status updated for ${listing.produceType}: ${args.progressStage}.`,
          utid: info.utid,
          read: false,
          createdAt: getUgandaTime(),
        });
      }
    }

    return { success: true };
  },
});

/**
 * Get trader listings for delivery updates (trader only)
 */
export const getTraderDeliveryListings = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || trader.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .collect();

    const purchases = await ctx.db.query("buyerPurchases").collect();

    const enriched = await Promise.all(
      listings.map(async (listing) => {
        const inventoryId = listing.inventoryId || null;
        const activeOrders = inventoryId
          ? purchases.filter((p) => p.inventoryId === inventoryId && p.status === "pending_pickup")
          : [];

        const activeWatchers = inventoryId
          ? await ctx.db
              .query("traderBuyerNegotiations")
              .withIndex("by_inventory", (q) => q.eq("inventoryId", inventoryId))
              .filter((q) =>
                q.or(
                  q.eq(q.field("status"), "pending"),
                  q.eq(q.field("status"), "countered"),
                  q.eq(q.field("status"), "accepted")
                )
              )
              .collect()
          : [];

        return {
          listingId: listing._id,
          utid: listing.utid,
          produceType: listing.produceType,
          totalKilos: listing.totalKilos,
          status: listing.status,
          etaType: listing.etaType ?? null,
          etaValue: listing.etaValue ?? null,
          etaLastUpdatedAt: listing.etaLastUpdatedAt ?? null,
          deliveryStatus: listing.deliveryStatus ?? null,
          progressStage: listing.progressStage ?? null,
          departureLocation: listing.departureLocation ?? null,
          destinationLocation: listing.destinationLocation ?? null,
          productName: listing.productName ?? null,
          inventoryId,
          createdAt: listing.createdAt,
          activeOrders: activeOrders.length,
          activeWatchers: activeWatchers.length,
        };
      })
    );

    enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return {
      total: enriched.length,
      listings: enriched,
    };
  },
});

/**
 * Get trader's available inventory for listing
 * Backward compatible: includes 100kg blocks and other sizes.
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

    // Get all inventory in storage that doesn't have active listings
    const inventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "in_storage")
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
