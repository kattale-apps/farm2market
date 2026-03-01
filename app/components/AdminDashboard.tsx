"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from "xlsx";
import { formatUgandaDate } from "../utils/dateUtils";
import { NotificationMailbox } from "./NotificationMailbox";
import { resolveCommunityLogo } from "../lib/communityLogos";
const REGION_GROUPS: { label: string; districts: string[] }[] = [
  {
    label: "Central (Buganda)",
    districts: [
      "Kampala", "Wakiso", "Mukono", "Buikwe", "Kayunga",
      "Luweero", "Nakaseke", "Nakasongola", "Mityana", "Kiboga",
      "Mpigi", "Butambala", "Gomba", "Masaka",
      "Lwengo", "Kalungu", "Bukomansimbi", "Sembabule", "Lyantonde",
      "Rakai", "Kyotera", "Mubende", "Kassanda",
    ],
  },
  {
    label: "Eastern (Busoga)",
    districts: ["Jinja", "Mayuge", "Iganga", "Bugiri", "Namayingo", "Buyende", "Kaliro", "Kamuli", "Luuka", "Namutumba"],
  },
  {
    label: "Eastern (Teso)",
    districts: ["Soroti", "Serere", "Kaberamaido", "Amuria", "Katakwi", "Ngora", "Kumi", "Bukedea"],
  },
  {
    label: "Eastern (Elgon)",
    districts: ["Mbale", "Manafwa", "Bududa", "Sironko", "Bulambuli", "Bungokho"],
  },
  {
    label: "Eastern (Other)",
    districts: ["Tororo", "Busia", "Butaleja", "Budaka", "Pallisa", "Kibuku", "Butebo"],
  },
  {
    label: "Northern (Acholi)",
    districts: ["Gulu", "Nwoya", "Amuru", "Pader", "Kitgum", "Lamwo", "Agago", "Omoro"],
  },
  {
    label: "Northern (Lango)",
    districts: ["Lira", "Dokolo", "Alebtong", "Oyam", "Apac", "Kole", "Amolatar", "Kwania"],
  },
  {
    label: "Northern (West Nile)",
    districts: ["Arua", "Moyo", "Adjumani", "Yumbe", "Koboko", "Maracha", "Terego", "Zombo", "Nebbi", "Pakwach"],
  },
  {
    label: "Northern (Karamoja)",
    districts: ["Moroto", "Kotido", "Kaabong", "Abim", "Nakapiripirit", "Napak", "Amudat", "Nabilatuk", "Karenga"],
  },
  {
    label: "Western (Tooro)",
    districts: ["Fort Portal", "Kabarole", "Kamwenge", "Kyenjojo", "Kyegegwa", "Bunyangabu"],
  },
  {
    label: "Western (Bunyoro)",
    districts: ["Hoima", "Kikuube", "Masindi", "Kiryandongo", "Buliisa", "Kagadi", "Kakumiro", "Kyankwanzi"],
  },
  {
    label: "Western (Ankole)",
    districts: ["Mbarara", "Isingiro", "Ntungamo", "Bushenyi", "Sheema", "Mitooma", "Rubirizi", "Buhweju", "Rukungiri", "Kanungu"],
  },
  {
    label: "Western (Kigezi)",
    districts: ["Kabale", "Kisoro", "Rukiga"],
  },
];

const normalizeDistrict = (value?: string) => (value || "").trim().toLowerCase();

