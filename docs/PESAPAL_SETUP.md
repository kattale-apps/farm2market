# Pesapal Payment Integration Setup

## Environment Variables Required

To use Pesapal payments, you must set the following environment variables in **Convex Dashboard → Settings → Environment Variables**:

### Required Variables

| Variable Name | Description | Example | Required |
|--------------|-------------|---------|----------|
| `PESAPAL_CONSUMER_KEY` | Your Pesapal Consumer Key | `1DDecquMxaWUxGjWg+g3SQSkgRRmV3hs` | Yes |
| `PESAPAL_CONSUMER_SECRET` | Your Pesapal Consumer Secret | `WpmXyvPsYE872GO7WY/wjpoSrm8=` | Yes |
| `PESAPAL_ENV` | Environment: `sandbox` or `production` | `sandbox` | No (defaults to sandbox) |
| `PESAPAL_NOTIFICATION_ID` | IPN Notification ID (if registered with Pesapal) | `abc123-def456-ghi789` | No (only if IPN is required) |

### How to Set in Convex Dashboard

1. Go to **Convex Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add Variable** for each required variable
3. Enter the variable name and value
4. Click **Save**
5. **Redeploy** your Convex functions (or wait for auto-deploy)

## Common Issues

### Error: "Invalid Access Token"

This error typically means:
1. **Invalid Credentials**: The `PESAPAL_CONSUMER_KEY` or `PESAPAL_CONSUMER_SECRET` are incorrect
2. **Wrong Environment**: Using production credentials with sandbox URL or vice versa
3. **Expired Credentials**: Credentials may have been revoked or expired

**Solution**:
- Verify credentials in your Pesapal dashboard
- Ensure `PESAPAL_ENV` matches your credentials (sandbox vs production)
- Check that credentials are correctly set in Convex Dashboard

### Error: "Pesapal credentials are missing"

This means the environment variables are not set in Convex.

**Solution**:
- Set `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` in Convex Dashboard
- Ensure variables are set for the correct environment (development/production)

### Error: "Invalid IPN URL ID provided" or "Invalid IPN URL ID provided.Check format and try again"

This error indicates that Pesapal API v3 is expecting a `notification_id` (IPN URL ID) in the payment request.

**Understanding IPN vs Callback URLs**:
- **Callback URL**: Used for redirecting users back to your site after payment (we use this)
- **IPN (Instant Payment Notification)**: Server-to-server webhook notifications (may be required by Pesapal v3)

**Possible Solutions**:

1. **Register an IPN URL with Pesapal** (Required for API v3):
   
   **Step 1: Create a Webhook Endpoint**
   
   You need a publicly accessible HTTP endpoint that Pesapal can call. Since you're using Convex, you have a few options:
   
   **Option A: Use Vercel/Next.js API Route** (Recommended if using Vercel):
   - Create an API route at `app/api/pesapal/webhook/route.ts` (or `pages/api/pesapal/webhook.ts` for Pages Router)
   - This endpoint should accept POST requests from Pesapal
   - It should call your Convex `handlePesapalWebhook` action
   
   **Option B: Use a Convex HTTP Action** (If Convex supports HTTP endpoints):
   - Check if Convex supports HTTP endpoints for webhooks
   - Configure the webhook handler to accept direct HTTP calls
   
   **Step 2: Register IPN URL in Pesapal Dashboard**
   - Log into your Pesapal dashboard (sandbox or production)
   - Navigate to **Settings** → **IPN (Instant Payment Notification)**
   - Click **Register IPN URL**
   - Enter your webhook URL (e.g., `https://your-domain.com/api/pesapal/webhook`)
   - Save and copy the `notification_id` you receive
   
   **Step 3: Add Notification ID to Convex**
   - Go to **Convex Dashboard** → **Settings** → **Environment Variables**
   - Add variable: `PESAPAL_NOTIFICATION_ID`
   - Set value to the notification_id from Pesapal
   - Save and wait for redeploy

2. **Check if IPN is optional in sandbox**:
   - Some Pesapal sandbox environments may allow omitting `notification_id`
   - Try testing with the current code after Convex redeploys
   - Check Convex logs to see the exact request being sent

3. **Contact Pesapal Support**:
   - Ask if `notification_id` is required for sandbox testing
   - Request guidance on IPN URL registration
   - Verify if callback_url alone is sufficient

**Solution - Add Notification ID** (if required):

If Pesapal requires `notification_id` and you've registered an IPN URL:

1. **Get your notification_id** from Pesapal dashboard after registering IPN URL
2. **Add environment variable** in Convex Dashboard:
   - Variable name: `PESAPAL_NOTIFICATION_ID`
   - Variable value: Your notification ID from Pesapal
3. **Redeploy** Convex functions

The code will automatically include `notification_id` in payment requests if this environment variable is set.

**Note**: The current implementation uses `callback_url` for payment confirmation. If the "Invalid IPN URL ID" error persists after Convex redeploys and you've verified the request structure, you may need to register an IPN URL with Pesapal and add the `PESAPAL_NOTIFICATION_ID` environment variable.

## Testing

### Sandbox Mode (Default)
- Uses: `https://cybqa.pesapal.com/pesapalv3`
- Set `PESAPAL_ENV=sandbox` (or leave unset)
- Use sandbox credentials from Pesapal dashboard

### Production Mode
- Uses: `https://pay.pesapal.com/v3`
- Set `PESAPAL_ENV=production`
- Use production credentials from Pesapal dashboard

## API Endpoints

### Authentication
- **Sandbox**: `https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken`
- **Production**: `https://pay.pesapal.com/v3/api/Auth/RequestToken`

### Payment Submission
- **Sandbox**: `https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest`
- **Production**: `https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest`

## Support

If issues persist:
1. Check Pesapal API documentation: https://developer.pesapal.com/
2. Verify credentials in Pesapal dashboard
3. Contact Pesapal support for credential verification
