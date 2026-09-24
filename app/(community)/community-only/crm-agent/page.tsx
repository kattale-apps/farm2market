"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { PRESET_KEYS, literalForPresetAnswer } from "@/convex/crmPresets";
import { IntakeAnswers } from "@/app/components/crm/IntakeAnswers";
import { LastCallAnswers } from "@/app/components/crm/LastCallAnswers";
import { inUgandaTime } from "../../../utils/timeUtils";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#156f44";

export default function CrmAgentPage() {
  const searchParams = useSearchParams();
  const communityIdFromUrl = searchParams.get("communityId") as Id<"communities"> | null;

  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const communityId =
    communityIdFromUrl ||
    (((currentUser as any)?.assignedCommunityIds?.[0] as Id<"communities"> | undefined) ?? null);
  const queue = useQuery(
    (api as any).crmCalls.getCrmAgentQueue,
    userId && communityId
      ? { agentId: userId, communityId, includeUnassigned: true }
      : "skip"
  );

  const todaySummary = useQuery(
    (api as any).crmCalls.getCrmAgentTodaySummary,
    userId && communityId ? { agentId: userId, communityId } : "skip"
  );

  const claimCrmLead = useMutation((api as any).crmCalls.claimCrmLead);
  const submitCrmCallOutcome = useMutation((api as any).crmCalls.submitCrmCallOutcome);
  const setCrmMemberVerifiedName = useMutation((api as any).crmCalls.setCrmMemberVerifiedName);

  const [activeLeadId, setActiveLeadId] = useState<string>("");
  const [submittingLeadId, setSubmittingLeadId] = useState<string>("");
  // Every one of these starts empty on purpose. They used to default to the
  // most positive answer, which meant an agent who submitted without touching
  // them - including on a call nobody picked up - recorded a healthy, happy
  // customer who wanted to buy again. Nothing here is recorded unless the
  // agent actually selects it.
  const [outcome, setOutcome] = useState<"" | "good_result" | "problem" | "wants_more" | "no_answer">("");
  const [usageStatus, setUsageStatus] = useState<"" | "yes" | "partly" | "no" | "unknown">("");
  const [resultRating, setResultRating] = useState<"" | "very_good" | "good" | "average" | "poor" | "very_poor">("");
  const [issueType, setIssueType] = useState<"" | "none" | "application_problem" | "product_problem" | "packaging_problem" | "delivery_problem" | "technical_advice" | "other">("");
  const [repurchaseIntent, setRepurchaseIntent] = useState<"" | "yes" | "maybe" | "no">("");
  const [notes, setNotes] = useState("");
  const [opportunityProductName, setOpportunityProductName] = useState("");
  const [opportunityQuantity, setOpportunityQuantity] = useState("");
  const [expectedPurchaseMonth, setExpectedPurchaseMonth] = useState("");
  const [opportunityProbability, setOpportunityProbability] = useState<"" | "high" | "medium" | "low">("");
  const [opportunityNextActionDate, setOpportunityNextActionDate] = useState("");
  const [message, setMessage] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [savingNameLeadId, setSavingNameLeadId] = useState<string>("");
  const [activeFormId, setActiveFormId] = useState<string>("");
  const [fieldAnswers, setFieldAnswers] = useState<Record<string, string>>({});

  // The questions the supervisor put on the form this lead came from. They are
  // what logistics plans against (remaining quantity, next dose date), so the
  // agent answers them on every call rather than only at intake.
  const activeLead = (queue || []).find((l: any) => String(l._id) === activeLeadId);
  const activeLeadFormDetails = useQuery(
    (api as any).crmForms.getCrmFormDetails,
    userId && activeLead?.formId ? { requesterId: userId, crmFormId: activeLead.formId } : "skip"
  );
  // Memoized so it is the same array between renders: the preset lookup below
  // is derived from it, and a fresh [] each render would rebuild that map
  // constantly.
  const callFields: any[] = useMemo(
    () => activeLeadFormDetails?.fields || [],
    [activeLeadFormDetails]
  );

  // Group the queue by which intake form each lead came from - a supervisor
  // creates a form per campaign (e.g. a region-specific follow-up), adds
  // members to it, and agents pick which form/region to work from here
  // instead of seeing every community's leads merged into one flat list.
  const formTabs = useMemo(() => {
    const counts = new Map<string, { formName: string; count: number }>();
    for (const lead of queue || []) {
      const key = String(lead.formId || "");
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { formName: lead.formName || "Form", count: 1 });
    }
    return Array.from(counts.entries())
      .map(([formId, v]) => ({ formId, ...v }))
      .sort((a, b) => a.formName.localeCompare(b.formName));
  }, [queue]);

  const displayedQueue = useMemo(() => {
    if (!activeFormId) return queue || [];
    return (queue || []).filter((lead: any) => String(lead.formId) === activeFormId);
  }, [queue, activeFormId]);

  // Prefer the display name the supervisor captured when assigning this agent,
  // so the agent is greeted and introduces themselves by the same name the
  // community admin dashboard shows.
  const greetingName = useMemo(() => {
    const assignedName = String((todaySummary as any)?.agentDisplayName || "").trim();
    if (assignedName) return assignedName;
    if (!currentUser) return "Agent";
    return currentUser.alias || (currentUser as any)?.email || "Agent";
  }, [todaySummary, currentUser]);

  const completed = todaySummary?.completedToday || 0;
  const callsToday = todaySummary?.callsToday || 0;
  const remaining = todaySummary?.remainingOpen || 0;

  // The form is the source of truth. Where the supervisor put a question on
  // the form for one of the four standard outcomes, that question is the only
  // place the agent answers it - the fixed dropdown below is hidden, so the
  // same thing is never asked twice and there are never two answers to
  // reconcile. The dropdown is still shown for forms that have no such
  // question, so nothing is lost on an older form.
  const presetFieldByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const field of callFields) {
      const key = String(field.presetKey || "");
      if (key && !map.has(key)) map.set(key, field);
    }
    return map;
  }, [callFields]);

  const formAnswersPreset = (presetKey: string) => presetFieldByKey.has(presetKey);

  // What the call will actually record for a preset, reading the form answer
  // first and falling back to the fixed dropdown.
  const effectivePreset = (presetKey: string, fallback: string) => {
    const field = presetFieldByKey.get(presetKey);
    if (!field) return fallback;
    const answer = (fieldAnswers[String(field._id)] || "").trim();
    if (!answer) return "";
    return literalForPresetAnswer(presetKey, answer) ?? "";
  };

  const effectiveRepurchase = effectivePreset(PRESET_KEYS.repurchaseIntent, repurchaseIntent);

  // An unanswered call has no buyer on the other end, so it can never be a
  // sales opportunity regardless of what the form says.
  const shouldCaptureOpportunity =
    outcome !== "" &&
    outcome !== "no_answer" &&
    (outcome === "wants_more" || effectiveRepurchase === "yes");

  const toTimestamp = (dateValue: string) => {
    if (!dateValue) return undefined;
    const dt = new Date(`${dateValue}T09:00:00`);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : undefined;
  };

  const resetForm = () => {
    setOutcome("");
    setUsageStatus("");
    setResultRating("");
    setIssueType("");
    setRepurchaseIntent("");
    setNotes("");
    setOpportunityProductName("");
    setOpportunityQuantity("");
    setExpectedPurchaseMonth("");
    setOpportunityProbability("");
    setOpportunityNextActionDate("");
    setFieldAnswers({});
  };

  // Opening a different lead must start from a blank form. All of this state
  // is shared across the whole queue, so without this an agent who filled in
  // part of one call, collapsed it, and opened the next lead carried the first
  // farmer's answers into the second farmer's record.
  const openLead = (leadId: string) => {
    setActiveLeadId((current) => {
      if (current === leadId) return "";
      resetForm();
      setMessage("");
      return leadId;
    });
  };

  const handleClaim = async (leadId: Id<"crmLeads">) => {
    if (!userId) return;

    try {
      await claimCrmLead({ leadId, agentId: userId });
      // Claiming opens the call form too, so it goes through the same reset -
      // otherwise claiming a lead mid-way through another one inherits that
      // lead's half-filled answers.
      if (String(leadId) !== activeLeadId) resetForm();
      setActiveLeadId(String(leadId));
      setMessage("Lead claimed.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to claim lead");
    }
  };

  const handleSaveName = async (leadId: Id<"crmLeads">) => {
    if (!userId) return;
    const name = (nameDrafts[String(leadId)] || "").trim();
    if (!name) return;

    setSavingNameLeadId(String(leadId));
    setMessage("");

    try {
      await setCrmMemberVerifiedName({ leadId, agentId: userId, name });
      setMessage("Member name saved.");
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[String(leadId)];
        return next;
      });
    } catch (error: any) {
      setMessage(error?.message || "Failed to save member name");
    }

    setSavingNameLeadId("");
  };

  const callAnswerPayload = callFields
    .map((field: any) => ({ crmFieldId: field._id, value: (fieldAnswers[String(field._id)] || "").trim() }))
    .filter((a) => a.value !== "");

  // The form's questions cannot be validated until they have loaded. While the
  // query is in flight `callFields` is empty, so this check would pass on a
  // form full of required questions and the call would be saved with no
  // answers at all.
  const callFieldsLoading = Boolean(activeLead?.formId) && activeLeadFormDetails === undefined;

  // A call nobody answered has nothing to report, so required questions only
  // bind when the agent actually spoke to the customer.
  const missingRequired =
    outcome === "no_answer"
      ? []
      : callFields.filter(
          (field: any) => field.required && !(fieldAnswers[String(field._id)] || "").trim()
        );

  const handleSubmitCall = async (leadId: Id<"crmLeads">) => {
    if (!userId) return;

    if (!outcome) {
      setMessage("Please choose what happened on this call.");
      return;
    }

    if (callFieldsLoading) {
      setMessage("Still loading this form's questions, please wait.");
      return;
    }

    if (missingRequired.length > 0) {
      setMessage(`Please answer: ${missingRequired.map((f: any) => f.label).join(", ")}`);
      return;
    }

    setSubmittingLeadId(String(leadId));
    setMessage("");

    try {
      // Only what the agent actually recorded is sent. An empty selection stays
      // empty all the way to the database rather than being filled in with a
      // default the agent never chose.
      const result = await submitCrmCallOutcome({
        leadId,
        agentId: userId,
        outcome,
        usageStatus: effectivePreset(PRESET_KEYS.usageStatus, usageStatus) || undefined,
        resultRating: effectivePreset(PRESET_KEYS.resultRating, resultRating) || undefined,
        issueType: effectivePreset(PRESET_KEYS.issueType, issueType) || undefined,
        repurchaseIntent: effectiveRepurchase || undefined,
        notes: notes || undefined,
        createOpportunity: shouldCaptureOpportunity,
        opportunityProductName: shouldCaptureOpportunity ? (opportunityProductName || undefined) : undefined,
        opportunityQuantity: shouldCaptureOpportunity ? (opportunityQuantity || undefined) : undefined,
        expectedPurchaseMonth: shouldCaptureOpportunity ? (expectedPurchaseMonth || undefined) : undefined,
        probability: shouldCaptureOpportunity ? (opportunityProbability || undefined) : undefined,
        opportunityNextActionAt: shouldCaptureOpportunity ? toTimestamp(opportunityNextActionDate) : undefined,
        answers: callAnswerPayload.length > 0 ? callAnswerPayload : undefined,
      });
      setMessage(
        Number((result as any)?.answersRecorded || 0) > 0
          ? "Call outcome saved."
          : "Call saved with no answers recorded - it stays marked as unanswered."
      );
      resetForm();
      setActiveLeadId("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to save call outcome");
    }

    setSubmittingLeadId("");
  };

  if (status === "loading") {
    return <div style={{ padding: "1.25rem", fontFamily: FONT }}>Loading...</div>;
  }

  if (!userId || !communityId) {
    return (
      <div style={{ padding: "1.25rem", fontFamily: FONT }}>
        <h2 style={{ marginTop: 0 }}>CRM Agent</h2>
        <p>Community not selected or session missing.</p>
        <Link href="/">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f8f6", fontFamily: FONT, paddingBottom: "5rem" }}>
      <div style={{ background: "linear-gradient(135deg, #1f7a3e 0%, #165c2f 100%)", color: "#fff", padding: "1rem" }}>
        <Link href={currentUser?.adminCategory === "community_crm" ? "/" : `/admin/community-crm?communityId=${communityId}`} style={{ color: "#d1fae5", textDecoration: "none", fontSize: "0.85rem" }}>
          &larr; {currentUser?.adminCategory === "community_crm" ? "Back to Dashboard" : "Back to CRM Supervisor"}
        </Link>
        <h1 style={{ margin: "0.4rem 0 0 0", fontSize: "1.35rem" }}>Good Morning {greetingName}</h1>
        <p style={{ margin: "0.35rem 0 0 0", opacity: 0.9 }}>Your calls today: {callsToday}</p>
      </div>

      <div style={{ padding: "0.85rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
          <SummaryCard label="Completed" value={completed} />
          <SummaryCard label="Remaining" value={remaining} />
          <SummaryCard label="Due Today" value={todaySummary?.dueToday || 0} />
        </div>

        {message && <p style={{ color: BRAND, fontWeight: 700, marginBottom: 0 }}>{message}</p>}

        <h2 style={{ fontSize: "1rem", marginTop: "1rem", marginBottom: "0.6rem" }}>Call Now</h2>

        {formTabs.length > 1 && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button
              onClick={() => setActiveFormId("")}
              style={{
                ...secondaryButtonStyle,
                minHeight: 36,
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                background: activeFormId === "" ? BRAND : "#fff",
                color: activeFormId === "" ? "#fff" : "#111827",
                borderColor: activeFormId === "" ? BRAND : "#d1d5db",
              }}
            >
              All ({(queue || []).length})
            </button>
            {formTabs.map((tab) => (
              <button
                key={tab.formId}
                onClick={() => setActiveFormId(tab.formId)}
                style={{
                  ...secondaryButtonStyle,
                  minHeight: 36,
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.85rem",
                  background: activeFormId === tab.formId ? BRAND : "#fff",
                  color: activeFormId === tab.formId ? "#fff" : "#111827",
                  borderColor: activeFormId === tab.formId ? BRAND : "#d1d5db",
                }}
              >
                {tab.formName} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {!queue && <p style={{ color: "#666" }}>Loading queue...</p>}
        {queue && displayedQueue.length === 0 && <p style={{ color: "#666" }}>No call queue items yet.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayedQueue.map((lead: any, idx: number) => {
            const isActive = activeLeadId === String(lead._id);
            const canClaim = !lead.assignedAgentId;

            return (
              <div key={lead._id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "0.85rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{idx + 1}. {lead.memberAlias || "Farmer"}</div>
                {lead.callbackRequestedAt && (
                  <div style={{ marginTop: "0.2rem", display: "inline-block", background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 999, padding: "0.1rem 0.55rem", fontSize: "0.76rem", fontWeight: 700 }}>
                    Callback requested by supervisor
                  </div>
                )}
                {!lead.isNameVerified && (
                  <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.4rem" }}>
                    <input
                      value={nameDrafts[String(lead._id)] ?? ""}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({ ...prev, [String(lead._id)]: e.target.value }))
                      }
                      placeholder="Enter member's real name"
                      style={{ ...inputStyle, minHeight: 38, flex: 1 }}
                    />
                    <button
                      onClick={() => handleSaveName(lead._id)}
                      disabled={
                        savingNameLeadId === String(lead._id) ||
                        !(nameDrafts[String(lead._id)] || "").trim()
                      }
                      style={{ ...secondaryButtonStyle, minHeight: 38, whiteSpace: "nowrap" }}
                    >
                      {savingNameLeadId === String(lead._id) ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                )}
                <div style={{ marginTop: "0.2rem", color: "#666", fontSize: "0.88rem" }}>
                  {lead.memberPhone || "No phone on file"}
                </div>
                <div style={{ marginTop: "0.2rem", color: "#666", fontSize: "0.88rem" }}>
                  {lead.district || "-"} {lead.subCounty ? `, ${lead.subCounty}` : ""} {lead.parish ? `, ${lead.parish}` : ""}
                </div>
                <div style={{ marginTop: "0.2rem", color: "#444", fontSize: "0.88rem" }}>
                  {lead.productName || "Product not recorded"} {lead.purchaseQuantity ? `- ${lead.purchaseQuantity}` : ""}
                </div>
                {(lead.cropGrown || lead.monthOfPlanting) && (
                  <div style={{ marginTop: "0.2rem", color: "#444", fontSize: "0.86rem" }}>
                    {lead.cropGrown ? `Crop: ${lead.cropGrown}` : ""}{lead.cropGrown && lead.monthOfPlanting ? " · " : ""}{lead.monthOfPlanting ? `Planted: ${lead.monthOfPlanting}` : ""}
                  </div>
                )}
                {lead.upcomingSprayScheduleAt && (
                  <div style={{ marginTop: "0.2rem", color: "#7c2d12", fontSize: "0.82rem" }}>
                    Upcoming spray: {new Date(lead.upcomingSprayScheduleAt).toLocaleDateString(undefined, inUgandaTime())}
                  </div>
                )}
                <div style={{ marginTop: "0.2rem", color: lead.isOverdue ? "#b91c1c" : "#166534", fontSize: "0.84rem", fontWeight: 600 }}>
                  {lead.isDueToday ? "Follow-up due today" : lead.isOverdue ? "Overdue" : "Scheduled"}
                </div>

                <IntakeAnswers
                  purchase={{
                    productName: lead.productName,
                    purchaseQuantity: lead.purchaseQuantity,
                    purchaseDate: lead.purchaseDate,
                    parish: lead.parish,
                    cropGrown: lead.cropGrown,
                    monthOfPlanting: lead.monthOfPlanting,
                    pastSprayDates: lead.pastSprayDates,
                    upcomingSprayScheduleAt: lead.upcomingSprayScheduleAt,
                  }}
                  answers={lead.intakeAnswers}
                />
                <LastCallAnswers lastCall={lead.lastCall} />

                <LeadOpeningScript leadId={lead._id} requesterId={userId} />

                <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {canClaim && (
                    <button onClick={() => handleClaim(lead._id)} style={secondaryButtonStyle}>Claim Lead</button>
                  )}
                  <button onClick={() => openLead(String(lead._id))} style={primaryButtonStyle}>
                    {isActive ? "Hide Call Form" : "Submit Call Form"}
                  </button>
                </div>

                {isActive && (
                  <div style={{ marginTop: "0.75rem", borderTop: "1px solid #eef2f7", paddingTop: "0.7rem" }}>
                    <label style={labelStyle}>
                      What happened on this call?<span style={{ color: "#b91c1c" }}> *</span>
                    </label>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)} style={inputStyle}>
                      <option value="">Select...</option>
                      <option value="good_result">Good result</option>
                      <option value="problem">Problem</option>
                      <option value="wants_more">Wants more</option>
                      <option value="no_answer">No answer</option>
                    </select>

                    {!formAnswersPreset(PRESET_KEYS.usageStatus) && (
                      <>
                        <label style={labelStyle}>Used product?</label>
                        <select value={usageStatus} onChange={(e) => setUsageStatus(e.target.value as any)} style={inputStyle}>
                          <option value="">Not recorded</option>
                          <option value="yes">Yes</option>
                          <option value="partly">Partly</option>
                          <option value="no">No</option>
                          <option value="unknown">Don&apos;t know</option>
                        </select>
                      </>
                    )}

                    {!formAnswersPreset(PRESET_KEYS.resultRating) && (
                      <>
                        <label style={labelStyle}>Result rating</label>
                        <select value={resultRating} onChange={(e) => setResultRating(e.target.value as any)} style={inputStyle}>
                          <option value="">Not recorded</option>
                          <option value="very_good">Very good</option>
                          <option value="good">Good</option>
                          <option value="average">Average</option>
                          <option value="poor">Poor</option>
                          <option value="very_poor">Very poor</option>
                        </select>
                      </>
                    )}

                    {!formAnswersPreset(PRESET_KEYS.issueType) && (
                      <>
                        <label style={labelStyle}>Issue type</label>
                        <select value={issueType} onChange={(e) => setIssueType(e.target.value as any)} style={inputStyle}>
                          <option value="">Not recorded</option>
                          <option value="none">No problem</option>
                          <option value="application_problem">Application problem</option>
                          <option value="product_problem">Product problem</option>
                          <option value="packaging_problem">Packaging problem</option>
                          <option value="delivery_problem">Delivery problem</option>
                          <option value="technical_advice">Needs technical advice</option>
                          <option value="other">Other</option>
                        </select>
                      </>
                    )}

                    {!formAnswersPreset(PRESET_KEYS.repurchaseIntent) && (
                      <>
                        <label style={labelStyle}>Repurchase intent</label>
                        <select value={repurchaseIntent} onChange={(e) => setRepurchaseIntent(e.target.value as any)} style={inputStyle}>
                          <option value="">Not recorded</option>
                          <option value="yes">Yes</option>
                          <option value="maybe">Maybe</option>
                          <option value="no">No</option>
                        </select>
                      </>
                    )}

                    {callFieldsLoading && (
                      <p style={{ marginTop: "0.6rem", marginBottom: 0, fontSize: "0.82rem", color: "#6b7280" }}>
                        Loading this form&apos;s questions...
                      </p>
                    )}

                    {callFields.length > 0 && (
                      <div style={{ marginTop: "0.6rem", border: "1px solid #dcfce7", background: "#f0fdf4", borderRadius: 10, padding: "0.6rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#14532d" }}>
                          {activeLeadFormDetails?.form?.name || "Form"} questions
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#3f6212", marginBottom: "0.3rem" }}>
                          These answers are the record of this call. Anything left blank stays unanswered.
                        </div>
                        {callFields.map((field: any) => {
                          const key = String(field._id);
                          const value = fieldAnswers[key] ?? "";
                          const setValue = (next: string) =>
                            setFieldAnswers((prev) => ({ ...prev, [key]: next }));
                          return (
                            <div key={key}>
                              <label style={labelStyle}>
                                {field.label}
                                {field.required && outcome !== "no_answer" && (
                                  <span style={{ color: "#b91c1c" }}> *</span>
                                )}
                              </label>
                              {field.fieldType === "select" ? (
                                <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle}>
                                  <option value="">Select...</option>
                                  {(field.options || []).map((option: string) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : field.fieldType === "textarea" ? (
                                <textarea
                                  value={value}
                                  onChange={(e) => setValue(e.target.value)}
                                  rows={2}
                                  placeholder={field.placeholder || ""}
                                  style={{ ...inputStyle, resize: "vertical" }}
                                />
                              ) : (
                                <input
                                  type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                                  value={value}
                                  onChange={(e) => setValue(e.target.value)}
                                  placeholder={field.placeholder || ""}
                                  style={inputStyle}
                                />
                              )}
                              {field.helpText && (
                                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "-0.15rem" }}>{field.helpText}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <label style={labelStyle}>Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

                    {shouldCaptureOpportunity && (
                      <div style={{ marginTop: "0.6rem", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 10, padding: "0.6rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#1e3a8a" }}>Sales Opportunity Details</div>

                        <label style={labelStyle}>Product</label>
                        <input
                          value={opportunityProductName}
                          onChange={(e) => setOpportunityProductName(e.target.value)}
                          placeholder={lead.productName || "Product name"}
                          style={inputStyle}
                        />

                        <label style={labelStyle}>Quantity</label>
                        <input
                          value={opportunityQuantity}
                          onChange={(e) => setOpportunityQuantity(e.target.value)}
                          placeholder="Quantity"
                          style={inputStyle}
                        />

                        <label style={labelStyle}>Expected Purchase Month</label>
                        <input
                          type="month"
                          value={expectedPurchaseMonth}
                          onChange={(e) => setExpectedPurchaseMonth(e.target.value)}
                          style={inputStyle}
                        />

                        <label style={labelStyle}>Probability</label>
                        <select
                          value={opportunityProbability}
                          onChange={(e) => setOpportunityProbability(e.target.value as any)}
                          style={inputStyle}
                        >
                          <option value="">Not recorded</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>

                        <label style={labelStyle}>Next Action Date</label>
                        <input
                          type="date"
                          value={opportunityNextActionDate}
                          onChange={(e) => setOpportunityNextActionDate(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => handleSubmitCall(lead._id)}
                      disabled={submittingLeadId === String(lead._id) || callFieldsLoading || !outcome}
                      style={{
                        ...primaryButtonStyle,
                        width: "100%",
                        marginTop: "0.55rem",
                        opacity: callFieldsLoading || !outcome ? 0.55 : 1,
                        cursor: callFieldsLoading || !outcome ? "not-allowed" : "pointer",
                      }}
                    >
                      {submittingLeadId === String(lead._id)
                        ? "Saving..."
                        : callFieldsLoading
                          ? "Loading questions..."
                          : "Save Call Outcome"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeadOpeningScript({ leadId, requesterId }: { leadId: Id<"crmLeads">; requesterId: Id<"users"> }) {
  const script = useQuery((api as any).crmForms.getLeadOpeningScript, {
    leadId,
    requesterId,
  }) as any;

  if (!script?.rendered) return null;

  const pastSprayDates: string[] = script.profile?.pastSprayDates || [];

  return (
    <div style={{ marginTop: "0.55rem", padding: "0.6rem", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: "0.86rem", color: "#14532d", lineHeight: 1.4 }}>
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Opening Script</div>
      <div>{script.rendered}</div>
      {pastSprayDates.length > 0 && (
        <div style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
          Past spray dates: {pastSprayDates.join(", ")}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "0.55rem" }}>
      <div style={{ color: "#666", fontSize: "0.78rem" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "0.2rem" }}>{value.toLocaleString()}</div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  marginTop: "0.45rem",
  marginBottom: "0.2rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  padding: "0.5rem 0.6rem",
  boxSizing: "border-box",
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  border: "none",
  padding: "0.55rem 0.9rem",
  background: BRAND,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  padding: "0.55rem 0.9rem",
  background: "#fff",
  color: "#111827",
  fontWeight: 600,
  cursor: "pointer",
};
