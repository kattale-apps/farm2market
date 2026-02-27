/**
 * Community Native Bridge
 * 
 * Helper utilities for interacting with the Android CommunityBridge plugin.
 * Provides type-safe access to community configuration from native layer.
 * 
 * Usage:
 *   import { getCommunityIdFromNative, markAutoJoinComplete } from '@/app/utils/communityNativeBridge';
 *   
 *   const communityId = await getCommunityIdFromNative();
 *   if (communityId) {
 *     // Auto-join logic here
 *     await markAutoJoinComplete();
 *   }
 */

import { Capacitor } from '@capacitor/core';

interface CommunityBridgePlugin {
  getCommunityId(): Promise<{ communityId: string | null }>;
  getAutoJoinStatus(): Promise<{ hasAutoJoined: boolean }>;
  setAutoJoinComplete(): Promise<void>;
  setCommunityId(options: { communityId: string }): Promise<void>;
}

/**
 * Get the CommunityBridge plugin if running on native platform
 */
function getCommunityBridge(): CommunityBridgePlugin | null {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  
  try {
    // Access plugins dynamically using type casting
    const plugins = (Capacitor as any).Plugins;
    if (plugins && plugins.CommunityBridge) {
      return plugins.CommunityBridge as CommunityBridgePlugin;
    }
    return null;
  } catch (e) {
    console.warn('CommunityBridge plugin not available:', e);
    return null;
  }
}

/**
 * Get the preconfigured or selected community ID from native layer
 * Returns null if not running on native platform or no community configured
 */
export async function getCommunityIdFromNative(): Promise<string | null> {
  const bridge = getCommunityBridge();
  if (!bridge) return null;
  
  try {
    const result = await bridge.getCommunityId();
    return result.communityId;
  } catch (e) {
    console.error('Error getting community ID from native:', e);
    return null;
  }
}

/**
 * Check if auto-join has already been performed
 * Returns false if not on native platform
 */
export async function hasAutoJoinedFromNative(): Promise<boolean> {
  const bridge = getCommunityBridge();
  if (!bridge) return false;
  
  try {
    const result = await bridge.getAutoJoinStatus();
    return result.hasAutoJoined;
  } catch (e) {
    console.error('Error getting auto-join status from native:', e);
    return false;
  }
}

/**
 * Mark that auto-join has been completed
 * Safe to call on web platform (no-op)
 */
export async function markAutoJoinComplete(): Promise<void> {
  const bridge = getCommunityBridge();
  if (!bridge) return;
  
  try {
    await bridge.setAutoJoinComplete();
  } catch (e) {
    console.error('Error marking auto-join complete:', e);
  }
}

/**
 * Store a community ID in native storage
 * Safe to call on web platform (no-op)
 */
export async function setCommunityIdInNative(communityId: string): Promise<void> {
  const bridge = getCommunityBridge();
  if (!bridge) return;
  
  try {
    await bridge.setCommunityId({ communityId });
  } catch (e) {
    console.error('Error setting community ID in native:', e);
  }
}

/**
 * Check if currently running on native Android platform
 */
export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if currently running on native iOS platform
 */
export function isNativeIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Check if running on any native platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
