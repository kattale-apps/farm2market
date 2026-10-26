/**
 * Lot orders: the pure rules, no database.
 *
 * A buyer commits the seller's share of a lot's price into escrow, the
 * seller works through their own milestone steps, and each finished step
 * charges its share of the price from the buyer's wallet into escrow. The
 * last step is the handover (collection at the farm gate or store). It
 * needs the whole price in escrow; when the buyer confirms collection, or
 * after AUTO_SETTLE_MS, escrow settles to the seller in one payment.
 *
 * Step amounts are never stored: every amount is a percentage of the
 * order's total, which comes from the settled (agreed) price, so an
 * accepted offer moves every step amount with it.
 *
 * Shared by Convex and the app so the form, the ledger and the server
 * show the same numbers.
 */

import { v } from "convex/values";

export type PlanStep = {
  name: string;
  earnPercent: number; // Share of the price the seller has earned once this step is done (pending until settlement)
  payPercent: number; // Share of the price charged from the buyer into escrow when this step is done
  handover: boolean; // The last step: goods change hands; needs 100% in escrow
};

export const planStepValidator = v.object({
  name: v.string(),
  earnPercent: v.number(),
  payPercent: v.number(),
  handover: v.boolean(),
});

/** A position read live on a form. GPS is best effort and never blocks a form. */
export const gpsValidator = v.object({
  lat: v.number(),
  lng: v.number(),
  accuracy: v.optional(v.number()),
  capturedAt: v.string(),
});

// Transporters move goods; they do not buy lots (26 Oct 2026). Offers a
// transporter made before can still be answered or cancelled until they close.
export const PURCHASER_ROLES = ["trader", "store", "vendor", "buyer"] as const;
export const OFFER_FOLLOW_UP_ROLES = [...PURCHASER_ROLES, "transporter"] as const;
// Exporters ("trader") list lots from their stock with the same form.
export const LOT_SELLER_ROLES = ["farmer", "vendor", "store", "trader"] as const;

export const MAX_PLAN_STEPS = 8;
export const PAYMENT_GRACE_MS = 48 * 60 * 60 * 1000; // Buyer has 48 hours to pay a step's share
export const AUTO_SETTLE_MS = 3 * 24 * 60 * 60 * 1000; // Settles 3 days after handover unless the buyer reports a problem
export const COMMIT_PERCENT_CHOICES = [20, 30, 50, 100] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Who can buy lots: exporters, processors, vendors and business buyers the
 * super admin verified. A processor whose facility the platform approved
 * (`approvedProcessor`) counts as verified.
 */
export function lotBuyingDecision(
  user: { role: string; verificationStatus?: string; isVerifiedTrader?: boolean } | null,
  approvedProcessor: boolean
): { ok: boolean; reason?: string } {
  if (!user || !(PURCHASER_ROLES as readonly string[]).includes(user.role)) {
    return { ok: false, reason: "Only exporters, processors, vendors and business buyers can buy lots." };
  }
  if (user.verificationStatus === "verified" || user.isVerifiedTrader === true) return { ok: true };
  if (user.role === "store" && approvedProcessor) return { ok: true };
  return { ok: false, reason: "Get verified by Farm2Market to buy lots. Ask the super admin to verify your account." };
}

/**
 * Who can sell in bulk on MarketSpace: sellers the super admin verified.
 * Exporters verified before the switch was widened, and processors whose
 * facility the platform approved, count as verified.
 */
export function bulkSellingDecision(
  user: { role: string; verificationStatus?: string; isVerifiedTrader?: boolean } | null,
  approvedProcessor: boolean
): { ok: boolean; reason?: string } {
  if (!user || !(LOT_SELLER_ROLES as readonly string[]).includes(user.role)) {
    return { ok: false, reason: "Only farmers, vendors, processors and exporters sell lots." };
  }
  if (user.verificationStatus === "verified" || user.isVerifiedTrader === true) return { ok: true };
  if (user.role === "store" && approvedProcessor) return { ok: true };
  return { ok: false, reason: "Selling in bulk is for verified sellers. Ask the super admin to verify your account." };
}

export type StockSource = "own_farm" | "in_app" | "off_app";

/** Where a stock row is from: bought through the app (traced to farms) or declared off-app. */
export function stockRowSource(row: { source?: "in_app" | "off_app"; listingUnitIds: unknown[] }): "in_app" | "off_app" {
  return row.source ?? (row.listingUnitIds.length > 0 ? "in_app" : "off_app");
}

