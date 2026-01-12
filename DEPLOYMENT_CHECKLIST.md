# FCM Push Notifications Deployment Checklist

## ✅ Code Implementation Complete

1. ✅ Google Cloud Function created (`cloud-functions/fcm-sender/`)
2. ✅ Convex code updated to call Cloud Function
3. ✅ Deployment script created (`cloud-functions/deploy.ps1`)
4. ✅ Service account JSON file downloaded

## 🚀 Deployment Steps

### Step 1: Install Google Cloud CLI

```powershell
# Check if installed
gcloud --version

# If not installed:
# Download from: https://cloud.google.com/sdk/docs/install
# Or use: winget install Google.CloudSDK
```

### Step 2: Authenticate

```powershell
gcloud auth login
gcloud config set project farm2market-uganda
```

### Step 3: Deploy Cloud Function

```powershell
cd cloud-functions
.\deploy.ps1
```

**Expected output:**
- Function URL will be displayed
- Example: `https://sendfcmnotification-XXXXX-uc.a.run.app`

### Step 4: Configure Convex

```powershell
# Set the Cloud Function URL (use the URL from Step 3)
npx convex env set FCM_CLOUD_FUNCTION_URL "https://sendfcmnotification-XXXXX-uc.a.run.app"

# Verify it's set
npx convex env list
```

### Step 5: Verify google-services.json

Make sure `google-services.json` is in the correct location:
- ✅ Should be at: `android/app/google-services.json`
- ❌ NOT at: `android/google-services.json`

If missing:
1. Go to Firebase Console
2. Project Settings → Your apps
3. Download `google-services.json`
4. Place in `android/app/` folder

### Step 6: Rebuild APK

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat clean assembleDebug
```

### Step 7: Test

1. Install APK on device
2. Log in to app
3. Grant notification permission
4. Send test notification from admin dashboard
5. Close app completely
6. Verify notification appears

## ✅ Verification Checklist

- [ ] Google Cloud CLI installed and authenticated
- [ ] Cloud Function deployed successfully
- [ ] Function URL obtained and set in Convex
- [ ] `google-services.json` in `android/app/` folder
- [ ] APK rebuilt successfully
- [ ] App installed on device
- [ ] Notification permission granted
- [ ] Device token registered in Convex
- [ ] Test notification sent and received

## 🔍 Troubleshooting

### Cloud Function deployment fails
- Check: `gcloud auth login`
- Verify project: `gcloud config get-value project`
- Check billing is enabled
- Try: `gcloud services enable cloudfunctions.googleapis.com`

### "FCM_CLOUD_FUNCTION_URL not configured"
- Run: `npx convex env set FCM_CLOUD_FUNCTION_URL "YOUR_URL"`
- Verify: `npx convex env list`
- Redeploy Convex: `npx convex deploy`

### Notifications not appearing
- Check Cloud Function logs: `gcloud functions logs read sendFCMNotification --gen2 --region=us-central1`
- Verify device token in Convex dashboard
- Check notification permission on device
- Verify `google-services.json` is correct

## 📝 Next Steps After Deployment

1. Monitor Cloud Function logs for any errors
2. Test with multiple devices
3. Set up monitoring/alerts if needed
4. Document any custom notification handling
