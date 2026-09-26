"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { card, input, label, button, Notice, formatUgx, EXPORT_BROWN } from "./ui";

/**
 * Finance tab: Export Markets platform fees (super admins only).
 *
 * - Exporter verification fee: paid from the wallet when an exporter submits,
 *   renewed yearly, optionally credited against their first success fees.
 * - Success fee: paid by the exporter once contract terms are agreed; names
 *   are revealed only after it is paid. Percent of the USD contract value or
 *   a fixed USD amount per bag, converted to UGX on the day it is charged.
 * - Buyer fee and sample handling fee: optional, 0 turns them off.
 */
export function ExportFeesPanel({ adminId }: { adminId: Id<"users"> }) {
  const settings = useQuery(api.exportMarkets.getExportFeeSettings, {});
  const ledger = useQuery(api.exportMarkets.getExportFeeLedger, { adminId });
  const update = useMutation(api.exportMarkets.updateExportFeeSettings);
  const [form, setForm] = useState<Record<string, string | boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        exporterVerificationFeeUgx: String(settings.exporterVerificationFeeUgx),
        verificationFeeValidityDays: String(settings.verificationFeeValidityDays),
        creditVerificationFeeAgainstSuccessFee: settings.creditVerificationFeeAgainstSuccessFee,
        successFeeMode: settings.successFeeMode,
        successFeePercent: String(settings.successFeePercent),
        successFeePerBagUsd: String(settings.successFeePerBagUsd),
        buyerFeePercent: String(settings.buyerFeePercent),
        sampleHandlingFeeUgx: String(settings.sampleHandlingFeeUgx),
      });
    }
  }, [settings, form]);

  if (!settings || !form) return <div style={card}>Loading export fees...</div>;

  const num = (k: string, text: string, hint?: string) => (
    <div>
      <label style={label}>{text}</label>
      <input style={input} type="number" min={0} step="any" value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      {hint && <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.2rem" }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ ...card, padding: "1.5rem", marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.3rem", margin: "0 0 0.25rem", color: EXPORT_BROWN }}>☕ Export Markets fees</h2>
      <p style={{ fontSize: "0.85rem", color: "#555", marginTop: 0 }}>
        Exporters pay the success fee once contract terms are agreed, and buyer and exporter names are revealed only after
        the platform fees are paid. Fees are collected in UGX through the wallet. Set any fee to 0 to switch it off.
        {settings.isDefault && " These are defaults and have not been saved yet."}
      </p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
        {num("exporterVerificationFeeUgx", "Exporter verification fee (UGX)", "Paid when an exporter submits for review. 0 = no fee.")}
        {num("verificationFeeValidityDays", "Verification valid for (days)", "Renewal is due after this many days.")}
        <div>
          <label style={label}>Success fee type</label>
          <select style={input} value={String(form.successFeeMode)} onChange={(e) => setForm({ ...form, successFeeMode: e.target.value })}>
            <option value="percent">Percent of contract value</option>
            <option value="per_bag">Fixed USD per bag</option>
          </select>
        </div>
        {form.successFeeMode === "percent"
          ? num("successFeePercent", "Success fee (% of USD contract value)", "Charged to the exporter. Coffee brokers commonly charge around 1%.")
          : num("successFeePerBagUsd", "Success fee (USD per bag)", "Charged to the exporter per 60 kg bag.")}
        {num("buyerFeePercent", "Buyer fee (% of contract value)", "Optional. 0 = no buyer fee.")}
        {num("sampleHandlingFeeUgx", "Sample handling fee (UGX)", "Optional. Covers the platform sample desk and courier.")}
      </div>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.8rem 0", fontSize: "0.88rem" }}>
        <input
          type="checkbox"
          checked={form.creditVerificationFeeAgainstSuccessFee === true}
          onChange={(e) => setForm({ ...form, creditVerificationFeeAgainstSuccessFee: e.target.checked })}
        />
        Credit the verification fee against the exporter&apos;s first success fees
      </label>
      <button
        style={button("primary", busy)}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await update({
              adminId,
              exporterVerificationFeeUgx: Number(form.exporterVerificationFeeUgx),
              verificationFeeValidityDays: Number(form.verificationFeeValidityDays),
              creditVerificationFeeAgainstSuccessFee: form.creditVerificationFeeAgainstSuccessFee === true,
              successFeeMode: form.successFeeMode === "per_bag" ? "per_bag" : "percent",
              successFeePercent: Number(form.successFeePercent),
              successFeePerBagUsd: Number(form.successFeePerBagUsd),
              buyerFeePercent: Number(form.buyerFeePercent),
              sampleHandlingFeeUgx: Number(form.sampleHandlingFeeUgx),
            });
            setMsg({ tone: "success", text: "Export fees saved." });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            setMsg({ tone: "error", text: m.match(/Uncaught Error: (.*?)(\n|$| at )/)?.[1] ?? m });
          } finally {
            setBusy(false);
          }
        }}
      >
        Save export fees
      </button>

      <h3 style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.5rem" }}>Export fees collected</h3>
      {ledger === undefined ? (
        "Loading..."
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {(["verification", "success", "buyer", "sample"] as const).map((k) => (
              <div key={k} style={{ background: "#efebe9", borderRadius: 8, padding: "0.6rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#5d4037", fontWeight: 700, textTransform: "capitalize" }}>{k} fees</div>
                <div style={{ fontWeight: 800 }}>{formatUgx(ledger.totals[k])}</div>
              </div>
            ))}
          </div>
          {ledger.capped && <div style={{ fontSize: "0.75rem", color: "#666" }}>Totals cover the latest 500 charges.</div>}
          {ledger.recent.length === 0 ? (
            <p style={{ fontSize: "0.88rem" }}>No export fees collected yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                    <th style={{ padding: "0.4rem" }}>When</th>
                    <th style={{ padding: "0.4rem" }}>Who</th>
                    <th style={{ padding: "0.4rem" }}>Fee</th>
                    <th style={{ padding: "0.4rem" }}>Amount</th>
                    <th style={{ padding: "0.4rem" }}>UTID</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.recent.map((c) => (
                    <tr key={c._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatUgandaDateTime(c.chargedAt)}</td>
                      <td style={{ padding: "0.4rem" }}>{c.alias}</td>
                      <td style={{ padding: "0.4rem", textTransform: "capitalize" }}>{c.kind}</td>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatUgx(c.amountUgx)}</td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{c.utid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
