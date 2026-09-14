/**
 * Advance Purchase Market (MVP)
 *
 * Community Admin configures → Farmer publishes a recurring offer →
 * Buyer discovers/commits/funds → Farmer submits milestone evidence →
 * Community Admin reviews → Payment releases per milestone → Delivery.
 *
 * Reuses existing infrastructure rather than inventing new systems:
 * - Money: walletLedger, exactly like buyers.createBuyerListingPurchase
 *   (capital_lock at funding) and buyers' final-delivery release
 *   (profit_credit), applied per-milestone instead of only at delivery.
 * - UTID: generateUTID, same convention as every other transaction.
 * - Messaging: messages.sendMessage for buyer↔farmer negotiation.
 * - Notifications: direct ctx.db.insert("notifications", {type:"system"}),
 *   same convention used in negotiations.ts/listings.ts/forms.ts.
 * - Community membership: communityMemberships (by_community_user).
 * - Community admin authorization: communityAdminId / assignedCommunityIds,
 *   same pattern as forms.createForm.
 * - Photo/GPS/timestamp: frontend uses GeneralCameraCapture + files.ts
 *   generateUploadUrl; this file just stores the resulting imageMetadata.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { checkPilotMode } from "./pilotMode";
import { Id, Doc } from "./_generated/dataModel";

// ------------------------------------------------------------------
// Shared authorization helpers (local, per project convention — see
// forms.ts createForm / communities.ts isSuperAdmin for the same shape)
// ------------------------------------------------------------------

function isSuperAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return user.adminLevel === "super" || (user.adminLevel === undefined && !user.adminCategory);
}

async function assertCommunityAdmin(
  ctx: { db: any },
  adminId: Id<"users">,
  communityId: Id<"communities">
) {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("Not authorized: admin account required");
  }
  if (isSuperAdmin(admin as any)) return admin;

  const community = await ctx.db.get(communityId);
  if (!community) throw new Error("Community not found");

  const isDirectAdmin = String((community as any).communityAdminId || "") === String(adminId);
  const assigned: string[] = ((admin as any).assignedCommunityIds || []).map((id: any) => String(id));
  const isAssignedAdmin = assigned.includes(String(communityId));

  if (!isDirectAdmin && !isAssignedAdmin) {
    throw new Error("Not authorized to manage the Advanced Markets configuration for this community");
  }
  return admin;
}

async function assertCommunityMember(ctx: { db: any }, userId: Id<"users">, communityId: Id<"communities">) {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.role === "admin" && isSuperAdmin(user as any)) return user;

  const membership = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) => q.eq("communityId", communityId).eq("userId", userId))
    .first();
  if (!membership) {
    throw new Error("You must be a member of this community to do this");
  }
  return user;
}

async function notifyUser(ctx: { db: any }, userId: Id<"users">, title: string, message: string, utid?: string) {
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    title,
    message,
    utid,
    read: false,
    createdAt: getUgandaTime(),
  });
}

// ====================================================================
// COMMUNITY ADMIN — Configuration
// ====================================================================

const customFieldValidator = v.object({
  key: v.string(),
  label: v.string(),
  fieldType: v.string(),
  options: v.optional(v.array(v.string())),
  farmerEditable: v.boolean(),
  required: v.boolean(),
  order: v.number(),
});

const deliveryOptionValidator = v.object({
  key: v.string(),
  label: v.string(),
  feeAmount: v.number(),
  feeUnit: v.string(),
});

const milestoneTemplateValidator = v.object({
  order: v.number(),
  name: v.string(),
  expectedDaysFromPublish: v.optional(v.number()),
  photoRequired: v.boolean(),
  gpsRequired: v.boolean(),
  timestampRequired: v.boolean(),
  releasePercent: v.number(),
});

export const createConfig = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    name: v.string(),
    productCategory: v.string(),
    offerKind: v.union(v.literal("goods"), v.literal("services")),
    goodsCategory: v.optional(v.union(v.literal("crop"), v.literal("livestock"))),
    serviceCategory: v.optional(v.string()),
    instructions: v.optional(v.string()),
    customFields: v.array(customFieldValidator),
    unitOptions: v.optional(v.array(v.string())),
    recurrenceOptions: v.array(v.string()),
    negotiationAllowed: v.boolean(),
    buyerCanProposePrice: v.boolean(),
    advancePercentage: v.optional(v.number()),
    minCommitmentQty: v.optional(v.number()),
    maxCommitmentQty: v.optional(v.number()),
    offerExpiryDays: v.optional(v.number()),
    deliveryOptions: v.optional(v.array(deliveryOptionValidator)),
    insuranceEnabled: v.boolean(),
    insuranceLabel: v.optional(v.string()),
    insuranceAmount: v.optional(v.number()),
    insuranceDescription: v.optional(v.string()),
    milestoneTemplate: v.array(milestoneTemplateValidator),
  },
  handler: async (ctx, args) => {
    await assertCommunityAdmin(ctx, args.adminId, args.communityId);

    if (args.offerKind === "goods" && !args.goodsCategory) {
      throw new Error("Select whether this is a crop or livestock offer");
    }
    if (args.offerKind === "services" && !args.serviceCategory?.trim()) {
      throw new Error("Select or name the farm service this offer is for");
    }
    if (args.milestoneTemplate.length === 0) {
      throw new Error("Define at least one milestone/stage");
    }
    const totalRelease = args.milestoneTemplate.reduce((sum, m) => sum + m.releasePercent, 0);
    if (Math.round(totalRelease) !== 100) {
      throw new Error(`Milestone release percentages must total 100% (currently ${totalRelease}%)`);
    }

    const now = getUgandaTime();
    const configId = await ctx.db.insert("advancePurchaseConfigs", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { _id: configId };
  },
});

export const updateConfig = mutation({
  args: {
    configId: v.id("advancePurchaseConfigs"),
    adminId: v.id("users"),
    name: v.optional(v.string()),
    productCategory: v.optional(v.string()),
    offerKind: v.optional(v.union(v.literal("goods"), v.literal("services"))),
    goodsCategory: v.optional(v.union(v.literal("crop"), v.literal("livestock"))),
    serviceCategory: v.optional(v.string()),
    instructions: v.optional(v.string()),
    customFields: v.optional(v.array(customFieldValidator)),
    unitOptions: v.optional(v.array(v.string())),
    recurrenceOptions: v.optional(v.array(v.string())),
    negotiationAllowed: v.optional(v.boolean()),
    buyerCanProposePrice: v.optional(v.boolean()),
    advancePercentage: v.optional(v.number()),
    minCommitmentQty: v.optional(v.number()),
    maxCommitmentQty: v.optional(v.number()),
    offerExpiryDays: v.optional(v.number()),
    deliveryOptions: v.optional(v.array(deliveryOptionValidator)),
    insuranceEnabled: v.optional(v.boolean()),
    insuranceLabel: v.optional(v.string()),
    insuranceAmount: v.optional(v.number()),
    insuranceDescription: v.optional(v.string()),
    milestoneTemplate: v.optional(v.array(milestoneTemplateValidator)),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Configuration not found");
    await assertCommunityAdmin(ctx, args.adminId, config.communityId);

    if (args.milestoneTemplate) {
      const totalRelease = args.milestoneTemplate.reduce((sum, m) => sum + m.releasePercent, 0);
      if (Math.round(totalRelease) !== 100) {
        throw new Error(`Milestone release percentages must total 100% (currently ${totalRelease}%)`);
      }
    }

    const { configId, adminId, ...patch } = args;
    await ctx.db.patch(args.configId, { ...patch, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const setAllowedFarmers = mutation({
  args: {
    adminId: v.id("users"),
    configId: v.id("advancePurchaseConfigs"),
    farmerIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Configuration not found");
    await assertCommunityAdmin(ctx, args.adminId, config.communityId);

    // Leaving the list empty means "no restriction — everyone allowed" and
    // must stay that way. Otherwise, farmers who already published an
    // offer against this form (whether from before this allow-list
    // feature existed, or from a prior restriction that missed them)
    // must never be silently locked out by this edit — union them in.
    let finalFarmerIds: Id<"users">[] = args.farmerIds;
    if (args.farmerIds.length > 0) {
      const existingOffers = await ctx.db
        .query("advancePurchaseOffers")
        .withIndex("by_config", (q: any) => q.eq("configId", args.configId))
        .collect();
      const merged = new Map<string, Id<"users">>();
      for (const id of args.farmerIds) merged.set(String(id), id);
      for (const offer of existingOffers) merged.set(String(offer.farmerId), offer.farmerId);
      finalFarmerIds = Array.from(merged.values());
    }

    await ctx.db.patch(args.configId, {
      allowedFarmerIds: finalFarmerIds,
      updatedAt: getUgandaTime(),
    });
    return { success: true };
  },
});

/**
 * Farmers (or vendors/stores) who already have at least one offer under
 * this config — used by the community admin's "Verified Members" tab so
 * legacy participants are shown as already-verified rather than looking
 * like they need to be picked again.
 */
