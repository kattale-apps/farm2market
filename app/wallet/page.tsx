"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { guessNetwork, priceFill, type FarmcoinAccount, type MobileNetwork } from "../../convex/farmcoinExchangeShared";
import { normalizeUgandaPhone } from "../../convex/marketspaceShared";
import { FarmCoinIcon } from "../components/icons/Brand";
import { DARK_GREEN, FONT, GREEN, button, card, errorText, formatUGX, formatWhen, input, label, useSessionToken } from "./shared";

type Tab = "sell" | "buy" | "topup" | "cashout";

const TABS: { key: Tab; title: string }[] = [
  { key: "sell", title: "Sell FarmCoin" },
  { key: "buy", title: "Buy FarmCoin" },
  { key: "topup", title: "Top up" },
  { key: "cashout", title: "Cash out" },
];

/**
 * Every non-admin user's wallet: UGX they can cash out, their FarmCoin, and
 * the FarmCoin exchange (sell into the queue, buy from it). See
 * convex/farmcoinExchange.ts.
 */
export default function WalletPage() {
  const { status, token } = useSessionToken();
  const wallet = useQuery(api.farmcoinExchange.getMyWallet, token ? { sessionToken: token } : "skip");
  const [tab, setTab] = useState<Tab>("sell");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Back from Pesapal after a top-up.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paymentStatus");
    if (!paid) return;
    setTab("topup");
    setNotice(
      paid.includes("complet")
        ? { ok: true, text: "Top-up received. It is now in your wallet." }
        : { ok: false, text: `Top-up status: ${paid}. If money left your phone, it will show here once Pesapal confirms it.` }
    );
    window.history.replaceState(null, "", "/wallet");
  }, []);

  if (status === "guest") {
    return (
      <Shell>
        <div style={card}>
          <p style={{ margin: 0 }}>
            Please <Link href="/login">log in</Link> to see your wallet.
          </p>
        </div>
      </Shell>
    );
  }
  if (status === "loading" || wallet === undefined) {
    return (
      <Shell>
        <div style={{ ...card, color: "#777" }}>Loading your wallet…</div>
      </Shell>
    );
  }
  if (wallet.status === "signed_out") {
    return (
      <Shell>
        <div style={card}>
          Your session has ended. Please <Link href="/login">log in again</Link>.
        </div>
      </Shell>
    );
  }
  if (wallet.status === "admin") {
    return (
      <Shell>
        <div style={card}>
          Admin accounts do not have a wallet.
          {wallet.canManage && (
            <>
              {" "}
              Manage the exchange and cash-outs on the <Link href="/admin/finance">Finance page</Link>.
            </>
          )}
        </div>
      </Shell>
    );
  }

  const open = wallet.settings.rateUGX > 0;

  return (
    <Shell>
      <section style={{ ...card, background: `linear-gradient(135deg, ${GREEN}, ${DARK_GREEN})`, color: "#fff" }}>
        <div style={{ fontSize: "0.8rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Real money · can be cashed out</div>
        <div style={{ fontSize: "2rem", fontWeight: 800, margin: "0.2rem 0 0.6rem" }}>{formatUGX(wallet.wallet.availableUGX)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "0.7rem" }}>
          <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "0.45rem 0.6rem" }}>
            <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>Sentify cash (FarmCoin sold)</div>
            <div style={{ fontWeight: 800 }}>{formatUGX(wallet.wallet.sentifyUGX)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "0.45rem 0.6rem" }}>
            <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>Other real money</div>
            <div style={{ fontWeight: 800 }}>{formatUGX(wallet.wallet.otherRealUGX)}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {wallet.balances.map((b) => (
            <span key={b.account} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.16)", borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.85rem", fontWeight: 700 }}>
              <FarmCoinIcon size={16} /> {b.balance.toLocaleString()} <span style={{ fontWeight: 500, opacity: 0.9 }}>{b.label}</span>
            </span>
          ))}
        </div>
        {wallet.demoWallet && (
          <div style={{ marginTop: "0.8rem", padding: "0.55rem 0.7rem", borderRadius: 10, background: "rgba(0,0,0,0.18)", fontSize: "0.82rem", lineHeight: 1.4 }}>
            <b>Demo money: {formatUGX(wallet.wallet.demoUGX)}</b>
            <br />
            Practice money for trading. It is used first when you buy produce, and it can never be cashed out or used to buy FarmCoin.
          </div>
        )}
      </section>

      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <FarmCoinIcon size={20} />
          {open ? (
            <span>
              1 FarmCoin = {formatUGX(wallet.settings.rateUGX)}
              {wallet.settings.feePercent > 0 && <span style={{ color: "#666", fontWeight: 500 }}> · seller fee {wallet.settings.feePercent}%</span>}
            </span>
          ) : (
            <span style={{ color: "#8d6e00" }}>The FarmCoin exchange is closed until Finance sets a rate.</span>
          )}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#666", marginTop: 4 }}>{wallet.queuedCoins.toLocaleString()} FarmCoin waiting to be sold</div>
      </section>

      {notice && (
        <div role="status" style={{ ...card, background: notice.ok ? "#e8f5e9" : "#fff3e0", color: notice.ok ? DARK_GREEN : "#8d4b00", fontWeight: 600, fontSize: "0.9rem" }}>
          {notice.text}
        </div>
      )}

      <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: "0.8rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setNotice(null);
            }}
            style={{
              minHeight: 44,
              borderRadius: 10,
              border: `1.5px solid ${tab === t.key ? GREEN : "#d6d6d6"}`,
              background: tab === t.key ? "#e8f5e9" : "#fff",
              color: tab === t.key ? DARK_GREEN : "#444",
              fontWeight: 800,
              fontSize: "0.78rem",
              fontFamily: FONT,
              cursor: "pointer",
              padding: "0.3rem",
            }}
          >
            {t.title}
          </button>
        ))}
      </div>

      <section style={card}>
        {tab === "sell" && <SellForm token={token!} wallet={wallet} onDone={setNotice} />}
        {tab === "buy" && <BuyForm token={token!} wallet={wallet} onDone={setNotice} />}
        {tab === "topup" && <TopUpForm token={token!} onDone={setNotice} />}
        {tab === "cashout" && <CashoutForm token={token!} wallet={wallet} onDone={setNotice} />}
      </section>

      <Offers token={token!} offers={wallet.offers} onDone={setNotice} />
      <Cashouts cashouts={wallet.cashouts} />
      <Activity activity={wallet.activity} />
    </Shell>
  );
}

