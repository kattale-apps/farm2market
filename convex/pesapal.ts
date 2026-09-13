/**
 * Pesapal Payment Integration
 *
 * Handles Pesapal API integration for wallet deposits
 * - Authentication with Pesapal API
 * - Payment initiation
 * - Payment status verification
 * - Webhook/callback handling
 */

import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { checkPilotMode } from "./pilotMode";
import { generateUTID, getUgandaTime } from "./utils";
import { Id } from "./_generated/dataModel";

// Pesapal API Configuration
// Note: Environment variables must be set in Convex Dashboard → Settings → Environment Variables
const PESAPAL_ENV = process.env.PESAPAL_ENV || "sandbox";
const PESAPAL_BASE_URL =
  PESAPAL_ENV === "production"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3"; // Sandbox URL for Pesapal v3

// Get credentials from environment variables (required)
// Set these in Convex Dashboard → Settings → Environment Variables
const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;

// Optional: IPN Notification ID (if you've registered an IPN URL with Pesapal)
// Get this by registering an IPN URL in your Pesapal dashboard
const PESAPAL_NOTIFICATION_ID = process.env.PESAPAL_NOTIFICATION_ID;

const FALLBACK_BILLING_EMAIL = "kattaleglobal@gmail.com";

const ACTUAL_CONSUMER_KEY = PESAPAL_CONSUMER_KEY;
const ACTUAL_CONSUMER_SECRET = PESAPAL_CONSUMER_SECRET;

function extractIdFromUrl(
  urlValue: string | undefined,
  key: string,
): string | null {
  if (!urlValue || typeof urlValue !== "string") return null;

  try {
    const parsed = new URL(urlValue);
    const direct = parsed.searchParams.get(key);
    if (direct) return direct;

    const returnTo = parsed.searchParams.get("returnTo");
    if (!returnTo) return null;

    const nested = new URL(returnTo);
    return nested.searchParams.get(key);
  } catch {
    return null;
  }
}

/**
 * Every user-facing Pesapal failure is raised as a ConvexError.
 *
 * Convex redacts plain `Error` messages on production deployments — the client
 * only ever sees "Server Error", which is what made these failures impossible
 * to diagnose from the buyer dashboard. ConvexError data survives that
 * redaction, so the real Pesapal reason reaches the UI.
 */
export function pesapalError(
  code: string,
  message: string,
  extra?: Record<string, any>,
): ConvexError<any> {
  return new ConvexError({ code, message, ...(extra || {}) });
}

/**
 * Pesapal validates billing names: generated aliases such as "buyer_snd6uu"
 * are rejected because of the underscore and digits. Strip anything that is
 * not a letter, space, apostrophe or hyphen and fall back to a safe default.
 */
function sanitizeBillingName(
  value: string | undefined,
  fallback: string,
): string {
  const cleaned = (value || "")
    .replace(/_+/g, " ")
    .replace(/[^A-Za-z '-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 40) : fallback;
}

/**
 * Pesapal expects a phone number as digits only.
 */
function sanitizePhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits.length >= 9 ? digits : undefined;
}

/**
 * Pesapal rejects amounts that are not positive numbers with at most two
 * decimal places.
 */
function normalizeAmount(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw pesapalError(
      "INVALID_AMOUNT",
      "Enter a valid amount greater than zero before paying.",
    );
  }
  return Math.round(amount * 100) / 100;
}

/**
 * callback_url / cancellation_url must be absolute, publicly reachable http(s)
 * URLs. Native shells (Capacitor) report origins like "capacitor://localhost",
 * which Pesapal rejects outright — fall back to the configured public app URL.
 */
