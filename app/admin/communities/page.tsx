"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export default function CommunitiesPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] =
    useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(
    null
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
    regionKey: "",
    communityType: "farmer" as "farmer" | "trader" | "buyer",
    assignAdminId: "",
  });

  const [editData, setEditData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
    regionKey: "",
  });

  // ✅ Queries
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  const communities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  // ❌ REMOVED (this caused the build failure)
  // const allUsers = useQuery(api.introspection.getAllUsers, ...)

  const createCommunity = useMutation(api.communities.createCommunity);
  const updateCommunity = useMutation(api.communities.updateCommunity);
  const deleteCommunity = useMutation(api.communities.deleteCommunity);

  // ✅ Role logic
  const adminLevel = (user as any)?.adminLevel;

  const isSuperAdmin =
    user?.role === "admin" &&
    (adminLevel === "super" ||
      (adminLevel === undefined && !(user as any)?.adminCategory));

  const isCommunityAdmin =
    user?.role === "admin" &&
    (user as any)?.adminCategory === "community";

  const canViewCommunityMembers = isSuperAdmin || isCommunityAdmin;

  // ✅ Filter communities for community admins (defensive)
  let filteredCommunities = communities;

  if (
    isCommunityAdmin &&
    user &&
    Array.isArray((user as any).assignedCommunityIds)
  ) {
    const assignedIds = (user as any).assignedCommunityIds.map(String);
    filteredCommunities = (communities || []).filter((c: any) =>
      assignedIds.includes(String(c.id))
    );
  }

  // ✅ Load userId from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("pilot_user");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (parsed.userId) {
        setUserId(parsed.userId as Id<"users">);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 🚫 Block unauthenticated access
  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access communities management.</p>
      </div>
    );
  }

  // ✅ UI
  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Grower Communities</h1>

      {filteredCommunities === undefined ? (
        <p>Loading communities...</p>
      ) : filteredCommunities.length === 0 ? (
        <p>No communities available.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredCommunities.map((community: any) => (
            <div
              key={community.id}
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "10px",
              }}
            >
              <h3>{community.name}</h3>
              {community.description && <p>{community.description}</p>}

              <p>
                Type:{" "}
                <strong>
                  {community.isGlobal ? "Global" : "Geo-Locked"}
                </strong>
              </p>

              {/* ✅ Assigned admin shown without allUsers */}
              {isSuperAdmin && (
                <p style={{ fontSize: "0.9rem", color: "#555" }}>
                  Assigned Admin:{" "}
                  {community.assignAdminId ? "Assigned" : "Unassigned"}
                </p>
              )}

              {isSuperAdmin && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => setEditingCommunityId(community.id)}>
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Are you sure you want to delete this community?"
                        )
                      )
                        return;
                      await deleteCommunity({
                        adminId: userId,
                        communityId: community.id,
                      });
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
