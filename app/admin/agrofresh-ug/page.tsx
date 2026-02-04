"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import * as XLSX from "xlsx";

type StatusFilter = "SUBMITTED" | "VERIFIED" | "DRAFT" | "all";

export default function AgroFreshUGAdminPage() {
  const [adminId, setAdminId] = useState<Id<"users"> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("SUBMITTED");
  const [selectedFormId, setSelectedFormId] = useState<Id<"agroFreshUGFarmValidations"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("pilot_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAdminId(parsed.userId);
      } catch {
        setAdminId(null);
      }
    }
  }, []);

  const forms = useQuery(
    api.farmValidation.getSubmittedForms,
    adminId
      ? { adminId, status: statusFilter === "all" ? undefined : statusFilter }
      : "skip"
  );

  const selectedForm = useQuery(
    api.farmValidation.getFormByIdAdmin,
    adminId && selectedFormId ? { adminId, formId: selectedFormId } : "skip"
  );

  const verifyForm = useMutation(api.farmValidation.verifyForm);

  const rows = useMemo(() => {
    if (!forms) return [];
    return forms.map((f: any) => ({
      id: f._id,
      status: f.status,
      farmerName: f.section1?.farmerFullName || f.farmer?.alias || "-",
      farmName: f.section1?.farmName || "-",
      district: f.section1?.district || "-",
      createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : "-",
    }));
  }, [forms]);

  const handleExport = () => {
    if (!forms || forms.length === 0) return;
    const data = forms.map((f: any) => ({
      formId: f._id,
      status: f.status,
      farmerAlias: f.farmer?.alias || "",
      farmerEmail: f.farmer?.email || "",
      farmerPhone: f.farmer?.phoneNumber || "",
      section1_farmerFullName: f.section1?.farmerFullName || "",
      section1_phoneNumber: f.section1?.phoneNumber || "",
      section1_nationalId: f.section1?.nationalId || "",
      section1_farmName: f.section1?.farmName || "",
      section1_district: f.section1?.district || "",
      section1_subCounty: f.section1?.subCounty || "",
      section1_parish: f.section1?.parish || "",
      section1_village: f.section1?.village || "",
      section1_farmSize: f.section1?.farmSize || "",
      section1_farmSizeUnit: f.section1?.farmSizeUnit || "",
      section1_mainEnterprise: f.section1?.mainEnterprise || "",
      section1_farmingExperience: f.section1?.farmingExperience || "",
      section1_waterSource: f.section1?.waterSource || "",
      section2_1_dairy_present: f.section2_1_dairy?.present ?? "",
      section2_2_poultry_present: f.section2_2_poultry?.present ?? "",
      section2_3_piggery_present: f.section2_3_piggery?.present ?? "",
      section2_4_cuniculture_present: f.section2_4_cuniculture?.present ?? "",
      section2_5_apiary_present: f.section2_5_apiary?.present ?? "",
      section2_6_aquaculture_present: f.section2_6_aquaculture?.present ?? "",
      section2_7_banana_present: f.section2_7_banana?.present ?? "",
      section2_8_maize_present: f.section2_8_maize?.present ?? "",
      section2_9_fruitTrees_present: f.section2_9_fruitTrees?.present ?? "",
      section2_10_woodyForest_present: f.section2_10_woodyForest?.present ?? "",
      createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : "",
      updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AgroFreshUG");
    XLSX.writeFile(workbook, "agrofresh_ug_validations.xlsx");
  };

  if (!adminId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>AGROFRESH UG — Farm Validation Review</h1>
        <Link href="/admin" style={{ color: "#1976d2", textDecoration: "none" }}>
          ← Back to Admin
        </Link>
      </div>

      {message && (
        <div style={{ marginBottom: "1rem", color: message.type === "success" ? "#2e7d32" : "#c62828" }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="SUBMITTED">Submitted</option>
          <option value="VERIFIED">Verified</option>
          <option value="DRAFT">Draft</option>
          <option value="all">All</option>
        </select>

        <button onClick={handleExport} style={{ padding: "0.5rem 0.9rem" }}>
          Export Excel
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem" }}>
          <h3>Submitted Forms</h3>
          {!rows || rows.length === 0 ? (
            <p style={{ color: "#777" }}>No forms found.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {rows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #eee",
                    borderRadius: 6,
                    background: selectedFormId === row.id ? "#f1f8ff" : "#fafafa",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedFormId(row.id)}
                >
                  <div style={{ fontWeight: 600 }}>{row.farmerName}</div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>{row.farmName} • {row.district}</div>
                  <div style={{ fontSize: "0.8rem", color: "#999" }}>Status: {row.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem" }}>
          <h3>Form Details</h3>
          {!selectedFormId ? (
            <p style={{ color: "#777" }}>Select a form to view details.</p>
          ) : !selectedForm ? (
            <p style={{ color: "#777" }}>Loading form...</p>
          ) : (
            <div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", background: "#f8f8f8", padding: "0.75rem", borderRadius: 6 }}>
                {JSON.stringify(selectedForm, null, 2)}
              </pre>
              {selectedForm.status === "SUBMITTED" && (
                <button
                  onClick={async () => {
                    try {
                      await verifyForm({ adminId, formId: selectedFormId });
                      setMessage({ type: "success", text: "Form verified successfully." });
                    } catch (err: any) {
                      setMessage({ type: "error", text: err?.message || "Failed to verify" });
                    }
                  }}
                  style={{ marginTop: "0.75rem", padding: "0.6rem 1rem" }}
                >
                  Verify Form
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}