function normalizeReturnUrl(value: string, label: string): string {
  const fallbackBase = (process.env.PESAPAL_APP_BASE_URL || "").replace(
    /\/+$/,
    "",
  );

  const parse = (candidate: string): URL | null => {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const direct = parse(value);
  const isLoopback =
    !!direct &&
    (direct.hostname === "localhost" || direct.hostname === "127.0.0.1");

  // A native shell (Capacitor) reports "http://localhost", which Pesapal cannot
  // redirect a phone browser back to. Rewrite it onto the deployed site when
  // one is configured; otherwise let it through so local development still
  // works against the sandbox.
  if (direct && !isLoopback) return direct.toString();

  if (fallbackBase) {
    const path = direct
      ? `${direct.pathname}${direct.search}`
      : value.startsWith("/")
        ? value
        : "/";
    const rebuilt = parse(`${fallbackBase}${path}`);
    if (rebuilt) return rebuilt.toString();
  }

  if (direct) return direct.toString();

  throw pesapalError(
    "INVALID_RETURN_URL",
    `Cannot start the payment because the ${label} (${value || "empty"}) is not an http(s) address. ` +
      `Set PESAPAL_APP_BASE_URL in the Convex environment variables to your deployed site URL.`,
  );
}

/**
 * Single place where a Pesapal order is submitted.
 *
 * Every caller (buyer deposit, trader deposit, extension-work form payment)
 * goes through this so they cannot drift apart again. It returns *Pesapal's*
 * order tracking id — the value Pesapal echoes back on the callback and the
 * only value GetTransactionStatus accepts — alongside our own merchant
 * reference.
 */
async function submitPesapalOrder(
  ctx: any,
  opts: {
    email?: string;
    phone?: string;
    firstName?: string;
    amount: number;
    currency?: string;
    description: string;
    callbackUrl: string;
    cancelUrl: string;
  },
): Promise<{
  merchantReference: string;
  orderTrackingId: string;
  redirectUrl: string;
}> {
  const amount = normalizeAmount(opts.amount);
  const callbackUrl = normalizeReturnUrl(opts.callbackUrl, "callback URL");
  const cancelUrl = normalizeReturnUrl(opts.cancelUrl, "cancel URL");

  const { token }: { token: string; expiresIn: number } = await ctx.runAction(
    internal.pesapal.getPesapalAccessToken,
    {},
  );
  if (!token || typeof token !== "string" || token.trim() === "") {
    throw pesapalError(
      "PESAPAL_AUTH_FAILED",
      "Pesapal did not return a usable access token.",
    );
  }

  const merchantReference = `F2M-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const phone = sanitizePhone(opts.phone);
  const billingAddress: any = {
    email_address: opts.email || FALLBACK_BILLING_EMAIL,
    country_code: "UG",
    first_name: sanitizeBillingName(opts.firstName, "Farm"),
    last_name: "User",
  };
  if (phone) billingAddress.phone_number = phone;

  const paymentRequest: any = {
    id: merchantReference,
    currency: opts.currency || "UGX",
    amount,
    description: (opts.description || "Farm2Market payment").slice(0, 100),
    callback_url: callbackUrl,
    cancellation_url: cancelUrl,
    billing_address: billingAddress,
  };

  if (PESAPAL_NOTIFICATION_ID && PESAPAL_NOTIFICATION_ID.trim() !== "") {
    paymentRequest.notification_id = PESAPAL_NOTIFICATION_ID.trim();
  } else {
    throw pesapalError(
      "PESAPAL_NOT_CONFIGURED",
      "PESAPAL_NOTIFICATION_ID is not set in this deployment's Convex environment variables. " +
        "Register your IPN URL with Pesapal and add the notification id before taking payments.",
    );
  }

  const response: Response = await fetch(
    `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(paymentRequest),
    },
  );

  const responseText = await response.text();
  let paymentData: any = null;
  try {
    paymentData = JSON.parse(responseText);
  } catch {
    paymentData = null;
  }

  if (!response.ok || paymentData?.error) {
    const err = paymentData?.error;
    const detail =
      err?.message ||
      err?.code ||
      paymentData?.message ||
      responseText.substring(0, 300) ||
      `HTTP ${response.status}`;
    console.error("Pesapal SubmitOrderRequest rejected", {
      status: response.status,
      merchantReference,
      environment: PESAPAL_ENV,
      detail,
    });
    throw pesapalError(
      "PESAPAL_ORDER_REJECTED",
      `Pesapal rejected the payment request: ${detail}`,
      { status: response.status, environment: PESAPAL_ENV },
    );
  }

  // Pesapal's own tracking id. Everything downstream (callback query string,
  // GetTransactionStatus, IPN) uses this and NOT our merchant reference.
  const orderTrackingId: string =
    paymentData?.order_tracking_id ||
    paymentData?.orderTrackingId ||
    paymentData?.data?.order_tracking_id ||
    "";

  if (!orderTrackingId) {
    console.error(
      "Pesapal response missing order_tracking_id:",
      responseText.substring(0, 800),
    );
    throw pesapalError(
      "PESAPAL_NO_TRACKING_ID",
      "Pesapal accepted the order but did not return an order tracking id, so the payment could not be tracked.",
    );
  }

  let redirectUrl: string =
    paymentData?.redirect_url ||
    paymentData?.redirectUrl ||
    paymentData?.data?.redirect_url ||
    paymentData?.response?.redirect_url ||
    "";

  if (!redirectUrl) {
    redirectUrl = `${PESAPAL_BASE_URL}/api/Transactions/RedirectToMobileCheckout?OrderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  }

  try {
    new URL(redirectUrl);
  } catch {
    throw pesapalError(
      "PESAPAL_BAD_REDIRECT",
      `Pesapal returned an unusable checkout link: ${redirectUrl}`,
    );
  }

  return { merchantReference, orderTrackingId, redirectUrl };
}

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
        throw pesapalError(
          "PESAPAL_NOT_CONFIGURED",
          "Pesapal credentials are missing. " +
            "Please set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables in Convex Dashboard → Settings → Environment Variables. " +
            `Current environment: ${PESAPAL_ENV}, Base URL: ${PESAPAL_BASE_URL}`,
        );
      }

      const response = await fetch(
        `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            consumer_key: ACTUAL_CONSUMER_KEY,
            consumer_secret: ACTUAL_CONSUMER_SECRET,
          }),
        },
      );

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
      const token =
        data.token ||
        data.access_token ||
        data.accessToken ||
        data.access_token;
      const expiresIn = data.expires_in || data.expiresIn || 3600;

      if (!token) {
        // Log the full response for debugging
        console.error("Pesapal token response:", JSON.stringify(data, null, 2));
        throw new Error(
          `Invalid token response from Pesapal. Expected 'token' or 'access_token' field. ` +
            `Received: ${Object.keys(data).join(", ")}. ` +
            `Please check your Pesapal credentials and API endpoint.`,
        );
      }

      // Validate token is a non-empty string
      if (typeof token !== "string" || token.trim().length === 0) {
        throw new Error(
          `Invalid token format received from Pesapal: ${typeof token}`,
        );
      }

      return {
        token: token.trim(),
        expiresIn: expiresIn,
      };
    } catch (error: any) {
      if (error instanceof ConvexError) throw error;
      throw pesapalError(
        "PESAPAL_AUTH_FAILED",
        `Failed to get Pesapal access token: ${error?.message || error}`,
      );
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    transactionId: any;
    orderTrackingId: string;
    redirectUrl: string;
  }> => {
    const user: {
      id: any;
      email: string | undefined;
      phoneNumber: string | undefined;
      role: string;
      alias: string;
    } | null = await ctx.runQuery(api.pesapal.getUserDetails, {
      userId: args.userId,
    });
    if (!user) {
      throw pesapalError("USER_NOT_FOUND", "User not found.");
    }

    if (user.role !== args.userRole) {
      throw pesapalError(
        "ROLE_MISMATCH",
        `This account is registered as "${user.role}", so it cannot make a ${args.userRole} deposit.`,
      );
    }

    const { merchantReference, orderTrackingId, redirectUrl } =
      await submitPesapalOrder(ctx, {
        email: user.email,
        phone: user.phoneNumber,
        firstName: user.alias,
        amount: args.amount,
        currency: args.currency || "UGX",
        description: `Wallet deposit for ${args.userRole}`,
        callbackUrl: args.callbackUrl,
        cancelUrl: args.cancelUrl,
      });

    // Create payment transaction record keyed on Pesapal's tracking id, which
    // is what the callback and the IPN webhook hand back to us.
    const transactionId: any = await ctx.runMutation(
      internal.pesapal.createPaymentTransaction,
      {
        userId: args.userId,
        userRole: args.userRole,
        amount: args.amount,
        currency: args.currency || "UGX",
        pesapalOrderTrackingId: orderTrackingId,
        pesapalMerchantReference: merchantReference,
        redirectUrl,
        callbackUrl: args.callbackUrl,
      },
    );

    return {
      transactionId,
      orderTrackingId,
      redirectUrl,
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
      phoneNumber: user.phoneNumber,
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
    pesapalMerchantReference: v.optional(v.string()),
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
      pesapalMerchantReference: args.pesapalMerchantReference,
      redirectUrl: args.redirectUrl,
      callbackUrl: args.callbackUrl,
      status: "pending",
      createdAt: getUgandaTime(),
    });

    return transactionId;
  },
});

