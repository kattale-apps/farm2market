"use client";

import React from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

type UserRole = "superadmin" | "communityAdmin" | "member";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  communityId?: string;
}

export default function RoleGuard({ children, allowedRoles, communityId }: RoleGuardProps) {
  const router = useRouter();
  const navContext = useQuery(api.communities.getMyNavigationContext);

  // Determine user role from nav context
  const getUserRole = (): UserRole | null => {
    if (!navContext) return null;

    // Check if superadmin
    if (navContext.isSuperadmin) {
      return "superadmin";
    }

    // Check if community admin for the specified community
    if (communityId && navContext.adminCommunities) {
      const isAdmin = navContext.adminCommunities.some(
        (c) => c.communityId === communityId
      );
      if (isAdmin) {
        return "communityAdmin";
      }
    }

    // Check if community member for the specified community
    if (communityId && navContext.joinedCommunities) {
      const isMember = navContext.joinedCommunities.some(
        (c) => c.communityId === communityId
      );
      if (isMember) {
        return "member";
      }
    }

    return null;
  };

  const userRole = getUserRole();
  const isAuthorized = userRole && allowedRoles.includes(userRole);

  // Determine redirect destination based on role
  const getRedirectDestination = (): string => {
    if (!navContext) return "/my-communities";

    // Superadmin
    if (navContext.isSuperadmin) {
      return "/superadmin/dashboard";
    }

    // Community admin
    if (navContext.adminCommunities.length > 0) {
      const firstAdmin = navContext.adminCommunities[0];
      return `/community-admin/${firstAdmin.communityId}/dashboard`;
    }

    // Regular member
    if (navContext.joinedCommunities.length > 0) {
      return "/my-communities";
    }

    return "/community-discovery";
  };

  // Loading state: Show spinner
  if (!navContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state: Show 403 screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Lock Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Content */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Access Restricted</h1>
          <p className="text-gray-600 mb-8">You don&apos;t have permission to view this area.</p>

          {/* Additional Info */}
          {!allowedRoles.includes("superadmin") && userRole && (
            <p className="text-sm text-gray-500 mb-6">
              Your role: <span className="font-semibold capitalize">{userRole.replace(/([A-Z])/g, " $1").trim()}</span>
            </p>
          )}

          {/* Button */}
          <button
            onClick={() => router.push(getRedirectDestination())}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Go to my dashboard
          </button>

          {/* Footer Text */}
          <p className="text-xs text-gray-500 mt-8">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    );
  }

  // Authorized: Render children
  return <>{children}</>;
}