type WalletData = Extract<FunctionReturnType<typeof api.farmcoinExchange.getMyWallet>, { status: "ok" }>;
type Done = (n: { ok: boolean; text: string }) => void;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f3", fontFamily: FONT, padding: "1rem 1rem 3rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.4rem", margin: "0.2rem 0 0.9rem", color: DARK_GREEN }}>💰 My Wallet</h1>
        {children}
      </div>
    </main>
  );
}

function Row({ left, right, strong }: { left: string; right: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? "1rem" : "0.88rem", fontWeight: strong ? 800 : 500, padding: "0.2rem 0" }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function wholeNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isInteger(n) && n > 0 ? n : null;
}

function SellForm({ token, wallet, onDone }: { token: string; wallet: WalletData; onDone: Done }) {
  const sell = useMutation(api.farmcoinExchange.sellFarmcoin);
  const sellable = wallet.balances.filter((b) => b.balance > 0);
  const [account, setAccount] = useState<FarmcoinAccount | "">(sellable[0]?.account ?? "");
  const [coinsRaw, setCoinsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const { rateUGX, feePercent, minSellCoins } = wallet.settings;
  const coins = wholeNumber(coinsRaw);
  const chosen = sellable.find((b) => b.account === account);
  const price = coins ? priceFill(coins, rateUGX, feePercent) : null;
  const tooMany = !!coins && !!chosen && coins > chosen.balance;
  const tooFew = !!coins && coins < minSellCoins;
  const disabled = busy || rateUGX <= 0 || !coins || !chosen || tooMany || tooFew;

  if (sellable.length === 0) {
    return <p style={{ margin: 0, color: "#555" }}>You have no FarmCoin to sell yet.</p>;
  }

  const submit = async () => {
    if (disabled || !chosen || !coins) return;
    setBusy(true);
    try {
      await sell({ sessionToken: token, account: chosen.account, coins, expectedRateUGX: rateUGX });
      onDone({ ok: true, text: `${coins} FarmCoin is now for sale. You'll be notified and paid into your wallet when it sells.` });
      setCoinsRaw("");
    } catch (e) {
      onDone({ ok: false, text: errorText(e, "Could not put your FarmCoin up for sale.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      {sellable.length > 1 && (
        <div>
          <label style={label} htmlFor="sell-account">Sell from</label>
          <select id="sell-account" value={account} onChange={(e) => setAccount(e.target.value as FarmcoinAccount)} style={input}>
            {sellable.map((b) => (
              <option key={b.account} value={b.account}>
                {b.label} ({b.balance.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label style={label} htmlFor="sell-coins">
          How many FarmCoin? {chosen && <span style={{ fontWeight: 500, color: "#777" }}>You have {chosen.balance.toLocaleString()}</span>}
        </label>
        <input id="sell-coins" type="number" inputMode="numeric" min={minSellCoins} step={1} value={coinsRaw} onChange={(e) => setCoinsRaw(e.target.value)} placeholder={`At least ${minSellCoins}`} style={input} />
        {tooMany && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>That is more than you have.</div>}
        {tooFew && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>The minimum is {minSellCoins} FarmCoin.</div>}
      </div>
      {price && rateUGX > 0 && (
        <div style={{ background: "#f7f9f6", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
          <Row left={`${coins} × ${formatUGX(rateUGX)}`} right={formatUGX(price.grossUGX)} />
          {feePercent > 0 && <Row left={`Platform fee (${feePercent}%)`} right={`− ${formatUGX(price.feeUGX)}`} />}
          <Row left="You receive" right={formatUGX(price.netUGX)} strong />
        </div>
      )}
      <div style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.4 }}>
        Your coins leave your balance now and join the sale queue; the oldest offers sell first. You are paid at the rate on the day they sell. You can take back unsold coins at any time.
      </div>
      <button type="button" onClick={submit} disabled={disabled} style={button(GREEN, disabled)}>
        {busy ? "Putting up for sale…" : "Sell FarmCoin"}
      </button>
    </div>
  );
}

function BuyForm({ token, wallet, onDone }: { token: string; wallet: WalletData; onDone: Done }) {
  const buy = useMutation(api.farmcoinExchange.buyFarmcoin);
  const [coinsRaw, setCoinsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const { rateUGX, minBuyCoins } = wallet.settings;
  const coins = wholeNumber(coinsRaw);
  const cost = coins ? coins * rateUGX : 0;
  const tooFew = !!coins && coins < minBuyCoins;
  const cannotAfford = !!coins && cost > wallet.wallet.availableUGX;
  const disabled = busy || rateUGX <= 0 || !coins || tooFew || cannotAfford || wallet.queuedCoins === 0;

  const submit = async () => {
    if (disabled || !coins) return;
    setBusy(true);
    try {
      const r = await buy({ sessionToken: token, coins, expectedRateUGX: rateUGX });
      onDone({
        ok: true,
        text:
          r.coinsBought < r.coinsRequested
            ? `Only ${r.coinsBought} FarmCoin was for sale. You bought all of it for ${formatUGX(r.totalUGX)}.`
            : `You bought ${r.coinsBought} FarmCoin for ${formatUGX(r.totalUGX)}.`,
      });
      setCoinsRaw("");
    } catch (e) {
      onDone({ ok: false, text: errorText(e, "Could not buy FarmCoin.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div>
        <label style={label} htmlFor="buy-coins">
          How many FarmCoin? <span style={{ fontWeight: 500, color: "#777" }}>{wallet.queuedCoins.toLocaleString()} for sale</span>
        </label>
        <input id="buy-coins" type="number" inputMode="numeric" min={minBuyCoins} step={1} value={coinsRaw} onChange={(e) => setCoinsRaw(e.target.value)} placeholder={`At least ${minBuyCoins}`} style={input} />
        {tooFew && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>The minimum is {minBuyCoins} FarmCoin.</div>}
      </div>
      {coins && rateUGX > 0 && (
        <div style={{ background: "#f7f9f6", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
          <Row left={`${coins} × ${formatUGX(rateUGX)}`} right={formatUGX(cost)} strong />
          <Row left="Real money in your wallet" right={formatUGX(wallet.wallet.availableUGX)} />
        </div>
      )}
      {cannotAfford && (
        <div style={{ color: "#c62828", fontSize: "0.85rem" }}>
          Your wallet does not have enough. Use <b>Top up</b> to add money by mobile money.
        </div>
      )}
      <div style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.4 }}>
        Paid from the real money in your wallet. If fewer coins are for sale than you ask for, you get what is there and pay only for that. Use FarmCoin for things like keeping a MarketSpace ad up.
      </div>
      <button type="button" onClick={submit} disabled={disabled} style={button(GREEN, disabled)}>
        {busy ? "Buying…" : "Buy FarmCoin"}
      </button>
    </div>
  );
}

function TopUpForm({ token, onDone }: { token: string; onDone: Done }) {
  const topUp = useAction(api.pesapal.initiateWalletTopUp);
  const [amountRaw, setAmountRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = wholeNumber(amountRaw);

  const submit = async () => {
    if (!amount || busy) return;
    setBusy(true);
    try {
      const origin = window.location.origin;
      const r = await topUp({
        sessionToken: token,
        amount,
        callbackUrl: `${origin}/payment/callback?returnTo=${encodeURIComponent("/wallet")}`,
        cancelUrl: `${origin}/wallet`,
      });
      window.location.href = r.redirectUrl;
    } catch (e) {
      onDone({ ok: false, text: errorText(e, "Could not start the top-up.") });
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div>
        <label style={label} htmlFor="topup-amount">Amount (UGX)</label>
        <input id="topup-amount" type="number" inputMode="numeric" min={1} step={1} value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="e.g. 10000" style={input} />
      </div>
      <div style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.4 }}>You pay with mobile money through Pesapal. The money shows in your wallet once Pesapal confirms it.</div>
      <button type="button" onClick={submit} disabled={!amount || busy} style={button(GREEN, !amount || busy)}>
        {busy ? "Opening Pesapal…" : "Top up with mobile money"}
      </button>
    </div>
  );
}

function CashoutForm({ token, wallet, onDone }: { token: string; wallet: WalletData; onDone: Done }) {
  const request = useMutation(api.farmcoinExchange.requestCashout);
  const [amountRaw, setAmountRaw] = useState("");
  const [phone, setPhone] = useState(wallet.phoneNumber ?? "");
  const [network, setNetwork] = useState<MobileNetwork | "">(() => (wallet.phoneNumber ? guessNetwork(normalizeUgandaPhone(wallet.phoneNumber) ?? "") ?? "" : ""));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { minCashoutUGX } = wallet.settings;
  const amount = wholeNumber(amountRaw);
  const normalized = useMemo(() => normalizeUgandaPhone(phone), [phone]);
  const phoneOk = !!normalized && normalized.startsWith("+2567");
  const tooMuch = !!amount && amount > wallet.wallet.availableUGX;
  const tooLittle = !!amount && amount < minCashoutUGX;
  const disabled = busy || !amount || tooMuch || tooLittle || !phoneOk || !network || password.trim() === "";

  const onPhone = (value: string) => {
    setPhone(value);
    const guess = guessNetwork(normalizeUgandaPhone(value) ?? "");
    if (guess) setNetwork(guess);
  };

  const submit = async () => {
    if (disabled || !amount || !network) return;
    setBusy(true);
    try {
      await request({ sessionToken: token, amountUGX: amount, phone, network, password });
      onDone({ ok: true, text: `Cash-out of ${formatUGX(amount)} requested. ${wallet.cashoutNotice}` });
      setAmountRaw("");
      setPassword("");
    } catch (e) {
      onDone({ ok: false, text: errorText(e, "Could not request the cash-out.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div style={{ background: "#fff8e1", borderRadius: 10, padding: "0.6rem 0.8rem", fontSize: "0.85rem", fontWeight: 700, color: "#7a5b00" }}>
        ⏱ {wallet.cashoutNotice}
      </div>
      <div>
        <label style={label} htmlFor="co-amount">
          Amount (UGX) <span style={{ fontWeight: 500, color: "#777" }}>Available {formatUGX(wallet.wallet.availableUGX)}</span>
        </label>
        <input id="co-amount" type="number" inputMode="numeric" min={minCashoutUGX} step={1} value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder={`At least ${formatUGX(minCashoutUGX)}`} style={input} />
        {tooMuch && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>That is more than your wallet has.</div>}
        {tooLittle && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>The minimum cash-out is {formatUGX(minCashoutUGX)}.</div>}
      </div>
      <div>
        <label style={label} htmlFor="co-phone">Mobile money number</label>
        <input id="co-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => onPhone(e.target.value)} placeholder="0772 123456" style={input} />
        {phone.trim() !== "" && !phoneOk && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 4 }}>Enter a Ugandan mobile number.</div>}
      </div>
      <div>
        <span style={label}>Network</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(["mtn", "airtel"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              aria-pressed={network === n}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: `1.5px solid ${network === n ? (n === "mtn" ? "#f9a825" : "#e53935") : "#d6d6d6"}`,
                background: network === n ? (n === "mtn" ? "#fff8e1" : "#ffebee") : "#fff",
                fontWeight: 800,
                fontFamily: FONT,
                cursor: "pointer",
              }}
            >
              {n === "mtn" ? "MTN MoMo" : "Airtel Money"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={label} htmlFor="co-password">Confirm with your password</label>
        <input id="co-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
      </div>
      <button type="button" onClick={submit} disabled={disabled} style={button("#1976d2", disabled)}>
        {busy ? "Requesting…" : "Sentify cash-out"}
      </button>
    </div>
  );
}

function Offers({ token, offers, onDone }: { token: string; offers: WalletData["offers"]; onDone: Done }) {
  const cancel = useMutation(api.farmcoinExchange.cancelSellOffer);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (offers.length === 0) return null;

  const takeBack = async (offerId: Id<"farmcoinSellOffers">) => {
    setBusyId(offerId);
    try {
      const r = await cancel({ sessionToken: token, offerId });
      onDone({ ok: true, text: `${r.returned} unsold FarmCoin returned to your balance.` });
    } catch (e) {
      onDone({ ok: false, text: errorText(e, "Could not take the coins back.") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>My FarmCoin for sale</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {offers.map((o) => {
          const sold = o.coinsOffered - o.coinsRemaining;
          return (
            <div key={o._id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
              <div style={{ flex: 1, fontSize: "0.88rem" }}>
                <div style={{ fontWeight: 700 }}>
                  {o.status === "open" ? `${o.coinsRemaining.toLocaleString()} of ${o.coinsOffered.toLocaleString()} waiting` : o.status === "filled" ? `${o.coinsOffered.toLocaleString()} sold` : `Taken back${sold > 0 ? ` after ${sold.toLocaleString()} sold` : ""}`}
                </div>
                <div style={{ color: "#777", fontSize: "0.78rem" }}>{formatWhen(o.createdAt)}</div>
              </div>
              {o.status === "open" && (
                <button
                  type="button"
                  onClick={() => takeBack(o._id)}
                  disabled={busyId === o._id}
                  style={{ minHeight: 40, padding: "0 0.8rem", borderRadius: 999, border: "1.5px solid #c62828", background: "#fff", color: "#c62828", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}
                >
                  {busyId === o._id ? "…" : "Take back"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CASHOUT_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: "Waiting to be paid", color: "#8d6e00" },
  paid: { text: "Paid", color: GREEN },
  rejected: { text: "Not paid, money returned", color: "#c62828" },
};

function Cashouts({ cashouts }: { cashouts: WalletData["cashouts"] }) {
  if (cashouts.length === 0) return null;
  return (
    <section style={card}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>Cash-outs</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {cashouts.map((c) => (
          <div key={c._id} style={{ borderBottom: "1px solid #eee", paddingBottom: 8, fontSize: "0.88rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{formatUGX(c.amountUGX)}</span>
              <span style={{ color: CASHOUT_STATUS[c.status].color }}>{CASHOUT_STATUS[c.status].text}</span>
            </div>
            <div style={{ color: "#777", fontSize: "0.78rem" }}>
              {c.network === "mtn" ? "MTN" : "Airtel"} {c.phone} · {formatWhen(c.requestedAt)}
              {c.providerReference && ` · ID ${c.providerReference}`}
            </div>
            {c.rejectReason && <div style={{ color: "#c62828", fontSize: "0.8rem" }}>{c.rejectReason}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Activity({ activity }: { activity: WalletData["activity"] }) {
  if (activity.length === 0) return null;
  return (
    <section style={card}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>Wallet activity</h2>
      <div style={{ display: "grid", gap: 6 }}>
        {activity.map((a) => {
          const inflow = a.inflow;
          const demoNote = a.demoAmount <= 0 ? null : a.demoAmount >= a.amount ? "demo money" : `${formatUGX(a.demoAmount)} demo`;
          return (
            <div key={a._id} style={{ display: "flex", gap: 8, fontSize: "0.85rem", borderBottom: "1px solid #f0f0f0", paddingBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.label}</div>
                <div style={{ color: "#777", fontSize: "0.76rem" }}>
                  {formatWhen(a.timestamp)}
                  {a.note && ` · ${a.note}`}
                  {demoNote && <span style={{ color: "#8d6e00", fontWeight: 700 }}> · {demoNote}</span>}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: inflow ? GREEN : "#444", whiteSpace: "nowrap" }}>
                {inflow ? "+" : "−"} {formatUGX(a.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
