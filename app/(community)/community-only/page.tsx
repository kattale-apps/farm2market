"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommunityOnlyPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect all users to the primary landing screen
    router.replace("/my-communities");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Redirecting to communities...</p>
    </div>
  );
}


