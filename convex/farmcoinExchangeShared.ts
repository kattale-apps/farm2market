/**
 * FarmCoin exchange and wallet: pure rules shared by the Convex functions,
 * the UI and the unit tests. Nothing here touches the database.
 *
 * - Holders sell FarmCoin at one rate set by the super admin or the Finance
 *   admin. A platform fee (a percentage, also set by them) comes out of the
 *   seller's proceeds.
 * - Sell offers form a queue. A purchase fills from the oldest offer first
 *   and may take coins from several sellers; if the queue runs short the
 *   buyer gets what is there and pays only for that.
 * - Every user's wallet holds real and demo money (convex/walletSplitShared.ts).
 *   Only real money can buy FarmCoin or be cashed out.
 */

export type FarmcoinAccount = "farmer" | "trader" | "sentify" | "buyer_reward";

export const FARMCOIN_ACCOUNTS: FarmcoinAccount[] = ["farmer", "trader", "sentify", "buyer_reward"];

export const ACCOUNT_LABELS: Record<FarmcoinAccount, string> = {
  farmer: "Earned FarmCoin",
  trader: "Trading FarmCoin",
  sentify: "Sentify receipts",
  buyer_reward: "Buyer rewards",
};

/** Cash-outs are paid by hand today; this is the promise shown to users. */
export const CASHOUT_NOTICE = "Cash-outs take up to 48 hours.";

export const MAX_FEE_PERCENT = 50;

export type ExchangeSettings = {
  rateUGX: number; // UGX a buyer pays per FarmCoin. 0 means the exchange is closed.
  feePercent: number; // Platform fee, taken from the seller's proceeds.
  minSellCoins: number;
  minBuyCoins: number;
  minCashoutUGX: number;
};

export const DEFAULT_EXCHANGE_SETTINGS: ExchangeSettings = {
  rateUGX: 0,
  feePercent: 0,
  minSellCoins: 1,
  minBuyCoins: 1,
  minCashoutUGX: 1000,
};

/** Returns the first problem with a settings change, or null. */
export function validateExchangeSettings(s: ExchangeSettings): string | null {
  if (!Number.isInteger(s.rateUGX) || s.rateUGX < 0) return "The rate must be a whole number of UGX, 0 or more.";
  if (!Number.isFinite(s.feePercent) || s.feePercent < 0 || s.feePercent > MAX_FEE_PERCENT) {
    return `The platform fee must be between 0% and ${MAX_FEE_PERCENT}%.`;
  }
  if (!Number.isInteger(s.minSellCoins) || s.minSellCoins < 1) return "The minimum sell amount must be at least 1 FarmCoin.";
  if (!Number.isInteger(s.minBuyCoins) || s.minBuyCoins < 1) return "The minimum purchase must be at least 1 FarmCoin.";
  if (!Number.isInteger(s.minCashoutUGX) || s.minCashoutUGX < 1) return "The minimum cash-out must be at least UGX 1.";
  return null;
}

/** What one fill is worth. UGX amounts are whole shillings. */
export function priceFill(coins: number, rateUGX: number, feePercent: number) {
  const grossUGX = coins * rateUGX;
  const feeUGX = Math.round((grossUGX * feePercent) / 100);
  return { grossUGX, feeUGX, netUGX: grossUGX - feeUGX };
}

export type QueuedOffer = { id: string; sellerId: string; coinsRemaining: number };
export type PlannedFill = { offerId: string; sellerId: string; coins: number };

/**
 * Takes coins from the queue, oldest offer first, skipping the buyer's own
 * offers. `offers` must already be in queue order.
 */
export function planFills(offers: QueuedOffer[], buyerId: string, coinsWanted: number): PlannedFill[] {
  const fills: PlannedFill[] = [];
  let left = coinsWanted;
  for (const offer of offers) {
    if (left <= 0) break;
    if (offer.sellerId === buyerId || offer.coinsRemaining <= 0) continue;
    const coins = Math.min(left, offer.coinsRemaining);
    fills.push({ offerId: offer.id, sellerId: offer.sellerId, coins });
    left -= coins;
  }
  return fills;
}

export type MobileNetwork = "mtn" | "airtel";

/** Best guess at the network from a +256 number, to pre-select it in the form. */
export function guessNetwork(phone: string): MobileNetwork | null {
  const m = /^\+2567(\d)/.exec(phone);
  if (!m) return null;
  if (["6", "7", "8"].includes(m[1])) return "mtn";
  if (["0", "4", "5"].includes(m[1])) return "airtel";
  return null;
}