/**
 * Create extension-work payment intent.
 */
export const createExtensionWorkPaymentIntent = internalMutation({
  args: {
    orderTrackingId: v.string(),
    merchantReference: v.optional(v.string()),
    memberId: v.id("users"),
    communityId: v.id("communities"),
    formId: v.id("communityForms"),
    amount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const now = getUgandaTime();
    return await ctx.db.insert(
      "extensionWorkPaymentIntents" as any,
      {
        orderTrackingId: args.orderTrackingId,
        merchantReference: args.merchantReference,
        memberId: args.memberId,
        communityId: args.communityId,
        formId: args.formId,
        amount: args.amount,
        currency: args.currency,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      } as any,
    );
  },
});

/**
 * Resolve an extension-work intent from whichever identifier we are handed.
 *
 * Intents created before Pesapal's own tracking id was recorded still carry our
 * `F2M-...` merchant reference in `orderTrackingId`, so try both indexes.
 */
async function findExtensionWorkIntent(ctx: any, identifier: string) {
  const byTracking = await ctx.db
    .query("extensionWorkPaymentIntents" as any)
    .withIndex("by_order_tracking" as any, (q: any) =>
      q.eq("orderTrackingId", identifier),
    )
    .first();
  if (byTracking) return byTracking;

  return await ctx.db
    .query("extensionWorkPaymentIntents" as any)
    .withIndex("by_merchant_reference" as any, (q: any) =>
      q.eq("merchantReference", identifier),
    )
    .first();
}

