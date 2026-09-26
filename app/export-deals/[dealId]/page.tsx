"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useStoredUser } from "../../hooks/useStoredUser";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { INCOTERMS, PAYMENT_TERMS, ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import {
  FONT,
  ON_PHOTO_SHADOW,
  EXPORT_BROWN,
  card,
  input,
  label,
  button,
  Notice,
  StatusPill,
  Stars,
  TraceBadges,
  errorText,
  formatUgx,
  formatUsd,
  dataUrlToBlob,
  uploadToConvex,
} from "../../components/exportMarkets/ui";
import { PhotoSetCapture, CapturedPhoto } from "../../components/exportMarkets/PhotoSetCapture";

type Data = NonNullable<FunctionReturnType<typeof api.exportDeals.getDeal>>;
type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type P = { data: Data; userId: Id<"users">; setMsg: (m: Msg) => void };

const DEAL_STATUS_PILL: Record<string, string> = {
  enquiry: "pending",
  quoted: "submitted",
  in_progress: "pending",
  completed: "approved",
  declined: "rejected",
  cancelled: "rejected",
};

export default function ExportDealPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const data = useQuery(api.exportDeals.getDeal, userId ? { userId, dealId: dealId as Id<"exportDeals"> } : "skip");
  const [msg, setMsg] = useState<Msg>(null);

  if (status === "loading" || (userId && data === undefined)) return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading deal...</div>;
  if (!userId || !data) return <div style={{ padding: "2rem", fontFamily: FONT }}>Deal not found.</div>;
  const { deal, role, lot, parties } = data;
  const back = role === "buyer" ? "/buyer/export-markets" : role === "exporter" ? "/trader/export" : "/admin/export-markets";

  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto", fontFamily: FONT }}>
      <Link href={back} style={{ color: "#0d47a1", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", textShadow: ON_PHOTO_SHADOW }}>
        ← Back to Export Markets
      </Link>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0.75rem 0 0.25rem", color: EXPORT_BROWN, textShadow: ON_PHOTO_SHADOW }}>
        ☕ Deal {deal.dealCode}
      </h1>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <b>
            Lot {lot?.lotCode} · {lot?.coffeeType} {lot?.grade} · {lot?.processing} · {lot?.cropYear}
          </b>
          <StatusPill state={DEAL_STATUS_PILL[deal.status] ?? deal.status} />
        </div>
        <div style={{ fontSize: "0.85rem", lineHeight: 1.7, marginTop: "0.4rem" }}>
          {deal.bags} bags × {lot?.bagWeightKg} kg · {deal.incoterm}
          {deal.destinationPort ? ` · ${deal.destinationPort}` : ""}
          {deal.shipmentPeriod ? ` · shipment ${deal.shipmentPeriod}` : ""}
          {deal.agreedPriceUsdPerKg != null && ` · agreed ${formatUsd(deal.agreedPriceUsdPerKg)}/kg`}
          {deal.contractValueUsd != null && ` · contract ${formatUsd(deal.contractValueUsd)}`}
        </div>
        {lot && <TraceBadges traceLevel={lot.traceLevel} eudrReady={lot.eudrReady} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
          <PartyBox title="Exporter" alias={parties.exporter.alias} identity={parties.exporter.identity as Record<string, unknown> | null}>
            <Stars value={parties.exporter.stats.ratingAverage} /> ({parties.exporter.stats.ratingCount}) · {parties.exporter.stats.completedDeals} completed
            {parties.exporter.stats.onTimeShipmentRate != null && ` · ${parties.exporter.stats.onTimeShipmentRate}% shipped on time`}
          </PartyBox>
          <PartyBox title="Buyer" alias={parties.buyer.alias} identity={parties.buyer.identity as Record<string, unknown> | null}>
            {parties.buyer.country} · KYC {parties.buyer.kycStatus.replace("_", " ")}
          </PartyBox>
        </div>
        {!deal.disclosedAt && role !== "admin" && (
          <p style={{ fontSize: "0.78rem", color: "#666", marginBottom: 0 }}>
            Company names and contacts are shared once the platform fees are paid. Contact details in messages are hidden until then.
          </p>
        )}
        {lot && (deal.disclosedAt || role !== "buyer") && (
          <Link href={`/export-report/${lot._id}?deal=${deal._id}`} style={{ ...button("secondary"), textDecoration: "none", display: "inline-block", marginTop: "0.6rem" }}>
            Traceability report
          </Link>
        )}
      </div>

      {(deal.status === "enquiry" || deal.status === "quoted") && <Negotiation data={data} userId={userId} setMsg={setMsg} />}
      {deal.status !== "enquiry" && deal.status !== "quoted" && <Pipeline data={data} userId={userId} setMsg={setMsg} />}
      {deal.status === "in_progress" && <CurrentStep data={data} userId={userId} setMsg={setMsg} />}
      {deal.status === "completed" && data.rating && (
        <div style={card}>
          <b>Buyer rating:</b> <Stars value={data.rating.overall} /> · quality {data.rating.quality}/5 · documents {data.rating.documents}/5 · communication{" "}
          {data.rating.communication}/5
          {data.rating.comment && <p style={{ fontSize: "0.85rem" }}>&ldquo;{data.rating.comment}&rdquo;</p>}
        </div>
      )}
      {(deal.status === "declined" || deal.status === "cancelled") && deal.cancelReason && <Notice tone="error">Closed: {deal.cancelReason}</Notice>}

      <Messages data={data} userId={userId} setMsg={setMsg} />
      {["enquiry", "quoted", "in_progress"].includes(deal.status) && <CancelDeal data={data} userId={userId} setMsg={setMsg} />}
    </div>
  );
}

function PartyBox({ title, alias, identity, children }: { title: string; alias: string; identity: Record<string, unknown> | null; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.6rem" }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div>{identity ? String(identity.legalName ?? identity.businessName ?? alias) : alias}</div>
      <div style={{ color: "#555" }}>{children}</div>
      {identity && (
        <div style={{ color: "#333", marginTop: "0.3rem", fontSize: "0.8rem", lineHeight: 1.5 }}>
          {Object.entries(identity)
            .filter(([k, v]) => v && k !== "legalName" && k !== "businessName")
            .map(([k, v]) => (
              <div key={k}>
                <span style={{ color: "#777" }}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span> {String(v)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function useRunner<T extends unknown[]>(fn: (...a: T) => Promise<unknown>, setMsg: (m: Msg) => void, success?: string) {
  const [busy, setBusy] = useState(false);
  const run = async (...a: T) => {
    setBusy(true);
    try {
      await fn(...a);
      if (success) setMsg({ tone: "success", text: success });
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ------------------------------------------------------------------
// Negotiation (price on request)
// ------------------------------------------------------------------

function Negotiation({ data, userId, setMsg }: P) {
  const { deal, role } = data;
  const quote = useMutation(api.exportDeals.quoteDeal);
  const counter = useMutation(api.exportDeals.counterOffer);
  const accept = useMutation(api.exportDeals.acceptOffer);
  const [price, setPrice] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [bags, setBags] = useState(String(deal.bags));
  const a = useRunner(async (fn: () => Promise<unknown>) => fn(), setMsg);

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Price</h2>
      <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
        {deal.buyerTargetPriceUsdPerKg != null && <div>Buyer&apos;s offer: <b>{formatUsd(deal.buyerTargetPriceUsdPerKg)}/kg</b></div>}
        {deal.quotedPriceUsdPerKg != null && (
          <div>
            Exporter&apos;s quote: <b>{formatUsd(deal.quotedPriceUsdPerKg)}/kg</b>
            {deal.quoteValidUntil ? ` (valid until ${deal.quoteValidUntil})` : ""}
          </div>
        )}
        <div style={{ color: "#666" }}>{deal.lastOfferBy === "buyer" ? "Waiting for the exporter." : "Waiting for the buyer."}</div>
      </div>

      {role === "exporter" && (
        <div style={{ marginTop: "0.75rem" }}>
          {deal.lastOfferBy === "buyer" && deal.buyerTargetPriceUsdPerKg != null && (
            <button style={{ ...button("primary", a.busy), marginBottom: "0.6rem" }} disabled={a.busy} onClick={() => a.run(() => accept({ userId, dealId: deal._id }))}>
              Accept the buyer&apos;s {formatUsd(deal.buyerTargetPriceUsdPerKg)}/kg
            </button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Your price (USD/kg)</label>
              <input style={input} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label style={label}>Valid until</label>
              <input style={input} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <input style={{ ...input, marginTop: "0.5rem" }} placeholder="Note to the buyer" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            style={{ ...button("secondary", a.busy), marginTop: "0.5rem" }}
            disabled={a.busy}
            onClick={() => a.run(() => quote({ userId, dealId: deal._id, priceUsdPerKg: Number(price), validUntil: validUntil || undefined, note: note || undefined }))}
          >
            Send quote
          </button>
        </div>
      )}

      {role === "buyer" && (
        <div style={{ marginTop: "0.75rem" }}>
          {deal.status === "quoted" && (
            <button style={{ ...button("primary", a.busy), marginBottom: "0.6rem" }} disabled={a.busy} onClick={() => a.run(() => accept({ userId, dealId: deal._id }))}>
              Accept {formatUsd(deal.quotedPriceUsdPerKg)}/kg
            </button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Your offer (USD/kg)</label>
              <input style={input} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label style={label}>Bags</label>
              <input style={input} value={bags} onChange={(e) => setBags(e.target.value)} />
            </div>
          </div>
          <input style={{ ...input, marginTop: "0.5rem" }} placeholder="Note to the exporter" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            style={{ ...button("secondary", a.busy), marginTop: "0.5rem" }}
            disabled={a.busy}
            onClick={() => a.run(() => counter({ userId, dealId: deal._id, priceUsdPerKg: Number(price), bags: Number(bags), note: note || undefined }))}
          >
            {deal.status === "quoted" ? "Send counter-offer" : "Update my offer"}
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Pipeline checklist
// ------------------------------------------------------------------

function Pipeline({ data }: P) {
  const who: Record<string, string> = { buyer: "Buyer", exporter: "Exporter", admin: "Admin", platform: "Platform" };
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Order, shipment and delivery</h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {data.steps.map((s, i) => (
          <li key={s._id} style={{ display: "flex", gap: "0.6rem", padding: "0.35rem 0", alignItems: "flex-start" }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                fontSize: "0.75rem",
                fontWeight: 800,
                background: s.status === "done" ? "#2e7d32" : s.status === "active" ? "#ef6c00" : "#e0e0e0",
                color: s.status === "pending" ? "#555" : "#fff",
              }}
            >
              {s.status === "done" ? "✓" : i + 1}
            </span>
            <div style={{ fontSize: "0.88rem" }}>
              <b style={{ color: s.status === "active" ? "#ef6c00" : "#222" }}>{s.name}</b>{" "}
              <span style={{ color: "#777", fontSize: "0.75rem" }}>· {who[s.actor]}</span>
              {s.completedAt && <span style={{ color: "#777", fontSize: "0.75rem" }}> · {formatUgandaDateTime(s.completedAt)}</span>}
              {s.status === "active" && s.description && <div style={{ color: "#555", fontSize: "0.8rem" }}>{s.description}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------
// Current step actions
// ------------------------------------------------------------------

function CurrentStep(props: P) {
  const { data } = props;
  const step = data.steps.find((s) => s.key === data.deal.currentStepKey);
  if (!step) return null;
  const body = (() => {
    switch (step.key) {
      case "buyer_kyc":
        return <KycStep {...props} />;
      case "sample":
        return <SampleStep {...props} />;
      case "contract_terms":
        return <ContractStep {...props} />;
      case "platform_fees":
        return <FeesStep {...props} />;
      case "rating":
        return <RatingStep {...props} />;
      default:
        if (step.kind === "documents") return <DocumentsStep {...props} step={step} />;
        if (step.kind === "confirm") return <ConfirmStep {...props} step={step} />;
        return <p style={{ fontSize: "0.88rem" }}>Waiting for the platform.</p>;
    }
  })();
  return (
    <div style={{ ...card, border: "2px solid #ef6c00" }}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Now: {step.name}</h2>
      {body}
    </div>
  );
}

function KycStep({ data, userId, setMsg }: P) {
  const { role, deal, parties } = data;
  const review = useMutation(api.exportDeals.reviewBuyerKyc);
  const [notes, setNotes] = useState("");
  const a = useRunner(async (decision: "approve" | "reject") => review({ adminId: userId, buyerId: deal.buyerId, decision, notes: notes || undefined }), setMsg, "KYC decision saved.");
  if (role === "buyer") return <BuyerKycPanel userId={userId} dealId={deal._id} setMsg={setMsg} />;
  if (role === "exporter") {
    return (
      <p style={{ fontSize: "0.88rem" }}>
        {parties.buyer.kycStatus === "submitted"
          ? "The buyer has submitted KYC documents for approval. You will be told when an admin approves them."
          : "Waiting for the buyer to submit KYC documents."}
      </p>
    );
  }
  return (
    <div>
      <p style={{ fontSize: "0.88rem" }}>
        Buyer KYC status: <b>{parties.buyer.kycStatus}</b>. Verify the buyer&apos;s documents in the admin Documents tab, then approve here.
      </p>
      <input style={input} placeholder="Reason (required to reject)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run("approve")}>
          Approve KYC
        </button>
        <button style={button("danger", a.busy)} disabled={a.busy} onClick={() => a.run("reject")}>
          Reject
        </button>
      </div>
    </div>
  );
}

function BuyerKycPanel({ userId, dealId, setMsg }: { userId: Id<"users">; dealId: Id<"exportDeals">; setMsg: (m: Msg) => void }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const kyc = useQuery(api.exportDeals.getMyKyc, { buyerId: userId, today });
  const getUrl = useMutation(api.exportDeals.generateDealUploadUrl);
  const upload = useMutation(api.exportDeals.uploadBuyerKycDocument);
  const submit = useMutation(api.exportDeals.submitBuyerKyc);
  const [busy, setBusy] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  if (!kyc) return <p>Loading...</p>;
  return (
    <div>
      <p style={{ fontSize: "0.85rem" }}>
        Status: <StatusPill state={kyc.kycStatus === "not_started" ? "draft" : kyc.kycStatus === "approved" ? "approved" : kyc.kycStatus} />
        {kyc.reviewNotes && <span style={{ color: "#c62828" }}> {kyc.reviewNotes}</span>}
      </p>
      {kyc.slots.map((s) => (
        <div key={s.type.key} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <b>
              {s.type.label}
              {s.type.required ? " *" : " (optional)"}
            </b>
            <StatusPill state={s.state} />
          </div>
          {s.current?.url && (
            <a href={s.current.url} target="_blank" rel="noreferrer">
              {s.current.fileName}
            </a>
          )}
          {s.current?.status === "rejected" && s.current.reviewNotes && <div style={{ color: "#c62828" }}>{s.current.reviewNotes}</div>}
          {(s.state === "missing" || s.state === "rejected" || s.state === "expired") && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {s.type.hasExpiry && (
                <input type="date" style={{ ...input, maxWidth: 170 }} value={expiry[s.type.key] ?? ""} onChange={(e) => setExpiry({ ...expiry, [s.type.key]: e.target.value })} title="Expiry date" />
              )}
              <input
                type="file"
                accept="application/pdf,image/*"
                disabled={busy === s.type.key}
                style={{ fontFamily: FONT }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setBusy(s.type.key);
                  try {
                    const storageId = await uploadToConvex(await getUrl({ userId }), file);
                    await upload({
                      buyerId: userId,
                      dealId,
                      documentTypeKey: s.type.key,
                      storageId: storageId as Id<"_storage">,
                      fileName: file.name,
                      contentType: file.type || undefined,
                      expiryDate: expiry[s.type.key] || undefined,
                    });
                  } catch (err) {
                    setMsg({ tone: "error", text: errorText(err) });
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            </div>
          )}
        </div>
      ))}
      {kyc.kycStatus !== "approved" && kyc.kycStatus !== "submitted" && (
        <button
          style={{ ...button("primary"), marginTop: "0.5rem" }}
          onClick={async () => {
            try {
              await submit({ buyerId: userId });
              setMsg({ tone: "success", text: "KYC submitted. The exporter has been told, and an admin will review it." });
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            }
          }}
        >
          Submit KYC for approval
        </button>
      )}
    </div>
  );
}

function SampleStep({ data, userId, setMsg }: P) {
  const { deal, role } = data;
  const s = deal.sample;
  const confirm = useMutation(api.exportDeals.confirmSampleRequest);
  const ready = useMutation(api.exportDeals.markSampleReady);
  const adminUpdate = useMutation(api.exportDeals.adminUpdateSample);
  const decide = useMutation(api.exportDeals.decideSample);
  const again = useMutation(api.exportDeals.offerNewSample);
  const [address, setAddress] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const a = useRunner(async (fn: () => Promise<unknown>) => fn(), setMsg);
  if (!s) return null;
  const statusText: Record<string, string> = {
    awaiting_buyer: "Waiting for the buyer to confirm the sample request.",
    awaiting_exporter: "Waiting for the exporter to prepare the sample.",
    ready: "The sample is ready. The platform will collect it from the exporter.",
    collected: "The platform has the sample and will send it to the buyer.",
    dispatched: `The sample is on its way${s.courier ? ` with ${s.courier}, tracking ${s.trackingNumber}` : ""}.`,
    rejected: `The buyer rejected the sample${s.buyerNotes ? `: ${s.buyerNotes}` : ""}.`,
  };
  return (
    <div style={{ fontSize: "0.88rem" }}>
      <p>
        {statusText[s.status] ?? s.status} {s.round > 1 && `(sample ${s.round})`}
      </p>
      {role === "buyer" && s.status === "awaiting_buyer" && (
        <div>
          <label style={label}>Where should the platform send the sample?</label>
          <textarea style={{ ...input, minHeight: 60 }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address with contact name and phone for the courier" />
          <p style={{ fontSize: "0.78rem", color: "#666" }}>Only the platform sees this address. Any sample handling fee is charged from your wallet.</p>
          <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => confirm({ buyerId: userId, dealId: deal._id, shippingAddress: address }))}>
            Confirm sample request
          </button>
        </div>
      )}
      {role === "buyer" && s.shippingAddress && s.status !== "awaiting_buyer" && <p style={{ color: "#666" }}>Sending to: {s.shippingAddress}</p>}
      {role === "exporter" && s.status === "awaiting_exporter" && (
        <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => ready({ userId, dealId: deal._id }))}>
          Sample is ready for collection
        </button>
      )}
      {role === "exporter" && s.status === "rejected" && (
        <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => again({ userId, dealId: deal._id }))}>
          Prepare another sample
        </button>
      )}
      {role === "admin" && s.status === "ready" && (
        <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => adminUpdate({ adminId: userId, dealId: deal._id, status: "collected" }))}>
          Mark collected from exporter
        </button>
      )}
      {role === "admin" && s.shippingAddress && <p>Ship to: {s.shippingAddress}</p>}
      {role === "admin" && s.status === "collected" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
          <input style={input} placeholder="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} />
          <input style={input} placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => adminUpdate({ adminId: userId, dealId: deal._id, status: "dispatched", courier, trackingNumber: tracking }))}>
            Mark sent to buyer
          </button>
        </div>
      )}
      {role === "buyer" && s.status === "dispatched" && (
        <div>
          <input style={input} placeholder="Notes (required to reject)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => decide({ buyerId: userId, dealId: deal._id, decision: "approve", notes: notes || undefined }))}>
              Approve sample
            </button>
            <button style={button("danger", a.busy)} disabled={a.busy} onClick={() => a.run(() => decide({ buyerId: userId, dealId: deal._id, decision: "reject", notes: notes || undefined }))}>
              Reject sample
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractStep({ data, userId, setMsg }: P) {
  const { deal, role, lot } = data;
  const propose = useMutation(api.exportDeals.proposeContract);
  const agree = useMutation(api.exportDeals.agreeContract);
  const c = deal.contract;
  const [editing, setEditing] = useState(!c);
  const [f, setF] = useState({
    priceUsdPerKg: String(c?.priceUsdPerKg ?? deal.agreedPriceUsdPerKg ?? ""),
    bags: String(c?.bags ?? deal.bags),
    incoterm: c?.incoterm ?? deal.incoterm,
    port: c?.port ?? deal.destinationPort ?? "",
    shipmentWindowStart: c?.shipmentWindowStart ?? "",
    shipmentWindowEnd: c?.shipmentWindowEnd ?? "",
    paymentTerms: c?.paymentTerms ?? PAYMENT_TERMS[0],
    otherTerms: c?.otherTerms ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const a = useRunner(async (fn: () => Promise<unknown>) => fn(), setMsg);
  if (role === "admin") {
    return <p style={{ fontSize: "0.88rem" }}>{c ? "Terms proposed; waiting for both sides to agree." : "Waiting for the buyer and exporter to propose terms."}</p>;
  }
  const iAgreed = c && ((role === "buyer" && c.buyerAgreedAt) || (role === "exporter" && c.exporterAgreedAt));
  return (
    <div style={{ fontSize: "0.88rem" }}>
      {c && !editing && (
        <div style={{ lineHeight: 1.7 }}>
          <div>
            {c.bags} bags × {c.bagWeightKg} kg at <b>{formatUsd(c.priceUsdPerKg)}/kg</b> = <b>{formatUsd(c.priceUsdPerKg * c.bags * c.bagWeightKg)}</b>
          </div>
          <div>
            {c.incoterm} {c.port} · shipment {c.shipmentWindowStart} to {c.shipmentWindowEnd}
          </div>
          <div>Payment: {c.paymentTerms}</div>
          {c.otherTerms && <div>Other terms: {c.otherTerms}</div>}
          <div style={{ color: "#666" }}>
            Exporter {c.exporterAgreedAt ? "agreed" : "has not agreed"} · Buyer {c.buyerAgreedAt ? "agreed" : "has not agreed"}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            {!iAgreed && (
              <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run(() => agree({ userId, dealId: deal._id }))}>
                Agree these terms
              </button>
            )}
            <button style={button("secondary")} onClick={() => setEditing(true)}>
              Propose changes
            </button>
          </div>
        </div>
      )}
      {editing && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Price (USD/kg)</label>
              <input style={input} value={f.priceUsdPerKg} onChange={set("priceUsdPerKg")} />
            </div>
            <div>
              <label style={label}>Bags (max {lot?.availableBags})</label>
              <input style={input} value={f.bags} onChange={set("bags")} />
            </div>
            <div>
              <label style={label}>Incoterm</label>
              <select style={input} value={f.incoterm} onChange={set("incoterm")}>
                {INCOTERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Port / place</label>
              <input style={input} value={f.port} onChange={set("port")} placeholder="e.g. Mombasa" />
            </div>
            <div>
              <label style={label}>Shipment from</label>
              <input style={input} type="date" value={f.shipmentWindowStart} onChange={set("shipmentWindowStart")} />
            </div>
            <div>
              <label style={label}>Shipment by</label>
              <input style={input} type="date" value={f.shipmentWindowEnd} onChange={set("shipmentWindowEnd")} />
            </div>
            <div>
              <label style={label}>Payment terms</label>
              <select style={input} value={f.paymentTerms} onChange={set("paymentTerms")}>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea style={{ ...input, minHeight: 60, marginTop: "0.5rem" }} placeholder="Other terms (quality claims, arbitration, contract rules such as ECF or GCA)" value={f.otherTerms} onChange={set("otherTerms")} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              style={button("primary", a.busy)}
              disabled={a.busy}
              onClick={async () => {
                const ok = await a.run(() =>
                  propose({
                    userId,
                    dealId: deal._id,
                    priceUsdPerKg: Number(f.priceUsdPerKg),
                    bags: Number(f.bags),
                    incoterm: f.incoterm,
                    port: f.port,
                    shipmentWindowStart: f.shipmentWindowStart,
                    shipmentWindowEnd: f.shipmentWindowEnd,
                    paymentTerms: f.paymentTerms,
                    otherTerms: f.otherTerms || undefined,
                  })
                );
                if (ok) setEditing(false);
              }}
            >
              Propose terms
            </button>
            {c && (
              <button style={button("secondary")} onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FeesStep({ data, userId, setMsg }: P) {
  const { deal, role } = data;
  const pay = useMutation(api.exportDeals.payDealFee);
  const a = useRunner(async () => pay({ userId, dealId: deal._id }), setMsg, "Fee paid.");
  const exporterGross = (deal.exporterFeeUgx ?? 0) + (deal.exporterFeeCreditUgx ?? 0);
  const myFee = role === "exporter" ? deal.exporterFeeUgx ?? 0 : deal.buyerFeeUgx ?? 0;
  const myPaid = role === "exporter" ? deal.exporterFeePaidAt : deal.buyerFeePaidAt;
  const balance = data.walletBalanceUgx ?? 0;
  return (
    <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
      <div>
        Exporter success fee: {formatUgx(exporterGross)}
        {deal.exporterFeeCreditUgx ? ` (verification credit ${formatUgx(deal.exporterFeeCreditUgx)}, due ${formatUgx(deal.exporterFeeUgx)})` : ""} ·{" "}
        {deal.exporterFeePaidAt || exporterGross === 0 ? "paid" : "not paid"}
      </div>
      <div>
        Buyer fee: {formatUgx(deal.buyerFeeUgx)} · {deal.buyerFeePaidAt || !deal.buyerFeeUgx ? "paid" : "not paid"}
      </div>
      <div style={{ color: "#666" }}>Converted at UGX {deal.fxUgxPerUsd?.toLocaleString()} per USD on the day the contract was agreed.</div>
      {(role === "exporter" || role === "buyer") && !myPaid && (role === "exporter" ? exporterGross > 0 : myFee > 0) && (
        <div style={{ marginTop: "0.5rem" }}>
          <div>Wallet balance: {formatUgx(balance)}</div>
          <button style={{ ...button("primary", a.busy), marginTop: "0.4rem" }} disabled={a.busy} onClick={() => a.run()}>
            Pay {formatUgx(myFee)} and reveal names
          </button>
          {balance < myFee && (
            <div style={{ marginTop: "0.4rem" }}>
              <Link
                href={role === "buyer" ? `/?deposit=${Math.ceil(myFee - balance)}&returnTo=/export-deals/${deal._id}` : "/trader/export"}
                style={{ color: "#0d47a1", fontWeight: 700 }}
              >
                Top up your wallet
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentsStep({ data, userId, setMsg, step }: P & { step: Data["steps"][number] }) {
  const { deal, role } = data;
  const getUrl = useMutation(api.exportDeals.generateDealUploadUrl);
  const upload = useMutation(api.exportDeals.uploadDealDocument);
  const review = useMutation(api.exportDeals.reviewDealDocument);
  const payment = useMutation(api.exportDeals.recordPaymentDetails);
  const shipment = useMutation(api.exportDeals.recordShipmentDetails);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [pf, setPf] = useState({ method: deal.paymentMethod ?? PAYMENT_TERMS[0], amount: String(deal.paymentAmountUsd ?? deal.contractValueUsd ?? ""), ref: deal.paymentReference ?? "" });
  const [sf, setSf] = useState({
    containerNumber: deal.containerNumber ?? "",
    sealNumber: deal.sealNumber ?? "",
    vessel: deal.vessel ?? "",
    blNumber: deal.blNumber ?? "",
    etd: deal.etd ?? "",
    eta: deal.eta ?? "",
    shippedOn: deal.shippedOn ?? "",
  });
  const canUpload = role === "admin" || step.actor === role;
  const docs = data.documents.filter((d) => d.stepKey === step.key);
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ fontSize: "0.88rem" }}>
      {step.key === "payment_security" && (role === "buyer" || role === "admin") && (
        <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.6rem", marginBottom: "0.6rem" }}>
          <b>Payment details (recorded in USD against the contract)</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginTop: "0.4rem" }}>
            <select style={input} value={pf.method} onChange={(e) => setPf({ ...pf, method: e.target.value })}>
              {PAYMENT_TERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input style={input} placeholder="Amount (USD)" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: e.target.value })} />
            <input style={input} placeholder="LC number / bank reference" value={pf.ref} onChange={(e) => setPf({ ...pf, ref: e.target.value })} />
          </div>
          <button
            style={{ ...button("secondary", busy === "pay"), marginTop: "0.4rem" }}
            disabled={busy === "pay"}
            onClick={() => run("pay", () => payment({ userId, dealId: deal._id, paymentMethod: pf.method, amountUsd: Number(pf.amount), reference: pf.ref || undefined }), "Payment details saved.")}
          >
            Save payment details
          </button>
        </div>
      )}
      {(step.key === "stuffing" || step.key === "shipped") && (role === "exporter" || role === "admin") && (
        <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.6rem", marginBottom: "0.6rem" }}>
          <b>{step.key === "stuffing" ? "Container details" : "Shipping details"}</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginTop: "0.4rem" }}>
            {step.key === "stuffing" ? (
              <>
                <input style={input} placeholder="Container number" value={sf.containerNumber} onChange={(e) => setSf({ ...sf, containerNumber: e.target.value })} />
                <input style={input} placeholder="Seal number" value={sf.sealNumber} onChange={(e) => setSf({ ...sf, sealNumber: e.target.value })} />
              </>
            ) : (
              <>
                <input style={input} placeholder="Vessel / flight" value={sf.vessel} onChange={(e) => setSf({ ...sf, vessel: e.target.value })} />
                <input style={input} placeholder="Bill of lading number" value={sf.blNumber} onChange={(e) => setSf({ ...sf, blNumber: e.target.value })} />
                <label style={{ fontSize: "0.78rem" }}>
                  Shipped on
                  <input style={input} type="date" value={sf.shippedOn} onChange={(e) => setSf({ ...sf, shippedOn: e.target.value })} />
                </label>
                <label style={{ fontSize: "0.78rem" }}>
                  ETA
                  <input style={input} type="date" value={sf.eta} onChange={(e) => setSf({ ...sf, eta: e.target.value })} />
                </label>
              </>
            )}
          </div>
          <button
            style={{ ...button("secondary", busy === "ship"), marginTop: "0.4rem" }}
            disabled={busy === "ship"}
            onClick={() =>
              run(
                "ship",
                () =>
                  shipment({
                    userId,
                    dealId: deal._id,
                    containerNumber: sf.containerNumber || undefined,
                    sealNumber: sf.sealNumber || undefined,
                    vessel: sf.vessel || undefined,
                    blNumber: sf.blNumber || undefined,
                    eta: sf.eta || undefined,
                    shippedOn: sf.shippedOn || undefined,
                  }),
                "Details saved."
              )
            }
          >
            Save details
          </button>
        </div>
      )}

      {step.requiredDocuments.map((labelText) => {
        const forLabel = docs.filter((d) => d.label === labelText).sort((a, b) => b.uploadedAt - a.uploadedAt);
        const latest = forLabel[0];
        const isPhoto = labelText.toLowerCase().includes("photo");
        return (
          <div key={labelText} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <b>{labelText}</b>
              <StatusPill state={latest ? (latest.status === "accepted" ? "verified" : latest.status) : "missing"} />
            </div>
            {latest?.url && (
              <a href={latest.url} target="_blank" rel="noreferrer">
                {latest.fileName}
              </a>
            )}
            {latest?.status === "rejected" && latest.reviewNotes && <div style={{ color: "#c62828" }}>{latest.reviewNotes}</div>}
            {role === "admin" && latest?.status === "pending" && (
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                <input style={{ ...input, maxWidth: 260 }} placeholder="Reason (to reject)" value={notes[latest._id] ?? ""} onChange={(e) => setNotes({ ...notes, [latest._id]: e.target.value })} />
                <button style={button("primary", busy === latest._id)} disabled={busy === latest._id} onClick={() => run(latest._id, () => review({ adminId: userId, documentId: latest._id, decision: "accept" }))}>
                  Accept
                </button>
                <button
                  style={button("danger", busy === latest._id)}
                  disabled={busy === latest._id}
                  onClick={() => run(latest._id, () => review({ adminId: userId, documentId: latest._id, decision: "reject", notes: notes[latest._id] }))}
                >
                  Reject
                </button>
              </div>
            )}
            {canUpload && latest?.status !== "accepted" && latest?.status !== "pending" && (
              <div style={{ marginTop: "0.3rem" }}>
                {isPhoto ? (
                  <>
                    <PhotoSetCapture photos={photos} onChange={setPhotos} max={1} />
                    {photos.length > 0 && (
                      <button
                        style={{ ...button("primary", busy === labelText), marginTop: "0.4rem" }}
                        disabled={busy === labelText}
                        onClick={() =>
                          run(labelText, async () => {
                            const p = photos[0];
                            const res = await fetch(await getUrl({ userId }), { method: "POST", body: dataUrlToBlob(p.dataUrl) });
                            const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
                            await upload({
                              userId,
                              dealId: deal._id,
                              stepKey: step.key,
                              label: labelText,
                              storageId,
                              fileName: `${labelText}.jpg`,
                              contentType: "image/jpeg",
                              lat: p.lat ?? undefined,
                              lng: p.lng ?? undefined,
                              capturedAt: p.capturedAt,
                            });
                            setPhotos([]);
                          })
                        }
                      >
                        Upload photo
                      </button>
                    )}
                  </>
                ) : (
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={busy === labelText}
                    style={{ fontFamily: FONT }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      run(labelText, async () => {
                        const storageId = await uploadToConvex(await getUrl({ userId }), file);
                        await upload({ userId, dealId: deal._id, stepKey: step.key, label: labelText, storageId: storageId as Id<"_storage">, fileName: file.name, contentType: file.type || undefined });
                      });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      {!canUpload && <p style={{ color: "#666" }}>The {step.actor} uploads these; an admin verifies them.</p>}
    </div>
  );
}

function ConfirmStep({ data, userId, setMsg, step }: P & { step: Data["steps"][number] }) {
  const confirm = useMutation(api.exportDeals.confirmDealStep);
  const a = useRunner(async () => confirm({ userId, dealId: data.deal._id, stepKey: step.key }), setMsg, "Confirmed.");
  if (data.role !== "admin" && step.actor !== data.role) return <p style={{ fontSize: "0.88rem" }}>Waiting for the {step.actor} to confirm.</p>;
  return (
    <button style={button("primary", a.busy)} disabled={a.busy} onClick={() => a.run()}>
      Confirm: {step.name}
    </button>
  );
}

function RatingStep({ data, userId, setMsg }: P) {
  const rate = useMutation(api.exportDeals.rateDeal);
  const [r, setR] = useState({ overall: 5, quality: 5, documents: 5, communication: 5 });
  const [comment, setComment] = useState("");
  const a = useRunner(async () => rate({ buyerId: userId, dealId: data.deal._id, ...r, comment: comment || undefined }), setMsg, "Thank you for rating.");
  if (data.role !== "buyer") return <p style={{ fontSize: "0.88rem" }}>Waiting for the buyer to rate the exporter.</p>;
  return (
    <div style={{ fontSize: "0.88rem" }}>
      {(["overall", "quality", "documents", "communication"] as const).map((k) => (
        <div key={k} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
          <span style={{ width: 120, textTransform: "capitalize" }}>{k}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setR({ ...r, [k]: n })}
              style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: n <= r[k] ? "#f9a825" : "#ccc" }}
              aria-label={`${k} ${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
      ))}
      <textarea style={{ ...input, minHeight: 60 }} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button style={{ ...button("primary", a.busy), marginTop: "0.5rem" }} disabled={a.busy} onClick={() => a.run()}>
        Submit rating
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Messages and cancellation
// ------------------------------------------------------------------

function Messages({ data, userId, setMsg }: P) {
  const send = useMutation(api.exportDeals.sendDealMessage);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Messages</h2>
      <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
        {data.messages.length === 0 && <p style={{ fontSize: "0.85rem", color: "#666" }}>No messages yet.</p>}
        {data.messages.map((m) => (
          <div
            key={m._id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              background: m.mine ? "#e8f5e9" : m.senderRole === "admin" ? "#fff8e1" : "#f5f5f5",
              borderRadius: 10,
              padding: "0.45rem 0.65rem",
              maxWidth: "85%",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "#777" }}>
              {m.mine ? "You" : m.senderRole === "admin" ? "Platform admin" : m.senderRole === "buyer" ? "Buyer" : "Exporter"} · {formatUgandaDateTime(m.createdAt)}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input style={input} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" />
        <button
          style={button("primary", busy || !body.trim())}
          disabled={busy || !body.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await send({ userId, dealId: data.deal._id, body });
              setBody("");
              if (r.masked) setMsg({ tone: "info", text: "Contact details were hidden. They are shared once the platform fees are paid." });
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function CancelDeal({ data, userId, setMsg }: P) {
  const cancel = useMutation(api.exportDeals.declineOrCancelDeal);
  const feesPaid = !!data.deal.exporterFeePaidAt || !!data.deal.buyerFeePaidAt;
  if (feesPaid && data.role !== "admin") return null;
  return (
    <div style={{ textAlign: "right", marginBottom: "2rem" }}>
      <button
        style={button("danger")}
        onClick={async () => {
          const reason = window.prompt(data.deal.status === "in_progress" ? "Why are you cancelling this deal?" : "Why are you declining?");
          if (!reason) return;
          try {
            await cancel({ userId, dealId: data.deal._id, reason });
            setMsg({ tone: "success", text: "Deal closed." });
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          }
        }}
      >
        {data.deal.status === "in_progress" ? "Cancel deal" : "Decline"}
      </button>
    </div>
  );
}
