# Pesapal Payment Integration Setup

## Environment Variables Required

To use Pesapal payments, you must set the following environment variables in **Convex Dashboard → Settings → Environment Variables**:

### Required Variables

| Variable Name             | Description                                      | Example                     | Required                     |
| ------------------------- | ------------------------------------------------ | --------------------------- | ---------------------------- |
| `PESAPAL_CONSUMER_KEY`    | Your Pesapal Consumer Key                        | `<set-in-convex-dashboard>` | Yes                          |
| `PESAPAL_CONSUMER_SECRET` | Your Pesapal Consumer Secret                     | `<set-in-convex-dashboard>` | Yes                          |
| `PESAPAL_ENV`             | Environment: `sandbox` or `production`           | `sandbox`                   | No (defaults to sandbox)     |
| `PESAPAL_NOTIFICATION_ID` | IPN Notification ID registered with Pesapal      | `abc123-def456-ghi789`      | Yes                          |
| `PESAPAL_APP_BASE_URL`    | Public site URL used to rebuild callback/cancel URLs when the app reports a non-public origin (Capacitor reports `http://localhost`) | `https://www.farm2marketuganda.com` | No (recommended, required for the Android app) |

### Diagnosing a failed payment

Payment failures raise a `ConvexError`, so the real Pesapal reason reaches the
browser instead of a bare "Server Error". Two read-only checks help confirm the
deployment itself is configured:

```bash
# Which variables this deployment can see
npx convex run pesapal:checkPesapalConfig '{}'

# Whether PESAPAL_NOTIFICATION_ID matches an IPN URL registered with Pesapal.
# A mismatch here is the usual cause of "Invalid IPN URL ID" rejections.
npx convex run pesapal:checkPesapalIpnRegistration '{}'

# Register an IPN URL and get back the id to store in PESAPAL_NOTIFICATION_ID.
# Reuses an existing registration for the same URL rather than adding a duplicate.
npx convex run pesapal:registerPesapalIpn '{"url":"https://www.farm2marketuganda.com/api/pesapal/webhook"}'
```

**The IPN URL must be publicly reachable.** Pesapal POSTs to it with no
credentials, so a host behind Vercel Deployment Protection returns a redirect to
`vercel.com/sso-api` and every notification is silently dropped. Verify with:

```bash
curl -i https://<your-domain>/api/pesapal/webhook   # expect 200, not 302
```

Notifications are the only path that credits a buyer who closes the browser
after paying by mobile money; the `/payment/callback` page covers only buyers
who stay until the redirect completes.

**Registrations are permanent.** Pesapal exposes `RegisterIPN` and `GetIpnList`
but no delete or edit endpoint, so a wrong URL cannot be withdrawn — it can only
be superseded by registering another and pointing
`PESAPAL_NOTIFICATION_ID` at the new id.

Add `--prod` to either command to check the production deployment. Environment
variables are per-deployment: setting them on dev does **not** set them on prod.

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

   **Step 1: Get Your Convex Webhook URL**

   The webhook endpoint is already set up in `convex/http.ts`. After deploying Convex, you'll get a webhook URL like:

   ```
   https://your-deployment-name.convex.site/pesapal/webhook
   ```

   To find your Convex deployment URL:
   - Go to **Convex Dashboard** → Your Project
   - Check the deployment URL (usually shown in the dashboard)
   - Or check your `CONVEX_URL` environment variable
   - The webhook path is: `{your-convex-url}/pesapal/webhook`

   **Step 2: Register IPN URL in Pesapal Dashboard**
   - Log into your Pesapal dashboard (sandbox or production)
   - Navigate to **Settings** → **IPN (Instant Payment Notification)**
   - Click **Register IPN URL** or **Add IPN URL**
   - Enter:
     - **Website Domain**: `https://www.farm2marketuganda.com/`
     - **IPN Listener Url**: `https://www.farm2marketuganda.com/api/pesapal/webhook`
   - Click **SAVE URL**
   - **IMPORTANT**: After saving, Pesapal will show a `notification_id` - this is NOT the URL!
   - The `notification_id` will look like: `abc123-def456-ghi789` or `550e8400-e29b-41d4-a716-446655440000` (UUID format)
   - **DO NOT copy the URL** - copy the actual notification_id (alphanumeric string/UUID)

   **Step 3: Add Notification ID to Convex (NOT Vercel)**

   **IMPORTANT**: Add this to **Convex Dashboard**, NOT Vercel, because:
   - Payment requests are initiated in Convex actions
   - Convex functions run on Convex servers, not Vercel
   - The webhook endpoint on Vercel only forwards to Convex

   Steps:
   - Go to **Convex Dashboard** → Your Project → **Settings** → **Environment Variables**
   - Click **Add Variable** (or edit existing if it's already there)
   - Variable name: `PESAPAL_NOTIFICATION_ID`
   - Variable value: (paste the **notification_id** from Pesapal - NOT the URL!)
   - **IMPORTANT**: The value should be a UUID/alphanumeric string like `abc123-def456-ghi789`
   - **NOT** a URL like `https://www.farm2marketuganda.com/api/pesapal/webhook`
   - Click **Save** (Convex will auto-redeploy)

   **Common Mistake**: Setting the IPN URL as the notification_id value. The notification_id is a separate identifier that Pesapal provides after registering the URL.

   **Do NOT add this to Vercel environment variables** - it won't work there!

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