/**
 * The rule that keeps in-app and off-app stock apart. Farmers sell their own
 * farm's produce. Vendors, processors and exporters say where a listing's
 * stock is from: "in_app" must be a stock row they bought through the app,
 * of the same crop, sold in bags and lots; "off_app" can never use a row
 * bought in the app. Returns the problem, or null when the listing is fine.
 */
export function stockSourceProblem(input: {
  sellerRole: string;
  claimed?: "in_app" | "off_app";
  stock: { source: "in_app" | "off_app"; produceType: string } | null;
  produceType: string;
  listingMode: string;
}): string | null {
  const { sellerRole, claimed, stock } = input;
  if (sellerRole === "farmer") return stock ? "Farmers sell produce from their own farm, not from stock" : null;
  if (claimed === "in_app" && (!stock || stock.source !== "in_app")) {
    return "Choose stock you bought in the app, or mark this listing as not bought in the app";
  }
  if (claimed === "off_app" && stock?.source === "in_app") {
    return "That stock was bought in the app: mark the listing as bought in the app";
  }
  if (!stock) return null;
  if (input.listingMode !== "unit") return "Stock from your store is sold in bags and lots";
  if (stock.produceType.trim().toLowerCase() !== input.produceType.trim().toLowerCase()) {
    return `That stock is ${stock.produceType}: list it as ${stock.produceType}`;
  }
  return null;
}

/** The steps a seller starts from: a farm for farmers, a store for vendors and processors. */
export function defaultSteps(sellerRole: string): Omit<PlanStep, "payPercent">[] {
  if (sellerRole === "farmer") {
    return [
      { name: "Harvest", earnPercent: 30, handover: false },
      { name: "Prepare (dry, sort, bag and weigh)", earnPercent: 30, handover: false },
      { name: "Collect from farm gate", earnPercent: 40, handover: true },
    ];
  }
  return [
    { name: "Get the stock ready (sort, bag and weigh)", earnPercent: 60, handover: false },
    { name: "Collect from my store", earnPercent: 40, handover: true },
  ];
}

/**
 * Spreads the rest of the price (100 − commit %) over the steps before the
 * handover, in proportion to what each step earns, so the whole price is in
 * escrow before the goods change hands. With no step before the handover the
 * rest is due at the handover itself.
 */
export function proRatePay(steps: { earnPercent: number; handover: boolean }[], commitPercent: number): number[] {
  const rest = round2(100 - commitPercent);
  const pay = steps.map(() => 0);
  const before = steps.map((s, i) => (s.handover ? -1 : i)).filter((i) => i >= 0);
  if (rest <= 0) return pay;
  if (before.length === 0) {
    const handover = steps.findIndex((s) => s.handover);
    if (handover >= 0) pay[handover] = rest;
    return pay;
  }
  const weight = before.reduce((sum, i) => sum + steps[i].earnPercent, 0);
  let given = 0;
  before.forEach((i, k) => {
    if (k === before.length - 1) {
      pay[i] = round2(rest - given);
    } else {
      pay[i] = round2(weight > 0 ? (rest * steps[i].earnPercent) / weight : rest / before.length);
      given = round2(given + pay[i]);
    }
  });
  return pay;
}

/** A seller's default plan with the payment schedule filled in. */
export function defaultPlan(sellerRole: string, commitPercent: number): PlanStep[] {
  const steps = defaultSteps(sellerRole);
  const pay = proRatePay(steps, commitPercent);
  return steps.map((s, i) => ({ ...s, payPercent: pay[i] }));
}

