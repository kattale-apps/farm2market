"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" | "all";

export default function AgroFreshUGAdminPage() {
  const [adminId, setAdminId] = useState<Id<"users"> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<"communityApplications"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [subCountyFilter, setSubCountyFilter] = useState("");
  const [enterpriseFilter, setEnterpriseFilter] = useState("");

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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, startDate, endDate, districtFilter, subCountyFilter, enterpriseFilter, pageSize]);

  const approveApplication = useMutation(api.communityApplications.approveApplication);
  const rejectApplication = useMutation(api.communityApplications.rejectApplication);
  const revokeMembership = useMutation(api.communityApplications.revokeMembership);
  const syncAgroFreshAdmin = useMutation(api.communityApplications.syncAgroFreshAdmin);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    setSyncStatus("syncing");
    setSyncError(null);
    syncAgroFreshAdmin({ adminId })
      .then((res: any) => {
        if (cancelled) return;
        setSyncStatus("ready");
        if (res?.message) {
          setMessage({ type: "success", text: res.message });
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setSyncStatus("error");
        setSyncError(err?.message || "Unable to synchronize admin access.");
      });
    return () => {
      cancelled = true;
    };
  }, [adminId, syncAgroFreshAdmin]);

  const applications = useQuery(
    api.communityApplications.getPaginatedApplications,
    adminId && syncStatus === "ready"
      ? {
          adminId,
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          pageSize,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : undefined,
          district: districtFilter || undefined,
          subCounty: subCountyFilter || undefined,
          enterprise: enterpriseFilter || undefined,
        }
      : "skip"
  );

  const selectedDetails = useQuery(
    api.communityApplications.getApplicationDetails,
    adminId && syncStatus === "ready" && selectedApplicationId
      ? { adminId, applicationId: selectedApplicationId }
      : "skip"
  );

  const exportData = useQuery(
    api.communityApplications.getExportData,
    adminId && syncStatus === "ready"
      ? { adminId, status: statusFilter === "all" ? undefined : statusFilter }
      : "skip"
  );

  const rows = useMemo(() => {
    if (!applications) return [];
    return applications.items.map((item: any) => ({
      id: item.id,
      status: item.status,
      farmerName: item.form?.section1?.farmerFullName || item.farmer?.alias || "-",
      farmName: item.form?.section1?.farmName || "-",
      phone: item.form?.section1?.phoneNumber || item.farmer?.phoneNumber || "-",
      district: item.form?.section1?.districtSubCounty || item.farmer?.districtText || "-",
      createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : "-",
    }));
  }, [applications]);

  const buildExportRows = () => {
    if (!exportData || exportData.length === 0) return [];
    return exportData.map((row: any) => {
      const form = row.form || {};
      const farmer = row.farmer || {};
      const section1 = form.section1 || {};
      return {
        status: row.status || "",
        dateApplied: row.createdAt ? new Date(row.createdAt).toISOString() : "",
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
        deletedByFarmer: form.deletedByFarmer ? "Yes" : "No",
        deletedAt: form.deletedAt ? new Date(form.deletedAt).toISOString() : "",
        fullName: section1.farmerFullName || "",
        farmName: section1.farmName || "",
        phoneNumber: section1.phoneNumber || farmer.phoneNumber || "",
        emailAddress: section1.emailAddress || farmer.email || "",
        county: section1.county || farmer.county || "",
        districtSubCounty: section1.districtSubCounty || farmer.districtText || "",
        village: section1.village || farmer.village || "",
        farmSizeAcres: section1.farmSizeAcres || "",
        totalAreaAgProductionAcres: section1.totalAreaAgProductionAcres || "",
        totalAreaPlantedForestAcres: section1.totalAreaPlantedForestAcres || "",
        systemOfFarming: section1.systemOfFarming || "",
        systemOfFarmingOther: section1.systemOfFarmingOther || "",
        mainEnterprises: (section1.mainEnterprises || []).join(", "),
        otherCommercialActivity: section1.otherCommercialActivity || "",
        yearsOfExperience: section1.yearsOfExperience || "",
        waterSource: section1.waterSource || farmer.waterSource || "",
        waterSourceOther: section1.waterSourceOther || "",
        certifications: section1.certifications || "",
        dairy_systemOfFarming: form.section2_1_dairy?.systemOfFarming || "",
        dairy_enterpriseAreaAcres: form.section2_1_dairy?.enterpriseAreaAcres || "",
        dairy_currentLivestockIntensity: form.section2_1_dairy?.currentLivestockIntensity || "",
        dairy_numberOfMilkers: form.section2_1_dairy?.numberOfMilkers || "",
        dairy_milkProductivityDaily: form.section2_1_dairy?.milkProductivityDaily || "",
        dairy_accessToColdStorage: form.section2_1_dairy?.accessToColdStorage || "",
        dairy_marketPointOfSale: form.section2_1_dairy?.marketPointOfSale || "",
        dairy_transportToMarket: form.section2_1_dairy?.transportToMarket || "",
        poultry_systemOfFarming: form.section2_2_poultry?.systemOfFarming || "",
        poultry_enterpriseAreaAcres: form.section2_2_poultry?.enterpriseAreaAcres || "",
        poultry_currentPoultryIntensity: form.section2_2_poultry?.currentPoultryIntensity || "",
        poultry_typesOfChicken: (form.section2_2_poultry?.typesOfChicken || []).join(", "),
        poultry_accessToColdStorage: form.section2_2_poultry?.accessToColdStorage || "",
        poultry_marketPointOfSale: form.section2_2_poultry?.marketPointOfSale || "",
        poultry_transportToMarket: form.section2_2_poultry?.transportToMarket || "",
        piggery_systemOfFarming: form.section2_3_piggery?.systemOfFarming || "",
        piggery_enterpriseAreaAcres: form.section2_3_piggery?.enterpriseAreaAcres || "",
        piggery_currentPiggeryIntensity: form.section2_3_piggery?.currentPiggeryIntensity || "",
        piggery_product: form.section2_3_piggery?.product || "",
        piggery_accessToColdStorage: form.section2_3_piggery?.accessToColdStorage || "",
        piggery_marketPointOfSale: form.section2_3_piggery?.marketPointOfSale || "",
        piggery_transportToMarket: form.section2_3_piggery?.transportToMarket || "",
        rabbitry_systemOfFarming: form.section2_4_rabbitry?.systemOfFarming || "",
        rabbitry_enterpriseAreaAcres: form.section2_4_rabbitry?.enterpriseAreaAcres || "",
        rabbitry_currentRabbitryIntensity: form.section2_4_rabbitry?.currentRabbitryIntensity || "",
        rabbitry_mainProduct: (form.section2_4_rabbitry?.mainProduct || []).join(", "),
        rabbitry_accessToColdStorage: form.section2_4_rabbitry?.accessToColdStorage || "",
        rabbitry_marketPointOfSale: form.section2_4_rabbitry?.marketPointOfSale || "",
        rabbitry_transportToMarket: form.section2_4_rabbitry?.transportToMarket || "",
        apiary_systemOfFarming: form.section2_5_apiary?.systemOfFarming || "",
        apiary_enterpriseAreaAcres: form.section2_5_apiary?.enterpriseAreaAcres || "",
        apiary_currentApiaryIntensity: form.section2_5_apiary?.currentApiaryIntensity || "",
        apiary_mainProduct: form.section2_5_apiary?.mainProduct || "",
        apiary_accessToColdStorage: form.section2_5_apiary?.accessToColdStorage || "",
        apiary_marketPointOfSale: form.section2_5_apiary?.marketPointOfSale || "",
        apiary_transportToMarket: form.section2_5_apiary?.transportToMarket || "",
        aquaculture_systemOfFarming: form.section2_6_aquaculture?.systemOfFarming || "",
        aquaculture_enterpriseAreaAcres: form.section2_6_aquaculture?.enterpriseAreaAcres || "",
        aquaculture_currentStock: form.section2_6_aquaculture?.currentStock || "",
        aquaculture_typeOfFish: (form.section2_6_aquaculture?.typeOfFish || []).join(", "),
        aquaculture_accessToColdStorage: form.section2_6_aquaculture?.accessToColdStorage || "",
        aquaculture_marketPointOfSale: form.section2_6_aquaculture?.marketPointOfSale || "",
        aquaculture_transportToMarket: form.section2_6_aquaculture?.transportToMarket || "",
        banana_systemOfFarming: form.section2_7_banana?.systemOfFarming || "",
        banana_waterSource: form.section2_7_banana?.waterSource || "",
        banana_manureType: form.section2_7_banana?.manureType || "",
        banana_enterpriseAreaAcres: form.section2_7_banana?.enterpriseAreaAcres || "",
        banana_productionIntensityPerAcre: form.section2_7_banana?.productionIntensityPerAcre || "",
        banana_type: form.section2_7_banana?.type || "",
        banana_accessToColdStorage: form.section2_7_banana?.accessToColdStorage || "",
        banana_marketPointOfSale: form.section2_7_banana?.marketPointOfSale || "",
        banana_transportToMarket: form.section2_7_banana?.transportToMarket || "",
        maize_systemOfFarming: form.section2_8_maize?.systemOfFarming || "",
        maize_waterSource: form.section2_8_maize?.waterSource || "",
        maize_manureType: form.section2_8_maize?.manureType || "",
        maize_enterpriseAreaAcres: form.section2_8_maize?.enterpriseAreaAcres || "",
        maize_productionIntensityPerAcre: form.section2_8_maize?.productionIntensityPerAcre || "",
        maize_accessToColdStorage: form.section2_8_maize?.accessToColdStorage || "",
        maize_marketPointOfSale: form.section2_8_maize?.marketPointOfSale || "",
        maize_transportToMarket: form.section2_8_maize?.transportToMarket || "",
        fruitTrees_systemOfFarming: form.section2_9_fruitTrees?.systemOfFarming || "",
        fruitTrees_waterSource: form.section2_9_fruitTrees?.waterSource || "",
        fruitTrees_manureType: form.section2_9_fruitTrees?.manureType || "",
        fruitTrees_enterpriseAreaAcres: form.section2_9_fruitTrees?.enterpriseAreaAcres || "",
        fruitTrees_stockPerAcre: form.section2_9_fruitTrees?.stockPerAcre || "",
        fruitTrees_type: (form.section2_9_fruitTrees?.type || []).join(", "),
        fruitTrees_accessToColdStorage: form.section2_9_fruitTrees?.accessToColdStorage || "",
        fruitTrees_marketPointOfSale: form.section2_9_fruitTrees?.marketPointOfSale || "",
        fruitTrees_transportToMarket: form.section2_9_fruitTrees?.transportToMarket || "",
        plantedForest_systemOfFarming: form.section2_10_plantedForest?.systemOfFarming || "",
        plantedForest_waterSource: form.section2_10_plantedForest?.waterSource || "",
        plantedForest_manureType: form.section2_10_plantedForest?.manureType || "",
        plantedForest_enterpriseAreaAcres: form.section2_10_plantedForest?.enterpriseAreaAcres || "",
        plantedForest_stockPerAcre: form.section2_10_plantedForest?.stockPerAcre || "",
        plantedForest_type: form.section2_10_plantedForest?.type || "",
        plantedForest_marketPointOfSale: form.section2_10_plantedForest?.marketPointOfSale || "",
        plantedForest_transportToMarket: form.section2_10_plantedForest?.transportToMarket || "",
      };
    });
  };

  const handleExportExcel = () => {
    const data = buildExportRows();
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AgroFreshUG");
    XLSX.writeFile(workbook, "agrofresh_ug_members.xlsx");
  };

  const handleExportCsv = () => {
    const data = buildExportRows();
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agrofresh_ug_members.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const data = buildExportRows();
    if (data.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => String((row as any)[h] ?? "")));
    autoTable(doc, { head: [headers], body: rows, styles: { fontSize: 6 } });
    doc.save("agrofresh_ug_members.pdf");
  };

  if (!adminId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (syncStatus === "syncing") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Preparing AgroFresh admin access…</p>
      </div>
    );
  }

  if (syncStatus === "error") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#c62828" }}>
        <p>{syncError || "Unable to load AgroFresh admin."}</p>
        <button
          type="button"
          onClick={() => {
            setSyncStatus("idle");
            setSyncError(null);
            syncAgroFreshAdmin({ adminId })
              .then((res: any) => {
                setSyncStatus("ready");
                if (res?.message) {
                  setMessage({ type: "success", text: res.message });
                }
              })
              .catch((err: any) => {
                setSyncStatus("error");
                setSyncError(err?.message || "Unable to synchronize admin access.");
              });
          }}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 0.9rem",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Retry Sync
        </button>
      </div>
    );
  }

  const totalPages = applications ? Math.ceil(applications.totalCount / applications.pageSize) : 1;

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
      {applications && (applications as any).error && (
        <div style={{ marginBottom: "1rem", color: "#c62828" }}>
          {(applications as any).error}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REVOKED">Revoked</option>
          <option value="all">All</option>
        </select>

        <label>Join date</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <label>District</label>
        <input
          type="text"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          placeholder="District"
        />

        <label>Sub-county</label>
        <input
          type="text"
          value={subCountyFilter}
          onChange={(e) => setSubCountyFilter(e.target.value)}
          placeholder="Sub-county"
        />

        <label>Enterprise</label>
        <select value={enterpriseFilter} onChange={(e) => setEnterpriseFilter(e.target.value)}>
          <option value="">All</option>
          <option value="Dairy Farming">Dairy Farming</option>
          <option value="Poultry Farming">Poultry Farming</option>
          <option value="Piggery">Piggery</option>
          <option value="Rabbitry">Rabbitry</option>
          <option value="Apiary">Apiary</option>
          <option value="Aquaculture">Aquaculture</option>
          <option value="Banana Plantation">Banana Plantation</option>
          <option value="Maize">Maize</option>
          <option value="Fruit Trees">Fruit Trees</option>
          <option value="Planted Forest">Planted Forest</option>
        </select>

        <label>Page size</label>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>

        <button onClick={handleExportExcel} style={{ padding: "0.5rem 0.9rem" }}>Export Excel</button>
        <button onClick={handleExportCsv} style={{ padding: "0.5rem 0.9rem" }}>Export CSV</button>
        <button onClick={handleExportPdf} style={{ padding: "0.5rem 0.9rem" }}>Export PDF</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "1.5rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem" }}>
          <h3>Community Members</h3>
          {!rows || rows.length === 0 ? (
            <p style={{ color: "#777" }}>No forms found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "0.5rem" }}>Name</th>
                    <th style={{ padding: "0.5rem" }}>Farm Name</th>
                    <th style={{ padding: "0.5rem" }}>Phone</th>
                    <th style={{ padding: "0.5rem" }}>District</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Date Applied</th>
                    <th style={{ padding: "0.5rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: selectedApplicationId === row.id ? "#f1f8ff" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedApplicationId(row.id as any)}
                    >
                      <td style={{ padding: "0.5rem" }}>{row.farmerName}</td>
                      <td style={{ padding: "0.5rem" }}>{row.farmName}</td>
                      <td style={{ padding: "0.5rem" }}>{row.phone}</td>
                      <td style={{ padding: "0.5rem" }}>{row.district}</td>
                      <td style={{ padding: "0.5rem" }}>
                        {row.status}
                        {applications?.items?.find((i: any) => i.id === row.id)?.form?.deletedByFarmer && (
                          <span style={{ marginLeft: 6, color: "#b45309", fontWeight: 600 }}>(deleted)</span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>{row.createdAt}</td>
                      <td style={{ padding: "0.5rem", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await approveApplication({ adminId, applicationId: row.id as any });
                              setMessage({ type: "success", text: "Member approved." });
                            } catch (err: any) {
                              setMessage({ type: "error", text: err?.message || "Failed to approve" });
                            }
                          }}
                          style={{ padding: "0.35rem 0.6rem" }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await rejectApplication({ adminId, applicationId: row.id as any });
                              setMessage({ type: "success", text: "Member rejected." });
                            } catch (err: any) {
                              setMessage({ type: "error", text: err?.message || "Failed to reject" });
                            }
                          }}
                          style={{ padding: "0.35rem 0.6rem" }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await revokeMembership({ adminId, applicationId: row.id as any });
                              setMessage({ type: "success", text: "Membership revoked." });
                            } catch (err: any) {
                              setMessage({ type: "error", text: err?.message || "Failed to revoke" });
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
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <div>Page {page} of {totalPages || 1}</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem" }}>
          <h3>Member Profile View</h3>
          {!selectedApplicationId ? (
            <p style={{ color: "#777" }}>Select a member to view details.</p>
          ) : !selectedDetails ? (
            <p style={{ color: "#777" }}>Loading profile...</p>
          ) : (selectedDetails as any).error ? (
            <p style={{ color: "#c62828" }}>{(selectedDetails as any).error}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                <strong>Status:</strong> {selectedDetails.application.status}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                <strong>Deleted by farmer:</strong> {selectedDetails.form?.deletedByFarmer ? "Yes" : "No"}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                <strong>Preloaded Farmer Data:</strong>
                <div>Name: {selectedDetails.form?.section1?.farmerFullName || selectedDetails.farmer?.alias || "-"}</div>
                <div>Phone: {selectedDetails.form?.section1?.phoneNumber || selectedDetails.farmer?.phoneNumber || "-"}</div>
                <div>Email: {selectedDetails.form?.section1?.emailAddress || selectedDetails.farmer?.email || "-"}</div>
                <div>County: {selectedDetails.form?.section1?.county || selectedDetails.farmer?.county || "-"}</div>
                <div>District/Sub-county: {selectedDetails.form?.section1?.districtSubCounty || selectedDetails.farmer?.districtText || "-"}</div>
                <div>Village: {selectedDetails.form?.section1?.village || selectedDetails.farmer?.village || "-"}</div>
              </div>

              <div>
                <strong>Onboarding Form Data:</strong>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", background: "#f8f8f8", padding: "0.75rem", borderRadius: 6 }}>
                  {JSON.stringify(selectedDetails.form, null, 2)}
                </pre>
              </div>

              <div>
                <strong>Approval History:</strong>
                {selectedDetails.actions?.length ? (
                  <ul style={{ paddingLeft: "1.2rem" }}>
                    {selectedDetails.actions.map((action: any) => (
                      <li key={action._id}>
                        {action.action} — {new Date(action.createdAt).toLocaleString()} {action.note ? `(${action.note})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: "#777" }}>No actions yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}