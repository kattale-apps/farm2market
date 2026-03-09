"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { CommunityQRCode } from "../../components/CommunityQRCode";
import { resolveCommunityLogo } from "../../lib/communityLogos";

/* ── Tab types for community cards ── */
type CommunityTab = "members" | "noticeboard" | "messages" | "forms";

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
      ) : posts.length === 0 ? (
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
  const messages = useQuery(api.messages.getCommunityMessages, { communityId });
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
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem" }}>
            {["farmer", "trader", "buyer"].map((r) => (
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
        ) : messages.length === 0 ? (
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
  const [builderPurpose, setBuilderPurpose] = useState<"tracker" | "profile">("tracker");
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
      const result = await createForm({
        communityId,
        adminId: userId,
        name: builderName,
        description: builderDescription || undefined,
        category: builderCategory,
        formPurpose: builderPurpose,
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
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(["tracker", "profile"] as const).map((purpose) => (
                  <button
                    key={purpose}
                    onClick={() => setBuilderPurpose(purpose)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "8px",
                      border: `2px solid ${builderPurpose === purpose ? (purpose === "tracker" ? "#1976d2" : "#2e7d32") : "#ddd"}`,
                      background: builderPurpose === purpose ? (purpose === "tracker" ? "#e3f2fd" : "#e8f5e9") : "#fff",
                      color: builderPurpose === purpose ? (purpose === "tracker" ? "#1565c0" : "#2e7d32") : "#666",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {purpose === "tracker" ? "📊 Tracker Form" : "👤 Profile Form"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: "0.25rem 0 0 0" }}>
                {builderPurpose === "tracker"
                  ? "Tracker forms appear in the Trackers tab for data entry"
                  : "Profile forms appear in the community Profile tab for member info"}
              </p>
            </div>
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

export default function CommunityDashboardPage() {
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

  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    userId ? { userId } : "skip"
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );

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

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedPageSize, setApprovedPageSize] = useState(20);
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(20);
  const pendingPageKey = "community_pending_applications";
  const approvedPageKey = "community_approved_members";
  const membersPageKey = "community_members_list";

  // Tab state per community
  const [activeTabs, setActiveTabs] = useState<Record<string, CommunityTab>>({});
  const getActiveTab = (cId: string): CommunityTab => activeTabs[cId] || "members";
  const setActiveTab = (cId: string, tab: CommunityTab) =>
    setActiveTabs((prev) => ({ ...prev, [cId]: tab }));

  useEffect(() => {
    if (!paginationPreferences) return;
    const defaultSize = paginationPreferences.defaultPageSize ?? 20;
    const nextPending = paginationPreferences.list?.[pendingPageKey] ?? defaultSize;
    const nextApproved = paginationPreferences.list?.[approvedPageKey] ?? defaultSize;
    const nextMembers = paginationPreferences.list?.[membersPageKey] ?? defaultSize;
    if (nextPending !== pendingPageSize) {
      setPendingPageSize(nextPending);
      setPendingPage(1);
    }
    if (nextApproved !== approvedPageSize) {
      setApprovedPageSize(nextApproved);
      setApprovedPage(1);
    }
    if (nextMembers !== membersPageSize) {
      setMembersPageSize(nextMembers);
      setMembersPage(1);
    }
  }, [paginationPreferences, pendingPageKey, approvedPageKey, membersPageKey, pendingPageSize, approvedPageSize, membersPageSize]);

  const selectedApplicationDetails = useQuery(
    api.communityApplications.getApplicationDetails,
    userId && selectedApplicationId
      ? { adminId: userId, applicationId: selectedApplicationId }
      : "skip"
  );

  // For community admin: get their managed community
  const userCommunities = useMemo(() => {
    if (!communities) return [];
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
                borderBottom: "2px solid #e0e0e0",
                background: "#fafafa",
              }}>
                {(["members", "noticeboard", "messages", "forms"] as CommunityTab[]).map((tab) => {
                  const active = getActiveTab(communityId) === tab;
                  const labels: Record<CommunityTab, string> = { members: "Members", noticeboard: "Noticeboard", messages: "Messages", forms: "Forms" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(communityId, tab)}
                      style={{
                        flex: 1,
                        padding: "0.75rem 0.5rem",
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

              {/* ── Members Tab (existing content) ── */}
              {getActiveTab(communityId) === "members" && (<>

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
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                  <select
                    value={pendingPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setPendingPageSize(nextSize);
                      setPendingPage(1);
                      updatePaginationPreferences({
                        userId: userId as any,
                        listKey: pendingPageKey,
                        pageSize: nextSize,
                      } as any);
                    }}
                    style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
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

              {/* Approved Members */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #eee" }}>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.05rem",
                  fontWeight: "600",
                  color: "#2c2c2c",
                }}>
                  Approved Members
                </h3>
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                  <select
                    value={approvedPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setApprovedPageSize(nextSize);
                      setApprovedPage(1);
                      updatePaginationPreferences({
                        userId: userId as any,
                        listKey: approvedPageKey,
                        pageSize: nextSize,
                      } as any);
                    }}
                    style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                {approvedMembersByCommunity === undefined ? (
                  <p style={{ color: "#999" }}>Loading members...</p>
                ) : (
                  (() => {
                    const approved =
                      approvedMembersByCommunity?.find((c: any) => c.communityId === communityId)?.members || [];
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
                  })()
                )}
              </div>

              {/* Members Section */}
              {community.members && community.members.length > 0 ? (
                <div style={{ padding: "1.5rem" }}>
                  <h3 style={{
                    margin: "0 0 1rem 0",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Members ({community.members.length})
                  </h3>
                  <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                    <select
                      value={membersPageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        setMembersPageSize(nextSize);
                        setMembersPage(1);
                        updatePaginationPreferences({
                          userId: userId as any,
                          listKey: membersPageKey,
                          pageSize: nextSize,
                        } as any);
                      }}
                      style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {/* Member List */}
                  <div style={{
                    overflowX: "auto",
                    marginTop: "1rem",
                  }}>
                    <table style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.9rem",
                    }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e0e0e0" }}>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Name
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Role
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Phone
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Email
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const members = community.members || [];
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
                              <td style={{ padding: "0.75rem", color: "#2c2c2c" }}>
                                {member.alias}
                              </td>
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
                              <td style={{ padding: "0.75rem", color: "#666" }}>
                                {member.phoneNumber || "—"}
                              </td>
                              <td style={{ padding: "0.75rem", color: "#666" }}>
                                {member.email || "—"}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {(() => {
                    const members = community.members || [];
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
                </div>
              ) : (
                <div style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "#999",
                }}>
                  <p>No members in this community yet.</p>
                </div>
              )}

              </>)}
            </div>
          );
          })
        )}
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
