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
    userId: v.optional(v.string()), // Unique identifier from auth system (tokenIdentifier)
    email: v.optional(v.string()), // Optional - user can use email or phone number
    phoneNumber: v.optional(v.string()), // Optional - user can use email or phone number
    sex: v.optional(v.union(v.literal("M"), v.literal("F"))), // Optional - farmer profile field
    role: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin"), v.literal("vendor"), v.literal("transporter"), v.literal("store")),
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
    gpsLat: v.optional(v.number()), // GPS latitude captured during onboarding
    gpsLng: v.optional(v.number()), // GPS longitude captured during onboarding
    // Farmer profile (community onboarding preload fields)
    county: v.optional(v.string()),
    village: v.optional(v.string()),
    waterSource: v.optional(v.string()),
    districtText: v.optional(v.string()),
    subCountyText: v.optional(v.string()),
    parishText: v.optional(v.string()),
    // Trader verification
    isVerifiedTrader: v.optional(v.boolean()),
    verificationStatus: v.optional(v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
    isTestUser: v.optional(v.boolean()), // Marks test users for safe cleanup/reset
    // Notification preferences
    notificationPreferences: v.optional(v.any()), // { newListings: boolean, offers: boolean, etc. }
    // Pagination preferences (per user)
    paginationPreferences: v.optional(v.any()), // { defaultPageSize: number, list: { [key: string]: number } }
    // Community scope and onboarding
    accountScope: v.optional(v.union(v.literal("full"), v.literal("community_only"))), // Whether account is restricted to a single community
    onboardedViaCommunityId: v.optional(v.id("communities")), // The community through which user was onboarded (for community_only accounts)
    supplyChainRole: v.optional(v.string()), // Role in the supply chain (e.g., "producer", "aggregator", "processor")
    supplyChainRoleOther: v.optional(v.string()), // Custom supply chain role if not in standard list
  })
    .index("by_userId", ["userId"])
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
    listingMode: v.optional(v.union(v.literal("unit"), v.literal("garden"), v.literal("packaging"))), // Listing mode: unit-based (default), garden plot, or packaging (vendor/store)
    gardenSize: v.optional(v.number()), // Garden size in acres (for garden mode)
    gardenDimensions: v.optional(v.any()), // Raw garden dimensions (for garden mode)
    totalPrice: v.optional(v.number()), // Total price for entire garden (for garden mode, in UGX)
    collectionLocationText: v.optional(v.string()), // Vendor/store collection location text for buyers
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
    category: v.optional(v.string()),
    priority: v.optional(v.string()),
    reminderFlag: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
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
    priceSheetDailyPriceUGX: v.optional(v.number()), // Price buyers pay for a daily market price Excel sheet
    priceSheetWeeklyPriceUGX: v.optional(v.number()), // Price buyers pay for a weekly market price Excel sheet
    priceSheetMonthlyPriceUGX: v.optional(v.number()), // Price buyers pay for a monthly market price Excel sheet
  }),

  /**
   * FarmCoin Ledger
   * - Per-transaction ledger entries
   * - Central ledger and per-trader ledger entries
   */
  farmcoinLedger: defineTable({
    accountType: v.union(
      v.literal("central"),
      v.literal("trader"),
      v.literal("sentify"),
      v.literal("buyer_reward"),
      v.literal("farmer")
    ),
    traderId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
    delta: v.number(),
    balanceAfter: v.number(),
    source: v.union(
      v.literal("grant"),
      v.literal("posting_cost"),
      v.literal("eta_change"),
      v.literal("admin_adjustment"),
      v.literal("transfer"),
      v.literal("future_reward"),
      v.literal("sentify_receipt"),
      v.literal("buyer_confirmation_reward"),
      v.literal("sentify_cashout"),
      v.literal("buyer_reward_cashout"),
      v.literal("form_field_reward"),
      v.literal("price_sheet_download"),
      v.literal("tracker_entry_reward")
    ),
    utid: v.string(),
    listingId: v.optional(v.id("listings")),
    batchUtid: v.optional(v.string()),
    relatedUtid: v.optional(v.string()),
    adminId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    formResponseId: v.optional(v.id("formResponses")),
    trackerEntryId: v.optional(v.id("farmTrackerEntries")), // Farm toolbox tracker entry reward
    communityId: v.optional(v.id("communities")),
    fieldCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_trader", ["traderId", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_utid", ["utid"])
    .index("by_source", ["source"])
    .index("by_account", ["accountType", "createdAt"]),

  /**
   * Buyer purchases of trader listings
   * - Fixed price purchases (no negotiation)
   * - Escrow lock with delivery confirmations
   */
  buyerListingPurchases: defineTable({
    buyerId: v.id("users"),
    listingId: v.id("listings"),
    listingUtid: v.string(),
    traderId: v.id("users"),
    unitCount: v.number(),
    unitSize: v.number(),
    totalKilos: v.number(),
    pricePerUnit: v.number(),
    pricePerKilo: v.number(),
    serviceFeePercentage: v.number(),
    serviceFee: v.number(),
    totalCost: v.number(),
    utid: v.string(),
    purchasedAt: v.number(),
    etaType: v.optional(v.union(v.literal("duration"), v.literal("arrival_time"))),
    etaValue: v.optional(v.number()),
    etaBaseTime: v.optional(v.number()),
    etaDeadline: v.optional(v.number()),
    status: v.union(
      v.literal("pending_delivery"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    traderConfirmedAt: v.optional(v.number()),
    buyerConfirmedAt: v.optional(v.number()),
    superadminConfirmedAt: v.optional(v.number()),
    traderConfirmationUtid: v.optional(v.string()),
    buyerConfirmationUtid: v.optional(v.string()),
    superadminConfirmationUtid: v.optional(v.string()),
    buyerOverrideBySuperadmin: v.optional(v.boolean()),
    sentifyUtid: v.optional(v.string()),
    buyerRewardUtid: v.optional(v.string()),
    escrowReleasedAt: v.optional(v.number()),
  })
    .index("by_buyer", ["buyerId", "purchasedAt"])
    .index("by_listing", ["listingId", "purchasedAt"])
    .index("by_listing_utid", ["listingUtid", "purchasedAt"])
    .index("by_utid", ["utid"])
    .index("by_status", ["status"]),

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
    category: v.optional(v.string()), // Produce category (e.g., "Grains & Cereals", "Vegetables")
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
    userRole: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin"), v.literal("vendor"), v.literal("transporter"), v.literal("store")),
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
    communityType: v.optional(v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("vendor"), v.literal("transporter"), v.literal("store"))), // Type of community (optional for backward-compatibility)
    autoJoinRoleMembers: v.optional(v.boolean()), // SuperAdmin toggle: auto-join all users of the community's default role
    // QR code and community features
    qrEnabled: v.optional(v.boolean()), // Whether community has QR code feature enabled
    qrSlug: v.optional(v.string()), // Slug for community QR code (e.g., "biofarm-ug")
    qrLogoUrl: v.optional(v.string()), // URL to logo displayed in QR code join flow
    // Discovery and search
    searchPriorityScore: v.optional(v.number()), // Higher scores appear first in community search results
    showMemberCount: v.optional(v.boolean()), // Controls whether non-admin users can see member counts
    showFertilizerPlanner: v.optional(v.boolean()), // Controls whether farmers can see the Bio Farm fertilizer planner
    farmNeedsEnabled: v.optional(v.boolean()), // Whether farm needs/requests feature is enabled for this community
    crmEnabled: v.optional(v.boolean()), // Feature flag for enabling Community CRM module in this community
  })
    .index("by_active", ["isGlobal", "geoLocked"])
    .index("by_created_by", ["createdBy"]),

  communityMemberships: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"), // Member who joined
    joinedAt: v.number(),
    communityRole: v.optional(v.string()), // Community-specific role label (e.g. "Lead Aggregator", "Input Supplier")
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

  // ───────────────────────────────────────────────────────────────────────────────
  // ⚠️ COMMUNITY FORM TABLES - DATA ISOLATION REQUIRED
  // ───────────────────────────────────────────────────────────────────────────────
  //
  // 🔐 SECURITY RULE: All community-specific form tables MUST have:
  //    1. communityId: v.id("communities")  ← Links form to specific community
  //    2. farmerId: v.id("users")           ← Links form to farmer
  //    3. Indexes on: by_community, by_community_farmer, by_status
  //
  // This prevents cross-community data leaks in exports and queries.
  // When adding a NEW community form table, use this TEMPLATE:
  //
  //   newCommunityFormTable: defineTable({
  //     // ✅ REQUIRED - Data Isolation Fields (ALWAYS ADD THESE)
  //     communityId: v.id("communities"),
  //     farmerId: v.id("users"),
  //     status: v.union(v.literal("DRAFT"), v.literal("SUBMITTED")),
  //     createdAt: v.number(),
  //     updatedAt: v.number(),
  //
  //     // Your form-specific fields below
  //     section1: v.optional(v.object({...})),
  //     section2: v.optional(v.object({...})),
  //     // ...
  //   })
  //     .index("by_community", ["communityId"])
  //     .index("by_community_farmer", ["communityId", "farmerId"])
  //     .index("by_status", ["status"]),
  //
  // TypeScript & runtime validation in convex/types/communityForms.ts will
  // automatically catch if you forget communityId.
  // ───────────────────────────────────────────────────────────────────────────────

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

  /**
   * Usage Events
   * - Track user actions for billing and analytics
   * - Used for community-only features pricing
   */
  usageEvents: defineTable({
    communityId: v.id("communities"), // Community where event occurred
    userId: v.id("users"), // User who performed the action
    eventType: v.string(), // e.g., "post_image", "send_message", etc.
    isBillable: v.boolean(), // Whether this event should be charged
    createdAt: v.number(), // Timestamp
    sourceModule: v.optional(v.string()), // e.g., "qr_community"
    apkFlavourId: v.optional(v.id("_storage")), // Optional APK flavour identifier
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_community_user", ["communityId", "userId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Noticeboard Posts
   * - Images posted by community admin
   * - Subject to freeImageQuotaPerMonth
   * - Tracks monthly usage (monthKey for quota enforcement)
   */
  noticeboardPosts: defineTable({
    communityId: v.id("communities"),
    adminId: v.id("users"),
    imageStorageId: v.id("_storage"),
    caption: v.optional(v.string()),
    monthKey: v.string(), // "YYYY-MM" for monthly quota tracking
    createdAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_admin", ["adminId"])
    .index("by_month", ["monthKey"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Community Messages
   * - Text and image messages sent by members in a community
   * - Can be replies to noticeboard posts
   * - Image messages trigger billable events
   */
  communityMessages: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"),
    imageStorageId: v.optional(v.id("_storage")), // null for text-only messages
    text: v.optional(v.string()),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
    createdAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_post", ["replyToPostId"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Message Targets
   * - Stores targeting metadata for community messages
   * - Enables filtering messages by recipient type (all, individual, role, superadmin)
   */
  messageTargets: defineTable({
    messageId: v.id("communityMessages"),
    communityId: v.id("communities"),
    targetType: v.string(), // "all" | "individual" | "role" | "superadmin"
    targetUserIds: v.optional(v.array(v.id("users"))),
    targetRole: v.optional(v.string()), // "farmer" | "trader" | "buyer"
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_community", ["communityId"]),

  /**
   * Post Likes
   * - Members can like noticeboard posts (free engagement)
   */
  postLikes: defineTable({
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
    communityId: v.id("communities"),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_user", ["userId"])
    .index("by_post_user", ["postId", "userId"])
    .index("by_community", ["communityId"]),

  /**
   * Post Dislikes
   * - Members can dislike noticeboard posts (free engagement)
   */
  postDislikes: defineTable({
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
    communityId: v.id("communities"),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_user", ["userId"])
    .index("by_post_user", ["postId", "userId"])
    .index("by_community", ["communityId"]),

  /**
   * Community Monetisation Settings
   * - Store pricing and quota configuration per community
   * - Set by superadmin when creating/configuring QR community
   */
  communityMonetisationSettings: defineTable({
    communityId: v.id("communities"),
    juniorAdminFreeMonthlyImageQuota: v.number(), // Free image posts per month for junior admin
    juniorAdminImagePrice: v.number(), // Price in UGX for junior admin image post after quota exhausted
    memberImageMessagePrice: v.number(), // Price in UGX for member image message
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"), // Superadmin who updated settings
  })
    .index("by_community", ["communityId"]),

  /**
   * Junior Admin Image Quota Tracker
   * - Track monthly quota usage and reset date
   */
  juniorAdminImageQuota: defineTable({
    communityId: v.id("communities"),
    adminId: v.id("users"),
    monthKey: v.string(), // "YYYY-MM" format
    usedQuota: v.number(), // Number of free image posts used this month
    lastQuotaResetAt: v.number(), // Timestamp of last quota reset
    resetsAt: v.number(), // Timestamp when quota will reset next month
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community_admin", ["communityId", "adminId"])
    .index("by_month", ["monthKey"]),

  /**
   * Payments
   * - Track payment transactions for gated features
   * - Used for junior admin image posts and member image messages
   */
  payments: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"),
    paymentType: v.union(
      v.literal("juniorAdminImagePost"),
      v.literal("memberImageMessage"),
      v.literal("other")
    ), // Type of action requiring payment
    payableAmount: v.number(), // Amount required to access feature (in UGX)
    billedAmount: v.number(), // Amount actually paid (in UGX)
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")), // Payment status
    pesapalTrackingId: v.optional(v.string()), // Pesapal tracking ID for verification
    pesapalOrderId: v.optional(v.string()), // Pesapal order ID
    relatedEntityId: v.optional(v.string()), // ID of related post/message
    createdAt: v.number(),
    paidAt: v.optional(v.number()), // Timestamp when payment was confirmed
    failedReason: v.optional(v.string()), // Reason for failure if status is failed
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_community_user", ["communityId", "userId"])
    .index("by_status", ["status"])
    .index("by_type", ["paymentType"])
    .index("by_pesapal_tracking", ["pesapalTrackingId"]),

  /**
   * Extension Work Payment Intents
   * - Tracks payment authorization for extension-work form submissions
   * - One successful payment can only be consumed once by a form response
   */
  extensionWorkPaymentIntents: defineTable({
    orderTrackingId: v.string(),
    memberId: v.id("users"),
    communityId: v.id("communities"),
    formId: v.id("communityForms"),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    paymentReference: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    consumedByResponseId: v.optional(v.id("formResponses")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_tracking", ["orderTrackingId"])
    .index("by_member_form", ["memberId", "formId"])
    .index("by_member_form_status", ["memberId", "formId", "status"])
    .index("by_form", ["formId"]),

  /**
   * Community Forms - custom forms created by community admins
   * - Each community can have multiple forms
   * - Members fill out forms to submit data
   * - Admins can export responses (billable by rows × columns × price-per-cell)
   */
  communityForms: defineTable({
    communityId: v.id("communities"),
    adminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    responseCount: v.number(),
    category: v.optional(v.string()),
    formPurpose: v.optional(v.union(v.literal("tracker"), v.literal("profile"), v.literal("extension_work"))),
    paymentEnabled: v.optional(v.boolean()),
    paymentAmount: v.optional(v.number()),
    paymentAmountEditable: v.optional(v.boolean()),
    qrEnabled: v.optional(v.boolean()),
    qrSlug: v.optional(v.string()),
    qrCreatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_admin", ["adminId"])
    .index("by_active", ["isActive"])
    .index("by_community_isdeleted", ["communityId", "isDeleted"]),

  /**
   * Form Fields - individual fields within a form
   * - Each field has type, label, required flag, and optional configuration
   * - Supports text, email, phone, number, select, textarea, checkbox
   */
  formFields: defineTable({
    formId: v.id("communityForms"),
    fieldType: v.string(), // text, email, phone, number, select, textarea, checkbox, date, camera, gps
    label: v.string(),
    required: v.boolean(),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())), // For select/checkbox fields
    order: v.number(), // Display order
    isCalculated: v.optional(v.boolean()), // Auto-calculated from other fields
    formula: v.optional(v.string()), // e.g. "revenue - expenses" (field labels, lowercased, spaces→underscores)
    createdAt: v.number(),
  })
    .index("by_form", ["formId"]),

  /**
   * Form Responses - individual member submissions
   * - Tracks who submitted and when
   * - Actual field values stored in formResponseValues table
   */
  formResponses: defineTable({
    formId: v.id("communityForms"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
    planId: v.optional(v.id("fertilizerPlans")), // Optional link to Bio Farm fertilizer plan
    plannedSprayDate: v.optional(v.string()), // Optional planned spray date (ISO) for compliance checks
    trackedUnitId: v.optional(v.id("farmTrackedUnits")),
    paymentStatus: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    paymentAmount: v.optional(v.number()),
    clientSubmissionKey: v.optional(v.string()),
    status: v.optional(v.string()), // "DRAFT" | "SUBMITTED" — defaults to SUBMITTED for backward compat
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_form", ["formId"])
    .index("by_community", ["communityId"])
    .index("by_member", ["memberId"])
    .index("by_form_member", ["formId", "memberId"])
    .index("by_member_form_submission_key", ["memberId", "formId", "clientSubmissionKey"]),

  /**
   * Form Response Values - individual field responses
   * - Stores the actual answer for each field in a response
   * - Clean separation allows efficient export queries
   */
  formResponseValues: defineTable({
    responseId: v.id("formResponses"),
    fieldId: v.id("formFields"),
    value: v.string(), // Stored as string for consistency
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // Set on upsert for live profile form fields
  })
    .index("by_response", ["responseId"])
    .index("by_field", ["fieldId"]),

  /**
   * Fertilizer Planner Config
   * - One config document per community (Bio Farm uses this for dose/schedule logic)
   * - All planner logic reads from this config so admin edits apply immediately
   */
  fertilizerConfig: defineTable({
    communityId: v.id("communities"),
    cropConfigs: v.array(v.object({
      crop: v.string(),
      doseMl: v.number(),
      startDay: v.number(),
      intervalDays: v.number(),
      seasonLengthDays: v.number(),
      stageOverrides: v.optional(v.array(v.object({
        stage: v.string(),
        startDayAdjust: v.optional(v.number()),
        intervalAdjust: v.optional(v.number()),
      }))),
    })),
    baselineYields: v.array(v.object({
      crop: v.string(),
      tonsPerAcre: v.number(),
    })),
    improvementFactor: v.number(),
    bottleSizeMl: v.number(),
    knapsacksPerAcre: v.number(),
    waterPerKnapsackL: v.number(),
    requiredPhotoCategories: v.array(v.string()),
    guaranteeThresholds: v.object({
      doseTolerancePct: v.number(),
      scheduleDaysLateTolerance: v.number(),
    }),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_community", ["communityId"]),

  /**
   * Fertilizer Plans
   * - Stored computed outputs so farmers can re-open plan details later
   */
  fertilizerPlans: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    farmName: v.string(),
    crop: v.string(),
    cropStage: v.string(),
    plantingDate: v.string(), // ISO date (YYYY-MM-DD)
    acres: v.number(),
    knapsacks: v.number(),
    doseMl: v.number(),
    intervalDays: v.number(),
    startDay: v.number(),
    seasonLengthDays: v.number(),
    bottlesPerSpray: v.number(),
    waterRequiredL: v.number(),
    sprayDates: v.array(v.string()),
    totalBottles: v.number(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("abandoned")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_community", ["communityId"])
    .index("by_farmer_community", ["farmerId", "communityId"]),

  /**
   * Yield Guarantee Status
   * - Eligibility state derived from dose/schedule/photo/record compliance
   */
  yieldGuaranteeStatus: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    planId: v.id("fertilizerPlans"),
    eligible: v.boolean(),
    doseCompliant: v.boolean(),
    scheduleCompliant: v.boolean(),
    photosComplete: v.boolean(),
    recordsComplete: v.boolean(),
    lastCheckedAt: v.number(),
  })
    .index("by_plan", ["planId"])
    .index("by_farmer_community", ["farmerId", "communityId"]),

  /**
   * Spray Reminders
   * - Tracks day-before, morning-of, and missed reminders per planned spray date
   */
  sprayReminders: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    planId: v.id("fertilizerPlans"),
    scheduledDate: v.string(), // ISO date (YYYY-MM-DD)
    reminderType: v.union(v.literal("day_before"), v.literal("morning_of"), v.literal("missed")),
    sent: v.boolean(),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_plan", ["planId"])
    .index("by_farmer", ["farmerId"])
    .index("by_pending", ["sent", "scheduledDate"]),

  /**
   * Yield Projections
   * - Stores baseline and projected yields for each fertilizer plan
   */
  yieldProjections: defineTable({
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    planId: v.id("fertilizerPlans"),
    crop: v.string(),
    acres: v.number(),
    baselineYieldTons: v.number(),
    projectedYieldTons: v.number(),
    improvementFactor: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_plan", ["planId"])
    .index("by_farmer_community", ["farmerId", "communityId"]),

  /**
   * Tracker Templates - pre-built financial tracker templates
   * - Seeded on first load, admin can create from template
   * - Each template defines name, category, and field definitions
   */
  trackerTemplates: defineTable({
    name: v.string(), // e.g. "Daily Revenue Tracker"
    description: v.optional(v.string()),
    category: v.string(), // "revenue", "expense", "inventory", "profit_loss", "cashflow", "custom"
    fields: v.array(v.object({
      fieldType: v.string(),
      label: v.string(),
      required: v.boolean(),
      helpText: v.optional(v.string()),
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      isCalculated: v.optional(v.boolean()),
      formula: v.optional(v.string()),
    })),
    createdAt: v.number(),
  })
    .index("by_category", ["category"]),

  /**
   * Tutorial Videos - training and support videos
   * - Superadmin-managed video library
   * - Organized by user role (farmer, trader, buyer, admin)
   * - Members access tutorials via /learn page
   */
  tutorialVideos: defineTable({
    roleCategory: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("all") // Tutorials visible to all roles
    ),
    title: v.string(), // Tutorial title (e.g., "How to Create a Listing")
    description: v.optional(v.string()), // Optional tutorial description
    youtubeUrl: v.string(), // Full YouTube URL (https://www.youtube.com/watch?v=...)
    youtubeVideoId: v.string(), // Extracted video ID for embedding
    duration: v.optional(v.number()), // Duration in seconds (fetched from YouTube)
    thumbnailUrl: v.optional(v.string()), // YouTube thumbnail URL
    order: v.number(), // Display order within role category (lower = first)
    active: v.boolean(), // Whether this tutorial is published
    viewCount: v.optional(v.number()), // Track views for analytics
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"), // Superadmin who added this tutorial
  })
    .index("by_role", ["roleCategory"])
    .index("by_role_order", ["roleCategory", "order"])
    .index("by_active", ["active"])
    .index("by_created_at", ["createdAt"]),

  // ── Vendor / Transporter / Store profile tables ──

  vendorProfiles: defineTable({
    userId: v.id("users"),
    region: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    subcountyId: v.optional(v.id("subcounties")),
    parishId: v.optional(v.id("parishes")),
    marketType: v.union(
      v.literal("city_market"),
      v.literal("supermarket"),
      v.literal("roadside_market"),
      v.literal("town_market"),
      v.literal("village_market")
    ),
    marketName: v.optional(v.string()), // Mandatory for new onboarding, optional in schema for backward compat
    stallNumber: v.optional(v.string()), // Optional stall number
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  transporterProfiles: defineTable({
    userId: v.id("users"),
    vehicleType: v.union(
      v.literal("cold_storage"),
      v.literal("open_pickup"),
      v.literal("box_body")
    ),
    vehicleTypeCustom: v.optional(v.string()), // Free text when "other" selected on UI
    weightCapacityTonnes: v.number(),
    vehicleCount: v.number(),
    departureRegion: v.optional(v.string()),
    departureDistrictId: v.optional(v.id("districts")),
    departureSubcountyId: v.optional(v.id("subcounties")),
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  storeProfiles: defineTable({
    userId: v.id("users"),
    region: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    subcountyId: v.optional(v.id("subcounties")),
    parishId: v.optional(v.id("parishes")),
    storageCapacityTonnes: v.number(),
    storeType: v.union(
      v.literal("cold_storage"),
      v.literal("dry_storage")
    ),
    storeTypeCustom: v.optional(v.string()), // Free text when "other" selected on UI
    streetAddress: v.optional(v.string()), // Mandatory for new onboarding, optional in schema for backward compat
    buildingName: v.optional(v.string()), // Mandatory for new onboarding
    storeNumber: v.optional(v.string()), // Mandatory for new onboarding
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  /**
   * Community Imported Members
   * - Placeholder entries for bulk-imported community members before account creation
   * - Used by junior community admins to upload and manage member lists
   * - Isolated from communityMembers/communityApplications to avoid breaking existing flows
   */
  communityImportedMembers: defineTable({
    communityId: v.id("communities"),
    fullName: v.string(),
    phoneNumber: v.string(), // Unique within community
    email: v.optional(v.string()),
    communityRole: v.optional(v.string()),
    status: v.union(v.literal("IMPORTED"), v.literal("ACTIVATED")),
    createdAt: v.number(),
    updatedAt: v.number(),
    accountUserId: v.optional(v.id("users")), // Links to created account after activation
    presetPasswordHash: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Store all additional Excel columns as flexible JSON data
    additionalData: v.optional(v.any()),
  })
    .index("by_community", ["communityId"])
    .index("by_phone", ["phoneNumber"])
    .index("by_community_status", ["communityId", "status"]),

  /**
   * Market Price Submissions
   * - Explicit vendor price submissions for the public market price panel
   * - Separate from listings; vendors can submit a price directly
   */
  marketPriceSubmissions: defineTable({
    vendorId: v.id("users"),
    commodity: v.string(),
    commodityEmoji: v.optional(v.string()),
    unit: v.string(), // e.g. "kg", "bunch", "crate"
    priceUGX: v.number(),
    marketName: v.string(),
    marketType: v.optional(v.string()),
    submittedAt: v.number(),
  })
    .index("by_vendor", ["vendorId"])
    .index("by_submitted_at", ["submittedAt"]),

  /**
   * Daily Price Snapshots
   * - One per calendar day, frozen by cron at midnight Uganda time
   * - The public price panel reads from the most recent published snapshot
   */
  dailyPriceSnapshots: defineTable({
    dateKey: v.string(), // e.g. "2026-04-21"
    status: v.union(
      v.literal("building"),
      v.literal("published"),
      v.literal("archived")
    ),
    publishedAt: v.optional(v.number()),
    rowCount: v.number(),
  })
    .index("by_date_key", ["dateKey"])
    .index("by_status", ["status"]),

  /**
   * Daily Price Snapshot Rows
   * - Aggregated price rows within a daily snapshot
   * - One row per (commodity × marketName) pair
   */
  dailyPriceSnapshotRows: defineTable({
    snapshotId: v.id("dailyPriceSnapshots"),
    commodity: v.string(),
    commodityEmoji: v.optional(v.string()),
    unit: v.string(),
    marketName: v.string(),
    marketEmoji: v.optional(v.string()),
    minPriceUGX: v.number(),
    medianPriceUGX: v.number(),
    maxPriceUGX: v.number(),
    latestPriceUGX: v.number(),
    latestUpdatedAt: v.number(),
    rankOrder: v.number(),
    source: v.union(
      v.literal("listing"),
      v.literal("submission"),
      v.literal("combined")
    ),
  })
    .index("by_snapshot", ["snapshotId"])
    .index("by_snapshot_updated", ["snapshotId", "latestUpdatedAt"]),

  /**
   * Download Purchases
   * - Buyer entitlements to download market price Excel sheets
   * - Paid via Pesapal or FarmCoin buyer_reward balance
   */
  downloadPurchases: defineTable({
    buyerId: v.id("users"),
    productType: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    scopeDateKey: v.string(), // e.g. "2026-04-21" (daily), "2026-W17" (weekly), "2026-04" (monthly)
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    paymentMethod: v.union(
      v.literal("pesapal"),
      v.literal("farmcoin")
    ),
    pesapalTrackingId: v.optional(v.string()),
    amountUGX: v.number(),
    purchasedAt: v.number(),
    entitlementExpiresAt: v.optional(v.number()),
  })
    .index("by_buyer", ["buyerId"])
    .index("by_buyer_scope", ["buyerId", "scopeDateKey"]),

  /**
   * Download Audit Log
   * - Records every actual file download for audit purposes
   */
  downloadAuditLog: defineTable({
    userId: v.id("users"),
    productType: v.string(),
    scopeDateKey: v.string(),
    downloadedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ─────────────────────────────────────────────────────────────────
  // 🌾 FARM TOOLBOX — tracker templates, entries, tracked units
  // ─────────────────────────────────────────────────────────────────

  /**
   * Farm Tracker Templates
   * - ownerType "system" = SuperAdmin (visible to all farmers)
   * - ownerType "community" = Community Admin (visible to community members)
   * - ownerType "personal" = Farmer's own template
   * - Farmers can delete their own personal templates
   */
  farmTrackerTemplates: defineTable({
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    category: v.union(v.literal("crop"), v.literal("livestock"), v.literal("general")),
    templateName: v.string(),
    emoji: v.string(),
    description: v.optional(v.string()),
    // fields is an array of field definitions
    fields: v.array(v.object({
      name: v.string(),
      fieldType: v.union(
        v.literal("text"),
        v.literal("number"),
        v.literal("date"),
        v.literal("yesno"),
        v.literal("photo"),
        v.literal("rating"),
        v.literal("gps")
      ),
      unit: v.optional(v.string()),
      required: v.boolean(),
      emoji: v.optional(v.string()),
      order: v.number(),
    })),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_type", ["ownerType"])
    .index("by_community", ["communityId"]),

  /**
   * Farm Tracker Entries
   * - Submitted by a farmer against a template
   * - Optionally linked to a tracked unit
   * - Supports photo attachments via Convex _storage
   * - GPS auto-collected on save
   * - syncStatus supports offline queue
   */
  farmTrackerEntries: defineTable({
    farmerId: v.id("users"),
    templateId: v.id("farmTrackerTemplates"),
    trackedUnitId: v.optional(v.id("farmTrackedUnits")),
    fieldValues: v.array(v.object({
      fieldName: v.string(),
      value: v.string(), // stored as string; numbers/dates serialised
    })),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    gpsLat: v.optional(v.number()),
    gpsLng: v.optional(v.number()),
    gpsAccuracy: v.optional(v.number()),
    farmAddress: v.optional(v.object({
      streetAddress: v.optional(v.string()),
      village: v.optional(v.string()),
      parish: v.optional(v.string()),
      subcounty: v.optional(v.string()),
      district: v.optional(v.string()),
      county: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    fieldCount: v.optional(v.number()), // populated fields for FarmCoin calc
    farmcoinRewarded: v.optional(v.boolean()),
    syncStatus: v.optional(v.union(v.literal("pending"), v.literal("synced"))),
    notes: v.optional(v.string()),
    submittedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_template", ["templateId"])
    .index("by_farmer_template", ["farmerId", "templateId"])
    .index("by_tracked_unit", ["trackedUnitId"]),

  /**
   * Farm Tracked Units
   * - Individual named or aggregate group tracking
   * - Works for both crops and livestock
   * - status drives survival-rate insights
   */
  farmTrackedUnits: defineTable({
    farmerId: v.id("users"),
    category: v.union(v.literal("crop"), v.literal("livestock")),
    unitType: v.string(),       // e.g. "mango tree", "cow", "maize plot"
    name: v.optional(v.string()), // individual name e.g. "Bessie"
    number: v.optional(v.number()), // individual number e.g. 23
    groupLabel: v.optional(v.string()), // group label e.g. "Plot A"
    count: v.optional(v.number()),    // aggregate count e.g. 200
    emoji: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("sold"),
      v.literal("deceased"),
      v.literal("harvested")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_farmer_category", ["farmerId", "category"]),

  // ─────────────────────────────────────────────────────────────────
  // 🗓️ FARM PLANNER — season plans and tasks
  // ─────────────────────────────────────────────────────────────────

  /**
   * Farm Season Plans
   * - Full-season arc from planting to harvest
   * - Optionally linked to a cost template for milestone auto-generation
   */
  farmSeasonPlans: defineTable({
    farmerId: v.id("users"),
    planName: v.string(),
    category: v.union(v.literal("crop"), v.literal("livestock")),
    cropOrLivestockType: v.string(),
    emoji: v.optional(v.string()),
    startDate: v.number(),           // timestamp
    expectedHarvestDate: v.number(), // timestamp
    acresCovered: v.optional(v.number()),
    linkedCostTemplateId: v.optional(v.id("cropCostTemplates")),
    linkedLivestockCostTemplateId: v.optional(v.id("livestockCostTemplates")),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_farmer_status", ["farmerId", "status"]),

  /**
   * Farm Planner Tasks
   * - Individual scheduled tasks, optionally under a season plan
   * - recurrence enables recurring task auto-generation on completion
   */
  farmPlannerTasks: defineTable({
    farmerId: v.id("users"),
    seasonPlanId: v.optional(v.id("farmSeasonPlans")),
    taskName: v.string(),
    emoji: v.optional(v.string()),
    category: v.union(v.literal("crop"), v.literal("livestock"), v.literal("general")),
    dueDate: v.number(),             // timestamp
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("upcoming"),
      v.literal("done"),
      v.literal("overdue"),
      v.literal("skipped")
    ),
    recurrence: v.union(
      v.literal("none"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    linkedUnitId: v.optional(v.id("farmTrackedUnits")),
    notes: v.optional(v.string()),
    isAutoGenerated: v.optional(v.boolean()), // true if created by recurrence or season plan
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_farmer_status", ["farmerId", "status"])
    .index("by_season_plan", ["seasonPlanId"]),

  // ─────────────────────────────────────────────────────────────────
  // 💰 COST CALCULATOR — crop and livestock cost templates
  // ─────────────────────────────────────────────────────────────────

  /**
   * Crop Cost Templates
   * - ownerType "system" = SuperAdmin (all farmers see)
   * - ownerType "community" = Community Admin
   * - ownerType "personal" = Farmer override
   * - stages drive the season planner milestone auto-generation
   */
  cropCostTemplates: defineTable({
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    cropType: v.string(),            // e.g. "maize", "beans"
    emoji: v.optional(v.string()),
    acreSize: v.number(),            // template is costed per this many acres
    currency: v.optional(v.string()), // default "UGX"
    stages: v.array(v.object({
      stageName: v.string(),
      emoji: v.optional(v.string()),
      weekFromStart: v.number(),     // week offset from planting date
      isHarvestStage: v.optional(v.boolean()),
      costItems: v.array(v.object({
        item: v.string(),
        unitCost: v.number(),        // UGX per unit
        quantity: v.number(),
        unit: v.optional(v.string()), // e.g. "bags", "litres", "labour days"
      })),
    })),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_type", ["ownerType"])
    .index("by_community", ["communityId"]),

  /**
   * Livestock Cost Templates
   * - Mirrors cropCostTemplates but for livestock
   * - Stages: Acquisition, Feed, Veterinary, Treatment, Sale/Slaughter
   */
  livestockCostTemplates: defineTable({
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    livestockType: v.string(),       // e.g. "cattle", "broilers", "pigs"
    emoji: v.optional(v.string()),
    acreSize: v.optional(v.number()), // head count or pen size baseline
    currency: v.optional(v.string()),
    stages: v.array(v.object({
      stageName: v.string(),
      emoji: v.optional(v.string()),
      weekFromStart: v.number(),
      isSaleStage: v.optional(v.boolean()),
      costItems: v.array(v.object({
        item: v.string(),
        unitCost: v.number(),
        quantity: v.number(),
        unit: v.optional(v.string()),
      })),
    })),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_type", ["ownerType"])
    .index("by_community", ["communityId"]),

  // ─────────────────────────────────────────────────────────────────
  // 📦 FARM SUPPLY ENTRIES — input purchases & usage tracking
  // ─────────────────────────────────────────────────────────────────

  farmSupplyEntries: defineTable({
    farmerId: v.id("users"),
    item: v.string(),                 // e.g. "NPK Fertiliser 50kg bag"
    category: v.union(
      v.literal("seed"),
      v.literal("fertiliser"),
      v.literal("chemical"),
      v.literal("pesticide"),
      v.literal("vet_input"),
      v.literal("animal_feed"),
      v.literal("equipment"),
      v.literal("labour"),
      v.literal("other")
    ),
    quantity: v.number(),
    unit: v.string(),                 // e.g. "bags", "litres", "days"
    unitCost: v.number(),             // UGX per unit
    totalCost: v.number(),            // quantity * unitCost
    purchasedAt: v.number(),          // timestamp
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
    linkedSeasonPlanId: v.optional(v.id("farmSeasonPlans")),
    linkedUnitId: v.optional(v.id("farmTrackedUnits")),
    createdAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_farmer_category", ["farmerId", "category"]),

  // ─────────────────────────────────────────────────────────────────
  // 🏦 FARM FINANCIAL ENTRIES — income & expense ledger
  // ─────────────────────────────────────────────────────────────────

  farmFinancialEntries: defineTable({
    farmerId: v.id("users"),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.union(
      v.literal("crop_sale"),
      v.literal("livestock_sale"),
      v.literal("input_cost"),
      v.literal("labour"),
      v.literal("transport"),
      v.literal("equipment"),
      v.literal("other")
    ),
    amount: v.number(),               // UGX
    description: v.string(),
    entryDate: v.number(),            // timestamp
    linkedSeasonPlanId: v.optional(v.id("farmSeasonPlans")),
    linkedUnitId: v.optional(v.id("farmTrackedUnits")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_farmer", ["farmerId"])
    .index("by_farmer_type", ["farmerId", "type"]),

  // ---------------------------------------------------------------
  // Community CRM (additive module, isolated from existing forms)
  // ---------------------------------------------------------------

  crmForms: defineTable({
    communityId: v.id("communities"),
    createdByAdminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    followUpOffsetDays: v.number(),
    openingScriptEnabled: v.optional(v.boolean()),
    openingScriptTemplate: v.optional(v.string()),
    openingScriptVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_admin", ["createdByAdminId"])
    .index("by_community_active", ["communityId", "isActive"]),

  crmFormFields: defineTable({
    crmFormId: v.id("crmForms"),
    fieldType: v.string(),
    label: v.string(),
    required: v.boolean(),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    presetKey: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_form", ["crmFormId"]),

  crmFormResponses: defineTable({
    crmFormId: v.id("crmForms"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
    submittedByUserId: v.id("users"),
    sourceEventType: v.union(
      v.literal("biofarm_purchase"),
      v.literal("manual_entry"),
      v.literal("extension_capture")
    ),
    sourceEventId: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    productName: v.optional(v.string()),
    purchaseQuantity: v.optional(v.string()),
    district: v.optional(v.string()),
    subCounty: v.optional(v.string()),
    autoNextCallAt: v.number(),
    submittedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_form", ["crmFormId"])
    .index("by_community", ["communityId"])
    .index("by_member", ["memberId"])
    .index("by_community_submitted", ["communityId", "submittedAt"]),

  crmFormResponseValues: defineTable({
    crmResponseId: v.id("crmFormResponses"),
    crmFieldId: v.id("crmFormFields"),
    value: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_response", ["crmResponseId"])
    .index("by_field", ["crmFieldId"]),

  crmAgents: defineTable({
    communityId: v.id("communities"),
    agentUserId: v.id("users"),
    createdByCommunityAdminId: v.id("users"),
    displayName: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_agent_user", ["agentUserId"])
    .index("by_community_agent", ["communityId", "agentUserId"]),

  crmLeads: defineTable({
    communityId: v.id("communities"),
    memberId: v.id("users"),
    sourceCrmResponseId: v.id("crmFormResponses"),
    sourceCrmFormId: v.id("crmForms"),
    assignedAgentId: v.optional(v.id("users")),
    queueStatus: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("called"),
      v.literal("overdue"),
      v.literal("closed")
    ),
    nextCallAt: v.number(),
    lastCallAt: v.optional(v.number()),
    lastOutcome: v.optional(
      v.union(
        v.literal("good_result"),
        v.literal("problem"),
        v.literal("wants_more"),
        v.literal("no_answer")
      )
    ),
    latestHealthScore: v.optional(v.number()),
    latestHealthBand: v.optional(
      v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))
    ),
    priority: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community_status_nextcall", ["communityId", "queueStatus", "nextCallAt"])
    .index("by_assigned_nextcall", ["assignedAgentId", "nextCallAt"])
    .index("by_member_community", ["communityId", "memberId"])
    .index("by_source_response", ["sourceCrmResponseId"]),

  crmCallLogs: defineTable({
    leadId: v.id("crmLeads"),
    communityId: v.id("communities"),
    agentId: v.id("users"),
    outcome: v.union(
      v.literal("good_result"),
      v.literal("problem"),
      v.literal("wants_more"),
      v.literal("no_answer")
    ),
    usageStatus: v.optional(v.union(v.literal("yes"), v.literal("partly"), v.literal("no"), v.literal("unknown"))),
    resultRating: v.optional(v.union(v.literal("very_good"), v.literal("good"), v.literal("average"), v.literal("poor"), v.literal("very_poor"))),
    issueType: v.optional(v.union(v.literal("none"), v.literal("application_problem"), v.literal("product_problem"), v.literal("packaging_problem"), v.literal("delivery_problem"), v.literal("technical_advice"), v.literal("other"))),
    repurchaseIntent: v.optional(v.union(v.literal("yes"), v.literal("no"), v.literal("maybe"))),
    notes: v.optional(v.string()),
    callbackDaysOverride: v.optional(v.number()),
    callbackDateOverride: v.optional(v.number()),
    computedNextCallAt: v.optional(v.number()),
    healthScore: v.optional(v.number()),
    healthBand: v.optional(v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))),
    createdAt: v.number(),
  })
    .index("by_lead", ["leadId"])
    .index("by_agent_created", ["agentId", "createdAt"])
    .index("by_community_created", ["communityId", "createdAt"]),

  crmTickets: defineTable({
    leadId: v.id("crmLeads"),
    communityId: v.id("communities"),
    openedByAgentId: v.id("users"),
    assignedAgronomistId: v.optional(v.id("users")),
    title: v.string(),
    details: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community_status", ["communityId", "status"])
    .index("by_lead", ["leadId"]),

  crmSalesOpportunities: defineTable({
    leadId: v.id("crmLeads"),
    communityId: v.id("communities"),
    openedByAgentId: v.id("users"),
    assignedSalesAgentId: v.optional(v.id("users")),
    productName: v.optional(v.string()),
    quantity: v.optional(v.string()),
    expectedPurchaseMonth: v.optional(v.string()),
    probability: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    nextActionAt: v.optional(v.number()),
    stage: v.union(
      v.literal("new"),
      v.literal("follow_up"),
      v.literal("order"),
      v.literal("completed"),
      v.literal("lost")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_community_stage", ["communityId", "stage"])
    .index("by_agent", ["openedByAgentId"])
    .index("by_lead", ["leadId"]),
});
