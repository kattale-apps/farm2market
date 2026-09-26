/**
 * Export Markets - phases 3 and 4: deals and the order pipeline.
 *
 * A deal starts as a buyer enquiry on a catalogue lot (price on request),
 * goes back and forth as quotes and counter-offers, and once accepted runs
 * the pipeline copied from the Incoterm's template (exportPipelineTemplates,
 * or defaultPipelineSteps). Steps run strictly in order.
 *
 * Anonymity: until the platform fees are paid, each side sees only the
 * other's alias (exporter rating and record, buyer country) and messages
 * have contact details masked. Paying the fees completes the "disclosure"
 * step, which reveals company names and contacts to both sides.
 *
 * Money: fees are charged in UGX from wallets (chargeExportFee). The USD
 * contract value and the buyer's USD payment are recorded against the deal
 * only; Pesapal is UGX-only until a USD processor is added. With a Letter
 * of Credit the bank pays the exporter directly, which is why the success
 * fee is collected before names are revealed.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  INCOTERMS,
  PipelineStep,
  computeDealFees,
  defaultPipelineSteps,
  isIsoDate,
  maskContactDetails,
  ugxPerUsd,
  validatePipelineSteps,
} from "./exportMarketsShared";
import {
  adminManagesCommunity,
  audit,
  chargeExportFee,
  documentSlots,
  getDocumentTypes,
  getFeeSettings,
  isActiveExporter,
  isSuperAdmin,
  notify,
  requireAdmin,
  requireSuperAdmin,
  todayUganda,
  walletBalance,
} from "./exportMarkets";
import { exporterPublicStats, uniqueCode } from "./exportLots";

type Ctx = QueryCtx | MutationCtx;
type Role = "buyer" | "exporter" | "admin";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function loadDeal(ctx: Ctx, userId: Id<"users">, dealId: Id<"exportDeals">) {
  const user = await ctx.db.get(userId);
  const deal = await ctx.db.get(dealId);
  if (!user || !deal) throw new Error("Deal not found");
  let role: Role | null = null;
  if (deal.buyerId === user._id) role = "buyer";
  else if (deal.exporterId === user._id) role = "exporter";
  else if (user.role === "admin" && user.state === "active") {
    if (isSuperAdmin(user)) role = "admin";
    else {
      const community = await ctx.db.get(deal.exporterCommunityId);
      if (community && adminManagesCommunity(user, community)) role = "admin";
    }
  }
  if (!role) throw new Error("Deal not found");
  return { user, deal, role };
}

function requireRole(role: Role, ...allowed: Role[]) {
  if (!allowed.includes(role)) throw new Error("You cannot do this on this deal");
}

async function templateSteps(ctx: Ctx, incoterm: string): Promise<PipelineStep[]> {
  const row = await ctx.db.query("exportPipelineTemplates").withIndex("by_incoterm", (q) => q.eq("incoterm", incoterm)).first();
  return row ? row.steps : defaultPipelineSteps(incoterm);
}

async function dealSteps(ctx: Ctx, dealId: Id<"exportDeals">) {
  return await ctx.db.query("exportDealSteps").withIndex("by_dealId_and_order", (q) => q.eq("dealId", dealId)).take(50);
}

async function buyerProfile(ctx: Ctx, buyerId: Id<"users">) {
  return await ctx.db.query("buyerProfiles").withIndex("by_userId", (q) => q.eq("userId", buyerId)).first();
}

async function notifyParties(ctx: MutationCtx, deal: Doc<"exportDeals">, title: string, message: string, except?: Id<"users">) {
  for (const id of [deal.buyerId, deal.exporterId]) {
    if (id !== except) await notify(ctx, id, title, `${message} (${deal.dealCode})`);
  }
}

/** Anything a step needs before it counts as done, beyond accepted documents. */
function stepExtrasMissing(deal: Doc<"exportDeals">, key: string): string | null {
  if (key === "payment_security" && (!deal.paymentMethod || !deal.paymentAmountUsd)) return "Record the payment method and amount";
  if (key === "stuffing" && (!deal.containerNumber || !deal.sealNumber)) return "Record the container and seal numbers";
  if (key === "shipped" && (!deal.vessel || !deal.blNumber || !deal.shippedOn)) return "Record the vessel, bill of lading number and shipping date";
  return null;
}

/**
 * Mark a step done and move to the next one, running any automatic system
 * steps on the way (KYC already approved, identities revealed after fees).
 */
async function completeStep(ctx: MutationCtx, dealId: Id<"exportDeals">, key: string, by: Id<"users">) {
  const now = getUgandaTime();
  let deal = (await ctx.db.get(dealId))!;
  const steps = await dealSteps(ctx, dealId);
  const step = steps.find((s) => s.key === key);
  if (!step || step.status === "done") return;
  if (deal.currentStepKey !== key) throw new Error("This step is not the current one");
  await ctx.db.patch(step._id, { status: "done", completedAt: now, completedBy: by });

  let idx = steps.findIndex((s) => s.key === key) + 1;
  while (idx < steps.length) {
    const next = steps[idx];
    await ctx.db.patch(next._id, { status: "active" });
    await ctx.db.patch(dealId, { currentStepKey: next.key, updatedAt: now });
    deal = (await ctx.db.get(dealId))!;

    // Automatic steps
    if (next.key === "buyer_kyc") {
      const bp = await buyerProfile(ctx, deal.buyerId);
      if (bp?.kycStatus === "approved") {
        await ctx.db.patch(next._id, { status: "done", completedAt: now, completedBy: by });
        idx++;
        continue;
      }
      await notify(ctx, deal.buyerId, "Submit your KYC documents", `Your offer on ${deal.dealCode} was accepted. Upload your company documents so an admin can approve you.`);
    }
    if (next.key === "sample") {
      await ctx.db.patch(dealId, { sample: { status: "awaiting_buyer", round: 1, updatedAt: now } });
      await notify(ctx, deal.buyerId, "Confirm your sample request", `Confirm where the platform should send the sample for ${deal.dealCode}.`);
    }
    if (next.key === "disclosure") {
      await ctx.db.patch(dealId, { disclosedAt: now });
      await ctx.db.patch(next._id, { status: "done", completedAt: now, completedBy: by });
      await notifyParties(ctx, deal, "Company names revealed", "Platform fees are paid. You can now see each other's company details and the traceability report");
      idx++;
      continue;
    }
    return;
  }
  await ctx.db.patch(dealId, { status: "completed", currentStepKey: "completed", updatedAt: now });
}

