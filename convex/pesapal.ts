/**
 * Pesapal Payment Integration
 * 
 * Handles Pesapal API integration for wallet deposits
 * - Authentication with Pesapal API
 * - Payment initiation
 * - Payment status verification
 * - Webhook/callback handling
 */

import { v } from "convex/values";
import { action, internalAction, mutation, internalMutation, query, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { generateUTID, getUgandaTime } from "./utils";
import { checkPilotMode } from "./pilotMode";

// Pesapal API Configuration
// Note: Environment variables must be set in Convex Dashboard → Settings → Environment Variables
const PESAPAL_ENV = process.env.PESAPAL_ENV || "sandbox";
const PESAPAL_BASE_URL = PESAPAL_ENV === "production" 
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3"; // Sandbox URL for Pesapal v3

// Get credentials from environment variables (required)
// Set these in Convex Dashboard → Settings → Environment Variables
const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;

// Optional: IPN Notification ID (if you've registered an IPN URL with Pesapal)
// Get this by registering an IPN URL in your Pesapal dashboard
const PESAPAL_NOTIFICATION_ID = process.env.PESAPAL_NOTIFICATION_ID;

// Fallback to defaults only if not in production (for development/testing)
// In production, these MUST be set as environment variables
const FALLBACK_CONSUMER_KEY = PESAPAL_ENV !== "production" ? "1DDecquMxaWUxGjWg+g3SQSkgRRmV3hs" : undefined;
const FALLBACK_CONSUMER_SECRET = PESAPAL_ENV !== "production" ? "WpmXyvPsYE872GO7WY/wjpoSrm8=" : undefined;

const ACTUAL_CONSUMER_KEY = PESAPAL_CONSUMER_KEY || FALLBACK_CONSUMER_KEY;
const ACTUAL_CONSUMER_SECRET = PESAPAL_CONSUMER_SECRET || FALLBACK_CONSUMER_SECRET;

/**
 * Get Pesapal access token
 * This is a Convex action because it needs to make external HTTP requests
 * Internal helper function to avoid circular references
 */
export const getPesapalAccessToken = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Validate credentials are present
      if (!ACTUAL_CONSUMER_KEY || !ACTUAL_CONSUMER_SECRET) {
        throw new Error(
          "Pesapal credentials are missing. " +
          "Please set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables in Convex Dashboard → Settings → Environment Variables. " +
          `Current environment: ${PESAPAL_ENV}, Base URL: ${PESAPAL_BASE_URL}`
        );
      }

      const response = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          consumer_key: ACTUAL_CONSUMER_KEY,
          consumer_secret: ACTUAL_CONSUMER_SECRET,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Pesapal authentication failed: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage += ` - ${errorData.error?.message || errorData.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Handle different possible response formats
      // Pesapal v3 typically returns: { token: "...", expires_in: 3600 }
      // But some versions might use: { access_token: "...", expires_in: 3600 }
      const token = data.token || data.access_token || data.accessToken || data.access_token;
      const expiresIn = data.expires_in || data.expiresIn || 3600;

      if (!token) {
        // Log the full response for debugging
        console.error("Pesapal token response:", JSON.stringify(data, null, 2));
        throw new Error(
          `Invalid token response from Pesapal. Expected 'token' or 'access_token' field. ` +
          `Received: ${Object.keys(data).join(", ")}. ` +
          `Please check your Pesapal credentials and API endpoint.`
        );
      }

      // Validate token is a non-empty string
      if (typeof token !== "string" || token.trim().length === 0) {
        throw new Error(`Invalid token format received from Pesapal: ${typeof token}`);
      }

      return {
        token: token.trim(),
        expiresIn: expiresIn,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Pesapal access token: ${error.message}`);
    }
  },
});

/**
 * Initiate Pesapal payment
 * Creates a payment transaction and returns Pesapal redirect URL
 */
