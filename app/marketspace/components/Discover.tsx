"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AcceptedOffers } from "../../components/lots/AcceptedOffers";
import { MarketCard, type CardLayout, type MarketCardData } from "./MarketCard";
import { DISTRICTS, FONT, GLASS, tint } from "./shared";

export type Chip = "all" | "produce" | "farmgate" | "bulk" | "lots" | "classifieds";

const CHIPS: { key: Chip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "produce", label: "🌾 Farmers Produce" },
  { key: "farmgate", label: "🚜 Farm Gate" }, // Verified processors and exporters only: farmers' lots not on MarketSpace
  { key: "bulk", label: "📦 Local Bulk" },
  { key: "lots", label: "🏪 Vendors and Processors" },
  { key: "classifieds", label: "📰 Classifieds" },
];

type Groups = NonNullable<FunctionReturnType<typeof api.marketspace.getBoardConfig>>["groups"];

/** The Vendors and Processors market, filtered by who sells (exporters sell lots there too). */
const SELLER_CHIPS: { key: string; label: string }[] = [
  { key: "", label: "All Sellers" },
  { key: "vendor", label: "Vendors" },
  { key: "store", label: "Processors" },
  { key: "trader", label: "Exporters" },
];

const LAYOUTS: { key: CardLayout; label: string }[] = [
  { key: "list", label: "☰ List" },
  { key: "grid", label: "▦ Grid" },
  { key: "swipe", label: "👆 Swipe" },
];
const LAYOUT_KEY = "f2m_marketspace_layout"; // Each phone remembers its view