async function tryCompleteDocumentStep(ctx: MutationCtx, dealId: Id<"exportDeals">, by: Id<"users">) {
  const deal = (await ctx.db.get(dealId))!;
  const steps = await dealSteps(ctx, dealId);
  const step = steps.find((s) => s.key === deal.currentStepKey);
  if (!step || step.kind !== "documents") return;
  const docs = await ctx.db.query("exportDealDocuments").withIndex("by_dealId", (q) => q.eq("dealId", dealId)).take(300);
  const accepted = new Set(docs.filter((d) => d.stepKey === step.key && d.status === "accepted").map((d) => d.label));
  if (!step.requiredDocuments.every((label) => accepted.has(label))) return;
  if (stepExtrasMissing(deal, step.key)) return;
  await completeStep(ctx, dealId, step.key, by);
  const after = (await ctx.db.get(dealId))!;
  await notifyParties(ctx, after, `${step.name} complete`, `${step.name} is complete`);
}

async function releaseReservedBags(ctx: MutationCtx, deal: Doc<"exportDeals">) {
  if (!deal.bagsReserved) return;
  const lot = await ctx.db.get(deal.lotId);
  if (!lot) return;
  const availableBags = Math.min(lot.bags, lot.availableBags + deal.bagsReserved);
  await ctx.db.patch(lot._id, {
    availableBags,
    status: lot.status === "sold_out" && availableBags > 0 ? "listed" : lot.status,
    updatedAt: getUgandaTime(),
  });
  await ctx.db.patch(deal._id, { bagsReserved: 0 });
}

function validPrice(p: number) {
  if (!(p > 0 && p < 100)) throw new Error("Price must be in USD per kg, between 0 and 100");
}

// ------------------------------------------------------------------
// Enquiry, quotes and acceptance
// ------------------------------------------------------------------

export const createEnquiry = mutation({
  args: {
    buyerId: v.id("users"),
    lotId: v.id("exportLots"),
    bags: v.number(),
    incoterm: v.string(),
    destinationPort: v.optional(v.string()),
    shipmentPeriod: v.optional(v.string()),
    targetPriceUsdPerKg: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer" || buyer.state !== "active") throw new Error("Only buyer accounts can make offers");
    const bp = await buyerProfile(ctx, buyer._id);
    if (!bp?.onboardingCompleted) throw new Error("Complete your buyer profile first");
    const lot = await ctx.db.get(args.lotId);
    if (!lot || lot.status !== "listed" || !(await isActiveExporter(ctx, lot.exporterId, todayUganda()))) {
      throw new Error("This lot is no longer available");
    }
    if (!Number.isInteger(args.bags) || args.bags < lot.minOrderBags || args.bags > lot.availableBags) {
      throw new Error(`Order between ${lot.minOrderBags} and ${lot.availableBags} bags`);
    }
    if (!lot.incoterms.includes(args.incoterm)) throw new Error("The exporter does not offer this Incoterm on this lot");
    if (args.targetPriceUsdPerKg !== undefined) validPrice(args.targetPriceUsdPerKg);
    const open = await ctx.db.query("exportDeals").withIndex("by_buyerId", (q) => q.eq("buyerId", buyer._id)).take(500);
    if (open.some((d) => d.lotId === lot._id && ["enquiry", "quoted", "in_progress"].includes(d.status))) {
      throw new Error("You already have an open deal on this lot");
    }

    const now = getUgandaTime();
    const dealCode = await uniqueCode(ctx, "EXD", async (c) => !!(await ctx.db.query("exportDeals").withIndex("by_dealCode", (q) => q.eq("dealCode", c)).first()));
    const dealId = await ctx.db.insert("exportDeals", {
      dealCode,
      lotId: lot._id,
      exporterId: lot.exporterId,
      buyerId: buyer._id,
      exporterCommunityId: lot.communityId,
      status: "enquiry",
      lastOfferBy: "buyer",
      bags: args.bags,
      incoterm: args.incoterm,
      destinationPort: args.destinationPort?.trim() || undefined,
      shipmentPeriod: args.shipmentPeriod?.trim() || undefined,
      buyerTargetPriceUsdPerKg: args.targetPriceUsdPerKg,
      currentStepKey: "offer_accepted",
      createdAt: now,
      updatedAt: now,
    });
    const steps = await templateSteps(ctx, args.incoterm);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await ctx.db.insert("exportDealSteps", {
        dealId,
        order: i,
        key: s.key,
        name: s.name,
        actor: s.actor,
        kind: s.kind,
        system: s.system,
        requiredDocuments: s.requiredDocuments,
        description: s.description,
        status: i === 0 ? "active" : "pending",
      });
    }
    if (args.message?.trim()) {
      const m = maskContactDetails(args.message.trim().slice(0, 2000));
      await ctx.db.insert("exportDealMessages", { dealId, senderId: buyer._id, senderRole: "buyer", body: m.text, masked: m.masked, createdAt: now });
    }
    await notify(ctx, lot.exporterId, "New export enquiry", `A buyer from ${bp.countryName ?? "Uganda"} asked for a price on ${args.bags} bags of lot ${lot.lotCode} (${dealCode}).`);
    return { dealId, dealCode };
  },
});

export const quoteDeal = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), priceUsdPerKg: v.number(), validUntil: v.optional(v.string()), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "exporter");
    if (deal.status !== "enquiry" && deal.status !== "quoted") throw new Error("This deal is past the quoting stage");
    validPrice(args.priceUsdPerKg);
    if (args.validUntil && !isIsoDate(args.validUntil)) throw new Error("Valid-until is not a date");
    await ctx.db.patch(deal._id, {
      status: "quoted",
      lastOfferBy: "exporter",
      quotedPriceUsdPerKg: args.priceUsdPerKg,
      quoteValidUntil: args.validUntil,
      updatedAt: getUgandaTime(),
    });
    if (args.note?.trim()) {
      const m = maskContactDetails(args.note.trim().slice(0, 2000));
      await ctx.db.insert("exportDealMessages", { dealId: deal._id, senderId: args.userId, senderRole: "exporter", body: m.text, masked: m.masked, createdAt: getUgandaTime() });
    }
    await notify(ctx, deal.buyerId, "Price quoted", `The exporter quoted USD ${args.priceUsdPerKg}/kg on ${deal.dealCode}.`);
    return { success: true };
  },
});

export const counterOffer = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), priceUsdPerKg: v.number(), bags: v.optional(v.number()), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer");
    if (deal.status !== "quoted" && deal.status !== "enquiry") throw new Error("This deal is past the offer stage");
    validPrice(args.priceUsdPerKg);
    const lot = await ctx.db.get(deal.lotId);
    let bags = deal.bags;
    if (args.bags !== undefined) {
      if (!lot || !Number.isInteger(args.bags) || args.bags < lot.minOrderBags || args.bags > lot.availableBags) {
        throw new Error("That number of bags is not available");
      }
      bags = args.bags;
    }
    await ctx.db.patch(deal._id, { status: "enquiry", lastOfferBy: "buyer", buyerTargetPriceUsdPerKg: args.priceUsdPerKg, bags, updatedAt: getUgandaTime() });
    if (args.note?.trim()) {
      const m = maskContactDetails(args.note.trim().slice(0, 2000));
      await ctx.db.insert("exportDealMessages", { dealId: deal._id, senderId: args.userId, senderRole: "buyer", body: m.text, masked: m.masked, createdAt: getUgandaTime() });
    }
    await notify(ctx, deal.exporterId, "Counter-offer received", `The buyer offered USD ${args.priceUsdPerKg}/kg for ${bags} bags on ${deal.dealCode}.`);
    return { success: true };
  },
});