/**
 * Update extension-work payment intent status from Pesapal verification.
 */
export const markExtensionWorkPaymentIntent = internalMutation({
  args: {
    orderTrackingId: v.string(),
    status: v.union(
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("pending"),
    ),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const intent = await findExtensionWorkIntent(ctx, args.orderTrackingId);

    if (!intent) {
      return { updated: false };
    }

    const now = getUgandaTime();
    await ctx.db.patch(intent._id, {
      status: args.status,
      paymentReference: args.paymentReference,
      verifiedAt: args.status === "paid" ? now : (intent as any).verifiedAt,
      updatedAt: now,
    } as any);

    return { updated: true };
  },
});

/**
 * Fetch extension-work payment intent context by order tracking ID.
 * Used by callback flows to reconstruct form return paths.
 */
export const getExtensionWorkPaymentIntentByOrderTrackingId = internalQuery({
  args: {
    orderTrackingId: v.string(),
  },
  handler: async (ctx, args) => {
    const intent = await findExtensionWorkIntent(ctx, args.orderTrackingId);

    if (!intent) {
      return null;
    }

    return {
      memberId: (intent as any).memberId,
      communityId: (intent as any).communityId,
      formId: (intent as any).formId,
      status: (intent as any).status,
    };
  },
});

/**
 * Internal helper: list paid extension-work intents that have not yet been consumed
 * by a submitted form response.
 */
export const listUnconsumedPaidExtensionWorkIntents = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.max(1, Math.min(args.limit ?? 200, 500));
    const intents = await ctx.db
      .query("extensionWorkPaymentIntents" as any)
      .collect();

    return intents
      .filter(
        (intent: any) =>
          intent?.status === "paid" &&
          !intent?.consumedAt &&
          !intent?.consumedByResponseId,
      )
      .sort(
        (a: any, b: any) =>
          Number((a as any).createdAt || 0) - Number((b as any).createdAt || 0),
      )
      .slice(0, max)
      .map((intent: any) => ({
        _id: intent._id,
        orderTrackingId: intent.orderTrackingId,
        memberId: intent.memberId,
        communityId: intent.communityId,
        formId: intent.formId,
      }));
  },
});

/**
 * Internal helper: list unconsumed extension-work intents across statuses.
 */
