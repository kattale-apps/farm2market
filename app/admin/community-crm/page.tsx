"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { savePdfFromJsPDF } from "../../utils/pdfDownload";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#1f7a3e";

const defaultScript =
  "Good morning, {{customer_gender_title}} {{customer_last_name}}. My name is {{agent_name}} calling from Bio Farm. You previously purchased our fertilizer on {{purchase_date}}. We are following up to find out how it has performed on your farm and whether you need any assistance.";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function CommunityCrmPage() {
  const searchParams = useSearchParams();
  const communityIdFromUrl = searchParams.get("communityId") as Id<"communities"> | null;

  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    userId ? { adminId: userId } : "skip"
  );

  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);
  const [name, setName] = useState("Purchase Follow-Up Form");
  const [description, setDescription] = useState("Call center follow-up questionnaire for recent purchasers");
  const [followUpOffsetDays, setFollowUpOffsetDays] = useState(7);
  const [openingScriptEnabled, setOpeningScriptEnabled] = useState(true);
  const [openingScriptTemplate, setOpeningScriptTemplate] = useState(defaultScript);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [selectedCrmFormId, setSelectedCrmFormId] = useState<Id<"crmForms"> | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("select");
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldOptions, setNewFieldOptions] = useState("Yes,No");
  const [addingField, setAddingField] = useState(false);
  const [removingFieldId, setRemovingFieldId] = useState("");

  const [intakeCrmFormId, setIntakeCrmFormId] = useState<Id<"crmForms"> | null>(null);
  const [intakeMode, setIntakeMode] = useState<"existing" | "new">("new");
  const [memberSearch, setMemberSearch] = useState("");
  const [intakeMemberId, setIntakeMemberId] = useState<Id<"users"> | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [intakeProductName, setIntakeProductName] = useState("");
  const [intakeQuantity, setIntakeQuantity] = useState("");
  const [intakePurchaseDate, setIntakePurchaseDate] = useState("");
  const [intakeDistrictId, setIntakeDistrictId] = useState<Id<"districts"> | "">("");
  const [intakeSubcountyId, setIntakeSubcountyId] = useState<Id<"subcounties"> | "">("");
  const [intakeParishId, setIntakeParishId] = useState<Id<"parishes"> | "">("");
  const [intakeCropGrown, setIntakeCropGrown] = useState("");
  const [intakeMonthOfPlanting, setIntakeMonthOfPlanting] = useState("");
  const [intakePastSprayDates, setIntakePastSprayDates] = useState("");
  const [intakeUpcomingSprayDate, setIntakeUpcomingSprayDate] = useState("");
  const [intakeFieldValues, setIntakeFieldValues] = useState<Record<string, string>>({});
  const [submittingIntake, setSubmittingIntake] = useState(false);

  const CROP_OPTIONS = ["Coffee", "Maize", "Beans", "Groundnuts", "Rice", "Tomatoes", "Pineapple", "Bananas", "Other"];
  const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const crmEnabledForSelected =
    ((communities || []).find((c: any) => {
      const currentCommunityId = c?._id ?? c?.id;
      return String(currentCommunityId ?? "") === String(selectedCommunityId || "");
    }) as any)?.crmEnabled === true;

  const crmForms = useQuery(
    (api as any).crmForms.getCommunityCrmForms,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const todayPerformance = useQuery(
    (api as any).crmAnalytics.getCallCenterPerformanceToday,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const agentPerformance = useQuery(
    (api as any).crmAnalytics.getAgentPerformanceToday,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const crmHomeSummary = useQuery(
    (api as any).crmAnalytics.getCrmHomeSummary,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const crmAgents = useQuery(
    (api as any).crmAgents.listCrmAgents,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const opportunityExportRows = useQuery(
    (api as any).crmAnalytics.getOpportunityExportRows,
    userId && selectedCommunityId && crmEnabledForSelected
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const selectedCrmFormDetails = useQuery(
    (api as any).crmForms.getCrmFormDetails,
    userId && selectedCrmFormId && crmEnabledForSelected
      ? { requesterId: userId, crmFormId: selectedCrmFormId }
      : "skip"
  );

  const intakeCrmFormDetails = useQuery(
    (api as any).crmForms.getCrmFormDetails,
    userId && intakeCrmFormId && crmEnabledForSelected
      ? { requesterId: userId, crmFormId: intakeCrmFormId }
      : "skip"
  );

  const communityMembers = useQuery(
    api.messages.getCommunityMembersForMessaging,
    selectedCommunityId && crmEnabledForSelected ? { communityId: selectedCommunityId } : "skip"
  );

  const intakeDistricts = useQuery(api.locations.getActiveDistricts, {});
  const intakeSubcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    intakeDistrictId ? { districtId: intakeDistrictId } : "skip"
  );
  const intakeParishes = useQuery(
    api.locations.getParishesBySubcounty,
    intakeSubcountyId ? { subcountyId: intakeSubcountyId } : "skip"
  );

  const createCrmForm = useMutation((api as any).crmForms.createCrmForm);
  const addCrmFormField = useMutation((api as any).crmForms.addCrmFormField);
  const removeCrmFormField = useMutation((api as any).crmForms.removeCrmFormField);
  const assignCrmAgentByEmail = useMutation((api as any).crmAgents.assignCrmAgentByEmail);
  const submitCrmIntake = useMutation((api as any).crmForms.submitCrmIntake);

  useEffect(() => {
    if (!communities || communities.length === 0) return;

    if (communityIdFromUrl) {
      const found = communities.find((c: any) => {
        const currentCommunityId = c?._id ?? c?.id;
        return String(currentCommunityId ?? "") === String(communityIdFromUrl);
      });
      if (found) {
        setSelectedCommunityId(communityIdFromUrl);
        return;
      }
    }

    if (!selectedCommunityId) {
      const firstCommunityId = communities[0]?._id ?? communities[0]?.id;
      if (firstCommunityId) {
        setSelectedCommunityId(firstCommunityId as Id<"communities">);
      }
    }
  }, [communities, communityIdFromUrl, selectedCommunityId]);

  const isAdmin = currentUser?.role === "admin";
  const selectedCommunity = useMemo(
    () => (communities || []).find((c: any) => {
      const currentCommunityId = c?._id ?? c?.id;
      return String(currentCommunityId ?? "") === String(selectedCommunityId || "");
    }),
    [communities, selectedCommunityId]
  );

  const handleCreateDefaultCrmForm = async () => {
    if (!userId || !selectedCommunityId) return;
    setBusy(true);
    setMessage("");

    try {
      const result = await createCrmForm({
        adminId: userId,
        communityId: selectedCommunityId,
        name,
        description,
        followUpOffsetDays,
        openingScriptEnabled,
        openingScriptTemplate,
      });

      const defaultFields = [
        { fieldType: "select", label: "Did farmer use the fertilizer?", required: true, options: ["Yes", "Partly", "No", "Don't know"], presetKey: "usage_status" },
        { fieldType: "select", label: "How would you rate the result?", required: true, options: ["Very good", "Good", "Average", "Poor", "Very poor"], presetKey: "result_rating" },
        { fieldType: "select", label: "Any problem?", required: false, options: ["No problem", "Application problem", "Product problem", "Packaging problem", "Delivery problem", "Farmer needs technical advice", "Other"], presetKey: "issue_type" },
        { fieldType: "select", label: "Wants to purchase more?", required: true, options: ["Yes", "Maybe", "No"], presetKey: "repurchase_intent" },
        { fieldType: "text", label: "Notes", required: false, presetKey: "notes" },
      ];

      for (const field of defaultFields) {
        await addCrmFormField({
          crmFormId: result.formId,
          adminId: userId,
          fieldType: field.fieldType,
          label: field.label,
          required: field.required,
          options: field.options,
          presetKey: field.presetKey,
        });
      }

      setMessage("CRM form created with default call-center fields.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to create CRM form");
    }

    setBusy(false);
  };

  const handleAssignAgentByEmail = async () => {
    if (!userId || !selectedCommunityId || !agentEmail.trim()) return;

    setAssigningAgent(true);
    setMessage("");

    try {
      await assignCrmAgentByEmail({
        supervisorId: userId,
        communityId: selectedCommunityId,
        agentEmail: agentEmail.trim(),
        displayName: agentDisplayName.trim() || undefined,
      });

      setMessage("CRM agent assigned successfully.");
      setAgentEmail("");
      setAgentDisplayName("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to assign CRM agent");
    }

    setAssigningAgent(false);
  };

  const handleAddField = async () => {
    if (!userId || !selectedCrmFormId || !newFieldLabel.trim()) return;

    setAddingField(true);
    setMessage("");

    try {
      const maybeOptions =
        newFieldType === "select" || newFieldType === "checkbox"
          ? newFieldOptions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;

      await addCrmFormField({
        crmFormId: selectedCrmFormId,
        adminId: userId,
        fieldType: newFieldType,
        label: newFieldLabel.trim(),
        required: newFieldRequired,
        options: maybeOptions && maybeOptions.length > 0 ? maybeOptions : undefined,
      });

      setMessage("Field added to CRM form.");
      setNewFieldLabel("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to add field");
    }

    setAddingField(false);
  };

  const handleRemoveField = async (crmFieldId: Id<"crmFormFields">) => {
    if (!userId) return;

    setRemovingFieldId(String(crmFieldId));
    setMessage("");
    try {
      await removeCrmFormField({
        crmFieldId,
        adminId: userId,
      });
      setMessage("Field removed.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to remove field");
    }
    setRemovingFieldId("");
  };

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const list = communityMembers || [];
    if (!term) return list.slice(0, 20);
    return list
      .filter((m: any) =>
        (m.alias || "").toLowerCase().includes(term) ||
        (m.phoneNumber || "").toLowerCase().includes(term) ||
        (m.email || "").toLowerCase().includes(term)
      )
      .slice(0, 20);
  }, [communityMembers, memberSearch]);

  const handleIntakeFieldChange = (crmFieldId: string, value: string) => {
    setIntakeFieldValues((prev) => ({ ...prev, [crmFieldId]: value }));
  };

  const handleSubmitIntake = async () => {
    if (!userId || !intakeCrmFormId) return;
    if (intakeMode === "existing" && !intakeMemberId) return;
    if (intakeMode === "new" && (!newClientName.trim() || !newClientPhone.trim())) return;

    setSubmittingIntake(true);
    setMessage("");

    try {
      const responses = Object.entries(intakeFieldValues)
        .filter(([, value]) => value.trim().length > 0)
        .map(([crmFieldId, value]) => ({ crmFieldId: crmFieldId as Id<"crmFormFields">, value }));

      const pastSprayDates = intakePastSprayDates
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const districtName = (intakeDistricts || []).find((d: any) => d.id === intakeDistrictId)?.name;
      const subcountyName = (intakeSubcounties || []).find((s: any) => s.id === intakeSubcountyId)?.name;
      const parishName = (intakeParishes || []).find((p: any) => p.id === intakeParishId)?.name;

      const result = await submitCrmIntake({
        crmFormId: intakeCrmFormId,
        adminId: userId,
        existingMemberId: intakeMode === "existing" ? intakeMemberId : undefined,
        newClient: intakeMode === "new" ? { name: newClientName.trim(), phoneNumber: newClientPhone.trim() } : undefined,
        purchaseDate: intakePurchaseDate || undefined,
        productName: intakeProductName || undefined,
        purchaseQuantity: intakeQuantity || undefined,
        district: districtName || undefined,
        subCounty: subcountyName || undefined,
        parish: parishName || undefined,
        cropGrown: intakeCropGrown || undefined,
        monthOfPlanting: intakeMonthOfPlanting || undefined,
        pastSprayDates: pastSprayDates.length > 0 ? pastSprayDates : undefined,
        upcomingSprayScheduleAt: intakeUpcomingSprayDate ? new Date(`${intakeUpcomingSprayDate}T09:00:00`).getTime() : undefined,
        responses,
      });

      setMessage(
        result.wasNewClient
          ? "Lead captured and a new member account was created (login: their phone number)."
          : "Lead captured. It will now appear in the agent call queue."
      );
      setIntakeMemberId(null);
      setMemberSearch("");
      setNewClientName("");
      setNewClientPhone("");
      setIntakeProductName("");
      setIntakeQuantity("");
      setIntakePurchaseDate("");
      setIntakeDistrictId("");
      setIntakeSubcountyId("");
      setIntakeParishId("");
      setIntakeCropGrown("");
      setIntakeMonthOfPlanting("");
      setIntakePastSprayDates("");
      setIntakeUpcomingSprayDate("");
      setIntakeFieldValues({});
    } catch (error: any) {
      setMessage(error?.message || "Failed to capture lead");
    }

    setSubmittingIntake(false);
  };

  const handleExportTodayCsv = () => {
    if (!todayPerformance || !selectedCommunity) return;

    downloadCsv(
      `crm-today-${selectedCommunity.name}-${new Date().toISOString().split("T")[0]}.csv`,
      [{
        community: selectedCommunity.name,
        agents: todayPerformance.agents,
        callsAttempted: todayPerformance.callsAttempted,
        answered: todayPerformance.answered,
        completedFollowUps: todayPerformance.completedFollowUps,
        salesOpportunities: todayPerformance.salesOpportunities,
        orders: todayPerformance.orders,
        productIssues: todayPerformance.productIssues,
      }]
    );
  };

  const handleExportAgentsCsv = () => {
    if (!selectedCommunity || !agentPerformance || agentPerformance.length === 0) return;

    const rows = agentPerformance.map((row: any) => ({
      community: selectedCommunity.name,
      agentName: row.agentName,
      calls: row.calls,
      opportunities: row.opportunities,
    }));

    downloadCsv(
      `crm-agents-${selectedCommunity.name}-${new Date().toISOString().split("T")[0]}.csv`,
      rows
    );
  };

  const handleExportFormsCsv = () => {
    if (!selectedCommunity || !crmForms || crmForms.length === 0) return;

    const rows = crmForms.map((form: any) => ({
      community: selectedCommunity.name,
      formName: form.name,
      active: form.isActive ? "yes" : "no",
      followUpOffsetDays: form.followUpOffsetDays,
      openingScriptEnabled: form.openingScriptEnabled ? "yes" : "no",
      openingScriptVersion: form.openingScriptVersion ?? 1,
      createdAt: new Date(form.createdAt).toISOString(),
    }));

    downloadCsv(
      `crm-forms-${selectedCommunity.name}-${new Date().toISOString().split("T")[0]}.csv`,
      rows
    );
  };

  const handleExportOpportunitiesCsv = () => {
    if (!selectedCommunity || !opportunityExportRows || opportunityExportRows.length === 0) return;

    const rows = opportunityExportRows.map((row: any) => ({
      community: selectedCommunity.name,
      opportunityId: row.opportunityId,
      stage: row.stage,
      probability: row.probability,
      farmer: row.farmer,
      productName: row.productName,
      quantity: row.quantity,
      expectedPurchaseMonth: row.expectedPurchaseMonth,
      openedBy: row.openedBy,
      assignedSales: row.assignedSales,
      nextActionAt: row.nextActionAt ? new Date(row.nextActionAt).toISOString() : "",
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
    }));

    downloadCsv(
      `crm-opportunities-${selectedCommunity.name}-${new Date().toISOString().split("T")[0]}.csv`,
      rows
    );
  };

  const handleExportSummaryPdf = async () => {
    if (!selectedCommunity) return;

    try {
      const jsPDF = require("jspdf");
      require("jspdf-autotable");
      const doc = new jsPDF.default();

      doc.setFontSize(18);
      doc.setTextColor(31, 122, 62);
      doc.text("Community CRM Summary", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`Community: ${selectedCommunity.name}`, 14, 28);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

      const summaryRows = [
        ["Today's Calls", String(todayPerformance?.callsAttempted ?? 0)],
        ["Answered", String(todayPerformance?.answered ?? 0)],
        ["Completed Follow-ups", String(todayPerformance?.completedFollowUps ?? 0)],
        ["Opportunities (Today)", String(todayPerformance?.salesOpportunities ?? 0)],
        ["Orders", String(todayPerformance?.orders ?? 0)],
        ["Product Issues", String(todayPerformance?.productIssues ?? 0)],
        ["Needs Follow-up", String(crmHomeSummary?.needsFollowUp ?? 0)],
        ["Due Today", String(crmHomeSummary?.followUpsDueToday ?? 0)],
      ];

      (doc as any).autoTable({
        startY: 42,
        head: [["Metric", "Value"]],
        body: summaryRows,
        theme: "grid",
        headStyles: { fillColor: [31, 122, 62], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
      });

      const nextY = Number((doc as any).lastAutoTable?.finalY || 56) + 10;

      const agentRows = (agentPerformance || []).slice(0, 10).map((row: any) => [
        row.agentName,
        String(row.calls),
        String(row.opportunities),
      ]);

      if (agentRows.length > 0) {
        (doc as any).autoTable({
          startY: nextY,
          head: [["Agent", "Calls", "Opportunities"]],
          body: agentRows,
          theme: "grid",
          headStyles: { fillColor: [21, 111, 68], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
        });
      }

      await savePdfFromJsPDF(
        doc,
        `crm-summary-${selectedCommunity.name}-${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (error) {
      setMessage("Failed to export PDF summary.");
    }
  };

  if (status === "loading") {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  }

  if (!userId || !isAdmin) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT }}>
        <h2 style={{ marginTop: 0 }}>Access denied</h2>
        <p>Only admins can access Community CRM.</p>
        <Link href="/">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f7f4", padding: "1rem", fontFamily: FONT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", background: "#fff", borderRadius: 14, padding: "1rem", boxShadow: "0 8px 20px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <Link href="/admin/community-dashboard" style={{ color: BRAND, textDecoration: "none", fontSize: "0.9rem" }}>
              &larr; Back to Community Dashboard
            </Link>
            <h1 style={{ margin: "0.4rem 0 0 0", fontSize: "clamp(1.25rem, 4vw, 1.8rem)" }}>Bio Farm Farmer Success CRM</h1>
            <p style={{ margin: "0.2rem 0 0 0", color: "#666" }}>Supervisor workspace</p>
          </div>
          {communities && communities.length > 0 && (
            <select
              value={selectedCommunityId || ""}
              onChange={(e) => setSelectedCommunityId(e.target.value as Id<"communities">)}
              style={{ minHeight: 44, padding: "0.5rem", borderRadius: 8, border: "1px solid #ccc", minWidth: 220 }}
            >
              {communities.map((c: any) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          <MetricCard label="Today's Calls" value={todayPerformance?.callsAttempted} />
          <MetricCard label="Answered" value={todayPerformance?.answered} />
          <MetricCard label="Follow-ups Due" value={crmHomeSummary?.followUpsDueToday} />
          <MetricCard label="Sales Opportunities" value={todayPerformance?.salesOpportunities} />
          <MetricCard label="Product Issues" value={todayPerformance?.productIssues} />
          <MetricCard label="Agents" value={todayPerformance?.agents} />
        </div>

        {!crmEnabledForSelected && selectedCommunityId && (
          <div style={{ marginTop: "0.9rem", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 10, padding: "0.8rem" }}>
            Community CRM is disabled for this community. Enable it in Community Dashboard settings first.
          </div>
        )}

        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={handleExportTodayCsv}
            disabled={!todayPerformance || !selectedCommunity || !crmEnabledForSelected}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !todayPerformance || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Today CSV
          </button>
          <button
            onClick={handleExportAgentsCsv}
            disabled={!agentPerformance || agentPerformance.length === 0 || !selectedCommunity || !crmEnabledForSelected}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !agentPerformance || agentPerformance.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Agent CSV
          </button>
          <button
            onClick={handleExportFormsCsv}
            disabled={!crmForms || crmForms.length === 0 || !selectedCommunity || !crmEnabledForSelected}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !crmForms || crmForms.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Forms CSV
          </button>
          <button
            onClick={handleExportOpportunitiesCsv}
            disabled={!opportunityExportRows || opportunityExportRows.length === 0 || !selectedCommunity || !crmEnabledForSelected}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !opportunityExportRows || opportunityExportRows.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Opportunities CSV
          </button>
          <button
            onClick={handleExportSummaryPdf}
            disabled={!selectedCommunity || !crmEnabledForSelected}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Summary PDF
          </button>
        </div>

        <div style={{ marginTop: "1.25rem", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Create CRM Form Type</h2>
          <p style={{ marginTop: 0, color: "#666", fontSize: "0.9rem" }}>
            Supervisor-configured form drives callback queue and script shown to agents.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.7rem" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Form name" style={inputStyle} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={inputStyle} />
            <input
              value={followUpOffsetDays}
              onChange={(e) => setFollowUpOffsetDays(Number(e.target.value || 0))}
              type="number"
              min={0}
              max={365}
              placeholder="Follow-up days"
              style={inputStyle}
            />
            <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={openingScriptEnabled} onChange={(e) => setOpeningScriptEnabled(e.target.checked)} />
              Enable opening script
            </label>
          </div>
          <textarea
            value={openingScriptTemplate}
            onChange={(e) => setOpeningScriptTemplate(e.target.value)}
            rows={4}
            style={{ ...inputStyle, width: "100%", marginTop: "0.7rem" }}
          />
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.45rem" }}>
            Tokens: {"{{agent_name}}"}, {"{{customer_last_name}}"}, {"{{customer_gender_title}}"}, {"{{purchase_date}}"}, {"{{product_name}}"}, {"{{quantity}}"}, {"{{district}}"}, {"{{sub_county}}"}, {"{{parish}}"}, {"{{phone_number}}"}, {"{{crop_grown}}"}, {"{{month_of_planting}}"}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              onClick={handleCreateDefaultCrmForm}
              disabled={busy || !selectedCommunityId || !crmEnabledForSelected}
              style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Creating..." : "Create Default CRM Form"}
            </button>
            {selectedCommunity && (
              <Link href={`/community-only/crm-agent?communityId=${selectedCommunity._id}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0.6rem 0.95rem", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none", color: "#111827", fontWeight: 600 }}>
                Preview Agent View
              </Link>
            )}
          </div>
          {message && <p style={{ marginBottom: 0, color: "#1f7a3e", fontWeight: 600 }}>{message}</p>}
        </div>

        <div style={{ marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Capture New Lead (Intake)</h2>
          <p style={{ marginTop: 0, color: "#666", fontSize: "0.9rem" }}>
            Add a client&apos;s contact and farm details to create a lead. New clients get a member account automatically (login: their phone number); agents fill in the rest of their profile once reached.
          </p>

          <select
            value={intakeCrmFormId || ""}
            onChange={(e) => {
              setIntakeCrmFormId((e.target.value || null) as Id<"crmForms"> | null);
              setIntakeFieldValues({});
            }}
            style={{ ...inputStyle, width: "100%", marginBottom: "0.65rem" }}
          >
            <option value="">Select a CRM form...</option>
            {(crmForms || []).map((form: any) => (
              <option key={form._id} value={form._id}>{form.name}</option>
            ))}
          </select>

          {intakeCrmFormId && (
            <>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem" }}>
                <button
                  onClick={() => setIntakeMode("new")}
                  style={{ ...secondaryButtonStyleSmall, background: intakeMode === "new" ? BRAND : "#fff", color: intakeMode === "new" ? "#fff" : "#111827" }}
                >
                  New client
                </button>
                <button
                  onClick={() => setIntakeMode("existing")}
                  style={{ ...secondaryButtonStyleSmall, background: intakeMode === "existing" ? BRAND : "#fff", color: intakeMode === "existing" ? "#fff" : "#111827" }}
                >
                  Existing member
                </button>
              </div>

              {intakeMode === "new" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                  <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Client full name" style={inputStyle} />
                  <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Contact phone number" style={inputStyle} />
                </div>
              ) : (
                <>
                  <input
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setIntakeMemberId(null);
                    }}
                    placeholder="Search member by name, phone or email"
                    style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }}
                  />

                  {!intakeMemberId && memberSearch.trim().length > 0 && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: "0.65rem", maxHeight: 180, overflowY: "auto" }}>
                      {(filteredMembers || []).length === 0 && (
                        <div style={{ padding: "0.5rem", color: "#777", fontSize: "0.85rem" }}>No matching members.</div>
                      )}
                      {filteredMembers.map((m: any) => (
                        <div
                          key={m.userId}
                          onClick={() => {
                            setIntakeMemberId(m.userId);
                            setMemberSearch(m.alias);
                          }}
                          style={{ padding: "0.5rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{m.alias}</div>
                          <div style={{ fontSize: "0.78rem", color: "#666" }}>{m.phoneNumber || m.email || "-"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {intakeMemberId && (
                    <div style={{ marginBottom: "0.65rem", fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>
                      Selected member: {memberSearch}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <input value={intakeProductName} onChange={(e) => setIntakeProductName(e.target.value)} placeholder="Product name" style={inputStyle} />
                <input value={intakeQuantity} onChange={(e) => setIntakeQuantity(e.target.value)} placeholder="Purchase quantity" style={inputStyle} />
                <input value={intakePurchaseDate} onChange={(e) => setIntakePurchaseDate(e.target.value)} type="date" style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <select
                  value={intakeDistrictId}
                  onChange={(e) => {
                    setIntakeDistrictId(e.target.value as Id<"districts"> | "");
                    setIntakeSubcountyId("");
                    setIntakeParishId("");
                  }}
                  style={inputStyle}
                >
                  <option value="">District (optional)...</option>
                  {(intakeDistricts || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={intakeSubcountyId}
                  onChange={(e) => {
                    setIntakeSubcountyId(e.target.value as Id<"subcounties"> | "");
                    setIntakeParishId("");
                  }}
                  disabled={!intakeDistrictId}
                  style={inputStyle}
                >
                  <option value="">Sub-county (optional)...</option>
                  {(intakeSubcounties || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={intakeParishId}
                  onChange={(e) => setIntakeParishId(e.target.value as Id<"parishes"> | "")}
                  disabled={!intakeSubcountyId}
                  style={inputStyle}
                >
                  <option value="">Parish (optional)...</option>
                  {(intakeParishes || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <select value={intakeCropGrown} onChange={(e) => setIntakeCropGrown(e.target.value)} style={inputStyle}>
                  <option value="">Crop grown...</option>
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={intakeMonthOfPlanting} onChange={(e) => setIntakeMonthOfPlanting(e.target.value)} style={inputStyle}>
                  <option value="">Month of planting...</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.2rem", fontSize: "0.82rem", color: "#666" }}>Past spray dates (optional, comma-separated)</label>
                  <input value={intakePastSprayDates} onChange={(e) => setIntakePastSprayDates(e.target.value)} placeholder="e.g. 2026-04-10, 2026-05-02" style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.2rem", fontSize: "0.82rem", color: "#666" }}>Upcoming spray appointment (optional)</label>
                  <input value={intakeUpcomingSprayDate} onChange={(e) => setIntakeUpcomingSprayDate(e.target.value)} type="date" style={{ ...inputStyle, width: "100%" }} />
                </div>
              </div>

              {(intakeCrmFormDetails?.fields || []).map((field: any) => (
                <div key={field._id} style={{ marginBottom: "0.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.2rem", fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                    {field.label}{field.required ? " *" : ""}
                  </label>
                  {Array.isArray(field.options) && field.options.length > 0 ? (
                    <select
                      value={intakeFieldValues[field._id] || ""}
                      onChange={(e) => handleIntakeFieldChange(field._id, e.target.value)}
                      style={{ ...inputStyle, width: "100%" }}
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={intakeFieldValues[field._id] || ""}
                      onChange={(e) => handleIntakeFieldChange(field._id, e.target.value)}
                      style={{ ...inputStyle, width: "100%" }}
                    />
                  )}
                </div>
              ))}

              <button
                onClick={handleSubmitIntake}
                disabled={
                  submittingIntake ||
                  !crmEnabledForSelected ||
                  (intakeMode === "existing" ? !intakeMemberId : !newClientName.trim() || !newClientPhone.trim())
                }
                style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: submittingIntake ? "not-allowed" : "pointer", marginTop: "0.4rem" }}
              >
                {submittingIntake ? "Saving..." : "Capture Lead"}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: "1rem", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Manage CRM Form Fields</h2>
          <p style={{ marginTop: 0, color: "#666", fontSize: "0.9rem" }}>
            Add or remove entry fields for a selected CRM form type.
          </p>

          <select
            value={selectedCrmFormId || ""}
            onChange={(e) => setSelectedCrmFormId((e.target.value || null) as Id<"crmForms"> | null)}
            style={{ ...inputStyle, width: "100%", marginBottom: "0.65rem" }}
          >
            <option value="">Select a CRM form...</option>
            {(crmForms || []).map((form: any) => (
              <option key={form._id} value={form._id}>{form.name}</option>
            ))}
          </select>

          {selectedCrmFormId && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem", marginBottom: "0.6rem" }}>
                <input
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Field label"
                  style={inputStyle}
                />
                <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} style={inputStyle}>
                  <option value="select">Select</option>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="textarea">Textarea</option>
                  <option value="date">Date</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: "#374151" }}>
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                  />
                  Required
                </label>
              </div>

              {(newFieldType === "select" || newFieldType === "checkbox") && (
                <input
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Options comma-separated (e.g. Yes,No,Maybe)"
                  style={{ ...inputStyle, width: "100%", marginBottom: "0.55rem" }}
                />
              )}

              <button
                onClick={handleAddField}
                disabled={addingField || !newFieldLabel.trim() || !crmEnabledForSelected}
                style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: addingField ? "not-allowed" : "pointer" }}
              >
                {addingField ? "Adding..." : "Add Field"}
              </button>

              <div style={{ marginTop: "0.75rem" }}>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>Current Fields</h3>
                {!selectedCrmFormDetails && <p style={{ color: "#777", margin: 0 }}>Loading fields...</p>}
                {(selectedCrmFormDetails?.fields || []).length === 0 && <p style={{ color: "#777", margin: 0 }}>No fields yet.</p>}
                {(selectedCrmFormDetails?.fields || []).map((field: any) => (
                  <div key={field._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{field.label}</div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>
                        {field.fieldType} {field.required ? "| required" : "| optional"}
                        {Array.isArray(field.options) && field.options.length > 0 ? ` | ${field.options.join(" / ")}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveField(field._id)}
                      disabled={removingFieldId === String(field._id) || !crmEnabledForSelected}
                      style={{ minHeight: 34, padding: "0.35rem 0.6rem", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", color: "#b91c1c", fontWeight: 600, cursor: removingFieldId === String(field._id) ? "not-allowed" : "pointer" }}
                    >
                      {removingFieldId === String(field._id) ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0.75rem" }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>Assign CRM Agent</h3>
            <p style={{ color: "#666", fontSize: "0.88rem", marginTop: 0 }}>
              Add an existing admin account as a call-center agent for this community.
            </p>
            <input
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              placeholder="Agent email"
              style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }}
            />
            <input
              value={agentDisplayName}
              onChange={(e) => setAgentDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }}
            />
            <button
              onClick={handleAssignAgentByEmail}
              disabled={assigningAgent || !selectedCommunityId || !agentEmail.trim() || !crmEnabledForSelected}
              style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: assigningAgent ? "not-allowed" : "pointer" }}
            >
              {assigningAgent ? "Assigning..." : "Assign Agent"}
            </button>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>Agent Performance</h3>
            {!agentPerformance && <p style={{ color: "#777" }}>Loading...</p>}
            {(agentPerformance || []).length === 0 && <p style={{ color: "#777" }}>No calls logged yet.</p>}
            {(agentPerformance || []).slice(0, 8).map((row: any) => (
              <div key={row.agentId} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #f0f0f0" }}>
                <span>{row.agentName}</span>
                <span>{row.calls} calls | {row.opportunities} opportunities</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>CRM Forms</h3>
            {!crmForms && <p style={{ color: "#777" }}>Loading...</p>}
            {(crmForms || []).length === 0 && <p style={{ color: "#777" }}>No CRM forms yet.</p>}
            {(crmForms || []).map((form: any) => (
              <div key={form._id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontWeight: 700 }}>{form.name}</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Follow-up +{form.followUpOffsetDays} day(s) | Script {form.openingScriptEnabled ? "on" : "off"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>Assigned CRM Agents</h3>
            {!crmAgents && <p style={{ color: "#777" }}>Loading...</p>}
            {(crmAgents || []).length === 0 && <p style={{ color: "#777" }}>No agents assigned yet.</p>}
            {(crmAgents || []).map((agent: any) => (
              <div key={agent._id} style={{ padding: "0.4rem 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontWeight: 600 }}>{agent.displayName || agent.userAlias || "Agent"}</div>
                <div style={{ fontSize: "0.82rem", color: "#666" }}>{agent.userEmail || agent.userPhone || "-"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "0.75rem" }}>
      <div style={{ fontSize: "0.82rem", color: "#666" }}>{label}</div>
      <div style={{ marginTop: "0.3rem", fontWeight: 800, fontSize: "1.3rem", color: "#1f2937" }}>
        {typeof value === "number" ? value.toLocaleString() : "-"}
      </div>
    </div>
  );
}

const secondaryButtonStyleSmall: CSSProperties = {
  minHeight: 36,
  padding: "0.35rem 0.75rem",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  padding: "0.55rem 0.65rem",
};
