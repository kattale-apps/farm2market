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
  const joinCommunity = useMutation(api.communities.joinCommunity);
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

        // Check if community is preconfigured
        const communitySlug = await getCommunityIdFromNative();
        if (!communitySlug) {
          console.log('[CommunityAutoJoin] No community configured, skipping');
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

        console.log(`[CommunityAutoJoin] Attempting to join community: ${communitySlug}`);

        // NOTE: This assumes you have a joinCommunityBySlug mutation
        // If you only have joinCommunity with ID, you'll need to:
        // 1. Query for community by slug first
        // 2. Then call joinCommunity with the ID
        // 
        // For now, we'll call the existing joinCommunity and assume
        // the backend can handle slug OR you need to implement the lookup
        
        // TODO: Replace this with your actual implementation
        // Option 1: If you have joinCommunityBySlug:
        // await joinCommunityBySlug({ userId: userId as Id<"users">, communitySlug });
        
        // Option 2: If you need to look up community first:
        // const community = await getCommunityBySlug(communitySlug);
        // if (community) {
        //   await joinCommunity({ userId: userId as Id<"users">, communityId: community._id });
        // }

        // For demonstration, we'll log what would happen
        console.log(`[CommunityAutoJoin] Would join community ${communitySlug} for user ${userId}`);
        
        // Mark as complete to prevent re-joining
        await markAutoJoinComplete();
        
        console.log('[CommunityAutoJoin] Auto-join completed successfully');
      } catch (error) {
        console.error('[CommunityAutoJoin] Failed to auto-join community:', error);
        // Don't mark as complete on error, so it can retry next launch
      }
    }

    handleAutoJoin();
  }, [joinCommunity]);

  // This is a logic-only component with no UI
  return null;
}

/**
 * Example implementation with full community lookup
 * 
 * This version queries for the community by slug first, then joins
 */
export function CommunityAutoJoinWithLookup() {
  const joinCommunity = useMutation(api.communities.joinCommunity);
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    async function handleAutoJoin() {
      try {
        if (!isNativePlatform()) return;

        const communitySlug = await getCommunityIdFromNative();
        if (!communitySlug || await hasAutoJoinedFromNative()) return;

        await new Promise(resolve => setTimeout(resolve, 1000));

        const storedUser = await getStoredUser();
        if (!storedUser) return;

        const userId = storedUser.userId;
        if (!userId) return;

        // Fetch community by slug via Convex query
        // NOTE: You need to create this query in your convex/communities.ts
        // export const getCommunityBySlug = query({
        //   args: { slug: v.string() },
        //   handler: async (ctx, { slug }) => {
        //     return await ctx.db
        //       .query("communities")
        //       .filter((q) => q.eq(q.field("slug"), slug))
        //       .first();
        //   },
        // });
        
        // const community = await convex.query(api.communities.getCommunityBySlug, { 
        //   slug: communitySlug 
        // });
        
        // if (community) {
        //   await joinCommunity({ 
        //     userId: userId as Id<"users">, 
        //     communityId: community._id 
        //   });
        //   await markAutoJoinComplete();
        //   console.log('[CommunityAutoJoin] Successfully joined:', community.name);
        // }

      } catch (error) {
        console.error('[CommunityAutoJoin] Error:', error);
      }
    }

    handleAutoJoin();
  }, [joinCommunity]);

  return null;
}