/** One big card at a time: swipe left and right (arrows on a computer). Loads more near the end. */
function SwipeRow({ cards, now, hasMore, onLoadMore }: { cards: MarketCardData[]; now: number; hasMore: boolean; onLoadMore: () => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const step = () => (row.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (step() + 12));
    setIndex(i);
    if (hasMore && i >= cards.length - 2) onLoadMore();
  };
  const go = (delta: number) => row.current?.scrollBy({ left: delta * (step() + 12), behavior: "smooth" });
  const arrow = (disabled: boolean): React.CSSProperties => ({ ...GLASS, width: 46, height: 46, borderRadius: 999, border: "none", fontSize: "1.2rem", fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 });
  return (
    <div>
      <div
        ref={row}
        onScroll={onScroll}
        style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", padding: "0.25rem 7% 0.75rem", margin: "0 -1rem", scrollbarWidth: "none" }}
      >
        {cards.map((card) => (
          <div key={card.cardId} style={{ flex: "0 0 min(86vw, 420px)", scrollSnapAlign: "center" }}>
            <MarketCard card={card} now={now} layout="swipe" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <button type="button" aria-label="Previous" disabled={index <= 0} onClick={() => go(-1)} style={arrow(index <= 0)}>←</button>
        <span style={{ ...GLASS, padding: "0.35rem 0.8rem", fontWeight: 800, fontSize: "0.9rem" }}>
          {Math.min(index + 1, cards.length)} / {cards.length}{hasMore ? "+" : ""}
        </span>
        <button type="button" aria-label="Next" disabled={index >= cards.length - 1} onClick={() => go(1)} style={arrow(index >= cards.length - 1)}>→</button>
      </div>
    </div>
  );
}

/**
 * The MarketSpace board: one search bar, chips for the market views and
 * "More filters". Every post is a card; the server decides how much of it
 * the viewer may see.
 */
export function Discover({
  token,
  today,
  boardNow,
  liveNow,
  groups,
  initialChip,
  onChipChange,
}: {
  token: string | null;
  today: string;
  boardNow: number;
  liveNow: number;
  groups: Groups;
  initialChip: Chip;
  onChipChange: (chip: Chip) => void;
}) {
  const me = useQuery(api.marketspace.myTier, { today, sessionToken: token ?? undefined });
  const [chip, setChip] = useState<Chip>(initialChip);
  const [kind, setKind] = useState<"all" | "offer" | "wanted">("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [district, setDistrict] = useState("");
  const [stockSource, setStockSource] = useState("");
  const [sellerRole, setSellerRole] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [layout, setLayout] = useState<CardLayout>("list");

  // The remembered view; storage can be blocked (private mode), so the list view is the fallback
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved === "list" || saved === "grid" || saved === "swipe") setLayout(saved);
    } catch {}
  }, []);
  const pickLayout = (l: CardLayout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {}
  };

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const pickChip = (c: Chip) => {
    setChip(c);
    setCategoryId(null);
    setKind("all");
    setSellerRole("");
    onChipChange(c);
  };

  const verified = me?.tier === "verified";
  // Verified processors and exporters buy at the farm gate: they see every farmer's lots
  const seesFarmGate = verified && (me?.role === "store" || me?.role === "trader");
  const chips = CHIPS.filter((c) => c.key !== "farmgate" || seesFarmGate);
  const filters = {
    now: boardNow,
    today,
    sessionToken: token ?? undefined,
    view: chip === "produce" || chip === "lots" || chip === "classifieds" ? chip : undefined,
    bulk: chip === "bulk" ? true : undefined,
    farmGate: chip === "farmgate" ? true : undefined,
    kind: chip === "classifieds" && kind !== "all" ? kind : undefined,
    categoryId: chip === "classifieds" && categoryId ? (categoryId as Id<"marketspaceCategories">) : undefined,
    district: district || undefined,
    stockSource: (stockSource || undefined) as "own_farm" | "in_app" | "off_app" | undefined,
    sellerRole: sellerRole || undefined,
    minPricePerKilo: verified && Number(minPrice) > 0 ? Number(minPrice) : undefined,
    maxPricePerKilo: verified && Number(maxPrice) > 0 ? Number(maxPrice) : undefined,
  };
  const { results, status, loadMore } = usePaginatedQuery(api.marketspace.discover, debounced ? "skip" : filters, { initialNumItems: 12 });
  const searchResults = useQuery(api.marketspace.searchCards, debounced ? { ...filters, text: debounced } : "skip");
  const cards = (debounced ? searchResults ?? [] : results) as MarketCardData[];
  const loading = debounced ? searchResults === undefined : status === "LoadingFirstPage";
  const hasMore = !debounced && status === "CanLoadMore";
  const onLoadMore = useCallback(() => loadMore(12), [loadMore]);
  const filtersOn = [district, stockSource, sellerRole, minPrice, maxPrice].filter(Boolean).length;

  const chipStyle = (active: boolean, color = "#2e7d32"): React.CSSProperties => ({
    flexShrink: 0,
    minHeight: 40,
    padding: "0 0.85rem",
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
  const select: React.CSSProperties = { minHeight: 42, borderRadius: 10, border: "1.5px solid #ccc", padding: "0 0.6rem", fontFamily: FONT, background: "#fff", width: "100%" };

  return (
    <div>
      {verified && me?.userId && me.role && ["trader", "store", "vendor", "buyer"].includes(me.role) && (
        <AcceptedOffers userId={me.userId} />
      )}

      <div style={{ ...GLASS, padding: "0.75rem", marginBottom: "0.8rem" }}>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search: maize, coffee, tractor hire..."
        aria-label="Search MarketSpace"
        style={{ width: "100%", minHeight: 46, borderRadius: 999, border: "1.5px solid #ccc", padding: "0 1rem", fontFamily: FONT, fontSize: "0.95rem", boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: "0.45rem", overflowX: "auto", padding: "0.7rem 0 0.2rem" }}>
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => pickChip(c.key)} style={chipStyle(chip === c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {chip === "farmgate" && (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#555" }}>
          Farmers&apos; lots that are not on MarketSpace. Only verified processors and exporters see them, to buy at the farm gate.
        </p>
      )}

      {chip === "lots" && (
        <div style={{ display: "flex", gap: "0.45rem", overflowX: "auto", padding: "0.4rem 0 0.1rem" }}>
          {SELLER_CHIPS.map((r) => (
            <button key={r.key || "all"} type="button" onClick={() => setSellerRole(r.key)} style={chipStyle(sellerRole === r.key, "#6d4c00")}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {chip === "classifieds" && (
        <div style={{ display: "flex", gap: "0.45rem", overflowX: "auto", padding: "0.4rem 0 0.1rem" }}>
          {(["all", "offer", "wanted"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} style={chipStyle(kind === k, k === "wanted" ? "#b28704" : "#2e7d32")}>
              {k === "all" ? "Offering & Wanted" : k === "offer" ? "Offering" : "Wanted"}
            </button>
          ))}
          {groups.flatMap((g) => g.categories.map((cat) => ({ ...cat, color: g.color }))).map((cat) => (
            <button key={cat._id} type="button" onClick={() => setCategoryId(categoryId === cat._id ? null : cat._id)} style={chipStyle(categoryId === cat._id, cat.color)}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem", margin: "0.5rem 0" }}>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          style={{ border: "none", background: "none", color: "#1565c0", fontWeight: 800, cursor: "pointer", padding: 0, fontFamily: FONT }}
          aria-expanded={moreOpen}
        >
          {moreOpen ? "▲" : "▼"} More filters{filtersOn ? ` (${filtersOn})` : ""}
        </button>
        <div role="group" aria-label="How to show the posts" style={{ display: "flex", gap: "0.35rem" }}>
          {LAYOUTS.map((l) => (
            <button key={l.key} type="button" aria-pressed={layout === l.key} onClick={() => pickLayout(l.key)} style={{ ...chipStyle(layout === l.key), minHeight: 36, padding: "0 0.6rem", fontSize: "0.78rem" }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {moreOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.4rem", padding: "0.75rem", borderRadius: 12, background: "#fff", border: "1px solid #e3e8e0" }}>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District" style={select}>
            <option value="">📍 All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={stockSource} onChange={(e) => setStockSource(e.target.value)} aria-label="Where the stock is from" style={select}>
            <option value="">Any stock</option>
            <option value="own_farm">From the farm</option>
            <option value="in_app">Traced (bought in the app)</option>
            <option value="off_app">Off-app stock</option>
          </select>
          <select value={sellerRole} onChange={(e) => setSellerRole(e.target.value)} aria-label="Seller" style={select}>
            <option value="">Any seller</option>
            <option value="farmer">Farmers</option>
            <option value="store">Processors</option>
            <option value="vendor">Vendors</option>
            <option value="trader">Exporters</option>
          </select>
          {verified ? (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min UGX/kg" aria-label="Lowest price per kg" style={{ ...select, padding: "0 0.5rem" }} />
              <input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max UGX/kg" aria-label="Highest price per kg" style={{ ...select, padding: "0 0.5rem" }} />
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "#666", alignSelf: "center" }}>Price filters are for verified buyers.</div>
          )}
          {filtersOn > 0 && (
            <button type="button" onClick={() => { setDistrict(""); setStockSource(""); setSellerRole(""); setMinPrice(""); setMaxPrice(""); }} style={{ ...chipStyle(false), minHeight: 42 }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {me && me.tier !== "verified" && (
        <div style={{ marginTop: "0.4rem", padding: "0.6rem 0.8rem", borderRadius: 10, background: "#fff8e1", color: "#6d4c00", fontSize: "0.85rem", fontWeight: 600 }}>
          {me.tier === "public" ? (
            <>
              🔒 You see a preview. <Link href={`/login?role=buyer&returnTo=${encodeURIComponent(`/marketspace?view=${chip}`)}`} style={{ color: "#1b5e20", fontWeight: 800 }}>Sign up as a buyer</Link> to see prices and full details.
            </>
          ) : (
            <>🔒 Farm produce and lots show a preview until Farm2Market verifies you as a buyer.</>
          )}
        </div>
      )}
      </div>

      {loading ? (
        <p style={{ ...GLASS, textAlign: "center", color: "#555", padding: "1.5rem 0", fontWeight: 700 }}>Loading…</p>
      ) : cards.length === 0 ? (
        <div style={{ ...GLASS, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: "2rem" }}>🌾</div>
          <p style={{ fontWeight: 700 }}>Nothing here yet. Try another chip or clear the filters.</p>
        </div>
      ) : (
        <>
          {layout === "swipe" ? (
            <SwipeRow cards={cards} now={liveNow} hasMore={hasMore} onLoadMore={onLoadMore} />
          ) : (
            <div
              style={
                layout === "grid"
                  ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem" }
                  : { display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem", maxWidth: 620, margin: "0 auto" }
              }
            >
              {cards.map((card) => (
                <MarketCard key={card.cardId} card={card} now={liveNow} layout={layout} />
              ))}
            </div>
          )}
          {hasMore && layout !== "swipe" && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button type="button" onClick={onLoadMore} style={{ ...chipStyle(true), minHeight: 44 }}>
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
