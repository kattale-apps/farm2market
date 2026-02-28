"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/app/components/RoleGuard";

export default function SuperadminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/superadmin/usage");
  }, [router]);

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    </RoleGuard>
  );
}