/** Accept the other side's last price. The deal then enters the pipeline. */
export const acceptOffer = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer", "exporter");
    let price: number | undefined;
    if (role === "buyer") {
      if (deal.status !== "quoted" || deal.lastOfferBy !== "exporter") throw new Error("There is no quote to accept");
      if (deal.quoteValidUntil && deal.quoteValidUntil < todayUganda()) throw new Error("This quote has expired; ask for a new one");
      price = deal.quotedPriceUsdPerKg;
    } else {
      if (deal.status !== "enquiry" || deal.lastOfferBy !== "buyer" || deal.buyerTargetPriceUsdPerKg === undefined) {
        throw new Error("There is no buyer price to accept; send a quote instead");
      }
      price = deal.buyerTargetPriceUsdPerKg;
    }
    if (price === undefined) throw new Error("No price to accept");
    await ctx.db.patch(deal._id, { status: "in_progress", agreedPriceUsdPerKg: price, updatedAt: getUgandaTime() });
    await completeStep(ctx, deal._id, "offer_accepted", args.userId);
    await notifyParties(ctx, deal, "Offer accepted", `Offer accepted at USD ${price}/kg, subject to sample approval`, args.userId);
    return { success: true };
  },
});

export const declineOrCancelDeal = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), reason: v.string() },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    const reason = args.reason.trim();
    if (!reason) throw new Error("Give a reason");
    if (deal.status === "completed" || deal.status === "cancelled" || deal.status === "declined") throw new Error("This deal is already closed");
    const feesPaid = !!deal.exporterFeePaidAt || !!deal.buyerFeePaidAt;
    if (feesPaid && role !== "admin") throw new Error("Platform fees are paid. Contact an admin to cancel this deal.");
    await releaseReservedBags(ctx, deal);
    const status = deal.status === "in_progress" ? "cancelled" : "declined";
    await ctx.db.patch(deal._id, { status, cancelledBy: args.userId, cancelReason: reason, updatedAt: getUgandaTime() });
    await notifyParties(ctx, deal, status === "cancelled" ? "Deal cancelled" : "Deal declined", `Reason: ${reason}`, args.userId);
    if (role === "admin") await audit(ctx, "deal_cancelled", args.userId, { targetId: String(deal._id), note: reason });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Messages (masked until identities are revealed)
// ------------------------------------------------------------------

export const sendDealMessage = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), body: v.string() },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    const body = args.body.trim().slice(0, 2000);
    if (!body) throw new Error("Write a message");
    const m = deal.disclosedAt || role === "admin" ? { text: body, masked: false } : maskContactDetails(body);
    await ctx.db.insert("exportDealMessages", { dealId: deal._id, senderId: args.userId, senderRole: role, body: m.text, masked: m.masked, createdAt: getUgandaTime() });
    const to = role === "buyer" ? [deal.exporterId] : role === "exporter" ? [deal.buyerId] : [deal.buyerId, deal.exporterId];
    for (const id of to) await notify(ctx, id, "New deal message", `New message on ${deal.dealCode}.`);
    return { masked: m.masked };
  },
});

// ------------------------------------------------------------------
// Buyer KYC
// ------------------------------------------------------------------

export const getMyKyc = query({
  args: { buyerId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer") throw new Error("Only buyers have KYC");
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const bp = await buyerProfile(ctx, buyer._id);
    const slots = await documentSlots(ctx, buyer._id, "buyer", today);
    return {
      kycStatus: bp?.kycStatus ?? "not_started",
      reviewNotes: bp?.kycReviewNotes,
      slots: await Promise.all(
        slots.map(async (s) => ({
          type: s.type,
          state: s.state,
          current: s.current ? { ...s.current, url: await ctx.storage.getUrl(s.current.storageId) } : null,
        }))
      ),
    };
  },
});

export const generateDealUploadUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !["buyer", "trader", "admin"].includes(user.role)) throw new Error("Not authorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const uploadBuyerKycDocument = mutation({
  args: {
    buyerId: v.id("users"),
    dealId: v.id("exportDeals"),
    documentTypeKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.buyerId, args.dealId);
    requireRole(role, "buyer");
    const type = (await getDocumentTypes(ctx, "buyer")).find((t) => t.key === args.documentTypeKey && t.isActive);
    if (!type) throw new Error("Unknown document type");
    const today = todayUganda();
    if (args.issueDate && !isIsoDate(args.issueDate)) throw new Error("Issue date is not a valid date");
    if (type.hasExpiry) {
      if (!isIsoDate(args.expiryDate)) throw new Error(`${type.label} needs an expiry date`);
      if (args.expiryDate < today) throw new Error("This document has already expired");
    }
    const older = await ctx.db
      .query("exportDocuments")
      .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", args.buyerId).eq("documentTypeKey", type.key))
      .take(50);
    for (const d of older) if (d.status === "pending" || d.status === "rejected") await ctx.db.patch(d._id, { status: "replaced" });
    await ctx.db.insert("exportDocuments", {
      ownerId: args.buyerId,
      ownerKind: "buyer",
      communityId: deal.exporterCommunityId,
      documentTypeKey: type.key,
      documentTypeLabel: type.label,
      documentNumber: args.documentNumber?.trim() || undefined,
      issueDate: args.issueDate || undefined,
      expiryDate: args.expiryDate || undefined,
      storageId: args.storageId,
      fileName: args.fileName.slice(0, 200),
      contentType: args.contentType,
      status: "pending",
      uploadedAt: getUgandaTime(),
    });
    return { success: true };
  },
});

export const submitBuyerKyc = mutation({
  args: { buyerId: v.id("users") },
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer") throw new Error("Only buyers have KYC");
    const bp = await buyerProfile(ctx, buyer._id);
    if (!bp) throw new Error("Complete your buyer profile first");
    if (bp.kycStatus === "approved") throw new Error("Your KYC is already approved");
    const slots = await documentSlots(ctx, buyer._id, "buyer", todayUganda());
    const missing = slots.filter((s) => s.type.required && (s.state === "missing" || s.state === "rejected" || s.state === "expired"));
    if (missing.length) throw new Error(`Upload: ${missing.map((s) => s.type.label).join(", ")}`);
    await ctx.db.patch(bp._id, { kycStatus: "submitted", kycReviewNotes: undefined });
    const deals = await ctx.db.query("exportDeals").withIndex("by_buyerId", (q) => q.eq("buyerId", buyer._id)).take(200);
    const notifiedCommunities = new Set<string>();
    for (const d of deals) {
      if (d.status !== "in_progress" || d.currentStepKey !== "buyer_kyc") continue;
      await notify(ctx, d.exporterId, "Buyer submitted KYC", `The buyer on ${d.dealCode} submitted KYC documents for approval.`);
      const community = await ctx.db.get(d.exporterCommunityId);
      if (community?.communityAdminId && !notifiedCommunities.has(String(community._id))) {
        notifiedCommunities.add(String(community._id));
        await notify(ctx, community.communityAdminId, "Buyer KYC to review", `A buyer on ${d.dealCode} submitted KYC documents.`);
      }
    }
    return { success: true };
  },
});

