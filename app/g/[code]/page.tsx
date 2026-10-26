"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { formatUgandaDate, getUgandaTime } from "../../utils/timeUtils";
import { TopBar } from "../../marketspace/components/TopBar";
import { FONT, GLASS, useMarketspaceSession } from "../../marketspace/components/shared";

/** A random key kept on this device, so one visitor counts once an hour. */
function visitorKey(): string {
  const fresh = () => `v${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const kept = window.localStorage.getItem("f2m-visitor");
    if (kept) return kept;
    const key = fresh();
    window.localStorage.setItem("f2m-visitor", key);
    return key;
  } catch {
    return fresh();
  }
}

const KIND: Record<string, string> = { listing: "Listing", batch: "Processing batch", exportLot: "Export lot" };

/**
 * What a goods QR opens: what the good is, who sells it (category and
 * district), how much traces to farms, and the live post. Verified buyers
 * also see the seller's alias and the farms' districts; the owner sees the
 * scans. Never shows a phone number.
 */
export default function GoodsScanPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const session = useMarketspaceSession();
  const [now] = useState(() => Math.floor(getUgandaTime() / 60000) * 60000);
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const info = useQuery(
    api.goodsCodes.resolve,
    code && session.status !== "loading" ? { code, now, today, sessionToken: session.token ?? undefined } : "skip"
  );
  const recordScan = useMutation(api.goodsCodes.recordScan);
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || !code || session.status === "loading") return;
    counted.current = true;
    recordScan({ code, visitorKey: visitorKey(), sessionToken: session.token ?? undefined }).catch(() => {});
  }, [code, session.status, session.token, recordScan]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT }}>
      <TopBar status={session.status} backHref="/marketspace" />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "1rem" }}>{children}</main>
    </div>
  );
  if (info === undefined) return shell(<p style={{ ...GLASS, padding: "1rem", color: "#555" }}>Loading…</p>);
  if (info === null) {
    return shell(
      <div style={{ ...GLASS, textAlign: "center", padding: "2rem 1rem" }}>
        <p style={{ fontWeight: 700 }}>This QR code is not on Farm2Market.</p>
        <Link href="/marketspace" style={{ color: "#1b5e20", fontWeight: 800 }}>Go to MarketSpace →</Link>
      </div>
    );
  }

  const box: React.CSSProperties = { ...GLASS, padding: "0.85rem", marginTop: "0.8rem" };
  const pill: React.CSSProperties = { padding: "0.15rem 0.6rem", borderRadius: 999, background: "#f1f3f0", fontWeight: 700 };
  const trace = info.trace;
  return shell(
    <>
      {info.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.photoUrl} alt={info.goodLabel} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 16, display: "block" }} />
      )}
      <div style={{ ...box }}>
        <div style={{ fontSize: "0.8rem", color: "#555", fontWeight: 700 }}>
          ▦ {info.code} · {KIND[info.kind]}{info.ref ? ` ${info.ref}` : ""}
        </div>
        <h1 style={{ margin: "0.3rem 0", fontSize: "1.4rem" }}>{info.goodLabel}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", fontSize: "0.8rem", alignItems: "center" }}>
          <span style={pill}>{info.sellerAlias ?? info.sellerCategory}</span>
          <span style={{ color: "#666" }}>📍 {info.district || "Uganda"}</span>
          {info.state && <span style={{ ...pill, background: info.livePath ? "#e8f5e9" : "#fff3e0", color: info.livePath ? "#1b5e20" : "#8d5300" }}>{info.state}</span>}
        </div>
        {info.livePath && (
          <Link
            href={info.livePath}
            style={{ display: "block", marginTop: "0.8rem", minHeight: 46, lineHeight: "46px", textAlign: "center", borderRadius: 12, background: "#2e7d32", color: "#fff", fontWeight: 800, textDecoration: "none" }}
          >
            {info.liveLabel} →
          </Link>
        )}
      </div>

      <div style={box}>
        <div style={{ fontWeight: 800, marginBottom: "0.3rem" }}>Where it comes from</div>
        {trace && (trace.farms > 0 || trace.tracedPercent > 0) ? (
          <>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1b5e20" }}>
              {trace.tracedPercent}% traces to {trace.farms} farm{trace.farms === 1 ? "" : "s"}
            </div>
            {trace.appFarmsPercent > 0 && <div style={{ fontSize: "0.85rem", color: "#444" }}>{trace.appFarmsPercent}% from farmers on Farm2Market</div>}
            {trace.farmDistricts && trace.farmDistricts.length > 0 && (
              <div style={{ fontSize: "0.85rem", color: "#444", marginTop: "0.2rem" }}>Farms in: {trace.farmDistricts.join(", ")}</div>
            )}
          </>
        ) : trace ? (
          <div style={{ fontSize: "0.9rem", color: "#555" }}>Bought outside the app: not traced to farms.</div>
        ) : null}
        {info.traceLevel && <div style={{ fontSize: "0.85rem", color: "#444", marginTop: "0.2rem" }}>{info.traceLevel}</div>}
        {info.traceStages && <div style={{ fontSize: "0.85rem", color: "#444" }}>{info.traceStages}</div>}
        <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "0.4rem" }}>QR made by Farm2Market on {formatUgandaDate(info.since)}.</div>
      </div>

      {info.tier !== "verified" && !info.isOwner && (
        <div style={{ ...box, background: "rgba(255, 248, 225, 0.95)" }}>
          <p style={{ margin: 0, color: "#6d4c00" }}>
            🔒 {info.tier === "public" ? "Sign up as a buyer to see who sells it and where the farms are." : "Get verified as a buyer to see who sells it and where the farms are."}
          </p>
          {info.tier === "public" && (
            <Link href={`/login?role=buyer&returnTo=${encodeURIComponent(`/g/${info.code}`)}`} style={{ display: "inline-block", marginTop: "0.5rem", color: "#1b5e20", fontWeight: 800 }}>
              Sign up as a buyer →
            </Link>
          )}
        </div>
      )}

      {info.ownerStats && (
        <div style={{ ...box, background: "rgba(232, 245, 233, 0.95)" }}>
          <div style={{ fontWeight: 800 }}>Your QR</div>
          <div style={{ fontSize: "0.9rem" }}>
            Scanned {info.ownerStats.scanCount} time{info.ownerStats.scanCount === 1 ? "" : "s"} · used {info.ownerStats.uses} time{info.ownerStats.uses === 1 ? "" : "s"}
            {info.ownerStats.lastScannedAt ? ` · last scan ${formatUgandaDate(info.ownerStats.lastScannedAt)}` : ""}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.2rem" }}>Your own scans are not counted.</div>
        </div>
      )}
    </>
  );
}
