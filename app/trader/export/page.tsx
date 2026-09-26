"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useStoredUser } from "../../hooks/useStoredUser";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { DEFAULT_EXPORT_CROP, PRODUCT_FORMS, docTypeAppliesTo, ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import {
  FONT,
  EXPORT_HEADING,
  EXPORT_PRIMARY,
  EXPORT_SKY,
  EXPORT_SKY_BORDER,
  card,
  input,
  label,
  button,
  StatusPill,
  Notice,
  PageHeader,
  CropTabs,
  formatUgx,
  uploadToConvex,
  errorText,
} from "../../components/exportMarkets/ui";
import { ExporterLots } from "../../components/exportMarkets/ExporterLots";
import { DealsList } from "../../components/exportMarkets/DealsList";
import { PriceTicker } from "../../components/exportMarkets/PriceTicker";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type Tab = "overview" | "profile" | "documents" | "lots" | "deals";

const TABS: { key: Tab; label: string; needs: string }[] = [
  { key: "overview", label: "Overview", needs: "Your progress and everything you need to become a live exporter." },
  { key: "profile", label: "Company profile", needs: "Legal name, URA TIN, licence number, address, ports, contact person and the products you export." },
  { key: "documents", label: "Documents & fee", needs: "Upload each required document with its expiry date, and pay the verification fee from your wallet." },
  { key: "lots", label: "Lots & trace map", needs: "Describe each lot, link where the coffee came from, and add proof photos at every stage of the journey." },
  { key: "deals", label: "Deals", needs: "Buyer enquiries, quotes, samples, contracts, shipment documents and ratings." },
];

/** Each checklist item and where the trader goes to act on it. */
const CHECKS: { key: string; text: string; tab?: Tab; who?: string }[] = [
  { key: "verifiedTrader", text: "Trader account verified by a super admin", who: "A super admin does this." },
  { key: "inExportCommunity", text: "Added to an exporter community", who: "An admin adds you." },
  { key: "profileSaved", text: "Company profile saved", tab: "profile" },
  { key: "requiredDocsUploaded", text: "Required documents uploaded", tab: "documents" },
  { key: "feeOk", text: "Verification fee paid", tab: "documents" },
  { key: "requiredDocsVerified", text: "Required documents verified by an admin", tab: "documents" },
  { key: "approved", text: "Exporter profile approved", tab: "overview" },
];

