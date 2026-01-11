/**
 * Pesapal IPN Webhook Endpoint
 * 
 * This endpoint receives payment notifications from Pesapal.
 * 
 * IMPORTANT: Pesapal requires the IPN URL to be on the same domain as your website.
 * Since your site is on Vercel (farm2market-dev.vercel.app), use this Next.js route
 * instead of the Convex HTTP endpoint.
 * 
 * Webhook URL: https://farm2market-dev.vercel.app/api/pesapal/webhook
 * 
 * To set up:
 * 1. Deploy this Next.js app to Vercel
 * 2. Register the webhook URL in Pesapal dashboard:
 *    - Website Domain: https://farm2market-dev.vercel.app/
 *    - IPN Listener Url: https://farm2market-dev.vercel.app/api/pesapal/webhook
 * 3. Get the notification_id from Pesapal after registration
 * 4. Set PESAPAL_NOTIFICATION_ID in Convex Dashboard environment variables
 */

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// Initialize Convex client for server-side use
const getConvexClient = () => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(convexUrl);
};

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Pesapal sends the order tracking ID in the webhook payload
    // The exact format may vary - check Pesapal documentation
    const orderTrackingId = body.OrderTrackingId || 
                           body.order_tracking_id || 
                           body.orderTrackingId;

    if (!orderTrackingId) {
      console.error("Pesapal webhook: No order tracking ID in payload", body);
      return NextResponse.json(
        { error: "Missing order tracking ID" },
        { status: 400 }
      );
    }

    // Forward to Convex webhook handler
    const convex = getConvexClient();
    const result = await convex.action(api.pesapal.handlePesapalWebhook, {
      orderTrackingId,
    });

    console.log("Pesapal webhook processed:", { orderTrackingId, result });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Pesapal webhook error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Webhook processing failed" 
      },
      { status: 500 }
    );
  }
}

// Pesapal may also send GET requests to verify the endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: "ok", 
    message: "Pesapal webhook endpoint is active",
    note: "Register this URL in Pesapal dashboard to get notification_id"
  });
}
