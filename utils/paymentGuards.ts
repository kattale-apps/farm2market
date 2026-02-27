/**
 * Payment Guards
 * 
 * Core utilities for payment verification and access control.
 * SOURCE OF TRUTH for payment status checks.
 * 
 * Rule: NEVER unlock features based on frontend state.
 * Always verify payment status server-side.
 */

export interface Payment {
  payableAmount: number;
  billedAmount: number;
  status: "pending" | "paid" | "failed";
  pesapalTrackingId?: string;
}

/**
 * Check if a payment has been confirmed
 * 
 * @param payment - Payment record from database
 * @returns true if payment status is "paid"
 */
export function hasPaid(payment: Payment | null | undefined): boolean {
  return payment?.status === "paid";
}

/**
 * Check if payment is still pending
 * 
 * @param payment - Payment record from database
 * @returns true if payment status is "pending"
 */
export function isPending(payment: Payment | null | undefined): boolean {
  return payment?.status === "pending";
}

/**
 * Check if payment has failed
 * 
 * @param payment - Payment record from database
 * @returns true if payment status is "failed"
 */
export function hasFailed(payment: Payment | null | undefined): boolean {
  return payment?.status === "failed";
}

/**
 * Determine if user can perform action without payment
 * 
 * @param payment - Payment record (can be null)
 * @returns true if user has already paid or payment is not required
 */
export function canProceed(payment: Payment | null | undefined): boolean {
  if (!payment) {
    // No payment record means feature might be free
    return true;
  }
  return hasPaid(payment);
}

/**
 * Get human-readable payment label
 * 
 * @param status - Payment status
 * @returns Label for UI display
 */
export function getPaymentLabel(status: "pending" | "paid" | "failed" | undefined): string {
  if (!status) return "Amount to Pay";
  
  switch (status) {
    case "pending":
      return "Amount to Pay";
    case "paid":
      return "Amount Paid";
    case "failed":
      return "Payment Failed";
    default:
      return "Amount to Pay";
  }
}

/**
 * Calculate total owed across multiple payments
 * 
 * @param payments - Array of payment records
 * @returns Sum of all amounts owed (payableAmount - billedAmount)
 */
export function calculateTotalOwed(payments: Payment[]): number {
  return payments.reduce((total, payment) => {
    if (payment.status !== "paid") {
      return total + (payment.payableAmount - payment.billedAmount);
    }
    return total;
  }, 0);
}

/**
 * Validation: User must have paid before posting image
 * Used server-side to enforce payment gating
 * 
 * @param payment - Payment record
 * @throws Error if payment not confirmed
 */
export function requirePaymentForImagePost(payment: Payment | null | undefined): void {
  if (!hasPaid(payment)) {
    throw new Error("Payment required to post images");
  }
}

/**
 * Validation: User must have paid before sending image message
 * Used server-side to enforce payment gating
 * 
 * @param payment - Payment record
 * @throws Error if payment not confirmed
 */
export function requirePaymentForImageMessage(payment: Payment | null | undefined): void {
  if (!hasPaid(payment)) {
    throw new Error("Payment required to send images in messages");
  }
}
