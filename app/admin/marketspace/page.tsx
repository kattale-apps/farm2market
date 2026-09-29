"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { REPORT_REASONS } from "../../../convex/marketspaceShared";
import { AdCard } from "../../marketspace/components/AdCard";
import { SettingsCard } from "../../marketspace/components/SettingsCard";
import { TopBar } from "../../marketspace/components/TopBar";
import { FONT, formatDate, tint, useMarketspaceSession, useUgandaNow, type AdCardData } from "../../marketspace/components/shared";

type Section = "moderation" | "categories" | "settings";

const errorText = (e: any) => e?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Something went wrong.";

/** Marketspace admin: moderation for admins; categories and settings for the super admin. */
export default function MarketspaceAdminPage() {
  const session = useMarketspaceSession();
  const token = session.token;
  const me = useQuery(api.marketspace.getMyContext, token ? { sessionToken: token } : "skip");
  const [section, setSection] = useState<Section>("moderation");

  if (session.status === "loading" || (token && me === undefined)) {
    return <p style={{ fontFamily: FONT, textAlign: "center", padding: "3rem" }}>Loading…</p>;
  }
  if (!token || !me || !(me.canModerate || me.isSuperAdmin)) {
    return (
      <div style={{ fontFamily: FONT, textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ fontWeight: 700 }}>This page is for Marketspace admins.</p>
        <Link href="/marketspace" style={{ color: "#1b5e20", fontWeight: 800 }}>
          Go to Marketspace →
        </Link>
      </div>
    );
  }

  const sections: { key: Section; label: string; show: boolean }[] = [
    { key: "moderation", label: "🚩 Moderation", show: me.canModerate },
    { key: "categories", label: "🗂️ Groups & categories", show: me.isSuperAdmin },
    { key: "settings", label: "⚙️ Settings", show: me.isSuperAdmin },
  ];
  const visible = sections.filter((s) => s.show);
  const active = visible.some((s) => s.key === section) ? section : visible[0].key;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f4", fontFamily: FONT }}>
      <TopBar status="user" />
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "1rem" }}>
        <h1 style={{ fontSize: "1.3rem", margin: "0.25rem 0 0.75rem" }}>Marketspace admin</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {visible.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              style={{ minHeight: 42, padding: "0 1rem", borderRadius: 999, border: `2px solid ${active === s.key ? "#2e7d32" : "#ddd"}`, background: active === s.key ? "#e8f5e9" : "#fff", fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {active === "moderation" && <Moderation token={token} />}
        {active === "categories" && <Categories token={token} />}
        {active === "settings" && <SettingsCard token={token} />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------
// Moderation
// ------------------------------------------------------------------

function Moderation({ token }: { token: string }) {
  const now = useUgandaNow();
  const queue = useQuery(api.marketspace.moderationQueue, { sessionToken: token, now });
  const removeAd = useMutation(api.marketspace.removeAd);
  const dismissReports = useMutation(api.marketspace.dismissReports);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const remove = async (ad: AdCardData) => {
    const reason = window.prompt(`Remove "${ad.title}" from Marketspace? The advertiser is told the reason.\n\nReason:`);
    if (!reason) return;
    try {
      await removeAd({ sessionToken: token, adId: ad._id as Id<"marketspaceAds">, reason });
      setMessage({ ok: true, text: "Ad removed and the advertiser notified." });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    }
  };
  const dismiss = async (adId: string) => {
    try {
      await dismissReports({ sessionToken: token, adId: adId as Id<"marketspaceAds"> });
      setMessage({ ok: true, text: "Reports dismissed. The ad stays up." });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    }
  };

  if (queue === undefined) return <p>Loading…</p>;
  if (queue === null) return <p>You cannot moderate Marketspace.</p>;
  const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
  const danger: React.CSSProperties = { minHeight: 40, padding: "0 0.9rem", borderRadius: 10, border: "none", background: "#c62828", color: "#fff", fontWeight: 800, fontFamily: FONT, cursor: "pointer" };

  return (
    <div>
      {message && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600 }}>
          {message.text}
        </div>
      )}
      <h2 style={{ fontSize: "1.05rem" }}>Reported ads ({queue.reported.length})</h2>
      {queue.reported.length === 0 && <p style={{ color: "#666" }}>No open reports.</p>}
      <div style={{ display: "grid", gap: "0.9rem" }}>
        {queue.reported.map(({ ad, reports }) => (
          <div key={ad._id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 200px) 1fr", gap: "0.9rem", background: "#fff", borderRadius: 14, padding: "0.8rem", border: "1.5px solid #f3c1c1" }}>
            <AdCard ad={ad as AdCardData} now={now} variant="grid" />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {reports.length} report{reports.length === 1 ? "" : "s"} · status: {ad.status}
                {ad.removedReason ? ` (${ad.removedReason})` : ""}
              </div>
              <ul style={{ margin: "0 0 0.6rem", paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
                {reports.map((r) => (
                  <li key={r._id}>
                    <strong>{reasonLabel(r.reason)}</strong>
                    {r.details ? `: ${r.details}` : ""} <span style={{ color: "#888" }}>({r.byGuest ? "guest" : "member"}, {formatDate(r.createdAt)})</span>
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.6rem" }}>Contact on ad: {ad.contactPhone} · Ref {ad.utid}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {ad.status !== "removed" && (
                  <button type="button" onClick={() => remove(ad as AdCardData)} style={danger}>
                    Remove ad
                  </button>
                )}
                <button type="button" onClick={() => dismiss(ad._id)} style={{ ...danger, background: "#fff", color: "#333", border: "1.5px solid #ccc" }}>
                  Dismiss reports
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1.05rem", marginTop: "1.5rem" }}>Newest ads on the board</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.75rem" }}>
        {queue.recent.map((ad) => (
          <div key={ad._id} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <AdCard ad={ad as AdCardData} now={now} variant="grid" />
            <button type="button" onClick={() => remove(ad as AdCardData)} style={{ ...danger, minHeight: 34, fontSize: "0.8rem" }}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Groups and categories (super admin)
// ------------------------------------------------------------------

type GroupDraft = { id?: string; name: string; icon: string; color: string; sortOrder: number; active: boolean };
type CategoryDraft = { id?: string; groupId: string; name: string; icon: string; sortOrder: number; active: boolean };

function Categories({ token }: { token: string }) {
  const taxonomy = useQuery(api.marketspace.adminTaxonomy, { sessionToken: token });
  const saveGroup = useMutation(api.marketspace.saveGroup);
  const deleteGroup = useMutation(api.marketspace.deleteGroup);
  const saveCategory = useMutation(api.marketspace.saveCategory);
  const deleteCategory = useMutation(api.marketspace.deleteCategory);
  const addStarters = useMutation(api.marketspace.addStarterCategories);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [catDraft, setCatDraft] = useState<CategoryDraft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: done });
      return true;
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
      return false;
    }
  };

  if (taxonomy === undefined) return <p>Loading…</p>;
  if (taxonomy === null) return <p>Only the super admin can manage categories.</p>;

  const input: React.CSSProperties = { padding: "0.55rem", borderRadius: 8, border: "1px solid #ccc", fontFamily: FONT, fontSize: "0.9rem", minWidth: 0 };
  const small = (color: string, filled = false): React.CSSProperties => ({ minHeight: 34, padding: "0 0.7rem", borderRadius: 8, border: `1.5px solid ${color}`, background: filled ? color : "#fff", color: filled ? "#fff" : color, fontWeight: 700, fontSize: "0.8rem", fontFamily: FONT, cursor: "pointer" });

  return (
    <div>
      {message && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600 }}>
          {message.text}
        </div>
      )}
      <p style={{ color: "#555", fontSize: "0.9rem", marginTop: 0 }}>
        Groups set the card colour (e.g. Goods, Services). Advertisers post under a category inside a group. Hiding a group or category takes its ads off the board; a category with ads can be hidden but not deleted.
      </p>

      {taxonomy.length === 0 && (
        <div style={{ padding: "1rem", background: "#fff", borderRadius: 12, marginBottom: "1rem" }}>
          <p style={{ marginTop: 0 }}>There are no groups yet.</p>
          <button type="button" onClick={() => act(() => addStarters({ sessionToken: token }), "Starter groups and categories added.")} style={small("#2e7d32", true)}>
            Add starter groups (Goods, Services)
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem" }}>
        {taxonomy.map((g) => (
          <div key={g._id} style={{ background: "#fff", borderRadius: 14, border: `2px solid ${g.active ? g.color : "#ccc"}`, overflow: "hidden", opacity: g.active ? 1 : 0.75 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", background: tint(g.color, 0.12) }}>
              <span style={{ fontSize: "1.4rem" }}>{g.icon}</span>
              <strong style={{ color: g.color }}>{g.name}</strong>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>
                order {g.sortOrder} · {g.active ? "visible" : "hidden"}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: "0.35rem" }}>
                <button type="button" onClick={() => setGroupDraft({ id: g._id, name: g.name, icon: g.icon, color: g.color, sortOrder: g.sortOrder, active: g.active })} style={small("#1565c0")}>
                  Edit
                </button>
                <button type="button" onClick={() => act(() => saveGroup({ sessionToken: token, groupId: g._id, name: g.name, icon: g.icon, color: g.color, sortOrder: g.sortOrder, active: !g.active }), g.active ? "Group hidden." : "Group visible.")} style={small("#555")}>
                  {g.active ? "Hide" : "Show"}
                </button>
                <button type="button" onClick={() => window.confirm(`Delete group "${g.name}"?`) && act(() => deleteGroup({ sessionToken: token, groupId: g._id }), "Group deleted.")} style={small("#c62828")}>
                  Delete
                </button>
              </span>
            </div>
            <div style={{ padding: "0.6rem 0.8rem", display: "grid", gap: "0.4rem" }}>
              {g.categories.map((c) => (
                <div key={c._id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid #f1f1f1", opacity: c.active ? 1 : 0.6 }}>
                  <span>{c.icon}</span>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ fontSize: "0.72rem", color: "#777" }}>
                    order {c.sortOrder} · {c.active ? "visible" : "hidden"}
                    {c.inUse ? " · has ads" : ""}
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: "0.35rem" }}>
                    <button type="button" onClick={() => setCatDraft({ id: c._id, groupId: g._id, name: c.name, icon: c.icon, sortOrder: c.sortOrder, active: c.active })} style={small("#1565c0")}>
                      Edit
                    </button>
                    <button type="button" onClick={() => act(() => saveCategory({ sessionToken: token, categoryId: c._id, groupId: g._id, name: c.name, icon: c.icon, sortOrder: c.sortOrder, active: !c.active }), c.active ? "Category hidden." : "Category visible.")} style={small("#555")}>
                      {c.active ? "Hide" : "Show"}
                    </button>
                    {!c.inUse && (
                      <button type="button" onClick={() => window.confirm(`Delete category "${c.name}"?`) && act(() => deleteCategory({ sessionToken: token, categoryId: c._id }), "Category deleted.")} style={small("#c62828")}>
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ))}
              <button type="button" onClick={() => setCatDraft({ groupId: g._id, name: "", icon: "", sortOrder: g.categories.length + 1, active: true })} style={{ ...small("#2e7d32"), justifySelf: "start" }}>
                ＋ Add category to {g.name}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setGroupDraft({ name: "", icon: "", color: "#6a1b9a", sortOrder: taxonomy.length + 1, active: true })} style={{ ...small("#2e7d32", true), marginTop: "1rem", minHeight: 42 }}>
        ＋ New group
      </button>

      {groupDraft && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#fff", borderRadius: 12, border: "1.5px solid #2e7d32", display: "grid", gap: "0.6rem", maxWidth: 480 }}>
          <strong>{groupDraft.id ? "Edit group" : "New group"}</strong>
          <input style={input} placeholder="Name, e.g. Goods" value={groupDraft.name} onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })} />
          <input style={input} placeholder="Icon (an emoji), e.g. 🧺" value={groupDraft.icon} onChange={(e) => setGroupDraft({ ...groupDraft, icon: e.target.value })} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Card colour <input type="color" value={groupDraft.color} onChange={(e) => setGroupDraft({ ...groupDraft, color: e.target.value })} />
            <span style={{ color: "#777", fontSize: "0.85rem" }}>{groupDraft.color}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Display order <input type="number" style={{ ...input, width: 80 }} value={groupDraft.sortOrder} onChange={(e) => setGroupDraft({ ...groupDraft, sortOrder: Number(e.target.value) || 0 })} />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              style={small("#2e7d32", true)}
              onClick={async () => {
                const ok = await act(
                  () => saveGroup({ sessionToken: token, groupId: groupDraft.id as Id<"marketspaceGroups"> | undefined, name: groupDraft.name, icon: groupDraft.icon, color: groupDraft.color, sortOrder: groupDraft.sortOrder, active: groupDraft.active }),
                  "Group saved."
                );
                if (ok) setGroupDraft(null);
              }}
            >
              Save group
            </button>
            <button type="button" style={small("#555")} onClick={() => setGroupDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {catDraft && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#fff", borderRadius: 12, border: "1.5px solid #2e7d32", display: "grid", gap: "0.6rem", maxWidth: 480 }}>
          <strong>{catDraft.id ? "Edit category" : "New category"}</strong>
          <label style={{ display: "grid", gap: 4 }}>
            Group
            <select style={input} value={catDraft.groupId} onChange={(e) => setCatDraft({ ...catDraft, groupId: e.target.value })}>
              {taxonomy.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.icon} {g.name}
                </option>
              ))}
            </select>
          </label>
          <input style={input} placeholder="Name, e.g. Rental services" value={catDraft.name} onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} />
          <input style={input} placeholder="Icon (an emoji), e.g. 🔑" value={catDraft.icon} onChange={(e) => setCatDraft({ ...catDraft, icon: e.target.value })} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Display order <input type="number" style={{ ...input, width: 80 }} value={catDraft.sortOrder} onChange={(e) => setCatDraft({ ...catDraft, sortOrder: Number(e.target.value) || 0 })} />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              style={small("#2e7d32", true)}
              onClick={async () => {
                const ok = await act(
                  () =>
                    saveCategory({
                      sessionToken: token,
                      categoryId: catDraft.id as Id<"marketspaceCategories"> | undefined,
                      groupId: catDraft.groupId as Id<"marketspaceGroups">,
                      name: catDraft.name,
                      icon: catDraft.icon,
                      sortOrder: catDraft.sortOrder,
                      active: catDraft.active,
                    }),
                  "Category saved."
                );
                if (ok) setCatDraft(null);
              }}
            >
              Save category
            </button>
            <button type="button" style={small("#555")} onClick={() => setCatDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
