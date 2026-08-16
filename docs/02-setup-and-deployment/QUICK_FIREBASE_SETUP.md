# Quick Firebase Setup Guide

## ✅ What's Already Configured

1. ✅ Firebase dependencies added to `android/app/build.gradle`
2. ✅ Google Services plugin configured in `android/build.gradle`
3. ✅ Push notification code implemented in `convex/pushNotifications.ts`
4. ✅ Android permissions configured
5. ✅ Device token registration integrated

## 🚀 What You Need to Do (5 Steps)

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Name it: `Farm2Market Uganda`
4. Click through the setup (you can skip Google Analytics)

### Step 2: Add Android App
1. In Firebase Console, click **Android icon** (or **Add app** → **Android**)
2. Package name: `com.farm2market.uganda`
3. App nickname: `Farm2Market Uganda` (optional)
4. Click **Register app**

### Step 3: Download google-services.json
1. Click **Download google-services.json**
2. **Copy the file to**: `C:\Users\Administrator\Desktop\my-app\android\app\google-services.json`
   - Make sure it's in the `android/app/` folder, not just `android/`

### Step 4: Get FCM Server Key
1. In Firebase Console, click **⚙️ Settings** → **Project settings**
2. Go to **Cloud Messaging** tab
3. Under **Cloud Messaging API (Legacy)**, copy the **Server key**
4. Run this command (replace YOUR_KEY with the actual key):
   ```powershell
   npx convex env set FCM_SERVER_KEY "YOUR_KEY_HERE"
   ```

### Step 5: Rebuild APK
```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat clean assembleDebug
```

## ✅ Verification

After setup, verify:
- [ ] `android/app/google-services.json` exists
- [ ] FCM_SERVER_KEY is set: `npx convex env list`
- [ ] APK builds successfully
- [ ] App requests notification permission on first launch
- [ ] Device token appears in Convex dashboard

## 🧪 Testing

1. Install the rebuilt APK on your device
2. Log in to the app
3. Grant notification permission when prompted
4. Go to Admin Dashboard
5. Send a test notification
6. Close the app completely
7. Notification should appear even when app is closed!

## 📝 Notes

- The FCM implementation is already active in the code
- Once you add `google-services.json` and set `FCM_SERVER_KEY`, it will work immediately
- No code changes needed - everything is already configured!
