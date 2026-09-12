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

import { v } from "convex/values";
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
        results.push({ ...c, communityName: (community as any)?.name });
      }
    }
    return results;
  },
});

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

    if (!config.recurrenceOptions.includes(args.recurrence)) {
      throw new Error("Recurrence option not allowed by this community's configuration");
    }
    if (args.unitPrice <= 0 || args.totalQuantity <= 0) {
      throw new Error("Unit price and quantity must be positive");
    }
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
      cashComponent: args.cashComponent,
      inKindComponent: args.inKindComponent,
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
    if (offer.status !== "draft") {
      throw new Error("Only a draft offer can be edited. Cancel and recreate a published offer instead.");
    }
    if (args.description !== undefined && !args.description.trim()) {
      throw new Error("A description of the product is required");
    }
    if (args.photoStorageIds !== undefined && args.photoStorageIds.length === 0) {
      throw new Error("At least one photo of the finished product/offering is required");
    }
    const { offerId, farmerId, ...patch } = args;
    await ctx.db.patch(args.offerId, { ...patch, updatedAt: getUgandaTime() });
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
    const photoUrls = offer.photoStorageIds
      ? (await Promise.all(offer.photoStorageIds.map((id: any) => ctx.storage.getUrl(id)))).filter((u): u is string => !!u)
      : [];
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
      throw new Error(
        `Insufficient wallet balance. Required: ${grandTotal.toFixed(2)} UGX, Available: ${currentBalance.toFixed(2)} UGX. Top up your wallet via Pesapal first.`
      );
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
    if (milestone.gpsRequired && (args.lat == null || args.lng == null)) {
      throw new Error("GPS location is required for this milestone but was not captured");
    }

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
