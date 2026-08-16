# Billing Required for Cloud Functions

## Current Status
✅ Google Cloud SDK installed  
✅ Authenticated with Google account (kattaleglobal@gmail.com)  
✅ Project set to farm2market-uganda  
❌ **Billing account not linked to project**

## Required Action

Cloud Functions requires a billing account to be linked to your Google Cloud project. 

### Steps to Enable Billing:

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/billing?project=farm2market-uganda

2. **Link a Billing Account:**
   - If you have a billing account, link it to the project
   - If you don't have one, create a new billing account
   - Google Cloud offers a **$300 free trial** for new accounts

3. **After Billing is Enabled:**
   Run the deployment script:
   ```powershell
   cd cloud-functions
   .\setup-and-deploy.ps1
   ```

   Or run these commands manually:
   ```powershell
   # Enable APIs
   gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com
   
   # Deploy function
   cd cloud-functions
   gcloud functions deploy sendFCMNotification `
       --gen2 `
       --runtime=nodejs20 `
       --region=us-central1 `
       --source=./fcm-sender `
       --entry-point=sendFCMNotification `
       --trigger-http `
       --allow-unauthenticated `
       --set-env-vars="FCM_SERVICE_ACCOUNT=$(Get-Content ..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json -Raw)" `
       --memory=256MB `
       --timeout=60s
   
   # Get function URL
   $url = gcloud functions describe sendFCMNotification --gen2 --region=us-central1 --format="value(serviceConfig.uri)"
   
   # Set in Convex
   npx convex env set FCM_CLOUD_FUNCTION_URL $url
   ```

## Cost Estimate

Cloud Functions pricing:
- **Free tier:** 2 million invocations/month
- **After free tier:** $0.40 per million invocations
- **Compute time:** $0.0000025 per GB-second

For push notifications, you'll likely stay within the free tier unless you have very high volume.

## Alternative: Use Firebase Cloud Messaging Directly

If you prefer not to enable billing, you could:
1. Use Firebase Cloud Messaging REST API directly from Convex
2. This requires implementing JWT authentication in Convex
3. More complex but no Cloud Functions needed

Let me know which approach you'd like to take!
