/**
 * Wallet Service (Frontend Wrapper)
 * 
 * Provides a convenient frontend interface for wallet operations
 * Wraps Convex wallet mutations and queries
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook to get wallet balance for a trader
 * Note: This query requires the user to be a trader
 */
export function useWalletBalance(userId: Id<"users">) {
  const walletData = useQuery(api.wallet.getWalletBalance, { traderId: userId });
  
  return {
    balance: walletData ? walletData.capitalBalance + walletData.profitBalance : 0,
    capital: walletData?.capitalBalance || 0,
    profit: walletData?.profitBalance || 0,
    lockedCapital: walletData?.lockedCapital || 0,
    availableCapital: walletData?.availableCapital || 0,
    exposure: walletData?.exposure || 0,
    spendCap: walletData?.spendCap || 0,
    remainingCapacity: walletData?.remainingCapacity || 0,
    loading: walletData === undefined,
  };
}

/**
 * Hook to get wallet ledger entries (admin only, for specific UTID)
 * For user's own ledger, we'd need a new query - using balance for now
 */
export function useWalletLedger(userId: Id<"users">, utid?: string) {
  // Admin can query by UTID, regular users would need a different query
  const ledger = useQuery(
    api.introspection.getWalletLedgerByUTID,
    utid ? { adminId: userId, utid } : "skip"
  );
  
  return {
    entries: ledger || [],
    loading: ledger === undefined,
  };
}

/**
 * Hook to get commission information for a trader
 */
export function useTraderCommission(userId: Id<"users">) {
  const commissionPercentage = useQuery(api.admin.getTraderCommissionPercentageQuery, { adminId: userId });
  
  return {
    percentage: commissionPercentage?.commissionPercentage || 0,
    loading: commissionPercentage === undefined,
  };
}

/**
 * Format UGX currency
 */
export function formatUGX(amount: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
}

/**
 * Calculate commission amount from purchase price
 */
export function calculateCommission(purchaseAmount: number, commissionPercentage: number): number {
  if (commissionPercentage <= 0) return 0;
  return (purchaseAmount * commissionPercentage) / 100;
}
