# Billing Setup Required

## Current Status
The deployment is failing because billing is not properly linked to the project.

## Steps to Fix

1. **Go to Google Cloud Console Billing:**
   https://console.cloud.google.com/billing?project=farm2market-uganda

2. **Verify Billing Account:**
   - Make sure you have a billing account created
   - Make sure it's **linked** to the project `farm2market-uganda`
   - The project should show as "Linked" in the billing account

3. **If billing account exists but not linked:**
   - Click on your billing account
   - Click "Link a project"
   - Select `farm2market-uganda`
   - Click "Link"

4. **If you need to create a billing account:**
   - Click "Create Account"
   - Follow the prompts
   - Link it to `farm2market-uganda` project

5. **Wait 2-3 minutes** for the changes to propagate

6. **Then run the deployment again:**
   ```powershell
   cd cloud-functions
   .\deploy-simple.ps1
   ```

## Verify Billing is Linked

Run this command to check:
```powershell
gcloud billing projects describe farm2market-uganda
```

You should see a `billingAccountName` field if billing is properly linked.

## Note
Google Cloud offers a **$300 free trial** for new accounts, which should be more than enough for push notifications (which are typically free under 2M invocations/month).
