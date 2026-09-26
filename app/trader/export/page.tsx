"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useStoredUser } from "../../hooks/useStoredUser";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import {
  FONT,
  ON_PHOTO_SHADOW,
  EXPORT_BROWN,
  card,
  input,
  label,
  button,
  StatusPill,
  Notice,
  formatUgx,
  uploadToConvex,
} from "../../components/exportMarkets/ui";
import { ExporterLots } from "../../components/exportMarkets/ExporterLots";
import { DealsList } from "../../components/exportMarkets/DealsList";
import { PriceTicker } from "../../components/exportMarkets/PriceTicker";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;

const CHECK_LABELS: [string, string][] = [
  ["verifiedTrader", "Trader account verified by a super admin"],
  ["inExportCommunity", "Added to an exporter community"],
  ["profileSaved", "Exporter profile saved"],
  ["requiredDocsUploaded", "Required documents uploaded"],
  ["feeOk", "Verification fee paid"],
  ["requiredDocsVerified", "Required documents verified by an admin"],
  ["approved", "Exporter profile approved"],
];

function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  // Convex wraps server errors: keep the human part.
  const match = m.match(/Uncaught Error: (.*?)(\n|$| at )/);
  return match ? match[1] : m;
}

export default function ExporterWorkspacePage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const ws = useQuery(api.exportMarkets.getMyExporterWorkspace, userId ? { userId, today } : "skip");

  const [msg, setMsg] = useState<Msg>(null);
  const [tab, setTab] = useState<"setup" | "lots" | "deals">("setup");

  if (authStatus === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!user || user.role !== "trader" || !userId) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Export Markets is available to trader accounts.</div>;
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 820, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#0d47a1", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", textShadow: ON_PHOTO_SHADOW }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 0.25rem", color: EXPORT_BROWN, textShadow: ON_PHOTO_SHADOW }}>
        ☕ Export Markets
      </h1>
      <p style={{ color: "#222", fontWeight: 600, fontSize: "0.88rem", marginTop: 0, textShadow: ON_PHOTO_SHADOW }}>
        Sell green coffee in export volumes to verified international buyers. Buyers see your alias, rating and
        record until the platform fees on a deal are paid.
      </p>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <PriceTicker />

      {ws === undefined ? (
        <div style={card}>Loading your exporter workspace...</div>
      ) : !ws.checks.verifiedTrader || !ws.checks.inExportCommunity ? (
        <div style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Not yet available</h2>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
            Export Markets opens once a super admin has verified your trader account and an admin has added you to an
            exporter community.
          </p>
          <Checklist checks={ws.checks} />
        </div>
      ) : (
        <>
          {ws.profile && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {([
                ["setup", "Profile & documents"],
                ["lots", "Lots & trace map"],
                ["deals", "Deals"],
              ] as const).map(([key, text]) => (
                <button key={key} style={button(tab === key ? "primary" : "secondary")} onClick={() => setTab(key)}>
                  {text}
                </button>
              ))}
            </div>
          )}
          {tab === "setup" || !ws.profile ? (
            <>
              <StatusCard ws={ws} userId={userId} setMsg={setMsg} />
              <ProfileCard ws={ws} userId={userId} setMsg={setMsg} />
              {ws.profile && <FeeCard ws={ws} userId={userId} setMsg={setMsg} />}
              {ws.profile && <DocumentsCard ws={ws} userId={userId} setMsg={setMsg} />}
            </>
          ) : tab === "lots" ? (
            <ExporterLots userId={userId} isActiveExporter={ws.isActiveExporter} />
          ) : (
            <DealsList userId={userId} viewer="exporter" />
          )}
        </>
      )}
    </div>
  );
}

type WS = FunctionReturnType<typeof api.exportMarkets.getMyExporterWorkspace>;
type CardProps = { ws: WS; userId: Id<"users">; setMsg: (m: Msg) => void };

