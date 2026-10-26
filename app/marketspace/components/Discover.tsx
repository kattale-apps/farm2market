"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AcceptedOffers } from "../../components/lots/AcceptedOffers";
import { MarketCard, type MarketCardData } from "./MarketCard";
import { DISTRICTS, FONT, tint } from "./shared";

export type Chip = "all" | "produce" | "bulk" | "lots" | "classifieds";

const CHIPS: { key: Chip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "produce", label: "🌾 Farmers Produce" },
  { key: "bulk", label: "📦 Local Bulk" },
  { key: "lots", label: "🏭 Processors & Vendors" },
  { key: "classifieds", label: "📰 Classifieds" },
];

type Groups = NonNullable<FunctionReturnType<typeof api.marketspace.getBoardConfig>>["groups"];

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

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const pickChip = (c: Chip) => {
    setChip(c);
    setCategoryId(null);
    setKind("all");
    onChipChange(c);
  };

  const verified = me?.tier === "verified";
  const filters = {
    now: boardNow,
    today,
    sessionToken: token ?? undefined,
    view: chip === "produce" || chip === "lots" || chip === "classifieds" ? chip : undefined,
    bulk: chip === "bulk" ? true : undefined,
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
      {verified && me?.userId && me.role && ["trader", "transporter", "store", "vendor", "buyer"].includes(me.role) && (
        <AcceptedOffers userId={me.userId} />
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search: maize, coffee, tractor hire..."
        aria-label="Search MarketSpace"
        style={{ width: "100%", minHeight: 46, borderRadius: 999, border: "1.5px solid #ccc", padding: "0 1rem", fontFamily: FONT, fontSize: "0.95rem", boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: "0.45rem", overflowX: "auto", padding: "0.7rem 0 0.2rem" }}>
        {CHIPS.map((c) => (
          <button key={c.key} type="button" onClick={() => pickChip(c.key)} style={chipStyle(chip === c.key)}>
            {c.label}
          </button>
        ))}
      </div>

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

      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        style={{ margin: "0.6rem 0", border: "none", background: "none", color: "#1565c0", fontWeight: 800, cursor: "pointer", padding: 0, fontFamily: FONT }}
        aria-expanded={moreOpen}
      >
        {moreOpen ? "▲" : "▼"} More filters{filtersOn ? ` (${filtersOn})` : ""}
      </button>
      {moreOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.8rem", padding: "0.75rem", borderRadius: 12, background: "#fff", border: "1px solid #e3e8e0" }}>
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
        <div style={{ marginBottom: "0.8rem", padding: "0.6rem 0.8rem", borderRadius: 10, background: "#fff8e1", color: "#6d4c00", fontSize: "0.85rem", fontWeight: 600 }}>
          {me.tier === "public" ? (
            <>
              🔒 You see a preview. <Link href={`/login?role=buyer&returnTo=${encodeURIComponent(`/marketspace?view=${chip}`)}`} style={{ color: "#1b5e20", fontWeight: 800 }}>Sign up as a buyer</Link> to see prices and full details.
            </>
          ) : (
            <>🔒 Farm produce and lots show a preview until Farm2Market verifies you as a buyer.</>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#777", padding: "3rem 0" }}>Loading…</p>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: "2px dashed #c8e6c9", borderRadius: 18, background: "#fafffa" }}>
          <div style={{ fontSize: "2rem" }}>🌾</div>
          <p style={{ fontWeight: 700 }}>Nothing here yet. Try another chip or clear the filters.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
            {cards.map((card) => (
              <MarketCard key={card.cardId} card={card} now={liveNow} />
            ))}
          </div>
          {hasMore && (
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
