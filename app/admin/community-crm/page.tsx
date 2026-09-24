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
import { CrmSubmissionsPanel } from "../../components/crm/CrmSubmissionsPanel";
import { IntakeAnswers } from "../../components/crm/IntakeAnswers";
import { LastCallAnswers } from "../../components/crm/LastCallAnswers";
import {
  ALLOWED_SCRIPT_TOKENS,
  DEFAULT_CRM_FORM_FIELDS,
  DEFAULT_OPENING_SCRIPT_TEMPLATE,
} from "../../../convex/crmPresets";
import { fromStoredUgandaTime, inUgandaTime } from "../../utils/timeUtils";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#1f7a3e";

// Each workspace section gets its own colour from a rainbow run so a trainee
// can be pointed at "the blue section" rather than a heading buried in text.
const SECTION_COLORS = {
  todaysForms: "#dc2626",   // red
  overdue: "#991b1b",       // dark red
  followUps: "#ea580c",     // orange
  submissions: "#ca8a04",   // yellow
  createForm: "#15803d",    // green
  captureLead: "#1d4ed8",   // blue
  manageFields: "#7c3aed",  // violet
} as const;

// The administration cards below the rainbow sections are not part of that
// teaching sequence, so they share one darker grey outline that still separates
// them from the page instead of competing with the colour-coded sections.
const ADMIN_SECTION_BORDER = "#9ca3af";

// The follow-up interval every new form starts on. It was an input on this
// card; supervisors change it per form from the form list instead.
const DEFAULT_FOLLOW_UP_OFFSET_DAYS = 7;

function sectionStyle(color: string, marginTop: string): CSSProperties {
  return {
    marginTop,
    border: `1px solid ${color}`,
    borderLeft: `6px solid ${color}`,
    borderRadius: 12,
    padding: "0.9rem",
  };
}

