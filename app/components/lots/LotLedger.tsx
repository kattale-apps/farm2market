"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime, getUgandaTime } from "../../utils/timeUtils";
import { PhotoSetCapture, type CapturedPhoto } from "../exportMarkets/PhotoSetCapture";
import { uploadEvidencePhotos } from "../exportMarkets/PhotoSetCapture";

const formatUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** A Convex error's message, including the ConvexError data the wallet checks throw. */
function errorMessage(e: unknown): { text: string; needsTopUp: boolean } {
  const data = (e as { data?: { message?: string; code?: string } })?.data;
  if (data?.message) return { text: data.message, needsTopUp: data.code === "INSUFFICIENT_WALLET_BALANCE" };
  return { text: (e as Error)?.message ?? "Something went wrong", needsTopUp: false };
}

const STATUS: Record<string, { label: string; color: string }> = {
  in_progress: { label: "In progress", color: "#1976d2" },
  payment_due: { label: "Payment due", color: "#c62828" },
  awaiting_collection_confirm: { label: "Handed over", color: "#ef6c00" },
  disputed: { label: "With an admin", color: "#7b1fa2" },
  settled: { label: "Paid", color: "#2e7d32" },
  cancelled: { label: "Cancelled", color: "#757575" },
  penalised: { label: "Cancelled: payment missed", color: "#757575" },
};

type LedgerOrder = NonNullable<ReturnType<typeof useLedger>>["sales"][number];

function useLedger(userId: Id<"users">) {
  return useQuery(api.lotOrders.myLedger, { userId });
}

/** Hours left until a stored Uganda-time deadline. */
function hoursLeft(deadline: number) {
  return Math.max(0, Math.round((deadline - getUgandaTime()) / 3_600_000));
}

/**
 * One ledger for every category: lots you sold and lots you bought, with the
 * money in escrow, what finished steps have earned (pending until the lot is
 * collected) and the step tracker. Sellers mark steps done here; buyers pay
 * and confirm collection here.
 */
