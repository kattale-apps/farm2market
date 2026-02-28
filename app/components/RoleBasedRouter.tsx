"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Component that auto-routes users after login based on their role
 * 
 * Routes:
 * - Superadmin → /superadmin/dashboard
 * - Community Admin → /community-admin/[communityId]/dashboard
 * - Regular Member → /my-communities
 * - No Communities → /community-discovery
 */
export default function RoleBasedRouter() {
  const router = useRouter();
  const navContext = useQuery(api.communities.getMyNavigationContext);

  useEffect(() => {
    if (!navContext) {
      return; // Still loading
    }

    const { isSuperadmin, adminCommunities, joinedCommunities, defaultCommunityId } = navContext;

    // Route based on role
    if (isSuperadmin) {
      // Superadmin always goes to superadmin dashboard
      router.push("/superadmin/dashboard");
    } else if (adminCommunities.length > 0 && defaultCommunityId) {
      // Community admin -> default community dashboard
      router.push(`/community-admin/${defaultCommunityId}/dashboard`);
    } else if (joinedCommunities.length > 0) {
      // Member with joined communities - go to my communities
      router.push("/my-communities");
    } else {
      // No communities - go to discovery
      router.push("/community-discovery");
    }
  }, [navContext, router]);

  // Show loading while determining route
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Setting up your dashboard...</p>
      </div>
    </div>
  );
}
