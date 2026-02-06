/**
 * Farm2Market Uganda - Convex Schema
 * 
 * This schema enforces the core business rules:
 * - User roles (farmer, trader, buyer, admin) - exactly one per user
 * - Anonymity via system-generated aliases
 * - UTID (Unique Transaction ID) for all meaningful actions
 * - Wallet system (closed loop, ledger-based)
 * - Spend cap enforcement (UGX 1,000,000 max exposure)
 * - Pay-to-lock atomicity
 * - Time-based SLAs and storage fees
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const imageMetadata = {
  storageId: v.id("_storage"),
  url: v.string(),
  lat: v.number(),
  lng: v.number(),
  accuracy: v.number(),
  capturedAt: v.string(), // ISO 8601 string
};

// Reusable livestock section template
const livestockSection = v.object({
  present: v.boolean(),
  breed: v.optional(v.string()),
  animalCount: v.optional(v.string()),
  managementSystem: v.optional(v.string()),
  healthStatus: v.optional(v.string()),
  productionOutput: v.optional(v.string()),
});

// Reusable crop section template
const cropSection = v.object({
  present: v.boolean(),
  variety: v.optional(v.string()),
  areaUnderCultivation: v.optional(v.string()),
  areaUnit: v.optional(v.string()),
  productionOutput: v.optional(v.string()),
  productionUnit: v.optional(v.string()),
  lastHarvestDate: v.optional(v.string()),
});

export default defineSchema({
  /**
   * Users table
   * - One role per user (enforced server-side)
   * - System-generated aliases for anonymity
   */
  users: defineTable({
    email: v.optional(v.string()), // Optional - user can use email or phone number
    phoneNumber: v.optional(v.string()), // Optional - user can use email or phone number
    sex: v.optional(v.union(v.literal("M"), v.literal("F"))), // Optional - farmer profile field
    role: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin")),
    alias: v.string(), // System-generated, stable, non-identifying
    state: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")), // User account state
    createdAt: v.number(),
    lastActiveAt: v.number(),
    passwordHash: v.optional(v.string()), // Secure password hash (bcrypt/argon2). Required for production authentication.
    customSpendCap: v.optional(v.number()), // Admin-set custom spend cap for traders (in UGX). If not set, uses default MAX_TRADER_EXPOSURE_UGX.
    adminLevel: v.optional(v.union(v.literal("super"), v.literal("junior"))), // Admin hierarchy level. undefined means super admin (backward compatible).
    adminCategory: v.optional(v.union(v.literal("store"), v.literal("message"), v.literal("community"), v.literal("finance"))), // Junior admin category (store delivery vs message support vs community oversight vs finance)
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))), // Storage locations junior admin can access. Only applies to junior admins.
    assignedCommunityIds: v.optional(v.array(v.id("communities"))), // Communities assigned to junior community admins. Only applies to community admins.
    serviceLevel: v.optional(v.union(v.literal("Standard"), v.literal("Premium"))), // Service tier for community admins (Standard = 5 exports/month, Premium = unlimited). Only applies to community admins.
    exportLimit: v.optional(v.number()), // Max number of exports per month for admin (super/junior)
    // Location and farm profile (for farmers)
    region: v.optional(v.string()), // Region selected during onboarding
    districtId: v.optional(v.id("districts")), // District where farmer is located
    subcountyId: v.optional(v.id("subcounties")), // Subcounty where farmer is located
    parishId: v.optional(v.id("parishes")), // Parish where farmer is located
    farmSizeAcres: v.optional(v.number()), // Farm size in acres (calculated)
    farmSizeRaw: v.optional(v.any()), // Raw farm size input: {unit, length, width, omwigo, emiigo}
    onboardingCompleted: v.optional(v.boolean()), // Whether farmer has completed onboarding
    // Farmer profile (community onboarding preload fields)
    county: v.optional(v.string()),
    village: v.optional(v.string()),
    waterSource: v.optional(v.string()),
    districtText: v.optional(v.string()),
    subCountyText: v.optional(v.string()),
    // Trader verification
    isVerifiedTrader: v.optional(v.boolean()),
    verificationStatus: v.optional(v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
    // Notification preferences
    notificationPreferences: v.optional(v.any()), // { newListings: boolean, offers: boolean, etc. }
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_role", ["role"])
    .index("by_alias", ["alias"])
    .index("by_district", ["districtId"])
    .index("by_subcounty", ["subcountyId"])
    .index("by_parish", ["parishId"]),

  /**
   * Wallet ledger entries
   * - All entries reference a UTID
   * - Traders have capital and profit ledgers
   * - No balance overwrites - ledger entries only
   */
  walletLedger: defineTable({
    userId: v.id("users"),
    utid: v.string(), // References the transaction that created this entry
    type: v.union(
      v.literal("capital_deposit"),
      v.literal("capital_lock"),
      v.literal("capital_unlock"),
      v.literal("profit_credit"),
      v.literal("profit_withdrawal"),
      v.literal("incoming_purchase"), // Created when trader makes offer on unit(s) - not inventory, just a pending purchase record
      v.literal("trader_commission_deduction") // Trader commission deducted from wallet
    ),
    amount: v.number(), // Amount in UGX
    balanceAfter: v.number(), // Running balance after this entry
    timestamp: v.number(),
    metadata: v.optional(v.any()), // Additional context
  })
    .index("by_user", ["userId"])
    .index("by_utid", ["utid"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  /**
   * Listings from farmers
   * - Auto-split into 10kg units
   * - Units lock only on successful payment
   */
  listings: defineTable({
    farmerId: v.optional(v.id("users")), // Optional - can be null for trader listings
    traderId: v.optional(v.id("users")), // Optional - for trader listings (100kg blocks only)
    inventoryId: v.optional(v.id("traderInventory")), // For trader listings, reference to the 100kg inventory block
    utid: v.string(), // Generated when listing is created
    produceType: v.string(),
    totalKilos: v.number(),
    pricePerKilo: v.number(), // In UGX
    unitSize: v.number(), // 10kg for farmer listings, 100kg for trader listings
    totalUnits: v.number(), // totalKilos / unitSize
    status: v.union(
      v.literal("active"),
      v.literal("partially_locked"),
      v.literal("fully_locked"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
    deliverySLA: v.number(), // Timestamp: 6 hours after payment (for farmer listings)
    qualityRating: v.optional(v.string()), // Quality rating from admin-managed dropdown (e.g., "Premium", "Good", "Fair")
    qualityComment: v.optional(v.string()), // Farmer's text comment about produce quality
    storageLocationId: v.optional(v.id("storageLocations")), // Storage location (district) where produce will be delivered (optional for backward compatibility with existing data)
    // Trader packaging-based listing fields (optional for backward compatibility)
    productName: v.optional(v.string()),
    packagingTypeEnum: v.optional(v.string()),
    packagingTypeCustom: v.optional(v.string()),
    availableUnits: v.optional(v.number()),
    pricingUnit: v.optional(v.union(v.literal("per_package"), v.literal("per_kg"))),
    pricePerUnit: v.optional(v.number()),
    departureLocation: v.optional(v.string()),
    destinationLocation: v.optional(v.string()),
    etaType: v.optional(v.union(v.literal("duration"), v.literal("arrival_time"))),
    etaValue: v.optional(v.number()),
    etaLastUpdatedAt: v.optional(v.number()),
    deliveryStatus: v.optional(v.union(
      v.literal("in_storage"),
      v.literal("in_transit"),
      v.literal("delivered")
    )),
    progressStage: v.optional(v.union(
      v.literal("departed"),
      v.literal("midway"),
      v.literal("delayed"),
      v.literal("arrived")
    )),
    // Garden sale mode
    listingMode: v.optional(v.union(v.literal("unit"), v.literal("garden"))), // Listing mode: unit-based (default) or entire garden plot
    gardenSize: v.optional(v.number()), // Garden size in acres (for garden mode)
    gardenDimensions: v.optional(v.any()), // Raw garden dimensions (for garden mode)
    totalPrice: v.optional(v.number()), // Total price for entire garden (for garden mode, in UGX)
  })
    .index("by_farmer", ["farmerId"])
    .index("by_trader", ["traderId"])
    .index("by_inventory", ["inventoryId"])
    .index("by_utid", ["utid"])
    .index("by_status", ["status"]),

  /**
   * Listing units (10kg each)
   * - Each unit can be locked independently
   * - Locking requires atomic payment
   * - Units can have active negotiations before locking
   */
  listingUnits: defineTable({
    listingId: v.id("listings"),
    unitNumber: v.number(), // 1, 2, 3, ... within the listing
    status: v.union(
      v.literal("available"),
      v.literal("locked"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    lockedBy: v.optional(v.id("users")), // Trader who locked it
    lockedAt: v.optional(v.number()),
    lockUtid: v.optional(v.string()), // UTID of the payment that locked this unit
    // Delivery SLA tracking
    deliveryDeadline: v.optional(v.number()), // Timestamp: lockedAt + 6 hours
    deliveryStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("farmer_confirmed"),
      v.literal("delivered"),
      v.literal("late"),
      v.literal("cancelled")
    )), // Tracks delivery status for SLA monitoring
    // Negotiation tracking
    activeNegotiationId: v.optional(v.id("negotiations")), // Active negotiation for this unit
    // Archive tracking
    archived: v.optional(v.boolean()), // Whether this UTID has been archived by farmer
    archivedAt: v.optional(v.number()), // When this UTID was archived
    // Delivery verification (StoreAdmin)
    deliveryComment: v.optional(v.string()), // StoreAdmin comment about delivery condition
    deliveryPhotos: v.optional(v.array(v.string())), // Array of photo storage IDs (3 photos: weighing, checking, in-storage)
    deliveryPdfId: v.optional(v.string()), // PDF document ID (stored in Convex file storage or external)
  })
    .index("by_listing", ["listingId"])
    .index("by_status", ["status"])
    .index("by_lock_utid", ["lockUtid"])
    .index("by_delivery_status", ["deliveryStatus"])
    .index("by_active_negotiation", ["activeNegotiationId"]),

  /**
   * Negotiations/Offers
   * - Traders make offers on units
   * - Farmers can accept, reject, or counter-offer
   * - Only accepted offers can proceed to pay-to-lock
   */
  negotiations: defineTable({
    unitId: v.id("listingUnits"),
    listingId: v.id("listings"),
    traderId: v.id("users"),
    farmerId: v.id("users"),
    status: v.union(
      v.literal("pending"), // Trader made offer, waiting for farmer response
      v.literal("accepted"), // Farmer accepted, trader can now pay-to-lock
      v.literal("rejected"), // Farmer rejected
      v.literal("countered"), // Farmer made counter-offer, waiting for trader
      v.literal("expired"), // Negotiation expired (timeout)
      v.literal("cancelled") // Negotiation cancelled
    ),
    // Price negotiation
    farmerPricePerKilo: v.number(), // Original listing price
    traderOfferPricePerKilo: v.number(), // Trader's offer price
    currentPricePerKilo: v.number(), // Current negotiated price (may be counter-offer)
    // Timestamps
    createdAt: v.number(), // When negotiation started
    lastUpdatedAt: v.number(), // Last update timestamp
    expiresAt: v.optional(v.number()), // Optional expiration (e.g., 24 hours)
    // UTIDs
    negotiationUtid: v.string(), // UTID for this negotiation
    acceptedUtid: v.optional(v.string()), // UTID when accepted (for pay-to-lock)
  })
    .index("by_unit", ["unitId"])
    .index("by_listing", ["listingId"])
    .index("by_trader", ["traderId"])
    .index("by_farmer", ["farmerId"])
    .index("by_status", ["status"])
    .index("by_utid", ["negotiationUtid"])
    .index("by_trader_status", ["traderId", "status"])
    .index("by_farmer_status", ["farmerId", "status"]),

  /**
   * Trader-Buyer Negotiations/Offers
   * - Buyers make offers on trader inventory
   * - Traders can accept, reject, or counter-offer
   * - Only accepted offers can proceed to purchase
   */
  traderBuyerNegotiations: defineTable({
    inventoryId: v.id("traderInventory"),
    traderId: v.id("users"),
    buyerId: v.id("users"),
    status: v.union(
      v.literal("pending"), // Buyer made offer, waiting for trader response
      v.literal("accepted"), // Trader accepted, buyer can now purchase
      v.literal("rejected"), // Trader rejected
      v.literal("countered"), // Trader made counter-offer, waiting for buyer
      v.literal("expired"), // Negotiation expired (timeout)
      v.literal("cancelled") // Negotiation cancelled
    ),
    // Price negotiation
    traderPricePerKilo: v.number(), // Trader's counter-offer price (0 if trader hasn't set price yet - buyer makes first offer)
    buyerOfferPricePerKilo: v.number(), // Buyer's offer price (buyer makes first offer)
    currentPricePerKilo: v.number(), // Current negotiated price (starts with buyer's offer, updated if trader counters)
    kilos: v.number(), // Kilos buyer wants to purchase
    // Timestamps
    createdAt: v.number(), // When negotiation started
    lastUpdatedAt: v.number(), // Last update timestamp
    expiresAt: v.optional(v.number()), // Optional expiration (e.g., 24 hours)
    // UTIDs
    negotiationUtid: v.string(), // UTID for this negotiation
    acceptedUtid: v.optional(v.string()), // UTID when accepted (for purchase)
  })
    .index("by_inventory", ["inventoryId"])
    .index("by_trader", ["traderId"])
    .index("by_buyer", ["buyerId"])
    .index("by_status", ["status"])
    .index("by_utid", ["negotiationUtid"])
    .index("by_trader_status", ["traderId", "status"])
    .index("by_buyer_status", ["buyerId", "status"]),

  /**
   * Trader inventory
   * - Aggregates into 100kg blocks for buyers
   * - Tracks storage time for fee calculation
   */
  traderInventory: defineTable({
    traderId: v.id("users"),
    listingUnitIds: v.array(v.id("listingUnits")), // Units that make up this inventory block
    totalKilos: v.number(), // Sum of all units
    blockSize: v.number(), // Target: 100kg blocks
    produceType: v.string(),
    storageLocationId: v.id("storageLocations"), // Storage location (district) - retained from farmer listing
    qualityRating: v.optional(v.string()), // Quality rating - retained from farmer listing
    unitPrice: v.number(), // Price per kilo in UGX - retained from farmer listing (actual purchase price)
    acquiredAt: v.number(), // When trader received delivery at storage (timestamp updated when admin confirms)
    storageStartTime: v.number(), // When storage fees start
    status: v.union(
      v.literal("pending_delivery"),
      v.literal("in_storage"),
      v.literal("sold"),
      v.literal("expired")
    ),
    utid: v.string(), // References the transaction that created this inventory
    is100kgBlock: v.boolean(), // Whether this is a 100kg block created for buyers
  })
    .index("by_trader", ["traderId"])
    .index("by_status", ["status"])
    .index("by_utid", ["utid"]),

  /**
   * Buyer purchase windows
   * - Global state controlled by admin
   * - Buyers can only purchase during open windows
   */
  purchaseWindows: defineTable({
    isOpen: v.boolean(),
    openedBy: v.id("users"), // Admin who opened it
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
    utid: v.string(), // Admin action UTID
  })
    .index("by_status", ["isOpen"]),

  /**
   * Buyer purchases
   * - Buyers never see prices
   * - Only allowed during open windows
   */
  buyerPurchases: defineTable({
    buyerId: v.id("users"),
    inventoryId: v.id("traderInventory"),
    kilos: v.number(),
    utid: v.string(),
    purchasedAt: v.number(),
    pickupSLA: v.number(), // Timestamp: 48 hours after purchase
    status: v.union(
      v.literal("pending_pickup"),
      v.literal("picked_up"),
      v.literal("expired")
    ),
  })
    .index("by_buyer", ["buyerId"])
    .index("by_utid", ["utid"])
    .index("by_status", ["status"]),

  /**
   * Storage fee deductions
   * - Deducted in kilos, not money
   * - All deductions logged with UTIDs
   */
  storageFeeDeductions: defineTable({
    inventoryId: v.id("traderInventory"),
    traderId: v.id("users"),
    kilosDeducted: v.number(),
    ratePerDay: v.number(), // Kilos per day
    daysStored: v.number(),
    deductionUtid: v.string(),
    timestamp: v.number(),
  })
    .index("by_inventory", ["inventoryId"])
    .index("by_trader", ["traderId"])
    .index("by_utid", ["deductionUtid"]),

  /**
   * Admin actions log
   * - All admin actions must be logged
   * - Includes UTID, reason, timestamp
   */
  adminActions: defineTable({
    adminId: v.id("users"),
    action: v.optional(v.string()),
    actionType: v.optional(v.string()),
    targetUserId: v.optional(v.id("users")),
    targetCommunityId: v.optional(v.id("communities")),
    details: v.optional(v.string()),
    reason: v.optional(v.string()),
    utid: v.optional(v.string()),
    targetUtid: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_admin", ["adminId"])
    .index("by_timestamp", ["timestamp"]),

  /**
   * Notifications
   * - Internal only (no SMS/email in v1.x)
   * - Admin broadcast, role-based, UTID-specific
   */
  /**
   * Device tokens for push notifications
   * - Stores FCM/APNS tokens for each user's devices
   * - Multiple devices per user supported
   */
  deviceTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // FCM token (Android) or APNS token (iOS)
    platform: v.union(v.literal("android"), v.literal("ios"), v.literal("web")),
    createdAt: v.number(),
    lastUsedAt: v.number(), // Updated when token is used
    active: v.boolean(), // Set to false when token is invalidated
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"])
    .index("by_user_active", ["userId", "active"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("admin_broadcast"),
      v.literal("role_based"),
      v.literal("utid_specific"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    utid: v.optional(v.string()), // If related to a specific transaction
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "read"])
    .index("by_utid", ["utid"]),

  /**
   * Payment transactions (Pesapal integration)
   * - Tracks external payment provider transactions
   * - Links to wallet deposits
   * - Stores payment status and callback data
   */
  paymentTransactions: defineTable({
    userId: v.id("users"), // Trader or buyer making payment
    userRole: v.union(v.literal("trader"), v.literal("buyer")),
    amount: v.number(), // Amount in UGX
    currency: v.string(), // Currency code (e.g., "UGX")
    pesapalOrderTrackingId: v.string(), // Pesapal order tracking ID
    pesapalPaymentReference: v.optional(v.string()), // Pesapal payment reference
    status: v.union(
      v.literal("pending"), // Payment initiated, awaiting completion
      v.literal("completed"), // Payment completed, wallet credited
      v.literal("failed"), // Payment failed
      v.literal("cancelled") // Payment cancelled by user
    ),
    redirectUrl: v.string(), // Pesapal redirect URL for payment
    callbackUrl: v.string(), // Callback URL for payment confirmation
    walletDepositUtid: v.optional(v.string()), // UTID of wallet deposit entry (after payment confirmation)
    metadata: v.optional(v.any()), // Additional payment metadata
    createdAt: v.number(), // Payment initiation timestamp
    completedAt: v.optional(v.number()), // Payment completion timestamp
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_pesapal_order", ["pesapalOrderTrackingId"])
    .index("by_wallet_utid", ["walletDepositUtid"]),

  /**
   * System settings
   * - Global system configuration
   * - Admin-controlled flags
   * - Single record (singleton pattern)
   */
  systemSettings: defineTable({
    pilotMode: v.boolean(), // When true, blocks all mutations that move money or inventory
    setBy: v.id("users"), // Admin who set this flag
    setAt: v.number(), // Timestamp when flag was set
    reason: v.string(), // Reason for setting flag
    utid: v.string(), // Admin action UTID
    storageFeeRateKgPerDay: v.optional(v.number()), // Kilo-shaving rate (kilos per day per 100kg block). Default: 0.5
    buyerServiceFeePercentage: v.optional(v.number()), // Service fee percentage added to purchase price for buyers. Default: 3
    traderCommissionPercentage: v.optional(v.number()), // Trader commission percentage on sales. Default: 0
    farmcoinPostingCost: v.optional(v.number()), // FarmCoin Tokens required to post a listing
    farmcoinEtaChangeCost: v.optional(v.number()), // FarmCoin Tokens required to change ETA
  }),

  /**
   * FarmCoin Ledger
   * - Per-transaction ledger entries
   * - Central ledger and per-trader ledger entries
   */
  farmcoinLedger: defineTable({
    accountType: v.union(v.literal("central"), v.literal("trader")),
    traderId: v.optional(v.id("users")),
    delta: v.number(),
    balanceAfter: v.number(),
    source: v.union(
      v.literal("grant"),
      v.literal("posting_cost"),
      v.literal("eta_change"),
      v.literal("admin_adjustment"),
      v.literal("transfer"),
      v.literal("future_reward")
    ),
    utid: v.string(),
    listingId: v.optional(v.id("listings")),
    adminId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trader", ["traderId", "createdAt"])
    .index("by_utid", ["utid"])
    .index("by_source", ["source"])
    .index("by_account", ["accountType", "createdAt"]),

  /**
   * FarmCoin Pricing History
   * - Versioned token pricing changes
   */
  farmcoinPricingHistory: defineTable({
    changedByAdminId: v.id("users"),
    oldValue: v.number(),
    newValue: v.number(),
    reason: v.string(),
    utid: v.string(),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_admin", ["changedByAdminId", "createdAt"]),

  /**
   * ETA change history
   */
  etaHistory: defineTable({
    listingId: v.id("listings"),
    oldEtaValue: v.optional(v.number()),
    newEtaValue: v.number(),
    etaType: v.union(v.literal("duration"), v.literal("arrival_time")),
    reason: v.string(),
    updatedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_listing", ["listingId", "createdAt"]),

  /**
   * Quality options for produce quality ratings
   * - Admin-managed dropdown options for farmers to select
   * - Used when farmers create listings to rate produce quality
   */
  qualityOptions: defineTable({
    label: v.string(), // Display label (e.g., "Premium", "Good", "Fair", "Poor")
    value: v.string(), // Unique value identifier (e.g., "premium", "good", "fair", "poor")
    order: v.number(), // Display order (lower numbers appear first)
    active: v.boolean(), // Whether this option is currently active/available
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this option
  })
    .index("by_active", ["active"])
    .index("by_order", ["order"]),

  /**
   * Produce options for produce type selection
   * - Admin-managed produce icons/types that farmers can select
   * - Used when farmers create listings to choose produce type
   * - Icons and labels are configurable by admin based on real-life operations
   */
  produceOptions: defineTable({
    label: v.string(), // Display label (e.g., "Banana", "Maize", "Beans")
    value: v.string(), // Unique value identifier (e.g., "Banana", "Maize", "Beans")
    icon: v.string(), // Emoji icon (e.g., "🍌", "🌽", "🫘")
    order: v.number(), // Display order (lower numbers appear first)
    active: v.boolean(), // Whether this option is currently active/available
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))), // Storage locations where this produce can be delivered
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this option
  })
    .index("by_active", ["active"])
    .index("by_order", ["order"]),

  /**
   * Storage locations (districts)
   * - Admin-managed storage locations where the app has storage facilities
   * - Used by farmers when creating listings to specify delivery location
   * - Helps admin prepare for delivery at specific locations
   */
  storageLocations: defineTable({
    districtName: v.string(), // District name (e.g., "Kampala", "Wakiso", "Mukono")
    code: v.string(), // Unique code identifier (e.g., "KLA", "WKS", "MKN")
    active: v.boolean(), // Whether this location is currently active/available
    order: v.number(), // Display order (lower numbers appear first)
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this location
    utid: v.string(), // Admin action UTID
  })
    .index("by_active", ["active"])
    .index("by_code", ["code"])
    .index("by_order", ["order"]),

  /**
   * Rate limit hits log
   * - Tracks all rate limit violations
   * - Admin-visible for monitoring and investigation
   * - Used to detect spam and manipulation attempts
   */
  rateLimitHits: defineTable({
    userId: v.id("users"),
    userRole: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin")),
    actionType: v.string(), // e.g., "lock_unit", "create_listing", "create_purchase"
    limitType: v.string(), // e.g., "negotiations_per_hour", "listings_per_day"
    limitValue: v.number(), // The limit that was exceeded
    attemptedAt: v.number(), // Timestamp of the attempt
    windowStart: v.number(), // Start of the rate limit window
    windowEnd: v.number(), // End of the rate limit window
    currentCount: v.number(), // Current count in the window
    metadata: v.optional(v.any()), // Additional context
  })
    .index("by_user", ["userId"])
    .index("by_user_role", ["userRole"])
    .index("by_action_type", ["actionType"])
    .index("by_timestamp", ["attemptedAt"])
    .index("by_user_timestamp", ["userId", "attemptedAt"]),

  /**
   * User sessions (stateful, database-backed)
   * - Production authentication session management
   * - Supports immediate revocation and compromise response
   * - Session tokens are cryptographically secure random strings
   * - Sessions can be invalidated immediately (logout, security invalidation)
   */
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(), // Cryptographically secure random token
    expiresAt: v.number(), // Session expiration timestamp
    createdAt: v.number(), // Session creation timestamp
    lastActiveAt: v.number(), // Last activity timestamp (updated on each request)
    invalidated: v.boolean(), // Session invalidation status
    invalidatedAt: v.optional(v.number()), // Session invalidation timestamp (set when invalidated)
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_user_active", ["userId", "invalidated"]), // Efficient lookup for active sessions per user (incident response)

  /**
   * Password reset tokens
   * - Secure password reset flow (production authentication)
   * - Tokens are hashed before storage (never stored in plaintext)
   * - Single-use tokens (invalidated after use)
   * - Time-limited tokens (expiration enforced)
   */
  passwordResetTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(), // Hashed reset token (never plaintext)
    expiresAt: v.number(), // Token expiration timestamp
    usedAt: v.optional(v.number()), // Timestamp when token was used (single-use enforcement)
    createdAt: v.number(), // Token creation timestamp
  })
    .index("by_user", ["userId"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Location hierarchy (Uganda administrative divisions)
   * - Districts → Subcounties → Parishes
   * - Used for farmer onboarding and geo-locking communities
   */
  districts: defineTable({
    name: v.string(), // District name (e.g., "Kampala", "Wakiso")
    code: v.string(), // Unique code identifier (e.g., "KLA", "WKS")
    active: v.boolean(), // Whether this district is currently active
    order: v.number(), // Display order (lower numbers appear first)
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this district
    utid: v.string(), // Admin action UTID
  })
    .index("by_active", ["active"])
    .index("by_code", ["code"])
    .index("by_order", ["order"]),

  subcounties: defineTable({
    districtId: v.id("districts"), // Parent district
    name: v.string(), // Subcounty name
    code: v.string(), // Unique code identifier
    active: v.boolean(), // Whether this subcounty is currently active
    order: v.number(), // Display order (lower numbers appear first)
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this subcounty
    utid: v.string(), // Admin action UTID
  })
    .index("by_district", ["districtId"])
    .index("by_active", ["active"])
    .index("by_code", ["code"])
    .index("by_order", ["order"]),

  parishes: defineTable({
    subcountyId: v.id("subcounties"), // Parent subcounty
    name: v.string(), // Parish name
    code: v.string(), // Unique code identifier
    active: v.boolean(), // Whether this parish is currently active
    order: v.number(), // Display order (lower numbers appear first)
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this parish
    utid: v.string(), // Admin action UTID
  })
    .index("by_subcounty", ["subcountyId"])
    .index("by_active", ["active"])
    .index("by_code", ["code"])
    .index("by_order", ["order"]),

  /**
   * Messages (UTID-linked)
   * - Users can message SuperAdmin
   * - SuperAdmin can message any user
   * - All messages must link to a UTID
   */
  messages: defineTable({
    fromUserId: v.id("users"), // Sender
    toUserId: v.id("users"), // Recipient
    utid: v.string(), // UTID this message is linked to (required)
    message: v.string(), // Message content
    read: v.boolean(), // Whether message has been read
    createdAt: v.number(),
  })
    .index("by_utid", ["utid"])
    .index("by_users", ["fromUserId", "toUserId"])
    .index("by_to_user_unread", ["toUserId", "read"])
    .index("by_from_user", ["fromUserId"]),

  /**
   * Grower Communities
   * - SuperAdmin creates communities
   * - Can be global or geo-locked
   * - Farmers can join communities
   * - Listings can be tagged to communities
   */
  communities: defineTable({
    name: v.string(), // Community name
    description: v.optional(v.string()), // Community description
    logoPath: v.optional(v.string()), // Optional logo path in /public
    communityAdminId: v.optional(v.id("users")), // Assigned community admin
    isGlobal: v.boolean(), // Whether community is global (not geo-locked)
    geoLocked: v.boolean(), // Whether community is geo-locked
    districtIds: v.optional(v.array(v.id("districts"))), // Districts for geo-locking
    subcountyIds: v.optional(v.array(v.id("subcounties"))), // Subcounties for geo-locking
    parishIds: v.optional(v.array(v.id("parishes"))), // Parishes for geo-locking
    createdBy: v.id("users"), // SuperAdmin who created this community
    createdAt: v.number(),
    utid: v.string(), // Admin action UTID
    communityType: v.optional(v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"))), // Type of community (optional for backward-compatibility)
  })
    .index("by_active", ["isGlobal", "geoLocked"])
    .index("by_created_by", ["createdBy"]),

  communityMemberships: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"), // Farmer who joined
    joinedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_community_user", ["communityId", "userId"]),

  communityListingTags: defineTable({
    listingId: v.id("listings"),
    communityId: v.id("communities"),
  })
    .index("by_listing", ["listingId"])
    .index("by_community", ["communityId"]),

  communityMembers: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    ),
    applicationId: v.optional(v.id("communityApplications")),
    joinedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_farmer", ["farmerId"])
    .index("by_community_farmer", ["communityId", "farmerId"])
    .index("by_status", ["status"]),

  communityApplications: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    formId: v.id("agroFreshUGFarmValidations"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
  })
    .index("by_community", ["communityId"])
    .index("by_farmer", ["farmerId"])
    .index("by_form", ["formId"])
    .index("by_status", ["status"])
    .index("by_community_farmer", ["communityId", "farmerId"]),

  adminActionLogs: defineTable({
    adminId: v.id("users"),
    communityId: v.id("communities"),
    applicationId: v.id("communityApplications"),
    action: v.union(
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_admin", ["adminId"])
    .index("by_community", ["communityId"]),

  agroFreshUGFarmValidations: defineTable({
    farmerId: v.id("users"),
    community: v.literal("AGROFRESH_UG"),
    communityName: v.optional(v.string()),
    status: v.union(v.literal("DRAFT"), v.literal("SUBMITTED")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedByFarmer: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),

    // Section 1: Farmer Registration Information & Farm Specifics
    section1: v.optional(v.object({
      farmerFullName: v.optional(v.string()),
      farmName: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      emailAddress: v.optional(v.string()),
      county: v.optional(v.string()),
      districtSubCounty: v.optional(v.string()),
      village: v.optional(v.string()),
      farmSizeAcres: v.optional(v.string()),
      totalAreaAgProductionAcres: v.optional(v.string()),
      totalAreaPlantedForestAcres: v.optional(v.string()),
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      mainEnterprises: v.optional(v.array(v.string())),
      otherCommercialActivity: v.optional(v.string()),
      yearsOfExperience: v.optional(v.string()),
      waterSource: v.optional(v.string()),
      waterSourceOther: v.optional(v.string()),
      certifications: v.optional(v.string()),
      verificationPhoto: v.optional(v.object(imageMetadata)),
      // Legacy fields retained for existing data
      nationalId: v.optional(v.string()),
      district: v.optional(v.string()),
      subCounty: v.optional(v.string()),
      parish: v.optional(v.string()),
      farmSize: v.optional(v.string()),
      farmSizeUnit: v.optional(v.string()),
      mainEnterprise: v.optional(v.string()),
      farmingExperience: v.optional(v.string()),
    })),

    section2_1_dairy: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentLivestockIntensity: v.optional(v.string()),
      numberOfMilkers: v.optional(v.string()),
      milkProductivityDaily: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy fields
      present: v.optional(v.boolean()),
      breed: v.optional(v.string()),
      animalCount: v.optional(v.string()),
      managementSystem: v.optional(v.string()),
      healthStatus: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
    })),

    section2_2_poultry: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentPoultryIntensity: v.optional(v.string()),
      typesOfChicken: v.optional(v.array(v.string())),
      typesOfChickenOther: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy fields
      present: v.optional(v.boolean()),
      breed: v.optional(v.string()),
      animalCount: v.optional(v.string()),
      managementSystem: v.optional(v.string()),
      healthStatus: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
    })),

    section2_3_piggery: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentPiggeryIntensity: v.optional(v.string()),
      product: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy fields
      present: v.optional(v.boolean()),
      breed: v.optional(v.string()),
      animalCount: v.optional(v.string()),
      managementSystem: v.optional(v.string()),
      healthStatus: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
    })),

    section2_4_rabbitry: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaUnit: v.optional(v.string()),
      enterpriseAreaLength: v.optional(v.string()),
      enterpriseAreaWidth: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentRabbitryIntensity: v.optional(v.string()),
      rabbitryIntensityOther: v.optional(v.string()),
      mainProduct: v.optional(v.array(v.string())),
      mainProductOther: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy fields
      present: v.optional(v.boolean()),
      breed: v.optional(v.string()),
      animalCount: v.optional(v.string()),
      managementSystem: v.optional(v.string()),
      healthStatus: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
    })),

    // Legacy section key
    section2_4_cuniculture: v.optional(v.object({
      present: v.optional(v.boolean()),
      breed: v.optional(v.string()),
      animalCount: v.optional(v.string()),
      managementSystem: v.optional(v.string()),
      healthStatus: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
    })),

    section2_5_apiary: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaUnit: v.optional(v.string()),
      enterpriseAreaLength: v.optional(v.string()),
      enterpriseAreaWidth: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentApiaryIntensity: v.optional(v.string()),
      mainProduct: v.optional(v.string()),
      mainProductOther: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy fields
      present: v.optional(v.boolean()),
      hiveCount: v.optional(v.string()),
      honeyProduction: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
    })),

    section2_6_aquaculture: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      enterpriseAreaUnit: v.optional(v.string()),
      enterpriseAreaLength: v.optional(v.string()),
      enterpriseAreaWidth: v.optional(v.string()),
      enterpriseAreaDepth: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      currentStock: v.optional(v.string()),
      typeOfFish: v.optional(v.array(v.string())),
      typeOfFishOther: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy crop fields
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),

    section2_7_banana: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      waterSource: v.optional(v.string()),
      waterSourceOther: v.optional(v.string()),
      manureType: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      productionIntensityPerAcre: v.optional(v.string()),
      type: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy crop fields
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),

    section2_8_maize: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      waterSource: v.optional(v.string()),
      waterSourceOther: v.optional(v.string()),
      manureType: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      productionIntensityPerAcre: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy crop fields
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),

    section2_9_fruitTrees: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      waterSource: v.optional(v.string()),
      waterSourceOther: v.optional(v.string()),
      manureType: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      stockPerAcre: v.optional(v.string()),
      type: v.optional(v.array(v.string())),
      typeOther: v.optional(v.string()),
      accessToColdStorage: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy crop fields
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),

    section2_10_plantedForest: v.optional(v.object({
      systemOfFarming: v.optional(v.string()),
      systemOfFarmingOther: v.optional(v.string()),
      waterSource: v.optional(v.string()),
      waterSourceOther: v.optional(v.string()),
      manureType: v.optional(v.string()),
      enterpriseAreaAcres: v.optional(v.string()),
      stockPerAcre: v.optional(v.string()),
      type: v.optional(v.string()),
      typeOther: v.optional(v.string()),
      marketPointOfSale: v.optional(v.string()),
      transportToMarket: v.optional(v.string()),
      // Legacy crop fields
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),

    // Legacy section key
    section2_10_woodyForest: v.optional(v.object({
      present: v.optional(v.boolean()),
      variety: v.optional(v.string()),
      areaUnderCultivation: v.optional(v.string()),
      areaUnit: v.optional(v.string()),
      productionOutput: v.optional(v.string()),
      productionUnit: v.optional(v.string()),
      lastHarvestDate: v.optional(v.string()),
    })),
  })
    .index("by_farmerId_and_community", ["farmerId", "community"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Export logs for quota tracking
   * - Track exports per user (mainly for community admins)
   * - Standard tier: 5 exports per month
   * - Premium tier: unlimited exports
   */
  exportLogs: defineTable({
    userId: v.id("users"), // User who exported
    exportType: v.string(), // "community_members", "excel", "pdf", etc.
    exportedAt: v.number(), // Timestamp
    month: v.string(), // "YYYY-MM" for monthly quota tracking
    dataCount: v.number(), // Number of rows/records exported
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "month"])
    .index("by_exported_at", ["exportedAt"]),
});
