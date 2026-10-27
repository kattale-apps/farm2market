"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../../convex/exportMarketsShared";
import { chargeForStep, commitAmount } from "../../../../convex/lotOrdersShared";
import { purchaseHelp } from "../../../../convex/marketspaceShared";
import { getUgandaTime } from "../../../utils/timeUtils";
import { QrCodeDisplay } from "../../../components/qr/QrCodeDisplay";
import { GoodsLabel } from "../../../components/qr/GoodsLabel";
import { PhotoGallery } from "../../components/PhotoGallery";
import { CardQuestions } from "../../components/Questions";
import { ReportSheet, SafetyNotice } from "../../components/Sheets";
import { TopBar } from "../../components/TopBar";
import { FONT, GLASS, formatUGX, useMarketspaceSession } from "../../components/shared";

/** A Convex error's readable message (ConvexError data first). */
function errorMessage(e: unknown): { text: string; needsTopUp: boolean } {
  const data = (e as { data?: { message?: string; code?: string } })?.data;
  if (data?.message) return { text: data.message, needsTopUp: data.code === "INSUFFICIENT_WALLET_BALANCE" };
  return { text: (e as Error)?.message ?? "Something went wrong", needsTopUp: false };
}

const STOCK: Record<string, string> = { own_farm: "From the farm", in_app: "Traced (bought in the app)", off_app: "Off-app stock" };

/**
 * One MarketSpace post: what QR codes and cards open. Visitors and
 * unverified members see the preview; verified purchasers see the price, the
 * payment steps and can buy or make an offer. Every lot post has a Purchase
 * now button: it buys for verified purchasers, signs visitors up as buyers
 * and tells unverified members how to get verified. Never shows a phone number.
 */
