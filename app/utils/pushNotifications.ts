/**
 * Push Notifications Service
 * 
 * Handles device registration and push notification setup
 * for notifications that work even when the app is closed.
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export interface PushNotificationToken {
  token: string;
  platform: 'android' | 'ios' | 'web';
}

/**
 * Initialize push notifications
 * Call this when the app starts
 */
export async function initializePushNotifications(
  onTokenReceived: (token: PushNotificationToken) => void,
  onNotificationReceived: (notification: any) => void,
  onNotificationActionPerformed: (action: any) => void
): Promise<void> {
  // Only initialize on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only work on native platforms');
    return;
  }

  try {
    // Request permission to send notifications
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Register for push notifications
    await PushNotifications.register();

    // Listen for registration
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      onTokenReceived({
        token: token.value,
        platform: Capacitor.getPlatform() as 'android' | 'ios',
      });
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Listen for push notifications received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      onNotificationReceived(notification);
    });

    // Listen for push notification actions (when user taps notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action performed', action);
      onNotificationActionPerformed(action);
    });

    console.log('Push notifications initialized successfully');
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
  }
}

/**
 * Get delivered notifications (notifications that are still in the notification center)
 */
export async function getDeliveredNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }
  
  try {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch (error) {
    console.error('Failed to get delivered notifications:', error);
    return [];
  }
}

/**
 * Remove all delivered notifications
 */
export async function removeAllDeliveredNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.error('Failed to remove delivered notifications:', error);
  }
}
