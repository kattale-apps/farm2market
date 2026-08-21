# Community-Specific APK Implementation Guide

## Overview

This implementation adds community-specific configuration with deep link auto-join support and APK flavor builds without breaking existing functionality.

## Architecture

### Native Layer (Android)

1. **CommunityConfigManager.kt** - Manages community configuration
   - Stores community ID in SharedPreferences
   - Provides BuildConfig access for flavor-specific community slugs
   - Thread-safe singleton pattern

2. **CommunityBridge.kt** - Capacitor plugin for native ↔ web communication
   - Exposes community config to JavaScript
   - Methods: `getCommunityId()`, `getAutoJoinStatus()`, `setAutoJoinComplete()`, `setCommunityId()`

3. **MainActivity.java** - Activity with deep link handling
   - Registers CommunityBridge plugin
   - Handles deep links: `farm2market://community/{slug}` and `https://farm2market-dev.vercel.app/join/{slug}`
   - Stores community ID from deep links

### Web Layer (TypeScript)

4. **communityNativeBridge.ts** - TypeScript helper utilities
   - Type-safe wrapper for CommunityBridge plugin
   - Platform detection helpers
   - Safe fallbacks for non-native platforms

## Product Flavors

The app supports three build flavors:

| Flavor | App ID | App Name | Community Slug |
|--------|--------|----------|----------------|
| defaultCommunity | com.farm2marketuganda.app | FarmCoin | (empty) |
| kakira | com.farm2marketuganda.app.kakira | Kakira Farmers | kakira |
| kyagalanyi | com.farm2marketuganda.app.kyagalanyi | Kyagalanyi Farmers | kyagalanyi |

## Build Commands

```bash
# Build all flavors (debug)
cd android
./gradlew assembleDebug

# Build specific flavor
./gradlew assembleDefaultCommunityDebug
./gradlew assembleKakiraDebug
./gradlew assembleKyagalanyi Debug

# Build release APKs (requires keystore.properties)
./gradlew assembleDefaultCommunityRelease
./gradlew assembleKakiraRelease
./gradlew assembleKyagalanyiRelease

# Build all release APKs
./gradlew assembleRelease
```

Output APKs will be in: `android/app/build/outputs/apk/`

## Integration Example

### Auto-Join on App Launch

Add this to your app's initialization logic (e.g., in a layout or provider component):

```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  getCommunityIdFromNative,
  hasAutoJoinedFromNative,
  markAutoJoinComplete,
} from '@/app/utils/communityNativeBridge';

export function CommunityAutoJoin() {
  const router = useRouter();
  const joinCommunity = useMutation(api.communities.joinCommunityBySlug);

  useEffect(() => {
    async function handleAutoJoin() {
      // Check if running on native platform with preconfigured community
      const communitySlug = await getCommunityIdFromNative();
      if (!communitySlug) return; // Not on native or no community configured

      // Check if already auto-joined
      const hasJoined = await hasAutoJoinedFromNative();
      if (hasJoined) return; // Already processed

      // Get current user from localStorage
      const storedUser = localStorage.getItem('pilot_user');
      if (!storedUser) return; // Not logged in yet

      try {
        const { userId } = JSON.parse(storedUser);
        
        // Join the community
        await joinCommunity({ userId, communitySlug });
        
        // Mark as complete to prevent re-joining
        await markAutoJoinComplete();
        
        console.log(`Auto-joined community: ${communitySlug}`);
      } catch (error) {
        console.error('Failed to auto-join community:', error);
      }
    }

    handleAutoJoin();
  }, [joinCommunity]);

  return null; // This is a logic-only component
}
```

Then add it to your app:

```typescript
// app/layout.tsx or app/providers.tsx
import { CommunityAutoJoin } from './components/CommunityAutoJoin';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          <CommunityAutoJoin />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### Manual Community Selection with Native Sync

When a user manually selects a community, sync it to native storage:

```typescript
import { setCommunityIdInNative } from '@/app/utils/communityNativeBridge';

async function handleCommunityJoin(communitySlug: string) {
  // Join via API
  await joinCommunity({ userId, communitySlug });
  
  // Sync to native storage (no-op on web)
  await setCommunityIdInNative(communitySlug);
}
```

## Deep Link Testing

### Android ADB Commands

```bash
# Test farm2market:// scheme
adb shell am start -a android.intent.action.VIEW -d "farm2market://community/kakira" com.farm2marketuganda.app

# Test HTTPS scheme
adb shell am start -a android.intent.action.VIEW -d "https://farm2market-dev.vercel.app/join/kyagalanyi" com.farm2marketuganda.app
```

### QR Code Generation

You can generate QR codes for easy testing:

```bash
# Online: https://www.qr-code-generator.com/
# Enter: farm2market://community/kakira
```

## Backward Compatibility

✅ **Existing users unaffected** - All community logic checks for null/empty values
✅ **Default flavor has no community** - Behaves exactly like before
✅ **No authentication changes** - Login flow unchanged
✅ **No navigation changes** - All routes work as before
✅ **Web platform safe** - All native calls have fallbacks

## API Requirements

The Convex backend needs a mutation for joining by slug:

```typescript
// convex/communities.ts
export const joinCommunityBySlug = mutation({
  args: {
    userId: v.id("users"),
    communitySlug: v.string(),
  },
  handler: async (ctx, { userId, communitySlug }) => {
    // Find community by slug
    const community = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("slug"), communitySlug))
      .first();
    
    if (!community) {
      throw new Error(`Community not found: ${communitySlug}`);
    }
    
    // Join the community (reuse existing logic)
    return await joinCommunity(ctx, { userId, communityId: community._id });
  },
});
```

## Files Created/Modified

### Created Files:
1. `android/app/src/main/java/com/farm2market/uganda/CommunityConfigManager.kt`
2. `android/app/src/main/java/com/farm2market/uganda/CommunityBridge.kt`
3. `app/utils/communityNativeBridge.ts`

### Modified Files:
1. `android/app/build.gradle` - Added product flavors
2. `android/app/src/main/java/com/farm2market/uganda/MainActivity.java` - Added bridge registration and deep link handling
3. `android/app/src/main/AndroidManifest.xml` - Added deep link intent filters

## Security Considerations

- ✅ Community slugs are validated server-side
- ✅ Auto-join requires authenticated user
- ✅ Deep links only store slug, server validates existence
- ✅ No sensitive data in BuildConfig

## Next Steps

1. Add `joinCommunityBySlug` mutation to Convex if not exists
2. Add community slug field to communities schema if not exists
3. Integrate `CommunityAutoJoin` component into app
4. Build and test each flavor
5. Generate signing keys per flavor for Play Store
