"use client";

/**
 * Export Markets admin panels, shared by the admin Export Markets page and
 * the Export Markets tab of an exporter community's dashboard (where they
 * are filtered to that one community).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { PRODUCT_FORMS, expiryState } from "../../../convex/exportMarketsShared";
import { card, input, label, button, StatusPill, Notice, errorText } from "./ui";
import { AdminDealsPanel, AdminTracePanel } from "./AdminExportPanels";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type P = { adminId: Id<"users">; today: string; setMsg: (m: Msg) => void; communityId?: Id<"communities"> };

export function Applications({ adminId, today, setMsg, communityId }: P) {
  const [status, setStatus] = useState<"submitted" | "approved" | "rejected" | "suspended" | "draft">("submitted");
  const rows = useQuery(api.exportMarkets.listExporterProfilesForReview, { adminId, status, today, communityId });
  const review = useMutation(api.exportMarkets.reviewExporterProfile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (profileId: Id<"exporterProfiles">, decision: "approve" | "reject" | "suspend" | "reinstate") => {
    setBusy(profileId);
    try {
      await review({ adminId, profileId, decision, notes: notes[profileId] || undefined });
      setMsg({ tone: "success", text: `Exporter ${decision === "approve" ? "approved" : decision === "reinstate" ? "reinstated" : decision === "reject" ? "sent back" : "suspended"}.` });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <select style={{ ...input, maxWidth: 260, marginBottom: "0.75rem" }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
        <option value="submitted">Submitted (to review)</option>
        <option value="approved">Approved</option>
        <option value="rejected">Sent back</option>
        <option value="suspended">Suspended</option>
        <option value="draft">Drafts</option>
      </select>
      {rows === undefined ? (
        <div style={card}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={card}>Nothing here.</div>
      ) : (
        rows.map((r) => (
          <div key={r.profile._id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{r.profile.legalName}</div>
                <div style={{ fontSize: "0.82rem", color: "#555" }}>
                  Alias {r.alias} · {r.communityName} · TIN {r.profile.tin}
                  {r.profile.exporterLicenceNumber ? ` · Licence ${r.profile.exporterLicenceNumber}` : ""}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#555" }}>
                  {r.profile.contactPerson} · {r.profile.contactPhone} · {r.profile.physicalAddress}
                </div>
              </div>
              <StatusPill state={r.profile.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.3rem", margin: "0.6rem 0", fontSize: "0.82rem" }}>
              <div>Trader verified: <b>{r.checks.verifiedTrader ? "Yes" : "No"}</b></div>
              <div>Verification fee: <StatusPill state={r.fee.state} /></div>
              {r.documents.map((d) => (
                <div key={d.label}>
                  {d.label}
                  {d.required ? " *" : ""}: <StatusPill state={d.state} />
                </div>
              ))}
            </div>
            {r.profile.reviewNotes && <div style={{ fontSize: "0.82rem", color: "#555" }}>Last note: {r.profile.reviewNotes}</div>}
            <input
              style={{ ...input, margin: "0.5rem 0" }}
              placeholder="Note to the trader (required to send back or suspend)"
              value={notes[r.profile._id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.profile._id]: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(r.profile.status === "submitted" || r.profile.status === "rejected") && (
                <>
                  <button style={button("primary", busy === r.profile._id)} disabled={busy === r.profile._id} onClick={() => act(r.profile._id, "approve")}>
                    Approve exporter
                  </button>
                  {r.profile.status === "submitted" && (
                    <button style={button("danger", busy === r.profile._id)} disabled={busy === r.profile._id} onClick={() => act(r.profile._id, "reject")}>
                      Send back
                    </button>
                  )}
                </>
              )}
              {r.profile.status === "approved" && (
                <button style={button("danger", busy === r.profile._id)} disabled={busy === r.profile._id} onClick={() => act(r.profile._id, "suspend")}>
                  Suspend
                </button>
              )}
              {r.profile.status === "suspended" && (
                <button style={button("primary", busy === r.profile._id)} disabled={busy === r.profile._id} onClick={() => act(r.profile._id, "reinstate")}>
                  Reinstate
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function Documents({ adminId, today, setMsg, communityId }: P) {
  const docs = useQuery(api.exportMarkets.listDocumentsForReview, { adminId, communityId });
  const review = useMutation(api.exportMarkets.reviewExportDocument);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (documentId: Id<"exportDocuments">, decision: "verify" | "reject") => {
    setBusy(documentId);
    try {
      await review({ adminId, documentId, decision, notes: notes[documentId] || undefined });
      setMsg({ tone: "success", text: decision === "verify" ? "Document verified." : "Document rejected." });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  if (docs === undefined) return <div style={card}>Loading...</div>;
  if (docs.length === 0) return <div style={card}>No documents waiting for review.</div>;
  return (
    <div>
      {docs.map((d) => {
        const exp = expiryState(d.expiryDate, today);
        return (
          <div key={d._id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{d.documentTypeLabel}</div>
                <div style={{ fontSize: "0.82rem", color: "#555" }}>
                  {d.ownerKind === "exporter" ? "Exporter" : "Buyer"} {d.ownerLegalName ?? ""} (alias {d.ownerAlias}) · uploaded{" "}
                  {formatUgandaDateTime(d.uploadedAt)}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#555" }}>
                  {d.documentNumber ? `No. ${d.documentNumber} · ` : ""}
                  {d.issueDate ? `Issued ${d.issueDate} · ` : ""}
                  {d.expiryDate ? `Expires ${d.expiryDate}` : "No expiry"}
                  {exp === "expired" && <b style={{ color: "#c62828" }}> · already expired</b>}
                  {exp === "expiring" && <b style={{ color: "#ef6c00" }}> · expires within 30 days</b>}
                </div>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ ...button("secondary"), textDecoration: "none", alignSelf: "flex-start" }}>
                  Open {d.fileName.length > 24 ? "file" : d.fileName}
                </a>
              )}
            </div>
            <input
              style={{ ...input, margin: "0.5rem 0" }}
              placeholder="Reason (required to reject)"
              value={notes[d._id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [d._id]: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={button("primary", busy === d._id)} disabled={busy === d._id} onClick={() => act(d._id, "verify")}>
                Verify
              </button>
              <button style={button("danger", busy === d._id)} disabled={busy === d._id} onClick={() => act(d._id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Members({ adminId, today, communities, setMsg }: P & { communities: { _id: Id<"communities">; name: string }[] }) {
  const [communityId, setCommunityId] = useState<Id<"communities"> | "">(communities[0]?._id ?? "");
  const [search, setSearch] = useState("");
  const members = useQuery(api.exportMarkets.listExportCommunityMembers, communityId ? { adminId, communityId, today } : "skip");
  const candidates = useQuery(
    api.exportMarkets.listVerifiedTradersToAdd,
    communityId ? { adminId, communityId, search: search || undefined } : "skip"
  );
  const add = useMutation(api.exportMarkets.addTraderToExportCommunity);
  const remove = useMutation(api.exportMarkets.removeTraderFromExportCommunity);
  const [busy, setBusy] = useState<string | null>(null);

  if (communities.length === 0) return <div style={card}>No exporter community yet.</div>;

  return (
    <div>
      <select style={{ ...input, maxWidth: 360, marginBottom: "0.75rem" }} value={communityId} onChange={(e) => setCommunityId(e.target.value as Id<"communities">)}>
        {communities.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Traders in this exporter community</h2>
        {members === undefined ? (
          "Loading..."
        ) : members.length === 0 ? (
          <p style={{ fontSize: "0.88rem" }}>No traders yet. Add verified traders below.</p>
        ) : (
          members.map((m) => (
            <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", borderTop: "1px solid #eee", padding: "0.5rem 0", flexWrap: "wrap" }}>
              <div style={{ fontSize: "0.88rem" }}>
                <b>{m.legalName ?? m.alias}</b> {m.legalName ? `(alias ${m.alias})` : ""}
                <div style={{ fontSize: "0.78rem", color: "#666" }}>
                  {m.isActiveExporter ? "Live exporter" : m.profileStatus ? `Profile: ${m.profileStatus}` : "No exporter profile yet"} · fee {m.feeState}
                </div>
              </div>
              <button
                style={{ ...button("danger", busy === m.userId), fontSize: "0.78rem" }}
                disabled={busy === m.userId}
                onClick={async () => {
                  const reason = window.prompt("Reason for removing this trader from the exporter community?");
                  if (!reason || !communityId) return;
                  setBusy(m.userId);
                  try {
                    await remove({ adminId, communityId, traderId: m.userId, reason });
                    setMsg({ tone: "success", text: "Trader removed." });
                  } catch (e) {
                    setMsg({ tone: "error", text: errorText(e) });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Add a verified trader</h2>
        <p style={{ fontSize: "0.82rem", color: "#555", marginTop: 0 }}>
          Only traders a super admin has verified are listed. Exporter communities are invite-only, so traders cannot join
          on their own.
        </p>
        <input style={{ ...input, marginBottom: "0.5rem" }} placeholder="Search alias, business name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        {candidates === undefined ? (
          "Loading..."
        ) : candidates.length === 0 ? (
          <p style={{ fontSize: "0.88rem" }}>No matching verified traders.</p>
        ) : (
          candidates.map((c) => (
            <div key={c.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", borderTop: "1px solid #eee", padding: "0.5rem 0", flexWrap: "wrap" }}>
              <div style={{ fontSize: "0.88rem" }}>
                <b>{c.businessName ?? c.alias}</b> (alias {c.alias})
                <div style={{ fontSize: "0.78rem", color: "#666" }}>{[c.phoneNumber, c.email].filter(Boolean).join(" · ")}</div>
              </div>
              <button
                style={{ ...button("primary", busy === c.userId), fontSize: "0.78rem" }}
                disabled={busy === c.userId}
                onClick={async () => {
                  if (!communityId) return;
                  setBusy(c.userId);
                  try {
                    await add({ adminId, communityId, traderId: c.userId });
                    setMsg({ tone: "success", text: `${c.businessName ?? c.alias} added. They can now set up their exporter profile.` });
                  } catch (e) {
                    setMsg({ tone: "error", text: errorText(e) });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Add
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function DocumentTypes({ adminId, setMsg }: { adminId: Id<"users">; setMsg: (m: Msg) => void }) {
  const [appliesTo, setAppliesTo] = useState<"exporter" | "buyer">("exporter");
  const data = useQuery(api.exportMarkets.listDocumentTypes, { appliesTo });
  const save = useMutation(api.exportMarkets.saveDocumentType);
  const [draft, setDraft] = useState({ label: "", description: "", required: false, hasExpiry: false });
  const [busy, setBusy] = useState(false);

  const saveRow = async (row: { key?: string; label: string; description?: string; required: boolean; hasExpiry: boolean; isActive: boolean; productForms?: string[] }) => {
    setBusy(true);
    try {
      await save({ adminId, appliesTo, ...row, description: row.description || undefined });
      setMsg({ tone: "success", text: "Document type saved." });
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <select style={{ ...input, maxWidth: 260, marginBottom: "0.75rem" }} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as "exporter" | "buyer")}>
        <option value="exporter">Exporter documents</option>
        <option value="buyer">Buyer KYC documents</option>
      </select>
      <div style={card}>
        {data && !data.customised && (
          <Notice tone="info">These are the built-in defaults. Your first change saves them as an editable list.</Notice>
        )}
        {data === undefined
          ? "Loading..."
          : data.types.map((t) => (
              <div key={t.key} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", opacity: t.isActive ? 1 : 0.55 }}>
                <div style={{ fontSize: "0.88rem", flex: 1, minWidth: 200 }}>
                  <b>{t.label}</b>
                  {t.description && <div style={{ fontSize: "0.78rem", color: "#666" }}>{t.description}</div>}
                  {appliesTo === "exporter" && (
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.75rem", marginTop: "0.25rem", color: "#546e7a" }}>
                      <span>Needed for:</span>
                      {PRODUCT_FORMS.map((pf) => {
                        const forms = t.productForms ?? [];
                        const on = forms.length === 0 || forms.includes(pf.key);
                        return (
                          <label key={pf.key} style={{ display: "inline-flex", gap: "0.25rem", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={busy}
                              onChange={(e) => {
                                const current = forms.length === 0 ? PRODUCT_FORMS.map((x) => x.key as string) : forms;
                                const next = e.target.checked ? [...current, pf.key] : current.filter((f) => f !== pf.key);
                                if (next.length === 0) return setMsg({ tone: "error", text: "A document must apply to at least one product" });
                                saveRow({
                                  key: t.key,
                                  label: t.label,
                                  description: t.description,
                                  required: t.required,
                                  hasExpiry: t.hasExpiry,
                                  isActive: t.isActive,
                                  // All forms ticked means everyone: store as empty.
                                  productForms: next.length === PRODUCT_FORMS.length ? [] : next,
                                });
                              }}
                            />
                            {pf.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", fontSize: "0.8rem", flexWrap: "wrap" }}>
                  {(["required", "hasExpiry", "isActive"] as const).map((k) => (
                    <label key={k} style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={t[k]}
                        disabled={busy}
                        onChange={(e) =>
                          saveRow({
                            key: t.key,
                            label: t.label,
                            description: t.description,
                            required: t.required,
                            hasExpiry: t.hasExpiry,
                            isActive: t.isActive,
                            productForms: t.productForms ?? [],
                            [k]: e.target.checked,
                          })
                        }
                      />
                      {k === "required" ? "Required" : k === "hasExpiry" ? "Has expiry" : "Active"}
                    </label>
                  ))}
                </div>
              </div>
            ))}
      </div>
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Add a document type</h2>
        <label style={label}>Label *</label>
        <input style={{ ...input, marginBottom: "0.5rem" }} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <label style={label}>Description</label>
        <input style={{ ...input, marginBottom: "0.5rem" }} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", marginBottom: "0.6rem" }}>
          <label><input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} /> Required</label>
          <label><input type="checkbox" checked={draft.hasExpiry} onChange={(e) => setDraft({ ...draft, hasExpiry: e.target.checked })} /> Has expiry</label>
        </div>
        <button
          style={button("primary", busy || !draft.label.trim())}
          disabled={busy || !draft.label.trim()}
          onClick={async () => {
            if (await saveRow({ ...draft, isActive: true })) setDraft({ label: "", description: "", required: false, hasExpiry: false });
          }}
        >
          Add document type
        </button>
      </div>
    </div>
  );
}

/**
 * The Export Markets tab inside an exporter community's dashboard: the same
 * admin work as the Export Markets admin page, limited to this community.
 */

