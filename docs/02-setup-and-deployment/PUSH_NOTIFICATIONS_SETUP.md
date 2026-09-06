# Push Notifications Setup Guide

## Overview

Push notifications have been integrated into the app to allow notifications to pop up on the screen even when the app is closed. The implementation uses:

- **Capacitor Push Notifications Plugin** - For device-level notification handling
- **Firebase Cloud Messaging (FCM)** - For Android push notifications
- **Convex Backend** - For device token storage and notification sending

## Current Status

✅ **Completed:**

- Capacitor Push Notifications plugin installed
- Android permissions configured
- Device token registration system
- Push notification service in app
- Backend functions for token management
- Integration with notification system

⚠️ **Pending (Required for Production):**

- Firebase project setup
- FCM server key configuration
- Actual FCM API integration

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add Android app to the project:
   - Package name: `com.farm2marketuganda.app`
   - Download `google-services.json`
   - Place it in `android/app/` directory

### 2. Configure FCM Server Key

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging**
2. Copy the **Server key** (legacy) or create a new service account
3. Add the key to Convex environment variables:
   ```bash
   npx convex env set FCM_SERVER_KEY "your-server-key-here"
   ```

### 3. Enable FCM in Code

1. Open `convex/pushNotifications.ts`
2. Find the `sendPushNotification` function
3. Uncomment the FCM implementation code (lines 181-221)
4. The code will automatically use the `FCM_SERVER_KEY` environment variable

### 4. Build and Test

1. Sync Capacitor:

   ```bash
   npx cap sync android
   ```

2. Rebuild the APK:

   ```bash
   cd android
   .\gradlew.bat assembleDebug
   ```

3. Install on device and test:
   - App will request notification permission on first launch
   - Device token will be registered automatically
   - Send a test notification from admin dashboard

## How It Works

### Device Registration

1. When user logs in, the app initializes push notifications
2. User grants notification permission
3. Device token is obtained from FCM
4. Token is registered with Convex backend
5. Token is stored in `deviceTokens` table

### Sending Notifications

1. Admin creates a notification (broadcast, role-based, or UTID-specific)
2. Notification is saved to database
3. Push notification is automatically scheduled for each recipient
4. FCM sends push notification to user's device
5. Notification appears even when app is closed

### Notification Handling

- **App Closed**: Notification appears in system notification tray
- **App Open**: Notification is received and can trigger in-app actions
- **User Taps**: App opens and can navigate to relevant screen

## Testing

1. Install the app on an Android device
2. Log in as any user
3. Check Convex dashboard to verify device token was registered
4. Send a test notification from admin dashboard
5. Verify notification appears even when app is closed

## Troubleshooting

### Notifications Not Appearing

1. Check device token is registered:
   - Query `deviceTokens` table in Convex
   - Verify token exists and `active: true`

2. Check FCM server key:
   - Verify `FCM_SERVER_KEY` is set in Convex environment
   - Test FCM API directly with curl/Postman

3. Check Android permissions:
   - Verify `POST_NOTIFICATIONS` permission is granted
   - Check app notification settings on device

### Token Registration Fails

1. Check internet connection
2. Verify user is logged in
3. Check browser console for errors
4. Verify Capacitor is properly configured

## Production Considerations

1. **Security**: Keep FCM server key secure, never commit to git
2. **Rate Limiting**: Implement rate limiting for notification sending
3. **Error Handling**: Handle invalid tokens gracefully
4. **Analytics**: Track notification delivery success/failure
5. **Battery Optimization**: Ensure notifications don't drain battery

## Next Steps

1. Complete Firebase project setup
2. Configure FCM server key
3. Test on physical device
4. Monitor notification delivery rates
5. Add notification analytics