export default function ExporterWorkspacePage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const ws = useQuery(api.exportMarkets.getMyExporterWorkspace, userId && user?.role === "trader" ? { userId, today } : "skip");
  const [msg, setMsg] = useState<Msg>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [crop, setCrop] = useState<string>(DEFAULT_EXPORT_CROP);

  const go = (t: Tab) => {
    setTab(t);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authStatus === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!user || user.role !== "trader" || !userId) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Export Markets is available to trader accounts.</div>;
  }
  const member = !!ws && ws.checks.verifiedTrader && ws.checks.inExportCommunity;

  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto", fontFamily: FONT }}>
      <PageHeader
        title="Export Markets"
        backHref="/"
        subtitle="Sell in export volumes to verified international buyers. Buyers see your alias, rating and delivery record until the platform fees on a deal are paid."
        right={ws ? <StatusPill state={ws.isActiveExporter ? "approved" : ws.profile?.status ?? "draft"} /> : null}
      />
      <CropTabs value={crop} onChange={setCrop} />
      <PriceTicker />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {/* Every tab is open for exploring; each says what it needs. */}
      <div role="tablist" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} style={button(tab === t.key ? "primary" : "secondary")} onClick={() => go(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ background: EXPORT_SKY, border: `1px solid ${EXPORT_SKY_BORDER}`, borderRadius: 12, padding: "0.7rem 0.9rem", marginBottom: "1.25rem", fontSize: "0.88rem", color: EXPORT_HEADING }}>
        <b>This tab:</b> {TABS.find((t) => t.key === tab)?.needs}
      </div>

      {ws === undefined ? (
        <div style={card}>Loading your exporter workspace...</div>
      ) : (
        <>
          {!member && (
            <Notice tone="info">
              You can explore every tab now. Saving and uploading open once a super admin has verified your trader account and an admin has
              added you to an exporter community.
            </Notice>
          )}
          {tab === "overview" && (
            <>
              <StatusCard ws={ws} userId={userId} setMsg={setMsg} go={go} member={member} />
              <RequirementsCard ws={ws} go={go} />
            </>
          )}
          {tab === "profile" && <ProfileCard ws={ws} userId={userId} setMsg={setMsg} member={member} />}
          {tab === "documents" && (
            <>
              <DocumentsCard ws={ws} userId={userId} setMsg={setMsg} member={member} />
              <FeeCard ws={ws} userId={userId} setMsg={setMsg} />
            </>
          )}
          {tab === "lots" &&
            (ws.profile ? (
              <ExporterLots userId={userId} isActiveExporter={ws.isActiveExporter} crop={crop} productForms={ws.profile.productForms ?? ["green"]} />
            ) : (
              <div style={card}>
                <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Lots and the trace map</h2>
                <p>Once your company profile is saved you can create lots here. For each lot you will give:</p>
                <ul style={{ lineHeight: 1.8 }}>
                  <li>Coffee type, grade, processing, crop year, origin, bags and bag weight, moisture, screen size, defects and cup score.</li>
                  <li>Whether it is green beans, roasted or packaged for consumption.</li>
                  <li>Photos, the warehouse and the Incoterms you offer. Prices are given on request.</li>
                  <li>Where the coffee came from: your platform purchases, Advanced Markets commitments, or declared farms with GPS locations.</li>
                  <li>Proof photos with GPS and time, and weights, at each stage from harvest to export bagging.</li>
                </ul>
                <button style={button("primary")} onClick={() => go("profile")}>
                  Go to company profile
                </button>
              </div>
            ))}
          {tab === "deals" && <DealsList userId={userId} viewer="exporter" />}
        </>
      )}
    </div>
  );
}

type WS = FunctionReturnType<typeof api.exportMarkets.getMyExporterWorkspace>;
type CardProps = { ws: WS; userId: Id<"users">; setMsg: (m: Msg) => void };

