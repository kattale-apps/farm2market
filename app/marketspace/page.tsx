"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import nextDynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ugandaDateFromInstant } from "../../convex/exportMarketsShared";
import { getUgandaTime } from "../utils/timeUtils";
import { AdForm, type EditableAd } from "./components/AdForm";
import { Discover, type Chip } from "./components/Discover";
import { MyAds } from "./components/MyAds";
import { MyLots } from "./components/MyLots";
import { TopBar } from "./components/TopBar";
import { FONT, GLASS, useMarketspaceSession, useUgandaNow } from "./components/shared";

// The QR decoder loads only when someone taps Scan QR, so the board stays light on slow phones.
const QrScanSheet = nextDynamic(() => import("./components/QrScanSheet").then((m) => m.QrScanSheet), { ssr: false });

type Tab = "discover" | "post" | "mine";
const CHIPS: Chip[] = ["all", "produce", "bulk", "lots", "classifieds"];
const SELLER_ROLES = ["farmer", "vendor", "store", "trader"];

export default function MarketspacePage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem", fontFamily: FONT }}>Loading MarketSpace…</p>}>
      <MarketspaceInner />
    </Suspense>
  );
}

/**
 * MarketSpace: the one market every member and visitor uses. Scan a
 * Farm2Market QR code or Discover every post (farmers' produce, bulk lots,
 * processors' and vendors' lots, classified ads). Sellers vend their lot
 * listings here and post classified ads; MarketSpace is anonymous, with
 * category badges and aliases instead of phone numbers.
 */
function MarketspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useMarketspaceSession();
  const token = session.token;
  const config = useQuery(api.marketspace.getBoardConfig, {});
  const me = useQuery(api.marketspace.getMyContext, token ? { sessionToken: token } : "skip");
  const liveNow = useUgandaNow();
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));

  const viewParam = params.get("view");
  const initialChip: Chip = CHIPS.includes(viewParam as Chip) ? (viewParam as Chip) : "all";
  const tabParam = params.get("tab");
  const [tab, setTab] = useState<Tab>(tabParam === "post" || tabParam === "mine" ? tabParam : "discover");
  const [onBoard, setOnBoard] = useState(!!viewParam);
  const [scanning, setScanning] = useState(false);
  const [postKind, setPostKind] = useState<"choose" | "lots" | "ad">("choose");
  const [editing, setEditing] = useState<EditableAd | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The board's clock is fixed while browsing, so the list does not reload every minute.
  const [boardNow, setBoardNow] = useState(() => Math.floor(getUgandaTime() / 60000) * 60000);
  useEffect(() => setBoardNow(Math.floor(getUgandaTime() / 60000) * 60000), [onBoard]);

  const isUser = session.status === "user" && !!me;
  const viewerStatus = session.status === "user" && me === null ? "guest" : session.status;
  const isSeller = !!me && SELLER_ROLES.includes(me.role);

  const go = (t: Tab) => {
    setTab(t);
    setNotice(null);
    if (t !== "post") setEditing(null);
    if (t === "post") setPostKind(isSeller ? "choose" : "ad");
  };
  const tabButton = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => go(t)}
      style={{ flex: 1, minHeight: 44, border: "none", borderBottom: `3px solid ${tab === t ? "#2e7d32" : "transparent"}`, background: "none", fontWeight: 800, fontSize: "0.92rem", color: tab === t ? "#1b5e20" : "#666", fontFamily: FONT, cursor: "pointer" }}
    >
      {label}
    </button>
  );
  const bigTile: React.CSSProperties = {
    flex: 1,
    minHeight: 130,
    borderRadius: 18,
    border: "2px solid #c8e6c9",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    fontWeight: 800,
    fontSize: "1.05rem",
    fontFamily: FONT,
    color: "#1b5e20",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
  };
  const section: React.CSSProperties = { ...GLASS, padding: "1rem", borderRadius: 14, marginBottom: "1rem" };

  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT }}>
      <TopBar status={viewerStatus} showAdmin={!!me?.canModerate || !!me?.isSuperAdmin} />

      {isUser && (
        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e6e6e6", position: "sticky", top: 57, zIndex: 40 }}>
          {tabButton("discover", "Discover")}
          {tabButton("post", editing ? "Edit ad" : "Post")}
          {tabButton("mine", "My posts")}
        </nav>
      )}

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1rem" }}>
        {notice && (
          <div style={{ marginBottom: "0.9rem", padding: "0.7rem 0.9rem", borderRadius: 12, background: "#e8f5e9", color: "#1b5e20", fontWeight: 700 }}>✓ {notice}</div>
        )}

        {tab === "discover" && !onBoard && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", maxWidth: 520, margin: "1.5rem auto" }}>
            <p style={{ ...GLASS, margin: 0, padding: "0.7rem 1rem", textAlign: "center", color: "#1b5e20", fontWeight: 700 }}>Farm produce, bulk lots and services from across Uganda.</p>
            <div style={{ display: "flex", gap: "0.9rem" }}>
              <button type="button" onClick={() => setScanning(true)} style={bigTile}>
                <span style={{ fontSize: "2.4rem" }}>📷</span>
                Scan QR
              </button>
              <button type="button" onClick={() => setOnBoard(true)} style={bigTile}>
                <span style={{ fontSize: "2.4rem" }}>🔎</span>
                Discover
              </button>
            </div>
          </div>
        )}

        {tab === "discover" && onBoard && config && (
          <Discover
            token={token}
            today={today}
            boardNow={boardNow}
            liveNow={liveNow}
            groups={config.groups}
            initialChip={initialChip}
            onChipChange={(chip) => router.replace(`/marketspace?view=${chip}`, { scroll: false })}
          />
        )}

        {tab === "post" && isUser && token && config && (
          <>
            {postKind === "choose" && isSeller && !editing && (
              <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setPostKind("lots")} style={{ ...bigTile, minWidth: 220 }}>
                  <span style={{ fontSize: "2.2rem" }}>🌾</span>
                  Sell lots from my ledger
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#555" }}>Buyers pay in steps through the app</span>
                </button>
                <button type="button" onClick={() => setPostKind("ad")} style={{ ...bigTile, minWidth: 220 }}>
                  <span style={{ fontSize: "2.2rem" }}>📰</span>
                  Post a classified ad
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#555" }}>Services, equipment, wanted</span>
                </button>
              </div>
            )}
            {postKind === "lots" && !editing && (
              <div style={section}>
                <h3 style={{ marginTop: 0 }}>Sell lots from my ledger</h3>
                <MyLots token={token} now={liveNow} />
              </div>
            )}
            {(postKind === "ad" || editing) && (
              <AdForm
                key={editing?._id ?? "new"}
                sessionToken={token}
                groups={config.groups}
                defaultPhone={me?.phoneNumber ?? null}
                settings={me!.settings}
                nextAd={me!.nextAd}
                farmcoinBalance={me?.farmcoinBalance ?? null}
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
          </>
        )}

        {tab === "mine" && isUser && token && (
          <>
            {isSeller && (
              <div style={section}>
                <h3 style={{ marginTop: 0 }}>My lots</h3>
                <MyLots token={token} now={liveNow} />
              </div>
            )}
            <div style={section}>
              <h3 style={{ marginTop: 0 }}>My classified ads</h3>
              <MyAds
                sessionToken={token}
                now={liveNow}
                farmcoinBalance={me?.farmcoinBalance ?? null}
                settings={me!.settings}
                onEdit={(ad) => {
                  setEditing(ad);
                  setNotice(null);
                  setTab("post");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onPostNew={() => {
                  setEditing(null);
                  setNotice(null);
                  setPostKind("ad");
                  setTab("post");
                }}
              />
            </div>
          </>
        )}
      </main>

      {scanning && <QrScanSheet onClose={() => setScanning(false)} />}
    </div>
  );
}