export const listUnconsumedExtensionWorkIntents = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.max(1, Math.min(args.limit ?? 200, 500));
    const intents = await ctx.db
      .query("extensionWorkPaymentIntents" as any)
      .collect();

    return intents
      .filter(
        (intent: any) => !intent?.consumedAt && !intent?.consumedByResponseId,
      )
      .sort(
        (a: any, b: any) =>
          Number((a as any).createdAt || 0) - Number((b as any).createdAt || 0),
      )
      .slice(0, max)
      .map((intent: any) => ({
        _id: intent._id,
        orderTrackingId: intent.orderTrackingId,
        memberId: intent.memberId,
        communityId: intent.communityId,
        formId: intent.formId,
        status: intent.status,
      }));
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    orderTrackingId: string;
    extensionWorkContext?: {
      communityId: Id<"communities">;
      formId: Id<"communityForms">;
      memberId: Id<"users">;
      status: "pending" | "paid" | "failed" | "cancelled";
    };
  }> => {
    // Get access token
    const { token }: { token: string; expiresIn: number } = await ctx.runAction(
      internal.pesapal.getPesapalAccessToken,
      {},
    );

    // Validate token
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw pesapalError(
        "PESAPAL_AUTH_FAILED",
        "Invalid access token received from Pesapal authentication.",
      );
    }

    // Get payment status from Pesapal
    const response: Response = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${args.orderTrackingId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
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

      throw pesapalError("PESAPAL_VERIFY_FAILED", errorMessage);
    }

    const paymentStatus: any = await response.json();
    const pesapalStatus = (
      paymentStatus.payment_status_description ||
      paymentStatus.status ||
      ""
    ).toLowerCase();
    const isCompleted =
      pesapalStatus.includes("completed") ||
      paymentStatus.payment_status_code === "1";
    const normalizedStatus = isCompleted
      ? "paid"
      : pesapalStatus.includes("failed")
        ? "failed"
        : pesapalStatus.includes("cancel")
          ? "cancelled"
          : "pending";

    // Update payment transaction and complete wallet deposit
    await ctx.runMutation(internal.pesapal.completePaymentTransaction, {
      orderTrackingId: args.orderTrackingId,
      paymentStatus: paymentStatus,
    });

    // Update extension-work intent if this order belongs to one.
    await ctx.runMutation(internal.pesapal.markExtensionWorkPaymentIntent, {
      orderTrackingId: args.orderTrackingId,
      status: normalizedStatus as any,
      paymentReference: paymentStatus.payment_reference || undefined,
    });

    // If this payment corresponds to a price-sheet download purchase, confirm it
    if (isCompleted) {
      try {
        await ctx.runMutation(
          internal.marketPrices.confirmDownloadPurchasePesapal,
          {
            pesapalTrackingId: args.orderTrackingId,
          },
        );
      } catch {
        // Not every payment is a download purchase — ignore if no matching record
      }
    }

    const extensionWorkContext = await ctx.runQuery(
      internal.pesapal.getExtensionWorkPaymentIntentByOrderTrackingId,
      { orderTrackingId: args.orderTrackingId },
    );

    // Auto-finalize extension-work form submissions after paid verification.
    // This closes the gap where payment succeeds but the user does not tap submit again.
    if (normalizedStatus === "paid" && extensionWorkContext) {
      try {
        const draft = await ctx.runQuery(
          internal.forms.getLatestDraftResponseForMemberFormCommunity,
          {
            formId: extensionWorkContext.formId as Id<"communityForms">,
            communityId: extensionWorkContext.communityId as Id<"communities">,
            memberId: extensionWorkContext.memberId as Id<"users">,
          },
        );

        if (draft?._id) {
          await ctx.runMutation(api.forms.submitDraft, {
            responseId: draft._id,
            memberId: extensionWorkContext.memberId as Id<"users">,
            communityId: extensionWorkContext.communityId as Id<"communities">,
            formId: extensionWorkContext.formId as Id<"communityForms">,
            planId: (draft as any).planId || undefined,
            plannedSprayDate: (draft as any).plannedSprayDate || undefined,
            trackedUnitId: (draft as any).trackedUnitId || undefined,
            paymentOrderTrackingId: args.orderTrackingId,
          } as any);
        }
      } catch {
        // Best-effort reconciliation; verification should not fail if submit cannot be finalized here.
      }
    }

    return {
      status:
        paymentStatus.payment_status_description ||
        paymentStatus.status ||
        "unknown",
      orderTrackingId: args.orderTrackingId,
      extensionWorkContext: extensionWorkContext
        ? {
            communityId: extensionWorkContext.communityId as Id<"communities">,
            formId: extensionWorkContext.formId as Id<"communityForms">,
            memberId: extensionWorkContext.memberId as Id<"users">,
            status: extensionWorkContext.status,
          }
        : undefined,
    };
  },
});

/**
 * Reconcile past paid extension-work intents that were not consumed into
 * submitted form responses. Safe to run multiple times.
 */
