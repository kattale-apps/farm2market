"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CommunityQRCode } from "../../components/CommunityQRCode";
import { CommunityMemberCard } from "../../components/CommunityMemberCard";
import { resolveCommunityLogo } from "../../lib/communityLogos";
import { AdminFertilizerConfig } from "../../components/biofarm/AdminFertilizerConfig";
import { exportSubmissionsToPDF } from "../../utils/exportUtils";
import SubmissionPhotoGallery from "../../components/SubmissionPhotoGallery";

/* ── Tab types for community cards ── */
type CommunityTab = "members" | "noticeboard" | "messages" | "forms" | "insights" | "fertilizer";
type MembersListTab = "approved" | "all" | "imported" | "activeFarmsee";

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

/* ── Noticeboard tab (per community) ── */
function NoticeboardTab({ communityId, userId }: { communityId: Id<"communities">; userId: Id<"users"> }) {
  const posts = useQuery(api.noticeboard.getCommunityNoticeboardPosts, { communityId });
  const quotaStatus = useQuery(api.noticeboard.getAdminNoticeboardQuotaStatus, { communityId });
  const sendText = useMutation(api.noticeboard.sendNoticeboardTextMessage);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      await sendText({ communityId, text: text.trim(), userId });
      setText("");
      setMsg({ type: "success", text: "Post sent!" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed to send post" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Quota widget */}
      {quotaStatus && (
        <div style={{
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          background: quotaStatus.remaining === 0 ? "#fff3e0" : "#e8f5e9",
          border: `1px solid ${quotaStatus.remaining === 0 ? "#ffe0b2" : "#c8e6c9"}`,
          fontSize: "0.85rem",
          color: quotaStatus.remaining === 0 ? "#e65100" : "#2e7d32",
        }}>
          <strong>Image Posts:</strong> {quotaStatus.used}/{quotaStatus.quota} used &middot;{" "}
          {quotaStatus.remaining > 0
            ? `${quotaStatus.remaining} free remaining`
            : "New image posts will be billable"}
        </div>
      )}

      {/* Compose */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "1rem",
        background: "#fafafa",
        borderRadius: "10px",
        border: "1px solid #e0e0e0",
      }}>
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 600, color: "#333" }}>New Post</h4>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a noticeboard post…"
          rows={3}
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "0.9rem",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            style={{
              padding: "0.5rem 1.25rem",
              background: sending || !text.trim() ? "#bbb" : "#2e7d32",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Post"}
          </button>
          {msg && (
            <span style={{ fontSize: "0.82rem", color: msg.type === "success" ? "#2e7d32" : "#c62828" }}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Posts list */}
      <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 600, color: "#333" }}>Recent Posts</h4>
      {posts === undefined ? (
        <p style={{ color: "#999" }}>Loading posts…</p>
      ) : !Array.isArray(posts) || posts.length === 0 ? (
        <p style={{ color: "#999" }}>No posts yet. Create the first one above!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {posts.map((post: any) => (
            <div
              key={post._id}
              style={{
                padding: "0.75rem 1rem",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {post.caption && (
                <p style={{ margin: "0 0 0.3rem 0", fontSize: "0.9rem", color: "#333" }}>{post.caption}</p>
              )}
              {post.imageStorageId && (
                <span style={{ fontSize: "0.8rem", color: "#666" }}>📸 Image post</span>
              )}
              {!post.caption && !post.imageStorageId && post.text && (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#333" }}>{post.text}</p>
              )}
              <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#999" }}>
                {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Messages tab (per community) — with targeted messaging ── */
function MessagesTab({ communityId, userId }: { communityId: Id<"communities">; userId: Id<"users"> }) {
  const messages = useQuery(api.messages.getCommunityMessages, { communityId, userId });
  const members = useQuery(api.messages.getCommunityMembersForMessaging, { communityId });
  const sendText = useMutation(api.messages.sendTextMessage);
  const sendTargeted = useMutation(api.messages.sendTargetedCommunityMessage);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [targetType, setTargetType] = useState<"all" | "individual" | "role" | "superadmin">("all");
  const [selectedMembers, setSelectedMembers] = useState<Id<"users">[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("farmer");
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredMembers = (members || []).filter((m: any) =>
    m.alias?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleMember = (memberId: Id<"users">) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (targetType === "individual" && selectedMembers.length === 0) {
      setMsg({ type: "error", text: "Select at least one recipient" });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      if (targetType === "all") {
        await sendText({ communityId, userId, text: text.trim() });
      } else {
        await sendTargeted({
          communityId,
          userId,
          text: text.trim(),
          targetType,
          targetUserIds: targetType === "individual" ? selectedMembers : undefined,
          targetRole: targetType === "role" ? selectedRole : undefined,
        });
      }
      setText("");
      setSelectedMembers([]);
      setMsg({ type: "success", text: "Message sent!" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed to send" });
    } finally {
      setSending(false);
    }
  };

  const getTargetLabel = () => {
    if (targetType === "all") return "📢 All Members";
    if (targetType === "superadmin") return "🔑 Super Admin";
    if (targetType === "role") return `👥 All ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}s`;
    if (targetType === "individual") return `👤 ${selectedMembers.length} selected`;
    return "";
  };

  const getSenderName = (m: any) => m.userAlias || m.userId || "Unknown";

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column" }}>
      {/* Targeting Controls */}
      <div style={{
        marginBottom: "1rem", padding: "0.85rem", borderRadius: "10px",
        background: "#f5f9ff", border: "1px solid #bbdefb",
      }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1565c0", marginBottom: "0.5rem" }}>
          📨 Send To:
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {(["all", "individual", "role", "superadmin"] as const).map((t) => {
            const labels = { all: "All Members", individual: "Individual", role: "By Role", superadmin: "Super Admin" };
            return (
              <button
                key={t}
                onClick={() => { setTargetType(t); setShowMemberPicker(t === "individual"); }}
                style={{
                  padding: "0.3rem 0.65rem", borderRadius: "999px", border: "none",
                  background: targetType === t ? "#1976d2" : "#e3f2fd",
                  color: targetType === t ? "#fff" : "#1565c0",
                  fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Role Selector */}
        {targetType === "role" && (
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
            {["farmer", "trader", "buyer", "vendor", "transporter", "store"].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                style={{
                  padding: "0.25rem 0.6rem", borderRadius: "6px", border: "none",
                  background: selectedRole === r ? "#2e7d32" : "#e8f5e9",
                  color: selectedRole === r ? "#fff" : "#2e7d32",
                  fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}s
              </button>
            ))}
          </div>
        )}

        {/* Individual Member Picker */}
        {targetType === "individual" && (
          <div style={{ marginTop: "0.5rem" }}>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              style={{
                width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px",
                border: "1px solid #ccc", fontSize: "0.82rem", marginBottom: "0.35rem",
              }}
            />
            <div style={{
              maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.2rem",
            }}>
              {filteredMembers.map((m: any) => {
                const isSelected = selectedMembers.includes(m.userId);
                return (
                  <div
                    key={m.userId}
                    onClick={() => toggleMember(m.userId)}
                    style={{
                      padding: "0.35rem 0.6rem", borderRadius: "6px", cursor: "pointer",
                      background: isSelected ? "#e8f5e9" : "#fff",
                      border: `1px solid ${isSelected ? "#43a047" : "#eee"}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#333" }}>{m.alias}</span>
                      <span style={{
                        marginLeft: "0.4rem", padding: "0.1rem 0.35rem", borderRadius: "4px",
                        fontSize: "0.68rem", fontWeight: 600,
                        background: m.role === "farmer" ? "#e8f5e9" : m.role === "trader" ? "#fff3e0" : m.role === "buyer" ? "#e3f2fd" : "#f3e5f5",
                        color: m.role === "farmer" ? "#2e7d32" : m.role === "trader" ? "#ef6c00" : m.role === "buyer" ? "#1565c0" : "#7b1fa2",
                      }}>
                        {m.role}
                      </span>
                    </div>
                    {isSelected && <span style={{ color: "#43a047", fontWeight: 700 }}>✓</span>}
                  </div>
                );
              })}
              {filteredMembers.length === 0 && (
                <p style={{ color: "#999", fontSize: "0.8rem", textAlign: "center", padding: "0.5rem" }}>No members found</p>
              )}
            </div>
            {selectedMembers.length > 0 && (
              <div style={{ marginTop: "0.35rem", fontSize: "0.78rem", color: "#2e7d32", fontWeight: 600 }}>
                {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#666" }}>
          Sending to: <strong>{getTargetLabel()}</strong>
        </div>
        <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "0.15rem" }}>
          Tip: use <strong>Individual</strong> for private replies and <strong>All</strong> for community broadcasts.
        </div>
      </div>

      {/* Messages feed */}
      <div style={{
        maxHeight: "350px",
        overflowY: "auto",
        marginBottom: "1rem",
        padding: "0.5rem",
        background: "#f9fafb",
        borderRadius: "10px",
        border: "1px solid #e5e7eb",
      }}>
        {messages === undefined ? (
          <p style={{ color: "#999", textAlign: "center", padding: "1rem" }}>Loading messages…</p>
        ) : !Array.isArray(messages) || messages.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", padding: "1rem" }}>No messages yet. Start the conversation!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {([...messages].reverse()).map((m: any) => {
              const isMine = m.userId === userId;
              return (
                <div
                  key={m._id}
                  style={{
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{
                    maxWidth: "75%",
                    padding: "0.5rem 0.85rem",
                    borderRadius: isMine ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background: isMine ? "#2e7d32" : "#fff",
                    color: isMine ? "#fff" : "#333",
                    border: isMine ? "none" : "1px solid #e0e0e0",
                    fontSize: "0.88rem",
                  }}>
                    <p style={{ margin: "0 0 0.2rem 0", fontSize: "0.72rem", opacity: 0.8, fontWeight: 600 }}>
                      From: {getSenderName(m)}
                    </p>
                    {m.text && <p style={{ margin: 0 }}>{m.text}</p>}
                    {m.imageStorageId && <span style={{ fontSize: "0.8rem" }}>📸 Image</span>}
                    <div style={{
                      marginTop: "0.25rem",
                      fontSize: "0.7rem",
                      opacity: 0.7,
                      textAlign: "right",
                    }}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Compose */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          style={{
            flex: 1, padding: "0.6rem 0.85rem", borderRadius: "999px",
            border: "1px solid #ccc", fontSize: "0.88rem", outline: "none",
          }}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          style={{
            padding: "0.6rem 1.25rem", borderRadius: "999px", border: "none",
            background: sending || !text.trim() ? "#bbb" : "#1976d2",
            color: "#fff", fontWeight: 600, fontSize: "0.85rem",
            cursor: sending || !text.trim() ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "…" : "Send"}
        </button>
        {msg && (
          <span style={{ fontSize: "0.78rem", color: msg.type === "success" ? "#2e7d32" : "#c62828" }}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Forms & Templates tab (per community) ── */
function FormsTab({ communityId, userId }: { communityId: Id<"communities">; userId: Id<"users"> }) {
  const forms = useQuery((api as any).forms.getCommunityForms, { communityId });
  const templates = useQuery((api as any).forms.getTrackerTemplates, {});
  const seedTemplates = useMutation((api as any).forms.seedTrackerTemplates);
  const createTrackerFromTemplate = useMutation((api as any).forms.createTrackerFromTemplate);
  const createForm = useMutation((api as any).forms.createForm);
  const addFormField = useMutation((api as any).forms.addFormField);
  const deleteForm = useMutation((api as any).forms.deleteForm);
  const updateForm = useMutation((api as any).forms.updateForm);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderCategory, setBuilderCategory] = useState("custom");
  const [builderPurpose, setBuilderPurpose] = useState<"tracker" | "profile" | "extension_work">("tracker");
  const [builderPaymentEnabled, setBuilderPaymentEnabled] = useState(false);
  const [builderPaymentAmount, setBuilderPaymentAmount] = useState("5000");
  const [builderPaymentEditable, setBuilderPaymentEditable] = useState(false);
  const [builderFields, setBuilderFields] = useState<any[]>([
    { fieldType: "text", label: "", required: true, helpText: "", placeholder: "", options: [] },
  ]);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-seed templates on first load
  useEffect(() => {
    if (templates && templates.length === 0) {
      seedTemplates({}).catch(() => {});
    }
  }, [templates, seedTemplates]);

  const handleCreateFromTemplate = async (templateId: Id<"trackerTemplates">) => {
    try {
      await createTrackerFromTemplate({ templateId, communityId, adminId: userId });
      setMsg({ type: "success", text: "Form created from template!" });
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    }
  };

  const handleCreateCustom = async () => {
    if (!builderName.trim()) return;
    const validFields = builderFields.filter((f) => f.label.trim());
    if (validFields.length === 0) {
      setMsg({ type: "error", text: "Add at least one field with a label" });
      return;
    }
    try {
      const normalizedPaymentEnabled = builderPurpose === "extension_work" ? builderPaymentEnabled || builderPaymentEditable : false;
      const result = await createForm({
        communityId,
        adminId: userId,
        name: builderName,
        description: builderDescription || undefined,
        category: builderCategory,
        formPurpose: builderPurpose,
        paymentEnabled: normalizedPaymentEnabled,
        paymentAmount: builderPurpose === "extension_work" && normalizedPaymentEnabled ? Number(builderPaymentAmount) || 0 : undefined,
        paymentAmountEditable: builderPurpose === "extension_work" ? builderPaymentEditable : false,
      });
      for (const f of validFields) {
        await addFormField({
          formId: (result as any)._id,
          fieldType: f.fieldType,
          label: f.label,
          required: f.required,
          helpText: f.helpText || undefined,
          placeholder: f.placeholder || undefined,
          options: f.options?.length > 0 ? f.options.filter((o: string) => o.trim()) : undefined,
        });
      }
      setMsg({ type: "success", text: "Custom form created!" });
      setShowBuilder(false);
      setBuilderName("");
      setBuilderDescription("");
      setBuilderCategory("custom");
      setBuilderPurpose("tracker");
      setBuilderPaymentEnabled(false);
      setBuilderPaymentAmount("5000");
      setBuilderPaymentEditable(false);
      setBuilderFields([{ fieldType: "text", label: "", required: true, helpText: "", placeholder: "", options: [] }]);
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    }
  };

  const addField = () => {
    setBuilderFields((prev) => [...prev, { fieldType: "text", label: "", required: false, helpText: "", placeholder: "", options: [] }]);
  };

  const removeField = (idx: number) => {
    setBuilderFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, key: string, value: any) => {
    setBuilderFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const CATEGORY_LABELS: Record<string, string> = {
    revenue: "Revenue", expense: "Expense", inventory: "Inventory",
    profit_loss: "Profit & Loss", cashflow: "Cash Flow", custom: "Custom",
  };
  const CATEGORY_COLORS: Record<string, string> = {
    revenue: "#2e7d32", expense: "#d32f2f", inventory: "#1976d2",
    profit_loss: "#f57c00", cashflow: "#00838f", custom: "#7b1fa2",
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      {msg && (
        <div style={{
          marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "8px",
          background: msg.type === "success" ? "#e8f5e9" : "#ffebee",
          color: msg.type === "success" ? "#2e7d32" : "#c62828",
          border: `1px solid ${msg.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
          fontSize: "0.85rem",
        }}>
          {msg.text}
        </div>
      )}

      {/* Templates Section */}
      <div style={{ marginBottom: "2rem" }}>
        <h4 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", fontWeight: 700, color: "#1b5e20" }}>
          📋 Templates
        </h4>
        <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 1rem 0" }}>
          Create forms instantly from pre-built templates with fields ready to go.
        </p>
        {templates === undefined ? (
          <p style={{ color: "#999", fontSize: "0.85rem" }}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.85rem" }}>Seeding templates...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: "0.75rem" }}>
            {templates.map((t: any) => (
              <div key={t._id} style={{
                padding: "1rem", borderRadius: "10px", border: "1px solid #e0e0e0",
                background: "#fafafa",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{
                    padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.7rem",
                    fontWeight: 600, background: CATEGORY_COLORS[t.category] || "#7b1fa2",
                    color: "#fff",
                  }}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                </div>
                <h5 style={{ margin: "0 0 0.35rem 0", fontSize: "0.95rem", fontWeight: 700, color: "#333" }}>
                  {t.name}
                </h5>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#666" }}>
                  {t.description}
                </p>
                <div style={{ fontSize: "0.78rem", color: "#888", marginBottom: "0.5rem" }}>
                  {t.fields?.length || 0} fields: {(t.fields || []).map((f: any) => f.label).join(", ")}
                </div>
                <button
                  onClick={() => handleCreateFromTemplate(t._id)}
                  style={{
                    padding: "0.4rem 0.8rem", borderRadius: "6px", border: "none",
                    background: "#2e7d32", color: "#fff", fontSize: "0.8rem",
                    fontWeight: 600, cursor: "pointer",
                  }}
                >
                  + Use Template
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing Forms */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1b5e20" }}>
            📝 Community Forms
          </h4>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            style={{
              padding: "0.4rem 0.8rem", borderRadius: "6px", border: "none",
              background: showBuilder ? "#c62828" : "#1976d2", color: "#fff",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {showBuilder ? "Cancel" : "+ Build Custom Form"}
          </button>
        </div>

        {/* Custom Form Builder */}
        {showBuilder && (
          <div style={{
            marginBottom: "1.5rem", padding: "1.25rem", borderRadius: "12px",
            border: "2px solid #1976d2", background: "#f5f9ff",
          }}>
            <h5 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "#1976d2" }}>
              Custom Form Builder
            </h5>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#333" }}>Form Name *</label>
                <input
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="e.g. Weekly Harvest Report"
                  style={{
                    width: "100%", padding: "0.5rem", borderRadius: "6px",
                    border: "1px solid #ccc", fontSize: "0.85rem", marginTop: "0.25rem",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#333" }}>Category</label>
                <select
                  value={builderCategory}
                  onChange={(e) => setBuilderCategory(e.target.value)}
                  style={{
                    width: "100%", padding: "0.5rem", borderRadius: "6px",
                    border: "1px solid #ccc", fontSize: "0.85rem", marginTop: "0.25rem",
                  }}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Form Purpose Toggle */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#333", display: "block", marginBottom: "0.3rem" }}>Form Purpose</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(["tracker", "profile", "extension_work"] as const).map((purpose) => (
                  <button
                    key={purpose}
                    onClick={() => setBuilderPurpose(purpose)}
                    style={{
                      flex: "1 1 140px",
                      padding: "0.5rem",
                      borderRadius: "8px",
                      border: `2px solid ${builderPurpose === purpose ? (purpose === "tracker" ? "#1976d2" : purpose === "profile" ? "#2e7d32" : "#ef6c00") : "#ddd"}`,
                      background: builderPurpose === purpose ? (purpose === "tracker" ? "#e3f2fd" : purpose === "profile" ? "#e8f5e9" : "#fff3e0") : "#fff",
                      color: builderPurpose === purpose ? (purpose === "tracker" ? "#1565c0" : purpose === "profile" ? "#2e7d32" : "#ef6c00") : "#666",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {purpose === "tracker" ? "📊 Tracker Form" : purpose === "profile" ? "👤 Profile Form" : "🧑‍🌾 Extension Work"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: "0.25rem 0 0 0" }}>
                {builderPurpose === "tracker"
                  ? "Tracker forms appear in the Trackers tab for data entry"
                  : builderPurpose === "profile"
                    ? "Profile forms appear in the community Profile tab for member info"
                    : "Extension work forms can collect a payment before the member submits the form"}
              </p>
            </div>
            {builderPurpose === "extension_work" && (
              <div style={{ marginBottom: "1rem", padding: "0.8rem", borderRadius: "8px", border: "1px solid #ffe0b2", background: "#fff8e1" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ef6c00", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  💳 Payment Gate
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#333" }}>
                    <input type="checkbox" checked={builderPaymentEnabled} onChange={(e) => setBuilderPaymentEnabled(e.target.checked)} />
                    Require payment before submission
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#333" }}>
                    <input
                      type="checkbox"
                      checked={builderPaymentEditable}
                      onChange={(e) => {
                        const nextValue = e.target.checked;
                        setBuilderPaymentEditable(nextValue);
                        if (nextValue) {
                          setBuilderPaymentEnabled(true);
                        }
                      }}
                    />
                    Let worker edit amount
                  </label>
                </div>
                {builderPaymentEnabled && (
                  <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#333" }}>Amount (UGX)</label>
                      <input
                        type="number"
                        value={builderPaymentAmount}
                        onChange={(e) => setBuilderPaymentAmount(e.target.value)}
                        placeholder="5000"
                        style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.82rem", marginTop: "0.25rem" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#333" }}>Description</label>
              <input
                value={builderDescription}
                onChange={(e) => setBuilderDescription(e.target.value)}
                placeholder="Brief description of the form"
                style={{
                  width: "100%", padding: "0.5rem", borderRadius: "6px",
                  border: "1px solid #ccc", fontSize: "0.85rem", marginTop: "0.25rem",
                }}
              />
            </div>

            {/* Fields */}
            <h6 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Fields</h6>
            <div
              style={{
                marginBottom: "0.6rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "8px",
                border: "1px solid #dcedc8",
                background: "#f1f8e9",
                color: "#33691e",
                fontSize: "0.76rem",
                lineHeight: 1.45,
              }}
            >
              <strong>Bio Farm Application Record labels (recommended):</strong>
              <br />Form name: <code>Application Record</code> (or <code>Spray Day Record</code>)
              <br />Numeric fields: <code>Fertilizer used ml</code>, <code>Acres sprayed</code>, <code>Knapsacks sprayed</code>
              <br />Photo field labels: <code>Best leaf</code>, <code>Worst leaf</code>, <code>Whole plant</code>, <code>Flowers</code>, <code>Fruits</code>, <code>Field overview</code>
            </div>
            {builderFields.map((field, idx) => (
              <div key={idx} style={{
                padding: "0.75rem", borderRadius: "8px", border: "1px solid #d0d0d0",
                background: "#fff", marginBottom: "0.5rem",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 120px auto auto", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(idx, "label", e.target.value)}
                    placeholder="Field label"
                    style={{ padding: "0.4rem", borderRadius: "5px", border: "1px solid #ccc", fontSize: "0.82rem" }}
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) => updateField(idx, "fieldType", e.target.value)}
                    style={{ padding: "0.4rem", borderRadius: "5px", border: "1px solid #ccc", fontSize: "0.82rem" }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="textarea">Textarea</option>
                    <option value="camera">📸 Camera Photo</option>
                    <option value="gps">📍 GPS Location</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.78rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(idx, "required", e.target.checked)}
                    />
                    Required
                  </label>
                  <button
                    onClick={() => removeField(idx)}
                    style={{
                      border: "none", background: "#ffebee", color: "#c62828",
                      borderRadius: "5px", padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.8rem",
                    }}
                  >
                    ✕
                  </button>
                </div>
                {field.fieldType === "select" && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <input
                      value={(field.options || []).join(", ")}
                      onChange={(e) => updateField(idx, "options", e.target.value.split(",").map((s: string) => s.trim()))}
                      placeholder="Options (comma-separated)"
                      style={{ width: "100%", padding: "0.35rem", borderRadius: "5px", border: "1px solid #ccc", fontSize: "0.8rem" }}
                    />
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                onClick={addField}
                style={{
                  padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px dashed #999",
                  background: "#fff", color: "#333", fontSize: "0.8rem", cursor: "pointer",
                }}
              >
                + Add Field
              </button>
              <button
                onClick={handleCreateCustom}
                disabled={!builderName.trim()}
                style={{
                  padding: "0.4rem 0.9rem", borderRadius: "6px", border: "none",
                  background: builderName.trim() ? "#1976d2" : "#bbb", color: "#fff",
                  fontSize: "0.8rem", fontWeight: 600, cursor: builderName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Form
              </button>
            </div>
          </div>
        )}

        {/* Forms List */}
        {forms === undefined ? (
          <p style={{ color: "#999", fontSize: "0.85rem" }}>Loading forms...</p>
        ) : forms.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.85rem" }}>No forms yet. Use a template or build a custom form above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {forms.map((form: any) => {
              const isExpanded = expandedFormId === String(form._id);
              return (
                <div key={form._id} style={{
                  borderRadius: "10px", border: "1px solid #e0e0e0", background: "#fff", overflow: "hidden",
                }}>
                  <div
                    onClick={() => setExpandedFormId(isExpanded ? null : String(form._id))}
                    style={{
                      padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between",
                      alignItems: "center", cursor: "pointer", background: isExpanded ? "#f5f9ff" : "#fafafa",
                      borderBottom: isExpanded ? "1px solid #ddd" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      {form.formPurpose === "profile" && (
                        <span style={{
                          padding: "0.1rem 0.4rem", borderRadius: "999px", fontSize: "0.68rem",
                          fontWeight: 600, background: "#2e7d32", color: "#fff",
                        }}>
                          👤 Profile
                        </span>
                      )}
                      {form.formPurpose === "extension_work" && (
                        <span style={{
                          padding: "0.1rem 0.4rem", borderRadius: "999px", fontSize: "0.68rem",
                          fontWeight: 600, background: "#ef6c00", color: "#fff",
                        }}>
                          💳 Extension Work
                        </span>
                      )}
                      {form.category && (
                        <span style={{
                          padding: "0.1rem 0.4rem", borderRadius: "999px", fontSize: "0.68rem",
                          fontWeight: 600, background: CATEGORY_COLORS[form.category] || "#7b1fa2", color: "#fff",
                        }}>
                          {CATEGORY_LABELS[form.category] || form.category}
                        </span>
                      )}
                      <strong style={{ fontSize: "0.9rem", color: "#333" }}>{form.name}</strong>
                      <span style={{
                        fontSize: "0.75rem", color: form.isActive ? "#2e7d32" : "#999",
                        fontWeight: 600,
                      }}>
                        {form.isActive ? "● Active" : "● Inactive"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "#888" }}>
                        {form.responseCount || 0} responses
                      </span>
                      <span style={{ fontSize: "1rem", color: "#888" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <FormDetailView
                      formId={form._id}
                      formName={form.name}
                      isActive={form.isActive}
                      onToggleActive={async () => {
                        try {
                          await updateForm({ formId: form._id, isActive: !form.isActive });
                          setMsg({ type: "success", text: `Form ${form.isActive ? "deactivated" : "activated"}` });
                        } catch (e: any) {
                          setMsg({ type: "error", text: e.message });
                        }
                      }}
                      onDelete={async () => {
                        if (confirm("Delete this form and all its data?")) {
                          try {
                            await deleteForm({ formId: form._id });
                            setMsg({ type: "success", text: "Form deleted" });
                          } catch (e: any) {
                            setMsg({ type: "error", text: e.message });
                          }
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Form Detail View (inside Forms tab) ── */
function FormDetailView({ formId, formName, isActive, onToggleActive, onDelete }: {
  formId: Id<"communityForms">;
  formName: string;
  isActive: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const formDetails = useQuery((api as any).forms.getFormDetails, { formId });
  const responses = useQuery((api as any).forms.getFormResponses, { formId });

  return (
    <div style={{ padding: "1rem" }}>
      {/* Form fields */}
      <h6 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>
        Fields
      </h6>
      {formDetails === undefined ? (
        <p style={{ color: "#999", fontSize: "0.8rem" }}>Loading...</p>
      ) : formDetails.fields && formDetails.fields.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
          {formDetails.fields.map((f: any, idx: number) => (
            <div key={f._id || idx} style={{
              padding: "0.5rem 0.75rem", borderRadius: "6px", background: "#f5f5f5",
              border: "1px solid #eee", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", background: "#e8f5e9",
                color: "#2e7d32", fontSize: "0.7rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#333" }}>{f.label}</span>
              <span style={{
                padding: "0.1rem 0.35rem", borderRadius: "4px", fontSize: "0.68rem",
                background: "#e3f2fd", color: "#1565c0", fontWeight: 600,
              }}>
                {f.fieldType}
              </span>
              {f.required && (
                <span style={{ fontSize: "0.7rem", color: "#c62828", fontWeight: 600 }}>Required</span>
              )}
              {f.options && f.options.length > 0 && (
                <span style={{ fontSize: "0.72rem", color: "#888" }}>
                  Options: {f.options.join(", ")}
                </span>
              )}
              {f.isCalculated && (
                <span style={{ fontSize: "0.72rem", color: "#f57c00", fontWeight: 600 }}>
                  Calculated: {f.formula}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#999", fontSize: "0.8rem", marginBottom: "1rem" }}>No fields defined.</p>
      )}

      {formDetails?.paymentEnabled && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: "8px", background: "#fff8e1", border: "1px solid #ffe0b2", fontSize: "0.82rem", color: "#8d6e63" }}>
          <strong>Payment gate:</strong> {formDetails.paymentAmount ? `UGX ${formDetails.paymentAmount}` : "Payment enabled"}
          {formDetails.paymentAmountEditable ? " (editable by worker)" : ""}
        </div>
      )}

      {/* Responses count */}
      <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.75rem" }}>
        <strong>Responses:</strong> {responses === undefined ? "..." : Array.isArray(responses) ? responses.length : 0}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onToggleActive}
          style={{
            padding: "0.35rem 0.7rem", borderRadius: "6px", border: "1px solid #ddd",
            background: isActive ? "#fff3e0" : "#e8f5e9", color: isActive ? "#ef6c00" : "#2e7d32",
            fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          {isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: "0.35rem 0.7rem", borderRadius: "6px", border: "1px solid #ffcdd2",
            background: "#ffebee", color: "#c62828",
            fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ── Insights tab (per community) ── */
const CHART_COLORS = ["#2e7d32","#1565c0","#ef6c00","#8e24aa","#c62828","#00838f","#6d4c41","#546e7a","#d4e157","#ff8a65"];

function InsightsTab({ communityId, userId }: { communityId: Id<"communities">; userId: Id<"users"> }) {
  const forms = useQuery((api as any).forms.getCommunityForms, { communityId });
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const formResponses = useQuery(
    (api as any).forms.getFormResponses,
    selectedFormId ? { formId: selectedFormId as Id<"communityForms"> } : "skip"
  );
  const membersRaw = useQuery(
    api.communityApplications.getCommunityMembersByCommunityIds,
    userId ? { adminId: userId, communityIds: [communityId], status: "APPROVED" as const } : "skip"
  );
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showMemberInsights, setShowMemberInsights] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : true);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 375);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const compactLabel = useCallback((value: any, mobileLimit = 12, desktopLimit = 20) => {
    const text = String(value ?? "");
    const max = isMobile ? mobileLimit : desktopLimit;
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(6, max - 1))}…`;
  }, [isMobile]);

  const pieLabel = useCallback(({ name, percent }: any) => {
    return `${compactLabel(name, 10, 16)} ${(percent * 100).toFixed(0)}%`;
  }, [compactLabel]);

  const tooltipStyle = isMobile
    ? { fontSize: "0.78rem", padding: "0.35rem 0.55rem", borderRadius: "6px" }
    : { fontSize: "0.82rem", padding: "0.4rem 0.65rem", borderRadius: "6px" };

  const pieLegendProps = isMobile
    ? {
        layout: "vertical" as const,
        align: "left" as const,
        verticalAlign: "bottom" as const,
        iconSize: 10,
        wrapperStyle: { paddingTop: "0.6rem", fontSize: "0.74rem", lineHeight: 1.45 },
      }
    : {
        layout: "horizontal" as const,
        align: "center" as const,
        verticalAlign: "bottom" as const,
        iconSize: 11,
        wrapperStyle: { paddingTop: "0.4rem" },
      };

  const xAxisTickProps = isMobile
    ? { fontSize: 9, angle: -35, textAnchor: "end" as const }
    : { fontSize: 10 };

  const xAxisHeight = isMobile ? 56 : 34;

  const mobilePieTopN = useMemo(() => {
    const width = viewportWidth;
    if (width <= 360) return 4;
    if (width <= 767) return 5;
    return 6;
  }, [viewportWidth]);

  const getMobilePieData = useCallback((data: Array<{ name: string; value: number; fill?: string }>, topN = 5) => {
    if (!Array.isArray(data)) return [];
    if (!isMobile || data.length <= topN) return data;
    const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
    const top = sorted.slice(0, topN);
    const otherValue = sorted.slice(topN).reduce((sum, item) => sum + (item.value || 0), 0);
    if (otherValue <= 0) return top;
    return [...top, { name: "Other", value: otherValue, fill: "#b0bec5" }];
  }, [isMobile]);

  const trackerForms = (forms ?? []).filter((f: any) => f.formPurpose === "tracker" || !f.formPurpose);
  const profileForms = (forms ?? []).filter((f: any) => f.formPurpose === "profile");
  const extensionWorkForms = (forms ?? []).filter((f: any) => f.formPurpose === "extension_work");
  const selectedForm = (forms ?? []).find((f: any) => String(f._id) === selectedFormId);
  const isProfile = selectedForm?.formPurpose === "profile";
  const isExtensionWork = selectedForm?.formPurpose === "extension_work";

  const fields: any[] = formResponses?.fields ?? [];
  const responses: any[] = formResponses?.responses ?? [];

  // ── Extract member list (fix: membersRaw is array, not dict) ──
  const memberList: any[] = useMemo(() => {
    if (!membersRaw || !Array.isArray(membersRaw)) return [];
    const found = (membersRaw as any[]).find((c: any) => String(c.communityId) === String(communityId));
    return found?.members ?? [];
  }, [membersRaw, communityId]);

  const totalMembers = memberList.length;

  // ── Member Insights (category-agnostic) ──
  const memberInsights = useMemo(() => {
    if (!memberList.length) return null;
    const farmers = memberList.map((m: any) => m.farmer).filter(Boolean);

    // Role distribution (farmer, trader, buyer, etc.)
    const roleFreq: Record<string, number> = {};
    farmers.forEach((f: any) => { const r = f.role || "unknown"; roleFreq[r] = (roleFreq[r] || 0) + 1; });
    const roleData = Object.entries(roleFreq).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
    const roleColors: Record<string, string> = {};
    roleData.forEach((r, i) => { roleColors[r.name] = CHART_COLORS[i % CHART_COLORS.length]; });

    // Sex distribution
    const sexFreq: Record<string, number> = {};
    farmers.forEach((f: any) => { const s = f.sex === "M" ? "Male" : f.sex === "F" ? "Female" : "Not Set"; sexFreq[s] = (sexFreq[s] || 0) + 1; });
    const sexData = Object.entries(sexFreq).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));

    // District distribution
    const districtFreq: Record<string, number> = {};
    farmers.forEach((f: any) => { const d = f.districtText || "Unknown"; districtFreq[d] = (districtFreq[d] || 0) + 1; });
    const districtColors: Record<string, string> = {};
    Object.keys(districtFreq).sort().forEach((d, i) => { districtColors[d] = CHART_COLORS[i % CHART_COLORS.length]; });
    const districtData = Object.entries(districtFreq).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value, fill: districtColors[name] }));

    // Subcounty distribution (colour-coded by district)
    const subcountyMap: Record<string, { count: number; district: string }> = {};
    farmers.forEach((f: any) => {
      const sc = f.subCountyText || "Unknown";
      const d = f.districtText || "Unknown";
      if (!subcountyMap[sc]) subcountyMap[sc] = { count: 0, district: d };
      subcountyMap[sc].count++;
    });
    const subcountyData = Object.entries(subcountyMap)
      .sort(([,a],[,b]) => b.count - a.count)
      .map(([name, { count, district }]) => ({ name, value: count, fill: districtColors[district] || "#546e7a" }));

    // Farm size data (only for members that have it)
    const farmSizes = farmers.filter((f: any) => typeof f.farmSizeAcres === "number" && f.farmSizeAcres > 0);
    const totalFarmSize = farmSizes.reduce((sum: number, f: any) => sum + f.farmSizeAcres, 0);
    const hasFarmData = farmSizes.length > 0;

    // Farm size histogram (bucket by floor)
    const farmBuckets: Record<number, number> = {};
    farmSizes.forEach((f: any) => { const b = Math.floor(f.farmSizeAcres); farmBuckets[b] = (farmBuckets[b] || 0) + 1; });
    const histData = Object.entries(farmBuckets).sort(([a],[b]) => Number(a) - Number(b)).map(([name, value]) => ({ name: `${name} acres`, value }));

    // Average farm size per district
    const districtFarmAcc: Record<string, { total: number; count: number }> = {};
    farmSizes.forEach((f: any) => {
      const d = f.districtText || "Unknown";
      if (!districtFarmAcc[d]) districtFarmAcc[d] = { total: 0, count: 0 };
      districtFarmAcc[d].total += f.farmSizeAcres;
      districtFarmAcc[d].count++;
    });
    const avgFarmDataUnsorted = Object.entries(districtFarmAcc)
      .map(([name, val]) => ({ name, value: Math.round((val.total / val.count) * 100) / 100, fill: districtColors[name] || "#546e7a" }));
    const avgFarmData = avgFarmDataUnsorted.sort((a, b) => b.value - a.value);

    // Region distribution
    const regionFreq: Record<string, number> = {};
    farmers.forEach((f: any) => { if (f.region) { regionFreq[f.region] = (regionFreq[f.region] || 0) + 1; } });
    const regionData = Object.entries(regionFreq).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));

    // Supply chain role distribution
    const scRoleFreq: Record<string, number> = {};
    farmers.forEach((f: any) => { if (f.supplyChainRole) { scRoleFreq[f.supplyChainRole] = (scRoleFreq[f.supplyChainRole] || 0) + 1; } });
    const scRoleData = Object.entries(scRoleFreq).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }));

    const distinctDistricts = Object.keys(districtFreq).filter(d => d !== "Unknown").length;
    const distinctSubcounties = Object.keys(subcountyMap).filter(s => s !== "Unknown").length;

    return {
      roleData, roleColors, sexData, districtData, districtColors, subcountyData,
      hasFarmData, totalFarmSize, histData, avgFarmData,
      regionData, scRoleData,
      distinctDistricts, distinctSubcounties, totalMemberCount: farmers.length,
    };
  }, [memberList]);

  // Aggregate per-field data
  const fieldAggregations = useMemo(() => {
    if (!fields.length || !responses.length) return [];
    return fields.map((field: any) => {
      const vals = responses.map((r: any) => {
        const v = (r.values || []).find((rv: any) => String(rv.fieldId) === String(field._id));
        return v?.value ?? "";
      }).filter((v: string) => v !== "");

      if (field.fieldType === "number") {
        const nums = vals.map(Number).filter((n: number) => !isNaN(n));
        const avg = nums.length ? nums.reduce((a: number, b: number) => a + b, 0) / nums.length : 0;
        const min = nums.length ? Math.min(...nums) : 0;
        const max = nums.length ? Math.max(...nums) : 0;
        const barData = responses.map((r: any) => {
          const v = (r.values || []).find((rv: any) => String(rv.fieldId) === String(field._id));
          const num = parseFloat(v?.value ?? "0");
          return { name: r.member?.alias || "?", value: isNaN(num) ? 0 : num };
        }).filter((d: any) => d.value !== 0);
        return { field, type: "number" as const, barData, avg: Math.round(avg * 100) / 100, min, max, count: nums.length };
      }
      if (field.fieldType === "select" || field.fieldType === "checkbox") {
        const freq: Record<string, number> = {};
        vals.forEach((v: string) => { freq[v] = (freq[v] || 0) + 1; });
        const pieData = Object.entries(freq).map(([name, value]) => ({ name, value }));
        return { field, type: "pie" as const, pieData, count: vals.length };
      }
      if (field.fieldType === "date") {
        const monthFreq: Record<string, number> = {};
        vals.forEach((v: string) => {
          try { const d = new Date(v); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; monthFreq[key] = (monthFreq[key] || 0) + 1; } catch {}
        });
        const barData = Object.entries(monthFreq).sort(([a],[b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
        return { field, type: "date" as const, barData, count: vals.length };
      }
      if (field.fieldType === "camera") {
        return { field, type: "camera" as const, count: vals.length };
      }
      const freq: Record<string, number> = {};
      vals.forEach((v: string) => { freq[v] = (freq[v] || 0) + 1; });
      const barData = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 10).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0,18)+"…" : name, value }));
      return { field, type: "text" as const, barData, count: vals.length };
    });
  }, [fields, responses]);

  // ── Export: PNG charts ──
  const handleExportPNG = useCallback(() => {
    chartRefs.current.forEach((div, idx) => {
      if (!div) return;
      const svg = div.querySelector("svg");
      if (!svg) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${fields[idx]?.label || idx}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [fields]);

  // ── Export: Excel (form responses) ──
  const handleExportExcel = useCallback(() => {
    if (!responses.length || !fields.length) return;
    const rows = responses.map((r: any) => {
      const row: Record<string, string> = {
        "Member": r.member?.alias || "Unknown",
        "Email": r.member?.email || "—",
        "Phone": r.member?.phoneNumber || "—",
        "Submitted": new Date(r.createdAt).toLocaleString(),
      };
      fields.forEach((f: any) => {
        const v = (r.values || []).find((rv: any) => String(rv.fieldId) === String(f._id));
        let val = v?.value ?? "";
        if (f.fieldType === "camera") {
          try { val = JSON.parse(val).capturedAt || "photo"; } catch { val = val ? "photo" : ""; }
        }
        row[f.label] = val;
      });
      return row;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const summary = [
      { Metric: "Form", Value: selectedForm?.name || "" },
      { Metric: "Type", Value: isProfile ? "Profile" : "Tracker" },
      { Metric: "Total Responses", Value: String(responses.length) },
      { Metric: "Fields", Value: String(fields.length) },
      { Metric: "Exported", Value: new Date().toLocaleString() },
    ];
    const ss = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ss, "Summary");
    XLSX.writeFile(wb, `${selectedForm?.name || "form"}-responses.xlsx`);
  }, [responses, fields, selectedForm, isProfile]);

  // ── Export: PDF (form responses) ──
  const handleExportPDF = useCallback(() => {
    if (!responses.length || !fields.length) return;
    const doc = new jsPDF({ orientation: fields.length > 5 ? "landscape" : "portrait" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.text(selectedForm?.name || "Form Report", pw / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Type: ${isProfile ? "Profile Form" : "Tracker Form"} | Responses: ${responses.length} | Exported: ${new Date().toLocaleString()}`, pw / 2, 26, { align: "center" });
    const summaryRows = fieldAggregations.map((agg: any) => {
      if (agg.type === "number") return [agg.field.label, "Number", `Avg: ${agg.avg}, Min: ${agg.min}, Max: ${agg.max} (${agg.count} values)`];
      if (agg.type === "pie") return [agg.field.label, agg.field.fieldType, agg.pieData.map((d: any) => `${d.name}: ${d.value}`).join(", ")];
      if (agg.type === "camera") return [agg.field.label, "Camera", `${agg.count} photos`];
      if (agg.type === "date") return [agg.field.label, "Date", agg.barData.map((d: any) => `${d.name}: ${d.value}`).join(", ")];
      return [agg.field.label, agg.field.fieldType, (agg.barData || []).map((d: any) => `${d.name}: ${d.value}`).join(", ")];
    });
    autoTable(doc, { head: [["Field", "Type", "Summary"]], body: summaryRows, startY: 34, styles: { fontSize: 8 }, headStyles: { fillColor: [46, 125, 50] } });
    const headers = ["Member", ...fields.map((f: any) => f.label)];
    const body = responses.map((r: any) => {
      const memberName = r.member?.alias || "Unknown";
      const vals = fields.map((f: any) => {
        const v = (r.values || []).find((rv: any) => String(rv.fieldId) === String(f._id));
        let val = v?.value ?? "";
        if (f.fieldType === "camera") { try { val = JSON.parse(val).capturedAt || "photo"; } catch { val = val ? "photo" : ""; } }
        return val.length > 40 ? val.slice(0, 38) + "…" : val;
      });
      return [memberName, ...vals];
    });
    autoTable(doc, { head: [headers], body, startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 80, styles: { fontSize: 7 }, headStyles: { fillColor: [21, 101, 192] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
    doc.save(`${selectedForm?.name || "form"}-report.pdf`);
  }, [responses, fields, selectedForm, isProfile, fieldAggregations]);

  // ── Export: Members Excel ──
  const handleExportMembersExcel = useCallback(() => {
    if (!memberList.length) return;
    const rows = memberList.map((m: any) => ({
      "Name": m.farmer?.alias || "Unknown",
      "Role": m.farmer?.role || "—",
      "Sex": m.farmer?.sex === "M" ? "Male" : m.farmer?.sex === "F" ? "Female" : "—",
      "Email": m.farmer?.email || "—",
      "Phone": m.farmer?.phoneNumber || "—",
      "District": m.farmer?.districtText || "—",
      "Subcounty": m.farmer?.subCountyText || "—",
      "Parish": m.farmer?.parishText || "—",
      "County": m.farmer?.county || "—",
      "Village": m.farmer?.village || "—",
      "Region": m.farmer?.region || "—",
      "Farm Size (Acres)": m.farmer?.farmSizeAcres ?? "—",
      "Supply Chain Role": m.farmer?.supplyChainRole || "—",
      "Status": m.status,
      "Joined": m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Members");
    XLSX.writeFile(wb, "community-members.xlsx");
  }, [memberList]);

  // ── Export: Members PDF ──
  const handleExportMembersPDF = useCallback(() => {
    if (!memberList.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.text("Community Member Report", pw / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Total Members: ${memberList.length} | Exported: ${new Date().toLocaleString()}`, pw / 2, 26, { align: "center" });
    const headers = ["Name", "Role", "Sex", "District", "Subcounty", "Farm Size"];
    const body = memberList.map((m: any) => [
      m.farmer?.alias || "?",
      m.farmer?.role || "—",
      m.farmer?.sex === "M" ? "M" : m.farmer?.sex === "F" ? "F" : "—",
      m.farmer?.districtText || "—",
      m.farmer?.subCountyText || "—",
      m.farmer?.farmSizeAcres != null ? String(m.farmer.farmSizeAcres) : "—",
    ]);
    autoTable(doc, { head: [headers], body, startY: 34, styles: { fontSize: 7 }, headStyles: { fillColor: [46, 125, 50] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
    doc.save("community-members-report.pdf");
  }, [memberList]);

  if (!forms) return <div style={{ padding: "1rem", color: "#999" }}>Loading forms...</div>;

  return (
    <div style={{ padding: "1rem" }}>
      {/* ═══════════ SECTION 1: Community Member Insights ═══════════ */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          onClick={() => setShowMemberInsights(!showMemberInsights)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.75rem" }}
        >
          <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a237e" }}>👥 Community Member Insights</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>{showMemberInsights ? "▼" : "▶"}</span>
        </div>

        {showMemberInsights && (
          <>
            {!memberInsights ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#999" }}>
                {membersRaw === undefined ? "Loading members..." : "No approved members yet."}
              </div>
            ) : (
              <>
                {(() => {
                  const rolePieData = getMobilePieData(memberInsights.roleData, mobilePieTopN);
                  const sexPieData = getMobilePieData(memberInsights.sexData, mobilePieTopN);
                  const districtPieData = getMobilePieData(memberInsights.districtData, mobilePieTopN);
                  return (
                    <>
                {/* KPI Cards */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ flex: "1 1 130px", background: "#e8f5e9", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2e7d32" }}>{memberInsights.totalMemberCount}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Total Members</div>
                  </div>
                  <div style={{ flex: "1 1 130px", background: "#e3f2fd", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1565c0" }}>{memberInsights.distinctDistricts}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Districts</div>
                  </div>
                  <div style={{ flex: "1 1 130px", background: "#fff3e0", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef6c00" }}>{memberInsights.distinctSubcounties}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Subcounties</div>
                  </div>
                  {memberInsights.hasFarmData && (
                    <div style={{ flex: "1 1 130px", background: "#f3e5f5", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#6a1b9a" }}>{memberInsights.totalFarmSize.toLocaleString()}</div>
                      <div style={{ fontSize: "0.78rem", color: "#555" }}>Total Farm Size (Acres)</div>
                    </div>
                  )}
                  <div style={{ flex: "1 1 130px", background: "#fce4ec", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c62828" }}>{memberInsights.roleData.length}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Member Roles</div>
                  </div>
                </div>

                {/* Export buttons */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                  <button onClick={handleExportMembersExcel} style={{ padding: "0.45rem 0.85rem", borderRadius: "6px", border: "1px solid #2e7d32", background: "#e8f5e9", color: "#2e7d32", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>📥 Export Members Excel</button>
                  <button onClick={handleExportMembersPDF} style={{ padding: "0.45rem 0.85rem", borderRadius: "6px", border: "1px solid #6a1b9a", background: "#f3e5f5", color: "#6a1b9a", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>📄 Export Members PDF</button>
                </div>

                {/* Charts grid */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                  {/* Role Distribution (donut) */}
                  <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Distribution of Members by Role</h4>
                    <ResponsiveContainer width="100%" height={isMobile ? 260 : 240}>
                      <PieChart>
                        <Pie
                          data={rolePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 46 : 50}
                          outerRadius={isMobile ? 74 : 80}
                          labelLine={!isMobile}
                          label={isMobile ? false : pieLabel}
                        >
                          {rolePieData.map((d: any, i: number) => <Cell key={i} fill={d.fill || CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend {...pieLegendProps} formatter={(value: any) => compactLabel(value, 12, 20)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ textAlign: "center", marginTop: "-130px", position: "relative", zIndex: 1, pointerEvents: "none" }}>
                      <div style={{ fontSize: "0.7rem", color: "#999" }}>Total</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#333" }}>{memberInsights.totalMemberCount}</div>
                    </div>
                    <div style={{ height: isMobile ? "120px" : "100px" }} />
                  </div>

                  {/* Sex Distribution */}
                  <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Distribution by Sex</h4>
                    <ResponsiveContainer width="100%" height={isMobile ? 260 : 240}>
                      <PieChart>
                        <Pie
                          data={sexPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 46 : 50}
                          outerRadius={isMobile ? 74 : 80}
                          labelLine={!isMobile}
                          label={isMobile ? false : pieLabel}
                        >
                          {sexPieData.map((d: any, i: number) => <Cell key={i} fill={d.fill || ["#1565c0","#c62828","#bdbdbd"][i] || CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend {...pieLegendProps} formatter={(value: any) => compactLabel(value, 12, 20)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* District Distribution (donut) */}
                  <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Distribution of Members by District</h4>
                    <ResponsiveContainer width="100%" height={isMobile ? 260 : 240}>
                      <PieChart>
                        <Pie
                          data={districtPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 46 : 52}
                          outerRadius={isMobile ? 74 : 80}
                          labelLine={!isMobile}
                          label={isMobile ? false : pieLabel}
                        >
                          {districtPieData.map((d: any, i: number) => <Cell key={i} fill={d.fill || CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend {...pieLegendProps} formatter={(value: any) => compactLabel(value, 12, 20)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ textAlign: "center", marginTop: "-130px", position: "relative", zIndex: 1, pointerEvents: "none" }}>
                      <div style={{ fontSize: "0.7rem", color: "#999" }}>Total Members</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#333" }}>{memberInsights.totalMemberCount}</div>
                    </div>
                    <div style={{ height: isMobile ? "120px" : "100px" }} />
                  </div>

                  {/* Members per District & Subcounty (horizontal bar) */}
                  <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Members per District & Subcounty</h4>
                    <ResponsiveContainer width="100%" height={Math.max(isMobile ? 240 : 200, memberInsights.subcountyData.length * (isMobile ? 30 : 26))}>
                      <BarChart data={memberInsights.subcountyData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 10 }} label={{ value: "Number of Members", position: "insideBottom", offset: -2, fontSize: isMobile ? 9 : 10 }} />
                        <YAxis dataKey="name" type="category" width={isMobile ? 84 : 110} tick={{ fontSize: isMobile ? 8 : 9 }} tickFormatter={(value) => compactLabel(value, 10, 18)} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[0,4,4,0]}>
                          {memberInsights.subcountyData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Full-width charts below the grid */}
                {memberInsights.hasFarmData && (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                    {/* Farm Size Histogram */}
                    <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Distribution of Farm Size (Acres)</h4>
                      <ResponsiveContainer width="100%" height={isMobile ? 250 : 220}>
                        <BarChart data={memberInsights.histData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 18)} />
                          <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} label={{ value: "Number of Members", angle: -90, position: "insideLeft", fontSize: isMobile ? 9 : 10 }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" fill="#8e24aa" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Avg Farm Size per District */}
                    <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Average Farm Size (Acres) per District</h4>
                      <ResponsiveContainer width="100%" height={isMobile ? 250 : 220}>
                        <BarChart data={memberInsights.avgFarmData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 18)} />
                          <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} label={{ value: "Avg Acres", angle: -90, position: "insideLeft", fontSize: isMobile ? 9 : 10 }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" radius={[4,4,0,0]}>
                            {memberInsights.avgFarmData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Region & Supply Chain Role charts (only if data exists) */}
                {(memberInsights.regionData.length > 0 || memberInsights.scRoleData.length > 0) && (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                    {memberInsights.regionData.length > 0 && (
                      <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Members by Region</h4>
                        <ResponsiveContainer width="100%" height={isMobile ? 250 : 220}>
                          <BarChart data={memberInsights.regionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 18)} />
                            <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="value" fill="#00838f" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {memberInsights.scRoleData.length > 0 && (
                      <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Members by Supply Chain Role</h4>
                        <ResponsiveContainer width="100%" height={isMobile ? 250 : 220}>
                          <BarChart data={memberInsights.scRoleData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 18)} />
                            <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="value" fill="#6d4c41" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>

      {/* ═══════════ DIVIDER ═══════════ */}
      <hr style={{ border: "none", borderTop: "2px solid #e0e0e0", margin: "1.5rem 0" }} />

      {/* ═══════════ SECTION 2: Form Response Insights ═══════════ */}
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a237e", marginBottom: "0.75rem" }}>📋 Form Response Insights</h3>

      {forms.length === 0 && (
        <div style={{ padding: "1rem", color: "#999" }}>No forms created yet. Go to the Forms tab to create one.</div>
      )}

      {forms.length > 0 && (
        <>
          {/* Form selector */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#333", display: "block", marginBottom: "0.35rem" }}>Select Form</label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #ccc", fontSize: "0.9rem" }}
            >
              <option value="">— Choose a form —</option>
              {trackerForms.length > 0 && (
                <optgroup label="📊 Tracker Forms">
                  {trackerForms.map((f: any) => <option key={f._id} value={f._id}>{f.name} ({f.responseCount ?? 0} responses)</option>)}
                </optgroup>
              )}
              {profileForms.length > 0 && (
                <optgroup label="👤 Profile Forms">
                  {profileForms.map((f: any) => <option key={f._id} value={f._id}>{f.name} ({f.responseCount ?? 0} responses)</option>)}
                </optgroup>
              )}
              {extensionWorkForms.length > 0 && (
                <optgroup label="💳 Extension Work Forms">
                  {extensionWorkForms.map((f: any) => <option key={f._id} value={f._id}>{f.name} ({f.responseCount ?? 0} responses)</option>)}
                </optgroup>
              )}
            </select>
          </div>

          {!selectedFormId && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>Select a form above to view insights.</div>
          )}

          {selectedFormId && formResponses === undefined && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>Loading responses...</div>
          )}

          {selectedFormId && formResponses && (
            <>
              {/* Summary banner */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ flex: "1 1 140px", background: "#e8f5e9", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2e7d32" }}>{responses.length}</div>
                  <div style={{ fontSize: "0.78rem", color: "#555" }}>Responses</div>
                </div>
                <div style={{ flex: "1 1 140px", background: "#e3f2fd", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1565c0" }}>{fields.length}</div>
                  <div style={{ fontSize: "0.78rem", color: "#555" }}>Fields</div>
                </div>
                {isProfile && (
                  <div style={{ flex: "1 1 140px", background: "#fff3e0", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef6c00" }}>{responses.length} / {totalMembers}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Members Filled</div>
                  </div>
                )}
                {responses.length > 0 && (
                  <div style={{ flex: "1 1 140px", background: "#f3e5f5", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6a1b9a" }}>{new Date(responses[0].createdAt).toLocaleDateString()}</div>
                    <div style={{ fontSize: "0.78rem", color: "#555" }}>Latest Response</div>
                  </div>
                )}
              </div>

              {/* Export buttons */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                <button onClick={handleExportExcel} style={{ padding: "0.45rem 0.85rem", borderRadius: "6px", border: "1px solid #2e7d32", background: "#e8f5e9", color: "#2e7d32", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>📥 Excel</button>
                <button onClick={handleExportPNG} style={{ padding: "0.45rem 0.85rem", borderRadius: "6px", border: "1px solid #1565c0", background: "#e3f2fd", color: "#1565c0", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>🖼 PNG Charts</button>
                <button onClick={handleExportPDF} style={{ padding: "0.45rem 0.85rem", borderRadius: "6px", border: "1px solid #6a1b9a", background: "#f3e5f5", color: "#6a1b9a", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>📄 PDF Report</button>
              </div>

              {/* Per-field charts */}
              {responses.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>No responses yet for this form.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {fieldAggregations.map((agg: any, idx: number) => (
                    <div key={agg.field._id} style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem", overflow: "hidden" }}>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>
                        {agg.field.label}
                        <span style={{ fontWeight: 400, color: "#999", fontSize: "0.78rem", marginLeft: "0.5rem" }}>{agg.field.fieldType} · {agg.count} values</span>
                      </h4>
                      <div ref={(el) => { chartRefs.current[idx] = el; }}>
                        {agg.type === "number" && (
                          <>
                            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", fontSize: "0.8rem", color: "#555" }}>
                              <span>Avg: <strong>{agg.avg}</strong></span>
                              <span>Min: <strong>{agg.min}</strong></span>
                              <span>Max: <strong>{agg.max}</strong></span>
                            </div>
                            <ResponsiveContainer width="100%" height={Math.max(isMobile ? 230 : 200, agg.barData.length * (isMobile ? 24 : 20))}>
                              <BarChart data={agg.barData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 16)} />
                                <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" fill="#2e7d32" radius={[4,4,0,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        )}
                        {agg.type === "pie" && (
                          (() => {
                            const aggPieData = getMobilePieData(agg.pieData, mobilePieTopN);
                            return (
                          <ResponsiveContainer width="100%" height={isMobile ? 260 : 220}>
                            <PieChart>
                              <Pie
                                data={aggPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={isMobile ? 74 : 80}
                                labelLine={!isMobile}
                                label={isMobile ? false : pieLabel}
                              >
                                {aggPieData.map((d: any, i: number) => <Cell key={i} fill={d.fill || CHART_COLORS[i % CHART_COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                              <Legend {...pieLegendProps} formatter={(value: any) => compactLabel(value, 12, 20)} />
                            </PieChart>
                          </ResponsiveContainer>
                            );
                          })()
                        )}
                        {agg.type === "date" && (
                          <ResponsiveContainer width="100%" height={Math.max(isMobile ? 230 : 200, agg.barData.length * (isMobile ? 22 : 18))}>
                            <BarChart data={agg.barData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={xAxisTickProps} interval={0} height={xAxisHeight} tickFormatter={(value) => compactLabel(value, 10, 16)} />
                              <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" fill="#1565c0" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        {agg.type === "text" && agg.barData.length > 0 && (
                          <ResponsiveContainer width="100%" height={Math.max(isMobile ? 200 : 150, agg.barData.length * (isMobile ? 32 : 28))}>
                            <BarChart data={agg.barData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 10 }} />
                              <YAxis dataKey="name" type="category" width={isMobile ? 92 : 120} tick={{ fontSize: isMobile ? 9 : 10 }} tickFormatter={(value) => compactLabel(value, 10, 20)} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" fill="#ef6c00" radius={[0,4,4,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        {agg.type === "camera" && (
                          <div style={{ padding: "0.75rem", background: "#e3f2fd", borderRadius: "6px", fontSize: "0.85rem", color: "#1565c0" }}>📸 {agg.count} photo(s) captured</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function CommunityDashboardPage() {
  const FIXED_PAGE_SIZE = 20;
  const convex = useConvex();
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userAdminCategory, setUserAdminCategory] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Resolve community logo using shared helper (DB → known-name fallback)
  const getCommunityLogo = (community: any) => resolveCommunityLogo(community);
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<"communityApplications"> | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : true);
  const [exportCommunityId, setExportCommunityId] = useState<Id<"communities"> | null>(null);
  const [exportCommunityName, setExportCommunityName] = useState<string>("");

  // Filter state
  const [filterType, setFilterType] = useState<"all" | "phone" | "email" | "location">( "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "district" | "subcounty" | "parish">("all");

  // Get current user
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUserId(parsed.userId);
          setUserRole(parsed.role || "");
          setUserAdminCategory(parsed.adminCategory || "");
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const currentUser = useQuery(
    api.auth.getUser,
    userId ? { userId } : "skip"
  );

  const resolvedRole = currentUser?.role ?? userRole;
  const resolvedAdminCategory =
    (currentUser as any)?.adminCategory ?? userAdminCategory;

  // Query communities (filtered to show only the user's community if they're a community admin)
  const communities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  // Query export quota
  const exportQuota = useQuery(api.communities.getExportQuota, userId ? { userId } : "skip");

  // Mutation for logging exports
  const logExport = useMutation(api.communities.logExport);
  const approveApplication = useMutation(api.communityApplications.approveApplication);
  const rejectApplication = useMutation(api.communityApplications.rejectApplication);
  const revokeMembership = useMutation(api.communityApplications.revokeMembership);

  // Community imports mutations
  const importCommunityMembersFromExcel = useMutation(api.communityImports.importCommunityMembersFromExcel);
  const activateImportedCommunityMember = useMutation(api.communityImports.activateImportedCommunityMember);
  const toggleCommunityMemberCountVisibility = useMutation(api.communities.toggleCommunityMemberCountVisibility);
  const toggleCommunityFertilizerPlannerVisibility = useMutation(api.communities.toggleCommunityFertilizerPlannerVisibility);
  const [togglingMemberCountByCommunity, setTogglingMemberCountByCommunity] = useState<Record<string, boolean>>({});

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(FIXED_PAGE_SIZE);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedPageSize, setApprovedPageSize] = useState(FIXED_PAGE_SIZE);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(FIXED_PAGE_SIZE);
  const [importedMembersPage, setImportedMembersPage] = useState(1);
  const [importedMembersPageSize, setImportedMembersPageSize] = useState(FIXED_PAGE_SIZE);
  const [selectedFarmseeMember, setSelectedFarmseeMember] = useState<{
    communityId: Id<"communities">;
    memberId: Id<"users">;
    alias: string;
  } | null>(null);
  const [expandedFarmseeEntryId, setExpandedFarmseeEntryId] = useState<string | null>(null);
  const [farmseeSelectedEntryIds, setFarmseeSelectedEntryIds] = useState<Set<string>>(new Set());
  const [farmseeBatchExporting, setFarmseeBatchExporting] = useState(false);
  const [farmseeAllExporting, setFarmseeAllExporting] = useState(false);
  const [farmseeSingleExportingId, setFarmseeSingleExportingId] = useState<string | null>(null);
  const [activeFarmseeSearchByCommunity, setActiveFarmseeSearchByCommunity] = useState<Record<string, string>>({});

  // Tab state per community
  const [activeTabs, setActiveTabs] = useState<Record<string, CommunityTab>>({});
  const getActiveTab = (cId: string): CommunityTab => activeTabs[cId] || "members";
  const setActiveTab = (cId: string, tab: CommunityTab) =>
    setActiveTabs((prev) => ({ ...prev, [cId]: tab }));
  const [membersListTabs, setMembersListTabs] = useState<Record<string, MembersListTab>>({});
  const getMembersListTab = (cId: string): MembersListTab => membersListTabs[cId] || "approved";
  const setMembersListTab = (cId: string, tab: MembersListTab) =>
    setMembersListTabs((prev) => ({ ...prev, [cId]: tab }));
  const getActiveFarmseeSearch = (cId: string) => activeFarmseeSearchByCommunity[cId] || "";
  const setActiveFarmseeSearch = (cId: string, value: string) =>
    setActiveFarmseeSearchByCommunity((prev) => ({ ...prev, [cId]: value }));

  // Upload state for community imports
  const [uploadStateByComm, setUploadStateByComm] = useState<Record<string, {
    file: File | null;
    isUploading: boolean;
    parsedRows: any[];
    showPreview: boolean;
    importResults: { imported: number; failed: number; results: any[]; errors: any[] } | null;
  }>>({});

  const getUploadState = (cId: string) => uploadStateByComm[cId] || {
    file: null,
    isUploading: false,
    parsedRows: [],
    showPreview: false,
    importResults: null,
  };

  const setUploadState = (cId: string, updates: Partial<typeof uploadStateByComm[string]>) => {
    setUploadStateByComm((prev) => ({
      ...prev,
      [cId]: { ...getUploadState(cId), ...updates },
    }));
  };

  useEffect(() => {
    if (pendingPageSize !== FIXED_PAGE_SIZE) {
      setPendingPageSize(FIXED_PAGE_SIZE);
      setPendingPage(1);
    }
    if (approvedPageSize !== FIXED_PAGE_SIZE) {
      setApprovedPageSize(FIXED_PAGE_SIZE);
      setApprovedPage(1);
    }
    if (membersPageSize !== FIXED_PAGE_SIZE) {
      setMembersPageSize(FIXED_PAGE_SIZE);
      setMembersPage(1);
    }
    if (importedMembersPageSize !== FIXED_PAGE_SIZE) {
      setImportedMembersPageSize(FIXED_PAGE_SIZE);
      setImportedMembersPage(1);
    }
  }, [pendingPageSize, approvedPageSize, membersPageSize, importedMembersPageSize, FIXED_PAGE_SIZE]);

  const selectedApplicationDetails = useQuery(
    api.communityApplications.getApplicationDetails,
    userId && selectedApplicationId
      ? { adminId: userId, applicationId: selectedApplicationId }
      : "skip"
  );

  // For community admin: get their managed community
  const userCommunities = useMemo(() => {
    if (!communities || !Array.isArray(communities)) return [];
    // Backend already enforces community-admin access. Use the returned list.
    return communities;
  }, [communities]);

  const communityIds = useMemo(
    () => userCommunities.map((c: any) => c._id ?? c.id).filter(Boolean),
    [userCommunities]
  );
  const applicationsByCommunity = useQuery(
    api.communityApplications.getApplicationsByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
          status: "PENDING",
        }
      : "skip"
  );
  const approvedMembersByCommunity = useQuery(
    api.communityApplications.getCommunityMembersByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
          status: "APPROVED",
        }
      : "skip"
  );

  // Query to get imported community members
  const getImportedCommunityMembers = useQuery(
    api.communityImports.getImportedCommunityMembersByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
        }
      : "skip"
  );
  const activeFarmseeByCommunity = useQuery(
    (api as any).farmToolbox.getBioFarmActiveFarmseeMembersByCommunityIds,
    userId && communityIds.length > 0
      ? {
          adminId: userId,
          communityIds,
        }
      : "skip"
  );
  const selectedFarmseeEntries = useQuery(
    (api as any).farmToolbox.getBioFarmMemberEntriesForAdmin,
    userId && selectedFarmseeMember
      ? {
          adminId: userId,
          communityId: selectedFarmseeMember.communityId,
          memberId: selectedFarmseeMember.memberId,
        }
      : "skip"
  );

  const exportMembersData = useQuery(
    api.communityApplications.getCommunityMemberExportData,
    userId && exportCommunityId
      ? {
          adminId: userId,
          communityId: exportCommunityId,
          status: "APPROVED",
        }
      : "skip"
  );

  // ✅ OPTION A: Conservative Export - Profile Only + Metadata
  // Excludes all nested form fields to prevent data leaks across communities
  // Ensures clean, auditable row/column counts for future billing
  const buildExportRows = useCallback((items: any[]) => {
    return items.map((item: any) => {
      const farmer = item.farmer || {};
      const application = item.application || {};

      // ✅ SECURITY: Only export application metadata (no form fields)
      const applicationMetadata = {
        "Application Id": application?._id || "",
        "Application Status": item.status || application?.status || "",
        "Application Created": application?.createdAt
          ? new Date(application.createdAt).toLocaleString()
          : "",
        "Application Updated": application?.updatedAt
          ? new Date(application.updatedAt).toLocaleString()
          : "",
        "Member Since": item.joinedAt ? new Date(item.joinedAt).toLocaleString() : "",
      };

      // ✅ SECURITY: Only export profile onboarding fields from farmer record
      // These are the standard fields every farmer fills during registration
      // No community-specific form fields are included
      const profileOnboarding = {
        "Member Name": farmer.alias || "",
        "Signup Role": farmer.role || item.role || "",
        "Community Role": item.communityRole || "",
        "Email": farmer.email || "",
        "Phone": farmer.phoneNumber || "",
        "Region": farmer.region || "",
        "District": farmer.districtText || "",
        "Subcounty": farmer.subCountyText || "",
        "Parish": farmer.parishText || "",
        "County": farmer.county || "",
        "Village": farmer.village || "",
        "Farm Size (Acres)": farmer.farmSizeAcres ?? "",
        "Water Source": farmer.waterSource || "",
      };

      // Combine: metadata first, then profile fields
      // Clean, flat structure - easy to audit for billing
      return {
        ...applicationMetadata,
        ...profileOnboarding,
      };
    });
  }, []);

  const handleExportMembers = (communityId: Id<"communities">, communityName: string) => {
    if (!userId) return;
    setLoading(true);
    setMessage(null);
    setExportCommunityId(communityId);
    setExportCommunityName(communityName);
  };

  useEffect(() => {
    if (!exportCommunityId) return;
    if (exportMembersData === undefined) return;

    if ((exportMembersData as any)?.error) {
      setMessage({ type: "error", text: (exportMembersData as any).error });
      setLoading(false);
      setExportCommunityId(null);
      return;
    }

    if (!Array.isArray(exportMembersData)) return;

    const rows = buildExportRows(exportMembersData);

    try {
      logExport({
        userId: userId as any,
        exportType: "community_members",
        dataCount: rows.length,
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Members");
      const safeName = exportCommunityName || "community";
      XLSX.writeFile(wb, `${safeName}-members-full.xlsx`);
      setMessage({ type: "success", text: "Members exported successfully!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to export members" });
    } finally {
      setLoading(false);
      setExportCommunityId(null);
      setExportCommunityName("");
    }
  }, [exportMembersData, exportCommunityId, exportCommunityName, logExport, userId, buildExportRows]);

  const handleToggleMemberCountVisibility = async (communityId: Id<"communities">, nextValue: boolean) => {
    if (!userId) return;

    setTogglingMemberCountByCommunity((prev) => ({
      ...prev,
      [String(communityId)]: true,
    }));
    setMessage(null);

    try {
      await toggleCommunityMemberCountVisibility({
        adminId: userId,
        communityId,
        showMemberCount: nextValue,
      });
      setMessage({
        type: "success",
        text: nextValue
          ? "Member count is now visible to users in this community"
          : "Member count is now hidden from users in this community",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to update member count visibility",
      });
    } finally {
      setTogglingMemberCountByCommunity((prev) => ({
        ...prev,
        [String(communityId)]: false,
      }));
    }
  };

  const handleToggleFertilizerPlannerVisibility = async (communityId: Id<"communities">, nextValue: boolean) => {
    if (!userId) return;

    setTogglingMemberCountByCommunity((prev) => ({
      ...prev,
      [String(communityId)]: true,
    }));
    setMessage(null);

    try {
      await toggleCommunityFertilizerPlannerVisibility({
        adminId: userId,
        communityId,
        showFertilizerPlanner: nextValue,
      });
      setMessage({
        type: "success",
        text: nextValue
          ? "Fertilizer planner is now visible to users in this community"
          : "Fertilizer planner is now hidden from users in this community",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to update fertilizer planner visibility",
      });
    } finally {
      setTogglingMemberCountByCommunity((prev) => ({
        ...prev,
        [String(communityId)]: false,
      }));
    }
  };

  const handleFarmseeSingleExport = async (submissionId: Id<"farmTrackerEntries">) => {
    if (!userId || !selectedFarmseeMember) return;
    setFarmseeSingleExportingId(String(submissionId));
    try {
      const rows = await convex.query((api as any).farmToolbox.getBioFarmMemberEntriesForExport, {
        adminId: userId,
        communityId: selectedFarmseeMember.communityId,
        memberId: selectedFarmseeMember.memberId,
        submissionIds: [submissionId],
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportSubmissionsToPDF(
        rows || [],
        `biofarm-${selectedFarmseeMember.alias || "member"}-entry-${datePart}`,
        selectedFarmseeMember.alias
      );
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to export entry PDF" });
    }
    setFarmseeSingleExportingId(null);
  };

  const handleFarmseeBatchExport = async () => {
    if (!userId || !selectedFarmseeMember) return;
    if (farmseeSelectedEntryIds.size === 0) return;
    setFarmseeBatchExporting(true);
    try {
      const rows = await convex.query((api as any).farmToolbox.getBioFarmMemberEntriesForExport, {
        adminId: userId,
        communityId: selectedFarmseeMember.communityId,
        memberId: selectedFarmseeMember.memberId,
        submissionIds: Array.from(farmseeSelectedEntryIds) as Id<"farmTrackerEntries">[],
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportSubmissionsToPDF(
        rows || [],
        `biofarm-${selectedFarmseeMember.alias || "member"}-entries-${datePart}`,
        selectedFarmseeMember.alias
      );
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to export selected entries" });
    }
    setFarmseeBatchExporting(false);
  };

  const handleFarmseeAllExport = async () => {
    if (!userId || !selectedFarmseeMember) return;
    setFarmseeAllExporting(true);
    try {
      const rows = await convex.query((api as any).farmToolbox.getBioFarmMemberEntriesForExport, {
        adminId: userId,
        communityId: selectedFarmseeMember.communityId,
        memberId: selectedFarmseeMember.memberId,
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportSubmissionsToPDF(
        rows || [],
        `biofarm-${selectedFarmseeMember.alias || "member"}-all-entries-${datePart}`,
        selectedFarmseeMember.alias
      );
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to export all entries" });
    }
    setFarmseeAllExporting(false);
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Only community admins can access this page
  if (resolvedRole !== "admin") {
    return (
      <div style={{
        padding: "2rem",
        textAlign: "center",
        color: "#c62828",
        background: "#ffebee",
        borderRadius: "8px",
        marginTop: "2rem",
        marginBottom: "2rem",
      }}>
        <h2>Access Denied</h2>
        <p>Only admins can access this page.</p>
        <Link href="/" style={{
          color: "#1976d2",
          textDecoration: "none",
        }}>
          Go back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "clamp(0.75rem, 3vw, 2rem)",
        backgroundImage: "url('/background/farm-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          padding: isMobile ? "1.25rem" : "2rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "0.75rem" : "0",
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "1rem",
                boxShadow: "0 4px 10px rgba(15,23,42,0.4)",
              }}
            >
              <span style={{ fontSize: "1rem" }}>←</span>
              <span>Back</span>
            </Link>
            <h1 style={{
              fontSize: "clamp(1.8rem, 5vw, 2.2rem)",
              marginTop: "0.5rem",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em",
            }}>
              Community Dashboard
            </h1>
          </div>
          <Link href="/admin/change-password" style={{
            padding: "0.75rem 1.5rem",
            background: "#ff9800",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: "600",
            whiteSpace: "nowrap",
          }}>
            Change Password
          </Link>
        </div>

        {/* Message Alert */}
        {message && (
          <div style={{
            padding: "1rem",
            marginBottom: "2rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            border: `1px solid ${message.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
          }}>
            {message.text}
          </div>
        )}
        {applicationsByCommunity?.some((c: any) => c.error) && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
          }}>
            {applicationsByCommunity.find((c: any) => c.error)?.error}
          </div>
        )}
        {approvedMembersByCommunity?.some((c: any) => c.error) && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
          }}>
            {approvedMembersByCommunity.find((c: any) => c.error)?.error}
          </div>
        )}

        {/* Communities */}
        {communities === undefined ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            <p>Loading communities...</p>
          </div>
        ) : userCommunities.length === 0 ? (
          <div style={{
            background: "#fff",
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}>
            <p style={{ color: "#999" }}>No communities found.</p>
          </div>
        ) : (
          userCommunities.map((community: any) => {
            const communityId = community?._id ?? community?.id;
            return (
              <div
                key={communityId}
                style={{
                  background: `linear-gradient(rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.96))${getCommunityLogo(community) ? `, url('${getCommunityLogo(community)}')` : ''}`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  marginBottom: "2rem",
                  overflow: "hidden",
                }}
              >
                {/* Community Header */}
                <div
                  style={{
                    padding: "1.5rem",
                    background: "linear-gradient(135deg, #f5f5f5 0%, #e8f5e9 100%)",
                    borderBottom: "2px solid #e0e0e0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.25rem",
                      marginBottom: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "16px",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
                        overflow: "hidden",
                      }}
                    >
                      {getCommunityLogo(community) ? (
                      <img
                        src={getCommunityLogo(community)}
                        alt={`${community.name} logo`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                      ) : (
                        <span style={{ fontSize: "2rem", fontWeight: 800, color: "#999" }}>
                          {community.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2
                        style={{
                          margin: "0 0 0.4rem 0",
                          fontSize: "1.6rem",
                          fontFamily: '"Montserrat", sans-serif',
                          fontWeight: 800,
                          color: "#1b5e20",
                          letterSpacing: "-0.03em",
                          textTransform: "uppercase",
                        }}
                      >
                        {community.name}
                      </h2>
                      {community.description && (
                        <p
                          style={{
                            margin: 0,
                            color: "#374151",
                            fontSize: "0.95rem",
                            maxWidth: "32rem",
                          }}
                        >
                          {community.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      gap: "1.5rem",
                      fontSize: "0.9rem",
                      color: "#424242",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>Members:</strong> {community.memberCount}
                    </div>
                    {/* Role Breakdown Badges */}
                    {community.roleBreakdown && Object.entries(community.roleBreakdown as Record<string, number>).map(([role, count]: [string, number]) => {
                      const roleColors: Record<string, { bg: string; text: string }> = {
                        farmer: { bg: "#e8f5e9", text: "#2e7d32" },
                        trader: { bg: "#e3f2fd", text: "#1565c0" },
                        buyer: { bg: "#f3e5f5", text: "#6a1b9a" },
                        vendor: { bg: "#fff3e0", text: "#e65100" },
                        transporter: { bg: "#e1f5fe", text: "#0277bd" },
                        store: { bg: "#ffebee", text: "#c62828" },
                        admin: { bg: "#eceff1", text: "#37474f" },
                      };
                      const c = roleColors[role] || { bg: "#f5f5f5", text: "#616161" };
                      return (
                        <div key={role} style={{
                          padding: "0.2rem 0.6rem",
                          borderRadius: 999,
                          background: c.bg,
                          color: c.text,
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          textTransform: "capitalize",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          <span>{role === "farmer" ? "🌾" : role === "trader" ? "📊" : role === "buyer" ? "🛒" : role === "vendor" ? "🏪" : role === "transporter" ? "🚛" : role === "store" ? "🏬" : "👤"}</span>
                          {role}: {count}
                        </div>
                      );
                    })}
                    {community.isGlobal && (
                      <div
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background: "#e3f2fd",
                          color: "#1565c0",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        Global Community
                      </div>
                    )}
                    {community.geoLocked && (
                      <div
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background: "#fff3e0",
                          color: "#ef6c00",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        Geo-locked
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.85rem",
                        color: "#374151",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={community.showMemberCount !== false}
                        disabled={!!togglingMemberCountByCommunity[String(communityId)]}
                        onChange={(e) => {
                          handleToggleMemberCountVisibility(communityId as Id<"communities">, e.target.checked);
                        }}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                        {communityId === BIOFARM_COMMUNITY_ID && (
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.85rem",
                              color: "#374151",
                              fontWeight: 600,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={community.showFertilizerPlanner === true}
                              disabled={!!togglingMemberCountByCommunity[String(communityId)]}
                              onChange={(e) => {
                                handleToggleFertilizerPlannerVisibility(communityId as Id<"communities">, e.target.checked);
                              }}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            Show fertilizer planner to users
                          </label>
                        )}
                      Show member count to users
                    </label>
                    {togglingMemberCountByCommunity[String(communityId)] && (
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>Saving...</span>
                    )}
                  </div>
                  {/* QR Code Button */}
                  <div style={{ marginTop: "0.75rem" }}>
                    <CommunityQRCode
                      communityId={communityId}
                      mode="button"
                      buttonLabel="QR Code"
                    />
                  </div>
                </div>

              {/* ── Tab Bar ── */}
              <div style={{
                display: "flex",
                overflowX: isMobile ? "auto" : "visible",
                WebkitOverflowScrolling: isMobile ? "touch" : undefined,
                borderBottom: "2px solid #e0e0e0",
                background: "#fafafa",
                paddingBottom: isMobile ? "0.15rem" : 0,
              }}>
                {((
                  (currentUser as any)?.adminLevel === "super" ||
                  (currentUser as any)?.adminLevel === undefined ||
                  resolvedAdminCategory === "community"
                    ? ["members", "noticeboard", "messages", "forms", "insights", "fertilizer"]
                    : ["members", "noticeboard", "messages", "forms", "insights"]
                ) as CommunityTab[]).map((tab) => {
                  const active = getActiveTab(communityId) === tab;
                  const labels: Record<CommunityTab, string> = { members: "Members", noticeboard: "Noticeboard", messages: "Messages", forms: "Forms", insights: "📊 Insights", fertilizer: "🌱 Fertilizer" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(communityId, tab)}
                      style={{
                        flex: isMobile ? "0 0 auto" : 1,
                        minWidth: isMobile ? "8.5rem" : 0,
                        padding: "0.75rem 0.5rem",
                        whiteSpace: "nowrap",
                        border: "none",
                        borderBottom: active ? "3px solid #2e7d32" : "3px solid transparent",
                        background: active ? "#fff" : "transparent",
                        color: active ? "#2e7d32" : "#666",
                        fontWeight: active ? 700 : 500,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        fontFamily: '"Montserrat", sans-serif',
                      }}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* ── Noticeboard Tab ── */}
              {getActiveTab(communityId) === "noticeboard" && (
                <NoticeboardTab communityId={communityId} userId={userId!} />
              )}

              {/* ── Messages Tab ── */}
              {getActiveTab(communityId) === "messages" && (
                <MessagesTab communityId={communityId} userId={userId!} />
              )}

              {/* ── Forms & Templates Tab ── */}
              {getActiveTab(communityId) === "forms" && (
                <FormsTab communityId={communityId} userId={userId!} />
              )}

              {/* ── Insights Tab ── */}
              {getActiveTab(communityId) === "insights" && (
                <InsightsTab communityId={communityId} userId={userId!} />
              )}

              {/* ── Fertilizer Tab ── */}
              {getActiveTab(communityId) === "fertilizer" && (
                <AdminFertilizerConfig communityId={communityId} userId={userId!} />
              )}

              {/* ── Members Tab (existing content) ── */}
              {getActiveTab(communityId) === "members" && (<>

              {/* Import Members From Excel */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #eee", background: "#fafafa" }}>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.05rem",
                  fontWeight: "600",
                  color: "#2c2c2c",
                }}>
                  📥 Import Members from Excel
                </h3>
                
                {/* File Upload Input */}
                <div style={{
                  marginBottom: "1rem",
                  padding: "0.5rem",
                  background: "#fff",
                  borderRadius: "8px",
                  border: "1px dashed #2e7d32",
                  textAlign: "center",
                  cursor: "pointer",
                }}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadState(communityId as string, { file });
                        // Auto-parse file
                        const reader = new FileReader();
                        reader.onload = (event: any) => {
                          try {
                            const data = event.target.result;
                            const workbook = XLSX.read(data, { type: "array" });
                            const firstSheet = workbook.SheetNames[0];
                            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                            setUploadState(communityId as string, { parsedRows: rows, showPreview: true });
                          } catch (err: any) {
                            setMessage({ type: "error", text: "Failed to parse Excel file: " + err?.message });
                          }
                        };
                        reader.readAsArrayBuffer(file);
                      }
                    }}
                    style={{ display: "none" }}
                    id={`file-input-${communityId}`}
                  />
                  <label
                    htmlFor={`file-input-${communityId}`}
                    style={{
                      display: "block",
                      padding: "0.5rem 0.25rem",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#2e7d32", marginBottom: "0.25rem" }}>
                      Click to upload or drag & drop
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "#666" }}>
                      Excel files (.xlsx, .xls) with required columns: fullName, phoneNumber. Optional: email, communityRole, notes, and any other fields.
                    </div>
                  </label>
                  {(() => {
                    const selectedFile = getUploadState(communityId as string).file;
                    if (!selectedFile) return null;
                    return (
                      <div style={{ marginTop: "0.45rem", fontSize: "0.68rem", color: "#2e7d32", fontWeight: 600 }}>
                        ✓ {selectedFile.name}
                      </div>
                    );
                  })()}
                </div>

                {/* Preview Table */}
                {getUploadState(communityId as string).showPreview && getUploadState(communityId as string).parsedRows.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: 600, color: "#333" }}>
                      Preview ({getUploadState(communityId as string).parsedRows.length} rows)
                    </h4>
                    <div style={{ overflowX: "auto", marginBottom: "0.75rem" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ textAlign: "left", background: "#e8f5e9", borderBottom: "1px solid #81c784" }}>
                            <th style={{ padding: "0.5rem" }}>Full Name</th>
                            <th style={{ padding: "0.5rem" }}>Phone</th>
                            <th style={{ padding: "0.5rem" }}>Email</th>
                            <th style={{ padding: "0.5rem" }}>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getUploadState(communityId as string).parsedRows.slice(0, 5).map((row: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.5rem" }}>{row.fullName || "-"}</td>
                              <td style={{ padding: "0.5rem" }}>{row.phoneNumber || "-"}</td>
                              <td style={{ padding: "0.5rem" }}>{row.email || "-"}</td>
                              <td style={{ padding: "0.5rem" }}>{row.communityRole || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {getUploadState(communityId as string).parsedRows.length > 5 && (
                      <div style={{ fontSize: "0.85rem", color: "#999", marginBottom: "0.75rem" }}>
                        ... and {getUploadState(communityId as string).parsedRows.length - 5} more rows
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        onClick={async () => {
                          if (!getUploadState(communityId as string).parsedRows.length) {
                            setMessage({ type: "error", text: "No rows to import" });
                            return;
                          }
                          setUploadState(communityId as string, { isUploading: true });
                          try {
                            const result = await importCommunityMembersFromExcel({
                              adminId: userId as any,
                              communityId: communityId as any,
                              rows: getUploadState(communityId as string).parsedRows,
                            });
                            setUploadState(communityId as string, {
                              importResults: result as any,
                              isUploading: false,
                              file: null,
                              parsedRows: [],
                              showPreview: false,
                            });
                            setMessage({ type: "success", text: `Imported ${(result as any).imported ?? 0} members successfully` });
                          } catch (error: any) {
                            setUploadState(communityId as string, { isUploading: false });
                            setMessage({ type: "error", text: error?.message || "Import failed" });
                          }
                        }}
                        disabled={getUploadState(communityId as string).isUploading}
                        style={{
                          padding: "0.6rem 1.25rem",
                          background: getUploadState(communityId as string).isUploading ? "#bbb" : "#2e7d32",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: getUploadState(communityId as string).isUploading ? "not-allowed" : "pointer",
                          minHeight: "44px",
                        }}
                      >
                        {getUploadState(communityId as string).isUploading ? "Importing..." : "Import Members"}
                      </button>
                      <button
                        onClick={() => {
                          setUploadState(communityId as string, { showPreview: false, parsedRows: [], file: null });
                        }}
                        style={{
                          padding: "0.6rem 1.25rem",
                          background: "#f0f0f0",
                          color: "#333",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: "pointer",
                          minHeight: "44px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Import Results */}
                {getUploadState(communityId as string).importResults && (
                  <div style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    background: "#e8f5e9",
                    border: "1px solid #81c784",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                  }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#2e7d32" }}>
                      ✓ Import Complete
                    </h4>
                    <div style={{ color: "#333", marginBottom: "0.5rem" }}>
                      <strong>{getUploadState(communityId as string).importResults!.imported}</strong> members imported successfully
                    </div>
                    {getUploadState(communityId as string).importResults!.errors.length > 0 && (
                      <div style={{ color: "#c62828", marginTop: "0.5rem" }}>
                        <strong>{getUploadState(communityId as string).importResults!.errors.length}</strong> errors encountered
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pending Applications */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #eee" }}>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.05rem",
                  fontWeight: "600",
                  color: "#2c2c2c",
                }}>
                  Pending Applications
                </h3>
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page: {FIXED_PAGE_SIZE}</span>
                </div>
                {applicationsByCommunity === undefined ? (
                  <p style={{ color: "#999" }}>Loading applications...</p>
                ) : (
                  (() => {
                    const pending =
                      applicationsByCommunity?.find((c: any) => c.communityId === communityId)?.applications || [];
                    const pendingTotal = pending.length;
                    const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / pendingPageSize));
                    const safePendingPage = Math.min(pendingPage, pendingTotalPages);
                    const pendingStart = pendingTotal === 0 ? 0 : (safePendingPage - 1) * pendingPageSize + 1;
                    const pendingEnd = Math.min(safePendingPage * pendingPageSize, pendingTotal);
                    const pagedPending = pending.slice(
                      (safePendingPage - 1) * pendingPageSize,
                      safePendingPage * pendingPageSize
                    );
                    if (pending.length === 0) {
                      return <p style={{ color: "#999" }}>No pending applications.</p>;
                    }
                    return (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                          <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "0.5rem" }}>Name</th>
                              <th style={{ padding: "0.5rem" }}>Farm Name</th>
                              <th style={{ padding: "0.5rem" }}>Phone</th>
                              <th style={{ padding: "0.5rem" }}>District</th>
                              <th style={{ padding: "0.5rem" }}>Submitted</th>
                              <th style={{ padding: "0.5rem" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedPending.map((app: any) => (
                              <tr key={app.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.farmerFullName || app.farmer?.alias || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.farmName || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.phoneNumber || app.farmer?.phoneNumber || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.form?.section1?.districtSubCounty || app.farmer?.districtText || "-"}</td>
                                <td style={{ padding: "0.5rem" }}>{app.createdAt ? new Date(app.createdAt).toLocaleString() : "-"}</td>
                                <td style={{ padding: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => setSelectedApplicationId(app.id as any)}
                                    style={{ padding: "0.5rem 0.75rem", minHeight: "44px" }}
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await approveApplication({ adminId: userId as any, applicationId: app.id as any });
                                        setMessage({ type: "success", text: "Application approved." });
                                      } catch (error: any) {
                                        setMessage({ type: "error", text: error?.message || "Failed to approve" });
                                      }
                                    }}
                                    style={{ padding: "0.5rem 0.75rem", minHeight: "44px" }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await rejectApplication({ adminId: userId as any, applicationId: app.id as any });
                                        setMessage({ type: "success", text: "Application rejected." });
                                      } catch (error: any) {
                                        setMessage({ type: "error", text: error?.message || "Failed to reject" });
                                      }
                                    }}
                                    style={{ padding: "0.5rem 0.75rem", minHeight: "44px" }}
                                  >
                                    Reject
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>
                            Showing {pendingStart}-{pendingEnd} of {pendingTotal}
                          </div>
                          {pendingTotalPages > 1 && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                                disabled={safePendingPage === 1}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safePendingPage === 1 ? "#f1f5f9" : "#fff",
                                  cursor: safePendingPage === 1 ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                                disabled={safePendingPage >= pendingTotalPages}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: safePendingPage >= pendingTotalPages ? "#f1f5f9" : "#fff",
                                  cursor: safePendingPage >= pendingTotalPages ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Member Lists */}
              <div style={{ padding: "1.5rem" }}>
                {(() => {
                  const approved =
                    approvedMembersByCommunity?.find((c: any) => c.communityId === communityId)?.members || [];
                  const members = community.members || [];
                  const imported = (getImportedCommunityMembers || []).filter(
                    (m: any) => String(m.communityId) === String(communityId)
                  );
                  const activeFarmseeMembers =
                    (activeFarmseeByCommunity || []).find(
                      (c: any) => String(c.communityId) === String(communityId)
                    )?.members || [];
                  const isBioFarmCommunity = String(communityId) === BIOFARM_COMMUNITY_ID;
                  const activeMembersTab = getMembersListTab(communityId);
                  const activeFarmseeSearch = getActiveFarmseeSearch(String(communityId)).trim().toLowerCase();
                  const filteredActiveFarmseeMembers = activeFarmseeSearch
                    ? activeFarmseeMembers.filter((member: any) => {
                        const alias = String(member.alias || "").toLowerCase();
                        const phone = String(member.phoneNumber || "").toLowerCase();
                        return alias.includes(activeFarmseeSearch) || phone.includes(activeFarmseeSearch);
                      })
                    : activeFarmseeMembers;
                  const totalActiveFarmEntries = activeFarmseeMembers.reduce(
                    (sum: number, member: any) => sum + Number(member.submissionCount || 0),
                    0
                  );
                  const filteredActiveFarmEntries = filteredActiveFarmseeMembers.reduce(
                    (sum: number, member: any) => sum + Number(member.submissionCount || 0),
                    0
                  );
                  const tabCounts: Record<MembersListTab, number> = {
                    approved: approved.length,
                    all: members.length,
                    imported: imported.length,
                    activeFarmsee: activeFarmseeMembers.length,
                  };
                  const tabLabels: Record<MembersListTab, string> = {
                    approved: "Approved Members",
                    all: "All Members",
                    imported: "Imported Members",
                    activeFarmsee: "Active Farms",
                  };
                  const membersTabs = (isBioFarmCommunity
                    ? ["approved", "all", "imported", "activeFarmsee"]
                    : ["approved", "all", "imported"]) as MembersListTab[];

                  return (
                    <>
                      <h3 style={{
                        margin: "0 0 1rem 0",
                        fontSize: "1.1rem",
                        fontWeight: "600",
                        color: "#2c2c2c",
                      }}>
                        Member Lists
                      </h3>

                      <div style={{ position: "relative", marginBottom: "1rem" }}>
                        <div style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "nowrap",
                          overflowX: "auto",
                          WebkitOverflowScrolling: "touch",
                          paddingBottom: "0.25rem",
                          paddingLeft: isMobile ? "0.5rem" : 0,
                          paddingRight: isMobile ? "0.5rem" : 0,
                        }}>
                          {membersTabs.map((tab) => {
                            const active = activeMembersTab === tab;
                            return (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setMembersListTab(communityId, tab)}
                                data-testid={tab === "activeFarmsee" ? "active-farmsee-tab-btn" : undefined}
                                style={{
                                  border: active ? "1px solid #2e7d32" : "1px solid #d0d7de",
                                  background: active ? "#e8f5e9" : "#fff",
                                  color: active ? "#1b5e20" : "#374151",
                                  borderRadius: "999px",
                                  padding: "0.4rem 0.85rem",
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  flex: "0 0 auto",
                                }}
                              >
                                {tabLabels[tab]} ({tabCounts[tab]})
                              </button>
                            );
                          })}
                        </div>
                        {isMobile && (
                          <>
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: "0.25rem",
                                width: "1.4rem",
                                pointerEvents: "none",
                                background: "linear-gradient(to right, rgba(255,255,255,0.96), rgba(255,255,255,0))",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                bottom: "0.25rem",
                                width: "1.4rem",
                                pointerEvents: "none",
                                background: "linear-gradient(to left, rgba(255,255,255,0.96), rgba(255,255,255,0))",
                              }}
                            />
                          </>
                        )}
                      </div>

                      {activeMembersTab === "approved" && (
                        <>
                          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page: {FIXED_PAGE_SIZE}</span>
                          </div>
                          {approvedMembersByCommunity === undefined ? (
                            <p style={{ color: "#999" }}>Loading approved members...</p>
                          ) : (() => {
                            const approvedTotal = approved.length;
                            const approvedTotalPages = Math.max(1, Math.ceil(approvedTotal / approvedPageSize));
                            const safeApprovedPage = Math.min(approvedPage, approvedTotalPages);
                            const approvedStart = approvedTotal === 0 ? 0 : (safeApprovedPage - 1) * approvedPageSize + 1;
                            const approvedEnd = Math.min(safeApprovedPage * approvedPageSize, approvedTotal);
                            const pagedApproved = approved.slice(
                              (safeApprovedPage - 1) * approvedPageSize,
                              safeApprovedPage * approvedPageSize
                            );
                            if (approved.length === 0) {
                              return <p style={{ color: "#999" }}>No approved members.</p>;
                            }
                            return (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                                  <thead>
                                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                                      <th style={{ padding: "0.5rem" }}>Name</th>
                                      <th style={{ padding: "0.5rem" }}>Farm Name</th>
                                      <th style={{ padding: "0.5rem" }}>Phone</th>
                                      <th style={{ padding: "0.5rem" }}>District</th>
                                      <th style={{ padding: "0.5rem" }}>Approved On</th>
                                      <th style={{ padding: "0.5rem" }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pagedApproved.map((member: any) => (
                                      <tr key={member.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: "0.5rem" }}>{member.form?.section1?.farmerFullName || member.farmer?.alias || "-"}</td>
                                        <td style={{ padding: "0.5rem" }}>{member.form?.section1?.farmName || "-"}</td>
                                        <td style={{ padding: "0.5rem" }}>{member.form?.section1?.phoneNumber || member.farmer?.phoneNumber || "-"}</td>
                                        <td style={{ padding: "0.5rem" }}>{member.form?.section1?.districtSubCounty || member.farmer?.districtText || "-"}</td>
                                        <td style={{ padding: "0.5rem" }}>{member.joinedAt ? new Date(member.joinedAt).toLocaleString() : "-"}</td>
                                        <td style={{ padding: "0.5rem" }}>
                                          <button
                                            onClick={async () => {
                                              if (!member.applicationId) {
                                                setMessage({ type: "error", text: "No application linked for this member." });
                                                return;
                                              }
                                              try {
                                                await revokeMembership({ adminId: userId as any, applicationId: member.applicationId as any });
                                                setMessage({ type: "success", text: "Membership revoked." });
                                              } catch (error: any) {
                                                setMessage({ type: "error", text: error?.message || "Failed to revoke" });
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
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                    Showing {approvedStart}-{approvedEnd} of {approvedTotal}
                                  </div>
                                  {approvedTotalPages > 1 && (
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                      <button
                                        type="button"
                                        onClick={() => setApprovedPage((p) => Math.max(1, p - 1))}
                                        disabled={safeApprovedPage === 1}
                                        style={{
                                          padding: "0.35rem 0.7rem",
                                          borderRadius: 6,
                                          border: "1px solid #ddd",
                                          background: safeApprovedPage === 1 ? "#f1f5f9" : "#fff",
                                          cursor: safeApprovedPage === 1 ? "not-allowed" : "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Prev
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setApprovedPage((p) => Math.min(approvedTotalPages, p + 1))}
                                        disabled={safeApprovedPage >= approvedTotalPages}
                                        style={{
                                          padding: "0.35rem 0.7rem",
                                          borderRadius: 6,
                                          border: "1px solid #ddd",
                                          background: safeApprovedPage >= approvedTotalPages ? "#f1f5f9" : "#fff",
                                          cursor: safeApprovedPage >= approvedTotalPages ? "not-allowed" : "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {activeMembersTab === "all" && (
                        <>
                          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page: {FIXED_PAGE_SIZE}</span>
                          </div>

                          {members.length === 0 ? (
                            <p style={{ color: "#999" }}>No members in this community yet.</p>
                          ) : (
                            <>
                              <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                                  <thead>
                                    <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e0e0e0" }}>
                                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#2c2c2c" }}>Name</th>
                                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#2c2c2c" }}>Role</th>
                                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#2c2c2c" }}>Phone</th>
                                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#2c2c2c" }}>Email</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const membersTotal = members.length;
                                      const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersPageSize));
                                      const safeMembersPage = Math.min(membersPage, membersTotalPages);
                                      const pagedMembers = members.slice(
                                        (safeMembersPage - 1) * membersPageSize,
                                        safeMembersPage * membersPageSize
                                      );
                                      return pagedMembers.map((member: any, idx: number) => (
                                        <tr
                                          key={member.userId || `${idx}-${member.alias || "member"}`}
                                          style={{
                                            background: idx % 2 === 0 ? "#fff" : "#fafafa",
                                            borderBottom: "1px solid #eee",
                                          }}
                                        >
                                          <td style={{ padding: "0.75rem", color: "#2c2c2c" }}>{member.alias}</td>
                                          <td style={{ padding: "0.75rem" }}>
                                            {(() => {
                                              const r = member.role || "unknown";
                                              const rc: Record<string, { bg: string; text: string }> = {
                                                farmer: { bg: "#e8f5e9", text: "#2e7d32" },
                                                trader: { bg: "#e3f2fd", text: "#1565c0" },
                                                buyer: { bg: "#f3e5f5", text: "#6a1b9a" },
                                                vendor: { bg: "#fff3e0", text: "#e65100" },
                                                transporter: { bg: "#e1f5fe", text: "#0277bd" },
                                                store: { bg: "#ffebee", text: "#c62828" },
                                                admin: { bg: "#eceff1", text: "#37474f" },
                                              };
                                              const cl = rc[r] || { bg: "#f5f5f5", text: "#616161" };
                                              return (
                                                <span style={{
                                                  padding: "0.15rem 0.5rem",
                                                  borderRadius: 999,
                                                  background: cl.bg,
                                                  color: cl.text,
                                                  fontWeight: 600,
                                                  fontSize: "0.78rem",
                                                  textTransform: "capitalize",
                                                }}>
                                                  {r}
                                                </span>
                                              );
                                            })()}
                                          </td>
                                          <td style={{ padding: "0.75rem", color: "#666" }}>{member.phoneNumber || "—"}</td>
                                          <td style={{ padding: "0.75rem", color: "#666" }}>{member.email || "—"}</td>
                                        </tr>
                                      ));
                                    })()}
                                  </tbody>
                                </table>
                              </div>

                              {(() => {
                                const membersTotal = members.length;
                                const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersPageSize));
                                const safeMembersPage = Math.min(membersPage, membersTotalPages);
                                const membersStart = membersTotal === 0 ? 0 : (safeMembersPage - 1) * membersPageSize + 1;
                                const membersEnd = Math.min(safeMembersPage * membersPageSize, membersTotal);
                                return (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                      Showing {membersStart}-{membersEnd} of {membersTotal}
                                    </div>
                                    {membersTotalPages > 1 && (
                                      <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button
                                          type="button"
                                          onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                                          disabled={safeMembersPage === 1}
                                          style={{
                                            padding: "0.35rem 0.7rem",
                                            borderRadius: 6,
                                            border: "1px solid #ddd",
                                            background: safeMembersPage === 1 ? "#f1f5f9" : "#fff",
                                            cursor: safeMembersPage === 1 ? "not-allowed" : "pointer",
                                            fontWeight: 600,
                                          }}
                                        >
                                          Prev
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setMembersPage((p) => Math.min(membersTotalPages, p + 1))}
                                          disabled={safeMembersPage >= membersTotalPages}
                                          style={{
                                            padding: "0.35rem 0.7rem",
                                            borderRadius: 6,
                                            border: "1px solid #ddd",
                                            background: safeMembersPage >= membersTotalPages ? "#f1f5f9" : "#fff",
                                            cursor: safeMembersPage >= membersTotalPages ? "not-allowed" : "pointer",
                                            fontWeight: 600,
                                          }}
                                        >
                                          Next
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </>
                      )}

                      {activeMembersTab === "activeFarmsee" && (
                        <>
                          {activeFarmseeByCommunity === undefined ? (
                            <p style={{ color: "#999" }}>Loading Active Farms members...</p>
                          ) : activeFarmseeMembers.length === 0 ? (
                            <p style={{ color: "#999" }}>
                              No members with Farm Toolbox entries yet.
                            </p>
                          ) : (
                            <>
                              <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <input
                                  type="text"
                                  data-testid="active-farmsee-search"
                                  placeholder="Search farmer by name or phone"
                                  value={getActiveFarmseeSearch(String(communityId))}
                                  onChange={(e) => setActiveFarmseeSearch(String(communityId), e.target.value)}
                                  style={{
                                    width: isMobile ? "100%" : "320px",
                                    padding: "0.45rem 0.65rem",
                                    border: "1px solid #d0d7de",
                                    borderRadius: 8,
                                    fontSize: "0.85rem",
                                  }}
                                />
                                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                                  Showing {filteredActiveFarmseeMembers.length} of {activeFarmseeMembers.length}
                                </span>
                                <span style={{ fontSize: "0.82rem", color: "#1f2937", fontWeight: 600 }}>
                                  Total entries: {totalActiveFarmEntries}
                                </span>
                                {filteredActiveFarmseeMembers.length !== activeFarmseeMembers.length && (
                                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                    Filtered entries: {filteredActiveFarmEntries}
                                  </span>
                                )}
                              </div>

                              {filteredActiveFarmseeMembers.length === 0 ? (
                                <p style={{ color: "#999" }}>No farmers match your search.</p>
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
                                    gap: "0.85rem",
                                  }}
                                >
                                  {filteredActiveFarmseeMembers.map((member: any) => (
                                    <button
                                      key={String(member.memberId)}
                                      type="button"
                                      data-testid="active-farmsee-member-card"
                                      onClick={() => {
                                        setSelectedFarmseeMember({
                                          communityId: communityId as Id<"communities">,
                                          memberId: member.memberId as Id<"users">,
                                          alias: member.alias || "Farmer",
                                        });
                                        setExpandedFarmseeEntryId(null);
                                        setFarmseeSelectedEntryIds(new Set());
                                      }}
                                      style={{
                                        border: "1px solid #d0d7de",
                                        borderRadius: 12,
                                        padding: "0.85rem",
                                        background: "#fff",
                                        cursor: "pointer",
                                        textAlign: "left",
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: "#1f2937", marginBottom: "0.35rem" }}>
                                        {member.alias || "Farmer"}
                                      </div>
                                      <div style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "0.2rem" }}>
                                        {member.phoneNumber || "No phone"}
                                      </div>
                                      <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                                        Entries: {member.submissionCount || 0}
                                      </div>
                                      {!!member.latestPhotoUrls?.length && (
                                        <div style={{ marginTop: "0.55rem", maxWidth: 120 }}>
                                          <SubmissionPhotoGallery
                                            photos={member.latestPhotoUrls}
                                            minTileWidth={110}
                                            tileHeight={72}
                                          />
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {activeMembersTab === "imported" && (
                        <>
                          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page: {FIXED_PAGE_SIZE}</span>
                          </div>

                          {getImportedCommunityMembers === undefined ? (
                            <p style={{ color: "#999" }}>Loading imported members...</p>
                          ) : (() => {
                            const importedTotal = imported.length;
                            const importedTotalPages = Math.max(1, Math.ceil(importedTotal / importedMembersPageSize));
                            const safeImportedPage = Math.min(importedMembersPage, importedTotalPages);
                            const importedStart = importedTotal === 0 ? 0 : (safeImportedPage - 1) * importedMembersPageSize + 1;
                            const importedEnd = Math.min(safeImportedPage * importedMembersPageSize, importedTotal);
                            const pagedImported = imported.slice(
                              (safeImportedPage - 1) * importedMembersPageSize,
                              safeImportedPage * importedMembersPageSize
                            );

                            if (imported.length === 0) {
                              return <p style={{ color: "#999" }}>No imported members.</p>;
                            }

                            return (
                              <div>
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                                  gap: "1rem",
                                  marginBottom: "1rem",
                                }}>
                                  {pagedImported.map((member: any) => (
                                    <CommunityMemberCard
                                      key={member._id}
                                      member={member}
                                      adminId={userId as any}
                                      onActivationComplete={() => {
                                        if (message) {
                                          setMessage(null);
                                        }
                                      }}
                                    />
                                  ))}
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                    Showing {importedStart}-{importedEnd} of {importedTotal}
                                  </div>
                                  {importedTotalPages > 1 && (
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                      <button
                                        type="button"
                                        onClick={() => setImportedMembersPage((p) => Math.max(1, p - 1))}
                                        disabled={safeImportedPage === 1}
                                        style={{
                                          padding: "0.35rem 0.7rem",
                                          borderRadius: 6,
                                          border: "1px solid #ddd",
                                          background: safeImportedPage === 1 ? "#f1f5f9" : "#fff",
                                          cursor: safeImportedPage === 1 ? "not-allowed" : "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Prev
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setImportedMembersPage((p) => Math.min(importedTotalPages, p + 1))}
                                        disabled={safeImportedPage >= importedTotalPages}
                                        style={{
                                          padding: "0.35rem 0.7rem",
                                          borderRadius: 6,
                                          border: "1px solid #ddd",
                                          background: safeImportedPage >= importedTotalPages ? "#f1f5f9" : "#fff",
                                          cursor: safeImportedPage >= importedTotalPages ? "not-allowed" : "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* Export Quota Info */}
                      {exportQuota && (
                        <div style={{
                          marginTop: "1rem",
                          padding: "1rem",
                          background: exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffebee" : "#e3f2fd",
                          borderRadius: "8px",
                          border: `1px solid ${exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffcdd2" : "#bbdefb"}`,
                        }}>
                          <p style={{
                            margin: "0 0 0.5rem 0",
                            fontSize: "0.9rem",
                            color: "#1565c0",
                            fontWeight: "600",
                          }}>
                            📊 Service Level: {exportQuota.serviceLevel}
                          </p>
                          {exportQuota.serviceLevel === "Standard" ? (
                            <p style={{
                              margin: "0",
                              fontSize: "0.85rem",
                              color: exportQuota.remaining === 0 ? "#c62828" : "#666",
                            }}>
                              Exports used this month: {exportQuota.used}/{exportQuota.limit} | Remaining: <strong>{exportQuota.remaining}</strong>
                            </p>
                          ) : (
                            <p style={{
                              margin: "0",
                              fontSize: "0.85rem",
                              color: "#2e7d32",
                            }}>
                              ✓ Unlimited exports
                            </p>
                          )}
                        </div>
                      )}

                      {/* Export Button */}
                      <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleExportMembers(communityId as any, community.name)}
                          disabled={loading || (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")}
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "#ccc" : "#2196f3",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "0.95rem",
                            fontWeight: "600",
                            cursor: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "not-allowed" : "pointer",
                            opacity: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? 0.6 : 1,
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                              (e.target as HTMLButtonElement).style.background = "#1976d2";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                              (e.target as HTMLButtonElement).style.background = "#2196f3";
                            }
                          }}
                        >
                          {loading ? "Exporting..." : "Export Members (Excel)"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              </>)}
            </div>
          );
          })
        )}
      </div>

      {selectedFarmseeMember && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: isMobile ? "0.6rem" : "1rem",
          }}
          onClick={() => setSelectedFarmseeMember(null)}
        >
          <div
            data-testid="active-farmsee-entries-modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 960,
              maxHeight: "88vh",
              overflowY: "auto",
              padding: isMobile ? "0.9rem" : "1.2rem",
              boxShadow: "0 14px 34px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <h3 style={{ margin: 0, color: "#1f2937", fontSize: isMobile ? "1rem" : "1.1rem" }}>
                  Active Farms Entries
                </h3>
                <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Farmer: {selectedFarmseeMember.alias}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFarmseeMember(null)}
                style={{ border: "none", background: "transparent", fontSize: "1.3rem", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="active-farmsee-download-all"
                onClick={handleFarmseeAllExport}
                disabled={farmseeAllExporting || selectedFarmseeEntries === undefined || selectedFarmseeEntries.length === 0}
                style={{
                  border: "1px solid #d0d7de",
                  borderRadius: 8,
                  padding: "0.45rem 0.8rem",
                  background: farmseeAllExporting || selectedFarmseeEntries === undefined || selectedFarmseeEntries.length === 0 ? "#f8fafc" : "#fef3c7",
                  color: farmseeAllExporting || selectedFarmseeEntries === undefined || selectedFarmseeEntries.length === 0 ? "#94a3b8" : "#92400e",
                  cursor: farmseeAllExporting || selectedFarmseeEntries === undefined || selectedFarmseeEntries.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "0.84rem",
                }}
              >
                {farmseeAllExporting ? "Exporting all..." : "Download All PDF"}
              </button>
              <button
                type="button"
                data-testid="active-farmsee-download-selected"
                onClick={handleFarmseeBatchExport}
                disabled={farmseeBatchExporting || farmseeSelectedEntryIds.size === 0}
                style={{
                  border: "1px solid #d0d7de",
                  borderRadius: 8,
                  padding: "0.45rem 0.8rem",
                  background: farmseeBatchExporting || farmseeSelectedEntryIds.size === 0 ? "#f8fafc" : "#e3f2fd",
                  color: farmseeBatchExporting || farmseeSelectedEntryIds.size === 0 ? "#94a3b8" : "#0f4c81",
                  cursor: farmseeBatchExporting || farmseeSelectedEntryIds.size === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "0.84rem",
                }}
              >
                {farmseeBatchExporting ? "Exporting..." : `Download Selected PDF (${farmseeSelectedEntryIds.size})`}
              </button>
            </div>

            {selectedFarmseeEntries === undefined ? (
              <p style={{ color: "#667085", marginTop: "1rem" }}>Loading entries...</p>
            ) : selectedFarmseeEntries.length === 0 ? (
              <p style={{ color: "#667085", marginTop: "1rem" }}>No entries available for this farmer.</p>
            ) : (
              <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.8rem" }}>
                {selectedFarmseeEntries.map((entry: any) => {
                  const entryId = String(entry._id);
                  const checked = farmseeSelectedEntryIds.has(entryId);
                  const expanded = expandedFarmseeEntryId === entryId;
                  const submittedAt = entry.submittedAt || entry.createdAt;
                  const photoCount = Array.isArray(entry.photoUrls) ? entry.photoUrls.length : 0;
                  const fieldCount = typeof entry.fieldCount === "number"
                    ? entry.fieldCount
                    : (entry.fieldValues || []).filter((v: any) => String(v?.value || "").trim() !== "").length;
                  const dateField = (entry.fieldValues || []).find((v: any) => /date/i.test(String(v?.fieldName || "")));
                  const tagField = (entry.fieldValues || []).find((v: any) => /tag/i.test(String(v?.fieldName || "")));
                  return (
                    <div
                      key={entryId}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "0.8rem",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.84rem", color: "#334155" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setFarmseeSelectedEntryIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) {
                                  next.add(entryId);
                                } else {
                                  next.delete(entryId);
                                }
                                return next;
                              });
                            }}
                          />
                          Select for batch export
                        </label>
                        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setExpandedFarmseeEntryId(expanded ? null : entryId)}
                            style={{
                              border: "1px solid #d0d7de",
                              borderRadius: 8,
                              padding: "0.35rem 0.65rem",
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: "0.82rem",
                            }}
                          >
                            {expanded ? "Hide" : "View"} details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFarmseeSingleExport(entry._id)}
                            disabled={farmseeSingleExportingId === entryId}
                            style={{
                              border: "1px solid #d0d7de",
                              borderRadius: 8,
                              padding: "0.35rem 0.65rem",
                              background: farmseeSingleExportingId === entryId ? "#f1f5f9" : "#e8f5e9",
                              color: farmseeSingleExportingId === entryId ? "#94a3b8" : "#1b5e20",
                              cursor: farmseeSingleExportingId === entryId ? "not-allowed" : "pointer",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                            }}
                          >
                            {farmseeSingleExportingId === entryId ? "Exporting..." : "Download PDF"}
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: "0.6rem", fontSize: "0.84rem", color: "#475569" }}>
                        <div><strong>Template:</strong> {entry.templateDetails?.templateName || "Tracker Entry"}</div>
                        <div><strong>Submitted:</strong> {submittedAt ? new Date(submittedAt).toLocaleString() : "-"}</div>
                        <div>{fieldCount} field(s) filled · {photoCount} photo(s)</div>
                        {(dateField || tagField) && (
                          <div>
                            {dateField ? `Date: ${String(dateField.value || "-")}` : ""}
                            {dateField && tagField ? " · " : ""}
                            {tagField ? `Tag Number: ${String(tagField.value || "-")}` : ""}
                          </div>
                        )}
                      </div>
                      {expanded && (
                        <div style={{ marginTop: "0.6rem", borderTop: "1px solid #eef2f7", paddingTop: "0.55rem", display: "grid", gap: "0.35rem" }}>
                          {(entry.fieldValues || []).map((value: any, idx: number) => (
                            <div key={`${entryId}-${idx}`} style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.45 }}>
                              <strong>{value.fieldName || "Field"}:</strong>{" "}
                              {String(value.value ?? "-")}
                            </div>
                          ))}
                          {entry.notes && (
                            <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.45 }}>
                              <strong>Notes:</strong> {String(entry.notes)}
                            </div>
                          )}
                          {(entry.gpsLat != null && entry.gpsLng != null) && (
                            <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.45 }}>
                              <strong>GPS:</strong> {Number(entry.gpsLat).toFixed(5)}, {Number(entry.gpsLng).toFixed(5)}
                            </div>
                          )}
                          {Array.isArray(entry.photoUrls) && entry.photoUrls.length > 0 && (
                            <div style={{ display: "grid", gap: "0.3rem" }}>
                              <SubmissionPhotoGallery photos={entry.photoUrls} minTileWidth={90} tileHeight={78} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
              padding: isMobile ? "1rem" : "1.25rem",
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "0.5rem" : "0",
            }}>
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
            ) : (selectedApplicationDetails as any).error ? (
              <p style={{ color: "#c62828", marginTop: "1rem" }}>
                {(selectedApplicationDetails as any).error}
              </p>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                {(() => {
                  const section1 = (selectedApplicationDetails as any)?.form?.section1 || {};
                  const farmer = (selectedApplicationDetails as any)?.farmer || {};
                  return (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: "0.75rem",
                    }}>
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

                <div style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}>
                  <button
                    onClick={async () => {
                      try {
                        await approveApplication({ adminId: userId as any, applicationId: selectedApplicationId as any });
                        setMessage({ type: "success", text: "Application approved." });
                        setSelectedApplicationId(null);
                      } catch (error: any) {
                        setMessage({ type: "error", text: error?.message || "Failed to approve" });
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.9rem",
                      flex: isMobile ? "1 1 100%" : "0 0 auto",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await rejectApplication({ adminId: userId as any, applicationId: selectedApplicationId as any });
                        setMessage({ type: "success", text: "Application rejected." });
                        setSelectedApplicationId(null);
                      } catch (error: any) {
                        setMessage({ type: "error", text: error?.message || "Failed to reject" });
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.9rem",
                      flex: isMobile ? "1 1 100%" : "0 0 auto",
                    }}
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
  );
}
