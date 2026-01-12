# Google Play Store Setup Guide

## App Icon Requirements

### ✅ Icons Created

All required Android app icon sizes have been generated from your background image:

- **mipmap-mdpi**: 48x48px
- **mipmap-hdpi**: 72x72px  
- **mipmap-xhdpi**: 96x96px
- **mipmap-xxhdpi**: 144x144px
- **mipmap-xxxhdpi**: 192x192px

### Google Play Store Icon

**Location**: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_play_store.png`

**Size**: 512x512px (HD quality, PNG format)

**Usage**: 
1. Copy this file to use as your Google Play Store icon
2. Upload it in Google Play Console → App → Store listing → Graphics → App icon

## Icon Quality

- ✅ High-quality rendering (bicubic interpolation)
- ✅ PNG format (supports transparency)
- ✅ All density variants created
- ✅ Adaptive icon foreground created
- ✅ Round icon variants created

## Transparency Note

The source image (JPG) doesn't have transparency. The generated PNG icons will:
- Maintain image quality
- Support transparency if you edit them later
- Work perfectly for app icons

If you need transparency in specific areas, you can:
1. Edit the PNG files with an image editor (GIMP, Photoshop, etc.)
2. Remove backgrounds as needed
3. The icons will preserve transparency

## Next Steps for Google Play Store

1. **Prepare App Icon (512x512)**
   - File: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_play_store.png`
   - Format: PNG
   - Size: 512x512px
   - Upload to: Google Play Console → Store listing → Graphics

2. **Prepare Feature Graphic (1024x500)**
   - Optional but recommended
   - Used on the Play Store listing page
   - Can be created from the same background image

3. **Prepare Screenshots**
   - Phone: 16:9 or 9:16 aspect ratio
   - Tablet: 16:9 or 9:16 aspect ratio
   - Minimum: 320px, Maximum: 3840px

4. **App Signing**
   - Your app is already configured for signing
   - Build release APK: `.\gradlew.bat assembleRelease`
   - Or use Android App Bundle: `.\gradlew.bat bundleRelease`

## Building Release Version

To create a release build for Google Play Store:

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat bundleRelease
```

The AAB file will be in: `android/app/build/outputs/bundle/release/app-release.aab`

Upload this AAB file to Google Play Console.

## Icon Files Location

All icons are in: `android/app/src/main/res/mipmap-*/`

- `ic_launcher.png` - Main app icon
- `ic_launcher_round.png` - Round icon variant
- `ic_launcher_foreground.png` - Adaptive icon foreground layer
- `ic_launcher_play_store.png` - Google Play Store icon (512x512)