export const reconcilePaidExtensionWorkSubmissions = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    scanned: number;
    reconciled: number;
    skippedNoDraft: number;
    failed: number;
    failures: Array<{ orderTrackingId: string; reason: string }>;
  }> => {
    const intents = await ctx.runQuery(
      internal.pesapal.listUnconsumedPaidExtensionWorkIntents,
      {
        limit: args.limit,
      },
    );

    let reconciled = 0;
    let skippedNoDraft = 0;
    let failed = 0;
    const failures: Array<{ orderTrackingId: string; reason: string }> = [];

    for (const intent of intents as any[]) {
      try {
        const draft = await ctx.runQuery(
          internal.forms.getLatestDraftResponseForMemberFormCommunity,
          {
            formId: intent.formId as Id<"communityForms">,
            communityId: intent.communityId as Id<"communities">,
            memberId: intent.memberId as Id<"users">,
          },
        );

        if (!draft?._id) {
          skippedNoDraft += 1;
          continue;
        }

        await ctx.runMutation(api.forms.submitDraft, {
          responseId: draft._id,
          memberId: intent.memberId as Id<"users">,
          communityId: intent.communityId as Id<"communities">,
          formId: intent.formId as Id<"communityForms">,
          planId: (draft as any).planId || undefined,
          plannedSprayDate: (draft as any).plannedSprayDate || undefined,
          trackedUnitId: (draft as any).trackedUnitId || undefined,
          paymentOrderTrackingId: intent.orderTrackingId,
        } as any);

        reconciled += 1;
      } catch (error: any) {
        failed += 1;
        failures.push({
          orderTrackingId: String(intent.orderTrackingId || "unknown"),
          reason: String(error?.message || "reconcile failed"),
        });
      }
    }

    return {
      scanned: intents.length,
      reconciled,
      skippedNoDraft,
      failed,
      failures,
    };
  },
});

/**
 * Verify legacy/pending unconsumed extension-work payment intents against Pesapal,
 * then auto-finalize submissions where payment is confirmed.
 */
