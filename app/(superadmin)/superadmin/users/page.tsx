"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { formatUgandaDate, formatUgandaDateTime } from "../../../utils/timeUtils";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const PAGE_SIZE = 25;

const CATEGORY_LABELS: Record<string, string> = {
  farmer: "Farmers",
  trader: "Traders",
  buyer: "Buyers",
  vendor: "Vendors",
  transporter: "Transporters",
  store: "Stores",
  admin: "Admins",
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  farmer: { bg: "#e8f5e9", color: "#2e7d32" },
  trader: { bg: "#e3f2fd", color: "#1565c0" },
  buyer: { bg: "#f3e5f5", color: "#6a1b9a" },
  vendor: { bg: "#fff3e0", color: "#e65100" },
  transporter: { bg: "#e0f7fa", color: "#00695c" },
  store: { bg: "#fce4ec", color: "#ad1457" },
  admin: { bg: "#ede7f6", color: "#4527a0" },
};

const STATE_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "#e8f5e9", color: "#2e7d32" },
  suspended: { bg: "#fff3e0", color: "#e65100" },
  deleted: { bg: "#ffebee", color: "#c62828" },
};

const cellStyle: React.CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};

const headerCellStyle: React.CSSProperties = {
  padding: "0.75rem",
  textAlign: "left",
  fontWeight: 600,
  color: "#333",
  whiteSpace: "nowrap",
};

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "0.2rem 0.5rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/** Generate a readable temporary password the admin can relay to the user. */
function generatePassword(): string {
  const words = ["Harvest", "Market", "Garden", "Basket", "Sunrise", "Millet", "Cassava", "Maize"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}${digits}`;
}

function ResetPasswordDialog({
  adminId,
  user,
  onClose,
}: {
  adminId: Id<"users">;
  user: any;
  onClose: () => void;
}) {
  const resetPassword = useMutation((api as any).adminUsers.resetUserPassword);
  const [password, setPassword] = useState(generatePassword());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPassword({
        adminId,
        userId: user.userId,
        newPassword: password,
        reason: reason.trim() || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.data ?? err?.message ?? "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem" }}>Reset password</h2>
        <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "#555" }}>
          {user.verifiedName || user.alias}
          {user.phoneNumber ? ` · ${user.phoneNumber}` : ""}
          {user.email ? ` · ${user.email}` : ""}
        </p>

        {done ? (
          <>
            <div
              style={{
                background: "#e8f5e9",
                border: "1px solid #a5d6a7",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#2e7d32", fontWeight: 600 }}>
                Password reset. Share this with the user now — it is not shown again.
              </p>
              <code
                style={{
                  display: "block",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "#1b5e20",
                }}
              >
                {password}
              </code>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#555" }}>
                Any devices the user was signed in on have been signed out.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "0.7rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              New password
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  flex: 1,
                  padding: "0.6rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                }}
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#f5f5f5",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                Generate
              </button>
            </div>

            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Reason (optional, saved to the audit log)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. User called in, forgot password"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: "0.9rem",
                marginBottom: "1rem",
              }}
            />

            {error && (
              <p style={{ color: "#c62828", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={onClose}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "0.7rem",
                  background: "#f5f5f5",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || password.trim().length < 8}
                style={{
                  flex: 1,
                  padding: "0.7rem",
                  background: busy || password.trim().length < 8 ? "#bdbdbd" : "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: busy || password.trim().length < 8 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {busy ? "Resetting..." : "Reset password"}
              </button>
            </div>
            {password.trim().length < 8 && (
              <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem", marginBottom: 0 }}>
                Password must be at least 8 characters.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  adminId,
  onResetPassword,
  onNotify,
}: {
  user: any;
  adminId: Id<"users">;
  onResetPassword: (user: any) => void;
  onNotify: (message: string) => void;
}) {
  const setUserState = useMutation((api as any).adminUsers.setUserState);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const changeState = async (state: "active" | "suspended") => {
    setBusy(true);
    try {
      const result = await setUserState({ adminId, userId: user.userId, state });
      onNotify(
        state === "active"
          ? `${user.verifiedName || user.alias} activated`
          : `${user.verifiedName || user.alias} suspended${
              result?.sessionsEnded ? ` (${result.sessionsEnded} session(s) ended)` : ""
            }`
      );
    } catch (err: any) {
      onNotify(err?.data ?? err?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const categoryStyle = CATEGORY_COLORS[user.category] ?? { bg: "#eee", color: "#555" };
  const stateStyle = STATE_COLORS[user.state] ?? { bg: "#eee", color: "#555" };
  const location = [user.village, user.parish, user.subcounty, user.district]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <tr>
        <td style={cellStyle}>
          <div style={{ fontWeight: 600, color: "#1a1a1a" }}>
            {user.verifiedName || <span style={{ color: "#999", fontWeight: 400 }}>No verified name</span>}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#888", fontFamily: "monospace" }}>{user.alias}</div>
          {user.isTestUser && (
            <div style={{ marginTop: "0.25rem" }}>
              <Badge text="TEST" bg="#fffde7" color="#f57f17" />
            </div>
          )}
        </td>
        <td style={cellStyle}>
          <div>{user.phoneNumber || <span style={{ color: "#bbb" }}>—</span>}</div>
          <div style={{ fontSize: "0.78rem", color: "#666", wordBreak: "break-all" }}>
            {user.email || ""}
          </div>
        </td>
        <td style={cellStyle}>
          <Badge text={user.category} bg={categoryStyle.bg} color={categoryStyle.color} />
          {user.category === "admin" && user.adminLevel && (
            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem" }}>
              {user.adminLevel}
              {user.adminCategory ? ` · ${user.adminCategory}` : ""}
            </div>
          )}
        </td>
        <td style={cellStyle}>
          <Badge text={user.state} bg={stateStyle.bg} color={stateStyle.color} />
        </td>
        <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{formatUgandaDate(user.createdAt)}</td>
        <td style={{ ...cellStyle, whiteSpace: "nowrap", fontSize: "0.8rem", color: "#666" }}>
          {formatUgandaDate(user.lastActiveAt)}
        </td>
        <td style={{ ...cellStyle, fontSize: "0.8rem", color: "#555", maxWidth: 180 }}>
          {location || <span style={{ color: "#bbb" }}>—</span>}
        </td>
        <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ display: "inline-flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {user.state === "active" ? (
              <button
                onClick={() => changeState("suspended")}
                disabled={busy}
                style={{
                  padding: "0.35rem 0.6rem",
                  background: "#fff3e0",
                  color: "#e65100",
                  border: "1px solid #ffcc80",
                  borderRadius: 6,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                Suspend
              </button>
            ) : (
              <button
                onClick={() => changeState("active")}
                disabled={busy}
                style={{
                  padding: "0.35rem 0.6rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                Activate
              </button>
            )}
            <button
              onClick={() => onResetPassword(user)}
              style={{
                padding: "0.35rem 0.6rem",
                background: "#e3f2fd",
                color: "#1565c0",
                border: "1px solid #90caf9",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              Reset password
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                padding: "0.35rem 0.6rem",
                background: "#f5f5f5",
                color: "#555",
                border: "1px solid #ddd",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              {expanded ? "Hide" : "Details"}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: "1rem", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0.75rem",
                fontSize: "0.82rem",
              }}
            >
              <Detail label="User ID" value={user.userId} mono />
              <Detail label="Sex" value={user.sex === "M" ? "Male" : user.sex === "F" ? "Female" : null} />
              <Detail label="Region" value={user.region} />
              <Detail
                label="Farm size"
                value={user.farmSizeAcres != null ? `${user.farmSizeAcres} acres` : null}
              />
              <Detail label="Supply chain role" value={user.supplyChainRole} />
              <Detail label="Account scope" value={user.accountScope} />
              <Detail
                label="Onboarding"
                value={
                  user.onboardingCompleted == null
                    ? null
                    : user.onboardingCompleted
                      ? "Completed"
                      : "Incomplete"
                }
              />
              <Detail label="Verification" value={user.verificationStatus} />
              <Detail label="Password set" value={user.hasPassword ? "Yes" : "No"} />
              <Detail label="Active sessions" value={String(user.activeSessionCount)} />
              <Detail label="Joined" value={formatUgandaDateTime(user.createdAt)} />
              <Detail label="Last active" value={formatUgandaDateTime(user.lastActiveAt)} />
              <Detail
                label="Communities"
                value={user.communities.length ? user.communities.join(", ") : null}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: "#888", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div
        style={{
          color: value ? "#1a1a1a" : "#bbb",
          fontFamily: mono ? "monospace" : undefined,
          wordBreak: "break-all",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function SuperadminUsersPage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;

  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useQuery(
    (api as any).adminUsers.getUserCategoryCounts,
    adminId ? { adminId } : "skip"
  );

  const data = useQuery(
    (api as any).adminUsers.getAllUsers,
    adminId
      ? { adminId, page, pageSize: PAGE_SIZE, categoryFilter, stateFilter, search }
      : "skip"
  );

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        Loading user information...
      </div>
    );
  }

  if (authStatus === "unauthenticated" || user?.role !== "admin") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: "clamp(1rem, 3vw, 2rem)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <a
            href="/farmer/dashboard"
            style={{
              padding: "0.5rem 1rem",
              background: "#2e7d32",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            🏠 Back to Home
          </a>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 4vw, 1.8rem)", color: "#1a1a1a" }}>
            👥 Users
          </h1>
        </div>

        {/* Category summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <button
            onClick={() => { setCategoryFilter("all"); setPage(1); }}
            style={{
              background: categoryFilter === "all" ? "#2e7d32" : "#fff",
              color: categoryFilter === "all" ? "#fff" : "#1a1a1a",
              border: "1px solid #e0e0e0",
              borderRadius: 10,
              padding: "0.85rem",
              textAlign: "left",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{counts ? counts.total : "—"}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>All users</div>
          </button>

          {(counts?.categories ?? []).map((c: any) => {
            const selected = categoryFilter === c.category;
            const palette = CATEGORY_COLORS[c.category] ?? { bg: "#eee", color: "#555" };
            return (
              <button
                key={c.category}
                onClick={() => { setCategoryFilter(c.category); setPage(1); }}
                style={{
                  background: selected ? palette.color : "#fff",
                  color: selected ? "#fff" : "#1a1a1a",
                  border: "1px solid #e0e0e0",
                  borderRadius: 10,
                  padding: "0.85rem",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{c.total}</div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                  {CATEGORY_LABELS[c.category] ?? c.category}
                </div>
                <div style={{ fontSize: "0.72rem", opacity: 0.7, marginTop: "0.2rem" }}>
                  {c.active} active · {c.suspended} suspended
                </div>
              </button>
            );
          })}
        </div>

        {counts?.truncated && (
          <p style={{ fontSize: "0.8rem", color: "#e65100", marginTop: "-0.75rem", marginBottom: "1rem" }}>
            Counts are capped at 1,000 per category — actual totals may be higher.
          </p>
        )}

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ fontSize: "0.9rem", color: "#333" }}>
            Category:
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              style={{
                marginLeft: "0.5rem",
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: "0.9rem", color: "#333" }}>
            State:
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
              style={{
                marginLeft: "0.5rem",
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All states</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
              placeholder="Search name, phone, email, alias"
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: "0.9rem",
                minWidth: 240,
              }}
            />
            <button
              onClick={applySearch}
              style={{
                padding: "0.45rem 0.9rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
                style={{
                  padding: "0.45rem 0.7rem",
                  background: "#f5f5f5",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {data && (
            <span style={{ fontSize: "0.85rem", color: "#666" }}>
              Showing {data.items.length} users (Page {data.currentPage})
            </span>
          )}
        </div>

        {data?.windowTruncated && (
          <div
            style={{
              background: "#fff8e1",
              border: "1px solid #ffe082",
              color: "#e65100",
              borderRadius: 8,
              padding: "0.7rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            Showing the most recent 2,000 accounts for this view. Narrow by category, state or
            search to reach users outside that range.
          </div>
        )}

        {notice && (
          <div
            style={{
              background: "#e8f5e9",
              border: "1px solid #a5d6a7",
              color: "#2e7d32",
              borderRadius: 8,
              padding: "0.7rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.9rem",
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#2e7d32", fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            overflowX: "auto",
          }}
        >
          {data === undefined ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>Loading users...</div>
          ) : !data.items.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
              No users found for the selected filters.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                  <th style={headerCellStyle}>Name / Alias</th>
                  <th style={headerCellStyle}>Contact</th>
                  <th style={headerCellStyle}>Category</th>
                  <th style={headerCellStyle}>State</th>
                  <th style={headerCellStyle}>Joined</th>
                  <th style={headerCellStyle}>Last active</th>
                  <th style={headerCellStyle}>Location</th>
                  <th style={{ ...headerCellStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: any) => (
                  <UserRow
                    key={item.userId}
                    user={item}
                    adminId={adminId as Id<"users">}
                    onResetPassword={setResetTarget}
                    onNotify={setNotice}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && (data.currentPage > 1 || data.hasMore) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "1.5rem",
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: "0.5rem 1rem",
                background: page <= 1 ? "#e0e0e0" : "#1976d2",
                color: page <= 1 ? "#999" : "#fff",
                border: "none",
                borderRadius: 6,
                cursor: page <= 1 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: "0.9rem", color: "#333", fontWeight: 600 }}>
              Page {data.currentPage}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              style={{
                padding: "0.5rem 1rem",
                background: !data.hasMore ? "#e0e0e0" : "#1976d2",
                color: !data.hasMore ? "#999" : "#fff",
                border: "none",
                borderRadius: 6,
                cursor: !data.hasMore ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {resetTarget && adminId && (
        <ResetPasswordDialog
          adminId={adminId}
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