async function adminCanReviewBuyer(ctx: Ctx, admin: Doc<"users">, buyerId: Id<"users">) {
  if (isSuperAdmin(admin)) return true;
  const deals = await ctx.db.query("exportDeals").withIndex("by_buyerId", (q) => q.eq("buyerId", buyerId)).take(200);
  for (const d of deals) {
    const community = await ctx.db.get(d.exporterCommunityId);
    if (community && adminManagesCommunity(admin, community)) return true;
  }
  return false;
}

export const reviewBuyerKyc = mutation({
  args: { adminId: v.id("users"), buyerId: v.id("users"), decision: v.union(v.literal("approve"), v.literal("reject")), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    if (!(await adminCanReviewBuyer(ctx, admin, args.buyerId))) throw new Error("Not authorized to review this buyer");
    const bp = await buyerProfile(ctx, args.buyerId);
    if (!bp) throw new Error("Buyer profile not found");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "approve") {
      const slots = await documentSlots(ctx, args.buyerId, "buyer", todayUganda());
      const notVerified = slots.filter((s) => s.type.required && s.state !== "verified" && s.state !== "expiring");
      if (notVerified.length) throw new Error(`Verify these documents first: ${notVerified.map((s) => s.type.label).join(", ")}`);
    } else if (!notes) throw new Error("Give a reason");
    await ctx.db.patch(bp._id, {
      kycStatus: args.decision === "approve" ? "approved" : "rejected",
      kycReviewedBy: admin._id,
      kycReviewedAt: getUgandaTime(),
      kycReviewNotes: notes,
    });
    await notify(ctx, args.buyerId, args.decision === "approve" ? "KYC approved" : "KYC needs changes", args.decision === "approve" ? "Your company KYC is approved." : `Your KYC was not approved: ${notes}`);
    if (args.decision === "approve") {
      const deals = await ctx.db.query("exportDeals").withIndex("by_buyerId", (q) => q.eq("buyerId", args.buyerId)).take(200);
      for (const d of deals) {
        if (d.status === "in_progress" && d.currentStepKey === "buyer_kyc") {
          await completeStep(ctx, d._id, "buyer_kyc", admin._id);
          await notify(ctx, d.exporterId, "Buyer KYC approved", `The buyer on ${d.dealCode} passed KYC. The platform will collect your sample next.`);
        }
      }
    }
    await audit(ctx, `buyer_kyc_${args.decision}`, admin._id, { targetUserId: args.buyerId, note: notes });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Sample desk (platform collects from the exporter and ships to the buyer)
// ------------------------------------------------------------------

export const confirmSampleRequest = mutation({
  args: { buyerId: v.id("users"), dealId: v.id("exportDeals"), shippingAddress: v.string() },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.buyerId, args.dealId);
    requireRole(role, "buyer");
    if (deal.currentStepKey !== "sample" || deal.sample?.status !== "awaiting_buyer") throw new Error("No sample request is waiting");
    const address = args.shippingAddress.trim();
    if (address.length < 10) throw new Error("Give a full shipping address for the sample");
    const fees = await getFeeSettings(ctx);
    const fee = deal.sample.round === 1 ? Math.round(fees.sampleHandlingFeeUgx) : 0;
    if (fee > 0) {
      await chargeExportFee(ctx, { userId: args.buyerId, role: "buyer", amountUgx: fee, kind: "sample", note: `Sample for ${deal.dealCode}`, metadata: { dealId: deal._id } });
    }
    await ctx.db.patch(deal._id, {
      sample: { ...deal.sample, status: "awaiting_exporter", shippingAddress: address.slice(0, 500), feeUgx: fee || undefined, updatedAt: getUgandaTime() },
      updatedAt: getUgandaTime(),
    });
    await notify(ctx, deal.exporterId, "Prepare a sample", `Prepare a sample of your lot for ${deal.dealCode}. The platform will collect it.`);
    return { success: true, feeUgx: fee };
  },
});

export const markSampleReady = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "exporter");
    if (deal.sample?.status !== "awaiting_exporter") throw new Error("No sample is waiting for you");
    await ctx.db.patch(deal._id, { sample: { ...deal.sample, status: "ready", updatedAt: getUgandaTime() }, updatedAt: getUgandaTime() });
    const community = await ctx.db.get(deal.exporterCommunityId);
    if (community?.communityAdminId) await notify(ctx, community.communityAdminId, "Sample ready for collection", `Collect the sample for ${deal.dealCode}.`);
    return { success: true };
  },
});

export const adminUpdateSample = mutation({
  args: {
    adminId: v.id("users"),
    dealId: v.id("exportDeals"),
    status: v.union(v.literal("collected"), v.literal("dispatched")),
    courier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.adminId, args.dealId);
    requireRole(role, "admin");
    if (!deal.sample) throw new Error("No sample on this deal");
    if (args.status === "collected" && deal.sample.status !== "ready") throw new Error("The exporter has not marked the sample ready");
    if (args.status === "dispatched") {
      if (deal.sample.status !== "collected") throw new Error("Collect the sample first");
      if (!args.courier?.trim() || !args.trackingNumber?.trim()) throw new Error("Give the courier and tracking number");
    }
    await ctx.db.patch(deal._id, {
      sample: {
        ...deal.sample,
        status: args.status,
        courier: args.courier?.trim() || deal.sample.courier,
        trackingNumber: args.trackingNumber?.trim() || deal.sample.trackingNumber,
        updatedAt: getUgandaTime(),
      },
      updatedAt: getUgandaTime(),
    });
    if (args.status === "collected") await notify(ctx, deal.exporterId, "Sample collected", `The platform collected your sample for ${deal.dealCode}.`);
    else await notify(ctx, deal.buyerId, "Sample on its way", `Your sample for ${deal.dealCode} was sent with ${args.courier}, tracking ${args.trackingNumber}.`);
    await audit(ctx, `sample_${args.status}`, args.adminId, { targetId: String(deal._id) });
    return { success: true };
  },
});

export const decideSample = mutation({
  args: { buyerId: v.id("users"), dealId: v.id("exportDeals"), decision: v.union(v.literal("approve"), v.literal("reject")), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.buyerId, args.dealId);
    requireRole(role, "buyer");
    if (deal.sample?.status !== "dispatched") throw new Error("The sample has not been sent yet");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Tell the exporter why");
    await ctx.db.patch(deal._id, {
      sample: { ...deal.sample, status: args.decision === "approve" ? "approved" : "rejected", buyerNotes: notes, updatedAt: getUgandaTime() },
      updatedAt: getUgandaTime(),
    });
    if (args.decision === "approve") {
      await completeStep(ctx, deal._id, "sample", args.buyerId);
      await notify(ctx, deal.exporterId, "Sample approved", `The buyer approved the sample on ${deal.dealCode}. Agree the contract terms next.`);
    } else {
      await notify(ctx, deal.exporterId, "Sample rejected", `The buyer rejected the sample on ${deal.dealCode}: ${notes}`);
    }
    return { success: true };
  },
});

