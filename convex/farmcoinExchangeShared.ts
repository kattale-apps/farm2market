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
 * - Every user's wallet has a cashable pocket, fed only by FarmCoin sale
 *   proceeds and Wallet top-ups, and spent on FarmCoin and cash-outs.
 * - The pocket is kept out of the running `balanceAfter` in walletLedger.
 *   Existing flows (produce purchases, fees, trader buys) spend from that
 *   running balance, which also holds auto-restored demo capital and money
 *   earned from it. Keeping the two apart means no shilling can be both
 *   spent on produce and cashed out, and demo money never reaches a phone.
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

/** Pocket entry types, with the direction each moves cashable money. */
export const POCKET_SIGN: Record<string, 1 | -1> = {
  wallet_topup: 1,
  farmcoin_sale_credit: 1,
  cashout_release: 1,
  farmcoin_purchase_debit: -1,
  cashout_hold: -1,
};

export function isPocketEntry(type: string): boolean {
  return type in POCKET_SIGN;
}

export type WalletEntry = { type: string; amount: number; metadata?: any };

export type WalletSummary = {
  availableUGX: number; // The cashable pocket; FarmCoin purchases are paid from it too.
  demoCapitalUGX: number; // Demo capital ever auto-restored into the trading balance.
};

/** Adds up a user's wallet ledger. Order does not matter. */
export function summarizeWallet(entries: WalletEntry[]): WalletSummary {
  let available = 0;
  let demo = 0;
  for (const entry of entries) {
    const sign = POCKET_SIGN[entry.type];
    if (sign) available += sign * entry.amount;
    else if (entry.type === "capital_deposit" && entry.metadata?.source === "auto_restore_demo_capital") demo += entry.amount;
  }
  return { availableUGX: Math.max(0, available), demoCapitalUGX: demo };
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