function StatusCard({ ws, userId, setMsg, go, member }: CardProps & { go: (t: Tab) => void; member: boolean }) {
  const submit = useMutation(api.exportMarkets.submitExporterProfile);
  const [busy, setBusy] = useState(false);
  const status = ws.profile?.status ?? "draft";
  const checks = ws.checks as Record<string, boolean>;
  const done = CHECKS.filter((c) => checks[c.key]).length;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem", color: EXPORT_HEADING }}>Your exporter status</h2>
        <span style={{ fontSize: "0.85rem", color: "#546e7a" }}>
          {done} of {CHECKS.length} done
        </span>
      </div>
      <div style={{ height: 8, background: "#eceff1", borderRadius: 999, margin: "0.6rem 0 0.9rem", overflow: "hidden" }}>
        <div style={{ width: `${(done / CHECKS.length) * 100}%`, height: "100%", background: EXPORT_PRIMARY }} />
      </div>
      {ws.isActiveExporter && <Notice tone="success">You are a live exporter. List lots in the Lots tab; enquiries arrive in Deals.</Notice>}
      {!ws.isActiveExporter && status === "approved" && (
        <Notice tone="error">Your profile is approved, but a required document or your verification fee has lapsed. Your lots stay hidden until renewed.</Notice>
      )}
      {ws.profile?.reviewNotes && (status === "rejected" || status === "suspended") && <Notice tone="error">Admin note: {ws.profile.reviewNotes}</Notice>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
        {CHECKS.map((c) => {
          const ok = checks[c.key];
          const clickable = !!c.tab && !ok;
          return (
            <li key={c.key}>
              <button
                disabled={!clickable}
                onClick={() => c.tab && go(c.tab)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  textAlign: "left",
                  padding: "0.65rem 0.8rem",
                  borderRadius: 10,
                  border: `1px solid ${ok ? "#c8e6c9" : clickable ? EXPORT_SKY_BORDER : "#eceff1"}`,
                  background: ok ? "#f1f8e9" : clickable ? "#fff" : "#fafafa",
                  cursor: clickable ? "pointer" : "default",
                  fontFamily: FONT,
                  fontSize: "0.92rem",
                  color: "#263238",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    background: ok ? "#2e7d32" : "#cfd8dc",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                  }}
                >
                  {ok ? "✓" : ""}
                </span>
                <span style={{ flex: 1 }}>
                  {c.text}
                  {!ok && c.who && <span style={{ display: "block", fontSize: "0.78rem", color: "#78909c" }}>{c.who}</span>}
                </span>
                {clickable && <span style={{ color: EXPORT_PRIMARY, fontWeight: 700, fontSize: "0.85rem" }}>Go →</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {member && ws.profile && (status === "draft" || status === "rejected") && (
        <div style={{ marginTop: "1rem" }}>
          <button
            style={button("primary", busy)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await submit({ userId });
                setMsg({ tone: "success", text: "Submitted. Admins review each document as it arrives; keep adding and updating anytime." });
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {status === "rejected" ? "Resubmit for review" : "Submit for review"}
          </button>
          <p style={{ fontSize: "0.82rem", color: "#607d8b", marginBottom: 0 }}>
            You can submit now and keep updating your profile and documents. Approval happens once every required document is verified and the
            fee is paid.
          </p>
        </div>
      )}
      {status === "submitted" && (
        <p style={{ fontSize: "0.85rem", color: "#607d8b", marginBottom: 0 }}>Submitted for review. You can keep updating your details and documents.</p>
      )}
    </div>
  );
}

/** Everything an exporter needs, visible before anything is uploaded. */
function RequirementsCard({ ws, go }: { ws: WS; go: (t: Tab) => void }) {
  const forms = ws.profile?.productForms ?? ["green"];
  const stateByKey = new Map(ws.slots.map((s) => [s.type.key, s.state]));
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.15rem", color: EXPORT_HEADING }}>What you need</h2>
      <p style={{ fontSize: "0.9rem", marginTop: 0 }}>
        Documents depend on what you export. You currently export: <b>{forms.map((f) => PRODUCT_FORMS.find((p) => p.key === f)?.label ?? f).join(", ")}</b>{" "}
        <button style={{ ...button("secondary"), padding: "0.2rem 0.6rem", minHeight: 0, fontSize: "0.8rem" }} onClick={() => go("profile")}>
          Change
        </button>
      </p>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {ws.allDocumentTypes.map((t) => {
          const applies = docTypeAppliesTo(t, forms);
          const state = stateByKey.get(t.key);
          return (
            <div
              key={t.key}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                padding: "0.65rem 0.8rem",
                borderRadius: 10,
                border: `1px solid ${applies ? EXPORT_SKY_BORDER : "#eceff1"}`,
                background: applies ? "#fff" : "#fafafa",
                opacity: applies ? 1 : 0.75,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                  {t.label}{" "}
                  <span style={{ fontWeight: 600, fontSize: "0.75rem", color: applies && t.required ? "#c62828" : "#78909c" }}>
                    {applies ? (t.required ? "required" : "optional") : "not needed for your products"}
                  </span>
                </div>
                {t.description && <div style={{ fontSize: "0.8rem", color: "#607d8b" }}>{t.description}</div>}
                {t.productForms && t.productForms.length > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#78909c" }}>
                    For: {t.productForms.map((f) => PRODUCT_FORMS.find((p) => p.key === f)?.label ?? f).join(", ")}
                  </div>
                )}
                {t.hasExpiry && <div style={{ fontSize: "0.75rem", color: "#78909c" }}>Has an expiry date: you are reminded 30 days before.</div>}
              </div>
              {applies && <StatusPill state={state ?? "missing"} />}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "0.88rem", marginBottom: "0.5rem" }}>
        Plus the verification fee: <b>{ws.fee.amountUgx > 0 ? formatUgx(ws.fee.amountUgx) : "none at the moment"}</b>, paid from your wallet.
      </p>
      <button style={button("primary")} onClick={() => go("documents")}>
        Go to documents
      </button>
    </div>
  );
}

function ProfileCard({ ws, userId, setMsg, member }: CardProps & { member: boolean }) {
  const save = useMutation(api.exportMarkets.saveExporterProfile);
  const p = ws.profile;
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
  const [forms, setForms] = useState<string[]>(p?.productForms ?? ["green"]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const field = (k: keyof typeof form, text: string, placeholder = "", required = false) => (
    <div>
      <label style={label}>
        {text}
        {required && <span style={{ color: "#c62828" }}> *</span>}
      </label>
      <input style={input} value={form[k]} onChange={set(k)} placeholder={placeholder} disabled={!member} />
    </div>
  );

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.15rem", color: EXPORT_HEADING }}>Company profile</h2>
      <p style={{ fontSize: "0.85rem", color: "#607d8b", marginTop: 0 }}>
        Save as you go: you can come back and update these details anytime. Buyers do not see them until the platform fees on a deal are paid.
      </p>

      <label style={label}>What do you export? *</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
        {PRODUCT_FORMS.map((pf) => {
          const on = forms.includes(pf.key);
          return (
            <label
              key={pf.key}
              style={{
                display: "flex",
                gap: "0.55rem",
                alignItems: "flex-start",
                padding: "0.7rem",
                borderRadius: 10,
                border: `2px solid ${on ? EXPORT_PRIMARY : "#e0e0e0"}`,
                background: on ? EXPORT_SKY : "#fff",
                cursor: member ? "pointer" : "default",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={!member}
                onChange={(e) => setForms(e.target.checked ? [...forms, pf.key] : forms.filter((f) => f !== pf.key))}
                style={{ marginTop: 3 }}
              />
              <span>
                <b>{pf.label}</b>
                <span style={{ display: "block", fontSize: "0.78rem", color: "#607d8b" }}>{pf.hint}</span>
                {pf.key !== "green" && <span style={{ display: "block", fontSize: "0.75rem", color: "#0277bd" }}>Needs UNBS certification</span>}
              </span>
            </label>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.85rem" }}>
        {ws.communities.length > 1 && (
          <div>
            <label style={label}>Exporter community *</label>
            <select style={input} value={form.communityId} onChange={set("communityId")} disabled={!member}>
              {ws.communities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
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
      </div>
      {p?.status === "approved" && (
        <div style={{ marginTop: "0.85rem" }}>
          <Notice tone="info">Changing the legal name, TIN or licence number sends your profile back for review.</Notice>
        </div>
      )}
      <button
        style={{ ...button("primary", busy || !member), marginTop: "1rem" }}
        disabled={busy || !member}
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
              productForms: forms,
            });
            setMsg({ tone: "success", text: "Company profile saved. You can update it anytime." });
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        {p ? "Save changes" : "Save profile"}
      </button>
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
        <h2 style={{ margin: 0, fontSize: "1.15rem", color: EXPORT_HEADING }}>Verification fee</h2>
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
      {!ws.profile && <Notice tone="info">Save your company profile first; then you can pay the fee here.</Notice>}
      {ws.profile && fee.renewalOpen && (
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

function DocumentsCard({ ws, userId, setMsg, member }: CardProps & { member: boolean }) {
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.15rem", color: EXPORT_HEADING }}>Document vault</h2>
      <p style={{ fontSize: "0.88rem", color: "#546e7a", marginTop: 0 }}>
        Upload each document whenever you have it; admins review them one by one as they arrive. You are warned 30 days before anything expires,
        and an expired licence hides your lots until the renewal is verified.
      </p>
      {ws.slots.map((slot) => (
        <DocumentSlot key={slot.type.key} slot={slot} userId={userId} setMsg={setMsg} canUpload={member} />
      ))}
    </div>
  );
}

function DocumentSlot({ slot, userId, setMsg, canUpload }: { slot: WS["slots"][number]; userId: Id<"users">; setMsg: (m: Msg) => void; canUpload: boolean }) {
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
    <div style={{ borderTop: "1px solid #e1f5fe", padding: "0.9rem 0" }}>
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

      {!canUpload ? null : !open ? (
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
