"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";

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
  const allCommunities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  const crmEnabledForCommunity =
    ((allCommunities || []).find((c: any) => {
      const currentCommunityId = c?._id ?? c?.id;
      return String(currentCommunityId ?? "") === String(communityId || "");
    }) as any)?.crmEnabled === true;

  const queue = useQuery(
    (api as any).crmCalls.getCrmAgentQueue,
    userId && communityId && crmEnabledForCommunity
      ? { agentId: userId, communityId, includeUnassigned: true }
      : "skip"
  );

  const todaySummary = useQuery(
    (api as any).crmCalls.getCrmAgentTodaySummary,
    userId && communityId && crmEnabledForCommunity ? { agentId: userId, communityId } : "skip"
  );

  const claimCrmLead = useMutation((api as any).crmCalls.claimCrmLead);
  const submitCrmCallOutcome = useMutation((api as any).crmCalls.submitCrmCallOutcome);

  const [activeLeadId, setActiveLeadId] = useState<string>("");
  const [submittingLeadId, setSubmittingLeadId] = useState<string>("");
  const [outcome, setOutcome] = useState<"good_result" | "problem" | "wants_more" | "no_answer">("good_result");
  const [usageStatus, setUsageStatus] = useState<"yes" | "partly" | "no" | "unknown">("yes");
  const [resultRating, setResultRating] = useState<"very_good" | "good" | "average" | "poor" | "very_poor">("good");
  const [issueType, setIssueType] = useState<"none" | "application_problem" | "product_problem" | "packaging_problem" | "delivery_problem" | "technical_advice" | "other">("none");
  const [repurchaseIntent, setRepurchaseIntent] = useState<"yes" | "maybe" | "no">("yes");
  const [notes, setNotes] = useState("");
  const [opportunityProductName, setOpportunityProductName] = useState("");
  const [opportunityQuantity, setOpportunityQuantity] = useState("");
  const [expectedPurchaseMonth, setExpectedPurchaseMonth] = useState("");
  const [opportunityProbability, setOpportunityProbability] = useState<"high" | "medium" | "low">("high");
  const [opportunityNextActionDate, setOpportunityNextActionDate] = useState("");
  const [message, setMessage] = useState("");

  const greetingName = useMemo(() => {
    if (!currentUser) return "Agent";
    return currentUser.alias || (currentUser as any)?.email || "Agent";
  }, [currentUser]);

  const completed = todaySummary?.completedToday || 0;
  const callsToday = todaySummary?.callsToday || 0;
  const remaining = todaySummary?.remainingOpen || 0;
  const shouldCaptureOpportunity = outcome === "wants_more" || repurchaseIntent === "yes";

  const toTimestamp = (dateValue: string) => {
    if (!dateValue) return undefined;
    const dt = new Date(`${dateValue}T09:00:00`);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : undefined;
  };

  const resetForm = () => {
    setOutcome("good_result");
    setUsageStatus("yes");
    setResultRating("good");
    setIssueType("none");
    setRepurchaseIntent("yes");
    setNotes("");
    setOpportunityProductName("");
    setOpportunityQuantity("");
    setExpectedPurchaseMonth("");
    setOpportunityProbability("high");
    setOpportunityNextActionDate("");
  };

  const handleClaim = async (leadId: Id<"crmLeads">) => {
    if (!userId) return;

    try {
      await claimCrmLead({ leadId, agentId: userId });
      setMessage("Lead claimed.");
      setActiveLeadId(String(leadId));
    } catch (error: any) {
      setMessage(error?.message || "Failed to claim lead");
    }
  };

  const handleSubmitCall = async (leadId: Id<"crmLeads">) => {
    if (!userId) return;

    setSubmittingLeadId(String(leadId));
    setMessage("");

    try {
      await submitCrmCallOutcome({
        leadId,
        agentId: userId,
        outcome,
        usageStatus,
        resultRating,
        issueType,
        repurchaseIntent,
        notes: notes || undefined,
        createOpportunity: shouldCaptureOpportunity,
        opportunityProductName: shouldCaptureOpportunity ? (opportunityProductName || undefined) : undefined,
        opportunityQuantity: shouldCaptureOpportunity ? (opportunityQuantity || undefined) : undefined,
        expectedPurchaseMonth: shouldCaptureOpportunity ? (expectedPurchaseMonth || undefined) : undefined,
        probability: shouldCaptureOpportunity ? opportunityProbability : undefined,
        opportunityNextActionAt: shouldCaptureOpportunity ? toTimestamp(opportunityNextActionDate) : undefined,
      });
      setMessage("Call outcome saved.");
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

  const communitiesLoaded = allCommunities !== undefined;

  if (communitiesLoaded && crmEnabledForCommunity !== true) {
    return (
      <div style={{ padding: "1.25rem", fontFamily: FONT }}>
        <h2 style={{ marginTop: 0 }}>CRM Agent</h2>
        <p>Community CRM is currently disabled for this community.</p>
        <Link href={currentUser?.adminCategory === "community_crm" ? "/" : `/admin/community-dashboard`} style={{ color: BRAND, textDecoration: "none" }}>
          &larr; Back
        </Link>
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

        {!queue && <p style={{ color: "#666" }}>Loading queue...</p>}
        {(queue || []).length === 0 && <p style={{ color: "#666" }}>No call queue items yet.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {(queue || []).map((lead: any, idx: number) => {
            const isActive = activeLeadId === String(lead._id);
            const canClaim = !lead.assignedAgentId;

            return (
              <div key={lead._id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "0.85rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{idx + 1}. {lead.memberAlias || "Farmer"}</div>
                <div style={{ marginTop: "0.2rem", color: "#666", fontSize: "0.88rem" }}>
                  {lead.district || "-"} {lead.subCounty ? `, ${lead.subCounty}` : ""}
                </div>
                <div style={{ marginTop: "0.2rem", color: "#444", fontSize: "0.88rem" }}>
                  {lead.productName || "Bio Farm"} {lead.purchaseQuantity ? `- ${lead.purchaseQuantity}` : ""}
                </div>
                <div style={{ marginTop: "0.2rem", color: lead.isOverdue ? "#b91c1c" : "#166534", fontSize: "0.84rem", fontWeight: 600 }}>
                  {lead.isDueToday ? "Follow-up due today" : lead.isOverdue ? "Overdue" : "Scheduled"}
                </div>

                <LeadOpeningScript leadId={lead._id} requesterId={userId} />

                <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {canClaim && (
                    <button onClick={() => handleClaim(lead._id)} style={secondaryButtonStyle}>Claim Lead</button>
                  )}
                  <button onClick={() => setActiveLeadId(isActive ? "" : String(lead._id))} style={primaryButtonStyle}>
                    {isActive ? "Hide Call Form" : "Submit Call Form"}
                  </button>
                </div>

                {isActive && (
                  <div style={{ marginTop: "0.75rem", borderTop: "1px solid #eef2f7", paddingTop: "0.7rem" }}>
                    <label style={labelStyle}>Outcome</label>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)} style={inputStyle}>
                      <option value="good_result">Good result</option>
                      <option value="problem">Problem</option>
                      <option value="wants_more">Wants more</option>
                      <option value="no_answer">No answer</option>
                    </select>

                    <label style={labelStyle}>Used product?</label>
                    <select value={usageStatus} onChange={(e) => setUsageStatus(e.target.value as any)} style={inputStyle}>
                      <option value="yes">Yes</option>
                      <option value="partly">Partly</option>
                      <option value="no">No</option>
                      <option value="unknown">Don&apos;t know</option>
                    </select>

                    <label style={labelStyle}>Result rating</label>
                    <select value={resultRating} onChange={(e) => setResultRating(e.target.value as any)} style={inputStyle}>
                      <option value="very_good">Very good</option>
                      <option value="good">Good</option>
                      <option value="average">Average</option>
                      <option value="poor">Poor</option>
                      <option value="very_poor">Very poor</option>
                    </select>

                    <label style={labelStyle}>Issue type</label>
                    <select value={issueType} onChange={(e) => setIssueType(e.target.value as any)} style={inputStyle}>
                      <option value="none">No problem</option>
                      <option value="application_problem">Application problem</option>
                      <option value="product_problem">Product problem</option>
                      <option value="packaging_problem">Packaging problem</option>
                      <option value="delivery_problem">Delivery problem</option>
                      <option value="technical_advice">Needs technical advice</option>
                      <option value="other">Other</option>
                    </select>

                    <label style={labelStyle}>Repurchase intent</label>
                    <select value={repurchaseIntent} onChange={(e) => setRepurchaseIntent(e.target.value as any)} style={inputStyle}>
                      <option value="yes">Yes</option>
                      <option value="maybe">Maybe</option>
                      <option value="no">No</option>
                    </select>

                    <label style={labelStyle}>Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

                    {shouldCaptureOpportunity && (
                      <div style={{ marginTop: "0.6rem", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 10, padding: "0.6rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#1e3a8a" }}>Sales Opportunity Details</div>

                        <label style={labelStyle}>Product</label>
                        <input
                          value={opportunityProductName}
                          onChange={(e) => setOpportunityProductName(e.target.value)}
                          placeholder={lead.productName || "e.g. Bio Fertilizer A"}
                          style={inputStyle}
                        />

                        <label style={labelStyle}>Quantity</label>
                        <input
                          value={opportunityQuantity}
                          onChange={(e) => setOpportunityQuantity(e.target.value)}
                          placeholder="e.g. 20 litres"
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
                      disabled={submittingLeadId === String(lead._id)}
                      style={{ ...primaryButtonStyle, width: "100%", marginTop: "0.55rem" }}
                    >
                      {submittingLeadId === String(lead._id) ? "Saving..." : "Save Call Outcome"}
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

  return (
    <div style={{ marginTop: "0.55rem", padding: "0.6rem", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: "0.86rem", color: "#14532d", lineHeight: 1.4 }}>
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Opening Script</div>
      <div>{script.rendered}</div>
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