/** Checks a commit % and plan; returns the cleaned plan or throws a plain message. */
export function validatePlan(steps: PlanStep[], commitPercent: number): PlanStep[] {
  if (!Number.isFinite(commitPercent) || commitPercent < 1 || commitPercent > 100) {
    throw new Error("The buyer's first payment must be between 1% and 100% of the price");
  }
  if (steps.length < 1 || steps.length > MAX_PLAN_STEPS) {
    throw new Error(`Use between 1 and ${MAX_PLAN_STEPS} steps`);
  }
  const clean = steps.map((s) => ({
    name: s.name.trim().slice(0, 60),
    earnPercent: round2(s.earnPercent),
    payPercent: round2(s.payPercent),
    handover: s.handover,
  }));
  if (clean.some((s) => !s.name)) throw new Error("Every step needs a name");
  if (clean.some((s) => !(s.earnPercent >= 0) || !(s.payPercent >= 0))) {
    throw new Error("Step percentages cannot be negative");
  }
  const handovers = clean.filter((s) => s.handover).length;
  if (handovers !== 1 || !clean[clean.length - 1].handover) {
    throw new Error("The last step must be the collection (handover) step, and only the last");
  }
  const earned = round2(clean.reduce((sum, s) => sum + s.earnPercent, 0));
  if (Math.abs(earned - 100) > 0.01) throw new Error(`The steps' shares must add up to 100% (now ${earned}%)`);
  const paid = round2(commitPercent + clean.reduce((sum, s) => sum + s.payPercent, 0));
  if (Math.abs(paid - 100) > 0.01) {
    throw new Error(`The first payment and the step payments must add up to 100% (now ${paid}%)`);
  }
  return clean;
}

/**
 * A listing's terms from what the seller chose: with only a commit % the
 * seller's default steps are used. Returns null when neither was given
 * (older callers: 100% to commit and the default steps).
 */
export function lotTerms(sellerRole: string, commitPercent?: number, plan?: PlanStep[]) {
  if (commitPercent === undefined && plan === undefined) return null;
  const commit = commitPercent ?? 100;
  return { commitPercent: commit, milestonePlan: validatePlan(plan ?? defaultPlan(sellerRole, commit), commit) };
}

/** UGX for a share of the order's total. */
export function amountFor(total: number, percent: number): number {
  return Math.round((total * percent) / 100);
}

/** What the buyer pays when committing. */
export function commitAmount(total: number, commitPercent: number): number {
  return amountFor(total, commitPercent);
}

/**
 * UGX that should be in escrow once steps 0..index are done. Cumulative so
 * the parts never leak a shilling: once the last step is done it is exactly
 * the total.
 */
export function escrowTargetAfter(total: number, commitPercent: number, pays: number[], index: number): number {
  const percent = commitPercent + pays.slice(0, index + 1).reduce((sum, p) => sum + p, 0);
  return percent >= 99.995 ? total : amountFor(total, percent);
}

/** UGX charged from the buyer when step `index` is done (or, for the handover, before it). */
export function chargeForStep(total: number, commitPercent: number, pays: number[], index: number): number {
  const before = index === 0 ? commitAmount(total, commitPercent) : escrowTargetAfter(total, commitPercent, pays, index - 1);
  return Math.max(0, escrowTargetAfter(total, commitPercent, pays, index) - before);
}

/** What the seller has earned so far by finished steps; pending until settlement. */
export function earnedSoFar(total: number, steps: { earnPercent: number; doneAt?: number }[]): number {
  const percent = steps.reduce((sum, s) => sum + (s.doneAt ? s.earnPercent : 0), 0);
  return percent >= 99.995 ? total : amountFor(total, percent);
}

/**
 * A missed payment: 50% of escrow is the fine, split half to the seller and
 * half to the platform; the other 50% goes back to the buyer.
 */
export function penaltySplit(escrow: number) {
  const fine = Math.round(escrow / 2);
  const fineToSeller = Math.round(fine / 2);
  return { fineToSeller, fineToPlatform: fine - fineToSeller, toBuyer: escrow - fine };
}

/**
 * Demo money for each part of escrow paid out, so demo never turns real by
 * changing hands. When the parts are the whole escrow the last part takes
 * any rounding left over; otherwise (a fine kept by the platform) each part
 * takes its proportional share.
 */
export function demoShares(escrowDemo: number, escrow: number, parts: number[]): number[] {
  let left = Math.max(0, escrowDemo);
  const whole = parts.reduce((sum, p) => sum + p, 0) === escrow;
  const last = parts.length - 1;
  return parts.map((part, i) => {
    if (escrow <= 0 || part <= 0 || left <= 0) return 0;
    const share = whole && i === last ? Math.min(left, part) : Math.min(left, part, Math.round((escrowDemo * part) / escrow));
    left -= share;
    return share;
  });
}

/** The next step that is not done yet, or -1 when all are. */
export function nextStepIndex(steps: { doneAt?: number }[]): number {
  return steps.findIndex((s) => !s.doneAt);
}
