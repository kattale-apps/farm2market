# Google Cloud Function Setup for FCM v1 Push Notifications

## Overview

Since Firebase Cloud Messaging Legacy API is deprecated, we're using a Google Cloud Function to handle FCM v1 API calls. The Cloud Function uses Firebase Admin SDK to send push notifications.

## ✅ What's Been Created

1. ✅ Cloud Function code (`cloud-functions/fcm-sender/`)
2. ✅ Deployment script (`cloud-functions/deploy.ps1`)
3. ✅ Updated Convex code to call Cloud Function
4. ✅ Service account JSON file (already downloaded)

## 🚀 Deployment Steps

### Step 1: Install Google Cloud CLI

If not already installed:

**Option A: Download installer**
- Go to: https://cloud.google.com/sdk/docs/install
- Download and run the installer

**Option B: Using winget (Windows)**
```powershell
winget install Google.CloudSDK
```

### Step 2: Authenticate and Set Project

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project farm2market-uganda

# Verify
gcloud config get-value project
```

### Step 3: Enable Required APIs

```powershell
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

### Step 4: Deploy the Function

```powershell
cd cloud-functions
.\deploy.ps1
```

The script will:
- Check prerequisites
- Enable required APIs
- Deploy the function
- Display the function URL

### Step 5: Configure Convex

After deployment, you'll get a function URL like:
```
https://sendfcmnotification-XXXXX-uc.a.run.app
```

Set it in Convex:

```powershell
npx convex env set FCM_CLOUD_FUNCTION_URL "https://sendfcmnotification-XXXXX-uc.a.run.app"
```

Verify it's set:

```powershell
npx convex env list
```

## 🧪 Testing

1. **Test the Cloud Function directly:**
   ```powershell
   $url = "YOUR_FUNCTION_URL"
   $body = @{
       tokens = @("test-token")
       title = "Test"
       body = "Test notification"
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
   ```

2. **Test from your app:**
   - Install the app on a device
   - Log in
   - Grant notification permission
   - Send a test notification from admin dashboard
   - Check if notification appears

## 📊 Monitoring

### View Function Logs

```powershell
gcloud functions logs read sendFCMNotification --gen2 --region=us-central1 --limit=50
```

### View Function Details

```powershell
gcloud functions describe sendFCMNotification --gen2 --region=us-central1
```

### Get Function URL

```powershell
gcloud functions describe sendFCMNotification --gen2 --region=us-central1 --format="value(serviceConfig.uri)"
```

## 🔧 Troubleshooting

### "Permission denied" during deployment
- Run: `gcloud auth login`
- Verify project: `gcloud config get-value project`
- Check billing is enabled

### Function returns 500 error
- Check logs: `gcloud functions logs read sendFCMNotification --gen2 --region=us-central1`
- Verify service account JSON is valid
- Check environment variable is set correctly

### "FCM_CLOUD_FUNCTION_URL not configured" in Convex
- Run: `npx convex env set FCM_CLOUD_FUNCTION_URL "YOUR_URL"`
- Verify: `npx convex env list`
- Redeploy Convex functions if needed

### Notifications not appearing
- Check device token is registered in Convex
- Verify notification permission is granted
- Check Cloud Function logs for errors
- Verify function URL is correct

## 💰 Cost Estimate

- **Free tier**: 2 million invocations/month
- **After free tier**: ~$0.40 per million invocations
- For typical usage, should be well within free tier

## 🔄 Updating the Function

If you need to update the function code:

```powershell
cd cloud-functions
.\deploy.ps1
```

The deployment will update the existing function.

## 📝 Next Steps

1. Deploy the Cloud Function
2. Set the URL in Convex
3. Rebuild and test the APK
4. Send test notifications
5. Monitor logs for any issues
