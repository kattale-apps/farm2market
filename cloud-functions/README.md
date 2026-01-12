# FCM Push Notification Cloud Function

This Google Cloud Function handles sending FCM v1 push notifications using Firebase Admin SDK.

## Prerequisites

1. **Google Cloud CLI installed**
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or use: `winget install Google.CloudSDK`

2. **Authenticated with Google Cloud**
   ```powershell
   gcloud auth login
   gcloud config set project farm2market-uganda
   ```

3. **Service Account JSON file**
   - Should be at: `../android/farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json`

## Deployment

### Quick Deploy

```powershell
cd cloud-functions
.\deploy.ps1
```

### Manual Deploy

```powershell
cd cloud-functions\fcm-sender

# Read service account
$serviceAccount = Get-Content "..\..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json" -Raw

# Deploy
gcloud functions deploy sendFCMNotification `
    --gen2 `
    --runtime=nodejs20 `
    --region=us-central1 `
    --source=. `
    --entry-point=sendFCMNotification `
    --trigger-http `
    --allow-unauthenticated `
    --set-env-vars="FCM_SERVICE_ACCOUNT=$serviceAccount" `
    --memory=256MB `
    --timeout=60s
```

## After Deployment

1. **Get the function URL:**
   ```powershell
   gcloud functions describe sendFCMNotification --gen2 --region=us-central1 --format="value(serviceConfig.uri)"
   ```

2. **Set it in Convex:**
   ```powershell
   npx convex env set FCM_CLOUD_FUNCTION_URL "https://sendfcmnotification-XXXXX-uc.a.run.app"
   ```

## Testing

Test the function directly:

```powershell
$functionUrl = "YOUR_FUNCTION_URL_HERE"
$body = @{
    tokens = @("test-token-1", "test-token-2")
    title = "Test Notification"
    body = "This is a test"
    data = @{}
} | ConvertTo-Json

Invoke-RestMethod -Uri $functionUrl -Method POST -Body $body -ContentType "application/json"
```

## Troubleshooting

### Deployment fails with "Permission denied"
- Make sure you're authenticated: `gcloud auth login`
- Check project is set: `gcloud config get-value project`
- Verify billing is enabled for your project

### Function returns 500 error
- Check Cloud Function logs: `gcloud functions logs read sendFCMNotification --gen2 --region=us-central1`
- Verify service account JSON is valid
- Check that Firebase Admin SDK can initialize

### CORS errors
- The function already sets CORS headers
- If issues persist, check the function URL is correct

## Cost

Google Cloud Functions (2nd gen) pricing:
- **Free tier**: 2 million invocations/month
- **After free tier**: $0.40 per million invocations
- **Memory**: 256MB included in free tier
- **Compute time**: First 400,000 GB-seconds/month free

For typical usage, this should be well within the free tier.