export const listFarmersWithOffersForConfig = query({
  args: { configId: v.id("advancePurchaseConfigs") },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("advancePurchaseOffers")
      .withIndex("by_config", (q: any) => q.eq("configId", args.configId))
      .collect();
    const farmerIds = Array.from(new Set(offers.map((o: any) => String(o.farmerId))));
    const farmers = await Promise.all(
      farmerIds.map((id) => ctx.db.get(id as Id<"users">))
    );
    return farmers.filter((f): f is Doc<"users"> => f !== null);
  },
});

export const listConfigsForCommunity = query({
  args: { communityId: v.id("communities"), onlyActive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let configs = await ctx.db
      .query("advancePurchaseConfigs")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();
    if (args.onlyActive) configs = configs.filter((c: any) => c.isActive);
    return configs.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const getConfig = query({
  args: { configId: v.id("advancePurchaseConfigs") },
  handler: async (ctx, args) => ctx.db.get(args.configId),
});

// ====================================================================
// FARMER — Offers
// ====================================================================

const customFieldValueValidator = v.object({ key: v.string(), label: v.string(), value: v.string() });

function computeExpectedDate(daysFromPublish: number | undefined, publishedAt: number): string | undefined {
  if (daysFromPublish == null) return undefined;
  return new Date(publishedAt + daysFromPublish * 24 * 60 * 60 * 1000).toISOString();
}

export const listConfigsAvailableToFarmer = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_user", (q: any) => q.eq("userId", args.farmerId))
      .collect();
    const results: any[] = [];
    for (const m of memberships) {
      const configs = await ctx.db
        .query("advancePurchaseConfigs")
        .withIndex("by_community_active", (q: any) => q.eq("communityId", m.communityId).eq("isActive", true))
        .collect();
      const community = await ctx.db.get(m.communityId);
      for (const c of configs) {
        if (c.allowedFarmerIds && c.allowedFarmerIds.length > 0) {
          const allowed = c.allowedFarmerIds.some((id: any) => String(id) === String(args.farmerId));
          if (!allowed) continue;
        }
        results.push({ ...c, communityName: (community as any)?.name });
      }
    }
    return results;
  },
});

/**
 * Split an offer's total value into cash and in-kind amounts.
 *
 * Farmers set the split as a ratio out of 100 (e.g. 50:50). The absolute
 * amounts are derived here so that buyers, commitments and milestone releases
 * keep working in UGX without knowing about percentages, and so the split stays
 * correct when the unit price or quantity later changes.
 */
function splitByCashPercent(
  cashPercent: number,
  unitPrice: number,
  totalQuantity: number,
): { cashComponent: number; inKindComponent: number } {
  const total = unitPrice * totalQuantity;
  const cashComponent = Math.round(total * (cashPercent / 100));
  return { cashComponent, inKindComponent: Math.round(total) - cashComponent };
}

function assertValidCashPercent(cashPercent: number) {
  if (!Number.isFinite(cashPercent) || cashPercent < 0 || cashPercent > 100) {
    throw new Error("The cash share must be a percentage between 0 and 100");
  }
}