export const initiatePesapalPayment = action({
  args: {
    userId: v.id("users"),
    userRole: v.union(v.literal("trader"), v.literal("buyer")),
    amount: v.number(),
    currency: v.string(),
    callbackUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ transactionId: any; orderTrackingId: string; redirectUrl: string }> => {
    // Get access token
    const { token }: { token: string; expiresIn: number } = await ctx.runAction(internal.pesapal.getPesapalAccessToken, {});

    // Get user details
    const user: { id: any; email: string; role: string; alias: string } | null = await ctx.runQuery(api.pesapal.getUserDetails, { userId: args.userId });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== args.userRole) {
      throw new Error(`User role mismatch. Expected ${args.userRole}, got ${user.role}`);
    }

    // Generate unique order tracking ID
    const orderTrackingId = `F2M-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Prepare payment request according to Pesapal API v3 format
    // Note: notification_id is omitted - we use callback_url for payment confirmation
    // If IPN webhooks are needed in the future, register an IPN URL first and use its ID here
    // Build billing address, only including non-empty fields
    const billingAddress: any = {
      email_address: user.email,
      country_code: "UG",
      first_name: user.alias || "User",
    };
    
    // Only add optional fields if they have values (Pesapal may reject empty strings)
    // For now, we'll keep the structure minimal as required fields are present

    const paymentRequest: any = {
      id: orderTrackingId,
      currency: args.currency || "UGX",
      amount: args.amount,
      description: `Wallet deposit for ${args.userRole}`,
      callback_url: args.callbackUrl,
      cancellation_url: args.cancelUrl,
      billing_address: billingAddress,
    };

    // Add notification_id only if provided via environment variable
    // This is required if Pesapal API v3 mandates IPN registration
    // To get notification_id: Register an IPN URL in Pesapal dashboard and copy the ID
    if (PESAPAL_NOTIFICATION_ID && PESAPAL_NOTIFICATION_ID.trim() !== "") {
      paymentRequest.notification_id = PESAPAL_NOTIFICATION_ID.trim();
    }

    // Log full request for debugging (to see exact structure being sent)
    console.log("Pesapal payment request (full):", JSON.stringify(paymentRequest, null, 2));

    // Validate token before using
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new Error("Invalid access token received from Pesapal authentication");
    }

    // Submit payment request to Pesapal
    const response: Response = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `Pesapal payment initiation failed: ${response.status}`;
      
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          const errorCode = errorData.error.code || "";
          const errorMsg = errorData.error.message || "";
          
          // Special handling for IPN URL ID errors
          if (errorCode.includes("invalid_api_request_parameters") && 
              errorMsg.includes("Invalid IPN URL ID")) {
            errorMessage = `Pesapal requires an IPN (Instant Payment Notification) URL to be registered. ` +
              `Error: ${errorMsg}. ` +
              `To fix this: ` +
              `1. Register an IPN URL in your Pesapal dashboard ` +
              `2. Get the notification_id from Pesapal ` +
              `3. Set PESAPAL_NOTIFICATION_ID environment variable in Convex Dashboard. ` +
              `See docs/PESAPAL_SETUP.md for detailed instructions.`;
          } else {
            errorMessage = `Pesapal payment error: ${errorMsg || errorCode || JSON.stringify(errorData.error)}`;
          }
        } else {
          errorMessage += ` - ${errorData.message || responseText}`;
        }
      } catch {
        errorMessage += ` - ${responseText}`;
      }
      
      throw new Error(errorMessage);
    }

    // Parse JSON response
    let paymentData: any;
    try {
      paymentData = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(
        `Pesapal returned invalid JSON response: ${responseText.substring(0, 500)}. ` +
        `Status: ${response.status}, Content-Type: ${response.headers.get("content-type")}`
      );
    }

    // Log full response for debugging
    console.log("Pesapal payment response:", JSON.stringify(paymentData, null, 2));

    // Extract redirect URL from response (Pesapal v3 may use different field names)
    // Try multiple possible field names based on Pesapal API documentation
    // Pesapal v3 typically returns: { redirect_url: "...", order_tracking_id: "..." }
    let redirectUrl = paymentData.redirect_url || 
                   paymentData.redirectUrl || 
                   paymentData.payment_url || 
                   paymentData.paymentUrl || 
                   paymentData.link || 
                   paymentData.url ||
                   paymentData.data?.redirect_url ||
                   paymentData.data?.redirectUrl ||
                   paymentData.data?.payment_url ||
                   paymentData.result?.redirect_url ||
                   paymentData.result?.redirectUrl ||
                   paymentData.instructions?.redirect_url ||
                   "";

    // If no redirect URL found, try to construct it from order tracking ID
    // Some Pesapal implementations return the order tracking ID and we construct the URL
    if (!redirectUrl && (paymentData.order_tracking_id || paymentData.orderTrackingId || orderTrackingId)) {
      const trackingId = paymentData.order_tracking_id || paymentData.orderTrackingId || orderTrackingId;
      // Pesapal v3 redirect URL format might be: https://cybqa.pesapal.com/pesapalv3/api/RedirectToMobileCheckout/?OrderTrackingId=...
      redirectUrl = `${PESAPAL_BASE_URL}/api/RedirectToMobileCheckout/?OrderTrackingId=${trackingId}`;
    }

    // Validate redirect URL is present and is a valid URL
    if (!redirectUrl || typeof redirectUrl !== "string" || redirectUrl.trim() === "") {
      const responseKeys = Object.keys(paymentData).join(", ");
      const responseStr = JSON.stringify(paymentData, null, 2);
      
      // Check if this is a successful response but with different structure
      // Pesapal might return success with order_tracking_id but redirect URL in a different format
      const actualTrackingId = paymentData.order_tracking_id || paymentData.orderTrackingId || orderTrackingId;
      
      if (actualTrackingId) {
        // Payment was created - try constructed URL as fallback
        const constructedUrl = `${PESAPAL_BASE_URL}/api/RedirectToMobileCheckout/?OrderTrackingId=${actualTrackingId}`;
        
        // Log warning but use constructed URL
        console.warn(
          `Pesapal payment created (orderTrackingId: ${actualTrackingId}) but redirect URL not in response. ` +
          `Using constructed URL: ${constructedUrl}. ` +
          `Response keys: ${responseKeys}`
        );
        
        // Use constructed URL as fallback
        redirectUrl = constructedUrl;
      } else {
        // No order tracking ID either - this is a real problem
        throw new Error(
          `Pesapal payment response missing both redirect URL and order tracking ID. ` +
          `Response contains keys: ${responseKeys}. ` +
          `Full response: ${responseStr.substring(0, 1000)}... ` +
          `Please check Pesapal API v3 documentation. Status: ${response.status}`
        );
      }
    }

    // Validate it's a valid URL format
    try {
      new URL(redirectUrl);
    } catch {
      throw new Error(
        `Pesapal returned invalid redirect URL format: ${redirectUrl}. ` +
        `Expected a valid HTTP/HTTPS URL.`
      );
    }

    // Create payment transaction record
    const transactionId: any = await ctx.runMutation(internal.pesapal.createPaymentTransaction, {
      userId: args.userId,
      userRole: args.userRole,
      amount: args.amount,
      currency: args.currency || "UGX",
      pesapalOrderTrackingId: orderTrackingId,
      redirectUrl: redirectUrl,
      callbackUrl: args.callbackUrl,
    });

    return {
      transactionId,
      orderTrackingId,
      redirectUrl: redirectUrl,
    };
  },
});

/**
 * Get user details (helper query)
 * Public query for use by wrapper actions
 */
export const getUserDetails = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    return {
      id: user._id,
      email: user.email,
      role: user.role,
      alias: user.alias,
    };
  },
});

/**
 * Create payment transaction record
 * Internal helper function to avoid circular references
 */
export const createPaymentTransaction = internalMutation({
  args: {
    userId: v.id("users"),
    userRole: v.union(v.literal("trader"), v.literal("buyer")),
    amount: v.number(),
    currency: v.string(),
    pesapalOrderTrackingId: v.string(),
    redirectUrl: v.string(),
    callbackUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert("paymentTransactions", {
      userId: args.userId,
      userRole: args.userRole,
      amount: args.amount,
      currency: args.currency,
      pesapalOrderTrackingId: args.pesapalOrderTrackingId,
      redirectUrl: args.redirectUrl,
      callbackUrl: args.callbackUrl,
      status: "pending",
      createdAt: getUgandaTime(),
    });

    return transactionId;
  },
});

/**
 * Verify payment status from Pesapal
 * Called after user returns from Pesapal payment page
 */
export const verifyPesapalPayment = action({
  args: {
    orderTrackingId: v.string(),
  },
  handler: async (ctx, args): Promise<{ status: string; orderTrackingId: string }> => {
    // Get access token
    const { token }: { token: string; expiresIn: number } = await ctx.runAction(internal.pesapal.getPesapalAccessToken, {});

    // Validate token
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new Error("Invalid access token received from Pesapal authentication");
    }

    // Get payment status from Pesapal
    const response: Response = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${args.orderTrackingId}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Pesapal payment verification failed: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = `Pesapal verification error: ${errorData.error.message || errorData.error.code || JSON.stringify(errorData.error)}`;
        } else {
          errorMessage += ` - ${errorData.message || errorText}`;
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const paymentStatus: any = await response.json();

    // Update payment transaction and complete wallet deposit
    await ctx.runMutation(internal.pesapal.completePaymentTransaction, {
      orderTrackingId: args.orderTrackingId,
      paymentStatus: paymentStatus,
    });

    return {
      status: paymentStatus.payment_status_description || paymentStatus.status || "unknown",
      orderTrackingId: args.orderTrackingId,
    };
  },
});

/**
 * Complete payment transaction and credit wallet
 * Internal helper function to avoid circular references
 */
export const completePaymentTransaction = internalMutation({
  args: {
    orderTrackingId: v.string(),
    paymentStatus: v.any(),
  },
  handler: async (ctx, args) => {
    // Find payment transaction
    const transaction = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_pesapal_order", (q) => q.eq("pesapalOrderTrackingId", args.orderTrackingId))
      .first();

    if (!transaction) {
      throw new Error(`Payment transaction not found: ${args.orderTrackingId}`);
    }

    // Check if already completed
    if (transaction.status === "completed") {
      return { alreadyCompleted: true, walletDepositUtid: transaction.walletDepositUtid };
    }

    // Determine payment status
    const pesapalStatus = args.paymentStatus.payment_status_description || args.paymentStatus.status || "";
    const isCompleted = pesapalStatus.toLowerCase().includes("completed") || 
                       pesapalStatus.toLowerCase() === "completed" ||
                       args.paymentStatus.payment_status_code === "1";

    if (!isCompleted) {
      // Payment not completed - update status only
      await ctx.db.patch(transaction._id, {
        status: pesapalStatus.toLowerCase().includes("failed") ? "failed" : "cancelled",
        completedAt: Date.now(),
        metadata: {
          pesapalResponse: args.paymentStatus,
        },
      });
      return { completed: false, status: transaction.status };
    }

    // Payment completed - credit wallet
    // Check pilot mode (deposit moves money)
    await checkPilotMode(ctx);

    // Generate UTID for wallet deposit
    const depositUtid = generateUTID(transaction.userRole);

    // Get current wallet balance
    const currentEntries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", transaction.userId))
      .order("desc")
      .first();

    const balanceAfter = currentEntries
      ? currentEntries.balanceAfter + transaction.amount
      : transaction.amount;

    // Create wallet deposit entry
    await ctx.db.insert("walletLedger", {
      userId: transaction.userId,
      utid: depositUtid,
      type: "capital_deposit",
      amount: transaction.amount,
      balanceAfter,
      timestamp: getUgandaTime(),
      metadata: {
        source: "pesapal_payment",
        pesapalOrderTrackingId: args.orderTrackingId,
        paymentReference: args.paymentStatus.payment_reference || null,
      },
    });

    // Update payment transaction
    await ctx.db.patch(transaction._id, {
      status: "completed",
      walletDepositUtid: depositUtid,
      pesapalPaymentReference: args.paymentStatus.payment_reference || null,
      completedAt: Date.now(),
      metadata: {
        pesapalResponse: args.paymentStatus,
        walletBalanceAfter: balanceAfter,
      },
    });

    return {
      completed: true,
      walletDepositUtid: depositUtid,
      balanceAfter,
    };
  },
});

/**
 * Get payment transaction status
 */
export const getPaymentTransactionStatus = query({
  args: {
    transactionId: v.id("paymentTransactions"),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) {
      return null;
    }

    return {
      transactionId: transaction._id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      pesapalOrderTrackingId: transaction.pesapalOrderTrackingId,
      walletDepositUtid: transaction.walletDepositUtid,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    };
  },
});

/**
 * Get user's payment transactions
 */
export const getUserPaymentTransactions = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return transactions.map((t) => ({
      transactionId: t._id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      pesapalOrderTrackingId: t.pesapalOrderTrackingId,
      walletDepositUtid: t.walletDepositUtid,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }));
  },
});

/**
 * Webhook handler for Pesapal payment notifications
 * This is called by Pesapal when payment status changes
 */
export const handlePesapalWebhook = action({
  args: {
    orderTrackingId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      // Verify payment status from Pesapal
      const result = await ctx.runAction(api.pesapal.verifyPesapalPayment, {
        orderTrackingId: args.orderTrackingId,
      });

      return {
        success: true,
        message: `Payment ${result.status} for order ${args.orderTrackingId}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
      };
    }
  },
});