export function LotLedger({ userId }: { userId: Id<"users"> }) {
  const ledger = useLedger(userId);
  const [tab, setTab] = useState<"sales" | "purchases">("sales");
  const [picked, setPicked] = useState(false);

  // Open on the side that has orders.
  useEffect(() => {
    if (!ledger || picked) return;
    if (ledger.sales.length === 0 && ledger.purchases.length > 0) setTab("purchases");
    setPicked(true);
  }, [ledger, picked]);

  if (ledger === undefined) return <p style={{ color: "#999" }}>Loading your lot ledger...</p>;
  const { summary } = ledger;
  const orders = tab === "sales" ? ledger.sales : ledger.purchases;

  const tabButton = (key: "sales" | "purchases", text: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{ flex: 1, minHeight: 44, border: "none", borderBottom: `3px solid ${tab === key ? "#2e7d32" : "transparent"}`, background: "none", fontWeight: 700, color: tab === key ? "#1b5e20" : "#666", cursor: "pointer" }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {summary.paymentsDue.map((due) => (
        <div key={due.orderId} role="alert" style={{ padding: "0.75rem 0.9rem", borderRadius: 10, background: "#ffebee", border: "2px solid #c62828", color: "#b71c1c", fontWeight: 700 }}>
          Payment due: {formatUGX(due.amount ?? 0)} for {due.produceType} by {due.by ? formatUgandaDateTime(due.by) : ""}
          {due.by ? ` (${hoursLeft(due.by)} hours left)` : ""}. If it is not paid in time the order is cancelled with a fine.
          {" "}<a href="/wallet" style={{ color: "#b71c1c" }}>Top up →</a>
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
        <SummaryTile label="Pending to you (in escrow)" value={summary.inEscrowForMe} color="#2e7d32" />
        <SummaryTile label="Earned so far by your steps" value={summary.earnedPending} color="#1b5e20" />
        <SummaryTile label="Your money in escrow" value={summary.inEscrowAsBuyer} color="#1565c0" />
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
        Money in escrow reaches the seller&apos;s wallet only when the lot is collected.
      </p>

      <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0" }}>
        {tabButton("sales", `Lots I sold (${ledger.sales.length})`)}
        {tabButton("purchases", `Lots I bought (${ledger.purchases.length})`)}
      </div>

      {orders.length === 0 ? (
        <p style={{ color: "#666", margin: 0 }}>
          {tab === "sales" ? "No buyer has ordered your lots yet." : "You have not bought any lots yet."}
        </p>
      ) : (
        orders.map((o) => <OrderCard key={o.orderId} order={o} side={tab === "sales" ? "seller" : "buyer"} userId={userId} />)
      )}
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "0.6rem 0.75rem", borderRadius: 10, background: "#f9f9f9", border: "1px solid #e0e0e0" }}>
      <div style={{ fontSize: "0.75rem", color: "#666" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color }}>{formatUGX(value)}</div>
    </div>
  );
}

function OrderCard({ order: o, side, userId }: { order: LedgerOrder; side: "seller" | "buyer"; userId: Id<"users"> }) {
  const markStepDone = useMutation(api.lotOrders.markStepDone);
  const payDue = useMutation(api.lotOrders.payDue);
  const payAll = useMutation(api.lotOrders.payAll);
  const confirmCollected = useMutation(api.lotOrders.confirmCollected);
  const raiseDispute = useMutation(api.lotOrders.raiseDispute);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; topUp?: boolean } | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [disputeKind, setDisputeKind] = useState<"cancel" | "problem" | null>(null);
  const [reason, setReason] = useState("");
  const [showPhotos, setShowPhotos] = useState(false);

  const status = STATUS[o.status] ?? { label: o.status, color: "#666" };
  const next = o.nextStep >= 0 ? o.steps[o.nextStep] : null;
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ ok: true, text: done });
      setProofOpen(false);
      setPhotos([]);
      setDisputeKind(null);
      setReason("");
    } catch (e) {
      const { text, needsTopUp } = errorMessage(e);
      setMsg({ ok: false, text, topUp: needsTopUp });
    } finally {
      setBusy(false);
    }
  };
  const button = (tone: "go" | "plain" | "warn"): React.CSSProperties => ({
    minHeight: 44,
    padding: "0 1rem",
    borderRadius: 8,
    border: tone === "plain" ? "1px solid #ddd" : "none",
    background: busy ? "#ccc" : tone === "go" ? "#2e7d32" : tone === "warn" ? "#fff3e0" : "#fff",
    color: tone === "go" ? "#fff" : tone === "warn" ? "#e65100" : "#333",
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ border: `2px solid ${status.color}33`, borderRadius: 12, padding: "0.9rem", background: "#fff", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 700, color: "#222" }}>
          {o.produceType} · {o.lotKg.toLocaleString()} kg
          <div style={{ fontSize: "0.8rem", color: "#666", fontWeight: 500 }}>
            {side === "seller" ? "Bought by" : "Sold by"} {o.otherLabel || "a member"} · {formatUgandaDateTime(o.createdAt)}
          </div>
        </div>
        <span style={{ padding: "0.25rem 0.7rem", borderRadius: 999, background: status.color, color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>{status.label}</span>
      </div>

      <div style={{ fontSize: "0.9rem", color: "#333" }}>
        Posted {formatUGX(o.postedPricePerKilo)}/kg
        {o.settledPricePerKilo !== o.postedPricePerKilo && <> → agreed <strong>{formatUGX(o.settledPricePerKilo)}/kg</strong></>}
        {" "}· Total <strong>{formatUGX(o.totalAmount)}</strong>
      </div>

      {o.isOpen ? (
        <div style={{ fontSize: "0.9rem", color: "#333" }}>
          In escrow: <strong>{formatUGX(o.paidAmount)}</strong> of {formatUGX(o.totalAmount)}
          {side === "seller" && <> · Earned so far: <strong>{formatUGX(o.earnedSoFar)}</strong> (pending)</>}
        </div>
      ) : (
        <div style={{ fontSize: "0.9rem", color: "#333" }}>
          {o.toSeller !== null && <>Paid to seller: <strong>{formatUGX(o.toSeller)}</strong></>}
          {o.toBuyer ? <> · Returned to buyer: <strong>{formatUGX(o.toBuyer)}</strong></> : null}
          {o.fineToPlatform ? <> · Fine kept: {formatUGX(o.fineToPlatform + (o.fineToSeller ?? 0))}</> : null}
          {o.resolutionNote && <div style={{ fontSize: "0.82rem", color: "#666" }}>Admin note: {o.resolutionNote}</div>}
        </div>
      )}

      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <li style={{ fontSize: "0.88rem", color: "#2e7d32" }}>✓ Buyer committed {o.commitPercent}% ({formatUGX(o.commitAmount)})</li>
        {o.steps.map((s, i) => {
          const done = !!s.doneAt;
          const icon = done ? "✓" : s.handedOverAt ? "⏳" : i === o.nextStep && o.isOpen ? "▶" : "○";
          return (
            <li key={i} style={{ fontSize: "0.88rem", color: done ? "#2e7d32" : i === o.nextStep ? "#222" : "#888", fontWeight: i === o.nextStep && o.isOpen ? 700 : 500 }}>
              {icon} {s.name}
              {s.handover
                ? s.handedOverAt && !done ? " — handed over, waiting for the buyer to confirm" : " — collection (full price in escrow)"
                : s.payAmount > 0 ? ` — buyer pays ${formatUGX(s.payAmount)} when done` : ""}
              {s.photoCount > 0 && <span style={{ color: "#666" }}> · {s.photoCount} photo{s.photoCount === 1 ? "" : "s"}</span>}
            </li>
          );
        })}
      </ol>

      {o.status === "payment_due" && o.paymentDueBy && (
        <div style={{ padding: "0.6rem 0.75rem", borderRadius: 8, background: side === "buyer" ? "#ffebee" : "#fff8e1", color: side === "buyer" ? "#b71c1c" : "#8d6e00", fontWeight: 700, fontSize: "0.88rem" }}>
          {side === "buyer"
            ? `Pay ${formatUGX(o.paymentDueAmount ?? 0)} by ${formatUgandaDateTime(o.paymentDueBy)} (${hoursLeft(o.paymentDueBy)} hours left), or the order is cancelled with a fine.`
            : `Waiting for the buyer to pay ${formatUGX(o.paymentDueAmount ?? 0)} by ${formatUgandaDateTime(o.paymentDueBy)}.`}
        </div>
      )}
      {o.status === "awaiting_collection_confirm" && o.autoSettleAt && (
        <div style={{ padding: "0.6rem 0.75rem", borderRadius: 8, background: "#fff3e0", color: "#8d4e00", fontSize: "0.88rem", fontWeight: 600 }}>
          {side === "buyer"
            ? `Did you collect it? Confirm below, or report a problem. If you do nothing, the seller is paid on ${formatUgandaDateTime(o.autoSettleAt)}.`
            : `Handed over. You are paid when the buyer confirms, or on ${formatUgandaDateTime(o.autoSettleAt)} at the latest.`}
        </div>
      )}
      {o.status === "disputed" && (
        <div style={{ padding: "0.6rem 0.75rem", borderRadius: 8, background: "#f3e5f5", color: "#4a148c", fontSize: "0.88rem" }}>
          An admin is looking at this order{o.disputeReason ? `: "${o.disputeReason}"` : ""}. Nothing moves until they decide.
        </div>
      )}

      {/* Actions */}
      {o.isOpen && o.status !== "disputed" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {side === "seller" && o.status === "in_progress" && next && !next.handedOverAt && (
            <button type="button" disabled={busy} onClick={() => setProofOpen((v) => !v)} style={button("go")}>
              {next.handover ? "Mark handed over" : `Mark "${next.name}" done`}
            </button>
          )}
          {side === "buyer" && o.status === "payment_due" && (
            <button type="button" disabled={busy} onClick={() => run(() => payDue({ buyerId: userId, orderId: o.orderId }), "Paid into escrow.")} style={button("go")}>
              Pay {formatUGX(o.paymentDueAmount ?? 0)} now
            </button>
          )}
          {side === "buyer" && (o.status === "in_progress" || o.status === "payment_due") && o.paidAmount < o.totalAmount && (
            <button type="button" disabled={busy} onClick={() => run(() => payAll({ buyerId: userId, orderId: o.orderId }), "The whole price is in escrow.")} style={button("plain")}>
              Pay all now ({formatUGX(o.totalAmount - o.paidAmount)})
            </button>
          )}
          {side === "buyer" && o.status === "awaiting_collection_confirm" && (
            <button type="button" disabled={busy} onClick={() => run(() => confirmCollected({ buyerId: userId, orderId: o.orderId }), "Collected. The seller has been paid.")} style={button("go")}>
              I collected it
            </button>
          )}
          {o.status === "awaiting_collection_confirm" && side === "buyer" ? (
            <button type="button" disabled={busy} onClick={() => setDisputeKind("problem")} style={button("warn")}>Report a problem</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setDisputeKind("cancel")} style={button("warn")}>Ask admin to cancel</button>
          )}
        </div>
      )}

      {proofOpen && next && (
        <div style={{ padding: "0.75rem", borderRadius: 8, background: "#f9f9f9", border: "1px solid #e0e0e0", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ fontWeight: 700 }}>Photo proof for &ldquo;{next.name}&rdquo;</div>
          <PhotoSetCapture photos={photos} onChange={setPhotos} max={6} />
          <button
            type="button"
            disabled={busy || photos.length === 0}
            onClick={() =>
              run(async () => {
                const uploaded = await uploadEvidencePhotos(() => generateUploadUrl(), photos);
                const result = await markStepDone({ sellerId: userId, orderId: o.orderId, photos: uploaded });
                if (result.status === "payment_due") {
                  throw new Error(`Recorded. The buyer's wallet is short, so they have 48 hours to pay ${formatUGX(result.due)} before you carry on.`);
                }
              }, next.handover ? "Handed over. The buyer has 3 days to confirm." : `"${next.name}" is done.`)
            }
            style={button(photos.length === 0 ? "plain" : "go")}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {disputeKind && (
        <div style={{ padding: "0.75rem", borderRadius: 8, background: "#fff8e1", border: "1px solid #ffe082", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontWeight: 700 }}>
            {disputeKind === "cancel" ? "Why should this order be cancelled?" : "What is wrong with the lot?"}
          </label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ddd", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() => run(() => raiseDispute({ userId, orderId: o.orderId, kind: disputeKind, reason }), "Sent to an admin. Nothing moves until they decide.")}
              style={button("go")}
            >
              Send to admin
            </button>
            <button type="button" onClick={() => setDisputeKind(null)} style={button("plain")}>Back</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: msg.ok ? "#2e7d32" : "#c62828" }}>
          {msg.text} {msg.topUp && <a href="/wallet" style={{ color: "#c62828" }}>Top up →</a>}
        </div>
      )}

      {o.steps.some((s) => s.photoCount > 0) && (
        <button type="button" onClick={() => setShowPhotos((v) => !v)} style={{ alignSelf: "flex-start", border: "none", background: "none", color: "#1565c0", fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {showPhotos ? "Hide photos" : "See step photos"}
        </button>
      )}
      {showPhotos && <OrderPhotos userId={userId} orderId={o.orderId} />}
    </div>
  );
}

function OrderPhotos({ userId, orderId }: { userId: Id<"users">; orderId: Id<"lotOrders"> }) {
  const steps = useQuery(api.lotOrders.orderPhotos, { userId, orderId });
  if (steps === undefined) return <p style={{ color: "#999", margin: 0 }}>Loading photos...</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {steps.filter((s) => s.photos.length > 0).map((s) => (
        <div key={s.name}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#333" }}>{s.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.4rem" }}>
            {s.photos.map((p, i) =>
              p.url ? (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#555", textDecoration: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`${s.name} photo ${i + 1}`} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6 }} />
                  {p.lat !== null ? `📍 ${p.lat.toFixed(3)}, ${p.lng?.toFixed(3)}` : "No GPS"}
                  {p.manualEntry && <span style={{ color: "#e65100" }}> ✍️</span>}
                </a>
              ) : null
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
