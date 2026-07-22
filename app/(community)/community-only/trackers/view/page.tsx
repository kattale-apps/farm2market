"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useConvex } from "convex/react";
import { exportFormSubmissionsToPDF } from "@/app/utils/exportUtils";
import SubmissionPhotoGallery from "@/app/components/SubmissionPhotoGallery";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { offlineDb } from "@/app/lib/offlineDb";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

const CATEGORY_COLORS: Record<string, string> = {
  revenue: "#2e7d32",
  expense: "#d32f2f",
  inventory: "#1976d2",
  profit_loss: "#f57c00",
  cashflow: "#00838f",
  custom: "#7b1fa2",
};

export default function TrackerViewPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const formId = searchParams.get("formId") as Id<"communityForms"> | null;
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [singleExportingId, setSingleExportingId] = useState<string | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);
  const [localQueuedSubmissions, setLocalQueuedSubmissions] = useState<any[]>([]);
  const convex = useConvex();

  const submissions = useOfflineQuery(
    (api as any).forms.getMySubmissions,
    userId && communityId
      ? { memberId: userId, communityId, formId: formId || undefined }
      : "skip"
  ) as any;

  const selectedFormName = submissions?.[0]?.formName || "My Submissions";

  useEffect(() => {
    let cancelled = false;

    const loadQueued = async () => {
      if (!userId || !communityId) {
        if (!cancelled) setLocalQueuedSubmissions([]);
        return;
      }

      const rows = await offlineDb.pendingMutations
        .where("status")
        .anyOf("pending", "failed")
        .toArray();

      const queued = rows
        .filter((row: any) => {
          const path = String(row.mutationPath || "");
          const isTargetMutation =
            path.includes("forms.submitFormResponse") ||
            path.includes("forms:submitFormResponse") ||
            path.includes("forms.submitDraft") ||
            path.includes("forms:submitDraft");
          if (!isTargetMutation) return false;

          const args = row.args || {};
          if (String(args.memberId || "") !== String(userId)) return false;
          if (String(args.communityId || "") !== String(communityId)) return false;
          if (formId && String(args.formId || "") !== String(formId)) return false;
          return true;
        })
        .map((row: any) => ({
          _id: `queued-${row.id}`,
          formName: "Submission pending sync",
          category: "custom",
          createdAt: row.timestamp || Date.now(),
          values: [],
          localSyncStatus: row.status,
          localError: row.errorMsg,
        }));

      if (!cancelled) setLocalQueuedSubmissions(queued);
    };

    loadQueued().catch(() => {
      if (!cancelled) setLocalQueuedSubmissions([]);
    });

    const interval = setInterval(() => {
      loadQueued().catch(() => {
        if (!cancelled) setLocalQueuedSubmissions([]);
      });
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, communityId, formId]);

  const combinedSubmissions = [
    ...(submissions || []),
    ...localQueuedSubmissions,
  ].sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  const toggleSelectedSubmission = (submissionId: string, selected: boolean) => {
    setSelectedSubmissionIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(submissionId);
      else next.delete(submissionId);
      return next;
    });
  };

  const handleSingleExport = async (submissionId: Id<"formResponses">) => {
    setSingleExportingId(String(submissionId));
    try {
      const exportRows = await convex.query((api as any).forms.getSubmissionsForExport, {
        submissionIds: [submissionId],
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportFormSubmissionsToPDF(exportRows || [], `community_submission_${datePart}`);
    } catch {
      alert("Failed to export submission PDF.");
    }
    setSingleExportingId(null);
  };

  const handleBatchExport = async () => {
    if (selectedSubmissionIds.size === 0) return;
    setBatchExporting(true);
    try {
      const exportRows = await convex.query((api as any).forms.getSubmissionsForExport, {
        submissionIds: Array.from(selectedSubmissionIds) as Id<"formResponses">[],
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportFormSubmissionsToPDF(exportRows || [], `community_submissions_${datePart}`);
    } catch {
      alert("Failed to export selected submissions PDF.");
    }
    setBatchExporting(false);
  };

  if (!communityId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>No community selected.</p>
        <Link href="/my-communities" style={{ color: BRAND }}>Back to Communities</Link>
      </div>
    );
  }

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading user session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: BRAND }}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1rem",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}>
        <Link
          href={`/community-only/trackers?communityId=${communityId}`}
          style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
            {formId ? `📋 ${selectedFormName}` : "📋 My Submissions"}
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>
            {formId ? "Tap a card to open full entry view" : "Your business tracker entries"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.82rem", color: "#555", fontWeight: 600 }}>
            {combinedSubmissions.length ? `${combinedSubmissions.length} submission(s)` : ""}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setShowBatchOptions((prev) => !prev);
                if (showBatchOptions) setSelectedSubmissionIds(new Set());
              }}
              style={{
                padding: "0.35rem 0.6rem",
                borderRadius: 8,
                border: "1px solid #d0d7de",
                background: "#fff",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {showBatchOptions ? "Hide batch options" : "Show batch options"}
            </button>
            {showBatchOptions && (
              <button
                type="button"
                onClick={handleBatchExport}
                disabled={batchExporting || selectedSubmissionIds.size === 0}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: 8,
                  border: "none",
                  background: selectedSubmissionIds.size === 0 ? "#e0e0e0" : BRAND,
                  color: selectedSubmissionIds.size === 0 ? "#777" : "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: batchExporting || selectedSubmissionIds.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                {batchExporting ? "Exporting…" : `📥 Download PDF (Batch${selectedSubmissionIds.size ? `: ${selectedSubmissionIds.size}` : ""})`}
              </button>
            )}
          </div>
        </div>

        {!submissions && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</div>
        )}

        {submissions && combinedSubmissions.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</p>
            <p style={{ fontSize: "0.95rem" }}>No submissions yet.</p>
            <Link
              href={`/community-only/trackers?communityId=${communityId}`}
              style={{ color: BRAND, fontSize: "0.9rem" }}
            >
              Fill out a tracker →
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {submissions && combinedSubmissions.map((sub: any) => {
            const isExpanded = expandedId === String(sub._id);
            const isSelected = selectedSubmissionIds.has(String(sub._id));
            const isLocalQueued = Boolean(sub.localSyncStatus);
            const photoValues = (sub.values || []).filter((v: any) => v.fieldType === "camera" && v.photoUrl);
            return (
              <div key={sub._id} style={{
                padding: "0.85rem",
                borderRadius: 10,
                background: "#fff",
                border: "1px solid #e0e0e0",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: CATEGORY_COLORS[sub.category] || "#666",
                    }}>
                      {sub.category || "entry"}
                    </span>
                    <h3 style={{ margin: "0.1rem 0 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#1a1a1a", overflowWrap: "anywhere" }}>
                      {sub.formName}
                    </h3>
                  </div>
                  <span style={{
                    fontSize: "0.7rem",
                    color: "#888",
                    whiteSpace: "nowrap",
                  }}>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {sub.localSyncStatus && (
                  <div style={{ marginTop: "0.35rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.18rem 0.45rem",
                        borderRadius: 999,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        background: sub.localSyncStatus === "failed" ? "#ffebee" : "#fff8e1",
                        color: sub.localSyncStatus === "failed" ? "#c62828" : "#ef6c00",
                        border: `1px solid ${sub.localSyncStatus === "failed" ? "#ffcdd2" : "#ffe0b2"}`,
                      }}
                    >
                      {sub.localSyncStatus === "failed" ? "Sync failed" : "Pending sync"}
                    </span>
                    {sub.localError && (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "#c62828" }}>
                        {sub.localError}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(isExpanded ? null : String(sub._id))}
                  style={{
                    marginTop: "0.55rem",
                    border: "1px solid #d9d9d9",
                    background: isExpanded ? "#eef7ee" : "#f9f9f9",
                    color: isExpanded ? "#2e7d32" : "#555",
                    borderRadius: 8,
                    padding: "0.4rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? "▲ Close full view" : "▼ Open full view"}
                </button>

                <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                  {showBatchOptions && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#555" }}>
                      <input
                        type="checkbox"
                        disabled={isLocalQueued}
                        checked={isSelected}
                        onChange={(e) => toggleSelectedSubmission(String(sub._id), e.target.checked)}
                      />
                      Select
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSingleExport(sub._id)}
                    disabled={isLocalQueued || singleExportingId === String(sub._id)}
                    style={{
                      border: "1px solid #b7e1bc",
                      background: "#eef7ee",
                      color: BRAND,
                      borderRadius: 8,
                      padding: "0.32rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: singleExportingId === String(sub._id) ? "not-allowed" : "pointer",
                    }}
                  >
                    {singleExportingId === String(sub._id) ? "Preparing…" : "📥 Download PDF"}
                  </button>
                </div>

                {!isExpanded && (
                  <div style={{ marginTop: "0.45rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {(sub.values || []).filter((v: any) => v.fieldType !== "camera").slice(0, 3).map((v: any, i: number) => (
                      <span key={i} style={{
                        fontSize: "0.72rem",
                        background: "#f5f5f5",
                        padding: "0.15rem 0.4rem",
                        borderRadius: 4,
                        color: "#555",
                      }}>
                        {v.value}
                      </span>
                    ))}
                    {(sub.values || []).some((v: any) => v.fieldType === "camera") && (
                      <span style={{ fontSize: "0.72rem", background: "#e3f2fd", padding: "0.15rem 0.4rem", borderRadius: 4, color: "#1565c0" }}>📷 Photo</span>
                    )}
                    {(sub.values || []).length > 3 && (
                      <span style={{ fontSize: "0.72rem", color: "#999" }}>
                        +{sub.values.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: "0.6rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                    {sub.trackedUnit && (
                      <div style={{ marginBottom: "0.45rem", fontSize: "0.74rem", color: "#555" }}>
                        <strong>Tracked unit:</strong> {sub.trackedUnit.emoji || "🌱"} {sub.trackedUnit.name || sub.trackedUnit.unitType}
                      </div>
                    )}
                    {(sub.values || []).map((valueRow: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(100px, 42%) 1fr",
                          gap: "0.5rem",
                          padding: "0.35rem 0",
                          borderBottom: "1px dashed #f0f0f0",
                        }}
                      >
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", overflowWrap: "anywhere" }}>
                          {valueRow.fieldLabel || "Field"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#222", overflowWrap: "anywhere" }}>
                          {valueRow.fieldType === "camera" && valueRow.photoUrl
                            ? <img src={valueRow.photoUrl} alt="captured" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, border: "1px solid #e0e0e0", display: "block" }} />
                            : valueRow.fieldType === "camera"
                              ? <span style={{ color: "#999" }}>📷 (no photo)</span>
                              : (valueRow.value || "-")}
                        </div>
                      </div>
                    ))}

                    {photoValues.length > 0 && (
                      <div style={{ marginTop: "0.6rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "0.35rem" }}>
                          Photos ({photoValues.length})
                        </div>
                        <SubmissionPhotoGallery photos={photoValues.map((p: any) => p.photoUrl).filter(Boolean)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CommunityTabBar />
    </div>
  );
}