/** After a rejected sample, the exporter can send another one. */
export const offerNewSample = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "exporter");
    if (deal.sample?.status !== "rejected") throw new Error("Only after a rejected sample");
    await ctx.db.patch(deal._id, {
      sample: { ...deal.sample, status: "awaiting_exporter", round: deal.sample.round + 1, courier: undefined, trackingNumber: undefined, buyerNotes: undefined, updatedAt: getUgandaTime() },
      updatedAt: getUgandaTime(),
    });
    await notify(ctx, deal.buyerId, "New sample coming", `The exporter is preparing another sample for ${deal.dealCode}.`);
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Contract terms and platform fees
// ------------------------------------------------------------------

export const proposeContract = mutation({
  args: {
    userId: v.id("users"),
    dealId: v.id("exportDeals"),
    priceUsdPerKg: v.number(),
    bags: v.number(),
    incoterm: v.string(),
    port: v.string(),
    shipmentWindowStart: v.string(),
    shipmentWindowEnd: v.string(),
    paymentTerms: v.string(),
    otherTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer", "exporter");
    if (deal.currentStepKey !== "contract_terms") throw new Error("Contract terms come after the sample is approved");
    validPrice(args.priceUsdPerKg);
    const lot = await ctx.db.get(deal.lotId);
    if (!lot) throw new Error("Lot not found");
    if (!Number.isInteger(args.bags) || args.bags < 1 || args.bags > lot.availableBags) throw new Error(`Up to ${lot.availableBags} bags are available`);
    if (!(INCOTERMS as readonly string[]).includes(args.incoterm)) throw new Error("Choose a valid Incoterm");
    if (!args.port.trim()) throw new Error("Give the port or place of delivery");
    if (!isIsoDate(args.shipmentWindowStart) || !isIsoDate(args.shipmentWindowEnd) || args.shipmentWindowEnd < args.shipmentWindowStart) {
      throw new Error("Give a valid shipment window");
    }
    if (!args.paymentTerms.trim()) throw new Error("Give the payment terms");
    const now = getUgandaTime();
    await ctx.db.patch(deal._id, {
      contract: {
        priceUsdPerKg: args.priceUsdPerKg,
        bags: args.bags,
        bagWeightKg: lot.bagWeightKg,
        incoterm: args.incoterm,
        port: args.port.trim(),
        shipmentWindowStart: args.shipmentWindowStart,
        shipmentWindowEnd: args.shipmentWindowEnd,
        paymentTerms: args.paymentTerms.trim(),
        otherTerms: args.otherTerms ? maskContactDetails(args.otherTerms.trim().slice(0, 3000)).text : undefined,
        proposedBy: role === "buyer" ? "buyer" : "exporter",
        exporterAgreedAt: role === "exporter" ? now : undefined,
        buyerAgreedAt: role === "buyer" ? now : undefined,
      },
      updatedAt: now,
    });
    await notify(ctx, role === "buyer" ? deal.exporterId : deal.buyerId, "Contract terms proposed", `Review and agree the contract terms on ${deal.dealCode}.`);
    return { success: true };
  },
});

export const agreeContract = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer", "exporter");
    if (deal.currentStepKey !== "contract_terms" || !deal.contract) throw new Error("There are no terms to agree");
    const c = deal.contract;
    if ((role === "buyer" && c.buyerAgreedAt) || (role === "exporter" && c.exporterAgreedAt)) throw new Error("You already agreed; waiting for the other side");
    const now = getUgandaTime();
    const contract = { ...c, buyerAgreedAt: role === "buyer" ? now : c.buyerAgreedAt, exporterAgreedAt: role === "exporter" ? now : c.exporterAgreedAt };

    // Both agreed: reserve the bags and fix the fees.
    const lot = await ctx.db.get(deal.lotId);
    if (!lot || lot.availableBags < contract.bags) throw new Error("Those bags are no longer available");
    const rates = await ctx.db.query("exchangeRates").withIndex("by_base", (q) => q.eq("baseCurrency", "UGX")).first();
    const fx = ugxPerUsd(rates?.rates.USD);
    if (!fx) throw new Error("The UGX/USD exchange rate is not available yet. Try again shortly.");
    const fees = await getFeeSettings(ctx);
    const profile = await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", deal.exporterId)).first();
    const value = Math.round(contract.priceUsdPerKg * contract.bags * contract.bagWeightKg * 100) / 100;
    const f = computeDealFees({
      contractValueUsd: value,
      bags: contract.bags,
      fxUgxPerUsd: fx,
      successFeeMode: fees.successFeeMode,
      successFeePercent: fees.successFeePercent,
      successFeePerBagUsd: fees.successFeePerBagUsd,
      buyerFeePercent: fees.buyerFeePercent,
      exporterCreditUgx: profile?.successFeeCreditUgx ?? 0,
    });
    const availableBags = lot.availableBags - contract.bags;
    await ctx.db.patch(lot._id, { availableBags, status: availableBags === 0 ? "sold_out" : lot.status, updatedAt: now });
    await ctx.db.patch(deal._id, {
      contract,
      bags: contract.bags,
      incoterm: contract.incoterm,
      agreedPriceUsdPerKg: contract.priceUsdPerKg,
      contractValueUsd: value,
      bagsReserved: contract.bags,
      fxUgxPerUsd: Math.round(fx * 100) / 100,
      exporterFeeUgx: f.exporterDueUgx,
      exporterFeeCreditUgx: f.creditAppliedUgx,
      buyerFeeUgx: f.buyerFeeUgx,
      updatedAt: now,
    });
    await completeStep(ctx, deal._id, "contract_terms", args.userId);
    if (f.successFeeUgx === 0 && f.buyerFeeUgx === 0) {
      // No platform fee is set: move straight on to revealing identities.
      await completeStep(ctx, deal._id, "platform_fees", args.userId);
      return { success: true, contractValueUsd: value };
    }
    await notifyParties(ctx, deal, "Contract agreed", `Contract agreed: USD ${value.toLocaleString()}. Pay the platform fee to reveal company names`);
    return { success: true, contractValueUsd: value };
  },
});