function Checklist({ checks }: { checks: Record<string, boolean> }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {CHECK_LABELS.map(([key, text]) => (
        <li key={key} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.25rem 0", fontSize: "0.9rem" }}>
          <span style={{ color: checks[key] ? "#2e7d32" : "#9e9e9e", fontWeight: 800 }}>{checks[key] ? "✓" : "○"}</span>
          <span style={{ color: checks[key] ? "#222" : "#666" }}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function StatusCard({ ws, userId, setMsg }: CardProps) {
  const submit = useMutation(api.exportMarkets.submitExporterProfile);
  const [busy, setBusy] = useState(false);
  const status = ws.profile?.status ?? "draft";
  const canSubmit =
    !!ws.profile &&
    (status === "draft" || status === "rejected") &&
    ws.checks.requiredDocsUploaded &&
    ws.checks.feeOk;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your exporter status</h2>
        {ws.isActiveExporter ? <StatusPill state="approved" /> : <StatusPill state={status} />}
      </div>
      {ws.isActiveExporter ? (
        <p style={{ fontSize: "0.9rem" }}>
          You are a live exporter. Create and list lots in the Lots tab; enquiries arrive in the Deals tab.
        </p>
      ) : status === "approved" ? (
        <Notice tone="error">
          Your profile is approved, but a required document or your verification fee has lapsed. Your listings stay
          hidden until it is renewed and verified.
        </Notice>
      ) : null}
      {ws.profile?.reviewNotes && (status === "rejected" || status === "suspended") && (
        <Notice tone="error">Admin note: {ws.profile.reviewNotes}</Notice>
      )}
      <Checklist checks={ws.checks} />
      {(status === "draft" || status === "rejected") && (
        <div style={{ marginTop: "0.75rem" }}>
          <button
            style={button("primary", !canSubmit || busy)}
            disabled={!canSubmit || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await submit({ userId });
                setMsg({ tone: "success", text: "Submitted. An admin will review your profile and documents." });
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            Submit for review
          </button>
          {!canSubmit && (
            <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 0 }}>
              Save your profile, upload every required document and pay the verification fee to submit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ ws, userId, setMsg }: CardProps) {
  const save = useMutation(api.exportMarkets.saveExporterProfile);
  const p = ws.profile;
  const [open, setOpen] = useState(!p);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    communityId: (p?.communityId ?? ws.communities[0]?._id ?? "") as string,
    legalName: p?.legalName ?? "",
    tradingName: p?.tradingName ?? "",
    tin: p?.tin ?? "",
    exporterLicenceNumber: p?.exporterLicenceNumber ?? "",
    physicalAddress: p?.physicalAddress ?? "",
    preferredPorts: (p?.preferredPorts ?? []).join(", "),
    contactPerson: p?.contactPerson ?? "",
    contactPhone: p?.contactPhone ?? "",
    contactEmail: p?.contactEmail ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const field = (k: keyof typeof form, text: string, placeholder = "", required = false) => (
    <div style={{ marginBottom: "0.7rem" }}>
      <label style={label}>
        {text}
        {required && " *"}
      </label>
      <input style={input} value={form[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Exporter profile</h2>
        {p && (
          <button style={button("secondary")} onClick={() => setOpen(!open)}>
            {open ? "Close" : "Edit"}
          </button>
        )}
      </div>
      {p && !open && (
        <div style={{ fontSize: "0.9rem", lineHeight: 1.7, marginTop: "0.5rem" }}>
          <div><b>{p.legalName}</b>{p.tradingName ? ` (trading as ${p.tradingName})` : ""}</div>
          <div>TIN {p.tin}{p.exporterLicenceNumber ? ` · Licence ${p.exporterLicenceNumber}` : ""}</div>
          <div>{p.physicalAddress}</div>
          {p.preferredPorts.length > 0 && <div>Ports: {p.preferredPorts.join(", ")}</div>}
          <div>{p.contactPerson} · {p.contactPhone}{p.contactEmail ? ` · ${p.contactEmail}` : ""}</div>
          <p style={{ fontSize: "0.8rem", color: "#666" }}>
            Buyers do not see these details until the platform fees on a deal are paid.
          </p>
        </div>
      )}
      {open && (
        <div style={{ marginTop: "0.75rem" }}>
          {ws.communities.length > 1 && (
            <div style={{ marginBottom: "0.7rem" }}>
              <label style={label}>Exporter community *</label>
              <select style={input} value={form.communityId} onChange={set("communityId")}>
                {ws.communities.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {field("legalName", "Legal company name", "As on your certificate of incorporation", true)}
          {field("tradingName", "Trading name")}
          {field("tin", "URA TIN", "", true)}
          {field("exporterLicenceNumber", "Coffee exporter registration / licence number")}
          {field("physicalAddress", "Physical address", "Office or store address", true)}
          {field("preferredPorts", "Preferred ports (comma separated)", "e.g. Mombasa, Dar es Salaam")}
          {field("contactPerson", "Contact person", "", true)}
          {field("contactPhone", "Contact phone", "", true)}
          {field("contactEmail", "Contact email")}
          {p?.status === "approved" && (
            <Notice tone="info">Changing the legal name, TIN or licence number sends your profile back for review.</Notice>
          )}
          <button
            style={button("primary", busy)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await save({
                  userId,
                  communityId: form.communityId as Id<"communities">,
                  legalName: form.legalName,
                  tradingName: form.tradingName || undefined,
                  tin: form.tin,
                  exporterLicenceNumber: form.exporterLicenceNumber || undefined,
                  physicalAddress: form.physicalAddress,
                  preferredPorts: form.preferredPorts.split(",").map((s) => s.trim()).filter(Boolean),
                  contactPerson: form.contactPerson,
                  contactPhone: form.contactPhone,
                  contactEmail: form.contactEmail || undefined,
                });
                setMsg({ tone: "success", text: "Exporter profile saved." });
                setOpen(false);
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            Save profile
          </button>
        </div>
      )}
    </div>
  );
}

function FeeCard({ ws, userId, setMsg }: CardProps) {
  const pay = useMutation(api.exportMarkets.payExporterVerificationFee);
  const deposit = useAction(api.pesapal.initiateTraderDeposit);
  const [busy, setBusy] = useState(false);
  const [topUp, setTopUp] = useState("");
  const fee = ws.fee;
  const shortfall = Math.max(0, fee.amountUgx - ws.walletBalanceUgx);
  useEffect(() => {
    if (shortfall > 0 && !topUp) setTopUp(String(shortfall));
  }, [shortfall, topUp]);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Verification fee</h2>
        <StatusPill state={fee.state} />
      </div>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
        {fee.amountUgx > 0 ? (
          <>
            The exporter verification fee is <b>{formatUgx(fee.amountUgx)}</b>, valid for {fee.validityDays} days.
            {fee.creditsAgainstSuccessFee && " It is credited against the success fee on your first deals."}
          </>
        ) : (
          <>There is currently no verification fee.</>
        )}
      </p>
      {ws.profile?.verificationFeeValidUntil && (
        <p style={{ fontSize: "0.85rem" }}>Valid until {ws.profile.verificationFeeValidUntil} (Uganda date).</p>
      )}
      {(ws.profile?.successFeeCreditUgx ?? 0) > 0 && (
        <p style={{ fontSize: "0.85rem" }}>Success fee credit available: {formatUgx(ws.profile?.successFeeCreditUgx)}</p>
      )}
      {fee.renewalOpen && (
        <>
          <p style={{ fontSize: "0.85rem" }}>Wallet balance: <b>{formatUgx(ws.walletBalanceUgx)}</b></p>
          <button
            style={button("primary", busy || shortfall > 0)}
            disabled={busy || shortfall > 0}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await pay({ userId });
                setMsg({
                  tone: "success",
                  text: r.waived ? "No fee is due. You can submit for review." : `Paid ${formatUgx(r.amountUgx)} from your wallet.`,
                });
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {fee.amountUgx > 0 ? `Pay ${formatUgx(fee.amountUgx)} from wallet` : "Confirm (no fee)"}
          </button>
          {shortfall > 0 && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #eee" }}>
              <label style={label}>Top up your wallet with Pesapal (UGX)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input style={input} type="number" min={1} value={topUp} onChange={(e) => setTopUp(e.target.value)} />
                <button
                  style={button("secondary", busy)}
                  disabled={busy}
                  onClick={async () => {
                    const amount = Number(topUp);
                    if (!amount || amount <= 0) return setMsg({ tone: "error", text: "Enter a valid amount" });
                    setBusy(true);
                    try {
                      const origin = window.location.origin;
                      const r = await deposit({
                        traderId: userId,
                        amount,
                        currency: "UGX",
                        callbackUrl: `${origin}/payment/callback`,
                        cancelUrl: `${origin}/trader/export`,
                      });
                      window.location.href = r.redirectUrl;
                    } catch (e) {
                      setMsg({ tone: "error", text: errorText(e) });
                      setBusy(false);
                    }
                  }}
                >
                  Top up
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DocumentsCard({ ws, userId, setMsg }: CardProps) {
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Document vault</h2>
      <p style={{ fontSize: "0.85rem", color: "#555", marginTop: 0 }}>
        Community admins and super admins verify each document. You are warned 30 days before anything expires, and an
        expired licence hides your listings until the renewal is verified.
      </p>
      {ws.slots.map((slot) => (
        <DocumentSlot key={slot.type.key} slot={slot} userId={userId} setMsg={setMsg} />
      ))}
    </div>
  );
}

function DocumentSlot({ slot, userId, setMsg }: { slot: WS["slots"][number]; userId: Id<"users">; setMsg: (m: Msg) => void }) {
  const getUploadUrl = useMutation(api.exportMarkets.generateExportDocumentUploadUrl);
  const upload = useMutation(api.exportMarkets.uploadExporterDocument);
  const remove = useMutation(api.exportMarkets.removeMyPendingDocument);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const shown = slot.current ?? slot.verified;
  const pendingRenewal = slot.verified && slot.current && slot.current._id !== slot.verified._id ? slot.current : null;
  const action = useMemo(() => {
    if (slot.state === "missing") return "Upload";
    if (slot.state === "expiring" || slot.state === "expired") return "Upload renewal";
    return "Replace";
  }, [slot.state]);

  return (
    <div style={{ borderTop: "1px solid #eee", padding: "0.75rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {slot.type.label}
            {slot.type.required ? <span style={{ color: "#c62828" }}> *</span> : <span style={{ color: "#777", fontWeight: 500 }}> (optional)</span>}
          </div>
          {slot.type.description && <div style={{ fontSize: "0.8rem", color: "#666" }}>{slot.type.description}</div>}
        </div>
        <StatusPill state={slot.state} />
      </div>

      {shown && (
        <div style={{ fontSize: "0.82rem", marginTop: "0.4rem", lineHeight: 1.6 }}>
          {slot.verified && (
            <div>
              In force:{" "}
              {slot.verified.url ? (
                <a href={slot.verified.url} target="_blank" rel="noreferrer">{slot.verified.fileName}</a>
              ) : (
                slot.verified.fileName
              )}
              {slot.verified.expiryDate ? ` · expires ${slot.verified.expiryDate}` : ""}
            </div>
          )}
          {(pendingRenewal ?? (!slot.verified ? slot.current : null)) && (() => {
            const d = (pendingRenewal ?? slot.current)!;
            return (
              <div>
                {d.status === "pending" ? "Awaiting review" : "Rejected"}:{" "}
                {d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.fileName}</a> : d.fileName}
                {d.expiryDate ? ` · expires ${d.expiryDate}` : ""} · uploaded {formatUgandaDateTime(d.uploadedAt)}
                {d.status === "rejected" && d.reviewNotes && <div style={{ color: "#c62828" }}>Reason: {d.reviewNotes}</div>}
                <button
                  style={{ ...button("danger", busy), padding: "0.2rem 0.6rem", fontSize: "0.75rem", marginLeft: "0.5rem" }}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await remove({ userId, documentId: d._id });
                    } catch (e) {
                      setMsg({ tone: "error", text: errorText(e) });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {!open ? (
        <button style={{ ...button("secondary"), marginTop: "0.5rem" }} onClick={() => setOpen(true)}>
          {action}
        </button>
      ) : (
        <div style={{ marginTop: "0.6rem", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem" }}>
          <label style={label}>File (PDF or photo) *</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ marginBottom: "0.6rem", fontFamily: FONT }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Document number</label>
              <input style={input} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
            <div>
              <label style={label}>Issue date</label>
              <input style={input} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            {slot.type.hasExpiry && (
              <div>
                <label style={label}>Expiry date *</label>
                <input style={input} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button
              style={button("primary", busy || !file)}
              disabled={busy || !file}
              onClick={async () => {
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) return setMsg({ tone: "error", text: "Files must be 10 MB or smaller." });
                setBusy(true);
                try {
                  const url = await getUploadUrl({ userId });
                  const storageId = await uploadToConvex(url, file);
                  await upload({
                    userId,
                    documentTypeKey: slot.type.key,
                    storageId: storageId as Id<"_storage">,
                    fileName: file.name,
                    contentType: file.type || undefined,
                    documentNumber: docNumber || undefined,
                    issueDate: issueDate || undefined,
                    expiryDate: expiryDate || undefined,
                  });
                  setMsg({ tone: "success", text: `${slot.type.label} uploaded. An admin will review it.` });
                  setOpen(false);
                  setFile(null);
                  setDocNumber("");
                  setIssueDate("");
                  setExpiryDate("");
                } catch (e) {
                  setMsg({ tone: "error", text: errorText(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Uploading..." : "Upload"}
            </button>
            <button style={button("secondary", busy)} disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