const getRegionLabel = (districtName?: string) => {
  const normalized = normalizeDistrict(districtName);
  if (!normalized) return "";
  const match = REGION_GROUPS.find((group) =>
    group.districts.some((d) => normalizeDistrict(d) === normalized)
  );
  return match?.label ?? "";
};

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
  const router = useRouter();
  const adminId = userId as Id<"users">;
  
  // Resolve community logo using shared helper (DB → known-name fallback)
  const getCommunityLogo = (community: any) => resolveCommunityLogo(community);

  const [selectedCommunityId, setSelectedCommunityId] =
    useState<Id<"communities"> | null>(null);
  const [memberStatusFilter, setMemberStatusFilter] = useState<
    "all" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"
  >("all");
  const [memberRoleFilter, setMemberRoleFilter] = useState<"all" | "farmer" | "trader" | "buyer">("all");
  const [membersPageSize, setMembersPageSize] = useState(20);
  const [membersPage, setMembersPage] = useState(1);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    Id<"communityApplications"> | null
  >(null);
  const [communityMembersPage, setCommunityMembersPage] = useState(1);
  const [communityMembersPageSize, setCommunityMembersPageSize] = useState(20);
  const [showCommunityManager, setShowCommunityManager] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [selectedMessageThread, setSelectedMessageThread] = useState<{ utid: string; otherUserId: Id<"users"> } | null>(null);
  const [adminMessageText, setAdminMessageText] = useState("");
  const [showMessagesPanel, setShowMessagesPanel] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState<"role" | "individual" | "community">("role");
  const [notificationRole, setNotificationRole] = useState<"farmer" | "trader" | "buyer">("farmer");
  const [notificationUserId, setNotificationUserId] = useState<string>("");
  const [notificationCommunityId, setNotificationCommunityId] = useState<string>("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationReason, setNotificationReason] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    { userId: adminId } as any
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );
  const membersPageSizeKey = "admin_members";
  const communityMembersPageSizeKey = "admin_community_members";

  const adminUser = useQuery(api.auth.getUser, { userId: adminId });
  const communities = useQuery(api.introspection.getCommunitiesForAdmin, {
    adminId,
  });

  // Check if user is SuperAdmin
  const isSuperAdmin = adminUser?.role === "admin" && (
    adminUser?.adminLevel === "super" || 
    (adminUser?.adminLevel === undefined && !adminUser?.adminCategory)
  );
  const isCommunityAdmin = adminUser?.role === "admin" &&
    adminUser?.adminCategory === "community";
  const isMessageAdmin = adminUser?.role === "admin" &&
    adminUser?.adminLevel === "junior" &&
    adminUser?.adminCategory === "message";
  const canMessageAdmin = isSuperAdmin || isMessageAdmin;

  const allUsers = useQuery(
    api.introspection.getAllUsers,
    isSuperAdmin ? { adminId } : "skip"
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

  const adminMessageThreads = useQuery(
    api.messages.getAdminMessageThreads,
    canMessageAdmin ? { adminId } : "skip"
  );

  const selectedAdminThread = useQuery(
    api.messages.getMessageThread,
    selectedMessageThread
      ? { userId: adminId, utid: selectedMessageThread.utid }
      : "skip"
  );

  useEffect(() => {
    if (!paginationPreferences) return;
    const nextSize =
      paginationPreferences.list?.[membersPageSizeKey] ??
      paginationPreferences.defaultPageSize ??
      20;
    const nextCommunitySize =
      paginationPreferences.list?.[communityMembersPageSizeKey] ??
      paginationPreferences.defaultPageSize ??
      20;
    if (nextSize !== membersPageSize) {
      setMembersPageSize(nextSize);
      setMembersPage(1);
    }
    if (nextCommunitySize !== communityMembersPageSize) {
      setCommunityMembersPageSize(nextCommunitySize);
      setCommunityMembersPage(1);
    }
  }, [
    paginationPreferences,
    membersPageSizeKey,
    communityMembersPageSizeKey,
    membersPageSize,
    communityMembersPageSize,
  ]);

  const approveApplication = useMutation(
    api.communityApplications.approveApplication
  );
  const rejectApplication = useMutation(
    api.communityApplications.rejectApplication
  );
  const deleteCommunityMember = useMutation(
    api.communityApplications.deleteCommunityMember
  );

  const sendAdminMessage = useMutation(api.messages.sendMessage);
  const markMessagesAsRead = useMutation(api.messages.markMessagesAsRead);
  const sendRoleBasedNotification = useMutation(api.notifications.sendRoleBasedNotification);
  const sendNotificationToSelectedUsers = useMutation(api.notifications.sendNotificationToSelectedUsers);
  const notifyCommunity = useMutation(api.communities.notifyCommunity);

  const logExport = useMutation(api.communities.logExport);

  const notificationRecipients = useQuery(
    api.notifications.getNotificationRecipients,
    canMessageAdmin ? { adminId } : "skip"
  );

  const membersList = useMemo(
    () => (allUsers ?? []).filter((u) => u.role === "farmer" || u.role === "trader" || u.role === "buyer"),
    [allUsers]
  );

  const filteredMembers = useMemo(() => {
    if (memberRoleFilter === "all") return membersList;
    return membersList.filter((member: any) => member.role === memberRoleFilter);
  }, [membersList, memberRoleFilter]);

  useEffect(() => {
    setMembersPage(1);
  }, [memberRoleFilter, membersPageSize]);

  useEffect(() => {
    setCommunityMembersPage(1);
  }, [memberStatusFilter, communityMembersPageSize, selectedCommunityId]);

  const membersTotalPages = Math.max(1, Math.ceil(filteredMembers.length / membersPageSize));
  const membersStart = filteredMembers.length === 0 ? 0 : (membersPage - 1) * membersPageSize + 1;
  const membersEnd = Math.min(membersPage * membersPageSize, filteredMembers.length);
  const pagedMembers = filteredMembers.slice(
    (membersPage - 1) * membersPageSize,
    membersPage * membersPageSize
  );

  const communityMembersList = communityMembers ?? [];
  const communityMembersTotalPages = Math.max(1, Math.ceil(communityMembersList.length / communityMembersPageSize));
  const communityMembersStart = communityMembersList.length === 0 ? 0 : (communityMembersPage - 1) * communityMembersPageSize + 1;
  const communityMembersEnd = Math.min(communityMembersPage * communityMembersPageSize, communityMembersList.length);
  const pagedCommunityMembers = communityMembersList.slice(
    (communityMembersPage - 1) * communityMembersPageSize,
    communityMembersPage * communityMembersPageSize
  );

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
        Region:
          section1.region ??
          farmer.region ??
          getRegionLabel(section1.districtSubCounty ?? section1.district ?? farmer.districtText) ??
          "",
        District: section1.districtSubCounty ?? section1.district ?? farmer.districtText ?? "",
        County: section1.county ?? farmer.county ?? "",
        Subcounty: section1.subCounty ?? section1.districtSubCounty ?? farmer.subCountyText ?? "",
        Parish: section1.parish ?? farmer.parishText ?? "",
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

  const handleExportAllMembers = () => {
    const rows = filteredMembers.map((member: any) => ({
      Role: member.role,
      Alias: member.alias ?? "",
      MemberId: member.userId,
      Email: member.email ?? "",
      Phone: member.phoneNumber ?? "",
      Sex: member.sex ?? "",
      AdminLevel: member.adminLevel ?? "",
      AdminCategory: member.adminCategory ?? "",
      ServiceLevel: member.serviceLevel ?? "",
      ExportLimit: member.exportLimit ?? "",
      Region: member.region ?? "",
      District: member.districtText ?? "",
      SubCounty: member.subCountyText ?? "",
      Village: member.village ?? "",
      County: member.county ?? "",
      WaterSource: member.waterSource ?? "",
      OnboardingCompleted: member.onboardingCompleted ? "Yes" : "No",
      IsVerifiedTrader: member.isVerifiedTrader ? "Yes" : "No",
      VerificationStatus: member.verificationStatus ?? "",
      VerifiedBy: member.verifiedBy ?? "",
      VerifiedAt: member.verifiedAt ? formatUgandaDate(member.verifiedAt) : "",
      CreatedAt: member.createdAt ? formatUgandaDate(member.createdAt) : "",
      LastActiveAt: member.lastActiveAt ? formatUgandaDate(member.lastActiveAt) : "",
      Communities: (member.communityNames || []).join(", "),
      CommunityIds: (member.communityIds || []).join(", "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "All_Members.xlsx");
  };

  const handleSendAdminMessage = async () => {
    if (!selectedMessageThread || !adminMessageText.trim()) return;
    await sendAdminMessage({
      fromUserId: adminId,
      toUserId: selectedMessageThread.otherUserId,
      utid: selectedMessageThread.utid,
      message: adminMessageText.trim(),
    });
    setAdminMessageText("");
  };

  const messagesPanel = (
    <div
      style={{
        ...utilityCardStyle,
        background: "#ffffff",
        color: "#111827",
        padding: "1.25rem",
        border: "1px solid #e0e0e0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "2rem" }}>📬</div>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Messages & Notifications</h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>
            Respond to member messages
          </p>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 320px) 1fr",
        gap: "1rem",
        alignItems: "stretch",
      }}>
        <div style={{
          gridColumn: "1 / -1",
          background: "#f8fafc",
          borderRadius: 10,
          padding: "0.75rem",
          border: "1px solid #e5e7eb",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Send Notification</div>
          {notificationStatus && (
            <div style={{
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              background: notificationStatus.type === "success" ? "#e8f5e9" : "#ffebee",
              color: notificationStatus.type === "success" ? "#2e7d32" : "#c62828",
              border: `1px solid ${notificationStatus.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
              marginBottom: "0.5rem",
            }}>
              {notificationStatus.text}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
            <select
              value={notificationTarget}
              onChange={(e) => setNotificationTarget(e.target.value as any)}
              style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
            >
              <option value="role">By Category</option>
              <option value="individual">Individual Member</option>
              <option value="community">Community</option>
            </select>

            {notificationTarget === "role" && (
              <select
                value={notificationRole}
                onChange={(e) => setNotificationRole(e.target.value as any)}
                style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
              >
                <option value="farmer">Farmers</option>
                <option value="trader">Traders</option>
                <option value="buyer">Buyers</option>
              </select>
            )}

            {notificationTarget === "individual" && (
              <select
                value={notificationUserId}
                onChange={(e) => setNotificationUserId(e.target.value)}
                style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
              >
                <option value="">Select member</option>
                {(notificationRecipients ?? []).map((user: any) => (
                  <option key={user.userId} value={user.userId}>
                    {user.alias || "Member"} • {user.role}
                  </option>
                ))}
              </select>
            )}

            {notificationTarget === "community" && (
              <select
                value={notificationCommunityId}
                onChange={(e) => setNotificationCommunityId(e.target.value)}
                style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
              >
                <option value="">Select community</option>
                {(communities ?? []).map((community: any) => (
                  <option key={community._id} value={community._id}>
                    {community.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              type="text"
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              placeholder="Title"
              style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
            />
            <input
              type="text"
              value={notificationReason}
              onChange={(e) => setNotificationReason(e.target.value)}
              placeholder="Reason"
              style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }}
            />
          </div>
          <textarea
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
            placeholder="Message"
            rows={3}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem",
              borderRadius: 6,
              border: "1px solid #ddd",
              width: "100%",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={async () => {
                if (!notificationTitle.trim() || !notificationMessage.trim()) {
                  setNotificationStatus({ type: "error", text: "Title and message are required." });
                  return;
                }

                try {
                  if (notificationTarget === "role") {
                    await sendRoleBasedNotification({
                      adminId,
                      role: notificationRole,
                      title: notificationTitle.trim(),
                      message: notificationMessage.trim(),
                      reason: notificationReason.trim() || "Notification by category",
                    });
                  } else if (notificationTarget === "individual") {
                    if (!notificationUserId) {
                      setNotificationStatus({ type: "error", text: "Select a member first." });
                      return;
                    }
                    await sendNotificationToSelectedUsers({
                      adminId,
                      userIds: [notificationUserId as any],
                      title: notificationTitle.trim(),
                      message: notificationMessage.trim(),
                      reason: notificationReason.trim() || "Notification to individual member",
                    });
                  } else {
                    if (!notificationCommunityId) {
                      setNotificationStatus({ type: "error", text: "Select a community first." });
                      return;
                    }
                    await notifyCommunity({
                      adminId,
                      communityId: notificationCommunityId as any,
                      title: notificationTitle.trim(),
                      message: notificationMessage.trim(),
                      reason: notificationReason.trim() || "Notification to community",
                    } as any);
                  }

                  setNotificationStatus({ type: "success", text: "Notification sent." });
                  setNotificationTitle("");
                  setNotificationMessage("");
                  setNotificationReason("");
                  setNotificationUserId("");
                  setNotificationCommunityId("");
                } catch (error: any) {
                  setNotificationStatus({ type: "error", text: error?.message || "Failed to send notification" });
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Send Notification
            </button>
          </div>
        </div>
        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1rem",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <div style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Notifications</div>
          <NotificationMailbox userId={adminId} />
        </div>
        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1rem",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          minHeight: "320px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) 1fr", gap: "1rem" }}>
            <div style={{ borderRight: "1px solid #eee", paddingRight: "0.75rem" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Message Threads</div>
              {adminMessageThreads === undefined ? (
                <p style={{ color: "#666" }}>Loading threads...</p>
              ) : adminMessageThreads.length === 0 ? (
                <p style={{ color: "#666" }}>No messages yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {adminMessageThreads.map((thread: any) => (
                    <button
                      key={thread.utid}
                      type="button"
                      onClick={async () => {
                        setSelectedMessageThread({ utid: thread.utid, otherUserId: thread.otherUserId });
                        await markMessagesAsRead({ userId: adminId, utid: thread.utid });
                      }}
                      style={{
                        padding: "0.5rem",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: selectedMessageThread?.utid === thread.utid ? "#e3f2fd" : "#f9fafb",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        {thread.otherUserAlias || "Member"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>
                        {thread.lastMessage?.slice(0, 40) || "No message"}
                      </div>
                      {thread.unreadCount > 0 && (
                        <div style={{ fontSize: "0.7rem", color: "#d32f2f", fontWeight: 600 }}>
                          {thread.unreadCount} unread
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontWeight: 600 }}>Thread</div>
              {selectedMessageThread ? (
                <>
                  <div style={{
                    flex: 1,
                    maxHeight: "260px",
                    overflowY: "auto",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: "0.75rem",
                    background: "#fafafa",
                  }}>
                    {selectedAdminThread === undefined ? (
                      <p style={{ color: "#666" }}>Loading messages...</p>
                    ) : selectedAdminThread.length === 0 ? (
                      <p style={{ color: "#666" }}>No messages in this thread.</p>
                    ) : (
                      selectedAdminThread.map((msg: any) => (
                        <div key={msg.id} style={{ marginBottom: "0.6rem" }}>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            {msg.isFromMe ? "You" : msg.fromAlias}
                          </div>
                          <div style={{ fontSize: "0.9rem" }}>{msg.message}</div>
                          <div style={{ fontSize: "0.7rem", color: "#999" }}>
                            {new Date(msg.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      value={adminMessageText}
                      onChange={(e) => setAdminMessageText(e.target.value)}
                      placeholder="Type your response..."
                      style={{
                        flex: 1,
                        padding: "0.6rem",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSendAdminMessage}
                      disabled={!adminMessageText.trim()}
                      style={{
                        padding: "0.6rem 1rem",
                        background: adminMessageText.trim() ? "#1976d2" : "#ccc",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: adminMessageText.trim() ? "pointer" : "not-allowed",
                        fontWeight: 600,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: "#666" }}>Select a thread to respond.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ───────────────── UI ───────────────── */

  return (
    <div style={containerStyle}>
      {/* SuperAdmin Cards */}
      {isSuperAdmin && (
        <>
          <h2 style={{ marginBottom: "0.25rem", fontSize: "clamp(1.3rem, 5vw, 1.8rem)", fontWeight: "700" }}>
            SuperAdmin Dashboard
          </h2>
          <p style={{
            margin: "0 0 1rem 0",
            fontSize: "1rem",
            color: "#2e7d32",
            fontWeight: 600,
            fontStyle: "italic",
            letterSpacing: "0.02em",
            fontFamily: '"Montserrat", sans-serif',
          }}>
            Know Your Numbers
          </p>
          
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

            {/* Business Trackers */}
            <a href="/admin/business-trackers" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #00695c 0%, #004d40 100%)",
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
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Business Trackers</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Financial intelligence engine for communities
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

            {/* Community Management */}
            <button
              type="button"
              onClick={() => setShowCommunityManager(true)}
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
                textAlign: "left",
                border: "none",
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
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Community Management</h3>
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                  Manage communities and members
                </p>
              </div>
            </button>

            {/* Store Management */}
            <a href="/admin/store-management" style={{ textDecoration: "none" }}>
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
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🏪</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Store Management</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Manage stores, assign admins & audit activity
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

            {/* Messages & Notifications */}
            <button
              type="button"
              onClick={() => setShowMessagesPanel(true)}
              style={{
                ...utilityCardStyle,
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                background: "linear-gradient(135deg, #00838f 0%, #006064 100%)",
                color: "#fff",
                minHeight: "140px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                textAlign: "left",
                border: "none",
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
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📬</div>
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Messages & Notifications</h3>
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                  Respond to member messages
                </p>
              </div>
            </button>

            {/* QR Communities - Usage & Billing */}
            <a href="/superadmin/usage" style={{ textDecoration: "none" }}>
              <div
                style={{
                  ...utilityCardStyle,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  background: "linear-gradient(135deg, #7b1fa2 0%, #4a148c 100%)",
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
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💳</div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>QR Communities Billing</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.95 }}>
                    Manage pricing, quotas, and usage tracking
                  </p>
                </div>
              </div>
            </a>

          </div>
        </>
      )}

      {isMessageAdmin && !isSuperAdmin && (
        <div style={{ marginBottom: "2rem" }}>
          {messagesPanel}
        </div>
      )}

      {/* Community Admin Dashboard - for junior community admins */}
      {isCommunityAdmin && !isSuperAdmin && (
        <div
          style={{
            marginBottom: "2rem",
            background: "#ffffff",
            borderRadius: 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem", fontSize: "1.8rem", fontWeight: "700" }}>
            Community Admin Dashboard
          </h2>
          <div style={{ marginBottom: "1rem" }}>
            <a
              href="/admin/community-dashboard"
              style={{
                display: "inline-block",
                padding: "0.6rem 1rem",
                borderRadius: 8,
                background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                color: "#fff",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              Open Full Community Dashboard →
            </a>
          </div>
          <div style={farmCardStyle}>
            <div style={glassPanelStyle}>
              {/* Community summary card with logo - DYNAMIC */}
              <div
                style={{
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(232,245,233,0.95) 100%)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  flexWrap: "wrap",
                }}
              >
                {communities && communities.length > 0 ? (
                  <>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 18,
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.16)",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {getCommunityLogo(communities[0]) ? (
                      <img
                        src={getCommunityLogo(communities[0])}
                        alt={`${communities[0].name} logo`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                      ) : (
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#999" }}>
                          {communities[0].name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 800,
                          letterSpacing: "-0.03em",
                          textTransform: "uppercase",
                          color: "#1b5e20",
                        }}
                      >
                        {communities[0].name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "#374151",
                          maxWidth: "28rem",
                        }}
                      >
                        {communities[0].description}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#999" }}>
                    No communities assigned
                  </div>
                )}
              </div>

              {selectedCommunityId ? (
                <>
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
                      onChange={(e) => setMemberStatusFilter(e.target.value as any)}
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
                    <label style={{ fontWeight: 600 }}>Per page:</label>
                    <select
                      value={communityMembersPageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        setCommunityMembersPageSize(nextSize);
                        setCommunityMembersPage(1);
                        updatePaginationPreferences({
                          userId: adminId,
                          listKey: communityMembersPageSizeKey,
                          pageSize: nextSize,
                        } as any);
                      }}
                      style={{
                        padding: "0.35rem 0.6rem",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
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
                            {["Alias", "Status", "Phone", "Email", "Joined", "Actions"].map((h) => (
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
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCommunityMembers.map((m: any) => (
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Showing {communityMembersStart}-{communityMembersEnd} of {communityMembersList.length}
                        </div>
                        {communityMembersTotalPages > 1 && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setCommunityMembersPage((p) => Math.max(1, p - 1))}
                              disabled={communityMembersPage === 1}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: communityMembersPage === 1 ? "#f1f5f9" : "#fff",
                                cursor: communityMembersPage === 1 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setCommunityMembersPage((p) => Math.min(communityMembersTotalPages, p + 1))}
                              disabled={communityMembersPage >= communityMembersTotalPages}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: communityMembersPage >= communityMembersTotalPages ? "#f1f5f9" : "#fff",
                                cursor: communityMembersPage >= communityMembersTotalPages ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                    gap: "1rem",
                  }}
                >
                  {communities === undefined ? (
                    <p style={{ color: "#666" }}>Loading communities...</p>
                  ) : communities.length === 0 ? (
                    <p style={{ color: "#666" }}>
                      No communities assigned. Contact your administrator to be assigned to a community.
                    </p>
                  ) : (
                    communities.map((c: any) => (
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
                    ))
                  )}
                </div>
              )}
            </div>
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
      )}

      {isSuperAdmin && showMessagesPanel && (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Messages & Notifications</h2>
            <button
              type="button"
              onClick={() => setShowMessagesPanel(false)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
          {messagesPanel}
        </div>
      )}

      {isSuperAdmin && showCommunityManager && (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Community Management</h2>
            <button
              type="button"
              onClick={() => setShowCommunityManager(false)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <a
              href="/admin/communities"
              style={{
                display: "inline-block",
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #ddd",
                background: "#f5f5f5",
                textDecoration: "none",
                color: "#333",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Open Full Community Manager
            </a>
          </div>

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

          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={utilityCardStyle}>Notifications (Premium)</div>
            <div style={utilityCardStyle}>Inbox (Premium)</div>
          </div>

          {/* ── Community Overview Grid ── */}
          {communities && communities.length > 0 && (
            <div style={{ marginBottom: "1.75rem" }}>
              <h3 style={{ marginBottom: "0.75rem", fontSize: "1.1rem", fontWeight: 700 }}>Community Overview</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "1rem" }}>
                {communities.map((c: any) => (
                  <div
                    key={c._id}
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      padding: "1rem",
                      border: "1px solid #e0e0e0",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "#e3f2fd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#1565c0",
                        fontSize: "1rem",
                        flexShrink: 0,
                      }}>
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#888" }}>
                          {c.communityType === "qr" ? "QR Community" : "Application-based"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      <div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1976d2" }}>{c.memberCount || 0}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>Members</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 700, color: c.status === "active" ? "#2e7d32" : "#999" }}>
                          {c.status === "active" ? "✓" : "—"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>{c.status || "active"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        href={`/admin/community-dashboard?communityId=${c._id}`}
                        style={{
                          padding: "0.4rem 0.75rem",
                          background: "#e3f2fd",
                          color: "#1565c0",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          minHeight: "36px",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Dashboard
                      </a>
                      {c.qrSlug && (
                        <a
                          href={`/join/community/${c.qrSlug}`}
                          target="_blank"
                          rel="noopener"
                          style={{
                            padding: "0.4rem 0.75rem",
                            background: "#f5f5f5",
                            color: "#555",
                            borderRadius: "6px",
                            textDecoration: "none",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            minHeight: "36px",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          Join Link ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={farmCardStyle}>
            <div style={glassPanelStyle}>
              {isSuperAdmin && (
                <div id="members" style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ marginBottom: "1rem" }}>Members</h3>
                  <div style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "1rem",
                    border: "1px solid #e0e0e0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      marginBottom: "1rem",
                    }}>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ fontWeight: 600 }}>Category:</label>
                        <select
                          value={memberRoleFilter}
                          onChange={(e) => setMemberRoleFilter(e.target.value as any)}
                          style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd" }}
                        >
                          <option value="all">All</option>
                          <option value="farmer">Farmers</option>
                          <option value="trader">Traders</option>
                          <option value="buyer">Buyers</option>
                        </select>
                        <label style={{ fontWeight: 600 }}>Per page:</label>
                        <select
                          value={membersPageSize}
                          onChange={(e) => {
                            const nextSize = Number(e.target.value);
                            setMembersPageSize(nextSize);
                            setMembersPage(1);
                            updatePaginationPreferences({
                              userId: adminId,
                              listKey: membersPageSizeKey,
                              pageSize: nextSize,
                            } as any);
                          }}
                          style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd" }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <button
                        onClick={handleExportAllMembers}
                        style={{
                          background: "#111827",
                          color: "#fff",
                          padding: "0.5rem 0.9rem",
                          borderRadius: 6,
                          border: "none",
                          fontWeight: 600,
                        }}
                      >
                        Export Excel (All Fields)
                      </button>
                    </div>
                    {membersList === undefined ? (
                      <p style={{ color: "#666" }}>Loading members...</p>
                    ) : filteredMembers.length === 0 ? (
                      <p style={{ color: "#666" }}>No members found.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                          <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "0.6rem" }}>Role</th>
                              <th style={{ padding: "0.6rem" }}>Alias</th>
                              <th style={{ padding: "0.6rem" }}>Member ID</th>
                              <th style={{ padding: "0.6rem" }}>Email</th>
                              <th style={{ padding: "0.6rem" }}>Phone</th>
                              <th style={{ padding: "0.6rem" }}>Location</th>
                              <th style={{ padding: "0.6rem" }}>Communities</th>
                              <th style={{ padding: "0.6rem" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedMembers.map((member: any) => (
                              <tr key={member.userId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.6rem" }}>{member.role}</td>
                                <td style={{ padding: "0.6rem" }}>{member.alias || "-"}</td>
                                <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.8rem" }}>{member.userId}</td>
                                <td style={{ padding: "0.6rem" }}>{member.email || "-"}</td>
                                <td style={{ padding: "0.6rem" }}>{member.phoneNumber || "-"}</td>
                                <td style={{ padding: "0.6rem", color: "#666" }}>
                                  {[member.districtText, member.subCountyText, member.village].filter(Boolean).join(" • ") || "-"}
                                </td>
                                <td style={{ padding: "0.6rem", color: "#666" }}>
                                  {(member.communityNames || []).join(", ") || "-"}
                                </td>
                                <td style={{ padding: "0.6rem" }}>
                                  <button
                                    onClick={() => setSelectedMember(member)}
                                    style={{
                                      padding: "0.35rem 0.6rem",
                                      borderRadius: 6,
                                      border: "1px solid #d1d5db",
                                      background: "#ffffff",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>
                            Showing {membersStart}-{membersEnd} of {filteredMembers.length}
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                              disabled={membersPage === 1}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: membersPage === 1 ? "#f1f5f9" : "#fff",
                                cursor: membersPage === 1 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setMembersPage((p) => Math.min(membersTotalPages, p + 1))}
                              disabled={membersPage >= membersTotalPages}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: membersPage >= membersTotalPages ? "#f1f5f9" : "#fff",
                                cursor: membersPage >= membersTotalPages ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                <label style={{ fontWeight: 600 }}>Per page:</label>
                <select
                  value={communityMembersPageSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value);
                    setCommunityMembersPageSize(nextSize);
                    setCommunityMembersPage(1);
                    updatePaginationPreferences({
                      userId: adminId,
                      listKey: communityMembersPageSizeKey,
                      pageSize: nextSize,
                    } as any);
                  }}
                  style={{
                    padding: "0.35rem 0.6rem",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
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
                      {pagedCommunityMembers.map((m: any) => (
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      Showing {communityMembersStart}-{communityMembersEnd} of {communityMembersList.length}
                    </div>
                    {communityMembersTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => setCommunityMembersPage((p) => Math.max(1, p - 1))}
                          disabled={communityMembersPage === 1}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: communityMembersPage === 1 ? "#f1f5f9" : "#fff",
                            cursor: communityMembersPage === 1 ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommunityMembersPage((p) => Math.min(communityMembersTotalPages, p + 1))}
                          disabled={communityMembersPage >= communityMembersTotalPages}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: communityMembersPage >= communityMembersTotalPages ? "#f1f5f9" : "#fff",
                            cursor: communityMembersPage >= communityMembersTotalPages ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
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

          {selectedMember && (
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
              onClick={() => setSelectedMember(null)}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0 }}>Member Details</h3>
                  <button
                    onClick={() => setSelectedMember(null)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  {[
                    { label: "Role", value: selectedMember.role },
                    { label: "Alias", value: selectedMember.alias },
                    { label: "Member ID", value: selectedMember.userId },
                    { label: "Email", value: selectedMember.email },
                    { label: "Phone", value: selectedMember.phoneNumber },
                    { label: "Sex", value: selectedMember.sex },
                    { label: "Admin Level", value: selectedMember.adminLevel },
                    { label: "Admin Category", value: selectedMember.adminCategory },
                    { label: "Service Level", value: selectedMember.serviceLevel },
                    { label: "Export Limit", value: selectedMember.exportLimit },
                    { label: "Region", value: selectedMember.region },
                    { label: "District", value: selectedMember.districtText },
                    { label: "SubCounty", value: selectedMember.subCountyText },
                    { label: "Village", value: selectedMember.village },
                    { label: "County", value: selectedMember.county },
                    { label: "Water Source", value: selectedMember.waterSource },
                    { label: "Onboarding Completed", value: selectedMember.onboardingCompleted ? "Yes" : "No" },
                    { label: "Verified Trader", value: selectedMember.isVerifiedTrader ? "Yes" : "No" },
                    { label: "Verification Status", value: selectedMember.verificationStatus },
                    { label: "Verified By", value: selectedMember.verifiedBy },
                    { label: "Verified At", value: selectedMember.verifiedAt ? formatUgandaDate(selectedMember.verifiedAt) : "-" },
                    { label: "Created At", value: selectedMember.createdAt ? formatUgandaDate(selectedMember.createdAt) : "-" },
                    { label: "Last Active", value: selectedMember.lastActiveAt ? formatUgandaDate(selectedMember.lastActiveAt) : "-" },
                    { label: "Communities", value: (selectedMember.communityNames || []).join(", ") || "-" },
                    { label: "Community IDs", value: (selectedMember.communityIds || []).join(", ") || "-" },
                  ].map((item) => (
                    <div key={item.label} style={{
                      padding: "0.75rem",
                      border: "1px solid #eee",
                      borderRadius: 8,
                      background: "#fafafa",
                    }}>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>{item.label}</div>
                      <div style={{ fontWeight: 600, wordBreak: "break-word" }}>{item.value || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

    </div>
  );
}