export const payDealFee = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer", "exporter");
    if (deal.currentStepKey !== "platform_fees") throw new Error("Fees are due after the contract is agreed");
    const now = getUgandaTime();
    if (role === "exporter") {
      if (deal.exporterFeePaidAt) throw new Error("Your fee is already paid");
      // Re-apply credit against what the exporter actually has left now.
      const profile = await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", deal.exporterId)).first();
      const gross = (deal.exporterFeeUgx ?? 0) + (deal.exporterFeeCreditUgx ?? 0);
      const credit = Math.min(profile?.successFeeCreditUgx ?? 0, gross);
      const due = gross - credit;
      await chargeExportFee(ctx, {
        userId: args.userId,
        role: "trader",
        amountUgx: due,
        kind: "success",
        note: `Success fee ${deal.dealCode}`,
        creditAppliedUgx: credit || undefined,
        metadata: { dealId: deal._id, contractValueUsd: deal.contractValueUsd },
      });
      if (profile && credit > 0) await ctx.db.patch(profile._id, { successFeeCreditUgx: profile.successFeeCreditUgx - credit, updatedAt: now });
      await ctx.db.patch(deal._id, { exporterFeePaidAt: now, exporterFeeUgx: due, exporterFeeCreditUgx: credit, updatedAt: now });
    } else {
      if (deal.buyerFeePaidAt) throw new Error("Your fee is already paid");
      await chargeExportFee(ctx, { userId: args.userId, role: "buyer", amountUgx: deal.buyerFeeUgx ?? 0, kind: "buyer", note: `Buyer fee ${deal.dealCode}`, metadata: { dealId: deal._id } });
      await ctx.db.patch(deal._id, { buyerFeePaidAt: now, updatedAt: now });
    }
    const after = (await ctx.db.get(deal._id))!;
    // A zero fee counts as paid, so the side with nothing to pay is never waited on.
    const exporterDone = !!after.exporterFeePaidAt || (after.exporterFeeUgx ?? 0) + (after.exporterFeeCreditUgx ?? 0) === 0;
    const buyerDone = !!after.buyerFeePaidAt || (after.buyerFeeUgx ?? 0) === 0;
    if (exporterDone && buyerDone) {
      await completeStep(ctx, deal._id, "platform_fees", args.userId);
    } else {
      await notify(ctx, role === "buyer" ? deal.exporterId : deal.buyerId, "Waiting for your platform fee", `The other side paid their fee on ${deal.dealCode}.`);
    }
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Documents, shipment details and confirmations
// ------------------------------------------------------------------

export const uploadDealDocument = mutation({
  args: {
    userId: v.id("users"),
    dealId: v.id("exportDeals"),
    stepKey: v.string(),
    label: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    capturedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    if (deal.status !== "in_progress") throw new Error("This deal is not in progress");
    const steps = await dealSteps(ctx, deal._id);
    const step = steps.find((s) => s.key === args.stepKey);
    if (!step || step.kind !== "documents") throw new Error("This step takes no documents");
    if (step.status !== "active") throw new Error("Upload documents when this step is current");
    if (role !== "admin" && step.actor !== role) throw new Error("The other side uploads documents for this step");
    if (!step.requiredDocuments.includes(args.label)) throw new Error("Unknown document for this step");
    const docs = await ctx.db.query("exportDealDocuments").withIndex("by_dealId", (q) => q.eq("dealId", deal._id)).take(300);
    for (const d of docs) {
      if (d.stepKey === step.key && d.label === args.label && d.status === "pending") {
        await ctx.db.patch(d._id, { status: "rejected", reviewNotes: "Replaced by a newer upload" });
      }
    }
    await ctx.db.insert("exportDealDocuments", {
      dealId: deal._id,
      stepKey: step.key,
      label: args.label,
      uploadedBy: args.userId,
      uploaderRole: role,
      storageId: args.storageId,
      fileName: args.fileName.slice(0, 200),
      contentType: args.contentType,
      lat: args.lat,
      lng: args.lng,
      capturedAt: args.capturedAt,
      status: "pending",
      uploadedAt: getUgandaTime(),
    });
    const community = await ctx.db.get(deal.exporterCommunityId);
    if (community?.communityAdminId) await notify(ctx, community.communityAdminId, "Deal document to review", `${args.label} uploaded on ${deal.dealCode}.`);
    return { success: true };
  },
});

export const reviewDealDocument = mutation({
  args: { adminId: v.id("users"), documentId: v.id("exportDealDocuments"), decision: v.union(v.literal("accept"), v.literal("reject")), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { deal, role } = await loadDeal(ctx, args.adminId, doc.dealId);
    requireRole(role, "admin");
    if (doc.status !== "pending") throw new Error("Already reviewed");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason");
    await ctx.db.patch(doc._id, { status: args.decision === "accept" ? "accepted" : "rejected", reviewedBy: args.adminId, reviewNotes: notes });
    await notify(ctx, doc.uploadedBy, args.decision === "accept" ? "Document accepted" : "Document rejected", `${doc.label} on ${deal.dealCode} ${args.decision === "accept" ? "was accepted" : `was rejected: ${notes}`}.`);
    if (args.decision === "accept") await tryCompleteDocumentStep(ctx, deal._id, args.adminId);
    await audit(ctx, `deal_document_${args.decision}`, args.adminId, { targetId: String(doc._id), note: notes });
    return { success: true };
  },
});

export const recordPaymentDetails = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), paymentMethod: v.string(), amountUsd: v.number(), reference: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "buyer", "admin");
    if (deal.currentStepKey !== "payment_security") throw new Error("Payment is recorded at the payment step");
    if (!args.paymentMethod.trim()) throw new Error("Choose the payment method");
    if (!(args.amountUsd > 0)) throw new Error("Give the amount in USD");
    await ctx.db.patch(deal._id, { paymentMethod: args.paymentMethod.trim(), paymentAmountUsd: args.amountUsd, paymentReference: args.reference?.trim() || undefined, updatedAt: getUgandaTime() });
    await tryCompleteDocumentStep(ctx, deal._id, args.userId);
    return { success: true };
  },
});

export const recordShipmentDetails = mutation({
  args: {
    userId: v.id("users"),
    dealId: v.id("exportDeals"),
    containerNumber: v.optional(v.string()),
    sealNumber: v.optional(v.string()),
    vessel: v.optional(v.string()),
    blNumber: v.optional(v.string()),
    etd: v.optional(v.string()),
    eta: v.optional(v.string()),
    shippedOn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    requireRole(role, "exporter", "admin");
    if (!["stuffing", "shipped"].includes(deal.currentStepKey)) throw new Error("Shipment details are recorded at stuffing and shipping");
    for (const d of [args.etd, args.eta, args.shippedOn]) if (d && !isIsoDate(d)) throw new Error("Dates must be valid");
    const clean = (s?: string) => s?.trim() || undefined;
    await ctx.db.patch(deal._id, {
      containerNumber: clean(args.containerNumber) ?? deal.containerNumber,
      sealNumber: clean(args.sealNumber) ?? deal.sealNumber,
      vessel: clean(args.vessel) ?? deal.vessel,
      blNumber: clean(args.blNumber) ?? deal.blNumber,
      etd: clean(args.etd) ?? deal.etd,
      eta: clean(args.eta) ?? deal.eta,
      shippedOn: clean(args.shippedOn) ?? deal.shippedOn,
      updatedAt: getUgandaTime(),
    });
    await tryCompleteDocumentStep(ctx, deal._id, args.userId);
    return { success: true };
  },
});

