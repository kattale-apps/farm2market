/**
 * Wallet Service (Frontend Wrapper)
 *
 * Provides a convenient frontend interface for wallet operations
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook to get wallet balance for a trader
 */
export function useWalletBalance(userId: Id<"users">) {
  const walletData = useQuery(api.wallet.getWalletBalance, {
    traderId: userId,
  });

  return {
    balance: walletData
      ? walletData.capitalBalance + walletData.profitBalance
      : 0,
    capital: walletData?.capitalBalance ?? 0,
    profit: walletData?.profitBalance ?? 0,
    lockedCapital: walletData?.lockedCapital ?? 0,
    availableCapital: walletData?.availableCapital ?? 0,
    exposure: walletData?.exposure ?? 0,
    spendCap: walletData?.spendCap ?? 0,
    remainingCapacity: walletData?.remainingCapacity ?? 0,
    loading: walletData === undefined,
  };
}

/**
 * Wallet ledger hook
 *
 * ⚠️ Disabled until backend support exists
 */
export function useWalletLedger() {
  return {
    entries: [],
    loading: false,
  };
}

/**
 * Hook to get trader commission percentage (admin-only)
 */
export function useTraderCommission(userId: Id<"users">) {
  const commission = useQuery(
    api.admin.getTraderCommissionPercentageQuery,
    { adminId: userId }
  );

  return {
    percentage: commission?.commissionPercentage ?? 0,
    loading: commission === undefined,
  };
}

/**
 * Format UGX currency
 */
export function formatUGX(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
  }).format(amount);
}

/**
 * Calculate commission amount
 */
export function calculateCommission(
  purchaseAmount: number,
  commissionPercentage: number
): number {
  if (commissionPercentage <= 0) return 0;
  return (purchaseAmount * commissionPercentage) / 100;
}
