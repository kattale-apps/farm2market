"use client";

import { useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import {
  getCommunityIdFromNative,
  hasAutoJoinedFromNative,
  markAutoJoinComplete,
  isNativePlatform,
} from '../utils/communityNativeBridge';
import { getStoredUser } from '../utils/authStorage';

const AUTO_JOIN_ENABLED_SLUGS = new Set(['kakira', 'kyagalanyi']);

/**
 * CommunityAutoJoin Component
 * 
 * Handles automatic community joining for community-branded APK builds.
 * 
 * Behavior:
 * - Only runs on native Android platform
 * - Only runs once per installation (tracked via native storage)
 * - Requires user to be logged in (checks localStorage for pilot_user)
 * - Joins community using slug from BuildConfig
 * - Marks auto-join as complete to prevent re-joining
 * - Silent operation - no UI
 * 
 * Integration:
 *   Add this component to your app layout or providers:
 *   
 *   <Providers>
 *     <CommunityAutoJoin />
 *     {children}
 *   </Providers>
 */
export function CommunityAutoJoin() {
  const joinCommunityByQr = useMutation(api.communities.joinCommunityByQr);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Prevent multiple execution
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    async function handleAutoJoin() {
      try {
        // Only run on native platform
        if (!isNativePlatform()) {
          console.log('[CommunityAutoJoin] Not on native platform, skipping');
          return;
        }

        // Check if community is configured for this APK
        const communitySlug = await getCommunityIdFromNative();
        if (!communitySlug) {
          console.log('[CommunityAutoJoin] No community configured, skipping');
          return;
        }

        if (!AUTO_JOIN_ENABLED_SLUGS.has(communitySlug)) {
          console.log(`[CommunityAutoJoin] Slug ${communitySlug} not enabled for rollout, skipping`);
          return;
        }

        // Check if already auto-joined
        const hasJoined = await hasAutoJoinedFromNative();
        if (hasJoined) {
          console.log('[CommunityAutoJoin] Already auto-joined, skipping');
          return;
        }

        // Wait a bit for user to be loaded
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get current user from storage
        const storedUser = await getStoredUser();
        if (!storedUser) {
          console.log('[CommunityAutoJoin] User not logged in yet, skipping');
          return;
        }

        const userId = storedUser.userId;
        if (!userId) {
          console.log('[CommunityAutoJoin] Invalid user data, skipping');
          return;
        }

        console.log(`[CommunityAutoJoin] Attempting join for slug=${communitySlug}`);

        const result = await joinCommunityByQr({
          slug: communitySlug,
          userId: userId as Id<'users'>,
        });
        console.log(
          `[CommunityAutoJoin] Join completed for slug=${communitySlug}; alreadyMember=${Boolean(result?.alreadyMember)}`,
        );
        
        // Mark as complete to prevent re-joining
        await markAutoJoinComplete();
        
        console.log('[CommunityAutoJoin] Auto-join completed successfully');
      } catch (error) {
        console.error('[CommunityAutoJoin] Failed to auto-join community:', error);
        // Don't mark as complete on error, so it can retry next launch
      }
    }

    handleAutoJoin();
  }, [joinCommunityByQr]);

  // This is a logic-only component with no UI
  return null;
}
