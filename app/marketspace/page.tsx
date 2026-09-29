"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getUgandaTime } from "../utils/timeUtils";
import { AdCard } from "./components/AdCard";
import { AdDetail } from "./components/AdDetail";
import { AdForm, type EditableAd } from "./components/AdForm";
import { MyAds } from "./components/MyAds";
import { ContactSheet, ReportSheet, Sheet } from "./components/Sheets";
import { SwipeDeck } from "./components/SwipeDeck";
import { TopBar } from "./components/TopBar";
import { UgandaMapIcon } from "./components/UgandaMapIcon";
import { DISTRICTS, FONT, tint, useMarketspaceSession, useUgandaNow, type AdCardData } from "./components/shared";

type Tab = "browse" | "post" | "mine";
type Kind = "all" | "offer" | "wanted";

/**
 * Marketspace: public classified ads from across Uganda. Anyone can browse
 * and contact advertisers without logging in; signed-in users can post and
 * manage their own ads here too.
 */
export default function MarketspacePage() {
  const session = useMarketspaceSession();
  const token = session.token;
  const config = useQuery(api.marketspace.getBoardConfig, {});
  const me = useQuery(api.marketspace.getMyContext, token ? { sessionToken: token } : "skip");
  const liveNow = useUgandaNow();

  const [tab, setTab] = useState<Tab>("browse");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [district, setDistrict] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [view, setView] = useState<"swipe" | "grid">("swipe");
  const [detail, setDetail] = useState<AdCardData | null>(null);
  const [contact, setContact] = useState<AdCardData | null>(null);
  const [report, setReport] = useState<AdCardData | null>(null);
  const [editing, setEditing] = useState<EditableAd | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The board's clock is fixed while browsing a filter, so the list does not reload every minute.
  const [boardNow, setBoardNow] = useState(() => Math.floor(getUgandaTime() / 60000) * 60000);
  useEffect(() => setBoardNow(Math.floor(getUgandaTime() / 60000) * 60000), [groupId, categoryId, kind, district]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("marketspace_view");
      if (saved === "grid" || saved === "swipe") setView(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const chooseView = (v: "swipe" | "grid") => {
    setView(v);
    try {
      localStorage.setItem("marketspace_view", v);
    } catch {
      /* storage unavailable */
    }
  };

  const filters = {
    now: boardNow,
    groupId: (groupId ?? undefined) as Id<"marketspaceGroups"> | undefined,
    categoryId: (categoryId ?? undefined) as Id<"marketspaceCategories"> | undefined,
    kind: kind === "all" ? undefined : kind,
    district: district || undefined,
  };
  const { results, status, loadMore } = usePaginatedQuery(api.marketspace.listAds, debounced ? "skip" : filters, { initialNumItems: 12 });
  const searchResults = useQuery(api.marketspace.searchAds, debounced ? { ...filters, text: debounced } : "skip");

  const ads = (debounced ? searchResults ?? [] : results) as AdCardData[];
  const loading = debounced ? searchResults === undefined : status === "LoadingFirstPage";
  const hasMore = !debounced && status === "CanLoadMore";
  const onLoadMore = useCallback(() => loadMore(12), [loadMore]);

  const groups = config?.groups ?? [];
  const group = groups.find((g) => g._id === groupId) ?? null;
  const scopeName = useMemo(() => {
    const cat = group?.categories.find((c) => c._id === categoryId);
    return cat ? cat.name : group ? group.name : "Marketspace";
  }, [group, categoryId]);

  const isUser = session.status === "user" && !!me;
  // A stored login whose session has ended browses as a guest.
  const viewerStatus = session.status === "user" && me === null ? "guest" : session.status;
  const tabButton = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(t);
        if (t !== "post") setEditing(null);
        setNotice(null);
      }}
      style={{
        flex: 1,
        minHeight: 44,
        border: "none",
        borderBottom: `3px solid ${tab === t ? "#2e7d32" : "transparent"}`,
        background: "none",
        fontWeight: 800,
        fontSize: "0.92rem",
        color: tab === t ? "#1b5e20" : "#666",
        fontFamily: FONT,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const chip = (active: boolean, color = "#2e7d32"): React.CSSProperties => ({
    flexShrink: 0,
    padding: "0.45rem 0.85rem",
    borderRadius: 999,
    border: `2px solid ${active ? color : "#ddd"}`,
    background: active ? tint(color, 0.12) : "#fff",
    color: active ? color : "#333",
    fontWeight: 700,
    fontSize: "0.85rem",
    fontFamily: FONT,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const endOfDeck = (
    <>
      <div style={{ fontSize: "2.2rem" }}>🎉</div>
      <p style={{ margin: 0, fontWeight: 700 }}>{ads.length === 0 ? `No ads in ${scopeName} yet.` : `You've seen all ads in ${scopeName}.`}</p>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ ...chip(true), minHeight: 44 }}>
        Switch category
      </button>
      {viewerStatus === "guest" ? (
        <Link href="/login" style={{ color: "#1b5e20", fontWeight: 700 }}>
          Sign up free to post your own ad →
        </Link>
      ) : (
        <button type="button" onClick={() => setTab("post")} style={{ ...chip(false), minHeight: 44 }}>
          ＋ Post an ad
        </button>
      )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f4", fontFamily: FONT }}>
      <TopBar status={viewerStatus} showAdmin={!!me?.canModerate || !!me?.isSuperAdmin} />

      {isUser && (
        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e6e6e6", position: "sticky", top: 57, zIndex: 40 }}>
          {tabButton("browse", "Browse")}
          {tabButton("post", editing ? "Edit ad" : "Post ad")}
          {tabButton("mine", "My ads")}
        </nav>
      )}

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1rem" }}>
        {notice && (
          <div style={{ marginBottom: "0.9rem", padding: "0.7rem 0.9rem", borderRadius: 12, background: "#e8f5e9", color: "#1b5e20", fontWeight: 700 }}>
            ✓ {notice}
          </div>
        )}

        {tab === "browse" && (
          <>
            {viewerStatus === "guest" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.7rem", fontSize: "0.85rem", color: "#444" }}>
                <span>Classified ads from across Uganda</span>
                <Link href="/login" style={{ color: "#1b5e20", fontWeight: 800, whiteSpace: "nowrap" }}>
                  Post an ad →
                </Link>
              </div>
            )}

            {/* Groups */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(groups.length + 1, 4)}, minmax(0, 1fr))`, gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => {
                  setGroupId(null);
                  setCategoryId(null);
                }}
                style={{ ...groupTile, borderColor: groupId === null ? "#2e7d32" : "#e0e0e0", background: groupId === null ? "#e8f5e9" : "#fff" }}
              >
                <UgandaMapIcon size={30} />
                <span>All ads</span>
              </button>
              {groups.map((g) => (
                <button
                  key={g._id}
                  type="button"
                  onClick={() => {
                    setGroupId(g._id);
                    setCategoryId(null);
                  }}
                  style={{ ...groupTile, borderColor: groupId === g._id ? g.color : "#e0e0e0", background: groupId === g._id ? tint(g.color, 0.12) : "#fff", color: groupId === g._id ? g.color : "#222" }}
                >
                  <span style={{ fontSize: "1.7rem" }}>{g.icon}</span>
                  <span>{g.name}</span>
                </button>
              ))}
            </div>

            {/* Categories in the chosen group */}
            {group && group.categories.length > 0 && (
              <div style={{ display: "flex", gap: "0.45rem", overflowX: "auto", padding: "0.75rem 0 0.1rem" }}>
                <button type="button" onClick={() => setCategoryId(null)} style={chip(categoryId === null, group.color)}>
                  All {group.name}
                </button>
                {group.categories.map((c) => (
                  <button key={c._id} type="button" onClick={() => setCategoryId(c._id)} style={chip(categoryId === c._id, group.color)}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", margin: "0.7rem 0 0.8rem" }}>
              <div role="group" aria-label="Ad kind" style={{ display: "inline-flex", borderRadius: 999, border: "1.5px solid #ccc", overflow: "hidden", background: "#fff" }}>
                {(["all", "offer", "wanted"] as Kind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    style={{ minHeight: 38, padding: "0 0.8rem", border: "none", background: kind === k ? (k === "wanted" ? "#f6bf26" : "#2e7d32") : "transparent", color: kind === k ? (k === "wanted" ? "#1a1a1a" : "#fff") : "#444", fontWeight: 700, fontSize: "0.82rem", fontFamily: FONT, cursor: "pointer" }}
                  >
                    {k === "all" ? "All" : k === "offer" ? "Offering" : "Wanted"}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="View" style={{ display: "inline-flex", marginLeft: "auto", borderRadius: 999, border: "1.5px solid #ccc", overflow: "hidden", background: "#fff" }}>
                <button type="button" onClick={() => chooseView("swipe")} aria-pressed={view === "swipe"} aria-label="Swipe cards" title="Swipe cards" style={viewBtn(view === "swipe")}>
                  🃏 Swipe
                </button>
                <button type="button" onClick={() => chooseView("grid")} aria-pressed={view === "grid"} aria-label="Grid" title="Grid" style={viewBtn(view === "grid")}>
                  ▦ Grid
                </button>
              </div>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District" style={{ flex: "0 1 150px", minWidth: 0, minHeight: 40, borderRadius: 999, border: "1.5px solid #ccc", padding: "0 0.7rem", fontFamily: FONT, background: "#fff" }}>
                <option value="">📍 All districts</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search ads"
                aria-label="Search ads"
                style={{ flex: "1 1 160px", minWidth: 0, minHeight: 40, borderRadius: 999, border: "1.5px solid #ccc", padding: "0 0.9rem", fontFamily: FONT, fontSize: "0.9rem" }}
              />
            </div>

            {config === undefined || loading ? (
              <p style={{ textAlign: "center", color: "#777", padding: "3rem 0" }}>Loading ads…</p>
            ) : view === "swipe" ? (
              <SwipeDeck ads={ads} now={liveNow} hasMore={hasMore} onLoadMore={onLoadMore} onOpen={setDetail} onContact={setContact} endOfDeck={endOfDeck} />
            ) : ads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: "2px dashed #c8e6c9", borderRadius: 18, background: "#fafffa", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>{endOfDeck}</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "0.75rem" }}>
                  {ads.map((ad) => (
                    <AdCard key={ad._id} ad={ad} now={liveNow} variant="grid" onOpen={() => setDetail(ad)} onContact={() => setContact(ad)} />
                  ))}
                </div>
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "1rem" }}>
                    <button type="button" onClick={onLoadMore} style={{ ...chip(true), minHeight: 44 }}>
                      Show more ads
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "post" && isUser && token && config && (
          <AdForm
            key={editing?._id ?? "new"}
            sessionToken={token}
            groups={config.groups}
            defaultPhone={me?.phoneNumber ?? null}
            editing={editing}
            onCancel={editing ? () => { setEditing(null); setTab("mine"); } : undefined}
            onDone={(msg) => {
              setNotice(msg);
              setEditing(null);
              setTab("mine");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {tab === "mine" && isUser && token && (
          <MyAds
            sessionToken={token}
            now={liveNow}
            farmcoinBalance={me?.farmcoinBalance ?? null}
            extensionCost={me?.extensionCostFarmcoin ?? 0}
            onEdit={(ad) => {
              setEditing(ad);
              setNotice(null);
              setTab("post");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPostNew={() => {
              setEditing(null);
              setNotice(null);
              setTab("post");
            }}
          />
        )}
      </main>

      {detail && (
        <Sheet onClose={() => setDetail(null)} title="Ad details">
          <FullAdDetail
            ad={detail}
            boardNow={boardNow}
            now={liveNow}
            onReport={() => {
              setReport(detail);
              setDetail(null);
            }}
          />
        </Sheet>
      )}
      {contact && <ContactSheet ad={contact} onClose={() => setContact(null)} />}
      {report && <ReportSheet ad={report} sessionToken={token} onClose={() => setReport(null)} />}
    </div>
  );
}

/** The board's cards carry only their first photo, so the detail view loads the whole ad. */
function FullAdDetail({ ad, boardNow, now, onReport }: { ad: AdCardData; boardNow: number; now: number; onReport: () => void }) {
  const full = useQuery(api.marketspace.getAd, { adId: ad._id, now: boardNow }) as AdCardData | null | undefined;
  return <AdDetail ad={full ?? ad} now={now} onReport={onReport} />;
}

const groupTile: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.2rem",
  minHeight: 70,
  borderRadius: 16,
  border: "2px solid #e0e0e0",
  fontWeight: 800,
  fontSize: "0.92rem",
  fontFamily: FONT,
  cursor: "pointer",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

function viewBtn(active: boolean): React.CSSProperties {
  return { minHeight: 38, padding: "0 0.6rem", border: "none", background: active ? "#1b5e20" : "transparent", color: active ? "#fff" : "#444", fontWeight: 700, fontSize: "0.82rem", fontFamily: FONT, cursor: "pointer" };
}