export const reconcilePendingExtensionWorkPayments = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    scanned: number;
    verified: number;
    paidAfterVerify: number;
    failed: number;
    failures: Array<{ orderTrackingId: string; reason: string }>;
  }> => {
    const intents = await ctx.runQuery(
      internal.pesapal.listUnconsumedExtensionWorkIntents,
      {
        limit: args.limit,
      },
    );

    let verified = 0;
    let paidAfterVerify = 0;
    let failed = 0;
    const failures: Array<{ orderTrackingId: string; reason: string }> = [];

    for (const intent of intents as any[]) {
      if (!intent?.orderTrackingId) continue;
      try {
        const verification = await ctx.runAction(
          api.pesapal.verifyPesapalPayment,
          {
            orderTrackingId: String(intent.orderTrackingId),
          },
        );
        verified += 1;

        const normalized = String(
          (verification as any)?.status || "",
        ).toLowerCase();
        if (normalized.includes("completed") || normalized === "paid") {
          paidAfterVerify += 1;
        }
      } catch (error: any) {
        failed += 1;
        failures.push({
          orderTrackingId: String(intent.orderTrackingId || "unknown"),
          reason: String(error?.message || "verify failed"),
        });
      }
    }

    return {
      scanned: intents.length,
      verified,
      paidAfterVerify,
      failed,
      failures,
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
    // Find payment transaction. Pesapal hands back its own tracking id on the
    // callback and the IPN; rows written before that id was stored still carry
    // our `F2M-...` merchant reference, so fall back to that index.
    const transaction =
      (await ctx.db
        .query("paymentTransactions")
        .withIndex("by_pesapal_order", (q) =>
          q.eq("pesapalOrderTrackingId", args.orderTrackingId),
        )
        .first()) ??
      (await ctx.db
        .query("paymentTransactions")
        .withIndex("by_merchant_reference", (q) =>
          q.eq("pesapalMerchantReference", args.orderTrackingId),
        )
        .first());

    if (!transaction) {
      return { notFound: true };
    }

    // Check if already completed
    if (transaction.status === "completed") {
      return {
        alreadyCompleted: true,
        walletDepositUtid: transaction.walletDepositUtid,
      };
    }

    // Determine payment status
    const pesapalStatus =
      args.paymentStatus.payment_status_description ||
      args.paymentStatus.status ||
      "";
    const isCompleted =
      pesapalStatus.toLowerCase().includes("completed") ||
      pesapalStatus.toLowerCase() === "completed" ||
      args.paymentStatus.payment_status_code === "1";

    if (!isCompleted) {
      // Mobile-money orders sit in PENDING while the payer confirms on their
      // handset. Only record a terminal status when Pesapal reports one —
      // otherwise the transaction stays pending and can still complete.
      const lowered = pesapalStatus.toLowerCase();
      const nextStatus: "pending" | "failed" | "cancelled" | null =
        lowered.includes("failed") || lowered.includes("invalid")
          ? "failed"
          : lowered.includes("cancel") || lowered.includes("revers")
            ? "cancelled"
            : null;

      await ctx.db.patch(transaction._id, {
        status: nextStatus ?? "pending",
        ...(nextStatus ? { completedAt: Date.now() } : {}),
        metadata: {
          pesapalResponse: args.paymentStatus,
        },
      });
      return { completed: false, status: nextStatus ?? "pending" };
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
      pesapalPaymentReference:
        typeof args.paymentStatus?.payment_reference === "string" &&
        args.paymentStatus.payment_reference.length > 0
          ? args.paymentStatus.payment_reference
          : undefined,
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
 * Diagnostic query to check Pesapal configuration
 * Use this to verify environment variables are set correctly
 */
export const checkPesapalConfig = query({
  args: {},
  handler: async (ctx) => {
    const hasConsumerKey = !!process.env.PESAPAL_CONSUMER_KEY;
    const hasConsumerSecret = !!process.env.PESAPAL_CONSUMER_SECRET;
    const hasNotificationId = !!process.env.PESAPAL_NOTIFICATION_ID;
    const env = process.env.PESAPAL_ENV || "sandbox";

    return {
      environment: env,
      hasConsumerKey,
      hasConsumerSecret,
      hasNotificationId,
      notificationIdLength: process.env.PESAPAL_NOTIFICATION_ID?.length || 0,
      notificationIdPreview: process.env.PESAPAL_NOTIFICATION_ID
        ? process.env.PESAPAL_NOTIFICATION_ID.substring(0, 20) + "..."
        : "NOT SET",
      baseUrl:
        env === "production"
          ? "https://pay.pesapal.com/v3"
          : "https://cybqa.pesapal.com/pesapalv3",
    };
  },
});

/**
 * Register an IPN URL with Pesapal and return the notification id to put in
 * PESAPAL_NOTIFICATION_ID for this deployment.
 *
 * Pesapal has no endpoint to delete or edit a registration, so every call adds
 * a permanent entry to the account. Check the existing list first:
 *   npx convex run pesapal:checkPesapalIpnRegistration '{}'
 *   npx convex run pesapal:registerPesapalIpn '{"url":"https://example.com/api/pesapal/webhook"}'
 *
 * The URL must be publicly reachable — a host behind Vercel Deployment
 * Protection bounces Pesapal's POST to a login page and silently drops every
 * notification.
 */
export const registerPesapalIpn = action({
  args: {
    url: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ipnId: string;
    url: string;
    status?: string;
    environment: string;
    alreadyRegistered: boolean;
  }> => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(args.url);
    } catch {
      throw pesapalError("INVALID_IPN_URL", `Not a valid URL: ${args.url}`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw pesapalError(
        "INVALID_IPN_URL",
        `Pesapal requires an https IPN URL; got ${parsedUrl.protocol}//`,
      );
    }

    const { token }: { token: string } = await ctx.runAction(
      internal.pesapal.getPesapalAccessToken,
      {},
    );

    // Registering the same URL twice just adds a second id, and neither can be
    // removed, so reuse an existing registration when there is one.
    const existing: {
      registeredIpns: Array<{ id: string; url: string; status?: string }>;
    } = await ctx.runAction(api.pesapal.checkPesapalIpnRegistration, {});
    const match = existing.registeredIpns.find(
      (i) => i.url.replace(/\/+$/, "") === args.url.replace(/\/+$/, ""),
    );
    if (match) {
      return {
        ipnId: match.id,
        url: match.url,
        status: match.status,
        environment: PESAPAL_ENV,
        alreadyRegistered: true,
      };
    }

    const response = await fetch(
      `${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: args.url,
          ipn_notification_type: "POST",
        }),
      },
    );

    const text = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw pesapalError(
        "PESAPAL_IPN_REGISTER_FAILED",
        `Pesapal returned a non-JSON response: ${text.substring(0, 300)}`,
      );
    }

    if (!response.ok || parsed?.error) {
      throw pesapalError(
        "PESAPAL_IPN_REGISTER_FAILED",
        `Pesapal rejected the IPN registration: ${
          parsed?.error?.message || parsed?.error?.code || text.substring(0, 300)
        }`,
      );
    }

    const ipnId = String(parsed.ipn_id || parsed.id || "");
    if (!ipnId) {
      throw pesapalError(
        "PESAPAL_IPN_REGISTER_FAILED",
        `Pesapal accepted the registration but returned no ipn_id: ${text.substring(0, 300)}`,
      );
    }

    return {
      ipnId,
      url: String(parsed.url || args.url),
      status: parsed.ipn_status_description || parsed.status,
      environment: PESAPAL_ENV,
      alreadyRegistered: false,
    };
  },
});

/**
 * Read-only diagnostic: ask Pesapal which IPN URLs this account has registered
 * and report whether PESAPAL_NOTIFICATION_ID is one of them.
 *
 * "Invalid IPN URL ID" is the single most common reason SubmitOrderRequest is
 * rejected, and it is otherwise invisible. Run with:
 *   npx convex run pesapal:checkPesapalIpnRegistration '{}'
 */
export const checkPesapalIpnRegistration = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    environment: string;
    configuredNotificationId: string | null;
    isRegistered: boolean;
    registeredIpns: Array<{ id: string; url: string; status?: string }>;
  }> => {
    const { token }: { token: string } = await ctx.runAction(
      internal.pesapal.getPesapalAccessToken,
      {},
    );

    const response = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/GetIpnList`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw pesapalError(
        "PESAPAL_IPN_LIST_FAILED",
        `Could not read the registered IPN list: ${response.status} - ${text.substring(0, 300)}`,
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw pesapalError(
        "PESAPAL_IPN_LIST_FAILED",
        `Pesapal returned a non-JSON IPN list: ${text.substring(0, 300)}`,
      );
    }

    const list: any[] = Array.isArray(parsed) ? parsed : parsed?.data || [];
    const registeredIpns = list.map((entry: any) => ({
      id: String(entry.ipn_id || entry.id || ""),
      url: String(entry.url || entry.ipn_url || ""),
      status: entry.ipn_status_description || entry.status,
    }));

    const configured = PESAPAL_NOTIFICATION_ID?.trim() || null;

    return {
      environment: PESAPAL_ENV,
      configuredNotificationId: configured,
      isRegistered: !!configured && registeredIpns.some((i) => i.id === configured),
      registeredIpns,
    };
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
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string }> => {
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
 * Generic Pesapal initiation used for extension work form payments.
 */
export const initiateExtensionWorkPayment = action({
  args: {
    userId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    formId: v.optional(v.id("communityForms")),
    amount: v.number(),
    currency: v.optional(v.string()),
    callbackUrl: v.string(),
    cancelUrl: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    transactionId: any;
    orderTrackingId: string;
    redirectUrl: string;
  }> => {
    const resolvedCommunityId =
      args.communityId ||
      (extractIdFromUrl(args.cancelUrl, "communityId") as any) ||
      (extractIdFromUrl(args.callbackUrl, "communityId") as any);
    const resolvedFormId =
      args.formId ||
      (extractIdFromUrl(args.cancelUrl, "formId") as any) ||
      (extractIdFromUrl(args.callbackUrl, "formId") as any);

    if (!resolvedCommunityId || !resolvedFormId) {
      throw pesapalError(
        "MISSING_PAYMENT_CONTEXT",
        "Missing required payment context. Open the form from Community Trackers and try again.",
      );
    }

    const user: {
      id: any;
      email: string | undefined;
      phoneNumber: string | undefined;
      role: string;
      alias: string;
    } | null = await ctx.runQuery(api.pesapal.getUserDetails, {
      userId: args.userId,
    });
    if (!user) {
      throw pesapalError("USER_NOT_FOUND", "User not found.");
    }

    const { merchantReference, orderTrackingId, redirectUrl } =
      await submitPesapalOrder(ctx, {
        email: user.email,
        phone: user.phoneNumber,
        firstName: user.alias,
        amount: args.amount,
        currency: args.currency || "UGX",
        description: args.description || "Extension work form payment",
        callbackUrl: args.callbackUrl,
        cancelUrl: args.cancelUrl,
      });

    const intentId = await ctx.runMutation(
      internal.pesapal.createExtensionWorkPaymentIntent,
      {
        orderTrackingId,
        merchantReference,
        memberId: args.userId,
        communityId: resolvedCommunityId,
        formId: resolvedFormId,
        amount: args.amount,
        currency: args.currency || "UGX",
      },
    );

    return {
      transactionId: intentId,
      orderTrackingId,
      redirectUrl,
    };
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    transactionId: any;
    orderTrackingId: string;
    redirectUrl: string;
  }> => {
    // Verify user is a trader
    const user = await ctx.runQuery(api.pesapal.getUserDetails, {
      userId: args.traderId,
    });
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw pesapalError(
        "NOT_TRADER",
        "This account cannot make a trader deposit.",
      );
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    transactionId: any;
    orderTrackingId: string;
    redirectUrl: string;
  }> => {
    // Verify user is a buyer
    const user = await ctx.runQuery(api.pesapal.getUserDetails, {
      userId: args.buyerId,
    });
    if (!user || user.role !== "buyer") {
      throw pesapalError(
        "NOT_BUYER",
        "This account cannot make a buyer deposit.",
      );
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