export default function CardPage() {
  const params = useParams<{ cardId: string }>();
  const session = useMarketspaceSession();
  const [boardNow] = useState(() => Math.floor(getUgandaTime() / 60000) * 60000);
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const card = useQuery(
    api.marketspace.cardDetail,
    params?.cardId && session.status !== "loading" ? { cardId: params.cardId, now: boardNow, today, sessionToken: session.token ?? undefined } : "skip"
  );
  const commitFromCard = useMutation(api.lotOrders.commitFromCard);
  const makeOffer = useMutation(api.negotiations.makeOffer);
  const [lots, setLots] = useState("1");
  const [offering, setOffering] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; topUp?: boolean } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [buyHelp, setBuyHelp] = useState(false);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT }}>
      <TopBar status={session.status} backHref="/marketspace?view=all" />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>{children}</main>
    </div>
  );
  if (card === undefined) return shell(<p style={{ ...GLASS, padding: "1rem", color: "#555" }}>Loading…</p>);
  if (card === null) {
    return shell(
      <div style={{ ...GLASS, textAlign: "center", padding: "2rem 1rem" }}>
        <p style={{ fontWeight: 700 }}>This post is no longer on MarketSpace.</p>
        <Link href="/marketspace?view=all" style={{ color: "#1b5e20", fontWeight: 800 }}>Discover other posts →</Link>
      </div>
    );
  }

  const isLot = card.sourceKind === "listing";
  // What one sellable unit is called: a lot by weight, or one item or batch of packaged goods
  const unitWord = !card.packaged ? "lot" : (card.packagesPerBatch ?? 1) > 1 ? "batch" : card.unitLabel ?? "item";
  const free = card.freeUnitIds.length;
  const n = Math.min(free, Math.max(1, parseInt(lots, 10) || 1));
  const pays = card.steps?.map((s) => s.payPercent) ?? [];
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/marketspace/p/${card.cardId}` : "";

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await action() });
      setOffering(false);
    } catch (e) {
      const { text, needsTopUp } = errorMessage(e);
      setMsg({ ok: false, text, topUp: needsTopUp });
    } finally {
      setBusy(false);
    }
  };
  const box: React.CSSProperties = { padding: "0.85rem", borderRadius: 12, background: "#fff", border: "1px solid #e3e8e0", marginTop: "0.8rem" };
  const button = (tone: "go" | "plain"): React.CSSProperties => ({
    minHeight: 46,
    padding: "0 1rem",
    borderRadius: 10,
    border: tone === "plain" ? "1px solid #ccc" : "none",
    background: busy ? "#ccc" : tone === "go" ? "#2e7d32" : "#fff",
    color: tone === "go" ? "#fff" : "#222",
    fontWeight: 800,
    fontFamily: FONT,
    cursor: busy ? "not-allowed" : "pointer",
  });

  return shell(
    <>
      {card.photoUrls.length > 0 && <PhotoGallery urls={card.photoUrls} title={card.title} height={260} zoomable={!card.lite} />}
      <div style={{ ...GLASS, marginTop: "0.8rem", padding: "0.8rem" }}>
        {card.kind === "wanted" && <span style={{ padding: "0.15rem 0.55rem", borderRadius: 999, background: "#f6bf26", fontWeight: 800, fontSize: "0.75rem" }}>WANTED</span>}
        <h1 style={{ margin: "0.3rem 0", fontSize: "1.4rem" }}>{card.title}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", fontSize: "0.8rem" }}>
          <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#f1f3f0", fontWeight: 700 }}>{card.sellerAlias ?? card.sellerCategory}</span>
          {card.commercialFarmer && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#e3f2fd", color: "#0d47a1", fontWeight: 700 }}>✔ Commercial Farmer</span>}
          {card.verifiedVendor && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#e3f2fd", color: "#0d47a1", fontWeight: 700 }}>✔ Verified Vendor</span>}
          {card.farmGate && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#fff3e0", color: "#8d5300", fontWeight: 700 }}>🚜 Farm gate: not on MarketSpace</span>}
          {card.isBulk && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#ede7f6", color: "#4527a0", fontWeight: 700 }}>📦 Bulk{card.bulkLabel ? ` · ${card.bulkLabel}` : ""}</span>}
          {card.stockSource && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#e8f5e9", color: "#1b5e20", fontWeight: 700 }}>{STOCK[card.stockSource]}</span>}
          {card.categoryName && <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, background: "#e3f2fd", fontWeight: 700 }}>{card.categoryIcon} {card.categoryName}</span>}
          <span style={{ color: "#666" }}>📍 {card.district || "Uganda"}</span>
        </div>
      </div>

      {card.lite ? (
        <div style={{ ...box, background: "#fff8e1", borderColor: "#ffe082" }}>
          <div style={{ fontWeight: 800 }}>{card.priceBand ?? "Price for buyers"} {card.quantityBand ? `· ${card.quantityBand}` : ""}</div>
          <p style={{ margin: "0.4rem 0", color: "#6d4c00" }}>🔒 {card.liteReason}</p>
          {card.viewerTier === "public" ? (
            <Link href={`/login?role=buyer&returnTo=${encodeURIComponent(`/marketspace/p/${card.cardId}`)}`} style={{ display: "inline-block", ...button("go"), lineHeight: "46px", textDecoration: "none" }}>
              {isLot ? "🛒 Purchase now" : "Sign up as a buyer"}
            </Link>
          ) : (
            isLot && (
              <>
                <button type="button" onClick={() => setBuyHelp((v) => !v)} style={button("go")}>
                  🛒 Purchase now
                </button>
                {buyHelp && (
                  <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: "#fff", border: "1px solid #ffe082", color: "#333", fontSize: "0.92rem", lineHeight: 1.5 }}>
                    {purchaseHelp(card.viewerRole).text}
                    {purchaseHelp(card.viewerRole).ledger && (
                      <Link href="/marketspace?tab=post&from=ledger" style={{ display: "block", marginTop: "0.4rem", color: "#1b5e20", fontWeight: 800 }}>
                        Open My Ledger →
                      </Link>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </div>
      ) : isLot ? (
        <div style={box}>
          {card.packaged ? (
            <>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1b5e20" }}>{formatUGX(card.priceUGX ?? 0)} {card.priceUnit}</div>
              <div style={{ color: "#333", margin: "0.2rem 0" }}>
                {card.quantityText} for sale
                {(card.packagesPerBatch ?? 1) > 1 ? ` · ${formatUGX(card.lotPrice ?? 0)} a batch` : ""}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1b5e20" }}>{formatUGX(card.pricePerKilo ?? 0)}/kg</div>
              <div style={{ color: "#333", margin: "0.2rem 0" }}>
                {card.lotsAvailable} lot{card.lotsAvailable === 1 ? "" : "s"} of {card.lotKg?.toLocaleString()} kg
                {card.bagKg ? ` (${card.bagsPerLot ?? 1} × ${card.bagKg} kg bags)` : ""} · {formatUGX(card.lotPrice ?? 0)} a lot
              </div>
            </>
          )}
          {card.qualityRating && <div style={{ fontSize: "0.88rem" }}>Quality: <strong>{card.qualityRating}</strong></div>}
          {card.qualityComment && <div style={{ fontSize: "0.88rem", color: "#555" }}>{card.qualityComment}</div>}
          {card.steps && card.lotPrice !== null && (
            <div style={{ marginTop: "0.6rem" }}>
              <div style={{ fontWeight: 800, marginBottom: "0.25rem" }}>How you pay for one {unitWord}</div>
              <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                <li>Commit {card.commitPercent}% now: <strong>{formatUGX(commitAmount(card.lotPrice, card.commitPercent ?? 100))}</strong> into escrow</li>
                {card.steps.map((s, i) => (
                  <li key={i}>
                    {s.name}
                    {s.handover ? " — you collect; the seller is paid only then" : chargeForStep(card.lotPrice!, card.commitPercent ?? 100, pays, i) > 0 ? `: ${formatUGX(chargeForStep(card.lotPrice!, card.commitPercent ?? 100, pays, i))} when done` : ""}
                  </li>
                ))}
              </ol>
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>Your money stays in escrow until you collect.{card.packaged ? " However many you buy, it is one order." : ""}</div>
            </div>
          )}

          {card.isMine ? (
            <Link href="/marketspace?tab=mine" style={{ display: "inline-block", marginTop: "0.7rem", color: "#1b5e20", fontWeight: 800 }}>This is your post: manage it in My posts →</Link>
          ) : card.viewerTier === "verified" ? (
            free === 0 ? (
              <div style={{ marginTop: "0.7rem", color: "#8d6e00" }}>Every free lot has an offer waiting for the seller.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.8rem" }}>
                <label style={{ fontSize: "0.9rem" }}>
                  {card.packaged ? `How many ${(card.packagesPerBatch ?? 1) > 1 ? "batches" : card.unitLabel ?? "items"}?` : "Lots"}{" "}
                  <input type="number" inputMode="numeric" min={1} max={free} value={lots} onChange={(e) => setLots(e.target.value)} style={{ width: 70, minHeight: 42, padding: "0 0.5rem", border: "1px solid #ccc", borderRadius: 8 }} />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(async () => {
                    const r = await commitFromCard({ sessionToken: session.token!, cardId: card.cardId as Id<"marketCards">, lots: n });
                    return card.packaged
                      ? `${formatUGX(r.committedTotal)} is in escrow for your order. Collect from the seller, then confirm in your lot orders.`
                      : `Committed ${formatUGX(r.committedTotal)} into escrow for ${n} lot(s). Follow the steps in your lot orders.`;
                  })}
                  style={button("go")}
                >
                  🛒 Purchase now · commit {formatUGX(commitAmount(card.lotPrice ?? 0, card.commitPercent ?? 100) * n)}
                </button>
                {(!card.packaged || card.takesOffers) && (
                  <button type="button" onClick={() => { setOffering((v) => !v); setOfferPrice(String((card.packaged ? card.priceUGX : card.pricePerKilo) ?? "")); }} style={button("plain")}>Make an offer</button>
                )}
              </div>
            )
          ) : null}

          {offering && card.viewerUserId && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.6rem", padding: "0.6rem", borderRadius: 10, background: "#f6f8f4" }}>
              <label style={{ fontSize: "0.9rem" }}>
                Your price per {card.packaged ? card.unitLabel ?? "item" : "kg"}{" "}
                <input type="number" min={1} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} style={{ width: 110, minHeight: 42, padding: "0 0.5rem", border: "1px solid #ccc", borderRadius: 8 }} />
              </label>
              <button
                type="button"
                disabled={busy || !(parseFloat(offerPrice) > 0)}
                onClick={() => run(async () => {
                  await makeOffer({ traderId: card.viewerUserId!, unitIds: card.freeUnitIds.slice(0, n), offerPricePerKilo: parseFloat(offerPrice) });
                  return "Offer sent. When the seller accepts, commit it from Discover.";
                })}
                style={button("go")}
              >
                Send offer for {n} lot{n === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={box}>
          {(card.priceUGX !== null || card.negotiable) && (
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1b5e20" }}>
              {card.priceUGX !== null ? `${formatUGX(card.priceUGX)}${card.priceUnit ? ` ${card.priceUnit}` : ""}` : ""}
              {card.negotiable ? <span style={{ fontSize: "0.85rem", color: "#666" }}> (negotiable)</span> : null}
            </div>
          )}
          {card.quantityText && <div>Quantity: {card.quantityText}</div>}
          {card.neededBy && <div>Needed by: {card.neededBy}</div>}
          {card.description && <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{card.description}</p>}
          {card.isMine && <Link href="/marketspace?tab=mine" style={{ color: "#1b5e20", fontWeight: 800 }}>This is your ad: manage it in My posts →</Link>}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: "0.6rem", fontWeight: 700, color: msg.ok ? "#2e7d32" : "#c62828" }}>
          {msg.text} {msg.topUp && <a href="/wallet" style={{ color: "#c62828" }}>Top up →</a>}
        </div>
      )}

      <CardQuestions cardId={card.cardId} token={session.token} today={today} now={boardNow} />

      {/* Lots are paid through escrow; the pay-on-delivery notice is for classified ads */}
      {!isLot && (
        <div style={{ marginTop: "0.8rem" }}>
          <SafetyNotice />
        </div>
      )}

      <div style={{ ...GLASS, display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.8rem", padding: "0.6rem" }}>
        <button type="button" onClick={() => setShowQr((v) => !v)} style={button("plain")}>{showQr ? "Hide QR code" : "QR code for this post"}</button>
        {card.adId && !card.isMine && <button type="button" onClick={() => setReporting(true)} style={button("plain")}>Report</button>}
      </div>
      {showQr && pageUrl && (
        <div style={box}>
          {card.goodsCode ? (
            <>
              <GoodsLabel code={card.goodsCode} name={card.title} photoUrl={card.photoUrls[0] ?? null} place={card.place} />
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.4rem" }}>
                {card.goodsCode} · made by Farm2Market for these goods. Scanning it shows where they come from and opens this post while it is up.
              </div>
            </>
          ) : (
            <>
              <QrCodeDisplay targetUrl={pageUrl} fileName={`farm2market-${card.title.replace(/\W+/g, "-").toLowerCase()}`} size={220} />
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.4rem" }}>Print it for bags and lots: scanning it opens this page.</div>
            </>
          )}
        </div>
      )}
      {reporting && card.adId && <ReportSheet ad={{ _id: card.adId, title: card.title }} sessionToken={session.token} onClose={() => setReporting(false)} />}
    </>
  );
}