export const confirmDealStep = mutation({
  args: { userId: v.id("users"), dealId: v.id("exportDeals"), stepKey: v.string() },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.userId, args.dealId);
    const steps = await dealSteps(ctx, deal._id);
    const step = steps.find((s) => s.key === args.stepKey);
    if (!step || step.kind !== "confirm" || step.status !== "active") throw new Error("Nothing to confirm here");
    if (role !== "admin" && step.actor !== role) throw new Error("The other side confirms this step");
    await completeStep(ctx, deal._id, step.key, args.userId);
    await notifyParties(ctx, deal, `${step.name} confirmed`, `${step.name} was confirmed`, args.userId);
    return { success: true };
  },
});

export const rateDeal = mutation({
  args: {
    buyerId: v.id("users"),
    dealId: v.id("exportDeals"),
    overall: v.number(),
    quality: v.number(),
    documents: v.number(),
    communication: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, role } = await loadDeal(ctx, args.buyerId, args.dealId);
    requireRole(role, "buyer");
    if (deal.currentStepKey !== "rating") throw new Error("Rate the exporter once the balance is settled");
    for (const n of [args.overall, args.quality, args.documents, args.communication]) {
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("Ratings are 1 to 5 stars");
    }
    await ctx.db.insert("exportRatings", {
      dealId: deal._id,
      exporterId: deal.exporterId,
      buyerId: deal.buyerId,
      overall: args.overall,
      quality: args.quality,
      documents: args.documents,
      communication: args.communication,
      comment: args.comment?.trim().slice(0, 1000) || undefined,
      createdAt: getUgandaTime(),
    });
    await completeStep(ctx, deal._id, "rating", args.buyerId);
    await notify(ctx, deal.exporterId, "You were rated", `The buyer rated ${deal.dealCode} ${args.overall}/5.`);
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------

async function counterpartView(ctx: Ctx, deal: Doc<"exportDeals">, role: Role) {
  const exporter = await ctx.db.get(deal.exporterId);
  const buyer = await ctx.db.get(deal.buyerId);
  const bp = await buyerProfile(ctx, deal.buyerId);
  const ep = await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", deal.exporterId)).first();
  const revealed = !!deal.disclosedAt || role === "admin";
  return {
    exporter: {
      alias: `Exporter ${exporter?.alias ?? ""}`,
      stats: await exporterPublicStats(ctx, deal.exporterId),
      identity:
        revealed || role === "exporter"
          ? ep && {
              legalName: ep.legalName,
              tradingName: ep.tradingName,
              licence: ep.exporterLicenceNumber,
              address: ep.physicalAddress,
              contactPerson: ep.contactPerson,
              contactPhone: ep.contactPhone,
              contactEmail: ep.contactEmail,
              tin: ep.tin,
            }
          : null,
    },
    buyer: {
      alias: `Buyer ${buyer?.alias ?? ""}`,
      country: bp?.countryName ?? "Uganda",
      kycStatus: bp?.kycStatus ?? "not_started",
      identity:
        revealed || role === "buyer"
          ? bp && {
              businessName: bp.businessName,
              address: [bp.addressLine, bp.city, bp.postalCode, bp.countryName].filter(Boolean).join(", "),
              contactPerson: bp.contactPerson,
              contactPhone: bp.contactPhone ?? buyer?.phoneNumber,
              contactEmail: buyer?.email,
              registration: bp.companyRegistrationNumber,
              taxId: bp.taxId,
              eori: bp.eoriNumber,
            }
          : null,
    },
  };
}

export const getDeal = query({
  args: { userId: v.id("users"), dealId: v.id("exportDeals") },
  handler: async (ctx, args) => {
    let loaded;
    try {
      loaded = await loadDeal(ctx, args.userId, args.dealId);
    } catch {
      return null; // not a party to this deal
    }
    const { deal, role } = loaded;
    const lot = await ctx.db.get(deal.lotId);
    const steps = await dealSteps(ctx, deal._id);
    const docs = await ctx.db.query("exportDealDocuments").withIndex("by_dealId", (q) => q.eq("dealId", deal._id)).take(300);
    const messages = await ctx.db.query("exportDealMessages").withIndex("by_dealId", (q) => q.eq("dealId", deal._id)).order("desc").take(100);
    const rating = await ctx.db.query("exportRatings").withIndex("by_dealId", (q) => q.eq("dealId", deal._id)).first();
    // The sample shipping address is for the platform only.
    const sample = deal.sample && (role === "admin" || role === "buyer" ? deal.sample : { ...deal.sample, shippingAddress: undefined });
    return {
      role,
      deal: { ...deal, sample },
      lot: lot && {
        _id: lot._id,
        lotCode: lot.lotCode,
        coffeeType: lot.coffeeType,
        grade: lot.grade,
        processing: lot.processing,
        cropYear: lot.cropYear,
        originDistrict: lot.originDistrict,
        bagWeightKg: lot.bagWeightKg,
        availableBags: lot.availableBags,
        incoterms: lot.incoterms,
        traceLevel: lot.traceLevel,
        eudrReady: lot.eudrReady,
      },
      parties: await counterpartView(ctx, deal, role),
      steps,
      documents: await Promise.all(docs.map(async (d) => ({ ...d, url: await ctx.storage.getUrl(d.storageId) }))),
      messages: messages.reverse().map((m) => ({ ...m, mine: m.senderId === args.userId })),
      rating,
      walletBalanceUgx: role === "admin" ? null : await walletBalance(ctx, args.userId),
    };
  },
});

export const listMyDeals = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    const deals =
      user.role === "buyer"
        ? await ctx.db.query("exportDeals").withIndex("by_buyerId", (q) => q.eq("buyerId", user._id)).order("desc").take(200)
        : await ctx.db.query("exportDeals").withIndex("by_exporterId", (q) => q.eq("exporterId", user._id)).order("desc").take(200);
    const result = [];
    for (const d of deals) {
      const lot = await ctx.db.get(d.lotId);
      const step = (await dealSteps(ctx, d._id)).find((s) => s.key === d.currentStepKey);
      const role: Role = user.role === "buyer" ? "buyer" : "exporter";
      const counterpart =
        role === "buyer"
          ? d.disclosedAt
            ? (await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", d.exporterId)).first())?.legalName
            : `Exporter ${(await ctx.db.get(d.exporterId))?.alias ?? ""}`
          : d.disclosedAt
            ? (await buyerProfile(ctx, d.buyerId))?.businessName
            : `Buyer ${(await ctx.db.get(d.buyerId))?.alias ?? ""} (${(await buyerProfile(ctx, d.buyerId))?.countryName ?? "Uganda"})`;
      result.push({
        _id: d._id,
        dealCode: d.dealCode,
        status: d.status,
        bags: d.bags,
        incoterm: d.incoterm,
        lotCode: lot?.lotCode ?? "",
        lotSummary: lot ? `${lot.coffeeType} ${lot.grade}` : "",
        currentStep: step?.name ?? (d.status === "enquiry" || d.status === "quoted" ? "Price negotiation" : d.status),
        waitingOn: step?.actor ?? (d.status === "enquiry" ? "exporter" : d.status === "quoted" ? "buyer" : null),
        counterpart: counterpart ?? "",
        updatedAt: d.updatedAt,
      });
    }
    return result;
  },
});

