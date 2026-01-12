# Deploy Cloud Function Now

## ✅ What's Ready

1. ✅ Google Cloud SDK installed
2. ✅ Authenticated with Google account (kattaleglobal@gmail.com)
3. ✅ Project set to farm2market-uganda
4. ✅ Service account file ready
5. ✅ Cloud Function code ready
6. ✅ Convex backend ready to receive function URL

## ⚠️ Required: Enable Billing

**Before deploying, you must enable billing:**

1. Go to: https://console.cloud.google.com/billing?project=farm2market-uganda
2. Link a billing account (or create one - Google offers $300 free trial)
3. Once billing is enabled, run the command below

## 🚀 Deploy Command

Once billing is enabled, run this single command:

```powershell
cd cloud-functions; gcloud functions deploy sendFCMNotification --gen2 --runtime=nodejs20 --region=us-central1 --source=./fcm-sender --entry-point=sendFCMNotification --trigger-http --allow-unauthenticated --set-env-vars="FCM_SERVICE_ACCOUNT=$(Get-Content ..\android\farm2market-uganda-firebase-adminsdk-fbsvc-4460e91020.json -Raw | ConvertTo-Json -Compress)" --memory=256MB --timeout=60s
```

**Or use the automated script:**
```powershell
cd cloud-functions
.\setup-and-deploy.ps1
```

## 📋 After Deployment

1. **Get the function URL:**
   ```powershell
   $url = gcloud functions describe sendFCMNotification --gen2 --region=us-central1 --format="value(serviceConfig.uri)"
   echo $url
   ```

2. **Set it in Convex:**
   ```powershell
   npx convex env set FCM_CLOUD_FUNCTION_URL $url
   ```

3. **Verify:**
   ```powershell
   npx convex env ls
   ```

## ✅ Final Steps

1. Make sure `google-services.json` is in `android/app/`
2. Rebuild your APK
3. Test push notifications!

---

**Note:** Cloud Functions has a generous free tier (2M invocations/month), so you likely won't incur any costs for push notifications.
