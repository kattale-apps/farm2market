# Manual Keystore Creation Instructions

Since automated keystore creation requires interactive input, please create the keystore manually using one of these methods:

## Method 1: Using Android Studio

1. Open Android Studio
2. Go to **Build** → **Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Click **Create new...** under "Key store path"
5. Fill in the keystore information:
   - **Key store path**: `android/app/farm2market-release.keystore`
   - **Password**: (choose a strong password - save it securely!)
   - **Key alias**: `farm2market`
   - **Key password**: (can be same as keystore password)
   - **Validity**: 25 years (10000 days)
   - **Certificate information**:
     - First and Last Name: Your name
     - Organizational Unit: Farm2Market Uganda
     - Organization: Farm2Market Uganda
     - City: Your city
     - State: Your state/province
     - Country Code: UG (for Uganda)
6. Click **OK** to create the keystore
7. Android Studio will automatically create `keystore.properties` for you

## Method 2: Using Command Line (keytool)

Open a terminal in the `android` directory and run:

```powershell
cd android

# Set JAVA_HOME if needed
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Create keystore
& "$env:JAVA_HOME\bin\keytool.exe" -genkey -v -keystore app\farm2market-release.keystore -alias farm2market -keyalg RSA -keysize 2048 -validity 10000
```

You will be prompted for:
- Keystore password (save this!)
- Key password (can be same)
- Your name, organization, city, state, country (UG for Uganda)

## Method 3: Create keystore.properties Manually

If you already have a keystore file, create `android/keystore.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=farm2market
storeFile=app/farm2market-release.keystore
```

Replace `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` with your actual passwords.

## After Creating Keystore

Once you have:
1. ✅ `android/app/farm2market-release.keystore` file
2. ✅ `android/keystore.properties` file with correct passwords

Run:
```powershell
cd android
.\gradlew.bat bundleRelease
```

## Important Notes

- **NEVER** commit `keystore.properties` or the keystore file to git
- **SAVE** your passwords securely - you'll need them for all future updates
- **BACKUP** your keystore file - if you lose it, you cannot update your app on Google Play Store
- The keystore is already in `.gitignore` to prevent accidental commits
