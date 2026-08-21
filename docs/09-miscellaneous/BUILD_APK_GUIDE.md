# Building APK for Farm2Market Uganda

## ✅ What's Already Done

1. ✅ Capacitor installed and configured
2. ✅ Android platform added
3. ✅ Capacitor config created (`capacitor.config.ts`)
4. ✅ Android project synced
5. ✅ Permissions configured (INTERNET permission added)

## 📱 Next Steps to Build APK

### Option 1: Using Android Studio (Recommended)

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - Install with default settings (includes Java JDK and Android SDK)

2. **Open Project in Android Studio**
   ```bash
   npx cap open android
   ```
   Or manually: Open Android Studio → Open → Select `android` folder

3. **Wait for Gradle Sync**
   - Android Studio will automatically sync Gradle dependencies
   - This may take 5-10 minutes on first run

4. **Build Debug APK (No Signing Required)**
   - In Android Studio: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - Or use menu: **Build** → **Generate Signed Bundle / APK** → Choose **APK** → **debug** (no signing needed)
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

5. **Build Release APK (For Distribution)**
   - **Build** → **Generate Signed Bundle / APK**
   - Choose **APK**
   - Create a new keystore (or use existing)
   - Fill in keystore details:
     - Key store path: (choose location)
     - Password: (remember this!)
     - Key alias: (e.g., `farm2market`)
     - Key password: (remember this!)
   - Build type: **release**
   - APK location: `android/app/release/app-release.apk`

### Option 2: Command Line (Requires Java & Android SDK)

If you have Java JDK and Android SDK installed:

```bash
cd android
.\gradlew.bat assembleDebug    # For debug APK
.\gradlew.bat assembleRelease  # For release APK (requires signing)
```

## 📍 APK Locations

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/release/app-release.apk` (after signing)

## 🔧 Configuration

Your app is configured to load from:
- **Vercel URL**: `https://farm2market-dev.vercel.app`
- **App ID**: `com.farm2marketuganda.app`
- **App Name**: `Farm2Market Uganda`

To change the Vercel URL, edit `capacitor.config.ts`:
```typescript
server: {
  url: 'https://your-production-url.vercel.app',
  cleartext: false
}
```

## ⚠️ Important Notes

1. **No Static Files Needed**: Since we're using `server.url`, the app loads directly from Vercel. No need to build Next.js static files.

2. **Updates**: When you update your Vercel deployment, the mobile app will automatically show the latest version (no need to rebuild APK).

3. **Internet Required**: The app requires internet connection to load from Vercel.

4. **Testing**: Install the debug APK on a device or emulator to test before building release APK.

## 🚀 Quick Start

1. Install Android Studio
2. Run: `npx cap open android`
3. Wait for Gradle sync
4. Build → Build APK(s)
5. Find APK in `android/app/build/outputs/apk/debug/`
