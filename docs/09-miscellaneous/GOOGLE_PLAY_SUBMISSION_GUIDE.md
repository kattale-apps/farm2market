# Complete Google Play Store Submission Guide

## ✅ What's Been Prepared

1. ✅ **Release signing configuration** - `android/app/build.gradle` updated
2. ✅ **Keystore creation script** - `android/create-keystore.ps1`
3. ✅ **Release build script** - `android/build-release.ps1`
4. ✅ **Store listing content** - `GOOGLE_PLAY_STORE_LISTING.md`
5. ✅ **Privacy policy template** - `PRIVACY_POLICY.md`
6. ✅ **App icons** - All sizes created (512x512 Play Store icon ready)
7. ✅ **Feature graphic** - `google-play-feature-graphic.png` (1024x500)

## 📋 Step-by-Step Submission Process

### Step 1: Create Release Keystore

**Run this ONCE to create your signing key:**

```powershell
cd android
.\create-keystore.ps1
```

**Important:** 
- Save the passwords securely
- You'll need them for ALL future app updates
- If lost, you cannot update your app on Play Store

### Step 2: Create keystore.properties

After running the keystore script, create `android/keystore.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=farm2market
storeFile=app/farm2market-release.keystore
```

**Replace** `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` with the actual passwords you entered.

### Step 3: Build Release AAB

**Build the release Android App Bundle:**

```powershell
cd android
.\build-release.ps1
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

### Step 4: Create Google Play Console Account

1. Go to: https://play.google.com/console
2. Sign in with your Google account
3. Pay the **one-time $25 registration fee**
4. Complete developer account setup

### Step 5: Create New App

1. Click **"Create app"**
2. Fill in:
   - **App name:** Farm2Market Uganda
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free (or Paid)
   - **Declarations:** Accept policies
3. Click **"Create app"**

### Step 6: Complete Store Listing

Use content from `GOOGLE_PLAY_STORE_LISTING.md`:

1. **App details:**
   - Short description: "Farm. Trade. Grow. Agricultural trading platform connecting farmers and traders in Uganda."
   - Full description: Copy from `GOOGLE_PLAY_STORE_LISTING.md`
   - App icon: Upload `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_play_store.png`

2. **Graphics:**
   - Feature graphic: Upload `google-play-feature-graphic.png`
   - Screenshots: Take 2-8 screenshots of your app
   - Phone screenshots: 16:9 or 9:16 ratio

3. **Categorization:**
   - App category: Business / Productivity
   - Tags: agriculture, trading, marketplace

4. **Contact details:**
   - Update email in `GOOGLE_PLAY_STORE_LISTING.md`
   - Website: https://farm2market-dev.vercel.app

### Step 7: Upload Release

1. Go to: **Production** → **Create new release**
2. Upload AAB: `android/app/build/outputs/bundle/release/app-release.aab`
3. Release name: "1.0" (matches versionName)
4. Release notes: "Initial release of Farm2Market Uganda"
5. Review and roll out to production

### Step 8: Complete Content Rating

1. Go to: **Content rating**
2. Complete questionnaire:
   - Category: Business/Productivity
   - Answer questions about content
3. Submit for rating (usually instant)

### Step 9: Privacy Policy

**Required:** You need a privacy policy URL.

1. Host `PRIVACY_POLICY.md` on your website
   - Create a page at: `https://farm2market-dev.vercel.app/privacy-policy`
   - Or use a service like GitHub Pages
2. Add URL in: **App content** → **Privacy Policy**
3. Update email in privacy policy before publishing

### Step 10: App Access

1. Go to: **App access**
2. If your app requires login, select "Restricted"
3. Provide explanation if needed

### Step 11: Target Audience

1. Go to: **Target audience and content**
2. Select appropriate age groups
3. Complete content questionnaire

### Step 12: Data Safety

1. Go to: **Data safety**
2. Declare:
   - Data collection (Firebase analytics, push notifications)
   - Data sharing (Pesapal for payments)
   - Security practices
   - Data deletion

### Step 13: Submit for Review

1. Review all sections (green checkmarks)
2. Click **"Submit for review"**
3. Review typically takes **1-3 days**
4. You'll receive email notifications

## 📝 Pre-Submission Checklist

**Before submitting:**

- [ ] Release keystore created (`farm2market-release.keystore`)
- [ ] `keystore.properties` file created with passwords
- [ ] Release AAB built successfully (`app-release.aab`)
- [ ] App icon (512x512) ready
- [ ] Feature graphic (1024x500) ready
- [ ] Screenshots taken (2-8 images)
- [ ] Privacy policy hosted online
- [ ] Store listing content written
- [ ] Email addresses updated in listing and privacy policy
- [ ] Google Play Console account created ($25 fee paid)

**Required Files:**
- [ ] `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_play_store.png`
- [ ] `google-play-feature-graphic.png`
- [ ] Screenshots (phone format)

## 🔄 Future Updates

When updating your app:

1. **Increment version:**
   - Edit `android/app/build.gradle`:
     ```gradle
     versionCode 2  // Increment by 1
     versionName "1.1"  // User-facing version
     ```

2. **Build new AAB:**
   ```powershell
   cd android
   .\build-release.ps1
   ```

3. **Upload to Play Console:**
   - Go to your app in Play Console
   - Production → Create new release
   - Upload new AAB
   - Add release notes
   - Submit

## ⚠️ Important Notes

1. **Keystore Security:**
   - **BACK UP** your keystore file
   - Store passwords securely
   - If lost, you **cannot** update your app

2. **Version Management:**
   - `versionCode` must always increase
   - `versionName` is what users see

3. **Testing:**
   - Test release AAB before uploading
   - Use internal testing track first
   - Then move to production

4. **Review Time:**
   - First submission: 1-3 days
   - Updates: Usually faster (hours to 1 day)

## 📞 Need Help?

If you encounter issues:
- Check Google Play Console help: https://support.google.com/googleplay/android-developer
- Review error messages in Play Console
- Ensure all required sections are completed

## 🎉 After Approval

Once approved:
- Your app will be live on Google Play Store
- Users can download and install
- You can track downloads and reviews
- Push notifications will work automatically

---

**Good luck with your submission!** 🚀