export const createOffer = mutation({
  args: {
    farmerId: v.id("users"),
    configId: v.id("advancePurchaseConfigs"),
    productName: v.string(),
    variety: v.optional(v.string()),
    description: v.string(),
    photoStorageIds: v.array(v.id("_storage")),
    unit: v.string(),
    unitPrice: v.number(),
    totalQuantity: v.number(),
    minOrderQty: v.optional(v.number()),
    maxOrderQty: v.optional(v.number()),
    productionLocation: v.optional(v.string()),
    deliveryLocation: v.optional(v.string()),
    expectedDeliveryDate: v.optional(v.string()),
    deliveryWindowDays: v.optional(v.number()),
    cashPercent: v.optional(v.number()),
    cashComponent: v.optional(v.number()),
    inKindComponent: v.optional(v.number()),
    inKindInputs: v.optional(v.array(v.string())),
    recurrence: v.string(),
    customFieldValues: v.array(customFieldValueValidator),
    publish: v.boolean(), // true = publish immediately, false = save as draft
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || !["farmer", "vendor", "store"].includes(farmer.role)) {
      throw new Error("Only farmers can create an Advanced Markets offer");
    }
    const config = await ctx.db.get(args.configId);
    if (!config || !config.isActive) {
      throw new Error("This Advanced Markets configuration is not available");
    }
    await assertCommunityMember(ctx, args.farmerId, config.communityId);

    if (config.allowedFarmerIds && config.allowedFarmerIds.length > 0) {
      const allowed = config.allowedFarmerIds.some((id: any) => String(id) === String(args.farmerId));
      if (!allowed) {
        throw new Error("You are not a verified member for this Advance Market form. Contact your community admin.");
      }
    }

    if (!config.recurrenceOptions.includes(args.recurrence)) {
      throw new Error("Recurrence option not allowed by this community's configuration");
    }
    if (args.unitPrice <= 0 || args.totalQuantity <= 0) {
      throw new Error("Unit price and quantity must be positive");
    }
    if (args.cashPercent !== undefined) assertValidCashPercent(args.cashPercent);
    if (!args.description.trim()) {
      throw new Error("A description of the product is required");
    }
    if (args.photoStorageIds.length === 0) {
      throw new Error("At least one photo of the finished product/offering is required");
    }

    for (const field of config.customFields) {
      if (field.required && !field.farmerEditable) continue; // admin fixed it — assumed present via default
      if (field.required) {
        const provided = args.customFieldValues.find((v) => v.key === field.key);
        if (!provided || !provided.value.trim()) {
          throw new Error(`"${field.label}" is required`);
        }
      }
    }

    const now = getUgandaTime();
    const utid = generateUTID(farmer.role);
    const status = args.publish ? "published" : "draft";
    const expiresAt = args.publish && config.offerExpiryDays
      ? now + config.offerExpiryDays * 24 * 60 * 60 * 1000
      : undefined;

    const offerId = await ctx.db.insert("advancePurchaseOffers", {
      communityId: config.communityId,
      configId: config._id,
      farmerId: args.farmerId,
      utid,
      productName: args.productName,
      variety: args.variety,
      description: args.description,
      photoStorageIds: args.photoStorageIds,
      unit: args.unit,
      unitPrice: args.unitPrice,
      totalQuantity: args.totalQuantity,
      quantityCommitted: 0,
      minOrderQty: args.minOrderQty,
      maxOrderQty: args.maxOrderQty,
      productionLocation: args.productionLocation,
      deliveryLocation: args.deliveryLocation,
      expectedDeliveryDate: args.expectedDeliveryDate,
      deliveryWindowDays: args.deliveryWindowDays,
      cashPercent: args.cashPercent,
      ...(args.cashPercent !== undefined
        ? splitByCashPercent(args.cashPercent, args.unitPrice, args.totalQuantity)
        : {
            cashComponent: args.cashComponent,
            inKindComponent: args.inKindComponent,
          }),
      inKindInputs: args.inKindInputs,
      recurrence: args.recurrence,
      offerKind: config.offerKind,
      goodsCategory: config.goodsCategory,
      serviceCategory: config.serviceCategory,
      negotiationAllowed: config.negotiationAllowed,
      buyerCanProposePrice: config.buyerCanProposePrice,
      advancePercentage: config.advancePercentage,
      deliveryOptions: config.deliveryOptions,
      insuranceEnabled: config.insuranceEnabled,
      insuranceLabel: config.insuranceLabel,
      insuranceAmount: config.insuranceAmount,
      insuranceDescription: config.insuranceDescription,
      customFieldValues: args.customFieldValues,
      status,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // Materialize milestones from the config's template (snapshot, so later
    // config edits never retroactively change an in-progress offer).
    for (const stage of config.milestoneTemplate) {
      await ctx.db.insert("advancePurchaseMilestones", {
        offerId,
        order: stage.order,
        name: stage.name,
        expectedDate: computeExpectedDate(stage.expectedDaysFromPublish, now),
        photoRequired: stage.photoRequired,
        gpsRequired: stage.gpsRequired,
        timestampRequired: stage.timestampRequired,
        releasePercent: stage.releasePercent,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    return { _id: offerId, utid };
  },
});

export const updateOffer = mutation({
  args: {
    offerId: v.id("advancePurchaseOffers"),
    farmerId: v.id("users"),
    productName: v.optional(v.string()),
    variety: v.optional(v.string()),
    description: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    unitPrice: v.optional(v.number()),
    totalQuantity: v.optional(v.number()),
    productionLocation: v.optional(v.string()),
    deliveryLocation: v.optional(v.string()),
    expectedDeliveryDate: v.optional(v.string()),
    deliveryWindowDays: v.optional(v.number()),
    cashPercent: v.optional(v.number()),
    cashComponent: v.optional(v.number()),
    inKindComponent: v.optional(v.number()),
    inKindInputs: v.optional(v.array(v.string())),
    customFieldValues: v.optional(v.array(customFieldValueValidator)),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only edit your own offer");
    }
    if (["cancelled", "fulfilled"].includes(offer.status)) {
      throw new Error("This offer can no longer be edited");
    }
    if (args.description !== undefined && !args.description.trim()) {
      throw new Error("A description of the product is required");
    }
    if (args.photoStorageIds !== undefined && args.photoStorageIds.length === 0) {
      throw new Error("At least one photo of the finished product/offering is required");
    }
    if (args.unitPrice !== undefined && args.unitPrice <= 0) {
      throw new Error("Unit price must be positive");
    }
    if (args.totalQuantity !== undefined) {
      if (args.totalQuantity <= 0) {
        throw new Error("Total quantity must be positive");
      }
      if (args.totalQuantity < offer.quantityCommitted) {
        throw new Error(
          `Total quantity cannot be reduced below what buyers have already committed (${offer.quantityCommitted} ${offer.unit})`
        );
      }
    }
    const { offerId, farmerId, ...patch } = args;

    // Keep the derived amounts consistent with the ratio. This has to rerun
    // whenever the ratio, the unit price or the quantity changes, otherwise the
    // stored split would silently stop matching the percentage the farmer set.
    const effectiveCashPercent =
      args.cashPercent !== undefined ? args.cashPercent : (offer as any).cashPercent;
    if (effectiveCashPercent !== undefined && effectiveCashPercent !== null) {
      assertValidCashPercent(effectiveCashPercent);
      const unitPrice = args.unitPrice !== undefined ? args.unitPrice : offer.unitPrice;
      const totalQuantity =
        args.totalQuantity !== undefined ? args.totalQuantity : offer.totalQuantity;
      Object.assign(
        patch,
        splitByCashPercent(effectiveCashPercent, unitPrice, totalQuantity),
      );
    }

    await ctx.db.patch(args.offerId, { ...patch, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

/**
 * Permanently remove an offer that no buyer has committed to.
 *
 * cancelOffer only flips the status, which leaves abandoned drafts and
 * mistakes cluttering the farmer's list forever. Deleting is only safe while
 * quantityCommitted is 0 — once money is locked against an offer the
 * commitment and its milestone history must survive.
 */
export const deleteOffer = mutation({
  args: { offerId: v.id("advancePurchaseOffers"), farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only delete your own offer");
    }
    if (offer.quantityCommitted > 0) {
      throw new Error(
        "This offer has buyer commitments and cannot be deleted. Contact your community admin.",
      );
    }

    // Defend against a commitment that exists without quantityCommitted having
    // been updated: the counter must never be the only thing standing between a
    // buyer's locked funds and a delete.
    const commitments = await ctx.db
      .query("advancePurchaseCommitments")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    if (commitments.length > 0) {
      throw new Error(
        "This offer has buyer commitments and cannot be deleted. Contact your community admin.",
      );
    }

    // Milestones and proposals are meaningless without the offer.
    const milestones = await ctx.db
      .query("advancePurchaseMilestones")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    for (const m of milestones) {
      const evidence = await ctx.db
        .query("advancePurchaseEvidence")
        .withIndex("by_milestone", (q: any) => q.eq("milestoneId", m._id))
        .collect();
      for (const e of evidence) await ctx.db.delete(e._id);
      await ctx.db.delete(m._id);
    }

    const proposals = await ctx.db
      .query("advancePurchaseProposals")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    for (const pr of proposals) await ctx.db.delete(pr._id);

    await ctx.db.delete(args.offerId);
    return { success: true };
  },
});

export const addOfferPhotos = mutation({
  args: {
    offerId: v.id("advancePurchaseOffers"),
    farmerId: v.id("users"),
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only add photos to your own offer");
    }
    if (["cancelled", "fulfilled"].includes(offer.status)) {
      throw new Error("This offer can no longer be updated");
    }
    if (args.storageIds.length === 0) {
      throw new Error("Select at least one photo to add");
    }
    const existing = offer.photoStorageIds || [];
    await ctx.db.patch(args.offerId, {
      photoStorageIds: [...existing, ...args.storageIds],
      updatedAt: getUgandaTime(),
    });
    return { success: true };
  },
});

export const removeOfferPhotos = mutation({
  args: {
    offerId: v.id("advancePurchaseOffers"),
    farmerId: v.id("users"),
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only edit your own offer's photos");
    }
    if (["cancelled", "fulfilled"].includes(offer.status)) {
      throw new Error("This offer can no longer be updated");
    }
    if (args.storageIds.length === 0) {
      throw new Error("Select at least one photo to remove");
    }
    const existing = offer.photoStorageIds || [];
    const removeSet = new Set(args.storageIds.map((id) => String(id)));
    const remaining = existing.filter((id: any) => !removeSet.has(String(id)));
    if (remaining.length === 0) {
      throw new Error("At least one product photo must remain");
    }
    await ctx.db.patch(args.offerId, {
      photoStorageIds: remaining,
      updatedAt: getUgandaTime(),
    });
    for (const id of args.storageIds) {
      await ctx.storage.delete(id).catch(() => {});
    }
    return { success: true };
  },
});

export const reorderOfferPhotos = mutation({
  args: {
    offerId: v.id("advancePurchaseOffers"),
    farmerId: v.id("users"),
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only reorder your own offer's photos");
    }
    if (["cancelled", "fulfilled"].includes(offer.status)) {
      throw new Error("This offer can no longer be updated");
    }
    const existing = (offer.photoStorageIds || []).map((id: any) => String(id));
    const incoming = args.storageIds.map((id) => String(id));
    const sameSet = existing.length === incoming.length && existing.every((id: string) => incoming.includes(id));
    if (!sameSet) {
      throw new Error("Photo order must include exactly the offer's current photos");
    }
    await ctx.db.patch(args.offerId, {
      photoStorageIds: args.storageIds,
      updatedAt: getUgandaTime(),
    });
    return { success: true };
  },
});

export const publishOffer = mutation({
  args: { offerId: v.id("advancePurchaseOffers"), farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only publish your own offer");
    }
    if (offer.status !== "draft") throw new Error("Offer is not a draft");
    if (!offer.description || !offer.description.trim()) {
      throw new Error("Add a product description before publishing");
    }
    if (!offer.photoStorageIds || offer.photoStorageIds.length === 0) {
      throw new Error("Add at least one product photo before publishing");
    }
    const config = await ctx.db.get(offer.configId);
    const now = getUgandaTime();
    const expiresAt = config?.offerExpiryDays ? now + config.offerExpiryDays * 24 * 60 * 60 * 1000 : undefined;
    await ctx.db.patch(args.offerId, { status: "published", expiresAt, updatedAt: now });
    return { success: true };
  },
});

export const cancelOffer = mutation({
  args: { offerId: v.id("advancePurchaseOffers"), farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    if (String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only cancel your own offer");
    }
    if (offer.quantityCommitted > 0) {
      throw new Error("This offer already has buyer commitments and cannot be cancelled directly. Contact support.");
    }
    await ctx.db.patch(args.offerId, { status: "cancelled", updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const listMyOffers = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("advancePurchaseOffers")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .collect();
    const enriched = await Promise.all(
      offers.map(async (o: any) => ({
        ...o,
        photoUrls: o.photoStorageIds
          ? (await Promise.all(o.photoStorageIds.map((id: any) => ctx.storage.getUrl(id)))).filter((u): u is string => !!u)
          : [],
      }))
    );
    return enriched.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

// ====================================================================
// BUYER — Marketplace + Commitments + Proposals
// ====================================================================

export const listMarketOffers = query({
  args: { communityId: v.optional(v.id("communities")) },
  handler: async (ctx, args) => {
    let offers = args.communityId
      ? await ctx.db
          .query("advancePurchaseOffers")
          .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
          .collect()
      : await ctx.db
          .query("advancePurchaseOffers")
          .withIndex("by_status", (q: any) => q.eq("status", "published"))
          .collect();

    offers = offers.filter((o: any) => o.status === "published" && o.quantityCommitted < o.totalQuantity);

    const enriched = await Promise.all(
      offers.map(async (o: any) => {
        const farmer = await ctx.db.get(o.farmerId);
        const community = await ctx.db.get(o.communityId);
        const currentStage = await ctx.db
          .query("advancePurchaseMilestones")
          .withIndex("by_offer", (q: any) => q.eq("offerId", o._id))
          .collect();
        const approvedCount = currentStage.filter((m: any) => m.status === "approved").length;
        const photoUrls = o.photoStorageIds
          ? (await Promise.all(o.photoStorageIds.map((id: any) => ctx.storage.getUrl(id)))).filter((u): u is string => !!u)
          : [];
        return {
          ...o,
          farmerAlias: (farmer as any)?.alias,
          communityName: (community as any)?.name,
          quantityRemaining: o.totalQuantity - o.quantityCommitted,
          totalValue: o.unitPrice * o.totalQuantity,
          stageProgress: `${approvedCount} of ${currentStage.length}`,
          photoUrls,
        };
      })
    );

    return enriched.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const getOfferDetail = query({
  args: { offerId: v.id("advancePurchaseOffers") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) return null;
    const farmer = await ctx.db.get(offer.farmerId);
    const community = await ctx.db.get(offer.communityId);
    const milestones = await ctx.db
      .query("advancePurchaseMilestones")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    milestones.sort((a: any, b: any) => a.order - b.order);
    const commitments = await ctx.db
      .query("advancePurchaseCommitments")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    const photos = offer.photoStorageIds
      ? (await Promise.all(
          offer.photoStorageIds.map(async (id: any) => {
            const url = await ctx.storage.getUrl(id);
            return url ? { storageId: id, url } : null;
          })
        )).filter((p): p is { storageId: any; url: string } => p !== null)
      : [];
    const photoUrls = photos.map((p) => p.url);
    const milestonesWithProof = await Promise.all(
      milestones.map(async (m: any) => {
        const proofPictures = await ctx.db
          .query("advancePurchaseEvidence")
          .withIndex("by_milestone", (q: any) => q.eq("milestoneId", m._id))
          .collect();
        proofPictures.sort((a: any, b: any) => b.submittedAt - a.submittedAt);
        return { ...m, proofPictures };
      })
    );

    return {
      ...offer,
      farmerAlias: (farmer as any)?.alias,
      communityName: (community as any)?.name,
      quantityRemaining: offer.totalQuantity - offer.quantityCommitted,
      totalValue: offer.unitPrice * offer.totalQuantity,
      milestones: milestonesWithProof.sort((a: any, b: any) => a.order - b.order),
      commitmentCount: commitments.length,
      photoUrls,
      photos,
    };
  },
});

export const createProposal = mutation({
  args: {
    buyerId: v.id("users"),
    offerId: v.id("advancePurchaseOffers"),
    proposedUnitPrice: v.optional(v.number()),
    proposedQuantity: v.optional(v.number()),
    proposedCashComponent: v.optional(v.number()),
    proposedInKindComponent: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer") throw new Error("Only buyers can propose terms");
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.status !== "published") throw new Error("Offer is not available");
    if (!offer.negotiationAllowed) {
      throw new Error("Negotiation is not enabled for this offer");
    }
    if (args.proposedUnitPrice != null && !offer.buyerCanProposePrice) {
      throw new Error("This offer does not allow proposing a different price");
    }

    const now = getUgandaTime();
    const utid = generateUTID(buyer.role);
    const proposalId = await ctx.db.insert("advancePurchaseProposals", {
      offerId: args.offerId,
      buyerId: args.buyerId,
      utid,
      proposedUnitPrice: args.proposedUnitPrice,
      proposedQuantity: args.proposedQuantity,
      proposedCashComponent: args.proposedCashComponent,
      proposedInKindComponent: args.proposedInKindComponent,
      message: args.message,
      status: "pending",
      createdAt: now,
    });

    await notifyUser(
      ctx,
      offer.farmerId,
      "New Advanced Markets proposal",
      `A buyer proposed new terms for your "${offer.productName}" offer.`,
      offer.utid
    );

    return { _id: proposalId, utid };
  },
});

export const respondToProposal = mutation({
  args: {
    farmerId: v.id("users"),
    proposalId: v.id("advancePurchaseProposals"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    const offer = await ctx.db.get(proposal.offerId);
    if (!offer || String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only respond to proposals on your own offer");
    }
    if (proposal.status !== "pending") throw new Error("Proposal already resolved");

    await ctx.db.patch(args.proposalId, {
      status: args.accept ? "accepted" : "rejected",
      respondedAt: getUgandaTime(),
    });

    await notifyUser(
      ctx,
      proposal.buyerId,
      args.accept ? "Your proposal was accepted" : "Your proposal was rejected",
      args.accept
        ? `The farmer accepted your proposed terms for "${offer.productName}". You can now fund it on Advanced Markets.`
        : `The farmer rejected your proposed terms for "${offer.productName}".`,
      offer.utid
    );

    return { success: true };
  },
});

export const createCommitment = mutation({
  args: {
    buyerId: v.id("users"),
    offerId: v.id("advancePurchaseOffers"),
    quantity: v.number(),
    proposalId: v.optional(v.id("advancePurchaseProposals")), // if funding an accepted negotiated proposal
    deliveryOptionKey: v.optional(v.string()),
    insuranceOpted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer") throw new Error("Only buyers can fund an Advanced Markets offer");
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.status !== "published") throw new Error("Offer is not available");
    if (offer.expiresAt && getUgandaTime() > offer.expiresAt) {
      throw new Error("This offer has expired");
    }

    const remaining = offer.totalQuantity - offer.quantityCommitted;
    if (args.quantity <= 0 || args.quantity > remaining) {
      throw new Error(`Requested quantity (${args.quantity}) exceeds what's remaining (${remaining})`);
    }
    const config = await ctx.db.get(offer.configId);
    if (config?.minCommitmentQty && args.quantity < config.minCommitmentQty) {
      throw new Error(`Minimum commitment is ${config.minCommitmentQty} ${offer.unit}`);
    }
    if (config?.maxCommitmentQty && args.quantity > config.maxCommitmentQty) {
      throw new Error(`Maximum commitment is ${config.maxCommitmentQty} ${offer.unit}`);
    }

    let unitPrice = offer.unitPrice;
    let cashComponent = offer.cashComponent;
    let inKindComponent = offer.inKindComponent;

    if (args.proposalId) {
      const proposal = await ctx.db.get(args.proposalId);
      if (!proposal || String(proposal.buyerId) !== String(args.buyerId) || proposal.status !== "accepted") {
        throw new Error("Proposal is not an accepted proposal belonging to you");
      }
      if (proposal.proposedUnitPrice != null) unitPrice = proposal.proposedUnitPrice;
      if (proposal.proposedCashComponent != null) cashComponent = proposal.proposedCashComponent;
      if (proposal.proposedInKindComponent != null) inKindComponent = proposal.proposedInKindComponent;
    }

    const share = args.quantity / offer.totalQuantity;
    const totalAmount = unitPrice * args.quantity;
    const cashAmount = cashComponent != null ? cashComponent * share : totalAmount;
    const inKindAmount = inKindComponent != null ? inKindComponent * share : 0;

    let deliveryFeeAmount: number | undefined;
    if (args.deliveryOptionKey && offer.deliveryOptions) {
      const opt = offer.deliveryOptions.find((d: any) => d.key === args.deliveryOptionKey);
      if (!opt) throw new Error("Invalid delivery option");
      deliveryFeeAmount = opt.feeAmount;
    }
    let insuranceAmount: number | undefined;
    if (args.insuranceOpted) {
      if (!offer.insuranceEnabled) throw new Error("Insurance is not available for this offer");
      insuranceAmount = offer.insuranceAmount;
    }

    const grandTotal = totalAmount + (deliveryFeeAmount || 0) + (insuranceAmount || 0);

    // Fund from the buyer's existing wallet balance — identical pattern to
    // buyers.createBuyerListingPurchase's capital_lock debit.
    const currentEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.buyerId))
      .order("desc")
      .first();
    const currentBalance = currentEntry?.balanceAfter || 0;
    if (currentBalance < grandTotal) {
      // ConvexError (not Error) so the shortfall survives production error
      // redaction: the buyer's offer page reads it and sends them straight to
      // the wallet top-up instead of showing a dead end.
      throw new ConvexError({
        code: "INSUFFICIENT_WALLET_BALANCE",
        message:
          `Insufficient wallet balance. Required: UGX ${Math.round(grandTotal).toLocaleString()}, ` +
          `available: UGX ${Math.round(currentBalance).toLocaleString()}. Top up your wallet first.`,
        required: grandTotal,
        available: currentBalance,
        shortfall: grandTotal - currentBalance,
      });
    }

    const now = getUgandaTime();
    const utid = generateUTID(buyer.role);
    const balanceAfter = currentBalance - grandTotal;

    await ctx.db.insert("walletLedger", {
      userId: args.buyerId,
      utid,
      type: "capital_lock",
      amount: grandTotal,
      balanceAfter,
      timestamp: now,
      metadata: {
        type: "advance_purchase_commitment",
        offerId: args.offerId,
        offerUtid: offer.utid,
        quantity: args.quantity,
        unitPrice,
        totalAmount,
        deliveryFeeAmount,
        insuranceAmount,
      },
    });

    const commitmentId = await ctx.db.insert("advancePurchaseCommitments", {
      offerId: args.offerId,
      buyerId: args.buyerId,
      utid,
      quantity: args.quantity,
      unitPriceAtCommit: unitPrice,
      cashAmount,
      inKindAmount,
      totalAmount: grandTotal,
      deliveryOptionKey: args.deliveryOptionKey,
      deliveryFeeAmount,
      insuranceOpted: args.insuranceOpted,
      insuranceAmount,
      status: "funded",
      walletUtid: utid,
      releasedAmount: 0,
      quantityDelivered: 0,
      fundedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.offerId, {
      quantityCommitted: offer.quantityCommitted + args.quantity,
      updatedAt: now,
    });

    await notifyUser(
      ctx,
      offer.farmerId,
      "Advanced Markets order funded",
      `A buyer funded ${args.quantity} ${offer.unit} of your "${offer.productName}" offer.`,
      utid
    );

    return { _id: commitmentId, utid };
  },
});

// --------------------------------------------------------------------
// BUYER — Exiting a commitment
//
// Two doors out, differing only in how much is still refundable:
//   cancelCommitment  — nothing has been released to the farmer yet, so the
//                       whole committed amount (produce, delivery fee and
//                       insurance) goes back to the buyer's wallet.
//   forfeitCommitment — production has started. Milestone money already
//                       released to the farmer stays with the farmer; only
//                       the unreleased balance returns to the buyer.
//
// Both free the quantity back onto the offer so another buyer can take it,
// and both refund with a capital_unlock ledger entry — the same reversal of
// a capital_lock that the trader-expiry path in scheduled.ts uses.
// --------------------------------------------------------------------

async function refundCommitmentToBuyer(
  ctx: { db: any },
  commitment: Doc<"advancePurchaseCommitments">,
  offer: Doc<"advancePurchaseOffers">,
  reason: "buyer_cancelled" | "buyer_forfeited"
) {
  const now = getUgandaTime();
  const refundAmount = Math.max(0, commitment.totalAmount - commitment.releasedAmount);
  const refundUtid = generateUTID("buyer");

  if (refundAmount > 0) {
    const latestEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", commitment.buyerId))
      .order("desc")
      .first();
    const balanceAfter = (latestEntry?.balanceAfter || 0) + refundAmount;

    await ctx.db.insert("walletLedger", {
      userId: commitment.buyerId,
      utid: refundUtid,
      type: "capital_unlock",
      amount: refundAmount,
      balanceAfter,
      timestamp: now,
      metadata: {
        type: "advance_purchase_refund",
        reason,
        offerId: offer._id,
        offerUtid: offer.utid,
        productName: offer.productName,
        commitmentId: commitment._id,
        commitmentUtid: commitment.utid,
        reversedLockUtid: commitment.walletUtid,
        totalAmount: commitment.totalAmount,
        // Kept by the farmer for milestones already approved — 0 on a cancel.
        forfeitedToFarmer: commitment.releasedAmount,
      },
    });
  }

  await ctx.db.patch(commitment._id, {
    status: "cancelled" as const,
    updatedAt: now,
  });

  // Release the reserved quantity so the offer can be sold again. Guard
  // against drifting below zero if the counter was ever patched elsewhere.
  await ctx.db.patch(offer._id, {
    quantityCommitted: Math.max(0, offer.quantityCommitted - commitment.quantity),
    updatedAt: now,
  });

  return { refundAmount, refundUtid, forfeitedToFarmer: commitment.releasedAmount };
}

async function loadCommitmentForBuyer(
  ctx: { db: any },
  buyerId: Id<"users">,
  commitmentId: Id<"advancePurchaseCommitments">
) {
  const commitment = await ctx.db.get(commitmentId);
  if (!commitment) throw new Error("Order not found");
  if (String(commitment.buyerId) !== String(buyerId)) {
    throw new Error("You can only change your own Advanced Markets order");
  }
  const offer = await ctx.db.get(commitment.offerId);
  if (!offer) throw new Error("Offer not found");
  if (commitment.status === "cancelled") {
    throw new Error("This order has already been cancelled");
  }
  if (commitment.status === "delivered") {
    throw new Error("This order has already been delivered");
  }
  if (commitment.quantityDelivered > 0) {
    throw new Error(
      "Part of this order has already been delivered to you. Contact your community admin to settle it."
    );
  }
  return { commitment, offer };
}

/**
 * Cancel an order the farmer has not been paid anything for yet.
 * Refuses once any milestone has released money — forfeitCommitment is the
 * only way out from that point, and the error says so.
 */
export const cancelCommitment = mutation({
  args: {
    buyerId: v.id("users"),
    commitmentId: v.id("advancePurchaseCommitments"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const { commitment, offer } = await loadCommitmentForBuyer(ctx, args.buyerId, args.commitmentId);

    if (commitment.releasedAmount > 0 || commitment.status !== "funded") {
      throw new Error(
        "Production has already started on this order, so it can no longer be cancelled for a full refund. " +
          "You can forfeit it instead — the money already released to the farmer stays with them."
      );
    }

    const result = await refundCommitmentToBuyer(ctx, commitment, offer, "buyer_cancelled");

    await notifyUser(
      ctx,
      offer.farmerId,
      "Advanced Markets order cancelled",
      `A buyer cancelled their order of ${commitment.quantity} ${offer.unit} of "${offer.productName}". ` +
        `That quantity is available to other buyers again.`,
      offer.utid
    );

    return { success: true, ...result };
  },
});

/**
 * Walk away from an order that is already in production. The buyer gives up
 * everything approved milestones have paid out to the farmer and takes back
 * the rest.
 */
export const forfeitCommitment = mutation({
  args: {
    buyerId: v.id("users"),
    commitmentId: v.id("advancePurchaseCommitments"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const { commitment, offer } = await loadCommitmentForBuyer(ctx, args.buyerId, args.commitmentId);

    if (!["funded", "in_production", "ready_for_delivery"].includes(commitment.status)) {
      throw new Error("This order cannot be forfeited in its current state");
    }

    const result = await refundCommitmentToBuyer(ctx, commitment, offer, "buyer_forfeited");

    await notifyUser(
      ctx,
      offer.farmerId,
      "Advanced Markets order forfeited",
      `A buyer forfeited their order of ${commitment.quantity} ${offer.unit} of "${offer.productName}". ` +
        `The UGX ${Math.round(result.forfeitedToFarmer).toLocaleString()} already released for approved ` +
        `milestones stays with you, and that quantity is available to other buyers again.`,
      offer.utid
    );

    return { success: true, ...result };
  },
});

export const listMyCommitments = query({
  args: { buyerId: v.id("users") },
  handler: async (ctx, args) => {
    const commitments = await ctx.db
      .query("advancePurchaseCommitments")
      .withIndex("by_buyer", (q: any) => q.eq("buyerId", args.buyerId))
      .collect();
    const enriched = await Promise.all(
      commitments.map(async (c: any) => {
        const offer = await ctx.db.get(c.offerId);
        return { ...c, offer };
      })
    );
    return enriched.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const getCommitmentDetail = query({
  args: { commitmentId: v.id("advancePurchaseCommitments") },
  handler: async (ctx, args) => {
    const commitment = await ctx.db.get(args.commitmentId);
    if (!commitment) return null;
    const offer = await ctx.db.get(commitment.offerId);
    const milestones = offer
      ? await ctx.db
          .query("advancePurchaseMilestones")
          .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
          .collect()
      : [];
    milestones.sort((a: any, b: any) => a.order - b.order);
    const milestonesWithProof = await Promise.all(
      milestones.map(async (m: any) => {
        const proofPictures = await ctx.db
          .query("advancePurchaseEvidence")
          .withIndex("by_milestone", (q: any) => q.eq("milestoneId", m._id))
          .collect();
        proofPictures.sort((a: any, b: any) => b.submittedAt - a.submittedAt);
        return { ...m, proofPictures };
      })
    );
    const photoUrls = offer?.photoStorageIds
      ? (await Promise.all(offer.photoStorageIds.map((id: any) => ctx.storage.getUrl(id)))).filter((u): u is string => !!u)
      : [];
    return {
      ...commitment,
      offer: offer ? { ...offer, photoUrls } : offer,
      milestones: milestonesWithProof,
      pendingAmount: commitment.totalAmount - commitment.releasedAmount,
    };
  },
});

// ====================================================================
// FARMER — Milestone evidence submission
// ====================================================================

export const listMilestones = query({
  args: { offerId: v.id("advancePurchaseOffers") },
  handler: async (ctx, args) => {
    const milestones = await ctx.db
      .query("advancePurchaseMilestones")
      .withIndex("by_offer", (q: any) => q.eq("offerId", args.offerId))
      .collect();
    return milestones.sort((a: any, b: any) => a.order - b.order);
  },
});

export const getMilestoneEvidenceHistory = query({
  args: { milestoneId: v.id("advancePurchaseMilestones") },
  handler: async (ctx, args) => {
    const evidence = await ctx.db
      .query("advancePurchaseEvidence")
      .withIndex("by_milestone", (q: any) => q.eq("milestoneId", args.milestoneId))
      .collect();
    return evidence.sort((a: any, b: any) => b.submittedAt - a.submittedAt);
  },
});

export const submitMilestoneEvidence = mutation({
  args: {
    farmerId: v.id("users"),
    milestoneId: v.id("advancePurchaseMilestones"),
    storageId: v.id("_storage"),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    capturedAt: v.string(),
    verificationSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    const offer = await ctx.db.get(milestone.offerId);
    if (!offer || String(offer.farmerId) !== String(args.farmerId)) {
      throw new Error("You can only submit evidence for your own offer");
    }
    if (!["pending", "resubmission_required"].includes(milestone.status)) {
      throw new Error("This milestone is not awaiting evidence");
    }
    // GPS is captured best-effort when available but never required —
    // farmers can submit proof pictures without location data.

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Uploaded photo could not be found in storage");

    const now = getUgandaTime();
    const evidenceId = await ctx.db.insert("advancePurchaseEvidence", {
      milestoneId: args.milestoneId,
      offerId: milestone.offerId,
      farmerId: args.farmerId,
      storageId: args.storageId,
      url,
      lat: args.lat,
      lng: args.lng,
      accuracy: args.accuracy,
      capturedAt: args.capturedAt,
      verificationSource: args.verificationSource,
      status: "pending_verification",
      submittedAt: now,
    });

    await ctx.db.patch(args.milestoneId, { status: "submitted", updatedAt: now });

    // Notify the community admin(s) responsible for reviewing this evidence.
    const community = await ctx.db.get(offer.communityId);
    if (community?.communityAdminId) {
      await notifyUser(
        ctx,
        community.communityAdminId,
        "Advanced Markets proof picture submitted",
        `A proof picture was submitted for "${milestone.name}" on offer "${offer.productName}".`,
        offer.utid
      );
    }

    return { _id: evidenceId };
  },
});

export const listMyOffersProgress = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("advancePurchaseOffers")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .collect();
    const active = offers.filter((o: any) => o.quantityCommitted > 0);
    return Promise.all(
      active.map(async (offer: any) => {
        const milestones = await ctx.db
          .query("advancePurchaseMilestones")
          .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
          .collect();
        milestones.sort((a: any, b: any) => a.order - b.order);
        const milestonesWithProof = await Promise.all(
          milestones.map(async (m: any) => {
            const proofPictures = await ctx.db
              .query("advancePurchaseEvidence")
              .withIndex("by_milestone", (q: any) => q.eq("milestoneId", m._id))
              .collect();
            proofPictures.sort((a: any, b: any) => b.submittedAt - a.submittedAt);
            return { ...m, proofPictures };
          })
        );
        const commitments = await ctx.db
          .query("advancePurchaseCommitments")
          .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
          .collect();
        const totalFunded = commitments.reduce((s: number, c: any) => s + c.totalAmount, 0);
        const totalReleased = commitments.reduce((s: number, c: any) => s + c.releasedAmount, 0);
        return { offer, milestones: milestonesWithProof, totalFunded, totalReleased, commitmentCount: commitments.length };
      })
    );
  },
});

// ====================================================================
// COMMUNITY ADMIN (reviewer) — Verification + payment release
// ====================================================================

export const listPendingEvidenceForCommunity = query({
  args: { adminId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, args) => {
    await assertCommunityAdmin(ctx, args.adminId, args.communityId);
    const offers = await ctx.db
      .query("advancePurchaseOffers")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();
    const results: any[] = [];
    for (const offer of offers) {
      const evidence = await ctx.db
        .query("advancePurchaseEvidence")
        .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
        .collect();
      const pending = evidence.filter((e: any) => e.status === "pending_verification");
      for (const e of pending) {
        const milestone = await ctx.db.get(e.milestoneId);
        results.push({ ...e, offer, milestone });
      }
    }
    return results.sort((a: any, b: any) => a.submittedAt - b.submittedAt);
  },
});

export const listReviewedProofPicturesForCommunity = query({
  args: { adminId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, args) => {
    await assertCommunityAdmin(ctx, args.adminId, args.communityId);
    const offers = await ctx.db
      .query("advancePurchaseOffers")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();
    const results: any[] = [];
    for (const offer of offers) {
      const evidence = await ctx.db
        .query("advancePurchaseEvidence")
        .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
        .collect();
      const reviewed = evidence.filter((e: any) => e.status !== "pending_verification");
      for (const e of reviewed) {
        const milestone = await ctx.db.get(e.milestoneId);
        results.push({ ...e, offer, milestone });
      }
    }
    return results.sort((a: any, b: any) => (b.reviewedAt || b.submittedAt) - (a.reviewedAt || a.submittedAt));
  },
});

export const reviewMilestoneEvidence = mutation({
  args: {
    reviewerId: v.id("users"),
    evidenceId: v.id("advancePurchaseEvidence"),
    decision: v.union(v.literal("approved"), v.literal("rejected"), v.literal("resubmission_required")),
    reviewNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence) throw new Error("Evidence not found");
    const offer = await ctx.db.get(evidence.offerId);
    if (!offer) throw new Error("Offer not found");
    await assertCommunityAdmin(ctx, args.reviewerId, offer.communityId);

    if (evidence.status !== "pending_verification") {
      throw new Error("This evidence has already been reviewed");
    }

    const now = getUgandaTime();
    await ctx.db.patch(args.evidenceId, {
      status: args.decision,
      reviewerId: args.reviewerId,
      reviewNotes: args.reviewNotes,
      reviewedAt: now,
    });

    const milestone = await ctx.db.get(evidence.milestoneId);
    if (!milestone) throw new Error("Milestone not found");

    if (args.decision === "approved") {
      await ctx.db.patch(milestone._id, { status: "approved", updatedAt: now });

      // Release this stage's percentage of each funded commitment's total
      // to the farmer's wallet — same profit_credit mechanism the existing
      // buyer-purchase delivery-confirmation flow already uses, applied
      // per-milestone instead of only at final delivery.
      const commitments = await ctx.db
        .query("advancePurchaseCommitments")
        .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
        .collect();
      const releasable = commitments.filter((c: any) => ["funded", "in_production"].includes(c.status));

      if (releasable.length > 0) {
        const farmerEntry = await ctx.db
          .query("walletLedger")
          .withIndex("by_user", (q: any) => q.eq("userId", offer.farmerId))
          .order("desc")
          .first();
        let farmerBalance = farmerEntry?.balanceAfter || 0;
        const releaseUtid = generateUTID("farmer");

        const allMilestones = await ctx.db
          .query("advancePurchaseMilestones")
          .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
          .collect();
        const isFinalStage = allMilestones.every(
          (m: any) => m._id === milestone._id || m.status === "approved"
        );

        for (const c of releasable) {
          const releaseAmount = Math.round((c.totalAmount * milestone.releasePercent) / 100);
          farmerBalance += releaseAmount;
          await ctx.db.insert("walletLedger", {
            userId: offer.farmerId,
            utid: releaseUtid,
            type: "profit_credit",
            amount: releaseAmount,
            balanceAfter: farmerBalance,
            timestamp: now,
            metadata: {
              type: "advance_purchase_milestone_release",
              offerId: offer._id,
              offerUtid: offer.utid,
              commitmentId: c._id,
              milestoneId: milestone._id,
              milestoneName: milestone.name,
              releasePercent: milestone.releasePercent,
            },
          });

          await ctx.db.patch(c._id, {
            releasedAmount: c.releasedAmount + releaseAmount,
            status: isFinalStage ? "ready_for_delivery" : "in_production",
            updatedAt: now,
          });

          await notifyUser(
            ctx,
            c.buyerId,
            "Advanced Markets milestone approved",
            `"${milestone.name}" was approved for "${offer.productName}". UGX ${releaseAmount.toLocaleString()} released to the farmer.`,
            offer.utid
          );
        }

        await notifyUser(
          ctx,
          offer.farmerId,
          "Milestone approved — payment released",
          `Your "${milestone.name}" evidence was approved. Payment has been released to your wallet.`,
          offer.utid
        );
      }
    } else {
      await ctx.db.patch(milestone._id, {
        status: args.decision === "rejected" ? "rejected" : "resubmission_required",
        updatedAt: now,
      });
      await notifyUser(
        ctx,
        offer.farmerId,
        args.decision === "rejected" ? "Milestone evidence rejected" : "Resubmission required",
        args.reviewNotes || `Your evidence for "${milestone.name}" needs attention.`,
        offer.utid
      );
    }

    return { success: true };
  },
});

// ====================================================================
// DELIVERY (basic tracking)
// ====================================================================

export const updateDeliveryStatus = mutation({
  args: {
    userId: v.id("users"),
    commitmentId: v.id("advancePurchaseCommitments"),
    quantityDelivered: v.number(),
  },
  handler: async (ctx, args) => {
    const commitment = await ctx.db.get(args.commitmentId);
    if (!commitment) throw new Error("Commitment not found");
    const offer = await ctx.db.get(commitment.offerId);
    if (!offer) throw new Error("Offer not found");

    const isFarmer = String(offer.farmerId) === String(args.userId);
    const isBuyer = String(commitment.buyerId) === String(args.userId);
    if (!isFarmer && !isBuyer) {
      const user = await ctx.db.get(args.userId);
      if (!user || user.role !== "admin") {
        throw new Error("Not authorized to update delivery status for this order");
      }
    }
    if (!["ready_for_delivery", "delivered"].includes(commitment.status)) {
      throw new Error("This order is not yet ready for delivery tracking");
    }
    if (args.quantityDelivered < 0 || args.quantityDelivered > commitment.quantity) {
      throw new Error("Quantity delivered is out of range");
    }

    const now = getUgandaTime();
    const status = args.quantityDelivered >= commitment.quantity ? "delivered" : "ready_for_delivery";
    await ctx.db.patch(args.commitmentId, {
      quantityDelivered: args.quantityDelivered,
      status,
      updatedAt: now,
    });

    if (status === "delivered") {
      const remainingCommitments = await ctx.db
        .query("advancePurchaseCommitments")
        .withIndex("by_offer", (q: any) => q.eq("offerId", offer._id))
        .collect();
      const allDelivered = remainingCommitments.every((c: any) =>
        c._id === commitment._id ? true : c.status === "delivered" || c.status === "cancelled"
      );
      if (allDelivered) {
        await ctx.db.patch(offer._id, { status: "fulfilled", updatedAt: now });
      }
    }

    return { success: true, status };
  },
});