export const listDealsForAdmin = query({
  args: {
    adminId: v.id("users"),
    status: v.union(v.literal("enquiry"), v.literal("quoted"), v.literal("in_progress"), v.literal("completed"), v.literal("declined"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    let deals: Doc<"exportDeals">[] = [];
    if (isSuperAdmin(admin)) {
      deals = await ctx.db.query("exportDeals").withIndex("by_status", (q) => q.eq("status", args.status)).order("desc").take(200);
    } else {
      const communities = (await ctx.db.query("communities").take(1000)).filter((c) => c.exportMarketsEnabled === true && adminManagesCommunity(admin, c));
      for (const c of communities) {
        deals.push(...(await ctx.db.query("exportDeals").withIndex("by_exporterCommunityId_and_status", (q) => q.eq("exporterCommunityId", c._id).eq("status", args.status)).take(200)));
      }
    }
    const result = [];
    for (const d of deals) {
      const lot = await ctx.db.get(d.lotId);
      const step = (await dealSteps(ctx, d._id)).find((s) => s.key === d.currentStepKey);
      result.push({
        _id: d._id,
        dealCode: d.dealCode,
        lotCode: lot?.lotCode ?? "",
        bags: d.bags,
        incoterm: d.incoterm,
        contractValueUsd: d.contractValueUsd,
        currentStep: step?.name ?? d.status,
        sampleStatus: d.sample?.status,
        updatedAt: d.updatedAt,
      });
    }
    return result;
  },
});

/** Everything waiting on an admin: deal documents, sample desk tasks and buyer KYC. */
export const listAdminDealTasks = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const canSee = async (deal: Doc<"exportDeals">) => {
      if (isSuperAdmin(admin)) return true;
      const c = await ctx.db.get(deal.exporterCommunityId);
      return !!c && adminManagesCommunity(admin, c);
    };
    const pendingDocs = [];
    for (const d of await ctx.db.query("exportDealDocuments").withIndex("by_status", (q) => q.eq("status", "pending")).take(200)) {
      const deal = await ctx.db.get(d.dealId);
      if (!deal || !(await canSee(deal))) continue;
      pendingDocs.push({ ...d, url: await ctx.storage.getUrl(d.storageId), dealCode: deal.dealCode });
    }
    const sampleTasks = [];
    const kycBuyers = new Map<string, { buyerId: Id<"users">; alias: string; businessName: string; country: string; dealCodes: string[] }>();
    for (const deal of await ctx.db.query("exportDeals").withIndex("by_status", (q) => q.eq("status", "in_progress")).take(500)) {
      if (!(await canSee(deal))) continue;
      if (deal.currentStepKey === "sample" && deal.sample && ["ready", "collected"].includes(deal.sample.status)) {
        const lot = await ctx.db.get(deal.lotId);
        const ep = await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", deal.exporterId)).first();
        sampleTasks.push({
          dealId: deal._id,
          dealCode: deal.dealCode,
          lotCode: lot?.lotCode ?? "",
          status: deal.sample.status,
          round: deal.sample.round,
          collectFrom: ep ? `${ep.legalName}, ${ep.physicalAddress} (${ep.contactPerson}, ${ep.contactPhone})` : "",
          warehouse: lot?.warehouseLocation ?? "",
          shipTo: deal.sample.shippingAddress ?? "",
        });
      }
      if (deal.currentStepKey === "buyer_kyc") {
        const bp = await buyerProfile(ctx, deal.buyerId);
        if (bp?.kycStatus !== "submitted") continue;
        const buyer = await ctx.db.get(deal.buyerId);
        const key = String(deal.buyerId);
        const entry = kycBuyers.get(key) ?? { buyerId: deal.buyerId, alias: buyer?.alias ?? "", businessName: bp.businessName, country: bp.countryName ?? "Uganda", dealCodes: [] };
        entry.dealCodes.push(deal.dealCode);
        kycBuyers.set(key, entry);
      }
    }
    return { pendingDocs, sampleTasks, kycBuyers: [...kycBuyers.values()] };
  },
});

// ------------------------------------------------------------------
// Pipeline templates (super admin)
// ------------------------------------------------------------------

export const getPipelineTemplate = query({
  args: { incoterm: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("exportPipelineTemplates").withIndex("by_incoterm", (q) => q.eq("incoterm", args.incoterm)).first();
    return { customised: !!row, steps: row ? row.steps : defaultPipelineSteps(args.incoterm) };
  },
});

const stepValidator = v.object({
  key: v.string(),
  name: v.string(),
  actor: v.union(v.literal("buyer"), v.literal("exporter"), v.literal("admin"), v.literal("platform")),
  kind: v.union(v.literal("system"), v.literal("documents"), v.literal("confirm")),
  system: v.boolean(),
  requiredDocuments: v.array(v.string()),
  description: v.optional(v.string()),
});

export const savePipelineTemplate = mutation({
  args: { adminId: v.id("users"), incoterm: v.string(), steps: v.array(stepValidator), reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    if (!(INCOTERMS as readonly string[]).includes(args.incoterm)) throw new Error("Unknown Incoterm");
    const existing = await ctx.db.query("exportPipelineTemplates").withIndex("by_incoterm", (q) => q.eq("incoterm", args.incoterm)).first();
    if (args.reset) {
      if (existing) await ctx.db.delete(existing._id);
      return { success: true };
    }
    // System steps keep their behaviour; only the name, description and
    // (for document steps) the document list can change.
    const defaults = new Map(defaultPipelineSteps(args.incoterm).map((s) => [s.key, s]));
    const steps: PipelineStep[] = args.steps.map((s) => {
      const d = defaults.get(s.key);
      const docs = s.requiredDocuments.map((x) => x.trim()).filter(Boolean).slice(0, 20);
      if (d) {
        return { ...d, name: s.name.trim() || d.name, description: s.description?.trim() || d.description, requiredDocuments: d.kind === "documents" && docs.length ? docs : d.requiredDocuments };
      }
      return { ...s, key: s.key.trim(), name: s.name.trim(), system: false, requiredDocuments: s.kind === "documents" ? docs : [] };
    });
    const error = validatePipelineSteps(steps);
    if (error) throw new Error(error);
    const row = { incoterm: args.incoterm, steps, updatedBy: args.adminId, updatedAt: getUgandaTime() };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("exportPipelineTemplates", row);
    await audit(ctx, "pipeline_template_saved", args.adminId, { targetId: args.incoterm });
    return { success: true };
  },
});
