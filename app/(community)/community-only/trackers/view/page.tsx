"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useConvex } from "convex/react";
import { exportFormSubmissionsToPDF } from "@/app/utils/exportUtils";
import SubmissionPhotoGallery from "@/app/components/SubmissionPhotoGallery";

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
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [singleExportingId, setSingleExportingId] = useState<string | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);
  const convex = useConvex();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const submissions = useOfflineQuery(
    (api as any).forms.getMySubmissions,
    userId && communityId
      ? { memberId: userId, communityId, formId: formId || undefined }
      : "skip"
  ) as any;

  const selectedFormName = submissions?.[0]?.formName || "My Submissions";

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
            {submissions?.length ? `${submissions.length} submission(s)` : ""}
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

        {submissions && submissions.length === 0 && (
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
          {submissions && submissions.map((sub: any) => {
            const isExpanded = expandedId === String(sub._id);
            const isSelected = selectedSubmissionIds.has(String(sub._id));
            const photoValues = (sub.values || []).filter((v: any) => v.fieldType === "photo" && v.photoUrl);
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
                        checked={isSelected}
                        onChange={(e) => toggleSelectedSubmission(String(sub._id), e.target.checked)}
                      />
                      Select
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSingleExport(sub._id)}
                    disabled={singleExportingId === String(sub._id)}
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
                    {(sub.values || []).slice(0, 3).map((v: any, i: number) => (
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
                          {valueRow.value || "-"}
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