export function CommunityExportMarketsPanel({
  adminId,
  communityId,
  communityName,
  today,
}: {
  adminId: Id<"users">;
  communityId: Id<"communities">;
  communityName: string;
  today: string;
}) {
  const [tab, setTab] = useState<"exporters" | "applications" | "documents" | "deals" | "trace">("exporters");
  const [msg, setMsg] = useState<Msg>(null);
  const tabs: [typeof tab, string][] = [
    ["exporters", "Exporters"],
    ["applications", "Applications"],
    ["documents", "Documents"],
    ["deals", "Deals, KYC & samples"],
    ["trace", "Trace evidence"],
  ];
  return (
    <div style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <img src="/icons/cargo-ship.svg" alt="" width={36} height={36} />
        <div>
          <div style={{ fontWeight: 800, color: "#01579b", fontSize: "1.1rem" }}>Export Markets</div>
          <div style={{ fontSize: "0.82rem", color: "#607d8b" }}>Exporters, documents, trace evidence and deals for {communityName}.</div>
        </div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {tabs.map(([key, text]) => (
          <button key={key} onClick={() => setTab(key)} style={button(tab === key ? "primary" : "secondary")}>
            {text}
          </button>
        ))}
      </div>
      {tab === "exporters" && <Members adminId={adminId} today={today} communities={[{ _id: communityId, name: communityName }]} setMsg={setMsg} />}
      {tab === "applications" && <Applications adminId={adminId} today={today} setMsg={setMsg} communityId={communityId} />}
      {tab === "documents" && <Documents adminId={adminId} today={today} setMsg={setMsg} communityId={communityId} />}
      {tab === "deals" && <AdminDealsPanel adminId={adminId} setMsg={setMsg} communityId={communityId} />}
      {tab === "trace" && <AdminTracePanel adminId={adminId} setMsg={setMsg} communityId={communityId} />}
    </div>
  );
}