/**
 * Wrapper action for trader deposits via Pesapal
 */
export const initiateTraderDeposit = action({
  args: {
    traderId: v.id("users"),
    amount: v.number(),
    currency: v.optional(v.string()),
    callbackUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ transactionId: any; orderTrackingId: string; redirectUrl: string }> => {
    // Verify user is a trader
    const user = await ctx.runQuery(api.pesapal.getUserDetails, { userId: args.traderId });
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    return await ctx.runAction(api.pesapal.initiatePesapalPayment, {
      userId: args.traderId,
      userRole: "trader",
      amount: args.amount,
      currency: args.currency || "UGX",
      callbackUrl: args.callbackUrl,
      cancelUrl: args.cancelUrl,
    });
  },
});

/**
 * Wrapper action for buyer deposits via Pesapal
 */
export const initiateBuyerDeposit = action({
  args: {
    buyerId: v.id("users"),
    amount: v.number(),
    currency: v.optional(v.string()),
    callbackUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ transactionId: any; orderTrackingId: string; redirectUrl: string }> => {
    // Verify user is a buyer
    const user = await ctx.runQuery(api.pesapal.getUserDetails, { userId: args.buyerId });
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    return await ctx.runAction(api.pesapal.initiatePesapalPayment, {
      userId: args.buyerId,
      userRole: "buyer",
      amount: args.amount,
      currency: args.currency || "UGX",
      callbackUrl: args.callbackUrl,
      cancelUrl: args.cancelUrl,
    });
  },
});
