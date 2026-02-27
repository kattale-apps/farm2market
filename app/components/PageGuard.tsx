"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type AccessLevel = "superadmin" | "admin" | "member";

interface PageGuardProps {
  requiredAccess: AccessLevel;
  communityId?: Id<"communities">; // Required for admin/member access
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PageGuard({
  requiredAccess,
  communityId,
  children,
  fallback,
}: PageGuardProps) {
  const navContext = useQuery(api.communities.getMyNavigationContext);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!navContext) return;

    let authorized = false;

    if (requiredAccess === "superadmin") {
      authorized = navContext.isSuperadmin;
    } else if (requiredAccess === "admin") {
      if (!communityId) {
        authorized = false;
      } else {
        authorized = navContext.adminCommunities.some(
          (c) => c.communityId === communityId
        );
      }
    } else if (requiredAccess === "member") {
      if (!communityId) {
        authorized = false;
      } else {
        const isMember = navContext.joinedCommunities.some(
          (c) => c.communityId === communityId
        );
        const isAdmin = navContext.adminCommunities.some(
          (c) => c.communityId === communityId
        );
        authorized = isMember || isAdmin;
      }
    }

    setIsAuthorized(authorized);
    setIsLoading(false);
  }, [navContext, requiredAccess, communityId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
            <p className="text-gray-600 mb-6">
              {requiredAccess === "superadmin"
                ? "This page is for superadmins only."
                : requiredAccess === "admin"
                  ? "You must be a community admin to access this page."
                  : "You must be a community member to access this page."}
            </p>
            <a
              href="/my-communities"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              Back to Communities
            </a>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
