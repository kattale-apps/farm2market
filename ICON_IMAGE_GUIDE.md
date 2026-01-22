# Icon Image Guide

This guide helps you identify which of your images to use for each purpose.

## Image Recommendations Based on Your Images

### 1. **Main App Icon** (`app-icon-main.png`)
**Best Choice:** Money plant icon with **golden border** (square with rounded corners)

**Characteristics:**
- Square icon with rounded corners
- Thick, shiny golden border
- Central money plant (green plant with dollar signs)
- Golden coin at base
- Farm landscape background (fields, barn, sun)
- Bright, polished appearance

**Why:** This is the most polished, app-store-ready version with the golden border already included.

---

### 2. **Adaptive Icon Foreground** (`app-icon-foreground.png`)
**Best Choice:** Money plant icon **without border** (just the plant, coin, and landscape)

**Characteristics:**
- Same money plant design but without the golden frame
- Plant with dollar signs on leaves
- Golden coin at base
- Farm landscape background
- Clean edges suitable for circular cropping

**Why:** Android adaptive icons crop the edges, so we need the image without the border. The border will be added programmatically.

**Alternative:** If you only have the bordered version, the script will use it and crop appropriately.

---

### 3. **Adaptive Icon Background** (`app-icon-background.png`)
**Best Choice:** **Green gradient** image (bright green to dark green)

**Characteristics:**
- Smooth vertical gradient
- Bright green at top (#4CAF50)
- Dark green at bottom (#1B5E20)
- No complex details
- Simple, clean background

**Why:** Adaptive icon backgrounds should be simple and not compete with the foreground. A gradient provides depth without distraction.

**Alternative:** 
- If you have a landscape scene (fields, sky), that can work too
- If no image is provided, the script will auto-generate a green gradient

---

### 4. **Favicon Source** (`favicon-source.png`)
**Best Choice:** **Circular money plant** icon (the one in a perfect circle)

**Characteristics:**
- Perfect circular frame
- Money plant centered
- Simplified design
- High contrast
- Works well at small sizes (16x16, 32x32)

**Why:** Favicons need to be recognizable at very small sizes. The circular version is already optimized for this.

**Alternative:** Any of your money plant icons will work; the script will resize appropriately.

---

## Quick Setup Steps

1. **Save your images** in the project root with these exact names:
   ```
   app-icon-main.png          (money plant with golden border)
   app-icon-foreground.png   (money plant without border)
   app-icon-background.png   (green gradient)
   favicon-source.png        (circular money plant)
   ```

2. **Minimum requirement:** You only need `app-icon-main.png` - the script will use it as a fallback for everything else.

3. **Run the script:**
   ```powershell
   .\create-app-icons-advanced.ps1
   ```

---

## Image Quality Requirements

- **Format:** PNG (supports transparency)
- **Resolution:** 
  - Main icon: At least 512x512px (higher is better)
  - Others: Same as main or higher
- **Transparency:** Preserved for all icons
- **Colors:** RGB color space

---

## What Gets Generated

The script creates:

### Android Icons (all densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- `ic_launcher.png` - Main launcher icon (with gold border)
- `ic_launcher_round.png` - Round icon (circular with gold border)
- `ic_launcher_foreground.png` - Adaptive icon foreground (circular crop)
- `ic_launcher_background.png` - Adaptive icon background (gradient or image)
- `ic_launcher_play_store.png` - Google Play Store icon (512x512)

### Web Favicons
- `app/favicon-16.png` - 16x16px
- `app/favicon-32.png` - 32x32px
- `app/favicon-48.png` - 48x48px
- `app/favicon-64.png` - 64x64px
- `app/favicon.ico` - 32x32px (PNG format)

---

## Tips

1. **If you only have one image:** Save it as `app-icon-main.png` - the script will use it for everything.

2. **Golden border:** The script automatically adds a yellowish-gold border (RGB 212, 175, 55) to main and round icons, so you don't need to include it in your source images unless you want a custom border.

3. **Adaptive icons:** Android uses a "safe zone" (80% of the icon) - important elements should be centered to avoid being cropped.

4. **Testing:** After generating icons, rebuild your APK to see them in action:
   ```powershell
   cd android
   .\gradlew.bat assembleDebug
   ```

---

## Troubleshooting

**Q: Script says "No main icon image found"**
- Make sure you saved at least one image as `app-icon-main.png` or `app-icon.png` in the project root.

**Q: Icons look blurry**
- Use higher resolution source images (at least 512x512px, preferably 1024x1024px or higher).

**Q: I want to use different images**
- Just rename your images to match the expected filenames, or modify the script's `$mainOptions`, `$foregroundOptions`, etc. arrays.

**Q: Background doesn't look right**
- The script auto-generates a green gradient if no background image is found. To use your own, save it as `app-icon-background.png`.

---

## Next Steps

After generating icons:
1. Review the generated icons in `android/app/src/main/res/mipmap-*/`
2. Rebuild your APK: `cd android; .\gradlew.bat assembleDebug`
3. Test on a device or emulator
4. Update `app/layout.tsx` to reference the favicon files if needed
