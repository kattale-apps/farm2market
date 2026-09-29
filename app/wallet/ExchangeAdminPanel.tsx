"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MAX_FEE_PERCENT } from "../../convex/farmcoinExchangeShared";
import { FarmCoinIcon } from "../components/icons/Brand";
import { FONT, GREEN, errorText, formatUGX, formatWhen, useSessionToken } from "./shared";

const box: React.CSSProperties = {
  padding: "1.25rem",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  marginBottom: "2rem",
  fontFamily: FONT,
};
const field: React.CSSProperties = { padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd", width: "100%", boxSizing: "border-box" };
const small: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 700, color: "#555", display: "block", marginBottom: 3 };

/**
 * Super admin / Finance admin: the FarmCoin exchange rate and fee, and the
 * queue of mobile money cash-outs to pay by hand. Shown on the Finance page.
 */
export function ExchangeAdminPanel() {
  const { token } = useSessionToken();
  const data = useQuery(api.farmcoinExchange.getExchangeAdmin, token ? { sessionToken: token } : "skip");
  if (!token || !data) return null;
  return (
    <>
      <SettingsCard token={token} data={data} />
      <CashoutQueue token={token} data={data} />
    </>
  );
}

type AdminData = NonNullable<FunctionReturnType<typeof api.farmcoinExchange.getExchangeAdmin>>;

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: "#f7f9f6", borderRadius: 10, padding: "0.6rem 0.8rem", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: "0.75rem", color: "#666" }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{value}</div>
    </div>
  );
}

