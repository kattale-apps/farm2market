"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function CommunityDashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userAdminCategory, setUserAdminCategory] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Community IDs and logo helpers
  const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";
  const DEIGRO_COMMUNITY_ID = "ms7b1qga2n0kwjvczv3n1dqwwx809p81";

  const getCommunityLogo = (communityId: string | Id<"communities">) => {
    const idStr = String(communityId);
    if (idStr === BIOFARM_COMMUNITY_ID) return "/biofarmlogo.jpeg";
    if (idStr === DEIGRO_COMMUNITY_ID) return "/deilogo.png";
    return "/agrofreshlogo.png";
  };
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<"communityApplications"> | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [exportCommunityId, setExportCommunityId] = useState<Id<"communities"> | null>(null);
  const [exportCommunityName, setExportCommunityName] = useState<string>("");

  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    userId ? { userId } : "skip"
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );

  // Filter state
  const [filterType, setFilterType] = useState<"all" | "phone" | "email" | "location">( "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "district" | "subcounty" | "parish">("all");

  // Get current user
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUserId(parsed.userId);
          setUserRole(parsed.role || "");
          setUserAdminCategory(parsed.adminCategory || "");
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const currentUser = useQuery(
    api.auth.getUser,
    userId ? { userId } : "skip"
  );

  const resolvedRole = currentUser?.role ?? userRole;
  const resolvedAdminCategory =
    (currentUser as any)?.adminCategory ?? userAdminCategory;

  // Query communities (filtered to show only the user's community if they're a community admin)
  const communities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  // Query export quota
  const exportQuota = useQuery(api.communities.getExportQuota, userId ? { userId } : "skip");

  // Mutation for logging exports
  const logExport = useMutation(api.communities.logExport);
  const approveApplication = useMutation(api.communityApplications.approveApplication);
  const rejectApplication = useMutation(api.communityApplications.rejectApplication);
  const revokeMembership = useMutation(api.communityApplications.revokeMembership);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedPageSize, setApprovedPageSize] = useState(20);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(20);
  const pendingPageKey = "community_pending_applications";
  const approvedPageKey = "community_approved_members";
  const membersPageKey = "community_members_list";

  useEffect(() => {
    if (!paginationPreferences) return;
    const defaultSize = paginationPreferences.defaultPageSize ?? 20;
    const nextPending = paginationPreferences.list?.[pendingPageKey] ?? defaultSize;
    const nextApproved = paginationPreferences.list?.[approvedPageKey] ?? defaultSize;
    const nextMembers = paginationPreferences.list?.[membersPageKey] ?? defaultSize;
    if (nextPending !== pendingPageSize) {
      setPendingPageSize(nextPending);
      setPendingPage(1);
    }
    if (nextApproved !== approvedPageSize) {
      setApprovedPageSize(nextApproved);
      setApprovedPage(1);
    }
    if (nextMembers !== membersPageSize) {
      setMembersPageSize(nextMembers);
      setMembersPage(1);
    }
  }, [paginationPreferences, pendingPageKey, approvedPageKey, membersPageKey, pendingPageSize, approvedPageSize, membersPageSize]);

  const selectedApplicationDetails = useQuery(
    api.communityApplications.getApplicationDetails,
    userId && selectedApplicationId
      ? { adminId: userId, applicationId: selectedApplicationId }
      : "skip"
  );

  // For community admin: get their managed community
  const userCommunities = useMemo(() => {
    if (!communities) return [];
    // Backend already enforces community-admin access. Use the returned list.
    return communities;
  }, [communities]);

  const communityIds = useMemo(
    () => userCommunities.map((c: any) => c._id ?? c.id).filter(Boolean),
    [userCommunities]
  );
  const applicationsByCommunity = useQuery(
    api.communityApplications.getApplicationsByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
          status: "PENDING",
        }
      : "skip"
  );
  const approvedMembersByCommunity = useQuery(
    api.communityApplications.getCommunityMembersByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
          status: "APPROVED",
        }
      : "skip"
  );

  const exportMembersData = useQuery(
    api.communityApplications.getCommunityMemberExportData,
    userId && exportCommunityId
      ? {
          adminId: userId,
          communityId: exportCommunityId,
          status: "APPROVED",
        }
      : "skip"
  );

  // ✅ OPTION A: Conservative Export - Profile Only + Metadata
  // Excludes all nested form fields to prevent data leaks across communities
  // Ensures clean, auditable row/column counts for future billing
  const buildExportRows = useCallback((items: any[]) => {
    return items.map((item: any) => {
      const farmer = item.farmer || {};
      const application = item.application || {};

      // ✅ SECURITY: Only export application metadata (no form fields)
      const applicationMetadata = {
        "Application Id": application?._id || "",
        "Application Status": item.status || application?.status || "",
        "Application Created": application?.createdAt
          ? new Date(application.createdAt).toLocaleString()
          : "",
        "Application Updated": application?.updatedAt
          ? new Date(application.updatedAt).toLocaleString()
          : "",
        "Member Since": item.joinedAt ? new Date(item.joinedAt).toLocaleString() : "",
      };

      // ✅ SECURITY: Only export profile onboarding fields from farmer record
      // These are the standard fields every farmer fills during registration
      // No community-specific form fields are included
      const profileOnboarding = {
        "Farmer Name": farmer.alias || "",
        "Email": farmer.email || "",
        "Phone": farmer.phoneNumber || "",
        "Region": farmer.region || "",
        "District": farmer.districtText || "",
        "Subcounty": farmer.subCountyText || "",
        "County": farmer.county || "",
        "Village": farmer.village || "",
        "Farm Size (Acres)": farmer.farmSizeAcres ?? "",
        "Water Source": farmer.waterSource || "",
      };

      // Combine: metadata first, then profile fields
      // Clean, flat structure - easy to audit for billing
      return {
        ...applicationMetadata,
        ...profileOnboarding,
      };
    });
  }, []);

  const handleExportMembers = (communityId: Id<"communities">, communityName: string) => {
    if (!userId) return;
    setLoading(true);
    setMessage(null);
    setExportCommunityId(communityId);
    setExportCommunityName(communityName);
  };

  useEffect(() => {
    if (!exportCommunityId) return;
    if (exportMembersData === undefined) return;

    if ((exportMembersData as any)?.error) {
      setMessage({ type: "error", text: (exportMembersData as any).error });
      setLoading(false);
      setExportCommunityId(null);
      return;
    }

    if (!Array.isArray(exportMembersData)) return;

    const rows = buildExportRows(exportMembersData);

    try {
      logExport({
        userId: userId as any,
        exportType: "community_members",
        dataCount: rows.length,
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Members");
      const safeName = exportCommunityName || "community";
      XLSX.writeFile(wb, `${safeName}-members-full.xlsx`);
      setMessage({ type: "success", text: "Members exported successfully!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to export members" });
    } finally {
      setLoading(false);
      setExportCommunityId(null);
      setExportCommunityName("");
    }
  }, [exportMembersData, exportCommunityId, exportCommunityName, logExport, userId, buildExportRows]);

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Only community admins can access this page
  if (resolvedRole !== "admin") {
    return (
      <div style={{
        padding: "2rem",
        textAlign: "center",
        color: "#c62828",
        background: "#ffebee",
        borderRadius: "8px",
        marginTop: "2rem",
        marginBottom: "2rem",
      }}>
        <h2>Access Denied</h2>
        <p>Only admins can access this page.</p>
        <Link href="/" style={{
          color: "#1976d2",
          textDecoration: "none",
        }}>
          Go back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        backgroundImage: "url('/background/farm-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          padding: isMobile ? "1.25rem" : "2rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "0.75rem" : "0",
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "1rem",
                boxShadow: "0 4px 10px rgba(15,23,42,0.4)",
              }}
            >
              <span style={{ fontSize: "1rem" }}>←</span>
              <span>Back</span>
            </Link>
            <h1 style={{
              fontSize: "clamp(1.8rem, 5vw, 2.2rem)",
              marginTop: "0.5rem",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em",
            }}>
              Community Dashboard
            </h1>
          </div>
          <Link href="/admin/change-password" style={{
            padding: "0.75rem 1.5rem",
            background: "#ff9800",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: "600",
            whiteSpace: "nowrap",
          }}>
            Change Password
          </Link>
        </div>

        {/* Message Alert */}
        {message && (
          <div style={{
            padding: "1rem",
            marginBottom: "2rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            border: `1px solid ${message.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
          }}>
            {message.text}
          </div>
        )}
        {applicationsByCommunity?.some((c: any) => c.error) && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
          }}>
            {applicationsByCommunity.find((c: any) => c.error)?.error}
          </div>
        )}
        {approvedMembersByCommunity?.some((c: any) => c.error) && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
          }}>
            {approvedMembersByCommunity.find((c: any) => c.error)?.error}
          </div>
        )}

        {/* Communities */}
        {communities === undefined ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            <p>Loading communities...</p>
          </div>
        ) : userCommunities.length === 0 ? (
          <div style={{
            background: "#fff",
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}>
            <p style={{ color: "#999" }}>No communities found.</p>
          </div>
        ) : (
          userCommunities.map((community: any) => {
            const communityId = community?._id ?? community?.id;
            return (
              <div
                key={communityId}
                style={{
                  background: `linear-gradient(rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.96)), url('${getCommunityLogo(communityId)}')`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  marginBottom: "2rem",
                  overflow: "hidden",
                }}
              >
                {/* Community Header */}
                <div
                  style={{
                    padding: "1.5rem",
                    background: "linear-gradient(135deg, #f5f5f5 0%, #e8f5e9 100%)",
                    borderBottom: "2px solid #e0e0e0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.25rem",
                      marginBottom: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "16px",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={getCommunityLogo(communityId)}
                        alt={`${community.name} logo`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                    <div>
                      <h2
                        style={{
                          margin: "0 0 0.4rem 0",
                          fontSize: "1.6rem",
                          fontFamily: '"Montserrat", sans-serif',
                          fontWeight: 800,
                          color: "#1b5e20",
                          letterSpacing: "-0.03em",
                          textTransform: "uppercase",
                        }}
                      >
                        {community.name}
                      </h2>
                      {community.description && (
                        <p
                          style={{
                            margin: 0,
                            color: "#374151",
                            fontSize: "0.95rem",
                            maxWidth: "32rem",
                          }}
                        >
                          {community.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      gap: "1.5rem",
                      fontSize: "0.9rem",
                      color: "#424242",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>Members:</strong> {community.memberCount}
                    </div>
                    {community.isGlobal && (
                      <div
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background: "#e3f2fd",
                          color: "#1565c0",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        Global Community
                      </div>
                    )}
                    {community.geoLocked && (
                      <div
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background: "#fff3e0",
                          color: "#ef6c00",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        Geo-locked
                      </div>
                    )}
                  </div>
                </div>

              {/* Pending Applications */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #eee" }}>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.05rem",
                  fontWeight: "600",
                  color: "#2c2c2c",
                }}>
                  Pending Applications
                </h3>
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                  <select
                    value={pendingPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setPendingPageSize(nextSize);
                      setPendingPage(1);
                      updatePaginationPreferences({
                        userId: userId as any,
                        listKey: pendingPageKey,
                        pageSize: nextSize,
                      } as any);
                    }}
                    style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                {applicationsByCommunity === undefined ? (
                  <p style={{ color: "#999" }}>Loading applications...</p>
                ) : (
                  (() => {
                    const pending =
                      applicationsByCommunity?.find((c: any) => c.communityId === communityId)?.applications || [];
                    const pendingTotal = pending.length;
                    const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / pendingPageSize));
                    const safePendingPage = Math.min(pendingPage, pendingTotalPages);
                    const pendingStart = pendingTotal === 0 ? 0 : (safePendingPage - 1) * pendingPageSize + 1;
                    const pendingEnd = Math.min(safePendingPage * pendingPageSize, pendingTotal);
                    const pagedPending = pending.slice(
                      (safePendingPage - 1) * pendingPageSize,
                      safePendingPage * pendingPageSize
                    );
                    if (pending.length === 0) {
                      return <p style={{ color: "#999" }}>No pending applications.</p>;
                    }
                    return (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                          <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "0.5rem" }}>Name</th>
                              <th style={{ padding: "0.5rem" }}>Farm Name</th>
                              <th style={{ padding: "0.5rem" }}>Phone</th>
                              <th style={{ padding: "0.5rem" }}>District</th>
                              <th style={{ padding: "0.5rem" }}>Submitted</th>
                              <th style={{ padding: "0.5rem" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedPending.map((app: any) => (
                              <tr key={app.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.farmerFullName || app.farmer?.alias || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.farmName || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.phoneNumber || app.farmer?.phoneNumber || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.districtSubCounty || app.farmer?.districtText || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.createdAt ? new Date(app.createdAt).toLocaleString() : "-"}</td>
                                <td style={{ padding: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => setSelectedApplicationId(app.id as any)}
                                    style={{ padding: "0.35rem 0.6rem" }}
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await approveApplication({ adminId: userId as any, applicationId: app.id as any });
                                        setMessage({ type: "success", text: "Application approved." });
                                      } catch (error: any) {
                                        setMessage({ type: "error", text: error?.message || "Failed to approve" });
                                      }
                                    }}
                                    style={{ padding: "0.35rem 0.6rem" }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await rejectApplication({ adminId: userId as any, applicationId: app.id as any });
                                        setMessage({ type: "success", text: "Application rejected." });
                                      } catch (error: any) {
                                        setMessage({ type: "error", text: error?.message || "Failed to reject" });
                                      }
                                    }}
                                    style={{ padding: "0.35rem 0.6rem" }}
                                  >
                                    Reject
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>
                            Showing {pendingStart}-{pendingEnd} of {pendingTotal}
                          </div>
                          {pendingTotalPages > 1 && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                                disabled={safePendingPage === 1}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safePendingPage === 1 ? "#f1f5f9" : "#fff",
                                  cursor: safePendingPage === 1 ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                                disabled={safePendingPage >= pendingTotalPages}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safePendingPage >= pendingTotalPages ? "#f1f5f9" : "#fff",
                                  cursor: safePendingPage >= pendingTotalPages ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Approved Members */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #eee" }}>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.05rem",
                  fontWeight: "600",
                  color: "#2c2c2c",
                }}>
                  Approved Members
                </h3>
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                  <select
                    value={approvedPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setApprovedPageSize(nextSize);
                      setApprovedPage(1);
                      updatePaginationPreferences({
                        userId: userId as any,
                        listKey: approvedPageKey,
                        pageSize: nextSize,
                      } as any);
                    }}
                    style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                {approvedMembersByCommunity === undefined ? (
                  <p style={{ color: "#999" }}>Loading members...</p>
                ) : (
                  (() => {
                    const approved =
                      approvedMembersByCommunity?.find((c: any) => c.communityId === communityId)?.members || [];
                    const approvedTotal = approved.length;
                    const approvedTotalPages = Math.max(1, Math.ceil(approvedTotal / approvedPageSize));
                    const safeApprovedPage = Math.min(approvedPage, approvedTotalPages);
                    const approvedStart = approvedTotal === 0 ? 0 : (safeApprovedPage - 1) * approvedPageSize + 1;
                    const approvedEnd = Math.min(safeApprovedPage * approvedPageSize, approvedTotal);
                    const pagedApproved = approved.slice(
                      (safeApprovedPage - 1) * approvedPageSize,
                      safeApprovedPage * approvedPageSize
                    );
                    if (approved.length === 0) {
                      return <p style={{ color: "#999" }}>No approved members.</p>;
                    }
                    return (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                          <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "0.5rem" }}>Name</th>
                              <th style={{ padding: "0.5rem" }}>Farm Name</th>
                              <th style={{ padding: "0.5rem" }}>Phone</th>
                              <th style={{ padding: "0.5rem" }}>District</th>
                              <th style={{ padding: "0.5rem" }}>Approved On</th>
                              <th style={{ padding: "0.5rem" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedApproved.map((member: any) => (
                              <tr key={member.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.5rem" }}>{member.form?.section1?.farmerFullName || member.farmer?.alias || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{member.form?.section1?.farmName || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{member.form?.section1?.phoneNumber || member.farmer?.phoneNumber || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{member.form?.section1?.districtSubCounty || member.farmer?.districtText || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{member.joinedAt ? new Date(member.joinedAt).toLocaleString() : "-"}</td>
                                <td style={{ padding: "0.5rem" }}>
                                  <button
                                    onClick={async () => {
                                      if (!member.applicationId) {
                                        setMessage({ type: "error", text: "No application linked for this member." });
                                        return;
                                      }
                                      try {
                                        await revokeMembership({ adminId: userId as any, applicationId: member.applicationId as any });
                                        setMessage({ type: "success", text: "Membership revoked." });
                                      } catch (error: any) {
                                        setMessage({ type: "error", text: error?.message || "Failed to revoke" });
                                      }
                                    }}
                                    style={{ padding: "0.35rem 0.6rem" }}
                                  >
                                    Revoke
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>
                            Showing {approvedStart}-{approvedEnd} of {approvedTotal}
                          </div>
                          {approvedTotalPages > 1 && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                onClick={() => setApprovedPage((p) => Math.max(1, p - 1))}
                                disabled={safeApprovedPage === 1}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safeApprovedPage === 1 ? "#f1f5f9" : "#fff",
                                  cursor: safeApprovedPage === 1 ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={() => setApprovedPage((p) => Math.min(approvedTotalPages, p + 1))}
                                disabled={safeApprovedPage >= approvedTotalPages}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safeApprovedPage >= approvedTotalPages ? "#f1f5f9" : "#fff",
                                  cursor: safeApprovedPage >= approvedTotalPages ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Members Section */}
              {community.members && community.members.length > 0 ? (
                <div style={{ padding: "1.5rem" }}>
                  <h3 style={{
                    margin: "0 0 1rem 0",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Members ({community.members.length})
                  </h3>
                  <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                    <select
                      value={membersPageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        setMembersPageSize(nextSize);
                        setMembersPage(1);
                        updatePaginationPreferences({
                          userId: userId as any,
                          listKey: membersPageKey,
                          pageSize: nextSize,
                        } as any);
                      }}
                      style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {/* Member List */}
                  <div style={{
                    overflowX: "auto",
                    marginTop: "1rem",
                  }}>
                    <table style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.9rem",
                    }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e0e0e0" }}>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Farmer Name
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Phone
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Email
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const members = community.members || [];
                          const membersTotal = members.length;
                          const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersPageSize));
                          const safeMembersPage = Math.min(membersPage, membersTotalPages);
                          const pagedMembers = members.slice(
                            (safeMembersPage - 1) * membersPageSize,
                            safeMembersPage * membersPageSize
                          );
                          return pagedMembers.map((member: any, idx: number) => (
                            <tr
                              key={member.userId || `${idx}-${member.alias || "member"}`}
                              style={{
                                background: idx % 2 === 0 ? "#fff" : "#fafafa",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              <td style={{ padding: "0.75rem", color: "#2c2c2c" }}>
                                {member.alias}
                              </td>
                              <td style={{ padding: "0.75rem", color: "#666" }}>
                                {member.phoneNumber || "—"}
                              </td>
                              <td style={{ padding: "0.75rem", color: "#666" }}>
                                {member.email || "—"}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {(() => {
                    const members = community.members || [];
                    const membersTotal = members.length;
                    const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersPageSize));
                    const safeMembersPage = Math.min(membersPage, membersTotalPages);
                    const membersStart = membersTotal === 0 ? 0 : (safeMembersPage - 1) * membersPageSize + 1;
                    const membersEnd = Math.min(safeMembersPage * membersPageSize, membersTotal);
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Showing {membersStart}-{membersEnd} of {membersTotal}
                        </div>
                        {membersTotalPages > 1 && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                              disabled={safeMembersPage === 1}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: safeMembersPage === 1 ? "#f1f5f9" : "#fff",
                                cursor: safeMembersPage === 1 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setMembersPage((p) => Math.min(membersTotalPages, p + 1))}
                              disabled={safeMembersPage >= membersTotalPages}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: safeMembersPage >= membersTotalPages ? "#f1f5f9" : "#fff",
                                cursor: safeMembersPage >= membersTotalPages ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Export Quota Info */}
                  {exportQuota && (
                    <div style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      background: exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffebee" : "#e3f2fd",
                      borderRadius: "8px",
                      border: `1px solid ${exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffcdd2" : "#bbdefb"}`,
                    }}>
                      <p style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: "0.9rem",
                        color: "#1565c0",
                        fontWeight: "600",
                      }}>
                        📊 Service Level: {exportQuota.serviceLevel}
                      </p>
                      {exportQuota.serviceLevel === "Standard" ? (
                        <p style={{
                          margin: "0",
                          fontSize: "0.85rem",
                          color: exportQuota.remaining === 0 ? "#c62828" : "#666",
                        }}>
                          Exports used this month: {exportQuota.used}/{exportQuota.limit} | Remaining: <strong>{exportQuota.remaining}</strong>
                        </p>
                      ) : (
                        <p style={{
                          margin: "0",
                          fontSize: "0.85rem",
                          color: "#2e7d32",
                        }}>
                          ✓ Unlimited exports
                        </p>
                      )}
                    </div>
                  )}

                  {/* Export Button */}
                  <div style={{ marginTop: "1.5rem" }}>
                    <button
                      onClick={() => handleExportMembers(communityId as any, community.name)}
                      disabled={loading || (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")}
                      style={{
                        padding: "0.75rem 1.5rem",
                        background: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "#ccc" : "#2196f3",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                        cursor: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "not-allowed" : "pointer",
                        opacity: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? 0.6 : 1,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                          (e.target as HTMLButtonElement).style.background = "#1976d2";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                          (e.target as HTMLButtonElement).style.background = "#2196f3";
                        }
                      }}
                    >
                      {loading ? "Exporting..." : "Export Members (Excel)"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "#999",
                }}>
                  <p>No members in this community yet.</p>
                </div>
              )}
            </div>
          );
          })
        )}
      </div>

      {selectedApplicationId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setSelectedApplicationId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 900,
              width: "100%",
              padding: isMobile ? "1rem" : "1.25rem",
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "0.5rem" : "0",
            }}>
              <h3 style={{ margin: 0 }}>Application Review</h3>
              <button
                onClick={() => setSelectedApplicationId(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {!selectedApplicationDetails ? (
              <p style={{ color: "#666", marginTop: "1rem" }}>Loading details...</p>
            ) : (selectedApplicationDetails as any).error ? (
              <p style={{ color: "#c62828", marginTop: "1rem" }}>
                {(selectedApplicationDetails as any).error}
              </p>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                {(() => {
                  const section1 = (selectedApplicationDetails as any)?.form?.section1 || {};
                  const farmer = (selectedApplicationDetails as any)?.farmer || {};
                  return (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: "0.75rem",
                    }}>
                      <div><strong>Farmer Name:</strong> {section1.farmerFullName || farmer.alias || "-"}</div>
                      <div><strong>Farm Name:</strong> {section1.farmName || "-"}</div>
                      <div><strong>Phone:</strong> {section1.phoneNumber || farmer.phoneNumber || "-"}</div>
                      <div><strong>Email:</strong> {section1.emailAddress || farmer.email || "-"}</div>
                      <div><strong>County:</strong> {section1.county || farmer.county || "-"}</div>
                      <div><strong>District/Subcounty:</strong> {section1.districtSubCounty || farmer.districtText || "-"}</div>
                      <div><strong>Village:</strong> {section1.village || farmer.village || "-"}</div>
                      <div><strong>Farm Size (Acres):</strong> {section1.farmSizeAcres || "-"}</div>
                      <div><strong>Main Enterprises:</strong> {(section1.mainEnterprises || []).join(", ") || "-"}</div>
                      <div><strong>System of Farming:</strong> {section1.systemOfFarming || "-"}</div>
                      <div><strong>Years of Experience:</strong> {section1.yearsOfExperience || "-"}</div>
                      <div><strong>Water Source:</strong> {section1.waterSource || farmer.waterSource || "-"}</div>
                    </div>
                  );
                })()}

                <div style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}>
                  <button
                    onClick={async () => {
                      try {
                        await approveApplication({ adminId: userId as any, applicationId: selectedApplicationId as any });
                        setMessage({ type: "success", text: "Application approved." });
                        setSelectedApplicationId(null);
                      } catch (error: any) {
                        setMessage({ type: "error", text: error?.message || "Failed to approve" });
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.9rem",
                      flex: isMobile ? "1 1 100%" : "0 0 auto",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await rejectApplication({ adminId: userId as any, applicationId: selectedApplicationId as any });
                        setMessage({ type: "success", text: "Application rejected." });
                        setSelectedApplicationId(null);
                      } catch (error: any) {
                        setMessage({ type: "error", text: error?.message || "Failed to reject" });
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.9rem",
                      flex: isMobile ? "1 1 100%" : "0 0 auto",
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
