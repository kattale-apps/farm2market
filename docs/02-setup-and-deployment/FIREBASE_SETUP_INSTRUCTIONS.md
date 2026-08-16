# Firebase Setup Instructions for Push Notifications

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `Farm2Market Uganda` (or your preferred name)
4. Click **Continue**
5. (Optional) Enable Google Analytics - you can skip this
6. Click **Create project**
7. Wait for project to be created, then click **Continue**

## Step 2: Add Android App to Firebase

1. In your Firebase project dashboard, click the **Android icon** (or **Add app** → **Android**)
2. Enter Android package name: `com.farm2market.uganda`
3. Enter App nickname (optional): `Farm2Market Uganda`
4. Enter Debug signing certificate SHA-1 (optional for now, can add later)
5. Click **Register app**

## Step 3: Download google-services.json

1. After registering the app, you'll see a **"Download google-services.json"** button
2. Click **Download google-services.json**
3. **IMPORTANT**: Copy the downloaded file to: `android/app/google-services.json`
   - The file should be at: `C:\Users\Administrator\Desktop\my-app\android\app\google-services.json`

## Step 4: Get FCM Server Key

1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Go to the **Cloud Messaging** tab
4. Under **Cloud Messaging API (Legacy)**, you'll see:
   - **Server key** - Copy this key (you'll need it for Convex)
   - **Sender ID** - Note this down (usually the same as Project Number)

## Step 5: Configure Convex with FCM Server Key

1. Open terminal in your project directory
2. Run:
   ```bash
   npx convex env set FCM_SERVER_KEY "YOUR_SERVER_KEY_HERE"
   ```
   Replace `YOUR_SERVER_KEY_HERE` with the Server key you copied from Firebase

3. Verify it's set:
   ```bash
   npx convex env list
   ```

## Step 6: Enable FCM in Code

The code is already set up! Just verify that `convex/pushNotifications.ts` has the FCM implementation uncommented (it should be ready).

## Step 7: Rebuild and Test

1. Sync Capacitor:
   ```bash
   npx cap sync android
   ```

2. Rebuild the APK:
   ```bash
   cd android
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   .\gradlew.bat clean assembleDebug
   ```

3. Install on device and test:
   - App will request notification permission
   - Device token will be registered
   - Send test notification from admin dashboard

## Verification Checklist

- [ ] Firebase project created
- [ ] Android app added to Firebase project
- [ ] `google-services.json` downloaded and placed in `android/app/`
- [ ] FCM Server key obtained from Firebase Console
- [ ] FCM Server key added to Convex environment variables
- [ ] APK rebuilt with Firebase configuration
- [ ] App installed on device
- [ ] Notification permission granted
- [ ] Test notification sent and received

## Troubleshooting

### google-services.json not found
- Make sure the file is in `android/app/google-services.json` (not `android/google-services.json`)
- Check file name is exactly `google-services.json` (not `google-services.json.txt`)

### Build fails with "google-services plugin not applied"
- Verify `google-services.json` exists in `android/app/`
- Check that the file is valid JSON (not corrupted)
- Try: `cd android && .\gradlew.bat clean`

### Push notifications not working
- Verify FCM Server key is set in Convex: `npx convex env list`
- Check device token is registered in Convex dashboard
- Verify notification permission is granted on device
- Check Firebase Console → Cloud Messaging → see if messages are being sent

### "FCM_SERVER_KEY not configured" error
- Run: `npx convex env set FCM_SERVER_KEY "your-key"`
- Verify: `npx convex env list`
- Redeploy Convex functions if needed

## Next Steps After Setup

1. Test push notifications work when app is closed
2. Monitor notification delivery in Firebase Console
3. Set up notification analytics if needed
4. Configure notification channels for Android 8.0+