function SettingsCard({ token, data }: { token: string; data: AdminData }) {
  const save = useMutation(api.farmcoinExchange.saveExchangeSettings);
  const [form, setForm] = useState(() => toForm(data.settings));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setForm(toForm(data.settings)), [data.settings]);

  const submit = async () => {
    setMessage(null);
    try {
      const saved = await save({
        sessionToken: token,
        rateUGX: Number(form.rateUGX),
        feePercent: Number(form.feePercent),
        minSellCoins: Number(form.minSellCoins),
        minBuyCoins: Number(form.minBuyCoins),
        minCashoutUGX: Number(form.minCashoutUGX),
        reason,
      });
      setReason("");
      setMessage({ ok: true, text: saved.rateUGX > 0 ? `Saved. 1 FarmCoin = ${formatUGX(saved.rateUGX)}, seller fee ${saved.feePercent}%.` : "Saved. The exchange is closed (rate 0)." });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e, "Could not save.") });
    }
  };

  const t = data.totals;
  const inputs: { key: keyof ReturnType<typeof toForm>; title: string; step: string }[] = [
    { key: "rateUGX", title: "Rate: UGX per FarmCoin (0 closes the exchange)", step: "1" },
    { key: "feePercent", title: `Platform fee %, taken from the seller (max ${MAX_FEE_PERCENT})`, step: "0.1" },
    { key: "minSellCoins", title: "Minimum FarmCoin per sale", step: "1" },
    { key: "minBuyCoins", title: "Minimum FarmCoin per purchase", step: "1" },
    { key: "minCashoutUGX", title: "Minimum cash-out (UGX)", step: "1" },
  ];

  return (
    <div style={box}>
      <h2 style={{ fontSize: "1.2rem", margin: "0 0 0.4rem", display: "flex", alignItems: "center", gap: 8 }}>
        <FarmCoinIcon size={20} /> FarmCoin exchange
      </h2>
      <p style={{ margin: "0 0 0.8rem", color: "#555", fontSize: "0.88rem" }}>
        Holders sell FarmCoin into a queue and buyers pay from their wallet at this rate. The fee comes out of what the seller receives.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
        <Stat title="Current rate" value={data.settings.rateUGX > 0 ? formatUGX(data.settings.rateUGX) : "Closed"} />
        <Stat title="FarmCoin waiting to sell" value={t.queuedCoins.toLocaleString()} />
        <Stat title="FarmCoin sold" value={t.coinsSold.toLocaleString()} />
        <Stat title="Traded value" value={formatUGX(t.grossUGX)} />
        <Stat title="Fees earned" value={formatUGX(t.feesUGX)} />
        <Stat title="Cash-outs pending" value={formatUGX(t.pendingCashoutUGX)} />
        <Stat title="Cash-outs paid" value={formatUGX(t.paidCashoutUGX)} />
      </div>
      <div style={{ display: "grid", gap: "0.6rem", maxWidth: 460 }}>
        {inputs.map((i) => (
          <label key={i.key}>
            <span style={small}>{i.title}</span>
            <input type="number" min={0} step={i.step} value={form[i.key]} onChange={(e) => setForm({ ...form, [i.key]: e.target.value })} style={field} />
          </label>
        ))}
        <label>
          <span style={small}>Reason for change</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={field} />
        </label>
        <button type="button" onClick={submit} style={{ padding: "0.7rem 1rem", background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
          Save exchange settings
        </button>
        {message && <div style={{ color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600, fontSize: "0.88rem" }}>{message.text}</div>}
      </div>
      {data.history.length > 0 && (
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>Change history</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8, fontSize: "0.82rem" }}>
            {data.history.map((h) => (
              <div key={h._id} style={{ borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                <b>{formatUGX(h.rateUGX)}</b> · fee {h.feePercent}% · min sell {h.minSellCoins} · min buy {h.minBuyCoins} · min cash-out {formatUGX(h.minCashoutUGX)}
                <div style={{ color: "#777" }}>
                  {formatWhen(h.createdAt)} by {h.changedByAlias} — {h.reason}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {data.trades.length > 0 && (
        <details style={{ marginTop: "0.6rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>Recent trades</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8, fontSize: "0.82rem" }}>
            {data.trades.map((tr) => (
              <div key={tr._id} style={{ borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                {tr.seller} → {tr.buyer}: <b>{tr.coins}</b> FarmCoin for {formatUGX(tr.grossUGX)} (fee {formatUGX(tr.feeUGX)})
                <div style={{ color: "#777" }}>{formatWhen(tr.createdAt)}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function toForm(s: AdminData["settings"]) {
  return {
    rateUGX: String(s.rateUGX),
    feePercent: String(s.feePercent),
    minSellCoins: String(s.minSellCoins),
    minBuyCoins: String(s.minBuyCoins),
    minCashoutUGX: String(s.minCashoutUGX),
  };
}

function CashoutQueue({ token, data }: { token: string; data: AdminData }) {
  const markPaid = useMutation(api.farmcoinExchange.markCashoutPaid);
  const reject = useMutation(api.farmcoinExchange.rejectCashout);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: ok });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e, "Could not update the cash-out.") });
    }
  };

  return (
    <div style={box}>
      <h2 style={{ fontSize: "1.2rem", margin: "0 0 0.4rem" }}>Mobile money cash-outs</h2>
      <p style={{ margin: "0 0 0.8rem", color: "#555", fontSize: "0.88rem" }}>
        Send the money by mobile money, then mark it paid with the transaction ID. Users are told cash-outs take up to 48 hours. Rejecting returns the money to the user&rsquo;s wallet.
      </p>
      {message && <div style={{ color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600, fontSize: "0.88rem", marginBottom: 8 }}>{message.text}</div>}
      {data.pending.length === 0 ? (
        <div style={{ color: "#777", fontSize: "0.9rem" }}>No cash-outs waiting.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.pending.map((c) => (
            <div key={c._id} style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: "1.05rem" }}>{formatUGX(c.amountUGX)}</b>
                <span style={{ color: "#777", fontSize: "0.82rem" }}>requested {formatWhen(c.requestedAt)}</span>
              </div>
              <div style={{ fontSize: "0.9rem", margin: "0.2rem 0 0.6rem" }}>
                {c.alias} · <b>{c.network === "mtn" ? "MTN MoMo" : "Airtel Money"} {c.phone}</b>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 6 }}>
                <input placeholder="Mobile money transaction ID" value={refs[c._id] ?? ""} onChange={(e) => setRefs({ ...refs, [c._id]: e.target.value })} style={field} />
                <button
                  type="button"
                  onClick={() => act(() => markPaid({ sessionToken: token, cashoutId: c._id as Id<"walletCashouts">, reference: refs[c._id] ?? "" }), `Marked ${formatUGX(c.amountUGX)} to ${c.phone} as paid.`)}
                  style={{ padding: "0 0.9rem", background: GREEN, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                >
                  Mark paid
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                <input placeholder="Reason, if you cannot pay" value={reasons[c._id] ?? ""} onChange={(e) => setReasons({ ...reasons, [c._id]: e.target.value })} style={field} />
                <button
                  type="button"
                  onClick={() => act(() => reject({ sessionToken: token, cashoutId: c._id as Id<"walletCashouts">, reason: reasons[c._id] ?? "" }), "Rejected; the money is back in the user's wallet.")}
                  style={{ padding: "0 0.9rem", background: "#fff", color: "#c62828", border: "1.5px solid #c62828", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.handled.length > 0 && (
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>Recently handled</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8, fontSize: "0.82rem" }}>
            {data.handled.map((c) => (
              <div key={c._id} style={{ borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                <b>{formatUGX(c.amountUGX)}</b> to {c.alias} ({c.phone}) —{" "}
                <span style={{ color: c.status === "paid" ? GREEN : "#c62828", fontWeight: 700 }}>{c.status === "paid" ? `paid, ID ${c.providerReference}` : `rejected: ${c.rejectReason}`}</span>
                <div style={{ color: "#777" }}>
                  {c.handledAt ? formatWhen(c.handledAt) : ""} by {c.handledBy}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
