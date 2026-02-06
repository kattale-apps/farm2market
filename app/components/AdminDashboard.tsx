"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from "xlsx";
import { formatUgandaDate } from "../utils/dateUtils";

/* ───────────────── Types ───────────────── */

interface AdminDashboardProps {
  userId: string;
}

/* ───────────────── Styles ───────────────── */

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 5vw, 2rem)",
  background: "#f3f6f4",
  boxSizing: "border-box",
  maxWidth: "100vw",
  overflowX: "hidden",
};

const farmCardStyle: React.CSSProperties = {
  backgroundImage: "url('/backgrounds/farm-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderRadius: "22px",
  padding: "clamp(1rem, 3vw, 2rem)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.12)",
  boxSizing: "border-box",
};

const glassPanelStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.82)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderRadius: "16px",
  padding: "clamp(1rem, 3vw, 1.75rem)",
  boxSizing: "border-box",
};

const utilityCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "1rem 1.25rem",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
  boxSizing: "border-box",
};

/* ───────────────── Component ───────────────── */

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const adminId = userId as Id<"users">;
  const [selectedCommunityId, setSelectedCommunityId] =
    useState<Id<"communities"> | null>(null);
  const [memberStatusFilter, setMemberStatusFilter] = useState<
    "all" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"
  >("all");
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    Id<"communityApplications"> | null
  >(null);

  const adminUser = useQuery(api.auth.getUser, { userId: adminId });
  const communities = useQuery(api.introspection.getCommunitiesForAdmin, {
    adminId,
  });

  // Check if user is SuperAdmin
  const isSuperAdmin = adminUser?.role === "admin" && (
    adminUser?.adminLevel === "super" || 
    (adminUser?.adminLevel === undefined && !adminUser?.adminCategory)
  );

  const communityMembers = useQuery(
    api.introspection.getCommunityMembers,
    selectedCommunityId
      ? {
          adminId,
          communityId: selectedCommunityId,
          status: memberStatusFilter === "all" ? undefined : memberStatusFilter,
        }
      : "skip"
  );
  const exportMembers = useQuery(
    api.communityApplications.getCommunityMemberExportData,
    selectedCommunityId
      ? {
          adminId,
          communityId: selectedCommunityId,
          status: memberStatusFilter === "all" ? undefined : memberStatusFilter,
        }
      : "skip"
  );

  const selectedApplicationDetails = useQuery(
    api.communityApplications.getApplicationDetails,
    selectedApplicationId
      ? { adminId, applicationId: selectedApplicationId }
      : "skip"
  );

  const approveApplication = useMutation(
    api.communityApplications.approveApplication
  );
  const rejectApplication = useMutation(
    api.communityApplications.rejectApplication
  );
  const deleteCommunityMember = useMutation(
    api.communityApplications.deleteCommunityMember
  );

  const backfillMembers = useMutation(
    api.communityApplications.backfillCommunityMembers
  );

  const logExport = useMutation(api.communities.logExport);

  /* ───────────── Export Logic ───────────── */

  const handleExport = async (type: "excel") => {
    if (!communityMembers || !selectedCommunityId) return;

    const community = communities?.find(
      (c) => c._id === selectedCommunityId
    );
    const name = community?.name ?? "Community";

    await logExport({
      userId: adminId,
      exportType: type,
      dataCount: (exportMembers ?? []).length,
    });

    const rows = (exportMembers ?? []).map((entry: any) => {
      const form = entry.form || {};
      const section1 = form.section1 || {};
      const farmer = entry.farmer || {};
      return {
        Status: entry.status ?? "-",
        Joined: entry.joinedAt ? formatUgandaDate(entry.joinedAt) : "-",
        UpdatedAt: entry.updatedAt ? formatUgandaDate(entry.updatedAt) : "-",
        Alias: farmer.alias ?? "-",
        Sex: section1.sex ?? farmer.sex ?? "",
        Email: section1.emailAddress ?? farmer.email ?? "-",
        Phone: section1.phoneNumber ?? farmer.phoneNumber ?? "-",
        Region: section1.region ?? farmer.region ?? "",
        District: section1.districtSubCounty ?? section1.district ?? farmer.districtText ?? "",
        County: section1.county ?? farmer.county ?? "",
        Subcounty: section1.subCounty ?? section1.districtSubCounty ?? farmer.subCountyText ?? "",
        Parish: section1.parish ?? "",
        Village: section1.village ?? farmer.village ?? "",
        WaterSource: section1.waterSource ?? farmer.waterSource ?? "",
        farmerFullName: section1.farmerFullName ?? "",
        farmName: section1.farmName ?? "",
        farmSizeAcres: section1.farmSizeAcres ?? "",
        totalAreaAgProductionAcres: section1.totalAreaAgProductionAcres ?? "",
        totalAreaPlantedForestAcres: section1.totalAreaPlantedForestAcres ?? "",
        systemOfFarming: section1.systemOfFarming ?? "",
        systemOfFarmingOther: section1.systemOfFarmingOther ?? "",
        mainEnterprises: (section1.mainEnterprises || []).join(", "),
        otherCommercialActivity: section1.otherCommercialActivity ?? "",
        yearsOfExperience: section1.yearsOfExperience ?? "",
        waterSourceOther: section1.waterSourceOther ?? "",
        certifications: section1.certifications ?? "",
        dairy_systemOfFarming: form.section2_1_dairy?.systemOfFarming ?? "",
        dairy_systemOfFarmingOther: form.section2_1_dairy?.systemOfFarmingOther ?? "",
        dairy_enterpriseAreaAcres: form.section2_1_dairy?.enterpriseAreaAcres ?? "",
        dairy_currentLivestockIntensity: form.section2_1_dairy?.currentLivestockIntensity ?? "",
        dairy_numberOfMilkers: form.section2_1_dairy?.numberOfMilkers ?? "",
        dairy_milkProductivityDaily: form.section2_1_dairy?.milkProductivityDaily ?? "",
        dairy_accessToColdStorage: form.section2_1_dairy?.accessToColdStorage ?? "",
        dairy_marketPointOfSale: form.section2_1_dairy?.marketPointOfSale ?? "",
        dairy_transportToMarket: form.section2_1_dairy?.transportToMarket ?? "",
        poultry_systemOfFarming: form.section2_2_poultry?.systemOfFarming ?? "",
        poultry_systemOfFarmingOther: form.section2_2_poultry?.systemOfFarmingOther ?? "",
        poultry_enterpriseAreaAcres: form.section2_2_poultry?.enterpriseAreaAcres ?? "",
        poultry_currentPoultryIntensity: form.section2_2_poultry?.currentPoultryIntensity ?? "",
        poultry_typesOfChicken: (form.section2_2_poultry?.typesOfChicken || []).join(", "),
        poultry_accessToColdStorage: form.section2_2_poultry?.accessToColdStorage ?? "",
        poultry_marketPointOfSale: form.section2_2_poultry?.marketPointOfSale ?? "",
        poultry_transportToMarket: form.section2_2_poultry?.transportToMarket ?? "",
        piggery_systemOfFarming: form.section2_3_piggery?.systemOfFarming ?? "",
        piggery_systemOfFarmingOther: form.section2_3_piggery?.systemOfFarmingOther ?? "",
        piggery_enterpriseAreaAcres: form.section2_3_piggery?.enterpriseAreaAcres ?? "",
        piggery_currentPiggeryIntensity: form.section2_3_piggery?.currentPiggeryIntensity ?? "",
        piggery_product: form.section2_3_piggery?.product ?? "",
        piggery_accessToColdStorage: form.section2_3_piggery?.accessToColdStorage ?? "",
        piggery_marketPointOfSale: form.section2_3_piggery?.marketPointOfSale ?? "",
        piggery_transportToMarket: form.section2_3_piggery?.transportToMarket ?? "",
        rabbitry_systemOfFarming: form.section2_4_rabbitry?.systemOfFarming ?? "",
        rabbitry_systemOfFarmingOther: form.section2_4_rabbitry?.systemOfFarmingOther ?? "",
        rabbitry_enterpriseAreaAcres: form.section2_4_rabbitry?.enterpriseAreaAcres ?? "",
        rabbitry_currentRabbitryIntensity: form.section2_4_rabbitry?.currentRabbitryIntensity ?? "",
        rabbitry_mainProduct: (form.section2_4_rabbitry?.mainProduct || []).join(", "),
        rabbitry_accessToColdStorage: form.section2_4_rabbitry?.accessToColdStorage ?? "",
        rabbitry_marketPointOfSale: form.section2_4_rabbitry?.marketPointOfSale ?? "",
        rabbitry_transportToMarket: form.section2_4_rabbitry?.transportToMarket ?? "",
        apiary_systemOfFarming: form.section2_5_apiary?.systemOfFarming ?? "",
        apiary_systemOfFarmingOther: form.section2_5_apiary?.systemOfFarmingOther ?? "",
        apiary_enterpriseAreaAcres: form.section2_5_apiary?.enterpriseAreaAcres ?? "",
        apiary_currentApiaryIntensity: form.section2_5_apiary?.currentApiaryIntensity ?? "",
        apiary_mainProduct: form.section2_5_apiary?.mainProduct ?? "",
        apiary_accessToColdStorage: form.section2_5_apiary?.accessToColdStorage ?? "",
        apiary_marketPointOfSale: form.section2_5_apiary?.marketPointOfSale ?? "",
        apiary_transportToMarket: form.section2_5_apiary?.transportToMarket ?? "",
        aquaculture_systemOfFarming: form.section2_6_aquaculture?.systemOfFarming ?? "",
        aquaculture_systemOfFarmingOther: form.section2_6_aquaculture?.systemOfFarmingOther ?? "",
        aquaculture_enterpriseAreaAcres: form.section2_6_aquaculture?.enterpriseAreaAcres ?? "",
        aquaculture_currentStock: form.section2_6_aquaculture?.currentStock ?? "",
        aquaculture_typeOfFish: (form.section2_6_aquaculture?.typeOfFish || []).join(", "),
        aquaculture_accessToColdStorage: form.section2_6_aquaculture?.accessToColdStorage ?? "",
        aquaculture_marketPointOfSale: form.section2_6_aquaculture?.marketPointOfSale ?? "",
        aquaculture_transportToMarket: form.section2_6_aquaculture?.transportToMarket ?? "",
        banana_systemOfFarming: form.section2_7_banana?.systemOfFarming ?? "",
        banana_systemOfFarmingOther: form.section2_7_banana?.systemOfFarmingOther ?? "",
        banana_enterpriseAreaAcres: form.section2_7_banana?.enterpriseAreaAcres ?? "",
        banana_productionIntensityPerAcre: form.section2_7_banana?.productionIntensityPerAcre ?? "",
        banana_type: form.section2_7_banana?.type ?? "",
        banana_accessToColdStorage: form.section2_7_banana?.accessToColdStorage ?? "",
        banana_marketPointOfSale: form.section2_7_banana?.marketPointOfSale ?? "",
        banana_transportToMarket: form.section2_7_banana?.transportToMarket ?? "",
        maize_systemOfFarming: form.section2_8_maize?.systemOfFarming ?? "",
        maize_systemOfFarmingOther: form.section2_8_maize?.systemOfFarmingOther ?? "",
        maize_enterpriseAreaAcres: form.section2_8_maize?.enterpriseAreaAcres ?? "",
        maize_productionIntensityPerAcre: form.section2_8_maize?.productionIntensityPerAcre ?? "",
        maize_accessToColdStorage: form.section2_8_maize?.accessToColdStorage ?? "",
        maize_marketPointOfSale: form.section2_8_maize?.marketPointOfSale ?? "",
        maize_transportToMarket: form.section2_8_maize?.transportToMarket ?? "",
        fruitTrees_systemOfFarming: form.section2_9_fruitTrees?.systemOfFarming ?? "",
        fruitTrees_systemOfFarmingOther: form.section2_9_fruitTrees?.systemOfFarmingOther ?? "",
        fruitTrees_enterpriseAreaAcres: form.section2_9_fruitTrees?.enterpriseAreaAcres ?? "",
        fruitTrees_stockPerAcre: form.section2_9_fruitTrees?.stockPerAcre ?? "",
        fruitTrees_type: (form.section2_9_fruitTrees?.type || []).join(", "),
        fruitTrees_accessToColdStorage: form.section2_9_fruitTrees?.accessToColdStorage ?? "",
        fruitTrees_marketPointOfSale: form.section2_9_fruitTrees?.marketPointOfSale ?? "",
        fruitTrees_transportToMarket: form.section2_9_fruitTrees?.transportToMarket ?? "",
        plantedForest_systemOfFarming: form.section2_10_plantedForest?.systemOfFarming ?? "",
        plantedForest_systemOfFarmingOther: form.section2_10_plantedForest?.systemOfFarmingOther ?? "",
        plantedForest_enterpriseAreaAcres: form.section2_10_plantedForest?.enterpriseAreaAcres ?? "",
        plantedForest_stockPerAcre: form.section2_10_plantedForest?.stockPerAcre ?? "",
        plantedForest_type: form.section2_10_plantedForest?.type ?? "",
        plantedForest_marketPointOfSale: form.section2_10_plantedForest?.marketPointOfSale ?? "",
        plantedForest_transportToMarket: form.section2_10_plantedForest?.transportToMarket ?? "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `${name}_Members.xlsx`);
  };

  /* ───────────────── UI ───────────────── */

  return (
    <div style={containerStyle}>
      {/* SuperAdmin Cards */}
      {isSuperAdmin && (
        <>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.8rem", fontWeight: "700" }}>
            SuperAdmin Dashboard
          </h2>
          
          {/* Admin Action Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            {/* Finance Dashboard */}
            <a href="/admin/finance" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💰</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Finance Dashboard</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    View commission earnings and financial reports
                  </p>
                </div>
              </div>
            </a>

            {/* Role Management */}
            <a href="/admin/role-management" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Role Management</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Manage admin roles and permissions
                  </p>
                </div>
              </div>
            </a>

            {/* Communities */}
            <a href="/admin/communities" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🌾</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Communities</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Create and manage grower communities
                  </p>
                </div>
              </div>
            </a>

            {/* StoreAdmin Audit */}
            <a href="/admin/storeadmin-audit" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📦</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>StoreAdmin Audit</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Audit store admin activities and deliveries
                  </p>
                </div>
              </div>
            </a>

            {/* Service Levels */}
            <a href="/admin/service-levels" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #0288d1 0%, #0277bd 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⭐</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Service Levels</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Manage export limits and service tiers
                  </p>
                </div>
              </div>
            </a>

            {/* Community Dashboard */}
            <a href="/admin/community-dashboard" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #d32f2f 0%, #c62828 100%)",
                  color: "#fff",
                  minHeight: "140px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06)";
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📊</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Community Dashboard</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    View and filter community members
                  </p>
                </div>
              </div>
            </a>
          </div>
        </>
      )}

      <h2 style={{ marginBottom: "1rem" }}>Community Management</h2>

      {/* Premium Notice */}
      <div
        style={{
          background: "#fff3cd",
          border: "1px solid #ffeeba",
          padding: "1rem",
          borderRadius: "10px",
          marginBottom: "1.25rem",
          color: "#856404",
          fontWeight: 600,
        }}
      >
        🚀 Creating communities is a <strong>Premium Feature</strong>. Contact
        support for access.
      </div>

      {/* Notifications / Inbox */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={utilityCardStyle}>🔔 Notifications (Premium)</div>
        <div style={utilityCardStyle}>📥 Inbox (Premium)</div>
      </div>

      {/* FARM BACKGROUND CARD */}
      <div style={farmCardStyle}>
        <div style={glassPanelStyle}>
          {selectedCommunityId ? (
            <>
              {/* Back + Export */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                }}
              >
                <button
                  onClick={() => setSelectedCommunityId(null)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    background: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ← Back to Communities
                </button>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleExport("excel")}
                    style={{
                      background: "#2e7d32",
                      color: "#fff",
                      padding: "0.5rem 1rem",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: 600,
                    }}
                  >
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <h4 style={{ marginBottom: "0.75rem" }}>
                Members ({communityMembers?.length ?? 0})
              </h4>

              <div
                style={{
                  marginBottom: "0.75rem",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <label style={{ fontWeight: 600 }}>Status:</label>
                <select
                  value={memberStatusFilter}
                  onChange={(e) =>
                    setMemberStatusFilter(e.target.value as any)
                  }
                  style={{
                    padding: "0.35rem 0.6rem",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                  }}
                >
                  <option value="all">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="REVOKED">Revoked</option>
                </select>
              </div>

              {!communityMembers ? (
                <p>Loading members…</p>
              ) : (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      background: "#ffffff",
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        {["Alias", "Status", "Phone", "Email", "Joined", "Actions"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                padding: "0.75rem",
                                textAlign: "left",
                                borderBottom: "1px solid #ddd",
                                fontWeight: 700,
                              }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {communityMembers.map((m: any) => (
                        <tr key={m._id ?? m.farmerId ?? Math.random()}>
                          <td style={{ padding: "0.75rem" }}>{m.alias ?? "-"}</td>
                          <td style={{ padding: "0.75rem" }}>{m.status ?? "-"}</td>
                          <td style={{ padding: "0.75rem" }}>{m.phoneNumber ?? "-"}</td>
                          <td style={{ padding: "0.75rem" }}>{m.email ?? "-"}</td>
                          <td style={{ padding: "0.75rem" }}>
                            {m.joinedAt ? formatUgandaDate(m.joinedAt) : "-"}
                          </td>
                          <td style={{ padding: "0.75rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <button
                              onClick={() =>
                                m.applicationId && setSelectedApplicationId(m.applicationId)
                              }
                              style={{ padding: "0.35rem 0.6rem" }}
                              disabled={!m.applicationId}
                            >
                              View
                            </button>
                            {m.status === "PENDING" && m.applicationId && (
                              <>
                                <button
                                  onClick={async () => {
                                    await approveApplication({
                                      adminId,
                                      applicationId: m.applicationId,
                                    });
                                  }}
                                  style={{ padding: "0.35rem 0.6rem" }}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    await rejectApplication({
                                      adminId,
                                      applicationId: m.applicationId,
                                    });
                                  }}
                                  style={{ padding: "0.35rem 0.6rem" }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={async () => {
                                if (!selectedCommunityId) return;
                                await deleteCommunityMember({
                                  adminId,
                                  communityId: selectedCommunityId,
                                  farmerId: m._id,
                                  applicationId: m.applicationId,
                                });
                              }}
                              style={{ padding: "0.35rem 0.6rem" }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {communityMembers && communityMembers.length === 0 && selectedCommunityId && (
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    onClick={async () => {
                      try {
                        await backfillMembers({
                          adminId,
                          communityId: selectedCommunityId,
                        });
                      } catch {
                        // no-op
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.9rem",
                      background: "#1976d2",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    Sync Members
                  </button>
                  <span style={{ color: "#666", fontSize: "0.85rem" }}>
                    Runs a one-time sync from applications.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* COMMUNITY LIST */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                gap: "1rem",
              }}
            >
              {communities?.map((c) => (
                <div
                  key={c._id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "1rem",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <h4>{c.name}</h4>
                  <p>{c.description}</p>
                  <p>
                    <strong>Members:</strong> {c.memberCount ?? 0}
                  </p>
                  <button
                    onClick={() => setSelectedCommunityId(c._id)}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.6rem",
                      background: "#1976d2",
                      color: "#fff",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: 600,
                      width: "100%",
                    }}
                  >
                    Manage & View Members
                  </button>
                </div>
              ))}
            </div>
          )}

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
                  padding: "1.25rem",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                ) : (
                  <div style={{ marginTop: "1rem" }}>
                    {(() => {
                      const section1 = (selectedApplicationDetails as any)?.form?.section1 || {};
                      const farmer = (selectedApplicationDetails as any)?.farmer || {};
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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

                    <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={async () => {
                          await approveApplication({
                            adminId,
                            applicationId: selectedApplicationId,
                          });
                          setSelectedApplicationId(null);
                        }}
                        style={{ padding: "0.5rem 0.9rem" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          await rejectApplication({
                            adminId,
                            applicationId: selectedApplicationId,
                          });
                          setSelectedApplicationId(null);
                        }}
                        style={{ padding: "0.5rem 0.9rem" }}
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
      </div>
    </div>
  );
}
