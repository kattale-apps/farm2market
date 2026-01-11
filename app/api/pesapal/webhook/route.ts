/**
 * Pesapal IPN Webhook Endpoint
 * 
 * This endpoint receives payment notifications from Pesapal.
 * 
 * IMPORTANT: This is a placeholder. You need to:
 * 1. Deploy your app to get a public URL
 * 2. Register the webhook URL in Pesapal dashboard:
 *    https://your-domain.com/api/pesapal/webhook
 * 3. Get the notification_id from Pesapal after registration
 * 4. Set PESAPAL_NOTIFICATION_ID in Convex Dashboard environment variables
 * 
 * Note: To properly integrate with Convex, you may need to:
 * - Use Convex HTTP actions (if available)
 * - Or set up a server-side Convex client to call actions
 * - Or use Convex webhooks feature (if available)
 */

import { NextRequest, NextResponse } from "next/server";

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

    // TODO: Forward to Convex webhook handler
    // You'll need to implement this based on your Convex setup
    // Options:
    // 1. Use Convex HTTP actions (if available)
    // 2. Use server-side Convex client to call handlePesapalWebhook action
    // 3. Use Convex webhooks feature (if available)
    
    console.log("Pesapal webhook received:", { orderTrackingId, body });

    // For now, return success to acknowledge receipt
    // You should implement the actual webhook processing
    return NextResponse.json({ 
      success: true, 
      message: "Webhook received - processing" 
    });
  } catch (error: any) {
    console.error("Pesapal webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
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