// Imported rather than redeclared. This page used to hold its own copy of the
// default script, identical to the backend's, with nothing keeping the two in
// step - and both named a single community's brand in a default every
// community on the platform receives.
const defaultScript = DEFAULT_OPENING_SCRIPT_TEMPLATE;

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
  // Blank on purpose. These three used to arrive pre-filled, so a supervisor
  // exploring the page could create a real form for the community with one
  // stray click on a name they never chose.
  const [name, setName] = useState("");
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
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<Id<"users">>>(new Set());
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
  const [backfillingNames, setBackfillingNames] = useState(false);

  const CROP_OPTIONS = ["Coffee", "Maize", "Beans", "Groundnuts", "Rice", "Tomatoes", "Pineapple", "Bananas", "Other"];
  const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const crmForms = useQuery(
    (api as any).crmForms.getCommunityCrmForms,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const todayPerformance = useQuery(
    (api as any).crmAnalytics.getCallCenterPerformanceToday,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const agentPerformance = useQuery(
    (api as any).crmAnalytics.getAgentPerformanceToday,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const crmHomeSummary = useQuery(
    (api as any).crmAnalytics.getCrmHomeSummary,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const crmAgents = useQuery(
    (api as any).crmAgents.listCrmAgents,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const todaysSubmittedForms = useQuery(
    (api as any).crmAnalytics.getTodaysSubmittedForms,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const followUpsDueDetails = useQuery(
    (api as any).crmAnalytics.getFollowUpsDueDetails,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const opportunityExportRows = useQuery(
    (api as any).crmAnalytics.getOpportunityExportRows,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
  );

  const selectedCrmFormDetails = useQuery(
    (api as any).crmForms.getCrmFormDetails,
    userId && selectedCrmFormId
      ? { requesterId: userId, crmFormId: selectedCrmFormId }
      : "skip"
  );

  const intakeCrmFormDetails = useQuery(
    (api as any).crmForms.getCrmFormDetails,
    userId && intakeCrmFormId
      ? { requesterId: userId, crmFormId: intakeCrmFormId }
      : "skip"
  );

  const communityMembers = useQuery(
    (api as any).crmForms.getCommunityMembersForCrmIntake,
    userId && selectedCommunityId
      ? { requesterId: userId, communityId: selectedCommunityId }
      : "skip"
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
  const updateCrmForm = useMutation((api as any).crmForms.updateCrmForm);
  const deleteCrmForm = useMutation((api as any).crmForms.deleteCrmForm);
  const addCrmFormField = useMutation((api as any).crmForms.addCrmFormField);
  const removeCrmFormField = useMutation((api as any).crmForms.removeCrmFormField);
  const assignCrmAgentByEmail = useMutation((api as any).crmAgents.assignCrmAgentByEmail);
  const submitCrmIntake = useMutation((api as any).crmForms.submitCrmIntake);
  const backfillCrmMemberNames = useMutation((api as any).crmForms.backfillCrmMemberNames);
  const sendFollowUpsToAgent = useMutation((api as any).crmCalls.sendFollowUpsToAgent);
  // Per follow-up section: which agent to send to, whether a send is running,
  // and the result of the last send.
  const [followUpAgentId, setFollowUpAgentId] = useState<Record<string, string>>({});
  const [sendingFollowUps, setSendingFollowUps] = useState("");
  const [followUpNotice, setFollowUpNotice] = useState<Record<string, string>>({});
  const [formActionBusyId, setFormActionBusyId] = useState("");
  // Shown inside the CRM Forms card, where the button that caused it is.
  const [formsNotice, setFormsNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

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

  const crmHeading = useMemo(() => {
    const communityName = String(selectedCommunity?.name ?? "").trim();
    return communityName ? `${communityName} Success CRM` : "Success CRM";
  }, [selectedCommunity]);

  const handleCreateDefaultCrmForm = async () => {
    if (!userId || !selectedCommunityId) return;
    setBusy(true);
    setMessage("");

    try {
      const result = await createCrmForm({
        adminId: userId,
        communityId: selectedCommunityId,
        name: name.trim(),
        followUpOffsetDays: DEFAULT_FOLLOW_UP_OFFSET_DAYS,
        openingScriptEnabled,
        openingScriptTemplate,
      });

      // These questions ARE the call record: an agent answers them on every
      // call and their answers drive the outcome columns, so the wording must
      // suit whatever this community sells.
      for (const field of DEFAULT_CRM_FORM_FIELDS) {
        await addCrmFormField({
          crmFormId: result.formId,
          adminId: userId,
          fieldType: field.fieldType,
          label: field.label,
          required: field.required,
          options: (field as any).options,
          presetKey: field.presetKey,
        });
      }

      // Cleared so the next click cannot repeat the form that was just made.
      setName("");
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
      // Convex redacts plain Error messages in production; the reason only
      // survives on a ConvexError's `data`.
      setMessage(error?.data ?? error?.message ?? "Failed to assign CRM agent");
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

  const handleToggleFormActive = async (form: any) => {
    if (!userId) return;

    setFormActionBusyId(String(form._id));
    setMessage("");
    try {
      await updateCrmForm({
        crmFormId: form._id,
        adminId: userId,
        isActive: !form.isActive,
      });
      setMessage(form.isActive ? "Form deactivated." : "Form activated.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to update form");
    }
    setFormActionBusyId("");
  };

  // Deleting a form used to fail silently from the supervisor's point of view:
  // the backend refused any form that had submissions, and the error landed in
  // the message line at the top of the page, far from the button that was
  // pressed. The result is now reported next to the form, and a form with
  // history is deleted on a second confirmation that states what goes with it.
  const handleDeleteForm = async (form: any) => {
    if (!userId) return;
    if (!window.confirm(`Delete the form "${form.name}"? This cannot be undone.`)) return;

    setFormActionBusyId(String(form._id));
    setMessage("");
    setFormsNotice(null);
    try {
      const result: any = await deleteCrmForm({
        crmFormId: form._id,
        adminId: userId,
      });

      if (result?.requiresConfirmation) {
        const parts = [
          `${result.responseCount} submitted form(s)`,
          `${result.leadCount} lead(s)`,
          `${result.callCount} logged call(s)`,
        ].join(", ");
        const proceed = window.confirm(
          `"${form.name}" has history attached: ${parts}.\n\n` +
            "Deleting the form permanently deletes all of it, including the answers " +
            "agents captured on those calls. There is no undo.\n\n" +
            "Press OK to delete everything, or Cancel and use Deactivate to stop new " +
            "submissions while keeping the records."
        );
        if (!proceed) {
          setFormsNotice({ tone: "info", text: `"${form.name}" was not deleted.` });
          setFormActionBusyId("");
          return;
        }

        await deleteCrmForm({
          crmFormId: form._id,
          adminId: userId,
          deleteResponses: true,
        });
      }

      if (selectedCrmFormId === form._id) setSelectedCrmFormId(null);
      if (intakeCrmFormId === form._id) setIntakeCrmFormId(null);
      setFormsNotice({ tone: "success", text: `"${form.name}" deleted.` });
    } catch (error: any) {
      setFormsNotice({ tone: "error", text: error?.message || "Failed to delete form" });
    }
    setFormActionBusyId("");
  };

  const memberLocationLabel = (m: any) => {
    const parts = [m?.parishText, m?.subCountyText, m?.districtText].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
    if (m?.village || m?.county) return [m?.village, m?.county].filter(Boolean).join(", ");
    return "Location not on file";
  };

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const list = communityMembers || [];
    if (!term) return list;
    return list.filter((m: any) =>
      (m.displayName || "").toLowerCase().includes(term) ||
      (m.alias || "").toLowerCase().includes(term) ||
      (m.phoneNumber || "").toLowerCase().includes(term) ||
      (m.email || "").toLowerCase().includes(term) ||
      memberLocationLabel(m).toLowerCase().includes(term)
    );
  }, [communityMembers, memberSearch]);

  const allFilteredSelected =
    filteredMembers.length > 0 && filteredMembers.every((m: any) => selectedMemberIds.has(m.userId));

  const toggleMemberSelected = (memberId: Id<"users">) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedMemberIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredMembers.forEach((m: any) => next.delete(m.userId));
        return next;
      }
      const next = new Set(prev);
      filteredMembers.forEach((m: any) => next.add(m.userId));
      return next;
    });
  };

  const handleIntakeFieldChange = (crmFieldId: string, value: string) => {
    setIntakeFieldValues((prev) => ({ ...prev, [crmFieldId]: value }));
  };

  // One-off repair for members captured before intake started saving the name
  // onto the account. Safe to run more than once: it only fills names that are
  // missing and only clears snapshots that merely duplicate an alias.
  const handleBackfillNames = async () => {
    if (!userId || !selectedCommunityId) return;

    setBackfillingNames(true);
    setMessage("");

    try {
      const result = await backfillCrmMemberNames({
        communityId: selectedCommunityId,
        requesterId: userId,
      });
      setMessage(
        `Checked ${result.scanned} submission${result.scanned === 1 ? "" : "s"}: ` +
          `${result.namesRestored} member name${result.namesRestored === 1 ? "" : "s"} restored, ` +
          `${result.aliasSnapshotsCleared} placeholder name${result.aliasSnapshotsCleared === 1 ? "" : "s"} cleared.`
      );
    } catch (error: any) {
      setMessage(error?.message || "Failed to restore member names");
    }

    setBackfillingNames(false);
  };

  const handleSubmitIntake = async () => {
    if (!userId || !intakeCrmFormId) return;
    if (intakeMode === "existing" && selectedMemberIds.size === 0) return;
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
      const upcomingSprayScheduleAt = intakeUpcomingSprayDate
        ? new Date(`${intakeUpcomingSprayDate}T09:00:00`).getTime()
        : undefined;

      if (intakeMode === "new") {
        const result = await submitCrmIntake({
          crmFormId: intakeCrmFormId,
          adminId: userId,
          newClient: { name: newClientName.trim(), phoneNumber: newClientPhone.trim() },
          purchaseDate: intakePurchaseDate || undefined,
          productName: intakeProductName || undefined,
          purchaseQuantity: intakeQuantity || undefined,
          district: districtName || undefined,
          subCounty: subcountyName || undefined,
          parish: parishName || undefined,
          cropGrown: intakeCropGrown || undefined,
          monthOfPlanting: intakeMonthOfPlanting || undefined,
          pastSprayDates: pastSprayDates.length > 0 ? pastSprayDates : undefined,
          upcomingSprayScheduleAt,
          responses,
        });

        setMessage(
          result.wasNewClient
            ? "Lead captured and a new member account was created (login: their phone number)."
            : result.reconciledExistingLead
              ? "This phone number is already a contact in the CRM, so the intake was added to that contact instead of creating a duplicate."
              : "Lead captured against the existing member with this phone number. It will now appear in the agent call queue."
        );
      } else {
        // The agent is on the call and is being told where the client actually
        // is, so what they pick is what gets captured. A member's saved
        // location fills the gap only where the agent left the dropdown blank,
        // and the member can correct either of them on their own profile when
        // they first log in. Each member is still submitted individually so a
        // batch does not overwrite the locations of members the agent did not
        // ask about.
        const membersById = new Map<string, any>((communityMembers || []).map((m: any) => [String(m.userId), m]));
        const memberIds = Array.from(selectedMemberIds);

        let succeeded = 0;
        let merged = 0;
        let failed = 0;
        for (const memberId of memberIds) {
          const member = membersById.get(String(memberId));
          try {
            const result = await submitCrmIntake({
              crmFormId: intakeCrmFormId,
              adminId: userId,
              existingMemberId: memberId,
              purchaseDate: intakePurchaseDate || undefined,
              productName: intakeProductName || undefined,
              purchaseQuantity: intakeQuantity || undefined,
              district: districtName || member?.districtText || undefined,
              subCounty: subcountyName || member?.subCountyText || undefined,
              parish: parishName || member?.parishText || undefined,
              cropGrown: intakeCropGrown || undefined,
              monthOfPlanting: intakeMonthOfPlanting || undefined,
              pastSprayDates: pastSprayDates.length > 0 ? pastSprayDates : undefined,
              upcomingSprayScheduleAt,
              responses,
            });
            if (result.reconciledExistingLead) merged++;
            succeeded++;
          } catch {
            failed++;
          }
        }

        // A phone number is one contact, so members already in the CRM (or
        // sharing a number with someone who is) update that contact instead.
        const mergedNote = merged > 0
          ? ` ${merged} ${merged === 1 ? "was" : "were"} already a contact by phone number and updated instead of duplicated.`
          : "";
        setMessage(
          failed === 0
            ? `${succeeded} member${succeeded === 1 ? "" : "s"} added to the call queue.${mergedNote}`
            : `${succeeded} member${succeeded === 1 ? "" : "s"} added to the call queue; ${failed} failed.${mergedNote}`
        );
      }

      setSelectedMemberIds(new Set());
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
        claimedLeads: todayPerformance.claimedToday,
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
        ["Claimed Leads", String(todayPerformance?.claimedToday ?? 0)],
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

  // Overdue follow-ups get their own section so they can be worked through as
  // a batch; the orange section keeps the ones that are due but not yet late.
  const overdueFollowUps = (followUpsDueDetails || []).filter((row: any) => row.isOverdue);
  const upcomingFollowUps = (followUpsDueDetails || []).filter((row: any) => !row.isOverdue);

  const activeAgents = (crmAgents || []).filter((agent: any) => agent.isActive);

  const handleSendFollowUps = async (section: string, rows: any[]) => {
    const agentId = followUpAgentId[section];
    if (!userId || !selectedCommunityId || !agentId || rows.length === 0) return;
    setSendingFollowUps(section);
    setFollowUpNotice((prev) => ({ ...prev, [section]: "" }));
    try {
      const result = await sendFollowUpsToAgent({
        requesterId: userId,
        communityId: selectedCommunityId,
        agentId,
        leadIds: rows.map((row: any) => row.leadId),
      });
      setFollowUpNotice((prev) => ({
        ...prev,
        [section]: `Sent ${result.sent} contact(s) to ${result.agentName} for callback.`,
      }));
    } catch (error: any) {
      setFollowUpNotice((prev) => ({ ...prev, [section]: error?.message || "Failed to send to agent" }));
    }
    setSendingFollowUps("");
  };

  const renderSendToAgent = (section: string, rows: any[]) => {
    if (!followUpsDueDetails || rows.length === 0) return null;
    const agentId = followUpAgentId[section] || "";
    const disabled = !agentId || sendingFollowUps === section;
    return (
      <div style={{ marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <select
            value={agentId}
            onChange={(e) => setFollowUpAgentId((prev) => ({ ...prev, [section]: e.target.value }))}
            style={{ ...inputStyle, flex: "1 1 160px", minHeight: 38 }}
          >
            <option value="">{activeAgents.length === 0 ? "No active agents" : "Choose agent..."}</option>
            {activeAgents.map((agent: any) => (
              <option key={agent._id} value={agent.agentUserId}>
                {agent.displayName || agent.userAlias || agent.userEmail || "Agent"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleSendFollowUps(section, rows)}
            disabled={disabled}
            style={{ minHeight: 38, padding: "0.35rem 0.8rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, fontSize: "0.82rem", opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            {sendingFollowUps === section ? "Sending..." : `Send ${rows.length} to agent`}
          </button>
        </div>
        {followUpNotice[section] && (
          <div style={{ marginTop: "0.3rem", fontSize: "0.8rem", fontWeight: 600, color: BRAND }}>{followUpNotice[section]}</div>
        )}
      </div>
    );
  };

  // Lead call times are stored shifted to Uganda time (getUgandaTime).
  const formatLeadDate = (ts: number) =>
    new Date(fromStoredUgandaTime(ts)).toLocaleDateString(undefined, inUgandaTime());

  const renderFollowUpRow = (row: any) => {
    return (
      <div key={row.leadId} style={{ padding: "0.45rem 0", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ fontWeight: 700 }}>
          {row.clientName} {row.isOverdue && <span style={{ color: "#b91c1c", fontWeight: 700, fontSize: "0.78rem" }}>OVERDUE</span>}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#666" }}>
          {row.formName} | {row.phoneNumber} | Next call: {formatLeadDate(row.nextCallAt)}
        </div>
        <div style={{ fontSize: "0.78rem", color: row.lastCallAt ? "#4b5563" : "#b91c1c", fontWeight: 600 }}>
          {row.lastCallAt
            ? `Last called ${formatLeadDate(row.lastCallAt)}${row.lastOutcome === "no_answer" ? " (no answer)" : ""}`
            : "Never called"}
        </div>
        {row.confirmedVisitAt && (
          <div style={{ fontSize: "0.78rem", color: "#1f7a3e", fontWeight: 600 }}>
            Confirmed visit: {new Date(row.confirmedVisitAt).toLocaleDateString(undefined, inUgandaTime())}
          </div>
        )}
        {row.callbackRequestedAt && row.assignedAgentName && (
          <div style={{ fontSize: "0.78rem", color: "#1d4ed8", fontWeight: 600 }}>
            Sent to {row.assignedAgentName} for callback
          </div>
        )}
        <IntakeAnswers purchase={row.purchase} answers={row.answers} />
        <LastCallAnswers lastCall={row.lastCall} />
      </div>
    );
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
            <h1 style={{ margin: "0.4rem 0 0 0", fontSize: "clamp(1.25rem, 4vw, 1.8rem)" }}>{crmHeading}</h1>
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
          <MetricCard label="Claimed Leads" value={todayPerformance?.claimedToday} />
          <MetricCard label="Follow-ups Due" value={crmHomeSummary?.followUpsDueToday} />
          <MetricCard label="Sales Opportunities" value={todayPerformance?.salesOpportunities} />
          <MetricCard label="Product Issues" value={todayPerformance?.productIssues} />
          <MetricCard label="Agents" value={todayPerformance?.agents} />
        </div>

        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
          <div style={sectionStyle(SECTION_COLORS.todaysForms, "0")}>
            <h3 style={{ marginTop: 0, color: SECTION_COLORS.todaysForms }}>Today&apos;s Submitted Forms</h3>
            {!todaysSubmittedForms && <p style={{ color: "#777" }}>Loading...</p>}
            {(todaysSubmittedForms || []).length === 0 && <p style={{ color: "#777" }}>No forms submitted today yet.</p>}
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {(todaysSubmittedForms || []).map((row: any) => (
                <div key={row.responseId} style={{ padding: "0.45rem 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ fontWeight: 700 }}>{row.clientName}</div>
                  <div style={{ fontSize: "0.82rem", color: "#666" }}>
                    {row.formName} | {row.phoneNumber} | {row.district}{row.subCounty ? `, ${row.subCounty}` : ""}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#999" }}>{new Date(row.submittedAt).toLocaleString()}</div>
                  <IntakeAnswers purchase={row.purchase} answers={row.answers} />
                </div>
              ))}
            </div>
          </div>

          <div style={sectionStyle(SECTION_COLORS.overdue, "0")}>
            <h3 style={{ marginTop: 0, color: SECTION_COLORS.overdue }}>Overdue Follow-ups</h3>
            {!followUpsDueDetails && <p style={{ color: "#777" }}>Loading...</p>}
            {followUpsDueDetails && overdueFollowUps.length === 0 && <p style={{ color: "#777" }}>No overdue follow-ups.</p>}
            {renderSendToAgent("overdue", overdueFollowUps)}
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {overdueFollowUps.map(renderFollowUpRow)}
            </div>
          </div>

          <div style={sectionStyle(SECTION_COLORS.followUps, "0")}>
            <h3 style={{ marginTop: 0, color: SECTION_COLORS.followUps }}>Follow-ups Due (Upcoming Calls &amp; Confirmed Visits)</h3>
            {!followUpsDueDetails && <p style={{ color: "#777" }}>Loading...</p>}
            {followUpsDueDetails && upcomingFollowUps.length === 0 && <p style={{ color: "#777" }}>No follow-ups due.</p>}
            {renderSendToAgent("due", upcomingFollowUps)}
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {upcomingFollowUps.map(renderFollowUpRow)}
            </div>
          </div>
        </div>

        {selectedCommunityId && userId && (
          <CrmSubmissionsPanel
            communityId={selectedCommunityId}
            requesterId={userId}
            crmForms={(crmForms || []) as any}
            accentColor={SECTION_COLORS.submissions}
          />
        )}

        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={handleExportTodayCsv}
            disabled={!todayPerformance || !selectedCommunity}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !todayPerformance || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Today CSV
          </button>
          <button
            onClick={handleExportAgentsCsv}
            disabled={!agentPerformance || agentPerformance.length === 0 || !selectedCommunity}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !agentPerformance || agentPerformance.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Agent CSV
          </button>
          <button
            onClick={handleExportFormsCsv}
            disabled={!crmForms || crmForms.length === 0 || !selectedCommunity}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !crmForms || crmForms.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Forms CSV
          </button>
          <button
            onClick={handleExportOpportunitiesCsv}
            disabled={!opportunityExportRows || opportunityExportRows.length === 0 || !selectedCommunity}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !opportunityExportRows || opportunityExportRows.length === 0 || !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Opportunities CSV
          </button>
          <button
            onClick={handleExportSummaryPdf}
            disabled={!selectedCommunity}
            style={{ minHeight: 40, padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: !selectedCommunity ? "not-allowed" : "pointer" }}
          >
            Export Summary PDF
          </button>
        </div>

        <div style={sectionStyle(SECTION_COLORS.createForm, "1.25rem")}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: SECTION_COLORS.createForm }}>Create CRM Form Type</h2>
          <p style={{ marginTop: 0, color: "#666", fontSize: "0.9rem" }}>
            Supervisor-configured form drives callback queue and script shown to agents.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.7rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
              Form name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Purchase Follow-Up Form"
                style={{ ...inputStyle, fontWeight: 400 }}
              />
            </label>
            <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={openingScriptEnabled} onChange={(e) => setOpeningScriptEnabled(e.target.checked)} />
              Enable opening script
            </label>
          </div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginTop: "0.7rem" }}>
            Opening script
            <textarea
              value={openingScriptTemplate}
              onChange={(e) => setOpeningScriptTemplate(e.target.value)}
              rows={8}
              style={{ ...inputStyle, width: "100%", marginTop: "0.25rem", fontWeight: 400 }}
            />
          </label>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.45rem" }}>
            Tokens: {ALLOWED_SCRIPT_TOKENS.map((token) => `{{${token}}}`).join(", ")}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              onClick={handleCreateDefaultCrmForm}
              disabled={busy || !selectedCommunityId || !name.trim()}
              style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: busy || !name.trim() ? "#9ca3af" : BRAND, color: "#fff", fontWeight: 700, cursor: busy || !name.trim() ? "not-allowed" : "pointer" }}
            >
              {busy ? "Creating..." : "Create Default CRM Form"}
            </button>
            <button
              onClick={handleBackfillNames}
              disabled={backfillingNames || !selectedCommunityId}
              style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, cursor: backfillingNames ? "not-allowed" : "pointer" }}
              title="Copies names captured at intake onto the member accounts they belong to, so the same person is no longer shown under an anonymous alias."
            >
              {backfillingNames ? "Restoring names..." : "Restore Member Names"}
            </button>
            {selectedCommunity && (
              <Link href={`/community-only/crm-agent?communityId=${selectedCommunity._id}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0.6rem 0.95rem", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none", color: "#111827", fontWeight: 600 }}>
                Preview Agent View
              </Link>
            )}
          </div>
          {message && <p style={{ marginBottom: 0, color: "#1f7a3e", fontWeight: 600 }}>{message}</p>}
        </div>

        <div style={sectionStyle(SECTION_COLORS.captureLead, "1rem")}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: SECTION_COLORS.captureLead }}>Capture New Lead (Intake)</h2>
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
            {(crmForms || []).filter((form: any) => form.isActive).map((form: any) => (
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
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name, phone, email or location"
                    style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", fontSize: "0.85rem", fontWeight: 600, cursor: filteredMembers.length === 0 ? "default" : "pointer" }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        disabled={filteredMembers.length === 0}
                      />
                      Select all {memberSearch.trim() ? "(matching)" : ""} ({filteredMembers.length})
                    </label>
                    <span style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>
                      {selectedMemberIds.size} selected
                    </span>
                  </div>

                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: "0.65rem", maxHeight: 280, overflowY: "auto" }}>
                    {!communityMembers && (
                      <div style={{ padding: "0.5rem", color: "#777", fontSize: "0.85rem" }}>Loading members...</div>
                    )}
                    {communityMembers && filteredMembers.length === 0 && (
                      <div style={{ padding: "0.5rem", color: "#777", fontSize: "0.85rem" }}>No matching members.</div>
                    )}
                    {filteredMembers.map((m: any) => (
                      <label
                        key={m.userId}
                        style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", padding: "0.5rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.has(m.userId)}
                          onChange={() => toggleMemberSelected(m.userId)}
                          style={{ marginTop: "0.2rem" }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                            {m.displayName || m.alias}
                            {!m.hasVerifiedName && (
                              <span style={{ marginLeft: "0.35rem", fontSize: "0.68rem", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "0.1rem 0.35rem", borderRadius: 999 }}>
                                NO NAME ON FILE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#666" }}>{m.phoneNumber || m.email || "-"}</div>
                          <div style={{ fontSize: "0.78rem", color: "#1f7a3e" }}>{memberLocationLabel(m)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <input value={intakeProductName} onChange={(e) => setIntakeProductName(e.target.value)} placeholder="Product name" style={inputStyle} />
                <input value={intakeQuantity} onChange={(e) => setIntakeQuantity(e.target.value)} placeholder="Purchase quantity" style={inputStyle} />
                <input value={intakePurchaseDate} onChange={(e) => setIntakePurchaseDate(e.target.value)} type="date" style={inputStyle} />
              </div>

              {intakeMode === "existing" && (
                <p style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "0.8rem", color: "#666" }}>
                  The location you pick below is captured for every selected member, exactly as you enter it. Members you leave blank keep the location already on their account, and any member can correct it on their profile the first time they log in.
                </p>
              )}
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
                  (intakeMode === "existing" ? selectedMemberIds.size === 0 : !newClientName.trim() || !newClientPhone.trim())
                }
                style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: submittingIntake ? "not-allowed" : "pointer", marginTop: "0.4rem" }}
              >
                {submittingIntake
                  ? "Saving..."
                  : intakeMode === "existing" && selectedMemberIds.size > 1
                  ? `Add ${selectedMemberIds.size} Members to Call Queue`
                  : "Capture Lead"}
              </button>
            </>
          )}
        </div>

        <div style={sectionStyle(SECTION_COLORS.manageFields, "1rem")}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: SECTION_COLORS.manageFields }}>Manage CRM Form Fields</h2>
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
                disabled={addingField || !newFieldLabel.trim()}
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
                      disabled={removingFieldId === String(field._id)}
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
          <div style={{ border: `1px solid ${ADMIN_SECTION_BORDER}`, borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>Assign CRM Agent</h3>
            <p style={{ color: "#666", fontSize: "0.88rem", marginTop: 0 }}>
              Add an existing Community CRM admin account as a call-center agent for this
              community. The account must already be created in Role Management with the
              Community CRM category, assigned to this community, and its email ends in
              <strong> .crm</strong>.
            </p>
            <input
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              placeholder="Agent email (e.g. agent@lumina.crm)"
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
              disabled={assigningAgent || !selectedCommunityId || !agentEmail.trim()}
              style={{ minHeight: 44, padding: "0.6rem 0.95rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: assigningAgent ? "not-allowed" : "pointer" }}
            >
              {assigningAgent ? "Assigning..." : "Assign Agent"}
            </button>
          </div>

          <div style={{ border: `1px solid ${ADMIN_SECTION_BORDER}`, borderRadius: 12, padding: "0.9rem" }}>
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

          <div style={{ border: `1px solid ${ADMIN_SECTION_BORDER}`, borderRadius: 12, padding: "0.9rem" }}>
            <h3 style={{ marginTop: 0 }}>CRM Forms</h3>
            {formsNotice && (
              <p
                style={{
                  marginTop: 0,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color:
                    formsNotice.tone === "error"
                      ? "#b91c1c"
                      : formsNotice.tone === "success"
                        ? BRAND
                        : "#555",
                }}
              >
                {formsNotice.text}
              </p>
            )}
            {!crmForms && <p style={{ color: "#777" }}>Loading...</p>}
            {(crmForms || []).length === 0 && <p style={{ color: "#777" }}>No CRM forms yet.</p>}
            {(crmForms || []).map((form: any) => (
              <div key={form._id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 700 }}>
                    {form.name} {!form.isActive && <span style={{ color: "#b91c1c", fontSize: "0.75rem", fontWeight: 700 }}>(inactive)</span>}
                  </div>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Follow-up +{form.followUpOffsetDays} day(s) | Script {form.openingScriptEnabled ? "on" : "off"}
                </div>
                <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => handleToggleFormActive(form)}
                    disabled={formActionBusyId === String(form._id)}
                    style={{ minHeight: 30, padding: "0.3rem 0.6rem", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.78rem", cursor: formActionBusyId === String(form._id) ? "not-allowed" : "pointer" }}
                  >
                    {formActionBusyId === String(form._id) ? "Working..." : form.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form)}
                    disabled={formActionBusyId === String(form._id)}
                    style={{ minHeight: 30, padding: "0.3rem 0.6rem", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", color: "#b91c1c", fontWeight: 600, fontSize: "0.78rem", cursor: formActionBusyId === String(form._id) ? "not-allowed" : "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${ADMIN_SECTION_BORDER}`, borderRadius: 12, padding: "0.9rem" }}>
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
