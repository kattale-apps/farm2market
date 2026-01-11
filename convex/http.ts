/**
 * Convex HTTP Routes
 * 
 * This file defines HTTP endpoints for your Convex deployment.
 * These endpoints can be called directly via HTTP requests.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * Pesapal IPN Webhook Endpoint
 * 
 * This endpoint receives payment notifications from Pesapal.
 * 
 * URL Format: https://your-deployment.convex.site/pesapal/webhook
 * 
 * To find your actual webhook URL:
 * 1. Go to Convex Dashboard → Your Project → Settings
 * 2. Look for "Site URL" or check your deployment URL
 * 3. Your webhook will be: {your-site-url}/pesapal/webhook
 * 
 * Example: If your Convex URL is https://chatty-camel-373.convex.cloud
 *          Your webhook URL is: https://chatty-camel-373.convex.site/pesapal/webhook
 * 
 * Note: Convex HTTP endpoints use .convex.site domain (different from .convex.cloud)
 * 4. Get the notification_id from Pesapal after registration
 * 5. Set PESAPAL_NOTIFICATION_ID in Convex Dashboard environment variables
 */
http.route({
  path: "/pesapal/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
        return new Response(
          JSON.stringify({ error: "Missing order tracking ID" }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Call the Convex webhook handler
      const result = await ctx.runAction(api.pesapal.handlePesapalWebhook, {
        orderTrackingId,
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Pesapal webhook error:", error);
      return new Response(
        JSON.stringify({ 
          error: error.message || "Webhook processing failed" 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

/**
 * GET endpoint for webhook verification
 * Pesapal may send GET requests to verify the endpoint is active
 */
http.route({
  path: "/pesapal/webhook",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response(
      JSON.stringify({ 
        status: "ok", 
        message: "Pesapal webhook endpoint is active",
        note: "Register this URL in Pesapal dashboard to get notification_id"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }),
});

export default http;
